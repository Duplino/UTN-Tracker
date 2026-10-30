<?php

declare(strict_types=1);

namespace App\Repositories;

use PDO;

// Fechas de la agenda (parciales y finales) por (usuario, materia). Ver
// database/migrations/0008_exam_dates.sql para el significado de cada columna.
final class ExamDateRepository
{
    public const MAX_PARTIALS = 10;
    public const MAX_ATTEMPTS = 3;

    public function __construct(private PDO $pdo)
    {
    }

    public function allForUser(int $userId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT ed.id, s.code AS subject_code, ed.kind, ed.partial_number, ed.attempt_number, ed.exam_date
             FROM exam_dates ed
             JOIN subjects s ON s.id = ed.subject_id
             WHERE ed.user_id = :uid
             ORDER BY ed.exam_date, ed.id'
        );
        $stmt->execute(['uid' => $userId]);
        return array_map([$this, 'hydrate'], $stmt->fetchAll());
    }

    public function find(int $userId, int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT ed.id, s.code AS subject_code, ed.kind, ed.partial_number, ed.attempt_number, ed.exam_date
             FROM exam_dates ed
             JOIN subjects s ON s.id = ed.subject_id
             WHERE ed.user_id = :uid AND ed.id = :id'
        );
        $stmt->execute(['uid' => $userId, 'id' => $id]);
        $row = $stmt->fetch();
        return $row ? $this->hydrate($row) : null;
    }

    // Un parcial tiene una sola fecha por instancia: si ya existe se pisa la fecha.
    // Un final con la misma fecha que otro de la misma materia devuelve el existente.
    public function save(int $userId, int $subjectId, string $kind, ?int $partialNumber, ?int $attemptNumber, string $date): int
    {
        if ($kind === 'final') {
            $stmt = $this->pdo->prepare(
                "SELECT id FROM exam_dates
                 WHERE user_id = :uid AND subject_id = :sid AND kind = 'final' AND exam_date = :date"
            );
            $stmt->execute(['uid' => $userId, 'sid' => $subjectId, 'date' => $date]);
            $existing = $stmt->fetchColumn();
            if ($existing !== false) {
                return (int) $existing;
            }
            $this->pdo->prepare(
                "INSERT INTO exam_dates (user_id, subject_id, kind, exam_date) VALUES (:uid, :sid, 'final', :date)"
            )->execute(['uid' => $userId, 'sid' => $subjectId, 'date' => $date]);
            return (int) $this->pdo->lastInsertId();
        }

        $this->pdo->prepare(
            "INSERT INTO exam_dates (user_id, subject_id, kind, partial_number, attempt_number, exam_date)
             VALUES (:uid, :sid, 'parcial', :p, :a, :date)
             ON DUPLICATE KEY UPDATE exam_date = VALUES(exam_date), id = LAST_INSERT_ID(id)"
        )->execute(['uid' => $userId, 'sid' => $subjectId, 'p' => $partialNumber, 'a' => $attemptNumber, 'date' => $date]);
        return (int) $this->pdo->lastInsertId();
    }

    public function delete(int $userId, int $id): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM exam_dates WHERE user_id = :uid AND id = :id');
        $stmt->execute(['uid' => $userId, 'id' => $id]);
        return $stmt->rowCount() > 0;
    }

    private function hydrate(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'subjectCode' => $row['subject_code'],
            'kind' => $row['kind'],
            'partialNumber' => $row['partial_number'] !== null ? (int) $row['partial_number'] : null,
            'attemptNumber' => $row['attempt_number'] !== null ? (int) $row['attempt_number'] : null,
            'date' => $row['exam_date'],
        ];
    }
}
