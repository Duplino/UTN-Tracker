<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth\AuthMiddleware;
use App\Http\Request;
use App\Http\Response;
use App\Repositories\CareerRepository;
use App\Repositories\UserCareerRepository;
use PDO;

final class UserCareerController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(Request $request): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $repo = new UserCareerRepository($this->pdo);
        Response::json(['careers' => $repo->allForUser((int) $user['id'])]);
    }

    public function enroll(Request $request): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $careerCode = (string) $request->input('careerCode', '');
        if ($careerCode === '') {
            Response::error('missing_career_code', 422);
        }

        $career = (new CareerRepository($this->pdo))->findByCode($careerCode);
        if (!$career) {
            Response::error('unknown_career', 422);
        }

        $repo = new UserCareerRepository($this->pdo);
        $repo->enroll((int) $user['id'], (int) $career['id']);
        Response::json(['careers' => $repo->allForUser((int) $user['id'])], 201);
    }

    public function unenroll(Request $request, array $params): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $career = (new CareerRepository($this->pdo))->findByCode($params['careerCode']);
        if (!$career) {
            Response::error('unknown_career', 422);
        }
        (new UserCareerRepository($this->pdo))->unenroll((int) $user['id'], (int) $career['id']);
        Response::noContent();
    }

    public function updateToggle(Request $request, array $params): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $career = (new CareerRepository($this->pdo))->findByCode($params['careerCode']);
        if (!$career) {
            Response::error('unknown_career', 422);
        }
        $value = (bool) $request->input('showIntermediateTitle', false);
        (new UserCareerRepository($this->pdo))->setShowIntermediateTitle((int) $user['id'], (int) $career['id'], $value);
        Response::noContent();
    }
}
