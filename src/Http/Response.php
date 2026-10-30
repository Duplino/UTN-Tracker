<?php

declare(strict_types=1);

namespace App\Http;

final class Response
{
    // Por defecto nada de /api se cachea (ni en el navegador ni en Cloudflare): casi
    // todo es data por usuario. Los endpoints públicos que no dependen de la sesión
    // (catálogo de carreras/planes/esquemas) lo pisan con publicCache().
    private static string $cacheControl = 'no-store';

    // max-age: navegador; s-maxage: CDN (Cloudflare, si hay una Cache Rule para la
    // ruta). stale-while-revalidate deja servir la copia vieja mientras se refresca.
    public static function publicCache(int $maxAge = 300, int $sMaxAge = 86400): void
    {
        self::$cacheControl = "public, max-age={$maxAge}, s-maxage={$sMaxAge}, stale-while-revalidate=604800";
    }

    public static function json(mixed $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: ' . ($status === 200 ? self::$cacheControl : 'no-store'));
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function error(string $message, int $status = 400): never
    {
        self::json(['error' => $message], $status);
    }

    public static function noContent(): never
    {
        http_response_code(204);
        header('Cache-Control: no-store');
        exit;
    }
}
