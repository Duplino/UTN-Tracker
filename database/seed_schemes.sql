-- Carga inicial de evaluation_schemes. Se corre una sola vez a mano contra la
-- DB (no lo ejecuta la app en runtime). Reejecutable: usa UPSERT por `code`.
-- Los criterios reales de cada materia (qué esquema le corresponde) se
-- terminan de ajustar a mano en `config` a medida que se confirman casos.

INSERT INTO evaluation_schemes (code, name, config) VALUES
(
  '2-partials',
  '2 parciales (estándar)',
  JSON_OBJECT(
    'partials', 2,
    'tp', 0,
    'labs', 0,
    'tp_required_for', JSON_ARRAY(),
    'labs_required_for', JSON_ARRAY(),
    'promotion', JSON_OBJECT('high_note', 8, 'high_count', 2, 'low_note', NULL, 'max_recovery', 1),
    'regularization', JSON_OBJECT('min_note', 6),
    'approve', JSON_OBJECT('min_note', 6)
  )
),
(
  '3-partials',
  '3 parciales',
  JSON_OBJECT(
    'partials', 3,
    'tp', 0,
    'labs', 0,
    'tp_required_for', JSON_ARRAY(),
    'labs_required_for', JSON_ARRAY(),
    'promotion', JSON_OBJECT('high_note', 8, 'high_count', 3, 'low_note', NULL, 'max_recovery', 1),
    'regularization', JSON_OBJECT('min_note', 6),
    'approve', JSON_OBJECT('min_note', 6)
  )
),
(
  'paradigmas',
  '3 parciales (2 promocionan, 1 solo aprueba)',
  JSON_OBJECT(
    'partials', 3,
    'tp', 0,
    'labs', 0,
    'tp_required_for', JSON_ARRAY(),
    'labs_required_for', JSON_ARRAY(),
    'promotion', JSON_OBJECT('high_note', 8, 'high_count', 2, 'low_note', 6, 'max_recovery', 1),
    'regularization', JSON_OBJECT('min_note', 6),
    'approve', JSON_OBJECT('min_note', 6)
  )
),
(
  '2-partials-tp-blocking',
  '2 parciales + TP (bloquea regularizar y promocionar)',
  JSON_OBJECT(
    'partials', 2,
    'tp', 1,
    'labs', 0,
    'tp_required_for', JSON_ARRAY('regularization', 'promotion'),
    'labs_required_for', JSON_ARRAY(),
    'promotion', JSON_OBJECT('high_note', 8, 'high_count', 2, 'low_note', NULL, 'max_recovery', 1),
    'regularization', JSON_OBJECT('min_note', 6),
    'approve', JSON_OBJECT('min_note', 6)
  )
),
(
  '2-partials-tp-promotion-only',
  '2 parciales + TP (solo requisito de promoción)',
  JSON_OBJECT(
    'partials', 2,
    'tp', 1,
    'labs', 0,
    'tp_required_for', JSON_ARRAY('promotion'),
    'labs_required_for', JSON_ARRAY(),
    'promotion', JSON_OBJECT('high_note', 8, 'high_count', 2, 'low_note', NULL, 'max_recovery', 1),
    'regularization', JSON_OBJECT('min_note', 6),
    'approve', JSON_OBJECT('min_note', 6)
  )
),
(
  'physics-labs',
  '2 parciales + 4 laboratorios (requisito de regularización y promoción)',
  JSON_OBJECT(
    'partials', 2,
    'tp', 0,
    'labs', 4,
    'tp_required_for', JSON_ARRAY(),
    'labs_required_for', JSON_ARRAY('regularization', 'promotion'),
    'promotion', JSON_OBJECT('high_note', 8, 'high_count', 2, 'low_note', NULL, 'max_recovery', 1),
    'regularization', JSON_OBJECT('min_note', 6),
    'approve', JSON_OBJECT('min_note', 6)
  )
)
AS new_scheme
ON DUPLICATE KEY UPDATE
  name = new_scheme.name,
  config = new_scheme.config;
