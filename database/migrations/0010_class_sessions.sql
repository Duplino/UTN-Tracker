-- Horario semanal: días y horas de cursada que carga el usuario (a mano o desde el
-- comprobante de inscripción del SIU). Va por (usuario, materia), igual que la
-- agenda, y no exige que la materia esté en curso en el tablero.
--  - weekday: 0 = lunes ... 5 = sábado.
--  - start_time / end_time: 'HH:MM'. La grilla los encaja en los bloques fijos de la
--    facultad (ver assets/js/schedule.js), pero se guardan como horas para no atar
--    la base a una tabla de bloques puntual.
--  - commission / campus: comisión (ej. K2005) y sede, opcionales. Se repiten en cada
--    fila de la misma materia.

CREATE TABLE IF NOT EXISTS class_sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  subject_id INT UNSIGNED NOT NULL,
  weekday TINYINT UNSIGNED NOT NULL,
  start_time CHAR(5) NOT NULL,
  end_time CHAR(5) NOT NULL,
  commission VARCHAR(20) NULL,
  campus VARCHAR(60) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_class_sessions_user (user_id, subject_id),
  CONSTRAINT fk_class_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_class_sessions_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
