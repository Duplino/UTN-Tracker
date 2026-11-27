<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Guarani\ExamDateScraper;
use PHPUnit\Framework\TestCase;
use RuntimeException;

// Fixtures en tests/fixtures/guarani/: misma forma que la página real (HTML con el
// contenido en kernel.renderer.on_arrival) y que su versión XHR ({"cod","cont"}).
final class GuaraniExamDateScraperTest extends TestCase
{
    private static function fixture(string $name): string
    {
        return file_get_contents(__DIR__ . '/../fixtures/guarani/' . $name);
    }

    public function testParsesEveryMesaWithItsSubjectCode(): void
    {
        $rows = ExamDateScraper::parse(self::fixture('fecha_examen.html'));

        $this->assertCount(4, $rows);
        $this->assertSame([
            'subjectId' => 232073,
            'subjectName' => 'Administración Estratégica del Capital Humano',
            'date' => '2026-12-03',
            'startTime' => '19:00',
            'inscriptionType' => 'Regular',
            'location' => 'Sede Campus',
            'inscriptionStart' => '2026-11-20 07:00:00',
            'inscriptionEnd' => '2026-12-02 19:00:00',
        ], $rows[1]);
    }

    public function testCodeWithLeadingZeroMatchesSubjectId(): void
    {
        $rows = ExamDateScraper::parse(self::fixture('fecha_examen.html'));
        $this->assertSame(82067, $rows[0]['subjectId']);
        $this->assertSame('Sede Medrano', $rows[0]['location']);
    }

    public function testNormalizesStartTimeAndKeepsInscriptionType(): void
    {
        $rows = ExamDateScraper::parse(self::fixture('fecha_examen.html'));
        $this->assertSame('09:00', $rows[2]['startTime']);
        $this->assertSame('Libre', $rows[3]['inscriptionType']);
    }

    public function testXhrResponseGivesTheSameRows(): void
    {
        $this->assertSame(
            ExamDateScraper::parse(self::fixture('fecha_examen.html')),
            ExamDateScraper::parse(self::fixture('fecha_examen_xhr.json'))
        );
    }

    public function testPageWithoutMesasIsEmptyNotAnError(): void
    {
        $this->assertSame([], ExamDateScraper::parse(self::fixture('fecha_examen_vacia.html')));
    }

    public function testUnexpectedResponseThrows(): void
    {
        $this->expectException(RuntimeException::class);
        ExamDateScraper::parse('<html><body>Sitio en mantenimiento</body></html>');
    }

    public function testUrlFiltersByCareerAndPlanOnly(): void
    {
        $ids = ExamDateScraper::CAREERS['sistemas'];
        parse_str(parse_url(ExamDateScraper::url($ids['carrera'], $ids['plan']), PHP_URL_QUERY), $query);
        $this->assertSame($ids['carrera'], $query['formulario_filtro']['carrera']);
        $this->assertSame($ids['plan'], $query['formulario_filtro']['plan']);
        $this->assertSame('', $query['formulario_filtro']['materia']);
    }
}
