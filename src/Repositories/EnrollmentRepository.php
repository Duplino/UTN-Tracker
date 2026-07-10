<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Domain\StatusCalculator;
use PDO;

final class EnrollmentRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function find(int $userId, string $planCode, string $subjectCode): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM enrollments WHERE user_id = :uid AND plan_code = :plan AND subject_code = :subject'
        );
        $stmt->execute(['uid' => $userId, 'plan' => $planCode, 'subject' => $subjectCode]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(int $userId, string $planCode, string $subjectCode, int $schemeId): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO enrollments (user_id, plan_code, subject_code, evaluation_scheme_id, enrollment_year)
             VALUES (:uid, :plan, :subject, :scheme, :year)'
        );
        $stmt->execute([
            'uid' => $userId,
            'plan' => $planCode,
            'subject' => $subjectCode,
            'scheme' => $schemeId,
            'year' => (int) date('Y'),
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    public function updateSchemeAndYear(int $enrollmentId, ?int $schemeId, ?int $year): void
    {
        if ($schemeId !== null) {
            $this->clearResults($enrollmentId);
            $this->pdo->prepare('UPDATE enrollments SET evaluation_scheme_id = :scheme WHERE id = :id')
                ->execute(['scheme' => $schemeId, 'id' => $enrollmentId]);
        }
        if ($year !== null) {
            $this->pdo->prepare('UPDATE enrollments SET enrollment_year = :year WHERE id = :id')
                ->execute(['year' => $year, 'id' => $enrollmentId]);
        }
    }

    public function recursar(int $enrollmentId): void
    {
        $this->clearResults($enrollmentId);
        $this->pdo->prepare(
            'UPDATE enrollments SET recursed_count = recursed_count + 1, status_override = NULL WHERE id = :id'
        )->execute(['id' => $enrollmentId]);
    }

    public function setOverride(int $enrollmentId, ?string $status): void
    {
        $this->pdo->prepare('UPDATE enrollments SET status_override = :status WHERE id = :id')
            ->execute(['status' => $status, 'id' => $enrollmentId]);
    }

    private function clearResults(int $enrollmentId): void
    {
        $this->pdo->prepare('DELETE FROM enrollment_partials WHERE enrollment_id = :id')->execute(['id' => $enrollmentId]);
        $this->pdo->prepare('DELETE FROM enrollment_finals WHERE enrollment_id = :id')->execute(['id' => $enrollmentId]);
        $this->pdo->prepare('DELETE FROM enrollment_checklist WHERE enrollment_id = :id')->execute(['id' => $enrollmentId]);
    }

    public function saveResults(int $enrollmentId, array $partials, array $finals, array $checklist, bool $clearOverride): void
    {
        foreach ($partials as $partialNumber => $attempts) {
            foreach ($attempts as $attemptNumber => $grade) {
                $this->upsertPartial($enrollmentId, (int) $partialNumber, (int) $attemptNumber, $this->toGrade($grade));
            }
        }

        foreach ($finals as $attemptNumber => $final) {
            $this->upsertFinal(
                $enrollmentId,
                (int) $attemptNumber,
                $this->toGrade($final['grade'] ?? null),
                $final['examDate'] ?? null
            );
        }

        foreach ($checklist as $itemType => $items) {
            foreach ($items as $itemNumber => $completed) {
                $this->upsertChecklist($enrollmentId, (string) $itemType, (int) $itemNumber, (bool) $completed);
            }
        }

        if ($clearOverride) {
            $this->pdo->prepare('UPDATE enrollments SET status_override = NULL WHERE id = :id')
                ->execute(['id' => $enrollmentId]);
        }
    }

    private function toGrade(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        return (int) $value;
    }

    private function upsertPartial(int $enrollmentId, int $partialNumber, int $attemptNumber, ?int $grade): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO enrollment_partials (enrollment_id, partial_number, attempt_number, grade)
             VALUES (:eid, :pn, :an, :grade)
             ON DUPLICATE KEY UPDATE grade = VALUES(grade)'
        );
        $stmt->execute(['eid' => $enrollmentId, 'pn' => $partialNumber, 'an' => $attemptNumber, 'grade' => $grade]);
    }

    private function upsertFinal(int $enrollmentId, int $attemptNumber, ?int $grade, ?string $examDate): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO enrollment_finals (enrollment_id, attempt_number, grade, exam_date)
             VALUES (:eid, :an, :grade, :date)
             ON DUPLICATE KEY UPDATE grade = VALUES(grade), exam_date = VALUES(exam_date)'
        );
        $stmt->execute(['eid' => $enrollmentId, 'an' => $attemptNumber, 'grade' => $grade, 'date' => $examDate]);
    }

    private function upsertChecklist(int $enrollmentId, string $itemType, int $itemNumber, bool $completed): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO enrollment_checklist (enrollment_id, item_type, item_number, completed, completed_at)
             VALUES (:eid, :type, :num, :completed, :completed_at)
             ON DUPLICATE KEY UPDATE completed = VALUES(completed), completed_at = VALUES(completed_at)'
        );
        $stmt->execute([
            'eid' => $enrollmentId,
            'type' => $itemType,
            'num' => $itemNumber,
            'completed' => $completed ? 1 : 0,
            'completed_at' => $completed ? date('Y-m-d H:i:s') : null,
        ]);
    }

    public function allForUser(int $userId): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM enrollments WHERE user_id = :uid');
        $stmt->execute(['uid' => $userId]);

        $schemes = new EvaluationSchemeRepository($this->pdo);
        return array_map(fn(array $row) => $this->hydrate($row, $schemes), $stmt->fetchAll());
    }

    public function findHydrated(int $userId, string $planCode, string $subjectCode): ?array
    {
        $row = $this->find($userId, $planCode, $subjectCode);
        if (!$row) {
            return null;
        }
        return $this->hydrate($row, new EvaluationSchemeRepository($this->pdo));
    }

    private function hydrate(array $row, EvaluationSchemeRepository $schemes): array
    {
        $enrollmentId = (int) $row['id'];
        $scheme = $schemes->findById((int) $row['evaluation_scheme_id']);

        $partials = $this->fetchPartials($enrollmentId);
        $finals = $this->fetchFinals($enrollmentId);
        $checklist = $this->fetchChecklist($enrollmentId);

        $status = StatusCalculator::compute(
            $scheme['config'] ?? [],
            $partials,
            $finals,
            $checklist,
            $row['status_override'] ?: null
        );

        return [
            'planCode' => $row['plan_code'],
            'subjectCode' => $row['subject_code'],
            'schemeCode' => $scheme['code'] ?? null,
            'schemeConfig' => $scheme['config'] ?? null,
            'enrollmentYear' => (int) $row['enrollment_year'],
            'recursedCount' => (int) $row['recursed_count'],
            'statusOverride' => $row['status_override'],
            'status' => $status,
            'partials' => $partials,
            'finals' => array_values($finals),
            'checklist' => $checklist,
            'updatedAt' => $row['updated_at'],
        ];
    }

    private function fetchPartials(int $enrollmentId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT partial_number, attempt_number, grade FROM enrollment_partials WHERE enrollment_id = :id'
        );
        $stmt->execute(['id' => $enrollmentId]);
        $partials = [];
        foreach ($stmt->fetchAll() as $row) {
            $partials[(int) $row['partial_number']][(int) $row['attempt_number']] =
                $row['grade'] !== null ? (int) $row['grade'] : null;
        }
        return $partials;
    }

    private function fetchFinals(int $enrollmentId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT attempt_number, grade, exam_date FROM enrollment_finals WHERE enrollment_id = :id ORDER BY attempt_number'
        );
        $stmt->execute(['id' => $enrollmentId]);
        $finals = [];
        foreach ($stmt->fetchAll() as $row) {
            $finals[(int) $row['attempt_number']] = [
                'attemptNumber' => (int) $row['attempt_number'],
                'grade' => $row['grade'] !== null ? (int) $row['grade'] : null,
                'examDate' => $row['exam_date'],
            ];
        }
        return $finals;
    }

    private function fetchChecklist(int $enrollmentId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT item_type, item_number, completed FROM enrollment_checklist WHERE enrollment_id = :id'
        );
        $stmt->execute(['id' => $enrollmentId]);
        $checklist = [];
        foreach ($stmt->fetchAll() as $row) {
            $checklist[$row['item_type']][(int) $row['item_number']] = (bool) $row['completed'];
        }
        return $checklist;
    }

    public function importFromSnapshot(int $userId, array $entry): void
    {
        $planCode = (string) $entry['planCode'];
        $subjectCode = (string) $entry['subjectCode'];
        $schemeCode = (string) ($entry['schemeCode'] ?? '2-partials');

        $schemes = new EvaluationSchemeRepository($this->pdo);
        $scheme = $schemes->findByCode($schemeCode) ?? $schemes->findByCode('2-partials');

        $existing = $this->find($userId, $planCode, $subjectCode);
        if ($existing) {
            $enrollmentId = (int) $existing['id'];
            $this->clearResults($enrollmentId);
            $this->pdo->prepare(
                'UPDATE enrollments
                 SET evaluation_scheme_id = :scheme, enrollment_year = :year, recursed_count = :recursed, status_override = :override
                 WHERE id = :id'
            )->execute([
                'scheme' => $scheme['id'],
                'year' => (int) ($entry['enrollmentYear'] ?? date('Y')),
                'recursed' => (int) ($entry['recursedCount'] ?? 0),
                'override' => $entry['statusOverride'] ?? null,
                'id' => $enrollmentId,
            ]);
        } else {
            $stmt = $this->pdo->prepare(
                'INSERT INTO enrollments (user_id, plan_code, subject_code, evaluation_scheme_id, enrollment_year, recursed_count, status_override)
                 VALUES (:uid, :plan, :subject, :scheme, :year, :recursed, :override)'
            );
            $stmt->execute([
                'uid' => $userId,
                'plan' => $planCode,
                'subject' => $subjectCode,
                'scheme' => $scheme['id'],
                'year' => (int) ($entry['enrollmentYear'] ?? date('Y')),
                'recursed' => (int) ($entry['recursedCount'] ?? 0),
                'override' => $entry['statusOverride'] ?? null,
            ]);
            $enrollmentId = (int) $this->pdo->lastInsertId();
        }

        $this->saveResults(
            $enrollmentId,
            $entry['partials'] ?? [],
            $this->indexFinalsByAttempt($entry['finals'] ?? []),
            $entry['checklist'] ?? [],
            false
        );
    }

    private function indexFinalsByAttempt(array $finals): array
    {
        $indexed = [];
        foreach ($finals as $final) {
            $indexed[(int) ($final['attemptNumber'] ?? 0)] = $final;
        }
        return $indexed;
    }
}
