<?php

// Corre en el build de la imagen (ver Dockerfile), no en runtime ni en desarrollo.
//
// Le agrega a cada asset referenciado desde los HTML un `?v=<hash del contenido>` y
// genera un import map para los módulos JS (que se importan entre sí con rutas
// relativas, sin query string). Con eso Apache puede servir los assets versionados
// con `Cache-Control: immutable` por un año (ver docker/apache-vhost.conf): cuando
// un archivo cambia, cambia su URL, y nadie se queda con JS/CSS viejo tras un deploy.

declare(strict_types=1);

$root = getenv('VERSION_ASSETS_ROOT') ?: dirname(__DIR__) . '/public_html';

// Versión de la app (número del último PR mergeado a main) y commit exacto. Los calcula
// bin/deploy.sh con git en el VPS y llegan como build args (ver Dockerfile); sin ellos
// (build a mano) queda "dev". Se publican en /version.json y en la meta app-version.
$appVersion = getenv('APP_VERSION') ?: 'dev';
$appCommit = getenv('APP_COMMIT') ?: '';
if (!preg_match('/^[0-9A-Za-z._-]{1,40}$/', $appVersion) || !preg_match('/^[0-9a-f]{0,40}$/', $appCommit)) {
    fwrite(STDERR, "version-assets: APP_VERSION/APP_COMMIT inválidos ('{$appVersion}', '{$appCommit}')\n");
    exit(1);
}
$versionInfo = ['version' => $appVersion, 'commit' => $appCommit, 'builtAt' => gmdate('c')];
file_put_contents($root . '/version.json', json_encode($versionInfo, JSON_UNESCAPED_SLASHES) . "\n");
echo "version-assets: versión {$appVersion}" . ($appCommit !== '' ? " ({$appCommit})" : '') . "\n";
$versionMeta = '<meta name="app-version" content="' . $appVersion . '" data-commit="' . $appCommit . '">';

$versions = [];
$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root . '/assets', FilesystemIterator::SKIP_DOTS));
foreach ($iterator as $file) {
    if (!$file->isFile() || !preg_match('/\.(js|css|png|svg|woff2?)$/', $file->getFilename())) {
        continue;
    }
    $relative = 'assets/' . str_replace('\\', '/', substr($file->getPathname(), strlen($root . '/assets/')));
    $versions[$relative] = substr(sha1_file($file->getPathname()), 0, 10);
}
ksort($versions);

$imports = [];
foreach ($versions as $path => $hash) {
    if (str_starts_with($path, 'assets/js/') && str_ends_with($path, '.js')) {
        $imports['/' . $path] = '/' . $path . '?v=' . $hash;
    }
}
$importMap = '<script type="importmap">' . json_encode(['imports' => $imports], JSON_UNESCAPED_SLASHES) . '</script>';

foreach (glob($root . '/*.html') as $htmlFile) {
    $html = (string) file_get_contents($htmlFile);

    $html = preg_replace_callback('/(href|src)="(assets\/[^"?#]+)"/', static function (array $m) use ($versions): string {
        return isset($versions[$m[2]]) ? "{$m[1]}=\"{$m[2]}?v={$versions[$m[2]]}\"" : $m[0];
    }, $html);

    $html = preg_replace('/<meta name="app-version"[^>]*>/', $versionMeta, $html);

    $html = preg_replace('/<!-- importmap:.*?-->/s', $importMap, $html, 1, $count);
    if ($count !== 1) {
        fwrite(STDERR, "version-assets: falta el marcador <!-- importmap: --> en " . basename($htmlFile) . "\n");
        exit(1);
    }

    file_put_contents($htmlFile, $html);
    echo 'version-assets: ' . basename($htmlFile) . " ok\n";
}
