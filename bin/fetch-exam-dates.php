<?php

declare(strict_types=1);

// Trae las mesas de final publicadas en el SIU Guaraní (autogestión > Fechas de
// examen) para cada carrera de App\Guarani\ExamDateScraper::CAREERS y las guarda en
// guarani_exam_dates, de donde la app las ofrece como sugerencia al cargar un final.
//
//   php bin/fetch-exam-dates.php             trae y reemplaza las mesas guardadas
//   php bin/fetch-exam-dates.php --dry-run   solo muestra lo que encontró, no guarda
//
// Pensado para cron en el VPS (los lunes a la mañana), corriendo dentro del contenedor:
//
//   0 9 * * 1 cd /opt/UTN-Tracker/prod && docker compose exec -T app php bin/fetch-exam-dates.php >> /var/log/utntracker-exam-dates.log 2>&1
//
// Si Guaraní no responde o la página cambió de forma, sale con 1 sin tocar lo guardado.

require __DIR__ . '/../vendor/autoload.php';

use App\Config\Database;
use App\Config\Env;
use App\Guarani\ExamDateScraper;
use App\Repositories\GuaraniExamDateRepository;

Env::load(__DIR__ . '/../.env');

$dryRun = in_array('--dry-run', $argv, true);
$log = static fn (string $msg) => fwrite(STDOUT, '[' . date('Y-m-d H:i:s') . "] {$msg}\n");

$all = [];
foreach (ExamDateScraper::CAREERS as $career => $ids) {
    try {
        $rows = ExamDateScraper::parse(ExamDateScraper::fetch($ids['carrera'], $ids['plan']));
    } catch (\Throwable $e) {
        $log("{$career}: ERROR {$e->getMessage()}");
        fwrite(STDERR, "{$career}: {$e->getMessage()}\n");
        exit(1);
    }
    $subjects = count(array_unique(array_column($rows, 'subjectId')));
    $log("{$career}: {$subjects} materias, " . count($rows) . ' mesas');
    array_push($all, ...$rows);
}

if ($dryRun) {
    foreach ($all as $r) {
        fwrite(STDOUT, sprintf(
            "%06d  %s  %s  %-8s  %-12s  %s\n",
            $r['subjectId'], $r['date'], $r['startTime'] ?? '--:--', $r['inscriptionType'], $r['location'], $r['subjectName']
        ));
    }
    exit(0);
}

$repo = new GuaraniExamDateRepository(Database::connection());
$known = array_flip($repo->knownSubjectIds(array_column($all, 'subjectId')));
$rows = array_values(array_filter($all, static fn (array $r): bool => isset($known[$r['subjectId']])));
$saved = $repo->replaceAll($rows);
$log("Guardadas {$saved} mesas de " . count($known) . ' materias del catálogo (' . (count($all) - count($rows)) . ' de materias que no están en la app, ignoradas).');
