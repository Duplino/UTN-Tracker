<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth\AuthMiddleware;
use App\Http\Request;
use App\Http\Response;
use App\Repositories\EnrollmentRepository;
use App\Repositories\ExamDateRepository;
use PDO;

// Agenda: fechas de parciales (con su instancia) y de finales. Se pueden cargar
// para cualquier instancia aunque el usuario no tenga que rendirla (las fechas de
// recuperatorios se suelen dar todas juntas a principio de año).
final class ExamDateController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(Request $request): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        Response::json(['examDates' => (new ExamDateRepository($this->pdo))->allForUser((int) $user['id'])]);
    }

    public function save(Request $request): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $userId = (int) $user['id'];

        $subjectId = (new EnrollmentRepository($this->pdo))->subjectIdByCode((string) $request->input('subjectCode', ''));
        if ($subjectId === null) {
            Response::error('unknown_subject', 422);
        }

        $parsed = self::parse($request->all());
        if (is_string($parsed)) {
            Response::error($parsed, 422);
        }

        $repo = new ExamDateRepository($this->pdo);
        $id = $repo->save($userId, $subjectId, $parsed['kind'], $parsed['partialNumber'], $parsed['attemptNumber'], $parsed['date']);
        Response::json($repo->find($userId, $id), 201);
    }

    public function remove(Request $request, array $params): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $deleted = (new ExamDateRepository($this->pdo))->delete((int) $user['id'], (int) $params['id']);
        if (!$deleted) {
            Response::error('not_found', 404);
        }
        Response::noContent();
    }

    // Valida tipo, instancia y fecha. Devuelve el código de error como string si algo
    // no cierra. Público para reusarlo al importar la agenda del modo invitado.
    public static function parse(array $input): array|string
    {
        $kind = (string) ($input['kind'] ?? '');
        if ($kind !== 'parcial' && $kind !== 'final') {
            return 'invalid_kind';
        }

        $date = (string) ($input['date'] ?? '');
        $dt = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);
        if (!$dt || $dt->format('Y-m-d') !== $date) {
            return 'invalid_date';
        }

        if ($kind === 'final') {
            return ['kind' => 'final', 'partialNumber' => null, 'attemptNumber' => null, 'date' => $date];
        }

        $partial = filter_var($input['partialNumber'] ?? null, FILTER_VALIDATE_INT);
        $attempt = filter_var($input['attemptNumber'] ?? null, FILTER_VALIDATE_INT);
        if ($partial === false || $partial < 1 || $partial > ExamDateRepository::MAX_PARTIALS) {
            return 'invalid_partial_number';
        }
        if ($attempt === false || $attempt < 1 || $attempt > ExamDateRepository::MAX_ATTEMPTS) {
            return 'invalid_attempt_number';
        }
        return ['kind' => 'parcial', 'partialNumber' => $partial, 'attemptNumber' => $attempt, 'date' => $date];
    }
}
