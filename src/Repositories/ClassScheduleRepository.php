<?php

declare(strict_types=1);

namespace App\Repositories;

use PDO;

// Horario semanal por (usuario, materia). Ver database/migrations/0010_class_sessions.sql.
// Se escribe siempre de a una materia entera (todas sus filas juntas): así editar,
// borrar e importar son la misma operación.
final class ClassScheduleRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function allForUser(int $userId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT cs.id, s.code AS subject_code, cs.weekday, cs.start_time, cs.end_time, cs.commission, cs.campus
             FROM class_sessions cs
             JOIN subjects s ON s.id = cs.subject_id
             WHERE cs.user_id = :uid
             ORDER BY cs.weekday, cs.start_time, cs.id'
        );
        $stmt->execute(['uid' => $userId]);
        return array_map([$this, 'hydrate'], $stmt->fetchAll());
    }

    // Reemplaza todas las filas de una materia. Con $sessions vacío la saca del horario.
    public function replaceSubject(int $userId, int $subjectId, array $sessions, ?string $commission, ?string $campus): void
    {
        $this->pdo->beginTransaction();
        try {
            $this->insertSubject($userId, $subjectId, $sessions, $commission, $campus);
            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    // Reemplaza el horario completo: [[subjectId, sessions, commission, campus], ...].
    public function replaceAll(int $userId, array $subjects): void
    {
        $this->pdo->beginTransaction();
        try {
            $this->pdo->prepare('DELETE FROM class_sessions WHERE user_id = :uid')->execute(['uid' => $userId]);
            foreach ($subjects as [$subjectId, $sessions, $commission, $campus]) {
                $this->insertSubject($userId, $subjectId, $sessions, $commission, $campus);
            }
            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    private function insertSubject(int $userId, int $subjectId, array $sessions, ?string $commission, ?string $campus): void
    {
        $this->pdo->prepare('DELETE FROM class_sessions WHERE user_id = :uid AND subject_id = :sid')
            ->execute(['uid' => $userId, 'sid' => $subjectId]);
        $insert = $this->pdo->prepare(
            'INSERT INTO class_sessions (user_id, subject_id, weekday, start_time, end_time, commission, campus)
             VALUES (:uid, :sid, :wd, :st, :et, :com, :campus)'
        );
        foreach ($sessions as $s) {
            $insert->execute([
                'uid' => $userId, 'sid' => $subjectId, 'wd' => $s['weekday'],
                'st' => $s['start'], 'et' => $s['end'], 'com' => $commission, 'campus' => $campus,
            ]);
        }
    }

    private function hydrate(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'subjectCode' => $row['subject_code'],
            'weekday' => (int) $row['weekday'],
            'start' => $row['start_time'],
            'end' => $row['end_time'],
            'commission' => $row['commission'],
            'campus' => $row['campus'],
        ];
    }
}
