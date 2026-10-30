-- Agenda: fechas de parciales (con su instancia) y de finales que carga el usuario.
-- Va por (usuario, materia) y no por inscripción, igual que subject_retakes: las
-- fechas se suelen saber a principio de año y no tienen que perderse si se recursa
-- o se cambia el esquema de evaluación.
--  - kind 'parcial': partial_number (1..n) + attempt_number (1 = primera fecha,
--    2 = primer recuperatorio, 3 = segundo recuperatorio, igual que enrollment_partials).
--    Una sola fecha por instancia: cargarla de nuevo la reemplaza (unique key).
--  - kind 'final': partial_number y attempt_number en NULL; puede haber varias
--    (una por mesa), el unique no aplica porque MySQL no compara NULLs.

CREATE TABLE IF NOT EXISTS exam_dates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  subject_id INT UNSIGNED NOT NULL,
  kind ENUM('parcial','final') NOT NULL,
  partial_number TINYINT UNSIGNED NULL,
  attempt_number TINYINT UNSIGNED NULL,
  exam_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_exam_dates_instance (user_id, subject_id, kind, partial_number, attempt_number),
  KEY idx_exam_dates_user_date (user_id, exam_date),
  CONSTRAINT fk_exam_dates_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_exam_dates_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
