<?php

declare(strict_types=1);

namespace App\Auth;

use App\Http\Response;
use App\Http\Session;
use PDO;

final class AuthMiddleware
{
    public static function requireAuth(PDO $pdo): array
    {
        $user = Session::currentUser($pdo);
        if (!$user) {
            Response::error('unauthenticated', 401);
        }
        return $user;
    }
}
