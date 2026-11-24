## Qué cambia

<!-- Describí el cambio y por qué hace falta. Si cierra un issue: "Cierra #123". -->

## Cómo se probó

<!-- Pasos para verificarlo en local y qué tests corriste. -->

## Checklist

- [ ] El CI queda en verde (`vendor/bin/phpunit --testsuite unit` y `npm test` pasan en local).
- [ ] Si toca el esquema o los datos de una carrera, es una migración nueva en `database/migrations/`, no la edición de una existente.
- [ ] Si cambia una regla de estado de materia, está el caso en `tests/fixtures/status-cases.json` y se actualizaron PHP y JS.
- [ ] No incluye datos personales reales ni secretos.
