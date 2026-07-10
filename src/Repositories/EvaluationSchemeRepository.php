<?php

declare(strict_types=1);

namespace App\Repositories;

use PDO;

final class EvaluationSchemeRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function all(): array
    {
        $stmt = $this->pdo->query('SELECT id, code, name, config FROM evaluation_schemes ORDER BY id');
        return array_map([$this, 'hydrate'], $stmt->fetchAll());
    }

    public function findByCode(string $code): ?array
    {
        $stmt = $this->pdo->prepare('SELECT id, code, name, config FROM evaluation_schemes WHERE code = :code');
        $stmt->execute(['code' => $code]);
        $row = $stmt->fetch();
        return $row ? $this->hydrate($row) : null;
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT id, code, name, config FROM evaluation_schemes WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ? $this->hydrate($row) : null;
    }

    private function hydrate(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'code' => $row['code'],
            'name' => $row['name'],
            'config' => json_decode((string) $row['config'], true),
        ];
    }
}
