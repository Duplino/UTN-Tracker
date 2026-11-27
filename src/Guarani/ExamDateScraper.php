<?php

declare(strict_types=1);

namespace App\Guarani;

use DOMDocument;
use DOMElement;
use DOMXPath;
use RuntimeException;

// Lee las mesas de final de la página pública del SIU Guaraní de la FRBA
// (autogestión > Fechas de examen). No hace falta sesión: la página responde igual
// sin cookies. Se pide una vez por carrera/plan (sin filtrar por materia) y cada
// materia viene en un bloque con su código entre paréntesis, que es el id de la
// materia en el catálogo (subjects.id).
//
// La página es un HTML con el contenido adentro de un
// <script>kernel.renderer.on_arrival({..., "content": "<html escapado>"})</script>;
// pedida por XHR devuelve lo mismo envuelto en {"cod":"1","cont":"..."}. Se aceptan
// las dos formas.
final class ExamDateScraper
{
    public const BASE_URL = 'https://guarani.frba.utn.edu.ar/autogestion/grado/fecha_examen';

    // Código de carrera de la app => ids de propuesta y plan en Guaraní (los values
    // de los desplegables "Propuesta" y "Plan" de la página). Para sumar una carrera,
    // buscarlos en la página o en /fecha_examen/buscar_planes?carrera=<id>.
    public const CAREERS = [
        'sistemas' => [
            'carrera' => '33ceeec1ff44f3065fae35676500dae5756d57f4', // Ingeniería en Sistemas de Información
            'plan' => '5e9f1f5480c7e1541f0644a79d13b57e5c0f2cd0',    // K23
        ],
        'S23' => [
            'carrera' => '3514773098e2d2dcc91d3909f25d8f3acc8f8f76', // Ingeniería Mecánica
            'plan' => 'cdf83bfc1e5e69b2edc4669bf3b2de42e5ea7486',    // S23
        ],
    ];

    public static function url(string $carrera, string $plan): string
    {
        return self::BASE_URL . '?' . http_build_query([
            'formulario_filtro' => [
                'carrera' => $carrera,
                'plan' => $plan,
                'materia' => '',
                'fecha_desde' => '',
                'fecha_hasta' => '',
                'tipo_mesa' => '',
            ],
        ]);
    }

    public static function fetch(string $carrera, string $plan, int $timeout = 60): string
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => $timeout,
                'header' => "User-Agent: UTN-Tracker (+https://utntracker.com.ar)\r\nAccept: text/html\r\n",
                'ignore_errors' => true,
            ],
        ]);
        $body = @file_get_contents(self::url($carrera, $plan), false, $context);
        if ($body === false) {
            throw new RuntimeException('No se pudo conectar con Guaraní: ' . (error_get_last()['message'] ?? 'error desconocido'));
        }
        $status = isset($http_response_header[0]) && preg_match('#\s(\d{3})\s#', $http_response_header[0] . ' ', $m) ? (int) $m[1] : 0;
        if ($status !== 200) {
            throw new RuntimeException("Guaraní respondió HTTP {$status}");
        }
        return $body;
    }

    /**
     * Mesas de la respuesta, una por fila de la tabla.
     *
     * @return list<array{subjectId:int, subjectName:string, date:string, startTime:?string,
     *   inscriptionType:string, location:string, inscriptionStart:?string, inscriptionEnd:?string}>
     * @throws RuntimeException si la respuesta no tiene la forma esperada (cambió la
     *   página, mantenimiento, etc.): así una corrida rota no borra las fechas que había.
     */
    public static function parse(string $body): array
    {
        $html = self::extractContent($body);

        $doc = new DOMDocument();
        $prev = libxml_use_internal_errors(true);
        $doc->loadHTML('<?xml encoding="UTF-8"><div id="root">' . $html . '</div>', LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        $xpath = new DOMXPath($doc);

        $rows = [];
        foreach ($xpath->query("//div[contains(concat(' ', normalize-space(@class), ' '), ' corte ')]") as $corte) {
            /** @var DOMElement $corte */
            $header = self::text($xpath->query(".//div[contains(@class, 'encabezado_cuadro')]", $corte)->item(0));
            if (!preg_match('/^(.*)\((\d+)\)$/u', $header, $m)) {
                continue;
            }
            $subjectId = (int) $m[2];
            $subjectName = trim($m[1]);

            foreach ($xpath->query('./table/tbody/tr', $corte) as $tr) {
                /** @var DOMElement $tr */
                if (str_contains(' ' . $tr->getAttribute('class') . ' ', ' mas_info ')) {
                    continue;
                }
                $cells = $xpath->query('./td', $tr);
                if ($cells->length < 6) {
                    continue;
                }
                $date = self::date(self::text($cells->item(1)));
                if ($date === null) {
                    continue;
                }
                $rows[] = [
                    'subjectId' => $subjectId,
                    'subjectName' => $subjectName,
                    'date' => $date,
                    'startTime' => self::startTime($xpath, $tr),
                    'inscriptionType' => self::text($cells->item(2)),
                    'location' => self::text($cells->item(5)),
                    'inscriptionStart' => self::dateTime(self::text($cells->item(3))),
                    'inscriptionEnd' => self::dateTime(self::text($cells->item(4))),
                ];
            }
        }
        return $rows;
    }

    // Saca el HTML del contenido (la parte con el formulario y las mesas).
    private static function extractContent(string $body): string
    {
        $trimmed = ltrim($body);
        if (str_starts_with($trimmed, '{')) {
            $json = json_decode($trimmed, true);
            if (is_array($json) && is_string($json['cont'] ?? null)) {
                $body = $json['cont'];
            }
        }

        // Con strpos y no con regex: la página de una carrera entera pesa ~600 KB y un
        // .*? sobre eso puede pasarse de pcre.backtrack_limit. Adentro del JSON los
        // "</script>" vienen escapados ("<\/script>"), así que el primero que aparece
        // cierra la llamada.
        $marker = 'kernel.renderer.on_arrival(';
        $offset = 0;
        while (($start = strpos($body, $marker, $offset)) !== false) {
            $start += strlen($marker);
            $end = strpos($body, '</script>', $start);
            if ($end === false) {
                break;
            }
            $offset = $end;
            $raw = rtrim(substr($body, $start, $end - $start));
            $raw = preg_replace('/\)\s*;?\s*$/', '', $raw);
            $data = json_decode($raw, true);
            $content = is_array($data) ? ($data['content'] ?? null) : null;
            if (is_string($content) && str_contains($content, 'formulario_filtro')) {
                return $content;
            }
        }
        throw new RuntimeException('La respuesta de Guaraní no tiene la forma esperada (¿cambió la página?)');
    }

    // Hora de inicio: primera celda de la tabla de detalle (fila .mas_info siguiente).
    private static function startTime(DOMXPath $xpath, DOMElement $tr): ?string
    {
        $next = $tr->nextSibling;
        while ($next !== null && !($next instanceof DOMElement)) {
            $next = $next->nextSibling;
        }
        if (!$next instanceof DOMElement || !str_contains(' ' . $next->getAttribute('class') . ' ', ' mas_info ')) {
            return null;
        }
        $cell = $xpath->query('.//tbody/tr/td', $next)->item(0);
        return preg_match('/^(\d{1,2}):(\d{2})$/', self::text($cell), $m)
            ? sprintf('%02d:%s', (int) $m[1], $m[2])
            : null;
    }

    private static function text(?\DOMNode $node): string
    {
        return $node ? trim(preg_replace('/\s+/u', ' ', $node->textContent)) : '';
    }

    // 'dd/mm/aaaa' => 'aaaa-mm-dd'
    private static function date(string $s): ?string
    {
        $dt = \DateTimeImmutable::createFromFormat('!d/m/Y', $s);
        return $dt && $dt->format('d/m/Y') === $s ? $dt->format('Y-m-d') : null;
    }

    // 'dd/mm/aaaa hh:mm' => 'aaaa-mm-dd hh:mm:00'
    private static function dateTime(string $s): ?string
    {
        $dt = \DateTimeImmutable::createFromFormat('!d/m/Y H:i', $s);
        return $dt ? $dt->format('Y-m-d H:i:00') : null;
    }
}
