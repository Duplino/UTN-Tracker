<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth\AuthMiddleware;
use App\Http\Request;
use App\Http\Response;
use App\Repositories\ElectivesRepository;
use PDO;

final class ElectivesController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(Request $request): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $repo = new ElectivesRepository($this->pdo);
        Response::json(['placements' => $repo->allForUser((int) $user['id'])]);
    }

    public function upsert(Request $request, array $params): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $columnIndex = $request->input('columnIndex');
        if ($columnIndex === null) {
            Response::error('missing_column_index', 422);
        }
        $repo = new ElectivesRepository($this->pdo);
        $ok = $repo->upsert((int) $user['id'], $params['careerCode'], $params['subjectCode'], (int) $columnIndex);
        if (!$ok) {
            Response::error('unknown_career_or_subject', 422);
        }
        Response::noContent();
    }

    public function remove(Request $request, array $params): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $repo = new ElectivesRepository($this->pdo);
        $repo->remove((int) $user['id'], $params['careerCode'], $params['subjectCode']);
        Response::noContent();
    }
}
