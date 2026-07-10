<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth\AuthMiddleware;
use App\Http\Request;
use App\Http\Response;
use App\Repositories\PreferencesRepository;
use PDO;

final class PreferencesController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function show(Request $request): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $repo = new PreferencesRepository($this->pdo);
        Response::json($repo->find((int) $user['id']));
    }

    public function update(Request $request): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $repo = new PreferencesRepository($this->pdo);
        Response::json($repo->update((int) $user['id'], $request->all()));
    }
}
