# API pública de progreso

Endpoint de solo lectura para consultar el progreso de un usuario en una carrera puntual. No requiere API key ni sesión: la única condición es que el usuario tenga su perfil marcado como público (toggle "Hacer mi perfil público" en la app, que genera un `shareToken`).

## Endpoint

```
GET /api/public/{identifier}/progress/{careerCode}
```

### `{identifier}`

El **share token** del usuario (el que se genera al hacer público el perfil; es el mismo identificador que ya usa `GET /api/public/{identifier}` para compartir el tablero completo, y el que aparece en el link de "compartir" de la app).

### `{careerCode}`

El `code` de la carrera, por ejemplo `sistemas` o `S23`. Podés listar los codes disponibles con `GET /api/careers`.

Si el usuario está anotado en más de una carrera, este endpoint siempre devuelve el progreso de **una sola** (la que pases en la URL) — no hay forma de pedir "todas" en una sola llamada, hay que llamarlo una vez por carrera.

## Ejemplo

```bash
curl "https://tu-dominio/api/public/9f3a1c.../progress/S23"
```

### Respuesta (carrera con título intermedio)

```json
{
  "career": "Ingeniería Mecánica - S23",
  "rest": {
    "total": 26,
    "subjectsStatus": {
      "approved": 1,
      "promoted": 7,
      "regularized": 1,
      "inProgress": 6
    },
    "average": 8.5
  },
  "intermediate": {
    "name": "Técnico Universitario en Mecánica",
    "total": 22,
    "subjectsStatus": {
      "approved": 3,
      "promoted": 2,
      "regularized": 0,
      "inProgress": 4
    },
    "average": 7.75
  }
}
```

### Respuesta (carrera sin título intermedio)

La clave `"intermediate"` directamente no aparece; `"rest"` cubre toda la carrera:

```json
{
  "career": "Ingeniería en Sistemas de Información - K23",
  "rest": {
    "total": 27,
    "subjectsStatus": { "approved": 10, "promoted": 5, "regularized": 2, "inProgress": 3 },
    "average": 8.1
  }
}
```

## Campos

- **career**: nombre de la carrera (`careers.name`).
- **rest**: progreso en "el resto de la carrera" — todo lo que no cuenta para el título intermedio (o toda la carrera, si no tiene título intermedio).
- **intermediate**: progreso específico hacia el título intermedio. Solo aparece si `careers.has_intermediate_title` es true para esa carrera. Incluye además `name`, el nombre del título intermedio (`careers.intermediate_title_name`, ej. "Técnico Universitario en Mecánica").
- **total**: cantidad de materias que hacen falta para completar ese balde — no lo que el usuario ya cargó, sino lo que exige el plan. Para `rest` incluye el cupo de electivas (`career_modules.electives_slots`) aunque el usuario todavía no haya elegido ninguna. Sirve para que el cliente sepa cuánto falta: `total - (approved + promoted + regularized + inProgress)` son las materias pendientes (sin cursar, `Desaprobada` o `No regularizada`). Sumando `rest.total + intermediate.total` se obtiene el total de la carrera completa.
- **subjectsStatus**: conteo de materias por estado, dentro de ese balde (intermedio o resto):
  - `approved`: estado `Aprobada`.
  - `promoted`: estado `Promocionada`.
  - `regularized`: estado `Regularizada`.
  - `inProgress`: estado `Faltan notas` (cursando, sin notas cargadas todavía).
- **average**: promedio de las materias `Aprobada`/`Promocionada` de ese balde, redondeado a 2 decimales, usando la misma nota "representativa" que ya calcula el frontend (`computePromedio` en `assets/js/index.js`/`share.js`): para `Aprobada` es la nota del primer final aprobado (≥6, en orden de intento); para `Promocionada` es el promedio redondeado de la última nota cargada de cada parcial. `null` si no hay ninguna materia que cuente para el promedio en ese balde.

## Cómo se cuentan las electivas

Las electivas **siempre** cuentan del lado de `rest` — ninguna carrera exige electivas para el título intermedio, solo para el título de grado.

- **`total`**: no depende de si el usuario ya eligió una electiva o no. Es el cupo fijo de la carrera (`SUM(career_modules.electives_slots)` de todos los módulos), porque esas materias hay que cursarlas sí o sí para recibirse, las haya elegido el usuario o no todavía.
- **`subjectsStatus`/`average`**: acá sí solo entran las electivas que el usuario ya eligió (`user_electives`, vía `PUT /api/electives/...`) y para las que además cargó una inscripción con estado. Una electiva ofrecida pero no elegida no tiene estado que mostrar, así que no suma ahí (pero sí ya está contada en `total`).

## Qué NO cuenta

**Materias sin ninguno de los 4 estados de `subjectsStatus`** (sin inscripción, `Desaprobada`, o `No regularizada`) no se suman ahí — pero sí están incluidas en `total`. Por eso `approved + promoted + regularized + inProgress` puede ser menor a `total`; la diferencia son esas materias sin progreso o directamente desaprobadas/no regularizadas.

## Errores

Mismo formato que el resto de la API: `{"error": "<code>"}` con status HTTP acorde.

| Status | `error` | Motivo |
|---|---|---|
| 404 | `not_found` | El `identifier` no resuelve a ningún usuario. |
| 403 | `private_profile` | El usuario existe pero su perfil no es público. |
| 404 | `career_not_found` | El `careerCode` no existe. |
| 404 | `not_enrolled_in_career` | El usuario no está anotado en esa carrera (no tiene fila en `user_careers`). |

## Implementación

`App\Controllers\PublicController::progress()` (`src/Controllers/PublicController.php`), registrado en `public_html/api/index.php`. Reutiliza `CareerRepository::curriculum()` para la lista de materias por módulo (con sus flags `requiredForIntermediateTitle`/`onlyForIntermediate`) y `EnrollmentRepository::allForUser()` para los estados ya calculados por `App\Domain\StatusCalculator` (el mismo motor que usa el resto de la app).
