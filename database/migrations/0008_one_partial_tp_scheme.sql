-- Esquema de aprobación "1 parcial + 1 TP". El TP es requisito tanto para
-- regularizar como para promocionar (como en '2-partials-tp-blocking'): con el
-- parcial en 6 o más y el TP aprobado se regulariza; con 8 o más (en la primera
-- instancia o en el recuperatorio) y el TP aprobado, se promociona.

INSERT INTO evaluation_schemes (code, name, config) VALUES
(
  '1-partial-tp',
  '1 parcial + TP (requisito de regularización y promoción)',
  JSON_OBJECT(
    'partials', 1,
    'tp', 1,
    'labs', 0,
    'tp_required_for', JSON_ARRAY('regularization', 'promotion'),
    'labs_required_for', JSON_ARRAY(),
    'promotion', JSON_OBJECT('high_note', 8, 'high_count', 1, 'low_note', NULL, 'max_recovery', 1),
    'regularization', JSON_OBJECT('min_note', 6),
    'approve', JSON_OBJECT('min_note', 6)
  )
)
AS new_scheme
ON DUPLICATE KEY UPDATE
  name = new_scheme.name,
  config = new_scheme.config;
