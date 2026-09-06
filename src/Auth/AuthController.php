<?php

declare(strict_types=1);

namespace App\Auth;

use App\Config\Env;
use App\Http\Request;
use App\Http\Response;
use App\Http\Session;
use App\Repositories\CareerRepository;
use App\Repositories\EnrollmentRepository;
use App\Repositories\EvaluationSchemeRepository;
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

        Response::json(['imported' => $imported, 'skipped' => $skipped]);
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
