<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth\AuthMiddleware;
use App\Http\Request;
use App\Http\Response;
use App\Repositories\EnrollmentRepository;
use App\Repositories\SubjectRetakeRepository;
use PDO;

// Conteo de recursadas por materia: recurso propio, separado de enrollments (ver
// database/schema.sql) porque tiene que sobrevivir a que se borre la inscripción
// activa (recursar la borra; ver EnrollmentController::recursar).
final class SubjectRetakeController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(Request $request): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $repo = new SubjectRetakeRepository($this->pdo);
        Response::json(['retakes' => $repo->allForUser((int) $user['id'])]);
    }

    // Editar el número directamente (no incrementar): para corregir un error (ej.
    // tocaron "Recursar" de más) sin borrar notas ni tocar la inscripción activa.
    public function update(Request $request, array $params): void
    {
        $user = AuthMiddleware::requireAuth($this->pdo);
        $subjectId = (new EnrollmentRepository($this->pdo))->subjectIdByCode($params['subjectCode']);
        if ($subjectId === null) {
            Response::error('unknown_subject', 422);
        }

        $count = $request->input('recursedCount');
        if ($count === null) {
            Response::error('missing_recursed_count', 422);
        }

        $repo = new SubjectRetakeRepository($this->pdo);
        $repo->setCount((int) $user['id'], $subjectId, (int) $count);
        Response::json(['subjectCode' => $params['subjectCode'], 'recursedCount' => $repo->getCount((int) $user['id'], $subjectId)]);
    }
}
