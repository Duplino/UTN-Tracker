-- Migración única: crea subject_retakes y la puebla con los recursed_count que ya
-- existan en enrollments (antes de este cambio, era la única fuente del conteo).
-- Reejecutable (CREATE IF NOT EXISTS + upsert con GREATEST, no pisa un conteo mayor
-- si se corre más de una vez). Correr a mano una sola vez contra la DB de producción.

CREATE TABLE IF NOT EXISTS subject_retakes (
  user_id INT UNSIGNED NOT NULL,
  subject_id INT UNSIGNED NOT NULL,
  recursed_count INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, subject_id),
  CONSTRAINT fk_subject_retakes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_subject_retakes_subject FOREIGN KEY (subject_id) REFERENCES subjects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO subject_retakes (user_id, subject_id, recursed_count)
SELECT user_id, subject_id, recursed_count
FROM enrollments
WHERE recursed_count > 0
ON DUPLICATE KEY UPDATE
  recursed_count = GREATEST(subject_retakes.recursed_count, VALUES(recursed_count));
