<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Config\SqlScript;
use PHPUnit\Framework\TestCase;

final class SqlScriptTest extends TestCase
{
    public function testSplitsOnSemicolons(): void
    {
        $this->assertSame(['SELECT 1', 'SELECT 2'], SqlScript::split("SELECT 1;\nSELECT 2;\n"));
    }

    public function testIgnoresSemicolonsInsideStringsAndIdentifiers(): void
    {
        $sql = "INSERT INTO t (`a;b`) VALUES ('x;y', \"z;w\", 'it''s; fine', 'esc\\';aped');\nSELECT 1";
        $this->assertSame([
            "INSERT INTO t (`a;b`) VALUES ('x;y', \"z;w\", 'it''s; fine', 'esc\\';aped')",
            'SELECT 1',
        ], SqlScript::split($sql));
    }

    public function testDropsComments(): void
    {
        $sql = "-- comentario; con punto y coma\nSELECT 1; # otro;\n/* bloque; */ SELECT 2;";
        $this->assertSame(['SELECT 1', 'SELECT 2'], SqlScript::split($sql));
    }

    public function testDoubleDashWithoutSpaceIsNotAComment(): void
    {
        $this->assertSame(['SELECT 3--1'], SqlScript::split('SELECT 3--1;'));
    }

    public function testEveryMigrationSplitsIntoStatements(): void
    {
        foreach (glob(__DIR__ . '/../../database/migrations/*.sql') as $file) {
            $statements = SqlScript::split(file_get_contents($file));
            $this->assertNotEmpty($statements, basename($file));
            foreach ($statements as $statement) {
                $this->assertDoesNotMatchRegularExpression('/^\s*$/', $statement);
            }
        }
    }
}
