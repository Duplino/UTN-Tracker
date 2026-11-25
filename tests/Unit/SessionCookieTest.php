<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Http\Session;
use PHPUnit\Framework\TestCase;

final class SessionCookieTest extends TestCase
{
    public function testPlainHttpIsNotSecure(): void
    {
        $this->assertFalse(Session::isSecure([], null));
        $this->assertFalse(Session::isSecure(['HTTPS' => 'off'], null));
        $this->assertFalse(Session::isSecure(['HTTP_X_FORWARDED_PROTO' => 'http'], null));
    }

    public function testDirectHttpsIsSecure(): void
    {
        $this->assertTrue(Session::isSecure(['HTTPS' => 'on'], null));
    }

    public function testHttpsBehindReverseProxyIsSecure(): void
    {
        $this->assertTrue(Session::isSecure(['HTTP_X_FORWARDED_PROTO' => 'https'], null));
        $this->assertTrue(Session::isSecure(['HTTP_X_FORWARDED_PROTO' => 'HTTPS, http'], null));
    }

    public function testOverrideWins(): void
    {
        $this->assertTrue(Session::isSecure([], 'true'));
        $this->assertFalse(Session::isSecure(['HTTPS' => 'on'], 'false'));
        $this->assertTrue(Session::isSecure(['HTTPS' => 'on'], ''));
    }
}
