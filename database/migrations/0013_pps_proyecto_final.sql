-- Proyecto Final y Práctica Profesional Supervisada (PPS) no son materias comunes:
--  - kind: 'materia' (default), 'proyecto_final' o 'pps'. El frontend usa esto para
--    tratarlas distinto: el final del Proyecto Final queda bloqueado hasta tener
--    aprobadas todas las demás materias de la carrera ("Última Exigencia
--    Académica"), y la PPS no tiene parciales ni notas, solo horas reloj.
--  - clock_hours: horas reloj que exige la PPS (150 en Mecánica, 200 en Sistemas).
--  - enrollments.clock_hours_done: horas de PPS que lleva hechas el usuario.
--  - Esquema 'pps': sin parciales ni finales. La PPS queda "En curso" hasta que el
--    usuario la marca como Aprobada (override), porque acreditarla depende de que
--    aprueben el informe, no solo de cumplir las horas.

SET NAMES utf8mb4;

ALTER TABLE subjects
  ADD COLUMN kind ENUM('materia','proyecto_final','pps') NOT NULL DEFAULT 'materia' AFTER duration,
  ADD COLUMN clock_hours SMALLINT UNSIGNED NULL AFTER kind;

ALTER TABLE enrollments
  ADD COLUMN clock_hours_done SMALLINT UNSIGNED NULL AFTER status_override;

INSERT INTO evaluation_schemes (code, name, config) VALUES
(
  'pps',
  'Práctica Profesional Supervisada (horas reloj, sin notas)',
  JSON_OBJECT(
    'kind', 'pps',
    'partials', 0,
    'tp', 0,
    'labs', 0,
    'tp_required_for', JSON_ARRAY(),
    'labs_required_for', JSON_ARRAY(),
    'promotion', JSON_OBJECT('high_note', 8, 'high_count', 0, 'low_note', NULL, 'max_recovery', 0),
    'regularization', JSON_OBJECT('min_note', 6),
    'approve', JSON_OBJECT('min_note', 6)
  )
)
AS new_scheme
ON DUPLICATE KEY UPDATE
  name = new_scheme.name,
  config = new_scheme.config;

-- Mecánica (S23): ya estaban cargadas como materias en 0006_seed_mecanica.sql.
UPDATE subjects SET kind = 'proyecto_final' WHERE code = 'PF';
UPDATE subjects SET kind = 'pps', clock_hours = 150 WHERE code = 'PPS';

-- Quien ya había empezado la PPS de Mecánica con otro esquema pasa al de PPS
-- (no tenía notas que perder: la PPS no tiene parciales).
UPDATE enrollments e
  JOIN subjects s ON s.id = e.subject_id AND s.kind = 'pps'
  JOIN evaluation_schemes es ON es.code = 'pps'
SET e.evaluation_scheme_id = es.id;

-- Sistemas (K23), según el plan 2023: faltaban las dos. Tienen otro código del SIU
-- que las de Mecánica, así que son otras materias del catálogo global.
INSERT INTO subjects (id, code, name, week_hours, duration, kind, clock_hours) VALUES
  (82037, 'PF-SI', 'Proyecto Final', 6, 'anual', 'proyecto_final', NULL),
  (231699, 'PPS-SI', 'Práctica Profesional Supervisada', 0, 'anual', 'pps', 200)
AS new_subject
ON DUPLICATE KEY UPDATE
  code = new_subject.code,
  name = new_subject.name,
  week_hours = new_subject.week_hours,
  duration = new_subject.duration,
  kind = new_subject.kind,
  clock_hours = new_subject.clock_hours;

INSERT IGNORE INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g5'), s.id, 0, 0, 0, 6
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'PF-SI';
INSERT IGNORE INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g5'), s.id, 0, 0, 0, 7
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'PPS-SI';

-- Correlativas (las mismas para las dos, "Requisitos para iniciar y acreditar:
-- mismos a Proyecto"): Regularizadas IyCS, AdmSI, RD; Aprobadas IT2, DdS, DSI.
-- El "Final: todas las materias" no se expresa acá: lo chequea el frontend por kind.
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', req.status_type
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code IN ('PF-SI', 'PPS-SI')
JOIN (
  SELECT 'IyCS' AS code, 'regularizada' AS status_type
  UNION ALL SELECT 'AdmSI', 'regularizada'
  UNION ALL SELECT 'RD', 'regularizada'
  UNION ALL SELECT 'InglesII', 'aprobada'
  UNION ALL SELECT 'DdS', 'aprobada'
  UNION ALL SELECT 'DSI', 'aprobada'
) req
JOIN subjects rs ON rs.code = req.code
WHERE NOT EXISTS (
  SELECT 1 FROM subject_requirements x
  WHERE x.career_subject_id = cs.id AND x.required_subject_id = rs.id AND x.requirement_kind = 'cursar'
);
