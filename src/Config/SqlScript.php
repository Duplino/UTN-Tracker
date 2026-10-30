<?php

declare(strict_types=1);

namespace App\Config;

// Separa un archivo .sql en sentencias por `;`, ignorando los `;` dentro de
// strings, identificadores con backticks y comentarios. No soporta DELIMITER
// (no hay procedures/triggers en el esquema).
final class SqlScript
{
    public static function split(string $sql): array
    {
        $statements = [];
        $current = '';
        $len = strlen($sql);
        for ($i = 0; $i < $len; $i++) {
            $c = $sql[$i];
            $next = $sql[$i + 1] ?? '';

            if (($c === '-' && $next === '-' && in_array($sql[$i + 2] ?? "\n", [' ', "\t", "\n", "\r"], true)) || $c === '#') {
                $end = strpos($sql, "\n", $i);
                $i = $end === false ? $len : $end;
                $current .= "\n";
                continue;
            }
            if ($c === '/' && $next === '*') {
                $end = strpos($sql, '*/', $i + 2);
                $i = $end === false ? $len : $end + 1;
                $current .= ' ';
                continue;
            }
            if ($c === "'" || $c === '"' || $c === '`') {
                $start = $i;
                for ($i++; $i < $len; $i++) {
                    if ($sql[$i] === '\\' && $c !== '`') {
                        $i++;
                    } elseif ($sql[$i] === $c) {
                        if (($sql[$i + 1] ?? '') === $c) {
                            $i++;
                        } else {
                            break;
                        }
                    }
                }
                $current .= substr($sql, $start, $i - $start + 1);
                continue;
            }
            if ($c === ';') {
                if (trim($current) !== '') {
                    $statements[] = trim($current);
                }
                $current = '';
                continue;
            }
            $current .= $c;
        }
        if (trim($current) !== '') {
            $statements[] = trim($current);
        }
        return $statements;
    }
}
