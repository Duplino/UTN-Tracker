<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Http\Response;
use PDO;

final class PreferencesRepository
{
    private const FIELD_MAP = [
        'showCorrelativas' => 'show_correlativas',
        'showStatus' => 'show_status',
        'viewMode' => 'view_mode',
        'selectedStats' => 'selected_stats',
        'semesterPlans' => 'semester_plans',
        'yearStarted' => 'year_started',
        'isPublic' => 'is_public',
    ];

    private const MAX_SEMESTER_PLANS_BYTES = 65535;

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
            if ($inputKey === 'semesterPlans') {
                $value = self::encodeSemesterPlans($value);
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

        // activeCareerCode no es una columna directa: hay que resolver el código a
        // careers.id (o NULL si no se encontró / se mandó vacío).
        if (array_key_exists('activeCareerCode', $fields)) {
            $careerId = null;
            $code = $fields['activeCareerCode'];
            if ($code) {
                $stmt = $this->pdo->prepare('SELECT id FROM careers WHERE code = :code');
                $stmt->execute(['code' => $code]);
                $row = $stmt->fetch();
                $careerId = $row ? (int) $row['id'] : null;
            }
            $sets[] = 'active_career_id = :active_career_id';
            $params['active_career_id'] = $careerId;
        }

        if ($sets !== []) {
            $sql = 'UPDATE user_preferences SET ' . implode(', ', $sets) . ' WHERE user_id = :uid';
            $this->pdo->prepare($sql)->execute($params);
        }

        return $this->find($userId);
    }

    private function hydrate(array $row): array
    {
        $activeCareerCode = null;
        if ($row['active_career_id'] !== null) {
            $stmt = $this->pdo->prepare('SELECT code FROM careers WHERE id = :id');
            $stmt->execute(['id' => (int) $row['active_career_id']]);
            $activeCareerCode = $stmt->fetchColumn() ?: null;
        }

        return [
            'activeCareerCode' => $activeCareerCode,
            'showCorrelativas' => (bool) $row['show_correlativas'],
            'showStatus' => (bool) $row['show_status'],
            'viewMode' => $row['view_mode'],
            'selectedStats' => $row['selected_stats'] ? json_decode((string) $row['selected_stats'], true) : [],
            // Se decodifica a objetos (no arrays asociativos) para que un mapa vacío
            // vuelva a salir como {} y no como []. `?? null` por si la base todavía no
            // tiene la columna (ver database/migrate_semester_plans.sql).
            'semesterPlans' => ($row['semester_plans'] ?? null) ? json_decode((string) $row['semester_plans']) : new \stdClass(),
            'yearStarted' => $row['year_started'] !== null ? (int) $row['year_started'] : null,
            'isPublic' => (bool) $row['is_public'],
            'shareToken' => $row['share_token'],
        ];
    }

    // Planificador de cuatrimestres: un mapa { codigoCarrera: plan } que arma y lee
    // el front (ver assets/js/planner.js). El backend no interpreta el contenido,
    // solo controla que sea un objeto JSON de tamaño razonable.
    private static function encodeSemesterPlans(mixed $value): string
    {
        if (!is_array($value)) {
            Response::error('invalid_semester_plans', 422);
        }
        $json = json_encode($value === [] ? new \stdClass() : $value, JSON_UNESCAPED_UNICODE);
        if ($json === false || strlen($json) > self::MAX_SEMESTER_PLANS_BYTES) {
            Response::error('semester_plans_too_large', 422);
        }
        return $json;
    }
}
