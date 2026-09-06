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
- Perfil público opcional, para compartir el progreso propio (ver [API.md](API.md) para consumirlo programáticamente).

## Stack

- Backend: PHP + MySQL (`src/`, `database/schema.sql`).
- Frontend: JS vanilla + Bootstrap, sin build step (`public_html/`).

## Desarrollo local (Docker)

Requiere Docker y Docker Compose.

```
docker compose up -d --build
```

Esto levanta:
- `db`: MySQL 8, con el esquema (`database/schema.sql`) y los seeds (`seed_schemes.sql`, `seed_mecanica.sql`, `seed_sistemas.sql`) cargados automáticamente la primera vez que se crea el volumen. `migrate_subject_retakes.sql` queda afuera a propósito: es una migración puntual para bases ya existentes, no hace falta en una base nueva.
- `app`: Apache + PHP 8.2, sirviendo `public_html/` como document root, con el código montado como bind mount (los cambios se reflejan al instante, sin rebuild).

La app queda en [http://localhost:8080](http://localhost:8080), con `MOCK_AUTH_ENABLED=true` por defecto (login de prueba sin pasar por Google, vía `POST /api/auth/mock-login`).

Variables opcionales (ver `docker-compose.yml`): `DB`, `DB_USER`, `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `GOOGLE_CLIENT_ID`, `HOST_APP_PORT`, `HOST_MYSQL_PORT`. Se pueden sobreescribir con un `.env` en la raíz (mismo formato que `.env.example`, docker-compose lo lee para la sustitución de variables).

Para desarrollar sin Docker (PHP + MySQL locales), copiar `.env.example` a `.env` y correr `php -S localhost:8000 -t public_html dev-router.php`.

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

Cambios de esquema de DB se siguen aplicando a mano (`docker compose exec db mysql ...`), igual que ya se hacía sin Docker — `schema.sql`/seeds solo corren la primera vez que se crea el volumen.

No corras `docker-compose.yml` (el de desarrollo) y `docker-compose.prod.yml` a la vez en el mismo directorio: Compose deriva el nombre del proyecto del nombre de la carpeta, así que sin `-p` distinto terminarían compartiendo red y volumen de DB.

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

## Uso de inteligencia artificial

Este proyecto usó fuertemente inteligencia artificial en su desarrollo, con intervención humana también.
