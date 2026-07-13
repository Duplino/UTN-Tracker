<?php
// Router de desarrollo solo para `php -S` (no se usa en producción). Simula
// el rewrite de public_html/api/.htaccess sin depender de Apache.
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (str_starts_with($uri, '/api/')) {
    require __DIR__ . '/public_html/api/index.php';
    return true;
}
return false;
