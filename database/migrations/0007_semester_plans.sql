-- Columna del planificador de cuatrimestres: un JSON { codigoCarrera: plan } que
-- arma el front. Idempotente (MySQL 8 no tiene ADD COLUMN IF NOT EXISTS), por si
-- la columna ya se agregó a mano en alguna base.

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_preferences' AND COLUMN_NAME = 'semester_plans'
);
SET @ddl := IF(@has_col = 0,
  'ALTER TABLE user_preferences ADD COLUMN semester_plans JSON NULL AFTER selected_stats',
  'DO 0');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
