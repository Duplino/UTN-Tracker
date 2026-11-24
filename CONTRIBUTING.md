# Cómo contribuir

¡Gracias por querer mejorar UTN-Tracker! Las contribuciones se hacen con pull requests a este repositorio.

## Antes de empezar

- Para un bug o una idea, abrí primero un [issue](https://github.com/Duplino/UTN-Tracker/issues) (hay plantillas). Para cambios grandes, como una carrera nueva, un cambio de esquema o una funcionalidad nueva, esperá a acordarlo ahí antes de programar, así no se pierde trabajo.
- Si encontrás una vulnerabilidad, **no abras un issue público**: seguí [SECURITY.md](SECURITY.md).

## Flujo de trabajo

1. Hacé un fork del repo y creá una rama desde `main` (`fix/...`, `feat/...`).
2. Levantá el entorno local con Docker (detalle en el [readme](readme.md#desarrollo-local-docker)):

   ```
   docker compose -f docker-compose.dev.yml up -d --build
   ```

   La app queda en http://localhost:8080 con login de prueba, sin necesidad de Google OAuth.
3. Hacé tus cambios y corré los tests:

   ```
   composer install
   vendor/bin/phpunit --testsuite unit
   npm test
   ```

   Los tests de API corren solos en el CI. Para correrlos local, mirá la sección [Tests](readme.md#tests) del readme.
4. Abrí un pull request contra `main` completando la plantilla. El CI tiene que quedar en verde. Cada merge a `main` se deploya a producción, así que los PR se revisan antes de mergear.

## Reglas del código

- **Migraciones**: el esquema y los datos de carreras van en `database/migrations/`. Para cambiar algo, creá el archivo con el número siguiente. **Nunca edites una migración que ya existe**, porque en producción ya corrió y no se vuelve a aplicar. El CI lo controla con `bin/check-migrations.sh`: falla si un PR modifica, borra o renombra una migración existente, o si una nueva no sigue el formato `NNNN_nombre.sql` con el número siguiente. Podés correrlo en local con `bin/check-migrations.sh origin/main`.
- **Cálculo de estado**: la lógica existe en PHP (`src/Domain/StatusCalculator.php`) y en JS (`public_html/assets/js/statusEngine.js`). Si cambiás una regla, agregá el caso en `tests/fixtures/status-cases.json` y actualizá los dos lados.
- **Frontend**: JS vanilla + Bootstrap, sin build step ni dependencias de npm. No sumes frameworks ni bundlers sin acordarlo antes en un issue.
- **Datos personales**: no commitees datos reales de estudiantes (PDFs del SIU, legajos, nombres). Los fixtures tienen que estar anonimizados.
- **Secretos**: nunca commitees un `.env` ni credenciales. Las variables están documentadas en `.env.example`.
- Los textos de la interfaz, los comentarios y los commits van en español.

## Licencia de las contribuciones

UTN-Tracker se distribuye bajo la [GNU AGPL-3.0](LICENSE). Al abrir un pull request aceptás que tu contribución se publique bajo esa misma licencia.

## Convivencia

Este proyecto sigue un [código de conducta](CODE_OF_CONDUCT.md). Al participar, aceptás respetarlo.
