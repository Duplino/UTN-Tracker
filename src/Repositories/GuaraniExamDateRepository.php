<?php

declare(strict_types=1);

namespace App\Repositories;

use PDO;

// Mesas de final traídas de Guaraní (ver database/migrations/0015_guarani_exam_dates.sql
// y bin/fetch-exam-dates.php). Es data pública, igual para todos los usuarios.
final class GuaraniExamDateRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    /** Mesas de hoy en adelante, con el código de materia de la app. */
    public function upcoming(): array
    {
        $rows = $this->pdo->query(
            'SELECT s.code AS subject_code, g.exam_date, g.start_time, g.inscription_type, g.location,
                    g.inscription_start, g.inscription_end
             FROM guarani_exam_dates g
             JOIN subjects s ON s.id = g.subject_id
             WHERE g.exam_date >= CURDATE()
             ORDER BY g.exam_date, s.code, g.inscription_type, g.location'
        )->fetchAll();

        return array_map(static fn (array $r): array => [
            'subjectCode' => $r['subject_code'],
            'date' => $r['exam_date'],
            'startTime' => $r['start_time'] !== null ? substr($r['start_time'], 0, 5) : null,
            'inscriptionType' => $r['inscription_type'],
            'location' => $r['location'],
            'inscriptionStart' => $r['inscription_start'],
            'inscriptionEnd' => $r['inscription_end'],
        ], $rows);
    }

    public function lastFetchedAt(): ?string
    {
        $value = $this->pdo->query('SELECT MAX(fetched_at) FROM guarani_exam_dates')->fetchColumn();
        return $value !== false && $value !== null ? (string) $value : null;
    }

    /** De los códigos de Guaraní, los que existen en el catálogo (subjects.id). */
    public function knownSubjectIds(array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        if ($ids === []) {
            return [];
        }
        $stmt = $this->pdo->prepare('SELECT id FROM subjects WHERE id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')');
        $stmt->execute($ids);
        return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    /**
     * Reemplaza todas las mesas por las de esta corrida (en una transacción: si algo
     * falla queda lo que había). Las filas repetidas (una materia compartida entre
     * carreras aparece en las dos) se guardan una sola vez.
     *
     * @return int cantidad de mesas guardadas
     */
    public function replaceAll(array $rows): int
    {
        $now = date('Y-m-d H:i:s');
        $this->pdo->beginTransaction();
        try {
            $this->pdo->exec('DELETE FROM guarani_exam_dates');
            $insert = $this->pdo->prepare(
                'INSERT IGNORE INTO guarani_exam_dates
                   (subject_id, exam_date, start_time, inscription_type, location, inscription_start, inscription_end, fetched_at)
                 VALUES (:sid, :date, :start, :type, :loc, :istart, :iend, :now)'
            );
            $count = 0;
            foreach ($rows as $r) {
                $insert->execute([
                    'sid' => $r['subjectId'],
                    'date' => $r['date'],
                    'start' => $r['startTime'],
                    'type' => mb_substr($r['inscriptionType'], 0, 60),
                    'loc' => mb_substr($r['location'], 0, 120),
                    'istart' => $r['inscriptionStart'],
                    'iend' => $r['inscriptionEnd'],
                    'now' => $now,
                ]);
                $count += $insert->rowCount();
            }
            $this->pdo->commit();
            return $count;
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
