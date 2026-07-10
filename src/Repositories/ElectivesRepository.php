<?php

declare(strict_types=1);

namespace App\Repositories;

use PDO;

final class ElectivesRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function allForUser(int $userId): array
    {
        $stmt = $this->pdo->prepare('SELECT plan_code, subject_code, column_index FROM user_electives WHERE user_id = :uid');
        $stmt->execute(['uid' => $userId]);
        return array_map(static function (array $row): array {
            return [
                'planCode' => $row['plan_code'],
                'subjectCode' => $row['subject_code'],
                'columnIndex' => (int) $row['column_index'],
            ];
        }, $stmt->fetchAll());
    }

    public function upsert(int $userId, string $planCode, string $subjectCode, int $columnIndex): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO user_electives (user_id, plan_code, subject_code, column_index)
             VALUES (:uid, :plan, :subject, :col)
             ON DUPLICATE KEY UPDATE column_index = VALUES(column_index)'
        );
        $stmt->execute(['uid' => $userId, 'plan' => $planCode, 'subject' => $subjectCode, 'col' => $columnIndex]);
    }

    public function remove(int $userId, string $planCode, string $subjectCode): void
    {
        $stmt = $this->pdo->prepare(
            'DELETE FROM user_electives WHERE user_id = :uid AND plan_code = :plan AND subject_code = :subject'
        );
        $stmt->execute(['uid' => $userId, 'plan' => $planCode, 'subject' => $subjectCode]);
    }
}
