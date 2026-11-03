-- Sistemas (K23): corrige carga horaria y modalidad según el plan de estudios 2023
-- (horas cátedra semanales, bloques de 45 min). Los IDs (código SIU) ya coincidían.
--
-- ECO (950309) y Leg (950310) son la misma materia global que en Mecánica, pero con
-- otra carga en cada plan: Sistemas 6 hs / 4 hs cuatrimestrales, Mecánica 3 hs / 2 hs
-- anuales. Para no pisar Mecánica, career_subjects gana un override opcional por
-- carrera (NULL = usar lo de subjects).

ALTER TABLE career_subjects
  ADD COLUMN week_hours TINYINT UNSIGNED NULL AFTER display_order,
  ADD COLUMN duration ENUM('anual','cuatrimestral') NULL AFTER week_hours;

-- Materias que solo están en Sistemas: se corrigen en el catálogo global.
UPDATE subjects SET week_hours = 8 WHERE code IN ('DdS', 'BD', 'CD', 'RD', 'IO', 'SEMINT');
UPDATE subjects SET duration = 'cuatrimestral' WHERE code = 'GC';

-- Compartidas con Mecánica: override solo para Sistemas.
UPDATE career_subjects cs
  JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
  JOIN subjects s ON s.id = cs.subject_id
SET cs.week_hours = CASE s.code WHEN 'ECO' THEN 6 WHEN 'Leg' THEN 4 END,
    cs.duration = 'cuatrimestral'
WHERE s.code IN ('ECO', 'Leg');
