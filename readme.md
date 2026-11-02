# UTN-Tracker

Aplicación para planificar y seguir el avance de la cursada en carreras de la UTN: tablero tipo kanban por módulos/años, carga de parciales y finales, cálculo automático de estado de cada materia (Aprobada, Promocionada, Regularizada, etc.), correlativas, electivas y estadísticas de progreso.

## Acceso

La aplicación está disponible en **[utntracker.com.ar](https://utntracker.com.ar)**. Se ingresa con cuenta de Google; no hace falta instalar nada.

## Funcionalidades

- Tablero por módulos/años con las materias de la carrera y sus correlativas.
- Carga de parciales (con recuperatorios), finales y checklist de TPs/labs, según el esquema de evaluación de cada materia.
- Cálculo automático del estado de cada materia, con opción de forzarlo manualmente.
- Soporte para electivas y para carreras con título intermedio.
- Importación de la historia académica del SIU Guaraní (PDF): carga de una vez las materias aprobadas, promocionadas, regularizadas y en curso, con sus notas y recursadas. El PDF se lee en el navegador, no se sube al servidor (se descarga de [Historia académica](https://guarani.frba.utn.edu.ar/autogestion/grado/historia_academica) con el filtro en «Todos»).
- Estadísticas de progreso (materias aprobadas, promedio, horas semanales en curso).
- Horario semanal: días y horas de cada materia en una grilla por bloques (lunes a sábado), cargado a mano o importando el comprobante de inscripción a cursada del SIU (PDF, se lee en el navegador).
- Cursar con un compañero: pegá el link de su perfil público y te muestra qué materias pueden cursar juntos el próximo cuatrimestre, cuáles solo vos y cuáles solo él o ella.
- Planificador de cuatrimestres: qué podés cursar el próximo cuatrimestre según tus correlativas, simulación de los cuatrimestres siguientes (qué destraba cada materia) y fecha estimada de egreso, al ritmo actual y con el plan armado.
- Perfil público opcional, para compartir el progreso propio (ver [API.md](API.md) para consumirlo programáticamente).

## Stack

- Backend: PHP + MySQL (`src/`, esquema en `database/migrations/`).
- Frontend: JS vanilla + Bootstrap, sin build step (`public_html/`).

## Desarrollo local (Docker)

Requiere Docker y Docker Compose.

```
docker compose -f docker-compose.dev.yml up -d --build
```

(Para no escribir el `-f`, poné `COMPOSE_FILE=docker-compose.dev.yml` en tu `.env` local.)

Esto levanta:
- `db`: MySQL 8, vacío la primera vez.
- `app`: Apache + PHP 8.2, sirviendo `public_html/` como document root, con el código montado como bind mount (los cambios se reflejan al instante, sin rebuild). Al arrancar aplica las migraciones pendientes (ver [Base de datos](#base-de-datos-migraciones)), así que la primera vez crea el esquema y carga las carreras.

La app queda en [http://localhost:8080](http://localhost:8080), con `MOCK_AUTH_ENABLED=true` por defecto (login de prueba sin pasar por Google, vía `POST /api/auth/mock-login`).

Variables opcionales (ver `docker-compose.dev.yml`): `DB`, `DB_USER`, `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `GOOGLE_CLIENT_ID`, `HOST_APP_PORT`, `HOST_MYSQL_PORT`. Se pueden sobreescribir con un `.env` en la raíz: [`.env.example`](.env.example) tiene todas las variables documentadas, agrupadas por entorno.

Para desarrollar sin Docker (PHP + MySQL locales), copiar `.env.example` a `.env`, correr `composer install` y `php bin/migrate.php`, y después `php -S localhost:8000 -t public_html dev-router.php`.

## Producción

`docker-compose.yml` (el default de `docker compose`) es el de servidor, distinto del de desarrollo:

- No monta el código como bind mount: la imagen se buildea con `COPY . .`, así que **cada deploy requiere `--build`**.
- No publica ningún puerto al host: la app se suma a una red de Docker externa (`CADDY_NETWORK`) donde corre el reverse proxy, que la alcanza por nombre de contenedor (`APP_CONTAINER_NAME`, default `utntracker-app`, puerto 80).
- `MOCK_AUTH_ENABLED` está apagado salvo que el `.env` diga `true`. Nunca prenderlo en producción.
- Las variables del `.env` son obligatorias (`DB`, `DB_USER`, `DB_PASSWORD`, `GOOGLE_CLIENT_ID`, `CADDY_NETWORK`): si falta alguna, `docker compose` corta con un error en vez de arrancar con un default inseguro. [`.env.example`](.env.example) las documenta.

Deploy y redeploy:

```
cp .env.example .env   # la primera vez, y completarlo
git pull
docker compose up -d --build
```

Las migraciones nuevas se aplican solas al arrancar el contenedor (ver [Base de datos](#base-de-datos-migraciones)). Si una falla, el contenedor `app` no levanta y `docker compose logs app` muestra cuál y por qué.

No corras `docker-compose.dev.yml` y `docker-compose.yml` a la vez en la misma carpeta: Compose deriva el nombre del proyecto de la carpeta, así que terminarían compartiendo red y volumen de DB.

Scripts para el servidor (cada uno explica su uso en el comentario del principio):

- `bin/deploy.sh`: pull, backup, build y chequeo de que la app responda. Lo usa `.github/workflows/deploy.yml` para deployar solo cuando el CI de `main` pasa.
- `bin/backup-db.sh`: `mysqldump` comprimido en `backups/`, con retención de 14 días.

### Caché

- **HTML**: `Cache-Control: no-cache` (siempre revalida, un deploy se ve al instante).
- **Assets** (`/assets/*`): en el build de la imagen, `docker/version-assets.php` agrega `?v=<hash>` a cada CSS/JS/imagen referenciado desde los HTML y genera un import map para los módulos JS. Apache sirve esas URLs con `max-age=31536000, immutable` (ver `docker/apache-vhost.conf`). En desarrollo no se versiona nada.
- **API**: todo `/api/*` sale con `no-store`, salvo el catálogo que es igual para todos (`/api/careers`, `/api/careers/{code}/curriculum`, `/api/evaluation-schemes`), que sale con `public, max-age=300, s-maxage=86400`.

## Landing (`site/`)

`site/` es la landing pública, un sitio estático (HTML + Bootstrap, sin build) que se despliega aparte de la app. `site/_redirects` y `site/_headers` son la configuración de redirecciones y caché del hosting. Está en `.dockerignore`, así que no entra a la imagen de la app.

Para verla en local: `python3 -m http.server -d site 8081`.

## Base de datos (migraciones)

El esquema y los datos de carreras viven en `database/migrations/`, en archivos numerados (`0001_initial_schema.sql`, `0002_...`). `php bin/migrate.php` aplica los que todavía no corrieron, en orden, y los anota en la tabla `schema_migrations`. El contenedor lo corre solo al arrancar; `php bin/migrate.php --status` muestra qué está aplicado.

Para cambiar el esquema o los datos de una carrera:

1. Crear el archivo siguiente, por ejemplo `0008_agrega_columna_x.sql`. Nunca editar uno ya aplicado: no se vuelve a correr.
2. Probarlo localmente (`php bin/migrate.php`) y commitearlo.
3. Al redeployar se aplica sola.

MySQL no permite deshacer un `ALTER TABLE` dentro de una transacción, así que si una migración falla a la mitad hay que revisar la base a mano antes de reintentar. Escribirlas idempotentes cuando se pueda (ver `0007_semester_plans.sql`).

## Tests

```
composer install
vendor/bin/phpunit --testsuite unit   # cálculo de estado y separador de SQL
npm test                              # cálculo de estado del front (Node 20+)
```

El cálculo de estado de una materia existe dos veces (PHP en `src/Domain/StatusCalculator.php` y JS en `public_html/assets/js/statusEngine.js`). Los dos se prueban contra los mismos casos de `tests/fixtures/status-cases.json`: si se cambia una regla, agregar el caso ahí y los dos tests tienen que seguir pasando.

Los tests de API (`tests/Api/`) pegan contra un servidor real con una base migrada y `MOCK_AUTH_ENABLED=true`. Escriben datos del usuario de prueba, así que no van contra producción:

```
MOCK_AUTH_ENABLED=true php -S 127.0.0.1:8001 -t public_html dev-router.php &
API_TEST_URL=http://127.0.0.1:8001 vendor/bin/phpunit --testsuite api
```

GitHub Actions (`.github/workflows/ci.yml`) corre todo esto en cada push a `main`/`dev` y en cada PR, incluidas las migraciones sobre un MySQL vacío.

## Uso de inteligencia artificial

Este proyecto usó fuertemente inteligencia artificial en su desarrollo, con intervención humana también.
