-- Mesas de final publicadas en el SIU Guaraní (autogestión > Fechas de examen),
-- que se ofrecen como sugerencia al cargar la fecha de un final. No son del
-- usuario: las trae bin/fetch-exam-dates.php (cron de los lunes o a mano) y cada
-- corrida reemplaza el contenido entero de la tabla.
--  - subject_id es el código de la materia en Guaraní (ej. 232073), que en el
--    catálogo es subjects.id. Las mesas de materias que no están en el catálogo
--    (planes viejos, otras carreras) no se guardan.
--  - Guaraní solo lista los turnos vigentes o futuros, así que las fechas pasadas
--    desaparecen solas en la corrida siguiente.

CREATE TABLE IF NOT EXISTS guarani_exam_dates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subject_id INT UNSIGNED NOT NULL,
  exam_date DATE NOT NULL,
  start_time TIME NULL,
  inscription_type VARCHAR(60) NOT NULL,
  location VARCHAR(120) NOT NULL DEFAULT '',
  inscription_start DATETIME NULL,
  inscription_end DATETIME NULL,
  fetched_at DATETIME NOT NULL,
  UNIQUE KEY uq_guarani_exam_dates (subject_id, exam_date, inscription_type, location),
  KEY idx_guarani_exam_dates_date (exam_date),
  CONSTRAINT fk_guarani_exam_dates_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
