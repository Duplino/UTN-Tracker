-- Órdenes alternativos del tablero: cada carrera puede tener, además del plan
-- oficial (career_subjects.module_id), otros órdenes sugeridos para ver las materias
-- por nivel (ej. el plan que recomienda Franja Morada). Es solo visual: el título
-- intermedio, las correlativas y los cupos de electivas siguen saliendo del plan
-- cargado en career_subjects (ver careers.base_layout_name). Cada usuario elige cuál
-- ver, o "Mi plan" (armado con el planificador), en user_preferences.subject_layouts
-- (lo interpreta el front, ver subjectLayouts.js).

CREATE TABLE IF NOT EXISTS career_layouts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  career_id INT UNSIGNED NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description VARCHAR(255) NULL,
  display_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_career_layouts (career_id, code),
  CONSTRAINT fk_career_layouts_career FOREIGN KEY (career_id) REFERENCES careers(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Nivel (módulo) y posición de cada materia en un orden alternativo. Una materia sin
-- fila acá queda en su nivel oficial, al final de la columna.
CREATE TABLE IF NOT EXISTS career_layout_placements (
  layout_id INT UNSIGNED NOT NULL,
  career_subject_id INT UNSIGNED NOT NULL,
  module_id INT UNSIGNED NOT NULL,
  display_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (layout_id, career_subject_id),
  CONSTRAINT fk_layout_placements_layout FOREIGN KEY (layout_id) REFERENCES career_layouts(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_layout_placements_subject FOREIGN KEY (career_subject_id) REFERENCES career_subjects(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_layout_placements_module FOREIGN KEY (module_id) REFERENCES career_modules(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Preferencia por carrera: { codigoCarrera: { selected: 'oficial' | <code> | 'propio' } }
-- ('propio' = "Mi plan", una columna por año según el planificador). Idempotente como 0007.
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_preferences' AND COLUMN_NAME = 'subject_layouts'
);
SET @ddl := IF(@has_col = 0,
  'ALTER TABLE user_preferences ADD COLUMN subject_layouts JSON NULL AFTER semester_plans',
  'DO 0');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Nombre del orden que ya está cargado en career_subjects (el que se ve por defecto).
-- En Sistemas es el plan oficial; en Mecánica (S23) lo cargado es el plan de Franja
-- Morada y no hay otro, así que el selector lo muestra con ese nombre.
ALTER TABLE careers ADD COLUMN base_layout_name VARCHAR(255) NOT NULL DEFAULT 'Plan oficial' AFTER intermediate_title_name;
UPDATE careers SET base_layout_name = 'Franja Morada' WHERE code = 'S23';

-- Sistemas (K23): plan sugerido por Franja Morada ("Correlativas plan 2023"). Se
-- carga completo, con el número de cada materia en ese documento como posición.
-- Difiere del oficial en seis materias: IyS (2°), Inglés I (1°), PyE (3°),
-- Análisis Numérico (3°), Redes de Datos (4°) y Ciencia de Datos (5°).
INSERT INTO career_layouts (career_id, code, name, description, display_order)
SELECT c.id, 'franja-morada', 'Franja Morada', 'Plan sugerido por Franja Morada (correlativas plan 2023)', 1
FROM careers c WHERE c.code = 'sistemas';

INSERT INTO career_layout_placements (layout_id, career_subject_id, module_id, display_order)
SELECT l.id, cs.id, m.id, p.pos
FROM (
            SELECT 'AM1' AS subject_code, 'g1' AS module_code, 1 AS pos
  UNION ALL SELECT 'AGA', 'g1', 2
  UNION ALL SELECT 'F1', 'g1', 3
  UNION ALL SELECT 'InglesI', 'g1', 4
  UNION ALL SELECT 'LyED', 'g1', 5
  UNION ALL SELECT 'AyED', 'g1', 6
  UNION ALL SELECT 'AdC', 'g1', 7
  UNION ALL SELECT 'SyPdN', 'g1', 8
  UNION ALL SELECT 'AM2', 'g2', 9
  UNION ALL SELECT 'F2', 'g2', 10
  UNION ALL SELECT 'IyS', 'g2', 11
  UNION ALL SELECT 'InglesII', 'g2', 12
  UNION ALL SELECT 'SySL', 'g2', 13
  UNION ALL SELECT 'PdP', 'g2', 14
  UNION ALL SELECT 'SSOO', 'g2', 15
  UNION ALL SELECT 'ASI', 'g2', 16
  UNION ALL SELECT 'PyE', 'g3', 17
  UNION ALL SELECT 'ECO', 'g3', 18
  UNION ALL SELECT 'BD', 'g3', 19
  UNION ALL SELECT 'DdS', 'g3', 20
  UNION ALL SELECT 'CD', 'g3', 21
  UNION ALL SELECT 'AN', 'g3', 22
  UNION ALL SELECT 'DSI', 'g3', 23
  UNION ALL SELECT 'Leg', 'g4', 24
  UNION ALL SELECT 'IyCS', 'g4', 25
  UNION ALL SELECT 'RD', 'g4', 26
  UNION ALL SELECT 'IO', 'g4', 27
  UNION ALL SELECT 'Sim', 'g4', 28
  UNION ALL SELECT 'TpA', 'g4', 29
  UNION ALL SELECT 'AdmSI', 'g4', 30
  UNION ALL SELECT 'IA', 'g5', 31
  UNION ALL SELECT 'CdC', 'g5', 32
  UNION ALL SELECT 'SG', 'g5', 33
  UNION ALL SELECT 'GC', 'g5', 34
  UNION ALL SELECT 'SSI', 'g5', 35
) p
JOIN careers c ON c.code = 'sistemas'
JOIN career_layouts l ON l.career_id = c.id AND l.code = 'franja-morada'
JOIN subjects s ON s.code = p.subject_code
JOIN career_subjects cs ON cs.career_id = c.id AND cs.subject_id = s.id
JOIN career_modules m ON m.career_id = c.id AND m.code = p.module_code;
