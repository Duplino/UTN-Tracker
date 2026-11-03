-- Sistemas (K23): ubica en su nivel, según el plan de estudios 2023, seis materias
-- que estaban cargadas en otro. El título intermedio son los niveles 1 a 3 (las
-- materias sombreadas del plan), así que Redes de Datos pasa a contar para él y
-- Análisis Numérico deja de contar.
--
--   Ingeniería y Sociedad      2° -> 1°
--   Inglés I                   1° -> 2°
--   Probabilidad y Estadística 3° -> 2°
--   Redes de Datos             4° -> 3°   (cuenta para el título intermedio)
--   Análisis Numérico          3° -> 4°   (deja de contar)
--   Ciencia de Datos           5° -> 4°

UPDATE career_subjects cs
  JOIN careers c ON c.id = cs.career_id AND c.code = 'sistemas'
  JOIN subjects s ON s.id = cs.subject_id
  JOIN career_modules m ON m.career_id = c.id AND m.code = CASE s.code
    WHEN 'IyS' THEN 'g1'
    WHEN 'InglesI' THEN 'g2'
    WHEN 'PyE' THEN 'g2'
    WHEN 'RD' THEN 'g3'
    WHEN 'AN' THEN 'g4'
    WHEN 'CdC' THEN 'g4'
  END
SET cs.module_id = m.id,
    cs.display_order = CASE s.code
      WHEN 'IyS' THEN 9
      WHEN 'InglesI' THEN 9
      WHEN 'PyE' THEN 10
      WHEN 'RD' THEN 8
      WHEN 'AN' THEN 9
      WHEN 'CdC' THEN 10
    END,
    cs.required_for_intermediate_title = CASE s.code
      WHEN 'RD' THEN 1
      WHEN 'AN' THEN 0
      ELSE cs.required_for_intermediate_title
    END
WHERE s.code IN ('IyS', 'InglesI', 'PyE', 'RD', 'AN', 'CdC');
