-- Carrera Ingeniería Mecánica (S23) y sus niveles. En producción se cargaron a mano
-- antes de existir las migraciones; acá quedan para que una base nueva pueda correr
-- 0006_seed_mecanica.sql. INSERT IGNORE: si ya existen, no se tocan.
-- electives_slots en 0: el plan cargado en 0006 no tiene electivas para Mecánica.

SET NAMES utf8mb4;

INSERT IGNORE INTO careers (code, name, has_intermediate_title, intermediate_title_name)
VALUES ('S23', 'Ingeniería Mecánica - S23', 1, 'Técnico Universitario en Mecánica');

INSERT IGNORE INTO career_modules (career_id, code, name, display_order, electives_slots)
SELECT id, 'g1', 'Primer Nivel', 1, 0 FROM careers WHERE code = 'S23';
INSERT IGNORE INTO career_modules (career_id, code, name, display_order, electives_slots)
SELECT id, 'g2', 'Segundo Nivel', 2, 0 FROM careers WHERE code = 'S23';
INSERT IGNORE INTO career_modules (career_id, code, name, display_order, electives_slots)
SELECT id, 'g3', 'Tercer Nivel', 3, 0 FROM careers WHERE code = 'S23';
INSERT IGNORE INTO career_modules (career_id, code, name, display_order, electives_slots)
SELECT id, 'g4', 'Cuarto Nivel', 4, 0 FROM careers WHERE code = 'S23';
INSERT IGNORE INTO career_modules (career_id, code, name, display_order, electives_slots)
SELECT id, 'g5', 'Quinto Nivel', 5, 0 FROM careers WHERE code = 'S23';
