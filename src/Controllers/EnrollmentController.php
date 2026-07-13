<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth\AuthMiddleware;
use App\Http\Request;
use App\Http\Response;
use App\Repositories\EnrollmentRepository;
use App\Repositories\EvaluationSchemeRepository;
use App\Repositories\SubjectRetakeRepository;
use PDO;

final class EnrollmentController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(Request $request): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $repo = new EnrollmentRepository($this->pdo);
        Response::json(['enrollments' => $repo->allForUser((int) $user['id'])]);
    }

    public function create(Request $request): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $subjectCode = (string) $request->input('subjectCode', '');
        $schemeCode = (string) $request->input('schemeCode', '');

        if ($subjectCode === '' || $schemeCode === '') {
            Response::error('missing_fields', 422);
        }

        $schemes = new EvaluationSchemeRepository($this->pdo);
        $scheme = $schemes->findByCode($schemeCode);
        if (!$scheme) {
            Response::error('unknown_scheme', 422);
        }

        $repo = new EnrollmentRepository($this->pdo);
        if ($repo->find((int) $user['id'], $subjectCode)) {
            Response::error('already_enrolled', 409);
        }

        $enrollmentId = $repo->create((int) $user['id'], $subjectCode, (int) $scheme['id']);
        if ($enrollmentId === null) {
            Response::error('unknown_subject', 422);
        }

        Response::json($repo->findHydrated((int) $user['id'], $subjectCode), 201);
    }

    public function updateSettings(Request $request, array $params): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $repo = new EnrollmentRepository($this->pdo);
        $enrollment = $repo->find((int) $user['id'], $params['subjectCode']);
        if (!$enrollment) {
            Response::error('not_found', 404);
        }

        $schemeId = null;
        $schemeCode = $request->input('schemeCode');
        if ($schemeCode !== null) {
            $schemes = new EvaluationSchemeRepository($this->pdo);
            $scheme = $schemes->findByCode((string) $schemeCode);
            if (!$scheme) {
                Response::error('unknown_scheme', 422);
            }
            $schemeId = (int) $scheme['id'];
        }

        $year = $request->input('enrollmentYear');
        $repo->updateSchemeAndYear((int) $enrollment['id'], $schemeId, $year !== null ? (int) $year : null);

        Response::json($repo->findHydrated((int) $user['id'], $params['subjectCode']));
    }

    public function remove(Request $request, array $params): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $repo = new EnrollmentRepository($this->pdo);
        $enrollment = $repo->find((int) $user['id'], $params['subjectCode']);
        if (!$enrollment) {
            Response::error('not_found', 404);
        }
        $repo->delete((int) $enrollment['id']);
        Response::noContent();
    }

    // Recursar borra la inscripción entera (la materia vuelve a verse "disponible
    // para cursar", como si no se hubiera iniciado) y suma 1 al conteo persistente de
    // subject_retakes, que sobrevive a esa baja — por eso no hay un enrollment que
    // devolver hidratado, a diferencia del resto de los endpoints de esta clase.
    public function recursar(Request $request, array $params): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $repo = new EnrollmentRepository($this->pdo);
        $enrollment = $repo->find((int) $user['id'], $params['subjectCode']);
        if (!$enrollment) {
            Response::error('not_found', 404);
        }
        $repo->delete((int) $enrollment['id']);
        $recursedCount = (new SubjectRetakeRepository($this->pdo))
            ->increment((int) $user['id'], (int) $enrollment['subject_id']);
        Response::json(['subjectCode' => $params['subjectCode'], 'recursedCount' => $recursedCount, 'enrolled' => false]);
    }

    public function setOverride(Request $request, array $params): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $repo = new EnrollmentRepository($this->pdo);
        $enrollment = $repo->find((int) $user['id'], $params['subjectCode']);
        if (!$enrollment) {
            Response::error('not_found', 404);
        }
        $status = $request->input('status');
        $repo->setOverride((int) $enrollment['id'], $status !== null ? (string) $status : null);
        Response::json($repo->findHydrated((int) $user['id'], $params['subjectCode']));
    }

    public function saveResults(Request $request, array $params): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $repo = new EnrollmentRepository($this->pdo);
        $enrollment = $repo->find((int) $user['id'], $params['subjectCode']);
        if (!$enrollment) {
            Response::error('not_found', 404);
        }

        $repo->saveResults(
            (int) $enrollment['id'],
            (array) $request->input('partials', []),
            (array) $request->input('finals', []),
            (array) $request->input('checklist', []),
            $request->input('clearOverride', true) !== false
        );

        Response::json($repo->findHydrated((int) $user['id'], $params['subjectCode']));
    }
}
