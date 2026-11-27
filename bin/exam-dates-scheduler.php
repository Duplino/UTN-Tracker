<?php

declare(strict_types=1);

// Corre bin/fetch-exam-dates.php los lunes a las 9 (hora de Buenos Aires), sin cron:
// es el proceso del servicio `scheduler` de docker-compose.yml, que queda vivo
// durmiendo hasta la próxima corrida (y lo reinicia Docker si se cae).
//
// Además, al arrancar corre enseguida si nunca se trajeron fechas o si la última
// vez fue hace más de una semana (por ejemplo después de un deploy con la base
// nueva, o si el contenedor estuvo caído un lunes). Si una corrida falla (Guaraní
// caído), reintenta en unas horas en vez de esperar al lunes siguiente.
//
//   php bin/exam-dates-scheduler.php

require __DIR__ . '/../vendor/autoload.php';

use App\Config\Database;
use App\Config\Env;
use App\Repositories\GuaraniExamDateRepository;

const RUN_WEEKDAY = 1;          // lunes (ISO-8601: 1 = lunes)
const RUN_TIME = '09:00';
const RETRY_SECONDS = 6 * 3600; // si falla, de nuevo en 6 horas
const STALE_SECONDS = 7 * 86400;

Env::load(__DIR__ . '/../.env');
$tz = new DateTimeZone('America/Argentina/Buenos_Aires');
$log = static fn (string $msg) => fwrite(STDOUT, '[' . (new DateTimeImmutable('now', $tz))->format('Y-m-d H:i:s') . "] scheduler: {$msg}\n");

// Próximo lunes a las 9 (hoy mismo si es lunes y todavía no son las 9).
function nextRun(DateTimeImmutable $now): DateTimeImmutable
{
    [$h, $m] = array_map('intval', explode(':', RUN_TIME));
    $candidate = $now->setTime($h, $m);
    $days = (RUN_WEEKDAY - (int) $candidate->format('N') + 7) % 7;
    $candidate = $candidate->modify("+{$days} days");
    return $candidate <= $now ? $candidate->modify('+7 days') : $candidate;
}

function lastFetchedAt(): ?int
{
    try {
        $value = (new GuaraniExamDateRepository(Database::connection()))->lastFetchedAt();
        return $value !== null ? strtotime($value) : null;
    } catch (\Throwable $e) {
        return null; // base todavía sin migrar o caída: se trata como "nunca"
    }
}

// En un proceso aparte, para que un error fatal no tire abajo el loop.
function runFetch(): bool
{
    passthru(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/fetch-exam-dates.php'), $code);
    return $code === 0;
}

// La primera corrida espera un par de minutos: el contenedor arranca junto con el
// de la app, que es el que aplica las migraciones.
$last = lastFetchedAt();
$wait = ($last === null || time() - $last > STALE_SECONDS) ? 120 : null;

while (true) {
    if ($wait === null) {
        $next = nextRun(new DateTimeImmutable('now', $tz));
        $wait = max(0, $next->getTimestamp() - time());
        $log('próxima corrida: ' . $next->format('Y-m-d H:i'));
    }
    if ($wait > 0) {
        sleep($wait);
    }
    $log('trayendo fechas de Guaraní');
    if (runFetch()) {
        $wait = null;
    } else {
        $wait = RETRY_SECONDS;
        $log('falló, reintento en ' . (RETRY_SECONDS / 3600) . ' horas');
    }
}
