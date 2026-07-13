<?php

declare(strict_types=1);

namespace App\Repositories;

use PDO;

final class UserCareerRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function allForUser(int $userId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT uc.show_intermediate_title, c.code, c.name, c.has_intermediate_title, c.intermediate_title_name
             FROM user_careers uc
             JOIN careers c ON c.id = uc.career_id
             WHERE uc.user_id = :uid
             ORDER BY uc.enrolled_at'
        );
        $stmt->execute(['uid' => $userId]);
        return array_map(static function (array $row): array {
            return [
                'code' => $row['code'],
                'name' => $row['name'],
                'hasIntermediateTitle' => (bool) $row['has_intermediate_title'],
                'intermediateTitle' => $row['intermediate_title_name'],
                'showIntermediateTitle' => (bool) $row['show_intermediate_title'],
            ];
        }, $stmt->fetchAll());
    }

    // Solo agrega/quita la fila de "anotado en esta carrera" — nunca toca enrollments,
    // las notas ya cargadas siguen intactas (están linkeadas a la materia, no a la carrera).
    public function enroll(int $userId, int $careerId): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT IGNORE INTO user_careers (user_id, career_id) VALUES (:uid, :cid)'
        );
        $stmt->execute(['uid' => $userId, 'cid' => $careerId]);
    }

    public function unenroll(int $userId, int $careerId): void
    {
        $this->pdo->prepare('DELETE FROM user_careers WHERE user_id = :uid AND career_id = :cid')
            ->execute(['uid' => $userId, 'cid' => $careerId]);
    }

    public function setShowIntermediateTitle(int $userId, int $careerId, bool $value): void
    {
        $this->pdo->prepare(
            'UPDATE user_careers SET show_intermediate_title = :val WHERE user_id = :uid AND career_id = :cid'
        )->execute(['val' => $value ? 1 : 0, 'uid' => $userId, 'cid' => $careerId]);
    }
}
