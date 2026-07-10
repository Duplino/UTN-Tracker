<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth\AuthMiddleware;
use App\Http\Request;
use App\Http\Response;
use App\Repositories\EnrollmentRepository;
use App\Repositories\EvaluationSchemeRepository;
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
        $planCode = (string) $request->input('planCode', '');
        $subjectCode = (string) $request->input('subjectCode', '');
        $schemeCode = (string) $request->input('schemeCode', '');

        if ($planCode === '' || $subjectCode === '' || $schemeCode === '') {
            Response::error('missing_fields', 422);
        }

        $schemes = new EvaluationSchemeRepository($this->pdo);
        $scheme = $schemes->findByCode($schemeCode);
        if (!$scheme) {
            Response::error('unknown_scheme', 422);
        }

        $repo = new EnrollmentRepository($this->pdo);
        if ($repo->find((int) $user['id'], $planCode, $subjectCode)) {
            Response::error('already_enrolled', 409);
        }

        $repo->create((int) $user['id'], $planCode, $subjectCode, (int) $scheme['id']);
        Response::json($repo->findHydrated((int) $user['id'], $planCode, $subjectCode), 201);
    }

    public function updateSettings(Request $request, array $params): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $repo = new EnrollmentRepository($this->pdo);
        $enrollment = $repo->find((int) $user['id'], $params['planCode'], $params['subjectCode']);
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

        Response::json($repo->findHydrated((int) $user['id'], $params['planCode'], $params['subjectCode']));
    }

    public function recursar(Request $request, array $params): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $repo = new EnrollmentRepository($this->pdo);
        $enrollment = $repo->find((int) $user['id'], $params['planCode'], $params['subjectCode']);
        if (!$enrollment) {
            Response::error('not_found', 404);
        }
        $repo->recursar((int) $enrollment['id']);
        Response::json($repo->findHydrated((int) $user['id'], $params['planCode'], $params['subjectCode']));
    }

    public function setOverride(Request $request, array $params): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $repo = new EnrollmentRepository($this->pdo);
        $enrollment = $repo->find((int) $user['id'], $params['planCode'], $params['subjectCode']);
        if (!$enrollment) {
            Response::error('not_found', 404);
        }
        $status = $request->input('status');
        $repo->setOverride((int) $enrollment['id'], $status !== null ? (string) $status : null);
        Response::json($repo->findHydrated((int) $user['id'], $params['planCode'], $params['subjectCode']));
    }

    public function saveResults(Request $request, array $params): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $repo = new EnrollmentRepository($this->pdo);
        $enrollment = $repo->find((int) $user['id'], $params['planCode'], $params['subjectCode']);
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

        Response::json($repo->findHydrated((int) $user['id'], $params['planCode'], $params['subjectCode']));
    }
}
