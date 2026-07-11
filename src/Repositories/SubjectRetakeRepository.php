<?php

declare(strict_types=1);

namespace App\Repositories;

use PDO;

// Conteo de recursadas por (usuario, materia). Vive separado de `enrollments` a
// propósito: "recursar" y "dar de baja" borran la inscripción activa, pero este
// conteo tiene que sobrevivir a eso (ver database/schema.sql).
final class SubjectRetakeRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function getCount(int $userId, int $subjectId): int
    {
        $stmt = $this->pdo->prepare(
            'SELECT recursed_count FROM subject_retakes WHERE user_id = :uid AND subject_id = :sid'
        );
        $stmt->execute(['uid' => $userId, 'sid' => $subjectId]);
        $value = $stmt->fetchColumn();
        return $value !== false ? (int) $value : 0;
    }

    public function increment(int $userId, int $subjectId): int
    {
        $this->pdo->prepare(
            'INSERT INTO subject_retakes (user_id, subject_id, recursed_count) VALUES (:uid, :sid, 1)
             ON DUPLICATE KEY UPDATE recursed_count = recursed_count + 1'
        )->execute(['uid' => $userId, 'sid' => $subjectId]);
        return $this->getCount($userId, $subjectId);
    }

    public function setCount(int $userId, int $subjectId, int $count): void
    {
        $count = max(0, $count);
        $this->pdo->prepare(
            'INSERT INTO subject_retakes (user_id, subject_id, recursed_count) VALUES (:uid, :sid, :count)
             ON DUPLICATE KEY UPDATE recursed_count = VALUES(recursed_count)'
        )->execute(['uid' => $userId, 'sid' => $subjectId, 'count' => $count]);
    }

    // Para todas las materias del usuario con recursed_count > 0, tengan o no
    // inscripción activa hoy (por eso no se lee desde EnrollmentRepository).
    public function allForUser(int $userId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT s.code AS subject_code, sr.recursed_count
             FROM subject_retakes sr
             JOIN subjects s ON s.id = sr.subject_id
             WHERE sr.user_id = :uid AND sr.recursed_count > 0'
        );
        $stmt->execute(['uid' => $userId]);
        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $out[$row['subject_code']] = (int) $row['recursed_count'];
        }
        return $out;
    }
}
