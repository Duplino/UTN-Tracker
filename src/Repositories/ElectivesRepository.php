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
        $stmt = $this->pdo->prepare(
            'SELECT c.code AS career_code, s.code AS subject_code, ue.column_index
             FROM user_electives ue
             JOIN careers c ON c.id = ue.career_id
             JOIN subjects s ON s.id = ue.subject_id
             WHERE ue.user_id = :uid'
        );
        $stmt->execute(['uid' => $userId]);
        return array_map(static function (array $row): array {
            return [
                'careerCode' => $row['career_code'],
                'subjectCode' => $row['subject_code'],
                'columnIndex' => (int) $row['column_index'],
            ];
        }, $stmt->fetchAll());
    }

    public function upsert(int $userId, string $careerCode, string $subjectCode, int $columnIndex): bool
    {
        $careerId = $this->careerIdByCode($careerCode);
        $subjectId = $this->subjectIdByCode($subjectCode);
        if ($careerId === null || $subjectId === null) {
            return false;
        }
        $stmt = $this->pdo->prepare(
            'INSERT INTO user_electives (user_id, career_id, subject_id, column_index)
             VALUES (:uid, :career, :subject, :col)
             ON DUPLICATE KEY UPDATE column_index = VALUES(column_index)'
        );
        $stmt->execute(['uid' => $userId, 'career' => $careerId, 'subject' => $subjectId, 'col' => $columnIndex]);
        return true;
    }

    public function remove(int $userId, string $careerCode, string $subjectCode): void
    {
        $stmt = $this->pdo->prepare(
            'DELETE ue FROM user_electives ue
             JOIN careers c ON c.id = ue.career_id
             JOIN subjects s ON s.id = ue.subject_id
             WHERE ue.user_id = :uid AND c.code = :career AND s.code = :subject'
        );
        $stmt->execute(['uid' => $userId, 'career' => $careerCode, 'subject' => $subjectCode]);
    }

    private function careerIdByCode(string $code): ?int
    {
        $stmt = $this->pdo->prepare('SELECT id FROM careers WHERE code = :code');
        $stmt->execute(['code' => $code]);
        $row = $stmt->fetch();
        return $row ? (int) $row['id'] : null;
    }

    private function subjectIdByCode(string $code): ?int
    {
        $stmt = $this->pdo->prepare('SELECT id FROM subjects WHERE code = :code');
        $stmt->execute(['code' => $code]);
        $row = $stmt->fetch();
        return $row ? (int) $row['id'] : null;
    }
}
