<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\StatusCalculator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

// Mismos casos que tests/js/statusEngine.test.mjs (tests/fixtures/status-cases.json):
// si las dos implementaciones del cálculo de estado se desincronizan, falla una.
final class StatusCalculatorTest extends TestCase
{
    public static function cases(): array
    {
        $raw = json_decode((string) file_get_contents(__DIR__ . '/../fixtures/status-cases.json'), true, 512, JSON_THROW_ON_ERROR);
        $out = [];
        foreach ($raw as $case) {
            $out[$case['scheme'] . ': ' . $case['name']] = [$case];
        }
        return $out;
    }

    #[DataProvider('cases')]
    public function testComputesExpectedStatus(array $case): void
    {
        $this->assertSame(
            $case['expected'],
            StatusCalculator::compute($case['config'], $case['partials'], $case['finals'], $case['checklist'], $case['override'])
        );
    }
}
