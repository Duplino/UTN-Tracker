<?php

declare(strict_types=1);

namespace App\Auth;

use App\Config\Env;
use App\Controllers\ClassScheduleController;
use App\Controllers\ExamDateController;
use App\Http\Request;
use App\Http\Response;
use App\Http\Session;
use App\Repositories\CareerRepository;
use App\Repositories\EnrollmentRepository;
use App\Repositories\EvaluationSchemeRepository;
use App\Repositories\ClassScheduleRepository;
use App\Repositories\ExamDateRepository;
use App\Repositories\UserCareerRepository;
use App\Repositories\UserRepository;
use PDO;
use Throwable;

final class AuthController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function google(Request $request): void
    {
        $idToken = (string) $request->input('id_token', '');
        if ($idToken === '') {
            Response::error('missing_id_token', 422);
        }

        try {
            $payload = GoogleTokenVerifier::verify($idToken);
        } catch (Throwable) {
            Response::error('invalid_token', 401);
        }

        $users = new UserRepository($this->pdo);
        $googleSub = (string) $payload['sub'];
        $existing = $users->findByGoogleSub($googleSub);
        $isNewUser = $existing === null;

        if ($isNewUser) {
            $userId = $users->create(
                $googleSub,
                (string) ($payload['email'] ?? ''),
                $payload['name'] ?? null,
                $payload['picture'] ?? null,
            );
        } else {
            $userId = (int) $existing['id'];
            $users->touchLogin(
                $userId,
                (string) ($payload['email'] ?? ''),
                $payload['name'] ?? null,
                $payload['picture'] ?? null,
            );
        }

        Session::issue($this->pdo, $userId);
        $user = $users->findById($userId);

        Response::json([
            'user' => $this->publicUser($user),
            'isNewUser' => $isNewUser,
        ]);
    }

    public function logout(Request $request): void
    {
        Session::destroy($this->pdo);
        Response::noContent();
    }

    public function me(Request $request): void
    {
        $mockAuthEnabled = self::mockAuthEnabled();
        $user = Session::currentUser($this->pdo);
        if (!$user) {
            Response::json(['authenticated' => false, 'mockAuthEnabled' => $mockAuthEnabled]);
        }
        Response::json([
            'authenticated' => true,
            'user' => $this->publicUser($user),
            'mockAuthEnabled' => $mockAuthEnabled,
        ]);
    }

    // Login falso para desarrollo local: crea/reutiliza un usuario fijo sin pasar
    // por Google, y si es la primera vez lo carga con datos de ejemplo para no
    // arrancar con el tablero vacío. Gateado por MOCK_AUTH_ENABLED (además el
    // router ni registra esta ruta si el flag está apagado).
    public function mockLogin(Request $request): void
    {
        if (!self::mockAuthEnabled()) {
            Response::error('not_found', 404);
        }

        $users = new UserRepository($this->pdo);
        $googleSub = 'mock-dev-user';
        $existing = $users->findByGoogleSub($googleSub);
        $isNewUser = $existing === null;

        if ($isNewUser) {
            $userId = $users->create($googleSub, 'dev@utntracker.local', 'Usuario de prueba', null);
            $this->seedSampleData($userId);
        } else {
            $userId = (int) $existing['id'];
        }

        Session::issue($this->pdo, $userId);
        $user = $users->findById($userId);

        Response::json([
            'user' => $this->publicUser($user),
            'isNewUser' => $isNewUser,
        ]);
    }

    private function seedSampleData(int $userId): void
    {
        $careers = new CareerRepository($this->pdo);
        $career = $careers->findByCode('sistemas');
        if (!$career) {
            return;
        }

        (new UserCareerRepository($this->pdo))->enroll($userId, (int) $career['id']);

        $schemes = new EvaluationSchemeRepository($this->pdo);
        $scheme = $schemes->findByCode('2-partials');
        if (!$scheme) {
            return;
        }

        $enrollments = new EnrollmentRepository($this->pdo);
        foreach (['SyPdN', 'F1'] as $subjectCode) {
            $enrollments->create($userId, $subjectCode, (int) $scheme['id']);
        }
    }

    private static function mockAuthEnabled(): bool
    {
        return Env::get('MOCK_AUTH_ENABLED') === 'true';
    }

    public function importLocal(Request $request): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $entries = (array) $request->input('enrollments', []);

        $repo = new EnrollmentRepository($this->pdo);
        $imported = 0;
        $skipped = [];

        foreach ($entries as $entry) {
            $subjectCode = (string) ($entry['subjectCode'] ?? '');
            $updatedAt = (string) ($entry['updatedAt'] ?? '');
            if ($subjectCode === '' || $updatedAt === '') {
                continue;
            }

            $existing = $repo->find((int) $user['id'], $subjectCode);
            if ($existing && strtotime((string) $existing['updated_at']) >= strtotime($updatedAt)) {
                $skipped[] = $subjectCode;
                continue;
            }

            $repo->importFromSnapshot((int) $user['id'], $entry);
            $imported++;
        }

        // Agenda del invitado: se suma a la del usuario (los parciales con fecha ya
        // cargada en la cuenta se pisan con la del navegador, los finales se agregan).
        $examDates = new ExamDateRepository($this->pdo);
        $importedDates = 0;
        foreach ((array) $request->input('examDates', []) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $subjectId = $repo->subjectIdByCode((string) ($entry['subjectCode'] ?? ''));
            $parsed = ExamDateController::parse($entry);
            if ($subjectId === null || is_string($parsed)) {
                continue;
            }
            $examDates->save((int) $user['id'], $subjectId, $parsed['kind'], $parsed['partialNumber'], $parsed['attemptNumber'], $parsed['date']);
            $importedDates++;
        }

        // Horario del invitado: cada materia que trae reemplaza la de la cuenta (las
        // que no trae quedan como estaban).
        $schedule = new ClassScheduleRepository($this->pdo);
        $bySubject = [];
        foreach ((array) $request->input('classSchedule', []) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $code = (string) ($entry['subjectCode'] ?? '');
            $bySubject[$code] ??= ['sessions' => [], 'commission' => $entry['commission'] ?? null, 'campus' => $entry['campus'] ?? null];
            $bySubject[$code]['sessions'][] = ['weekday' => $entry['weekday'] ?? null, 'start' => $entry['start'] ?? null, 'end' => $entry['end'] ?? null];
        }
        $importedSchedule = 0;
        foreach ($bySubject as $code => $input) {
            $subjectId = $repo->subjectIdByCode((string) $code);
            $parsed = ClassScheduleController::parseSubject($input);
            if ($subjectId === null || is_string($parsed)) {
                continue;
            }
            $schedule->replaceSubject((int) $user['id'], $subjectId, $parsed['sessions'], $parsed['commission'], $parsed['campus']);
            $importedSchedule++;
        }

        Response::json(['imported' => $imported, 'skipped' => $skipped, 'importedExamDates' => $importedDates, 'importedScheduleSubjects' => $importedSchedule]);
    }

    private function publicUser(array $user): array
    {
        return [
            'id' => (int) $user['id'],
            'email' => $user['email'],
            'name' => $user['display_name'],
            'avatar' => $user['avatar_url'],
        ];
    }
}
