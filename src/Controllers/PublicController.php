<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Request;
use App\Http\Response;
use App\Repositories\CareerRepository;
use App\Repositories\ElectivesRepository;
use App\Repositories\EnrollmentRepository;
use App\Repositories\PreferencesRepository;
use App\Repositories\UserCareerRepository;
use PDO;

final class PublicController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function show(Request $request, array $params): void
    {
        $userId = $this->resolveUserId($params['identifier']);
        if (!$userId) {
            Response::error('not_found', 404);
        }

        $preferences = (new PreferencesRepository($this->pdo))->find($userId);
        if (!$preferences['isPublic']) {
            Response::error('private_profile', 403);
        }

        Response::json([
            'preferences' => $preferences,
            'enrollments' => (new EnrollmentRepository($this->pdo))->allForUser($userId),
            'electives' => (new ElectivesRepository($this->pdo))->allForUser($userId),
            'userCareers' => (new UserCareerRepository($this->pdo))->allForUser($userId),
        ]);
    }

    // Progreso general de un usuario público en UNA carrera puntual (si tiene más de
    // una, el caller elige cuál via {careerCode}), discriminado entre título
    // intermedio y el resto de la carrera. Incluye tanto materias del tronco como
    // las electivas que el usuario haya elegido (user_electives).
    public function progress(Request $request, array $params): void
    {
        $userId = $this->resolveUserId($params['identifier']);
        if (!$userId) {
            Response::error('not_found', 404);
        }

        $preferences = (new PreferencesRepository($this->pdo))->find($userId);
        if (!$preferences['isPublic']) {
            Response::error('private_profile', 403);
        }

        $careerRepo = new CareerRepository($this->pdo);
        $career = $careerRepo->findByCode($params['careerCode']);
        if (!$career) {
            Response::error('career_not_found', 404);
        }

        $enrolledInCareer = false;
        foreach ((new UserCareerRepository($this->pdo))->allForUser($userId) as $userCareer) {
            if ($userCareer['code'] === $career['code']) {
                $enrolledInCareer = true;
                break;
            }
        }
        if (!$enrolledInCareer) {
            Response::error('not_enrolled_in_career', 404);
        }

        $curriculum = $careerRepo->curriculum($career['code']);

        $enrollmentByCode = [];
        foreach ((new EnrollmentRepository($this->pdo))->allForUser($userId) as $enrollment) {
            $enrollmentByCode[$enrollment['subjectCode']] = $enrollment;
        }

        $buckets = ['intermediate' => $this->emptyBucket(), 'rest' => $this->emptyBucket()];
        // moduleIsIntermediate: por posición (mismo índice 0-based que
        // user_electives.column_index — ver createAddElectivaPlaceholder/visIdx en
        // assets/js/index.js), true si ese módulo tiene alguna materia del tronco
        // que cuenta para el título intermedio. Sirve para clasificar las
        // electivas elegidas por el usuario, que no tienen su propio flag
        // requiredForIntermediateTitle (esa clasificación depende de en qué
        // columna/módulo las haya colocado, no de la materia en sí).
        $moduleIsIntermediate = [];
        foreach ($curriculum['modules'] as $index => $module) {
            if ($module['id'] === 'electives') {
                continue;
            }
            $moduleIsIntermediate[$index] = false;
            foreach ($module['subjects'] as $subject) {
                if ($subject['requiredForIntermediateTitle']) {
                    $bucketKey = 'intermediate';
                    $moduleIsIntermediate[$index] = true;
                } elseif (!$subject['onlyForIntermediate']) {
                    $bucketKey = 'rest';
                } else {
                    continue;
                }
                $this->tallySubject($buckets[$bucketKey], $enrollmentByCode[$subject['code']] ?? null);
            }
        }

        foreach ((new ElectivesRepository($this->pdo))->allForUser($userId) as $placement) {
            if ($placement['careerCode'] !== $career['code']) {
                continue;
            }
            if (!array_key_exists($placement['columnIndex'], $moduleIsIntermediate)) {
                continue; // column_index fuera de rango (dato viejo/inconsistente): ignorar
            }
            $bucketKey = $moduleIsIntermediate[$placement['columnIndex']] ? 'intermediate' : 'rest';
            $this->tallySubject($buckets[$bucketKey], $enrollmentByCode[$placement['subjectCode']] ?? null);
        }

        $response = [
            'career' => $career['name'],
            'rest' => $this->finalizeBucket($buckets['rest']),
        ];
        if ($career['hasIntermediateTitle']) {
            $response['intermediate'] = ['name' => $career['intermediateTitle']] + $this->finalizeBucket($buckets['intermediate']);
        }

        Response::json($response);
    }

    private function emptyBucket(): array
    {
        return [
            'total' => 0,
            'subjectsStatus' => ['approved' => 0, 'promoted' => 0, 'regularized' => 0, 'inProgress' => 0],
            'gradeSum' => 0,
            'gradeCount' => 0,
        ];
    }

    // 'total' cuenta TODAS las materias del balde (incluidas electivas elegidas),
    // tengan o no uno de los 4 estados de subjectsStatus — así el cliente puede
    // sumar total - (approved+promoted+regularized+inProgress) para saber cuántas
    // faltan (sin cursar, Desaprobada o No regularizada), que no tienen balde propio.
    private function tallySubject(array &$bucket, ?array $enrollment): void
    {
        $bucket['total']++;
        $status = $enrollment['status'] ?? null;
        switch ($status) {
            case 'Aprobada':
                $bucket['subjectsStatus']['approved']++;
                break;
            case 'Promocionada':
                $bucket['subjectsStatus']['promoted']++;
                break;
            case 'Regularizada':
                $bucket['subjectsStatus']['regularized']++;
                break;
            case 'Faltan notas':
                $bucket['subjectsStatus']['inProgress']++;
                break;
            default:
                return;
        }

        $grade = $this->contributingGrade($enrollment);
        if ($grade !== null) {
            $bucket['gradeSum'] += $grade;
            $bucket['gradeCount']++;
        }
    }

    private function finalizeBucket(array $bucket): array
    {
        return [
            'total' => $bucket['total'],
            'subjectsStatus' => $bucket['subjectsStatus'],
            'average' => $bucket['gradeCount'] > 0 ? round($bucket['gradeSum'] / $bucket['gradeCount'], 2) : null,
        ];
    }

    // Espejo de computePromedio() en assets/js/index.js y share.js: la nota que
    // representa a una materia Aprobada/Promocionada para el promedio general.
    private function contributingGrade(array $enrollment): ?int
    {
        if ($enrollment['status'] === 'Aprobada') {
            $finals = $enrollment['finals'] ?? [];
            usort($finals, static fn(array $a, array $b) => $a['attemptNumber'] <=> $b['attemptNumber']);
            foreach ($finals as $final) {
                if ($final['grade'] !== null && $final['grade'] >= 6) {
                    return (int) $final['grade'];
                }
            }
            return null;
        }

        if ($enrollment['status'] === 'Promocionada') {
            $partialCount = (int) ($enrollment['schemeConfig']['partials'] ?? 2);
            $sum = 0;
            $count = 0;
            for ($partialNumber = 1; $partialNumber <= $partialCount; $partialNumber++) {
                $attempts = $enrollment['partials'][$partialNumber] ?? [];
                $effective = null;
                for ($attemptNumber = 3; $attemptNumber >= 1; $attemptNumber--) {
                    if (($attempts[$attemptNumber] ?? null) !== null) {
                        $effective = $attempts[$attemptNumber];
                        break;
                    }
                }
                if ($effective !== null) {
                    $sum += $effective;
                    $count++;
                }
            }
            return $count > 0 ? (int) round($sum / $count) : null;
        }

        return null;
    }

    // Solo por share_token: permitir resolver por el id numérico habilitaría
    // probar ID por ID (enumeración) para encontrar perfiles públicos de otros
    // usuarios sin conocer su link. El token es impredecible (random_bytes(16)),
    // el id no.
    private function resolveUserId(string $identifier): ?int
    {
        $stmt = $this->pdo->prepare('SELECT user_id AS id FROM user_preferences WHERE share_token = :token');
        $stmt->execute(['token' => $identifier]);
        $row = $stmt->fetch();
        return $row ? (int) $row['id'] : null;
    }
}
