<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Env;
use App\Http\Request;
use App\Http\Response;
use App\Http\Session;
use App\Repositories\ElectivesRepository;
use App\Repositories\EnrollmentRepository;
use App\Repositories\EvaluationSchemeRepository;
use App\Repositories\PreferencesRepository;
use App\Repositories\SubjectRetakeRepository;
use App\Repositories\UserCareerRepository;
use PDO;

// Todo lo que el frontend necesita para arrancar, en una sola respuesta: sesión,
// esquemas de evaluación y (si hay sesión) preferencias, carreras, inscripciones,
// electivas y recursadas. Reemplaza la cascada de ~6 requests encadenados que hacía
// initApp() — cada uno era un viaje completo al servidor antes de poder dibujar el
// tablero. El curriculum de la carrera no va acá: es igual para todos y se cachea
// aparte en el CDN (GET /api/careers/{code}/curriculum), y el front lo pide en paralelo.
final class BootstrapController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function show(Request $request): void
    {
        $mockAuthEnabled = Env::get('MOCK_AUTH_ENABLED') === 'true';
        $schemes = (new EvaluationSchemeRepository($this->pdo))->all();
        $user = Session::currentUser($this->pdo);

        if (!$user) {
            Response::json([
                'authenticated' => false,
                'mockAuthEnabled' => $mockAuthEnabled,
                'schemes' => $schemes,
            ]);
        }

        $userId = (int) $user['id'];
        Response::json([
            'authenticated' => true,
            'mockAuthEnabled' => $mockAuthEnabled,
            'user' => [
                'id' => $userId,
                'email' => $user['email'],
                'name' => $user['display_name'],
                'avatar' => $user['avatar_url'],
            ],
            'schemes' => $schemes,
            'preferences' => (new PreferencesRepository($this->pdo))->find($userId),
            'userCareers' => (new UserCareerRepository($this->pdo))->allForUser($userId),
            'enrollments' => (new EnrollmentRepository($this->pdo))->allForUser($userId),
            'electives' => (new ElectivesRepository($this->pdo))->allForUser($userId),
            'retakes' => (new SubjectRetakeRepository($this->pdo))->allForUser($userId),
        ]);
    }
}
