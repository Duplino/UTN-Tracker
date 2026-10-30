-- Migración puntual para bases ya existentes (una base nueva ya la trae en schema.sql):
-- columna donde se guarda el planificador de cuatrimestres de cada usuario, un JSON
-- { codigoCarrera: plan } que arma el front (ver public_html/assets/js/planner.js).
ALTER TABLE user_preferences ADD COLUMN semester_plans JSON NULL AFTER selected_stats;
