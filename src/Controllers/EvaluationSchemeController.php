<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Request;
use App\Http\Response;
use App\Repositories\EvaluationSchemeRepository;
use PDO;

final class EvaluationSchemeController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(Request $request): void
    {
        $repo = new EvaluationSchemeRepository($this->pdo);
        Response::json(['schemes' => $repo->all()]);
    }
}
