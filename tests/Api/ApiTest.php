<?php

declare(strict_types=1);

namespace Tests\Api;

use PHPUnit\Framework\TestCase;

// Pruebas de punta a punta contra un servidor corriendo con una base migrada y
// MOCK_AUTH_ENABLED=true. Ejemplo local:
//   MOCK_AUTH_ENABLED=true php -S 127.0.0.1:8001 -t public_html dev-router.php
//   API_TEST_URL=http://127.0.0.1:8001 vendor/bin/phpunit --testsuite api
// Escriben datos del usuario de prueba: no correrlas contra producción.
final class ApiTest extends TestCase
{
    private static string $base = '';
    private static string $cookieJar = '';

    public static function setUpBeforeClass(): void
    {
        self::$base = rtrim((string) getenv('API_TEST_URL'), '/');
        self::$cookieJar = tempnam(sys_get_temp_dir(), 'utn-api-test');
    }

    public static function tearDownAfterClass(): void
    {
        if (self::$cookieJar !== '' && is_file(self::$cookieJar)) {
            unlink(self::$cookieJar);
        }
    }

    protected function setUp(): void
    {
        if (self::$base === '') {
            $this->markTestSkipped('API_TEST_URL no está seteado.');
        }
    }

    /** @return array{status:int, headers:array<string,string>, body:mixed} */
    private function request(string $method, string $path, ?array $json = null, bool $withSession = true): array
    {
        $ch = curl_init(self::$base . $path);
        $headers = [];
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADERFUNCTION => function ($ch, string $line) use (&$headers): int {
                if (str_contains($line, ':')) {
                    [$name, $value] = explode(':', $line, 2);
                    $headers[strtolower(trim($name))] = trim($value);
                }
                return strlen($line);
            },
        ]);
        if ($withSession) {
            curl_setopt($ch, CURLOPT_COOKIEFILE, self::$cookieJar);
            curl_setopt($ch, CURLOPT_COOKIEJAR, self::$cookieJar);
        }
        if ($json !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($json));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        }
        $raw = curl_exec($ch);
        $this->assertNotFalse($raw, 'No se pudo conectar a ' . self::$base . ': ' . curl_error($ch));
        $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        return ['status' => $status, 'headers' => $headers, 'body' => json_decode((string) $raw, true)];
    }

    private function login(): array
    {
        $res = $this->request('POST', '/api/auth/mock-login');
        $this->assertSame(200, $res['status'], 'mock-login falló: ¿el servidor tiene MOCK_AUTH_ENABLED=true?');
        return $res['body']['user'];
    }

    public function testGuestBootstrap(): void
    {
        $res = $this->request('GET', '/api/bootstrap', null, false);
        $this->assertSame(200, $res['status']);
        $this->assertFalse($res['body']['authenticated']);
        $this->assertNotEmpty($res['body']['schemes']);
        $this->assertArrayNotHasKey('enrollments', $res['body']);
        $this->assertSame('no-store', $res['headers']['cache-control'] ?? null);
    }

    public function testPublicCatalogIsCacheable(): void
    {
        $careers = $this->request('GET', '/api/careers', null, false);
        $this->assertSame(200, $careers['status']);
        $codes = array_column($careers['body']['careers'], 'code');
        $this->assertContains('sistemas', $codes);
        $this->assertContains('S23', $codes);
        $this->assertStringContainsString('public', $careers['headers']['cache-control'] ?? '');

        $curriculum = $this->request('GET', '/api/careers/S23/curriculum', null, false);
        $this->assertSame(200, $curriculum['status']);
        $this->assertStringContainsString('s-maxage', $curriculum['headers']['cache-control'] ?? '');
    }

    public function testPrivateEndpointsRequireSession(): void
    {
        $res = $this->request('GET', '/api/enrollments', null, false);
        $this->assertSame(401, $res['status']);
        $this->assertSame('no-store', $res['headers']['cache-control'] ?? null);
    }

    public function testEnrollmentLifecycle(): void
    {
        $user = $this->login();

        // Estado limpio por si una corrida anterior quedó a medias.
        $this->request('DELETE', '/api/enrollments/AM2');

        $created = $this->request('POST', '/api/enrollments', ['subjectCode' => 'AM2', 'schemeCode' => '2-partials']);
        $this->assertSame(201, $created['status']);
        $this->assertSame('Faltan notas', $created['body']['status']);

        $saved = $this->request('PUT', '/api/enrollments/AM2/results', [
            'partials' => ['1' => ['1' => 8], '2' => ['1' => 9]],
            'finals' => [],
            'checklist' => [],
        ]);
        $this->assertSame(200, $saved['status']);
        $this->assertSame('Promocionada', $saved['body']['status']);

        $boot = $this->request('GET', '/api/bootstrap');
        $this->assertTrue($boot['body']['authenticated']);
        $this->assertSame($user['id'], $boot['body']['user']['id']);
        $byCode = array_column($boot['body']['enrollments'], null, 'subjectCode');
        $this->assertSame('Promocionada', $byCode['AM2']['status'] ?? null);
        $this->assertSame(['1' => ['1' => 8], '2' => ['1' => 9]], $byCode['AM2']['partials']);

        $override = $this->request('PATCH', '/api/enrollments/AM2/override', ['status' => 'Regularizada']);
        $this->assertSame('Regularizada', $override['body']['status']);

        $removed = $this->request('DELETE', '/api/enrollments/AM2');
        $this->assertSame(204, $removed['status']);
        $boot = $this->request('GET', '/api/bootstrap');
        $this->assertNotContains('AM2', array_column($boot['body']['enrollments'], 'subjectCode'));
    }

    public function testRetakeCountSurvivesRecursar(): void
    {
        $this->login();
        $this->request('DELETE', '/api/enrollments/F2');
        $this->request('PATCH', '/api/subject-retakes/F2', ['recursedCount' => 0]);

        $this->request('POST', '/api/enrollments', ['subjectCode' => 'F2', 'schemeCode' => '2-partials']);
        $res = $this->request('POST', '/api/enrollments/F2/recursar');
        $this->assertSame(200, $res['status']);
        $this->assertSame(1, $res['body']['recursedCount']);
        $this->assertFalse($res['body']['enrolled']);

        $retakes = $this->request('GET', '/api/subject-retakes');
        $this->assertSame(200, $retakes['status']);
        $this->assertStringContainsString('"F2"', json_encode($retakes['body']));

        $reset = $this->request('PATCH', '/api/subject-retakes/F2', ['recursedCount' => 0]);
        $this->assertSame(0, $reset['body']['recursedCount']);
    }

    public function testExamDatesLifecycle(): void
    {
        $this->login();
        foreach ($this->request('GET', '/api/exam-dates')['body']['examDates'] as $entry) {
            if ($entry['subjectCode'] === 'AM2') {
                $this->request('DELETE', '/api/exam-dates/' . $entry['id']);
            }
        }

        $first = $this->request('POST', '/api/exam-dates', [
            'subjectCode' => 'AM2', 'kind' => 'parcial', 'partialNumber' => 1, 'attemptNumber' => 2, 'date' => '2027-05-10',
        ]);
        $this->assertSame(201, $first['status']);
        $this->assertSame('parcial', $first['body']['kind']);
        $this->assertSame('2027-05-10', $first['body']['date']);

        // La misma instancia de parcial se pisa, no se duplica.
        $moved = $this->request('POST', '/api/exam-dates', [
            'subjectCode' => 'AM2', 'kind' => 'parcial', 'partialNumber' => 1, 'attemptNumber' => 2, 'date' => '2027-05-17',
        ]);
        $this->assertSame($first['body']['id'], $moved['body']['id']);
        $this->assertSame('2027-05-17', $moved['body']['date']);

        $final = $this->request('POST', '/api/exam-dates', ['subjectCode' => 'AM2', 'kind' => 'final', 'date' => '2027-07-20']);
        $this->assertSame(201, $final['status']);
        $this->assertNull($final['body']['partialNumber']);

        $list = $this->request('GET', '/api/exam-dates');
        $mine = array_values(array_filter($list['body']['examDates'], fn ($e) => $e['subjectCode'] === 'AM2'));
        $this->assertSame(['2027-05-17', '2027-07-20'], array_column($mine, 'date'));

        $bad = $this->request('POST', '/api/exam-dates', ['subjectCode' => 'AM2', 'kind' => 'parcial', 'partialNumber' => 1, 'attemptNumber' => 4, 'date' => '2027-05-10']);
        $this->assertSame(422, $bad['status']);
        $bad = $this->request('POST', '/api/exam-dates', ['subjectCode' => 'AM2', 'kind' => 'final', 'date' => '2027-02-30']);
        $this->assertSame(422, $bad['status']);

        $this->assertSame(204, $this->request('DELETE', '/api/exam-dates/' . $first['body']['id'])['status']);
        $this->assertSame(204, $this->request('DELETE', '/api/exam-dates/' . $final['body']['id'])['status']);
        $this->assertSame(404, $this->request('DELETE', '/api/exam-dates/' . $final['body']['id'])['status']);
        $this->assertSame(401, $this->request('GET', '/api/exam-dates', null, false)['status']);
    }

    public function testRejectsUnknownSubject(): void
    {
        $this->login();
        $res = $this->request('POST', '/api/enrollments', ['subjectCode' => 'NO-EXISTE', 'schemeCode' => '2-partials']);
        $this->assertGreaterThanOrEqual(400, $res['status']);
        $this->assertLessThan(500, $res['status']);
    }
}
