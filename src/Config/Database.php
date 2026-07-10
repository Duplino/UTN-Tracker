<?php

declare(strict_types=1);

namespace App\Config;

use PDO;

final class Database
{
    private static ?PDO $instance = null;

    public static function connection(): PDO
    {
        if (self::$instance === null) {
            $host = Env::get('MYSQL_IP', '127.0.0.1');
            $port = Env::get('MYSQL_PORT', '3306');
            $db = Env::get('DB');
            $user = Env::get('DB_USER');
            $password = Env::get('DB_PASSWORD');

            $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";
            self::$instance = new PDO($dsn, $user, $password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        }

        return self::$instance;
    }
}
