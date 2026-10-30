<?php

declare(strict_types=1);

// Aplica las migraciones de database/migrations/ que todavía no corrieron, en orden
// por número, y las anota en la tabla schema_migrations.
//
//   php bin/migrate.php            aplica las pendientes
//   php bin/migrate.php --status   lista cuáles están aplicadas y cuáles no
//
// Lo corre el contenedor al arrancar (ver Dockerfile), así que en general no hace
// falta invocarlo a mano. Para agregar un cambio de esquema: crear el archivo
// siguiente (ej. 0008_algo.sql) y redeployar. Nunca editar una migración ya aplicada.
//
// Bases anteriores a este sistema (prod/staging, cargadas con schema.sql y los seeds
// a mano): si ya existe la tabla `users` pero no `schema_migrations`, se dan por
// aplicadas hasta LEGACY_BASELINE sin ejecutarlas, para no volver a correr los seeds.

require __DIR__ . '/../vendor/autoload.php';

use App\Config\Env;
use App\Config\SqlScript;

const LEGACY_BASELINE = '0006';

Env::load(__DIR__ . '/../.env');

$dir = dirname(__DIR__) . '/database/migrations';
$statusOnly = in_array('--status', $argv, true);

$pdo = connectWithRetry();

$pdo->exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(20) NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checksum CHAR(40) NOT NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
);

$files = migrationFiles($dir);
$applied = $pdo->query('SELECT version, checksum FROM schema_migrations')->fetchAll(PDO::FETCH_KEY_PAIR);

if ($applied === [] && tableExists($pdo, 'users')) {
    $insert = $pdo->prepare('INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)');
    foreach ($files as $version => $path) {
        if ($version > LEGACY_BASELINE) {
            break;
        }
        $insert->execute([$version, basename($path), sha1_file($path)]);
        $applied[$version] = sha1_file($path);
    }
    fwrite(STDOUT, "Base existente sin schema_migrations: marcadas como aplicadas hasta " . LEGACY_BASELINE . ".\n");
}

if ($statusOnly) {
    foreach ($files as $version => $path) {
        $mark = isset($applied[$version]) ? 'aplicada ' : 'pendiente';
        $changed = isset($applied[$version]) && $applied[$version] !== sha1_file($path) ? '  (¡modificada después de aplicarse!)' : '';
        fwrite(STDOUT, "{$mark}  " . basename($path) . "{$changed}\n");
    }
    exit(0);
}

$pending = array_diff_key($files, $applied);
if ($pending === []) {
    fwrite(STDOUT, "Migraciones: nada pendiente.\n");
    exit(0);
}

$record = $pdo->prepare('INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)');
foreach ($pending as $version => $path) {
    $name = basename($path);
    fwrite(STDOUT, "Aplicando {$name}... ");
    try {
        foreach (SqlScript::split(file_get_contents($path)) as $statement) {
            $pdo->exec($statement);
        }
    } catch (PDOException $e) {
        // MySQL hace commit implícito en cada DDL, así que no hay rollback posible:
        // la migración queda sin registrar y hay que revisarla a mano.
        fwrite(STDOUT, "ERROR\n");
        fwrite(STDERR, "{$name}: {$e->getMessage()}\n");
        exit(1);
    }
    $record->execute([$version, $name, sha1_file($path)]);
    fwrite(STDOUT, "ok\n");
}

/** @return array<string,string> version => ruta, ordenado */
function migrationFiles(string $dir): array
{
    $files = [];
    foreach (glob($dir . '/*.sql') as $path) {
        if (preg_match('/^(\d{4})_[\w-]+\.sql$/', basename($path), $m)) {
            $files[$m[1]] = $path;
        }
    }
    ksort($files, SORT_STRING);
    return $files;
}

function tableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
    $stmt->execute([$table]);
    return (int) $stmt->fetchColumn() > 0;
}

// Al arrancar con docker compose, MySQL puede tardar unos segundos más que la app.
function connectWithRetry(int $attempts = 30): PDO
{
    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        Env::get('MYSQL_IP', '127.0.0.1'),
        Env::get('MYSQL_PORT', '3306'),
        Env::get('DB')
    );
    for ($i = 1; ; $i++) {
        try {
            return new PDO($dsn, Env::get('DB_USER'), Env::get('DB_PASSWORD'), [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
        } catch (PDOException $e) {
            if ($i >= $attempts) {
                fwrite(STDERR, "No se pudo conectar a MySQL: {$e->getMessage()}\n");
                exit(1);
            }
            sleep(2);
        }
    }
}
