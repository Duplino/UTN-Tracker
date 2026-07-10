<?php

declare(strict_types=1);

require __DIR__ . '/../../vendor/autoload.php';

use App\Auth\AuthController;
use App\Config\Database;
use App\Config\Env;
use App\Controllers\ElectivesController;
use App\Controllers\EnrollmentController;
use App\Controllers\EvaluationSchemeController;
use App\Controllers\PreferencesController;
use App\Controllers\PublicController;
use App\Http\Request;
use App\Http\Router;

Env::load(__DIR__ . '/../../.env');

$pdo = Database::connection();
$request = new Request();
$router = new Router();

$auth = new AuthController($pdo);
$router->post('/api/auth/google', [$auth, 'google']);
$router->post('/api/auth/logout', [$auth, 'logout']);
$router->get('/api/auth/me', [$auth, 'me']);
$router->post('/api/auth/import-local', [$auth, 'importLocal']);

$schemes = new EvaluationSchemeController($pdo);
$router->get('/api/evaluation-schemes', [$schemes, 'index']);

$enrollments = new EnrollmentController($pdo);
$router->get('/api/enrollments', [$enrollments, 'index']);
$router->post('/api/enrollments', [$enrollments, 'create']);
$router->patch('/api/enrollments/{planCode}/{subjectCode}', [$enrollments, 'updateSettings']);
$router->post('/api/enrollments/{planCode}/{subjectCode}/recursar', [$enrollments, 'recursar']);
$router->patch('/api/enrollments/{planCode}/{subjectCode}/override', [$enrollments, 'setOverride']);
$router->put('/api/enrollments/{planCode}/{subjectCode}/results', [$enrollments, 'saveResults']);

$electives = new ElectivesController($pdo);
$router->get('/api/electives', [$electives, 'index']);
$router->put('/api/electives/{planCode}/{subjectCode}', [$electives, 'upsert']);
$router->delete('/api/electives/{planCode}/{subjectCode}', [$electives, 'remove']);

$preferences = new PreferencesController($pdo);
$router->get('/api/preferences', [$preferences, 'show']);
$router->patch('/api/preferences', [$preferences, 'update']);

$public = new PublicController($pdo);
$router->get('/api/public/{identifier}', [$public, 'show']);

$router->dispatch($request);
