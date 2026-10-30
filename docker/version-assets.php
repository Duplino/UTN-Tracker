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

    $html = preg_replace('/<!-- importmap:.*?-->/s', $importMap, $html, 1, $count);
    if ($count !== 1) {
        fwrite(STDERR, "version-assets: falta el marcador <!-- importmap: --> en " . basename($htmlFile) . "\n");
        exit(1);
    }

    file_put_contents($htmlFile, $html);
    echo 'version-assets: ' . basename($htmlFile) . " ok\n";
}
