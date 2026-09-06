-- UTN-Tracker: seed de la carrera Sistemas (K23), generado a partir de
-- public_html/assets/data/k23.json. Re-ejecutable: borra y vuelve a cargar
-- el curriculum de esta carrera (careers/career_modules/career_subjects/
-- subject_requirements) sin tocar 'subjects' (catálogo global, upsert por code)
-- ni las tablas transaccionales de usuarios.

SET NAMES utf8mb4;

-- Limpieza idempotente del curriculum de esta carrera (no toca subjects global)
DELETE sr FROM subject_requirements sr
  JOIN career_subjects cs ON cs.id = sr.career_subject_id
  JOIN careers c ON c.id = cs.career_id
  WHERE c.code = 'sistemas';
DELETE cs FROM career_subjects cs
  JOIN careers c ON c.id = cs.career_id
  WHERE c.code = 'sistemas';
DELETE cm FROM career_modules cm
  JOIN careers c ON c.id = cm.career_id
  WHERE c.code = 'sistemas';

-- =====================================================
-- CAREER
-- =====================================================
INSERT INTO careers (code, name, has_intermediate_title, intermediate_title_name)
VALUES (
  'sistemas', 'Ingeniería en Sistemas de Información - K23', 1, 'Analista Universitario en Sistemas de Información'
) AS new_career
ON DUPLICATE KEY UPDATE
  name = new_career.name,
  has_intermediate_title = new_career.has_intermediate_title,
  intermediate_title_name = new_career.intermediate_title_name;

-- =====================================================
-- MODULES
-- =====================================================
INSERT INTO career_modules (career_id, code, name, display_order, electives_slots)
SELECT id, 'g1', 'Primer Nivel', 1, 0 FROM careers WHERE code = 'sistemas';
INSERT INTO career_modules (career_id, code, name, display_order, electives_slots)
SELECT id, 'g2', 'Segundo Nivel', 2, 0 FROM careers WHERE code = 'sistemas';
INSERT INTO career_modules (career_id, code, name, display_order, electives_slots)
SELECT id, 'g3', 'Tercer Nivel', 3, 1 FROM careers WHERE code = 'sistemas';
INSERT INTO career_modules (career_id, code, name, display_order, electives_slots)
SELECT id, 'g4', 'Cuarto Nivel', 4, 2 FROM careers WHERE code = 'sistemas';
INSERT INTO career_modules (career_id, code, name, display_order, electives_slots)
SELECT id, 'g5', 'Quinto Nivel', 5, 4 FROM careers WHERE code = 'sistemas';

-- =====================================================
-- SUBJECTS (catálogo global: upsert por code, no se borra en cada corrida)
-- =====================================================
INSERT INTO subjects (id, code, name, week_hours, duration) VALUES
  (232011, 'SyPdN', 'Sistemas y Procesos de Negocio', 3, 'anual'),
  (950605, 'F1', 'Física I', 5, 'anual'),
  (950702, 'AM1', 'Análisis Matemático I', 5, 'anual'),
  (950701, 'AGA', 'Álgebra y Geometría Analítica', 5, 'anual'),
  (82021, 'AyED', 'Algoritmos y Estructura de Datos', 5, 'anual'),
  (82022, 'AdC', 'Arquitectura de Computadores', 4, 'anual'),
  (951602, 'InglesI', 'Inglés Técnico Nivel I', 2, 'anual'),
  (232010, 'LyED', 'Lógica y Estructuras Discretas', 3, 'anual'),
  (232020, 'ASI', 'Análisis de Sistemas de Información', 6, 'anual'),
  (950703, 'AM2', 'Análisis Matemático II', 5, 'anual'),
  (950606, 'F2', 'Física II', 5, 'anual'),
  (951604, 'IyS', 'Ingeniería y Sociedad', 4, 'cuatrimestral'),
  (82025, 'SySL', 'Sintaxis y Semántica de los Lenguajes', 4, 'anual'),
  (82026, 'PdP', 'Paradigmas de Programación', 4, 'anual'),
  (82027, 'SSOO', 'Sistemas Operativos', 8, 'cuatrimestral'),
  (951603, 'InglesII', 'Inglés Técnico Nivel II', 2, 'anual'),
  (232034, 'DSI', 'Diseño de Sistemas de Información', 6, 'anual'),
  (950704, 'PyE', 'Probabilidad y Estadística', 6, 'cuatrimestral'),
  (950309, 'ECO', 'Economía', 3, 'anual'),
  (232030, 'BD', 'Bases de Datos', 6, 'cuatrimestral'),
  (232031, 'DdS', 'Desarrollo de Software', 6, 'cuatrimestral'),
  (232032, 'CD', 'Comunicación de Datos', 6, 'cuatrimestral'),
  (232033, 'AN', 'Análisis Numérico', 6, 'cuatrimestral'),
  (51, 'SEMINT', 'Seminario Integrador', 0, 'cuatrimestral'),
  (232045, 'AdmSI', 'Administración de Sistemas de Información', 6, 'anual'),
  (950310, 'Leg', 'Legislación', 2, 'anual'),
  (232040, 'IyCS', 'Ingeniería y Calidad de Software', 6, 'cuatrimestral'),
  (232041, 'RD', 'Redes de Datos', 6, 'cuatrimestral'),
  (232042, 'IO', 'Investigación Operativa', 6, 'cuatrimestral'),
  (232043, 'Sim', 'Simulación', 6, 'cuatrimestral'),
  (232044, 'TpA', 'Tecnologías para la Automatización', 6, 'cuatrimestral'),
  (82040, 'IA', 'Inteligencia Artificial', 6, 'cuatrimestral'),
  (232050, 'CdC', 'Ciencia de Datos', 6, 'cuatrimestral'),
  (82035, 'SG', 'Sistemas de Gestión', 6, 'cuatrimestral'),
  (232051, 'GC', 'Gestión Gerencial', 6, 'anual'),
  (232052, 'SSI', 'Seguridad en los Sistemas de Información', 6, 'cuatrimestral'),
  (82122, '082122', 'Administración Estratégica del Capital Humano', 3, 'cuatrimestral'),
  (232062, '232062', 'Ciberseguridad', 3, 'cuatrimestral'),
  (232063, '232063', 'Experiencia de Usuario y Accesibilidad', 6, 'cuatrimestral'),
  (232064, '232064', 'Gestión del Talento Humano', 6, 'cuatrimestral'),
  (232065, '232065', 'Ingeniería de Requisitos', 6, 'cuatrimestral'),
  (232066, '232066', 'Metodología de la Conducción de Equipos de Trabajo', 6, 'cuatrimestral'),
  (232067, '232067', 'Técnicas Avanzadas de Programación', 6, 'cuatrimestral'),
  (232068, '232068', 'Técnicas de Gráficos por Computadora', 6, 'cuatrimestral'),
  (232069, '232069', 'Tendencias y Escenarios Tecnológicos', 6, 'cuatrimestral'),
  (232070, '232070', 'Transformación Digital', 6, 'cuatrimestral'),
  (82071, '082071', 'Criptografía', 6, 'cuatrimestral'),
  (82073, '082073', 'Tecnologías Avanzadas en la Construcción de Software', 6, 'cuatrimestral'),
  (232071, '232071', 'Comunicación Gráfica y Visual', 6, 'cuatrimestral'),
  (232072, '232072', 'Metodología de la Investigación Científico-Tecnológica', 6, 'cuatrimestral'),
  (232061, '232061', 'Química Ambiental', 6, 'cuatrimestral')
AS new_subject
ON DUPLICATE KEY UPDATE
  code = new_subject.code,
  name = new_subject.name,
  week_hours = new_subject.week_hours,
  duration = new_subject.duration;

-- ECO y Leg son compartidas con Mecánica (mismo code = misma materia, aunque la
-- carga horaria real difiera entre carreras; eso se resuelve a futuro), por eso
-- usan el ID "real" del plan de Mecánica (ver seed_mecanica.sql) en vez de autonumérico.
INSERT INTO subjects (id, code, name, week_hours, duration) VALUES
  (950309, 'ECO', 'Economía', 3, 'anual'),
  (950310, 'Leg', 'Legislación', 2, 'anual')
AS new_subject
ON DUPLICATE KEY UPDATE
  code = new_subject.code,
  name = new_subject.name,
  week_hours = new_subject.week_hours,
  duration = new_subject.duration;

-- =====================================================
-- CAREER_SUBJECTS (placement dentro de la carrera Sistemas)
-- =====================================================
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g1'), s.id, 0, 0, 1, 1
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'SyPdN';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g1'), s.id, 0, 0, 1, 2
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'F1';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g1'), s.id, 0, 0, 1, 3
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'AM1';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g1'), s.id, 0, 0, 1, 4
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'AGA';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g1'), s.id, 0, 0, 1, 5
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'AyED';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g1'), s.id, 0, 0, 1, 6
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'AdC';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g1'), s.id, 0, 0, 1, 7
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'InglesI';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g1'), s.id, 0, 0, 1, 8
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'LyED';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g2'), s.id, 0, 0, 1, 1
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'ASI';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g2'), s.id, 0, 0, 1, 2
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'AM2';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g2'), s.id, 0, 0, 1, 3
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'F2';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g2'), s.id, 0, 0, 1, 4
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'IyS';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g2'), s.id, 0, 0, 1, 5
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'SySL';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g2'), s.id, 0, 0, 1, 6
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'PdP';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g2'), s.id, 0, 0, 1, 7
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'SSOO';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g2'), s.id, 0, 0, 1, 8
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'InglesII';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g3'), s.id, 0, 0, 1, 1
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'DSI';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g3'), s.id, 0, 0, 1, 2
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'PyE';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g3'), s.id, 0, 0, 1, 3
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'ECO';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g3'), s.id, 0, 0, 1, 4
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'BD';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g3'), s.id, 0, 0, 1, 5
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'DdS';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g3'), s.id, 0, 0, 1, 6
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'CD';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g3'), s.id, 0, 0, 1, 7
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'AN';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g4'), s.id, 0, 0, 0, 1
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'AdmSI';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g4'), s.id, 0, 0, 0, 2
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'Leg';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g4'), s.id, 0, 0, 0, 3
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'IyCS';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g4'), s.id, 0, 0, 0, 4
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'RD';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g4'), s.id, 0, 0, 0, 5
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'IO';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g4'), s.id, 0, 0, 0, 6
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'Sim';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g4'), s.id, 0, 0, 0, 7
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'TpA';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g5'), s.id, 0, 0, 0, 1
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'IA';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g5'), s.id, 0, 0, 0, 2
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'CdC';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g5'), s.id, 0, 0, 0, 3
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'SG';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g5'), s.id, 0, 0, 0, 4
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'GC';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g5'), s.id, 0, 0, 0, 5
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'SSI';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, NULL, s.id, 1, 0, 0, 1
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = '082122';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, NULL, s.id, 1, 0, 0, 2
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = '232062';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, NULL, s.id, 1, 0, 0, 3
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = '232063';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, NULL, s.id, 1, 0, 0, 4
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = '232064';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, NULL, s.id, 1, 0, 0, 5
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = '232065';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, NULL, s.id, 1, 0, 0, 6
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = '232066';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, NULL, s.id, 1, 0, 0, 7
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = '232067';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, NULL, s.id, 1, 0, 0, 8
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = '232068';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, NULL, s.id, 1, 0, 0, 9
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = '232069';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, NULL, s.id, 1, 0, 0, 10
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = '232070';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, NULL, s.id, 1, 0, 0, 11
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = '082071';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, NULL, s.id, 1, 0, 0, 12
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = '082073';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, NULL, s.id, 1, 0, 0, 13
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = '232071';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, NULL, s.id, 1, 0, 0, 14
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = '232072';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, NULL, s.id, 1, 0, 0, 15
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = '232061';
INSERT INTO career_subjects (career_id, module_id, subject_id, is_elective, only_for_intermediate, required_for_intermediate_title, display_order)
SELECT c.id, (SELECT id FROM career_modules WHERE career_id = c.id AND code = 'g3'), s.id, 0, 1, 0, 99
FROM careers c, subjects s WHERE c.code = 'sistemas' AND s.code = 'SEMINT';

-- =====================================================
-- SUBJECT_REQUIREMENTS (correlativas)
-- =====================================================
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'ASI'
JOIN subjects rs ON rs.code = 'AyED';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'ASI'
JOIN subjects rs ON rs.code = 'SyPdN';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'AM2'
JOIN subjects rs ON rs.code = 'AGA';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'AM2'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'F2'
JOIN subjects rs ON rs.code = 'F1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'F2'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SySL'
JOIN subjects rs ON rs.code = 'LyED';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SySL'
JOIN subjects rs ON rs.code = 'AyED';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PdP'
JOIN subjects rs ON rs.code = 'LyED';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PdP'
JOIN subjects rs ON rs.code = 'AyED';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SSOO'
JOIN subjects rs ON rs.code = 'AdC';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'InglesII'
JOIN subjects rs ON rs.code = 'InglesI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'DSI'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'DSI'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'DSI'
JOIN subjects rs ON rs.code = 'InglesI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'DSI'
JOIN subjects rs ON rs.code = 'AyED';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'DSI'
JOIN subjects rs ON rs.code = 'SyPdN';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PyE'
JOIN subjects rs ON rs.code = 'AGA';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'PyE'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'ECO'
JOIN subjects rs ON rs.code = 'AGA';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'ECO'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'BD'
JOIN subjects rs ON rs.code = 'SySL';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'BD'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'BD'
JOIN subjects rs ON rs.code = 'LyED';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'BD'
JOIN subjects rs ON rs.code = 'AyED';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'DdS'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'DdS'
JOIN subjects rs ON rs.code = 'LyED';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'DdS'
JOIN subjects rs ON rs.code = 'AyED';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'DdS'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'CD'
JOIN subjects rs ON rs.code = 'F1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'CD'
JOIN subjects rs ON rs.code = 'AdC';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'AN'
JOIN subjects rs ON rs.code = 'AM2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'AN'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'AN'
JOIN subjects rs ON rs.code = 'AGA';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'AdmSI'
JOIN subjects rs ON rs.code = 'ECO';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'AdmSI'
JOIN subjects rs ON rs.code = 'DSI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'AdmSI'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'Leg'
JOIN subjects rs ON rs.code = 'IyS';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IyCS'
JOIN subjects rs ON rs.code = 'BD';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IyCS'
JOIN subjects rs ON rs.code = 'DdS';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IyCS'
JOIN subjects rs ON rs.code = 'DSI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IyCS'
JOIN subjects rs ON rs.code = 'SySL';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IyCS'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'RD'
JOIN subjects rs ON rs.code = 'SSOO';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'RD'
JOIN subjects rs ON rs.code = 'CD';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IO'
JOIN subjects rs ON rs.code = 'PyE';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IO'
JOIN subjects rs ON rs.code = 'AN';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'Sim'
JOIN subjects rs ON rs.code = 'PyE';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'Sim'
JOIN subjects rs ON rs.code = 'AM2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'TpA'
JOIN subjects rs ON rs.code = 'F2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'TpA'
JOIN subjects rs ON rs.code = 'AN';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'TpA'
JOIN subjects rs ON rs.code = 'AM2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IA'
JOIN subjects rs ON rs.code = 'Sim';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IA'
JOIN subjects rs ON rs.code = 'PyE';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'IA'
JOIN subjects rs ON rs.code = 'AN';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'CdC'
JOIN subjects rs ON rs.code = 'Sim';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'CdC'
JOIN subjects rs ON rs.code = 'PyE';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'CdC'
JOIN subjects rs ON rs.code = 'BD';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SG'
JOIN subjects rs ON rs.code = 'ECO';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SG'
JOIN subjects rs ON rs.code = 'IO';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SG'
JOIN subjects rs ON rs.code = 'DSI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'GC'
JOIN subjects rs ON rs.code = 'Leg';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'GC'
JOIN subjects rs ON rs.code = 'AdmSI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'GC'
JOIN subjects rs ON rs.code = 'ECO';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SSI'
JOIN subjects rs ON rs.code = 'RD';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SSI'
JOIN subjects rs ON rs.code = 'AdmSI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SSI'
JOIN subjects rs ON rs.code = 'DdS';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SSI'
JOIN subjects rs ON rs.code = 'CD';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '082122'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '082122'
JOIN subjects rs ON rs.code = 'SySL';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '082122'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232062'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232062'
JOIN subjects rs ON rs.code = 'SySL';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232062'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232063'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232063'
JOIN subjects rs ON rs.code = 'SySL';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232063'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232064'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232064'
JOIN subjects rs ON rs.code = 'SySL';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232064'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232065'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232065'
JOIN subjects rs ON rs.code = 'SySL';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232065'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232066'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232066'
JOIN subjects rs ON rs.code = 'SySL';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232066'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232067'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232067'
JOIN subjects rs ON rs.code = 'SySL';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232067'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232068'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232068'
JOIN subjects rs ON rs.code = 'SySL';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232068'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232069'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232069'
JOIN subjects rs ON rs.code = 'SySL';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232069'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232070'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232070'
JOIN subjects rs ON rs.code = 'SySL';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232070'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '082071'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '082071'
JOIN subjects rs ON rs.code = 'SySL';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '082071'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '082073'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '082073'
JOIN subjects rs ON rs.code = 'SySL';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '082073'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232071'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232071'
JOIN subjects rs ON rs.code = 'SySL';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232071'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232072'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232072'
JOIN subjects rs ON rs.code = 'SySL';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232072'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232061'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232061'
JOIN subjects rs ON rs.code = 'SySL';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'regularizada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = '232061'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'SyPdN';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'F1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'AM1';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'AGA';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'AyED';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'AdC';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'InglesI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'LyED';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'ASI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'AM2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'F2';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'IyS';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'SySL';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'PdP';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'SSOO';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'InglesII';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'DSI';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'PyE';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'ECO';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'BD';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'DdS';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'CD';
INSERT INTO subject_requirements (career_subject_id, required_subject_id, requirement_kind, status_type)
SELECT cs.id, rs.id, 'cursar', 'aprobada'
FROM career_subjects cs
JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
JOIN subjects s ON s.id = cs.subject_id AND s.code = 'SEMINT'
JOIN subjects rs ON rs.code = 'AN';

