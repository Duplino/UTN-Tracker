<?php

declare(strict_types=1);

namespace App\Repositories;

use PDO;

final class PreferencesRepository
{
    private const FIELD_MAP = [
        'activePlanCode' => 'active_plan_code',
        'showCorrelativas' => 'show_correlativas',
        'showStatus' => 'show_status',
        'viewMode' => 'view_mode',
        'selectedStats' => 'selected_stats',
        'yearStarted' => 'year_started',
        'isPublic' => 'is_public',
    ];

    public function __construct(private PDO $pdo)
    {
    }

    public function find(int $userId): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM user_preferences WHERE user_id = :uid');
        $stmt->execute(['uid' => $userId]);
        $row = $stmt->fetch();

        if (!$row) {
            $this->pdo->prepare('INSERT INTO user_preferences (user_id) VALUES (:uid)')->execute(['uid' => $userId]);
            $stmt->execute(['uid' => $userId]);
            $row = $stmt->fetch();
        }

        return $this->hydrate($row);
    }

    public function update(int $userId, array $fields): array
    {
        $sets = [];
        $params = ['uid' => $userId];

        foreach (self::FIELD_MAP as $inputKey => $column) {
            if (!array_key_exists($inputKey, $fields)) {
                continue;
            }
            $value = $fields[$inputKey];
            if ($inputKey === 'selectedStats') {
                $value = json_encode($value);
            }
            $sets[] = "{$column} = :{$column}";
            $params[$column] = $value;
        }

        if (($fields['isPublic'] ?? false) === true) {
            $current = $this->find($userId);
            if (!$current['shareToken']) {
                $sets[] = 'share_token = :share_token';
                $params['share_token'] = bin2hex(random_bytes(16));
            }
        }

        if ($sets !== []) {
            $sql = 'UPDATE user_preferences SET ' . implode(', ', $sets) . ' WHERE user_id = :uid';
            $this->pdo->prepare($sql)->execute($params);
        }

        return $this->find($userId);
    }

    private function hydrate(array $row): array
    {
        return [
            'activePlanCode' => $row['active_plan_code'],
            'showCorrelativas' => (bool) $row['show_correlativas'],
            'showStatus' => (bool) $row['show_status'],
            'viewMode' => $row['view_mode'],
            'selectedStats' => $row['selected_stats'] ? json_decode((string) $row['selected_stats'], true) : [],
            'yearStarted' => $row['year_started'] !== null ? (int) $row['year_started'] : null,
            'isPublic' => (bool) $row['is_public'],
            'shareToken' => $row['share_token'],
        ];
    }
}
