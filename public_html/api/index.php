<?php

declare(strict_types=1);

require __DIR__ . '/../../vendor/autoload.php';

use App\Auth\AuthController;
use App\Config\Database;
use App\Config\Env;
use App\Controllers\CareerController;
use App\Controllers\ElectivesController;
use App\Controllers\EnrollmentController;
use App\Controllers\EvaluationSchemeController;
use App\Controllers\PreferencesController;
use App\Controllers\PublicController;
use App\Controllers\SubjectRetakeController;
use App\Controllers\UserCareerController;
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

$careers = new CareerController($pdo);
$router->get('/api/careers', [$careers, 'index']);
$router->get('/api/careers/{code}/curriculum', [$careers, 'curriculum']);

$userCareers = new UserCareerController($pdo);
$router->get('/api/user-careers', [$userCareers, 'index']);
$router->post('/api/user-careers', [$userCareers, 'enroll']);
$router->delete('/api/user-careers/{careerCode}', [$userCareers, 'unenroll']);
$router->patch('/api/user-careers/{careerCode}', [$userCareers, 'updateToggle']);

$enrollments = new EnrollmentController($pdo);
$router->get('/api/enrollments', [$enrollments, 'index']);
$router->post('/api/enrollments', [$enrollments, 'create']);
$router->patch('/api/enrollments/{subjectCode}', [$enrollments, 'updateSettings']);
$router->delete('/api/enrollments/{subjectCode}', [$enrollments, 'remove']);
$router->post('/api/enrollments/{subjectCode}/recursar', [$enrollments, 'recursar']);
$router->patch('/api/enrollments/{subjectCode}/override', [$enrollments, 'setOverride']);
$router->put('/api/enrollments/{subjectCode}/results', [$enrollments, 'saveResults']);

$retakes = new SubjectRetakeController($pdo);
$router->get('/api/subject-retakes', [$retakes, 'index']);
$router->patch('/api/subject-retakes/{subjectCode}', [$retakes, 'update']);

$electives = new ElectivesController($pdo);
$router->get('/api/electives', [$electives, 'index']);
$router->put('/api/electives/{careerCode}/{subjectCode}', [$electives, 'upsert']);
$router->delete('/api/electives/{careerCode}/{subjectCode}', [$electives, 'remove']);

$preferences = new PreferencesController($pdo);
$router->get('/api/preferences', [$preferences, 'show']);
$router->patch('/api/preferences', [$preferences, 'update']);

$public = new PublicController($pdo);
$router->get('/api/public/{identifier}', [$public, 'show']);
$router->get('/api/public/{identifier}/progress/{careerCode}', [$public, 'progress']);

$router->dispatch($request);
