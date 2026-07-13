<?php

declare(strict_types=1);

namespace App\Auth;

use App\Config\Env;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use RuntimeException;

final class GoogleTokenVerifier
{
    private const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
    private const CACHE_TTL_SECONDS = 86400;

    /**
     * Verifica la firma RS256 del ID token contra el JWKS de Google y valida
     * iss/aud/exp/email_verified. Devuelve el payload decodificado.
     */
    public static function verify(string $idToken): array
    {
        $jwks = self::fetchJwks();
        $keys = JWK::parseKeySet($jwks);
        $decoded = JWT::decode($idToken, $keys);
        $payload = (array) $decoded;

        $issuer = (string) ($payload['iss'] ?? '');
        if (!in_array($issuer, ['accounts.google.com', 'https://accounts.google.com'], true)) {
            throw new RuntimeException('invalid_issuer');
        }

        $audience = Env::get('GOOGLE_CLIENT_ID');
        if (!$audience || ($payload['aud'] ?? null) !== $audience) {
            throw new RuntimeException('invalid_audience');
        }

        if (empty($payload['email_verified'])) {
            throw new RuntimeException('email_not_verified');
        }

        return $payload;
    }

    private static function fetchJwks(): array
    {
        $cachePath = self::cachePath();

        if (is_file($cachePath) && (time() - filemtime($cachePath)) < self::CACHE_TTL_SECONDS) {
            $cached = json_decode((string) file_get_contents($cachePath), true);
            if (is_array($cached)) {
                return $cached;
            }
        }

        $context = stream_context_create(['http' => ['timeout' => 5]]);
        $raw = @file_get_contents(self::JWKS_URL, false, $context);

        if ($raw === false) {
            if (is_file($cachePath)) {
                $cached = json_decode((string) file_get_contents($cachePath), true);
                if (is_array($cached)) {
                    return $cached;
                }
            }
            throw new RuntimeException('jwks_fetch_failed');
        }

        file_put_contents($cachePath, $raw);
        return json_decode($raw, true);
    }

    private static function cachePath(): string
    {
        $dir = Env::get('CACHE_DIR', sys_get_temp_dir());
        return rtrim($dir, '/') . '/google_jwks_cache.json';
    }
}
