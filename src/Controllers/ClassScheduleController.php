<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth\AuthMiddleware;
use App\Http\Request;
use App\Http\Response;
use App\Repositories\ClassScheduleRepository;
use App\Repositories\EnrollmentRepository;
use PDO;

// Horario semanal (días y horas de cursada). Se edita de a una materia entera
// (PUT /api/class-schedule/{subjectCode}) o todo junto al importar el comprobante
// de inscripción (PUT /api/class-schedule).
final class ClassScheduleController
{
    public const MAX_SESSIONS_PER_SUBJECT = 6;
    public const MAX_SUBJECTS = 20;

    public function __construct(private PDO $pdo)
    {
    }

    public function index(Request $request): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        Response::json(['sessions' => (new ClassScheduleRepository($this->pdo))->allForUser((int) $user['id'])]);
    }

    public function saveSubject(Request $request, array $params): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $userId = (int) $user['id'];

        $subjectId = (new EnrollmentRepository($this->pdo))->subjectIdByCode((string) $params['subjectCode']);
        if ($subjectId === null) {
            Response::error('unknown_subject', 422);
        }
        $parsed = self::parseSubject($request->all());
        if (is_string($parsed)) {
            Response::error($parsed, 422);
        }

        $repo = new ClassScheduleRepository($this->pdo);
        $repo->replaceSubject($userId, $subjectId, $parsed['sessions'], $parsed['commission'], $parsed['campus']);
        Response::json(['sessions' => $repo->allForUser($userId)]);
    }

    public function replaceAll(Request $request): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $userId = (int) $user['id'];

        $subjects = $request->input('subjects', []);
        if (!is_array($subjects) || count($subjects) > self::MAX_SUBJECTS) {
            Response::error('invalid_subjects', 422);
        }
        $enrollments = new EnrollmentRepository($this->pdo);
        $rows = [];
        foreach ($subjects as $entry) {
            if (!is_array($entry)) {
                Response::error('invalid_subjects', 422);
            }
            $subjectId = $enrollments->subjectIdByCode((string) ($entry['subjectCode'] ?? ''));
            if ($subjectId === null) {
                Response::error('unknown_subject', 422);
            }
            $parsed = self::parseSubject($entry);
            if (is_string($parsed)) {
                Response::error($parsed, 422);
            }
            $rows[] = [$subjectId, $parsed['sessions'], $parsed['commission'], $parsed['campus']];
        }

        $repo = new ClassScheduleRepository($this->pdo);
        $repo->replaceAll($userId, $rows);
        Response::json(['sessions' => $repo->allForUser($userId)]);
    }

    // Valida {sessions: [{weekday, start, end}], commission?, campus?}. Devuelve el
    // código de error como string si algo no cierra. Público para reusarlo al importar
    // el horario del modo invitado.
    public static function parseSubject(array $input): array|string
    {
        $sessions = $input['sessions'] ?? null;
        if (!is_array($sessions) || count($sessions) > self::MAX_SESSIONS_PER_SUBJECT) {
            return 'invalid_sessions';
        }
        $out = [];
        foreach ($sessions as $s) {
            if (!is_array($s)) {
                return 'invalid_sessions';
            }
            $weekday = filter_var($s['weekday'] ?? null, FILTER_VALIDATE_INT);
            if ($weekday === false || $weekday < 0 || $weekday > 5) {
                return 'invalid_weekday';
            }
            $start = self::time($s['start'] ?? null);
            $end = self::time($s['end'] ?? null);
            if ($start === null || $end === null || $start >= $end) {
                return 'invalid_time';
            }
            $out[] = ['weekday' => $weekday, 'start' => $start, 'end' => $end];
        }
        return [
            'sessions' => $out,
            'commission' => self::text($input['commission'] ?? null, 20),
            'campus' => self::text($input['campus'] ?? null, 60),
        ];
    }

    // 'H:MM' o 'HH:MM' -> 'HH:MM' (o null si no es una hora válida).
    private static function time(mixed $value): ?string
    {
        if (!is_string($value) || !preg_match('/^([01]?\d|2[0-3]):([0-5]\d)$/', $value, $m)) {
            return null;
        }
        return sprintf('%02d:%s', (int) $m[1], $m[2]);
    }

    private static function text(mixed $value, int $max): ?string
    {
        if (!is_string($value)) {
            return null;
        }
        $value = trim($value);
        return $value === '' ? null : mb_substr($value, 0, $max);
    }
}
