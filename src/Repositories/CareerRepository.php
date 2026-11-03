<?php

declare(strict_types=1);

namespace App\Repositories;

use PDO;

final class CareerRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function all(): array
    {
        $stmt = $this->pdo->query(
            'SELECT id, code, name, has_intermediate_title, intermediate_title_name FROM careers ORDER BY id'
        );
        return array_map([$this, 'hydrateCareer'], $stmt->fetchAll());
    }

    public function findByCode(string $code): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, code, name, has_intermediate_title, intermediate_title_name FROM careers WHERE code = :code'
        );
        $stmt->execute(['code' => $code]);
        $row = $stmt->fetch();
        return $row ? $this->hydrateCareer($row) : null;
    }

    private function hydrateCareer(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'code' => $row['code'],
            'name' => $row['name'],
            'hasIntermediateTitle' => (bool) $row['has_intermediate_title'],
            'intermediateTitle' => $row['intermediate_title_name'],
        ];
    }

    // Árbol completo de módulos/materias/correlativas de una carrera, con la misma
    // forma que tenían los JSON estáticos de assets/data/*.json (mismos nombres de
    // campo), más los dos nuevos: onlyForIntermediate y requiredForIntermediateTitle.
    public function curriculum(string $code): ?array
    {
        $career = $this->findByCode($code);
        if (!$career) {
            return null;
        }
        $careerId = $career['id'];

        $stmt = $this->pdo->prepare('SELECT base_layout_name FROM careers WHERE id = :cid');
        $stmt->execute(['cid' => $careerId]);
        $baseLayoutName = (string) ($stmt->fetchColumn() ?: 'Plan oficial');

        $stmt = $this->pdo->prepare(
            'SELECT id, code, name, display_order, electives_slots
             FROM career_modules WHERE career_id = :cid ORDER BY display_order'
        );
        $stmt->execute(['cid' => $careerId]);
        $moduleRows = $stmt->fetchAll();

        $stmt = $this->pdo->prepare(
            'SELECT cs.id AS career_subject_id, cs.module_id, cs.is_elective, cs.only_for_intermediate,
                    cs.required_for_intermediate_title, cs.display_order,
                    s.id AS subject_id, s.code, s.name,
                    COALESCE(cs.week_hours, s.week_hours) AS week_hours,
                    COALESCE(cs.duration, s.duration) AS duration,
                    s.kind, s.clock_hours
             FROM career_subjects cs
             JOIN subjects s ON s.id = cs.subject_id
             WHERE cs.career_id = :cid
             ORDER BY cs.display_order, s.name'
        );
        $stmt->execute(['cid' => $careerId]);
        $subjectRows = $stmt->fetchAll();

        $stmt = $this->pdo->prepare(
            'SELECT sr.career_subject_id, sr.requirement_kind, sr.status_type, rs.code AS required_code
             FROM subject_requirements sr
             JOIN career_subjects cs ON cs.id = sr.career_subject_id
             JOIN subjects rs ON rs.id = sr.required_subject_id
             WHERE cs.career_id = :cid'
        );
        $stmt->execute(['cid' => $careerId]);
        $requirementsByCareerSubject = [];
        foreach ($stmt->fetchAll() as $r) {
            $requirementsByCareerSubject[(int) $r['career_subject_id']][$r['requirement_kind']][] = [
                'id' => $r['required_code'],
                'type' => $r['status_type'],
            ];
        }

        $subjectsByModule = [];
        $electiveSubjects = [];
        foreach ($subjectRows as $row) {
            $careerSubjectId = (int) $row['career_subject_id'];
            $reqs = $requirementsByCareerSubject[$careerSubjectId] ?? [];
            $dto = [
                'code' => $row['code'],
                // El id de la materia es su código en el SIU Guaraní (ej. 950701): sirve
                // para reconocerla al importar la historia académica (siuImport.js).
                'siuCode' => (int) $row['subject_id'],
                'name' => $row['name'],
                'weekHours' => (int) $row['week_hours'],
                'duration' => $row['duration'],
                // 'materia', 'proyecto_final' o 'pps' (ver 0013_pps_proyecto_final.sql).
                'kind' => $row['kind'] ?? 'materia',
                'clockHours' => $row['clock_hours'] !== null ? (int) $row['clock_hours'] : null,
                'requirements' => [
                    'cursar' => $reqs['cursar'] ?? [],
                    'aprobar' => $reqs['aprobar'] ?? [],
                ],
                'onlyForIntermediate' => (bool) $row['only_for_intermediate'],
                'requiredForIntermediateTitle' => (bool) $row['required_for_intermediate_title'],
            ];
            if ((bool) $row['is_elective']) {
                $electiveSubjects[] = $dto;
            } else {
                $subjectsByModule[(int) $row['module_id']][] = $dto;
            }
        }

        $modules = [];
        foreach ($moduleRows as $m) {
            $modules[] = [
                'id' => $m['code'],
                'name' => $m['name'],
                'electivas' => (int) $m['electives_slots'],
                'subjects' => $subjectsByModule[(int) $m['id']] ?? [],
            ];
        }
        $modules[] = [
            'id' => 'electives',
            'name' => 'Electivas',
            'render' => false,
            'subjects' => $electiveSubjects,
        ];

        return [
            'metadata' => [
                'hasIntermediateTitle' => $career['hasIntermediateTitle'],
                'intermediateTitle' => $career['intermediateTitle'],
                // Nombre del orden de los módulos de arriba en el selector del tablero.
                'baseLayoutName' => $baseLayoutName,
            ],
            'modules' => $modules,
            'layouts' => $this->layouts($careerId),
        ];
    }

    // Órdenes alternativos del tablero (además del plan oficial, que son los módulos
    // de arriba): [{ id, name, description, placements: { codigoMateria: { module,
    // order } } }]. Es solo visual, ver database/migrations/0013_subject_layouts.sql.
    private function layouts(int $careerId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT l.code AS layout_code, l.name, l.description,
                    s.code AS subject_code, m.code AS module_code, p.display_order
             FROM career_layouts l
             LEFT JOIN career_layout_placements p ON p.layout_id = l.id
             LEFT JOIN career_subjects cs ON cs.id = p.career_subject_id
             LEFT JOIN subjects s ON s.id = cs.subject_id
             LEFT JOIN career_modules m ON m.id = p.module_id
             WHERE l.career_id = :cid
             ORDER BY l.display_order, l.id, p.display_order'
        );
        $stmt->execute(['cid' => $careerId]);

        $layouts = [];
        foreach ($stmt->fetchAll() as $row) {
            $code = $row['layout_code'];
            if (!isset($layouts[$code])) {
                $layouts[$code] = [
                    'id' => $code,
                    'name' => $row['name'],
                    'description' => $row['description'],
                    'placements' => [],
                ];
            }
            if ($row['subject_code'] !== null && $row['module_code'] !== null) {
                $layouts[$code]['placements'][$row['subject_code']] = [
                    'module' => $row['module_code'],
                    'order' => (int) $row['display_order'],
                ];
            }
        }

        return array_map(static function (array $layout): array {
            // {} y no [] cuando no hay ninguna, para que el front siempre reciba un objeto.
            if ($layout['placements'] === []) {
                $layout['placements'] = new \stdClass();
            }
            return $layout;
        }, array_values($layouts));
    }
}
