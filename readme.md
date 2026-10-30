# UTN-Tracker

Aplicación para planificar y seguir el avance de la cursada en carreras de la UTN: tablero tipo kanban por módulos/años, carga de parciales y finales, cálculo automático de estado de cada materia (Aprobada, Promocionada, Regularizada, etc.), correlativas, electivas y estadísticas de progreso.

## Acceso

La aplicación está disponible en **[utntracker.com.ar](https://utntracker.com.ar)**. Se ingresa con cuenta de Google; no hace falta instalar nada.

## Funcionalidades

- Tablero por módulos/años con las materias de la carrera y sus correlativas.
- Carga de parciales (con recuperatorios), finales y checklist de TPs/labs, según el esquema de evaluación de cada materia.
- Cálculo automático del estado de cada materia, con opción de forzarlo manualmente.
- Soporte para electivas y para carreras con título intermedio.
- Estadísticas de progreso (materias aprobadas, promedio, horas semanales en curso).
- Planificador de cuatrimestres: qué podés cursar el próximo cuatrimestre según tus correlativas, simulación de los cuatrimestres siguientes (qué destraba cada materia) y fecha estimada de egreso, al ritmo actual y con el plan armado.
- Perfil público opcional, para compartir el progreso propio (ver [API.md](API.md) para consumirlo programáticamente).

## Stack

- Backend: PHP + MySQL (`src/`, esquema en `database/migrations/`).
- Frontend: JS vanilla + Bootstrap, sin build step (`public_html/`).

## Desarrollo local (Docker)

Requiere Docker y Docker Compose.

```
docker compose up -d --build
```

Esto levanta:
- `db`: MySQL 8, vacío la primera vez.
- `app`: Apache + PHP 8.2, sirviendo `public_html/` como document root, con el código montado como bind mount (los cambios se reflejan al instante, sin rebuild). Al arrancar aplica las migraciones pendientes (ver [Base de datos](#base-de-datos-migraciones)), así que la primera vez crea el esquema y carga las carreras.

La app queda en [http://localhost:8080](http://localhost:8080), con `MOCK_AUTH_ENABLED=true` por defecto (login de prueba sin pasar por Google, vía `POST /api/auth/mock-login`).

Variables opcionales (ver `docker-compose.yml`): `DB`, `DB_USER`, `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `GOOGLE_CLIENT_ID`, `HOST_APP_PORT`, `HOST_MYSQL_PORT`. Se pueden sobreescribir con un `.env` en la raíz (mismo formato que `.env.example`, docker-compose lo lee para la sustitución de variables).

Para desarrollar sin Docker (PHP + MySQL locales), copiar `.env.example` a `.env`, correr `composer install` y `php bin/migrate.php`, y después `php -S localhost:8000 -t public_html dev-router.php`.

## Producción (VPS con Docker + Caddy)

`docker-compose.prod.yml` es la variante para un servidor real, distinta de la de desarrollo:

- No monta el código como bind mount: la imagen se buildea con `COPY . .`, así que **cada deploy requiere `--build`** (no hay live-reload).
- No publica ningún puerto al host. La app se conecta a la red de Docker donde corre tu Caddy (`caddy_net`, externa) y Caddy la alcanza por nombre de contenedor: `utntracker-app:80`.
- `MOCK_AUTH_ENABLED` queda forzado en `"false"` en el propio compose (no se puede prender por accidente vía `.env`).
- Las variables de `.env` son obligatorias (`DB`, `DB_USER`, `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `GOOGLE_CLIENT_ID`): si falta alguna, `docker compose` corta con un error explícito en vez de arrancar con un default inseguro.

### Deploy inicial

1. En el VPS: `git clone <repo> /opt/utn-tracker && cd /opt/utn-tracker`.
2. Crear `.env` (no se commitea) con passwords reales generados para este proyecto y el `GOOGLE_CLIENT_ID` de producción.
3. Editar `docker-compose.prod.yml`: reemplazar `CAMBIAR_nombre_red_de_caddy` por el nombre real de la red de tu Caddy (`docker network ls` para verla).
4. `docker compose -f docker-compose.prod.yml --env-file .env up -d --build`.
5. Agregar un bloque al Caddyfile existente y recargar Caddy:
   ```
   utntracker.com.ar {
       reverse_proxy utntracker-app:80
   }
   ```

### Redeploy (cambios de código)

```
git pull
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Las migraciones nuevas se aplican solas al arrancar el contenedor (ver [Base de datos](#base-de-datos-migraciones)). Si una falla, el contenedor `app` no levanta: `docker compose -f docker-compose.prod.yml logs app` muestra cuál y por qué.

No corras `docker-compose.yml` (el de desarrollo) y `docker-compose.prod.yml` a la vez en el mismo directorio: Compose deriva el nombre del proyecto del nombre de la carpeta, así que sin `-p` distinto terminarían compartiendo red y volumen de DB.

### Caché (navegador y Cloudflare)

- **HTML**: `Cache-Control: no-cache` (siempre revalida, un deploy se ve al instante).
- **Assets** (`/assets/*`): en el build de la imagen, `docker/version-assets.php` agrega `?v=<hash>` a cada CSS/JS/imagen referenciado desde los HTML y genera un import map para los módulos JS. Apache sirve esas URLs versionadas con `max-age=31536000, immutable` (ver `docker/apache-vhost.conf`). En desarrollo (bind mount o `php -S`) no se versiona nada y no pasa nada.
- **API**: todo `/api/*` sale con `no-store`, salvo el catálogo que es igual para todos (`/api/careers`, `/api/careers/{code}/curriculum`, `/api/evaluation-schemes`), que sale con `public, max-age=300, s-maxage=86400`.

Cloudflare no cachea rutas sin extensión por defecto, así que para que el catálogo se sirva desde el borde hace falta una **Cache Rule** (Caching → Cache Rules → Create rule):

- Si: `URI Path` empieza con `/api/careers` **o** `URI Path` es igual a `/api/evaluation-schemes`, y el método es `GET`.
- Entonces: *Eligible for cache*, con *Edge TTL* = "Use cache-control header if present" y *Browser TTL* = "Respect origin".

No pongas una regla de "Cache Everything" sobre todo `/api/*`: el resto es data por usuario (igual sale con `no-store`, pero mejor no depender de eso). Después de cambiar los seeds de carreras o esquemas, purgá esas URLs en Cloudflare (o esperá hasta un día).

### Backups

`bin/backup-db.sh` hace un `mysqldump` comprimido de la base del compose en `backups/` (ignorada por git) y borra los de más de 14 días. Para correrlo todas las noches, en el VPS (`crontab -e`):

```
15 4 * * * /opt/utn-tracker/bin/backup-db.sh >> /var/log/utntracker-backup.log 2>&1
```

El comentario al principio del script tiene el comando para restaurar. Conviene copiar `backups/` fuera del VPS cada tanto (un backup en el mismo disco no sirve si se pierde el disco).

## Staging (probar antes de pushear)

`docker-compose.staging.yml` es igual a `docker-compose.prod.yml` (misma imagen, sin bind mount, DB propia) salvo por el nombre del contenedor (`utntracker-app-staging`), para poder correr los dos al mismo tiempo en el mismo VPS sin que choquen.

1. Clonar en otra carpeta, con `dev` en vez de `main`:
   ```
   git clone -b dev <repo> /opt/utn-tracker-staging
   ```
   Al ser una carpeta distinta (`utn-tracker-staging` vs. la de prod), Compose ya usa un nombre de proyecto distinto → red y volumen de DB quedan aislados automáticamente, sin tocar nada extra.
2. Crear un `.env` ahí con **credenciales de DB propias** (usuario/base/password distintos a los de prod — es una instancia de MySQL separada, no la misma). `GOOGLE_CLIENT_ID` puede ser el mismo que en prod, es el mismo OAuth client.
3. En Google Cloud Console, agregar `https://staging.utntracker.com.ar` a los orígenes de JavaScript autorizados de ese OAuth client (si no, el login real va a fallar solo en staging).
4. `docker compose -f docker-compose.staging.yml --env-file .env up -d --build`.
5. Sumar otro bloque al Caddyfile:
   ```
   staging.utntracker.com.ar {
       reverse_proxy utntracker-app-staging:80
   }
   ```
6. Redeploy de staging con cambios nuevos de `dev`: `git pull && docker compose -f docker-compose.staging.yml --env-file .env up -d --build`.

Cuando `dev` está probado y se mergea a `main`, el redeploy de prod es el mismo flujo pero en la carpeta de prod (ver sección anterior).

## Base de datos (migraciones)

El esquema y los datos de carreras viven en `database/migrations/`, en archivos numerados (`0001_initial_schema.sql`, `0002_...`). `php bin/migrate.php` aplica los que todavía no corrieron, en orden, y los anota en la tabla `schema_migrations`. El contenedor lo corre solo al arrancar; `php bin/migrate.php --status` muestra qué está aplicado.

Para cambiar el esquema o los datos de una carrera:

1. Crear el archivo siguiente, por ejemplo `0008_agrega_columna_x.sql`. Nunca editar uno ya aplicado: no se vuelve a correr.
2. Probarlo localmente (`php bin/migrate.php`) y commitearlo.
3. Al redeployar se aplica solo, en staging y después en prod.

MySQL no permite deshacer un `ALTER TABLE` dentro de una transacción, así que si una migración falla a la mitad hay que revisar la base a mano antes de reintentar. Escribirlas idempotentes cuando se pueda (ver `0007_semester_plans.sql`).

Bases creadas antes de este sistema (prod y staging): la primera vez que corre, si encuentra la tabla `users` pero no `schema_migrations`, da por aplicadas las migraciones hasta la `0006` (esquema y seeds que ya estaban cargados a mano) sin ejecutarlas, y aplica de la `0007` en adelante.

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
