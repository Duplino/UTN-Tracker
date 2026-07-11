<?php

declare(strict_types=1);

namespace App\Repositories;

use PDO;

final class CareerRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function all(): array
    {
        $stmt = $this->pdo->query(
            'SELECT id, code, name, has_intermediate_title, intermediate_title_name FROM careers ORDER BY id'
        );
        return array_map([$this, 'hydrateCareer'], $stmt->fetchAll());
    }

    public function findByCode(string $code): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, code, name, has_intermediate_title, intermediate_title_name FROM careers WHERE code = :code'
        );
        $stmt->execute(['code' => $code]);
        $row = $stmt->fetch();
        return $row ? $this->hydrateCareer($row) : null;
    }

    private function hydrateCareer(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'code' => $row['code'],
            'name' => $row['name'],
            'hasIntermediateTitle' => (bool) $row['has_intermediate_title'],
            'intermediateTitle' => $row['intermediate_title_name'],
        ];
    }

    // Árbol completo de módulos/materias/correlativas de una carrera, con la misma
    // forma que tenían los JSON estáticos de assets/data/*.json (mismos nombres de
    // campo), más los dos nuevos: onlyForIntermediate y requiredForIntermediateTitle.
    public function curriculum(string $code): ?array
    {
        $career = $this->findByCode($code);
        if (!$career) {
            return null;
        }
        $careerId = $career['id'];

        $stmt = $this->pdo->prepare(
            'SELECT id, code, name, display_order, electives_slots
             FROM career_modules WHERE career_id = :cid ORDER BY display_order'
        );
        $stmt->execute(['cid' => $careerId]);
        $moduleRows = $stmt->fetchAll();

        $stmt = $this->pdo->prepare(
            'SELECT cs.id AS career_subject_id, cs.module_id, cs.is_elective, cs.only_for_intermediate,
                    cs.required_for_intermediate_title, cs.display_order,
                    s.code, s.name, s.week_hours, s.duration
             FROM career_subjects cs
             JOIN subjects s ON s.id = cs.subject_id
             WHERE cs.career_id = :cid
             ORDER BY cs.display_order, s.name'
        );
        $stmt->execute(['cid' => $careerId]);
        $subjectRows = $stmt->fetchAll();

        $stmt = $this->pdo->prepare(
            'SELECT sr.career_subject_id, sr.requirement_kind, sr.status_type, rs.code AS required_code
             FROM subject_requirements sr
             JOIN career_subjects cs ON cs.id = sr.career_subject_id
             JOIN subjects rs ON rs.id = sr.required_subject_id
             WHERE cs.career_id = :cid'
        );
        $stmt->execute(['cid' => $careerId]);
        $requirementsByCareerSubject = [];
        foreach ($stmt->fetchAll() as $r) {
            $requirementsByCareerSubject[(int) $r['career_subject_id']][$r['requirement_kind']][] = [
                'id' => $r['required_code'],
                'type' => $r['status_type'],
            ];
        }

        $subjectsByModule = [];
        $electiveSubjects = [];
        foreach ($subjectRows as $row) {
            $careerSubjectId = (int) $row['career_subject_id'];
            $reqs = $requirementsByCareerSubject[$careerSubjectId] ?? [];
            $dto = [
                'code' => $row['code'],
                'name' => $row['name'],
                'weekHours' => (int) $row['week_hours'],
                'duration' => $row['duration'],
                'requirements' => [
                    'cursar' => $reqs['cursar'] ?? [],
                    'aprobar' => $reqs['aprobar'] ?? [],
                ],
                'onlyForIntermediate' => (bool) $row['only_for_intermediate'],
                'requiredForIntermediateTitle' => (bool) $row['required_for_intermediate_title'],
            ];
            if ((bool) $row['is_elective']) {
                $electiveSubjects[] = $dto;
            } else {
                $subjectsByModule[(int) $row['module_id']][] = $dto;
            }
        }

        $modules = [];
        foreach ($moduleRows as $m) {
            $modules[] = [
                'id' => $m['code'],
                'name' => $m['name'],
                'electivas' => (int) $m['electives_slots'],
                'subjects' => $subjectsByModule[(int) $m['id']] ?? [],
            ];
        }
        $modules[] = [
            'id' => 'electives',
            'name' => 'Electivas',
            'render' => false,
            'subjects' => $electiveSubjects,
        ];

        return [
            'metadata' => [
                'hasIntermediateTitle' => $career['hasIntermediateTitle'],
                'intermediateTitle' => $career['intermediateTitle'],
            ],
            'modules' => $modules,
        ];
    }
}
