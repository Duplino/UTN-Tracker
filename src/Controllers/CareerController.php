<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Request;
use App\Http\Response;
use App\Repositories\CareerRepository;
use PDO;

final class CareerController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(Request $request): void
    {
        $repo = new CareerRepository($this->pdo);
        Response::json(['careers' => $repo->all()]);
    }

    public function curriculum(Request $request, array $params): void
    {
        $repo = new CareerRepository($this->pdo);
        $curriculum = $repo->curriculum($params['code']);
        if (!$curriculum) {
            Response::error('not_found', 404);
        }
        Response::json($curriculum);
    }
}
