-- UTN-Tracker: seed de la carrera Ingeniería Mecánica (S23), generado a partir del
-- plan de estudios 2023 (Franja Morada). Re-ejecutable: borra y vuelve a cargar
-- el curriculum de esta carrera (career_subjects/subject_requirements) sin tocar
-- 'subjects' (catálogo global, upsert por code), ni 'careers'/'career_modules'
-- (ya cargados manualmente con sus IDs/electives_slots reales).
--
-- Materias compartidas con Sistemas reutilizadas por igual code (mismo code =
-- misma materia global): F1(2), AM1(3), AGA(4), AM2(10), F2(11), IyS/IngSoc(12),
-- InglesI/IT1(7), InglesII/IT2(16), PyE(18), y también ECO(950309)/Leg(950310)
-- pese a que hoy tienen distinta carga horaria real en cada carrera (Sistemas
-- las carga con sus propios valores en seed_sistemas.sql vía ON DUPLICATE KEY
-- UPDATE sobre el mismo id/code) -- discrepancia a resolver a futuro, por ahora
-- se ignora.

SET NAMES utf8mb4;

-- Limpieza idempotente del curriculum de esta carrera (no toca subjects/career_modules)
DELETE sr FROM subject_requirements sr
  JOIN career_subjects cs ON cs.id = sr.career_subject_id
  JOIN careers c ON c.id = cs.career_id
  WHERE c.code = 'S23';
DELETE cs FROM career_subjects cs
  JOIN careers c ON c.id = cs.career_id
  WHERE c.code = 'S23';

-- =====================================================
-- SUBJECTS (catálogo global: upsert por code, no se borra en cada corrida)
-- Las que ya existían (IM1, SSRR, FI, QG, MM, IASI, E1, MNM, IM2, IM3, Termo,
-- DM, E2, MyE, CA, MR, EM, ESC) se dejan intactas via ON DUPLICATE KEY UPDATE.
-- =====================================================
INSERT INTO subjects (id, code, name, week_hours, duration) VALUES
  (940820, 'IM1', 'Ingeniería Mecánica I', 2, 'anual'),
  (951610, 'SSRR', 'Sistemas de Representación', 3, 'anual'),
  (940861, 'FI', 'Fundamentos de Informática', 4, 'cuatrimestral'),
  (951407, 'QG', 'Química General', 5, 'anual'),
  (230822, 'MM', 'Materiales Metálicos', 5, 'anual'),
  (940899, 'IASI', 'Ingeniería Ambiental y Seguridad Industrial', 3, 'anual'),
  (230821, 'E1', 'Estabilidad I', 4, 'anual'),
  (230820, 'MNM', 'Materiales No Metálicos', 3, 'anual'),
  (940825, 'IM2', 'Ingeniería Mecánica II', 2, 'anual'),
  (940832, 'IM3', 'Ingeniería Mecánica III', 2, 'anual'),
  (940898, 'Termo', 'Termodinámica', 5, 'anual'),
  (230832, 'DM', 'Diseño Mecánico', 3, 'anual'),
  (230830, 'E2', 'Estabilidad II', 4, 'anual'),
  (230831, 'MyE', 'Mediciones y Ensayos', 4, 'anual'),
  (940848, 'CA', 'Cálculo Avanzado', 3, 'anual'),
  (940897, 'MR', 'Mecánica Racional', 5, 'anual'),
  (940836, 'EM', 'Elementos de Máquinas', 5, 'anual'),
  (940835, 'ESC', 'Electrónica y Sistemas de Control', 5, 'anual'),
  (940833, 'MdF', 'Mecánica de los Fluidos', 4, 'anual'),
  (940838, 'TC', 'Tecnología del Calor', 3, 'anual'),
  (950309, 'ECO', 'Economía', 3, 'anual'),
  (940841, 'MIC', 'Metrología e Ingeniería de Calidad', 4, 'anual'),
  (940834, 'EME', 'Electrotecnia y Máquinas Eléctricas', 4, 'anual'),
  (230840, 'E3', 'Estabilidad III', 3, 'anual'),
  (940894, 'PF', 'Proyecto Final', 5, 'anual'),
  (940843, 'InsInd', 'Instalaciones Industriales', 5, 'anual'),
  (940840, 'MANT', 'Mantenimiento', 2, 'anual'),
  (940839, 'MAT', 'Máquinas Alternativas y Turbomáquinas', 4, 'anual'),
  (230850, 'TdF', 'Tecnología de Fabricación', 5, 'anual'),
  (940831, 'OI', 'Organización Industrial', 3, 'anual'),
  (950310, 'Leg', 'Legislación', 2, 'anual'),
  (2311699, 'PPS', 'Práctica Profesional Supervisada', 0, 'anual')
AS new_subject
ON DUPLICATE KEY UPDATE
  code = new_subject.code,
  name = new_subject.name,
  week_hours = new_subject.week_hours,
  duration = new_subject.duration;

-- =====================================================
-- CAREER_SUBJECTS (placement dentro de la carrera Mecánica, career_modules
-- g1..g5 ya existen con sus electives_slots reales, no se tocan)
-- required_for_intermediate_title: g1 y g2 completos, y de g3 todo menos
-- CA/MR/PyE (confirmado con el usuario).
-- =====================================================

-- --- Primer Nivel (g1) ---
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g1'), s.id, 0, 0, 1, 1
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'IM1';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g1'), s.id, 0, 0, 1, 2
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'AGA';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g1'), s.id, 0, 0, 1, 3
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'AM1';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g1'), s.id, 0, 0, 1, 4
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'F1';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g1'), s.id, 0, 0, 1, 5
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'FI';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g1'), s.id, 0, 0, 1, 6
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'IyS';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g1'), s.id, 0, 0, 1, 7
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'QG';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g1'), s.id, 0, 0, 1, 8
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'SSRR';

-- --- Segundo Nivel (g2) ---
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g2'), s.id, 0, 0, 1, 1
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'IM2';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g2'), s.id, 0, 0, 1, 2
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'AM2';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g2'), s.id, 0, 0, 1, 3
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'E1';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g2'), s.id, 0, 0, 1, 4
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'F2';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g2'), s.id, 0, 0, 1, 5
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'IASI';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g2'), s.id, 0, 0, 1, 6
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'InglesI';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g2'), s.id, 0, 0, 1, 7
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'MM';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g2'), s.id, 0, 0, 1, 8
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'MNM';

-- --- Tercer Nivel (g3): CA, MR y PyE no cuentan para el título intermedio ---
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g3'), s.id, 0, 0, 1, 1
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'IM3';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g3'), s.id, 0, 0, 1, 2
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'Termo';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g3'), s.id, 0, 0, 1, 3
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'DM';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g3'), s.id, 0, 0, 1, 4
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'E2';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g3'), s.id, 0, 0, 1, 5
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'InglesII';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g3'), s.id, 0, 0, 1, 6
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'MyE';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g3'), s.id, 0, 0, 0, 7
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'CA';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g3'), s.id, 0, 0, 0, 8
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'MR';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g3'), s.id, 0, 0, 0, 9
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'PyE';

-- --- Cuarto Nivel (g4) ---
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g4'), s.id, 0, 0, 0, 1
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'EM';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g4'), s.id, 0, 0, 0, 2
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'ESC';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g4'), s.id, 0, 0, 0, 3
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'MdF';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g4'), s.id, 0, 0, 0, 4
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'TC';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g4'), s.id, 0, 0, 0, 5
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'ECO';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g4'), s.id, 0, 0, 0, 6
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'MIC';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g4'), s.id, 0, 0, 0, 7
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'EME';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g4'), s.id, 0, 0, 0, 8
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'E3';

-- --- Quinto Nivel (g5): "Electivas" no es una materia concreta, no se carga ---
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g5'), s.id, 0, 0, 0, 1
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'PF';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g5'), s.id, 0, 0, 0, 2
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'InsInd';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g5'), s.id, 0, 0, 0, 3
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'MANT';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g5'), s.id, 0, 0, 0, 4
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'MAT';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g5'), s.id, 0, 0, 0, 5
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'TdF';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g5'), s.id, 0, 0, 0, 6
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'OI';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g5'), s.id, 0, 0, 0, 7
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'Leg';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g5'), s.id, 0, 0, 0, 8
FROM careers c, subjects s WHERE c.code = 'S23' AND s.code = 'PPS';

-- =====================================================
-- SUBJECT_REQUIREMENTS (correlativas)
-- Nota: "Proyecto Final" también exige en el PDF el final de TODAS las
-- materias ("Última Exigencia Académica") y la PPS los mismos requisitos que
-- Proyecto Final; ese "todas las materias" no se modela acá (no hay forma de
-- expresarlo en subject_requirements), sólo las correlativas explícitas.
-- =====================================================

-- E1: Regularizadas AM1, F1, AGA
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'E1'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'E1'
JOIN subjects rs ON rs.code = 'F1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'E1'
JOIN subjects rs ON rs.code = 'AGA';

-- MM: Regularizadas QG, F1
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MM'
JOIN subjects rs ON rs.code = 'QG';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MM'
JOIN subjects rs ON rs.code = 'F1';

-- IASI: Regularizadas QG, F1
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IASI'
JOIN subjects rs ON rs.code = 'QG';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IASI'
JOIN subjects rs ON rs.code = 'F1';

-- MNM: Regularizadas QG, F1
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MNM'
JOIN subjects rs ON rs.code = 'QG';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MNM'
JOIN subjects rs ON rs.code = 'F1';

-- F2: Regularizadas AM1, F1
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'F2'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'F2'
JOIN subjects rs ON rs.code = 'F1';

-- AM2: Regularizadas AM1, AGA
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'AM2'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'AM2'
JOIN subjects rs ON rs.code = 'AGA';

-- IM2: Regularizadas F1, IM1
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IM2'
JOIN subjects rs ON rs.code = 'F1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IM2'
JOIN subjects rs ON rs.code = 'IM1';

-- IM3: Regularizadas MNM, MM, IM2; Aprobadas AM1, QG, F1, IM1
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IM3'
JOIN subjects rs ON rs.code = 'MNM';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IM3'
JOIN subjects rs ON rs.code = 'MM';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IM3'
JOIN subjects rs ON rs.code = 'IM2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IM3'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IM3'
JOIN subjects rs ON rs.code = 'QG';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IM3'
JOIN subjects rs ON rs.code = 'F1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IM3'
JOIN subjects rs ON rs.code = 'IM1';

-- IT2 (InglesII): Regularizadas IT1 (InglesI)
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'InglesII'
JOIN subjects rs ON rs.code = 'InglesI';

-- CA: Regularizadas AM2; Aprobadas AM1, AGA, FI
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'CA'
JOIN subjects rs ON rs.code = 'AM2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'CA'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'CA'
JOIN subjects rs ON rs.code = 'AGA';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'CA'
JOIN subjects rs ON rs.code = 'FI';

-- MR: Regularizadas AM2, E1; Aprobadas AM1, F1, AGA
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MR'
JOIN subjects rs ON rs.code = 'AM2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MR'
JOIN subjects rs ON rs.code = 'E1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MR'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MR'
JOIN subjects rs ON rs.code = 'F1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MR'
JOIN subjects rs ON rs.code = 'AGA';

-- Termo: Regularizadas AM2, F2; Aprobadas AM1, AGA, F1
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'Termo'
JOIN subjects rs ON rs.code = 'AM2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'Termo'
JOIN subjects rs ON rs.code = 'F2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'Termo'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'Termo'
JOIN subjects rs ON rs.code = 'AGA';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'Termo'
JOIN subjects rs ON rs.code = 'F1';

-- DM: Regularizadas MNM, E1, MM; Aprobadas F1, IM1, SSRR, FI
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'DM'
JOIN subjects rs ON rs.code = 'MNM';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'DM'
JOIN subjects rs ON rs.code = 'E1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'DM'
JOIN subjects rs ON rs.code = 'MM';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'DM'
JOIN subjects rs ON rs.code = 'F1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'DM'
JOIN subjects rs ON rs.code = 'IM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'DM'
JOIN subjects rs ON rs.code = 'SSRR';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'DM'
JOIN subjects rs ON rs.code = 'FI';

-- PyE: Regularizadas AM1, AGA
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PyE'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PyE'
JOIN subjects rs ON rs.code = 'AGA';

-- E2: Regularizadas E1, AM2; Aprobadas AM1, AGA, F1
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'E2'
JOIN subjects rs ON rs.code = 'E1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'E2'
JOIN subjects rs ON rs.code = 'AM2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'E2'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'E2'
JOIN subjects rs ON rs.code = 'AGA';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'E2'
JOIN subjects rs ON rs.code = 'F1';

-- MyE: Regularizadas E1, MM, F2; Aprobadas AM1, F1
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MyE'
JOIN subjects rs ON rs.code = 'E1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MyE'
JOIN subjects rs ON rs.code = 'MM';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MyE'
JOIN subjects rs ON rs.code = 'F2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MyE'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MyE'
JOIN subjects rs ON rs.code = 'F1';

-- TC: Regularizadas Termo; Aprobadas AM2, F2
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'TC'
JOIN subjects rs ON rs.code = 'Termo';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'TC'
JOIN subjects rs ON rs.code = 'AM2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'TC'
JOIN subjects rs ON rs.code = 'F2';

-- MdF: Regularizadas Termo; Aprobadas AM2, F2
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MdF'
JOIN subjects rs ON rs.code = 'Termo';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MdF'
JOIN subjects rs ON rs.code = 'AM2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MdF'
JOIN subjects rs ON rs.code = 'F2';

-- EM: Regularizadas MNM, MM, MR, E2, IM3; Aprobadas QG, E1, AM2
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'EM'
JOIN subjects rs ON rs.code = 'MNM';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'EM'
JOIN subjects rs ON rs.code = 'MM';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'EM'
JOIN subjects rs ON rs.code = 'MR';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'EM'
JOIN subjects rs ON rs.code = 'E2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'EM'
JOIN subjects rs ON rs.code = 'IM3';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'EM'
JOIN subjects rs ON rs.code = 'QG';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'EM'
JOIN subjects rs ON rs.code = 'E1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'EM'
JOIN subjects rs ON rs.code = 'AM2';

-- ECO: Regularizadas IM2; Aprobadas IngSoc (IyS)
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'ECO'
JOIN subjects rs ON rs.code = 'IM2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'ECO'
JOIN subjects rs ON rs.code = 'IyS';

-- MIC: Regularizadas MyE, PyE; Aprobadas AGA, MM, F2
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MIC'
JOIN subjects rs ON rs.code = 'MyE';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MIC'
JOIN subjects rs ON rs.code = 'PyE';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MIC'
JOIN subjects rs ON rs.code = 'AGA';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MIC'
JOIN subjects rs ON rs.code = 'MM';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MIC'
JOIN subjects rs ON rs.code = 'F2';

-- EME: Regularizadas AM2, F2; Aprobadas AM1, AGA, F1
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'EME'
JOIN subjects rs ON rs.code = 'AM2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'EME'
JOIN subjects rs ON rs.code = 'F2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'EME'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'EME'
JOIN subjects rs ON rs.code = 'AGA';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'EME'
JOIN subjects rs ON rs.code = 'F1';

-- ESC: Regularizadas AM2, F2, CA; Aprobadas AM1, AGA, F1
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'ESC'
JOIN subjects rs ON rs.code = 'AM2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'ESC'
JOIN subjects rs ON rs.code = 'F2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'ESC'
JOIN subjects rs ON rs.code = 'CA';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'ESC'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'ESC'
JOIN subjects rs ON rs.code = 'AGA';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'ESC'
JOIN subjects rs ON rs.code = 'F1';

-- E3: Regularizadas E2; Aprobadas AM1, AGA, E1, FI
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'E3'
JOIN subjects rs ON rs.code = 'E2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'E3'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'E3'
JOIN subjects rs ON rs.code = 'AGA';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'E3'
JOIN subjects rs ON rs.code = 'E1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'E3'
JOIN subjects rs ON rs.code = 'FI';

-- PF (Proyecto Final): Regularizadas EM, MIC, EME, ESC; Aprobadas MR, E2, MyE, DM
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PF'
JOIN subjects rs ON rs.code = 'EM';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PF'
JOIN subjects rs ON rs.code = 'MIC';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PF'
JOIN subjects rs ON rs.code = 'EME';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PF'
JOIN subjects rs ON rs.code = 'ESC';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PF'
JOIN subjects rs ON rs.code = 'MR';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PF'
JOIN subjects rs ON rs.code = 'E2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PF'
JOIN subjects rs ON rs.code = 'MyE';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PF'
JOIN subjects rs ON rs.code = 'DM';

-- TdF: Regularizadas EM, MIC; Aprobadas MNM, E1, MM, DM
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'TdF'
JOIN subjects rs ON rs.code = 'EM';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'TdF'
JOIN subjects rs ON rs.code = 'MIC';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'TdF'
JOIN subjects rs ON rs.code = 'MNM';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'TdF'
JOIN subjects rs ON rs.code = 'E1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'TdF'
JOIN subjects rs ON rs.code = 'MM';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'TdF'
JOIN subjects rs ON rs.code = 'DM';

-- MAT: Regularizadas TC; Aprobadas F2, Termo
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MAT'
JOIN subjects rs ON rs.code = 'TC';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MAT'
JOIN subjects rs ON rs.code = 'F2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MAT'
JOIN subjects rs ON rs.code = 'Termo';

-- InsInd: Regularizadas MyE, TC, MdF, EME, ESC; Aprobadas E1, IASI, Termo
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'InsInd'
JOIN subjects rs ON rs.code = 'MyE';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'InsInd'
JOIN subjects rs ON rs.code = 'TC';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'InsInd'
JOIN subjects rs ON rs.code = 'MdF';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'InsInd'
JOIN subjects rs ON rs.code = 'EME';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'InsInd'
JOIN subjects rs ON rs.code = 'ESC';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'InsInd'
JOIN subjects rs ON rs.code = 'E1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'InsInd'
JOIN subjects rs ON rs.code = 'IASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'InsInd'
JOIN subjects rs ON rs.code = 'Termo';

-- OI: Regularizadas ECO; Aprobadas IM2
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'OI'
JOIN subjects rs ON rs.code = 'ECO';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'OI'
JOIN subjects rs ON rs.code = 'IM2';

-- MANT: Regularizadas MyE, ECO, EM; Aprobadas MM, F2, MR, E2
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MANT'
JOIN subjects rs ON rs.code = 'MyE';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MANT'
JOIN subjects rs ON rs.code = 'ECO';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MANT'
JOIN subjects rs ON rs.code = 'EM';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MANT'
JOIN subjects rs ON rs.code = 'MM';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MANT'
JOIN subjects rs ON rs.code = 'F2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MANT'
JOIN subjects rs ON rs.code = 'MR';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'MANT'
JOIN subjects rs ON rs.code = 'E2';

-- Leg: Regularizadas IM2; Aprobadas IngSoc (IyS)
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'Leg'
JOIN subjects rs ON rs.code = 'IM2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'Leg'
JOIN subjects rs ON rs.code = 'IyS';

-- PPS: mismos requisitos que Proyecto Final (Regularizadas EM, MIC, EME, ESC; Aprobadas MR, E2, MyE, DM)
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PPS'
JOIN subjects rs ON rs.code = 'EM';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PPS'
JOIN subjects rs ON rs.code = 'MIC';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PPS'
JOIN subjects rs ON rs.code = 'EME';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PPS'
JOIN subjects rs ON rs.code = 'ESC';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PPS'
JOIN subjects rs ON rs.code = 'MR';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PPS'
JOIN subjects rs ON rs.code = 'E2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PPS'
JOIN subjects rs ON rs.code = 'MyE';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada' FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'S23'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PPS'
JOIN subjects rs ON rs.code = 'DM';
