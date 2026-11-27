<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Http\Request;
use App\Http\Response;
use App\Repositories\GuaraniExamDateRepository;
use PDO;

// GET /api/guarani-exam-dates: mesas de final publicadas en Guaraní, de hoy en
// adelante. Público (sirve también en modo invitado) y cacheable: cambia como
// mucho una vez por semana, cuando corre bin/fetch-exam-dates.php.
final class GuaraniExamDateController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(Request $request): void
    {
        $repo = new GuaraniExamDateRepository($this->pdo);
        Response::publicCache(3600, 3600);
        Response::json([
            'fetchedAt' => $repo->lastFetchedAt(),
            'examDates' => $repo->upcoming(),
        ]);
    }
}
