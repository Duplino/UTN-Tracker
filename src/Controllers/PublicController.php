<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Request;
use App\Http\Response;
use App\Repositories\ElectivesRepository;
use App\Repositories\EnrollmentRepository;
use App\Repositories\PreferencesRepository;
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
        ]);
    }

    private function resolveUserId(string $identifier): ?int
    {
        if (ctype_digit($identifier)) {
            $stmt = $this->pdo->prepare('SELECT id FROM users WHERE id = :id');
            $stmt->execute(['id' => (int) $identifier]);
        } else {
            $stmt = $this->pdo->prepare('SELECT user_id AS id FROM user_preferences WHERE share_token = :token');
            $stmt->execute(['token' => $identifier]);
        }
        $row = $stmt->fetch();
        return $row ? (int) $row['id'] : null;
    }
}
