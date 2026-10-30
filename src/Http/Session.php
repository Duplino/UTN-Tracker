<?php

declare(strict_types=1);

namespace App\Http;

use DateTimeImmutable;
use PDO;

final class Session
{
    private const COOKIE_NAME = 'utn_session';
    private const TTL_DAYS = 30;

    private static ?string $resolvedHash = null;
    private static ?array $resolvedUser = null;

    public static function issue(PDO $pdo, int $userId): void
    {
        $token = bin2hex(random_bytes(32));
        $hash = hash('sha256', $token);
        $expiresAt = (new DateTimeImmutable('+' . self::TTL_DAYS . ' days'))->format('Y-m-d H:i:s');

        $stmt = $pdo->prepare(
            'INSERT INTO user_sessions (user_id, token_hash, user_agent, ip_address, expires_at)
             VALUES (:user_id, :token_hash, :user_agent, :ip_address, :expires_at)'
        );
        $stmt->execute([
            'user_id' => $userId,
            'token_hash' => $hash,
            'user_agent' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
            'expires_at' => $expiresAt,
        ]);

        self::setCookie($token, time() + self::TTL_DAYS * 86400);
    }

    public static function currentUser(PDO $pdo): ?array
    {
        $token = $_COOKIE[self::COOKIE_NAME] ?? null;
        if (!$token) {
            return null;
        }
        $hash = hash('sha256', $token);

        // Cache por request: varios controllers (y /api/bootstrap) pueden pedir el
        // usuario actual en la misma ejecución.
        if (self::$resolvedHash === $hash) {
            return self::$resolvedUser;
        }

        $stmt = $pdo->prepare(
            'SELECT u.*, (s.last_used_at < NOW() - INTERVAL 10 MINUTE) AS session_stale
             FROM user_sessions s
             JOIN users u ON u.id = s.user_id
             WHERE s.token_hash = :hash AND s.expires_at > NOW()'
        );
        $stmt->execute(['hash' => $hash]);
        $user = $stmt->fetch() ?: null;

        // last_used_at es informativo: actualizarlo como mucho cada 10 minutos evita
        // una escritura en cada request autenticado.
        if ($user && (int) $user['session_stale'] === 1) {
            $pdo->prepare('UPDATE user_sessions SET last_used_at = NOW() WHERE token_hash = :hash')
                ->execute(['hash' => $hash]);
        }
        if ($user) {
            unset($user['session_stale']);
        }

        self::$resolvedHash = $hash;
        self::$resolvedUser = $user;
        return $user;
    }

    public static function destroy(PDO $pdo): void
    {
        $token = $_COOKIE[self::COOKIE_NAME] ?? null;
        if ($token) {
            $hash = hash('sha256', $token);
            $pdo->prepare('DELETE FROM user_sessions WHERE token_hash = :hash')->execute(['hash' => $hash]);
        }
        self::setCookie('', time() - 3600);
    }

    private static function setCookie(string $value, int $expires): void
    {
        setcookie(self::COOKIE_NAME, $value, [
            'expires' => $expires,
            'path' => '/',
            'secure' => !empty($_SERVER['HTTPS']),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
}
