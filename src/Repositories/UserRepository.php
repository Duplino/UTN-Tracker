<?php

declare(strict_types=1);

namespace App\Repositories;

use PDO;

final class UserRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function findByGoogleSub(string $googleSub): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE google_sub = :sub');
        $stmt->execute(['sub' => $googleSub]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(string $googleSub, string $email, ?string $displayName, ?string $avatarUrl): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO users (google_sub, email, display_name, avatar_url) VALUES (:sub, :email, :name, :avatar)'
        );
        $stmt->execute([
            'sub' => $googleSub,
            'email' => $email,
            'name' => $displayName,
            'avatar' => $avatarUrl,
        ]);
        $userId = (int) $this->pdo->lastInsertId();

        $this->pdo->prepare('INSERT INTO user_preferences (user_id) VALUES (:user_id)')
            ->execute(['user_id' => $userId]);

        return $userId;
    }

    public function touchLogin(int $userId, string $email, ?string $displayName, ?string $avatarUrl): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE users SET email = :email, display_name = :name, avatar_url = :avatar WHERE id = :id'
        );
        $stmt->execute([
            'email' => $email,
            'name' => $displayName,
            'avatar' => $avatarUrl,
            'id' => $userId,
        ]);
    }
}
