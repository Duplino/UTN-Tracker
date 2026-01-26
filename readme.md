
# UTN-Tracker

Pequeña aplicación cliente para planificar y seguir cursadas de materias (tablero tipo kanban por módulos), pensada para carreras como Ingeniería en Sistemas. Permite colocar materias, agregar electivas, registrar parciales/finales, calcular estados (Aprobada, Promocionada, Regularizada, etc.), y ver estadísticas básicas de progreso y carga semanal.

## Índice

- Descripción breve
- Cómo usar (rápido)
- Funcionalidades
- API Pública
- Estructura del plan (`assets/data/k23.json`)
	- Formato de `modules` y `subjects`
- Persistencia (dónde se guarda qué)
- Ejemplos de uso

---

## Descripción breve

UTN-Tracker es una SPA ligera (vanilla JS + Bootstrap) que carga un "plan" en formato JSON y crea un tablero con columnas por módulos. Cada tarjeta representa una materia; las correlativas se muestran con flechas en el overlay y hay soporte para electivas, badges con horas/notas, y cálculo de estadísticas (horas semanales en curso, promedio de aprobadas, progreso de materias).

## Cómo usar (rápido)

1. Abrir el link https://duplino.github.io/UTN-Tracker/

2. En la barra superior seleccioná el programa (por ahora hay uno por defecto). Botón `electivas` abre el modal con la lista de electivas disponibles en el plan.
3. El tablero se genera desde `assets/data/k23.json`. Los módulos con `render: false` se usan como depósito (por ejemplo para la lista de electivas) y no crean columna.
4. Hacé click en una tarjeta para abrir el modal de la materia y registrar parciales/finales o usar el override.

---

## Funcionalidades principales

- Renderizado dinámico del plan (módulos -> columnas -> materias).
- Electivas: módulo específico con `render:false` contiene la lista de electivas; el tablero puede tener placeholders (+) para insertar electivas en columnas. Las colocaciones se persisten en `localStorage.electives`.
- Modal de materia: ingresar parciales (hasta 3 intentos por parcial), hasta 4 finales, ver estado calculado en vivo (Promocionada, Aprobada, Regularizada, Desaprobada, Faltan notas, No regularizada).
- Override manual: control estático en el modal para forzar un estado (se guarda en `subjectData:<code>.overrideStatus`).
- Badges en tarjetas: azul con `weekHours` para materias no aprobadas; verde con nota para Aprobadas/Promocionadas (según reglas definidas).
- Toggle "Mostrar correlativas": activa/desactiva visualización de flechas y efectos hover (persistido en localStorage).
- Animación al desbloquear materias: cuando una materia cambia de estado se recalculan las materias disponibles para cursar y se anima las que acaban de desbloquearse.
- Estadísticas abajo: Horas semanales en curso, Promedio de aprobadas, conteos (aprobadas/total), barra de progreso.

---

## API Pública

La aplicación proporciona una API pública para obtener los datos de usuario en formato JSON. Esto permite a los usuarios compartir sus estadísticas y progreso de manera programática.

### Endpoint

```
https://duplino.github.io/UTN-Tracker/api/user.html?uid=<USER_ID>
```

### Parámetros

- `uid` (requerido): El ID único del usuario en Firebase. Este ID se puede obtener al iniciar sesión en la aplicación.

### Requisitos

- El perfil del usuario debe estar configurado como público (opción "Hacer mi perfil público" en la aplicación).
- Solo los perfiles públicos retornarán datos; los perfiles privados retornarán un mensaje de error.

### Formato de respuesta

La API retorna un objeto JSON con la siguiente estructura:

```json
{
  "uid": "string",
  "plan": "string",
  "yearStarted": "number",
  "subjectData": {
    "<codigo_materia>": {
      "values": {},
      "status": "string",
      "overrideStatus": "string",
      "savedAt": "string"
    }
  },
  "electives": {},
  "selectedStats": [],
  "stats": {
    "totalSubjects": 0,
    "approvedSubjects": 0,
    "promotedSubjects": 0,
    "regularizedSubjects": 0,
    "inProgressSubjects": 0,
    "weeklyHours": 0,
    "averageGrade": 0
  },
  "public": true
}
```

### Campos de respuesta

- **uid**: ID único del usuario
- **plan**: Plan de estudios seleccionado (ej: "k23", "k23medio")
- **yearStarted**: Año de inicio de la carrera
- **subjectData**: Objeto con los datos de cada materia (parciales, finales, estado)
- **electives**: Electivas colocadas en el tablero
- **selectedStats**: Estadísticas seleccionadas para mostrar
- **stats**: Estadísticas calculadas automáticamente:
  - `totalSubjects`: Total de materias en el plan
  - `approvedSubjects`: Materias aprobadas
  - `promotedSubjects`: Materias promocionadas
  - `regularizedSubjects`: Materias regularizadas
  - `inProgressSubjects`: Materias en curso
  - `weeklyHours`: Horas semanales de materias en curso
  - `averageGrade`: Promedio de notas de materias aprobadas/promocionadas
- **public**: Siempre `true` si se retornan datos

### Mensajes de error

Si el perfil no existe, no es público, o hay un error, la API retorna un objeto con los campos `error` y `message`:

```json
{
  "error": "Private profile",
  "message": "This profile is not public"
}
```

Posibles errores:
- **Missing uid parameter**: No se proporcionó el parámetro `uid`
- **User not found**: El usuario no existe
- **Private profile**: El perfil no es público
- **Server error**: Error al cargar los datos

### Ejemplo de uso

```javascript
// Obtener datos de un usuario público
fetch('https://duplino.github.io/UTN-Tracker/api/user.html?uid=ABC123')
  .then(response => response.json())
  .then(data => {
    if (data.error) {
      console.error('Error:', data.message);
    } else {
      console.log('Promedio:', data.stats.averageGrade);
      console.log('Materias aprobadas:', data.stats.approvedSubjects);
    }
  });
```

---

## Formato del archivo del plan (`assets/data/k23.json`)

El archivo principal es un JSON con al menos la propiedad `modules` que es un arreglo de módulos. Cada módulo tiene la forma:

- id: string (identificador único del módulo — por ejemplo `g1`, `electives`)
- name: string (nombre que se muestra en el encabezado de la columna)
- render: boolean (opcional) — si `false` el módulo no se crea como columna en el tablero (útil para módulos de datos, ej. electivas)
- electivas: number (opcional) — número de placeholders (`+`) que se muestran en la columna para insertar electivas
- subjects: array de subjects

Ejemplo mínimo de módulo:

```json
{
	"id": "g1",
	"name": "Primer año",
	"render": true,
	"electivas": 0,
	"subjects": [ /* lista de materias */ ]
}
```

### Formato de cada materia (subject)

Cada materia es un objeto con al menos los campos siguientes (se permiten campos adicionales):

- code: string — código único de materia (p. ej. "ASI")
- name: string — nombre para mostrar
- weekHours: number — horas semanales (si no está, la app usa 6 por defecto)
- requirements: object — describe correlativas, con opciones:
	- cursar: array — requisitos para cursar (pueden ser strings con códigos o objetos { id, type })
	- aprobar: array — requisitos para aprobar (mismo formato)
- (opcional) cualquier metadato adicional: color, group, etc.

Ejemplo de subject:

```json
{
	"code": "ASI",
	"name": "Análisis de Sistemas de Información",
	"weekHours": 6,
	"requirements": {
		"cursar": [{ "id": "AyED", "type": "regularizada" }],
		"aprobar": [ { "id": "AyED", "type": "aprobada" } ]
	}
}
```

Notas:
- Para requisitos de tipo `regularizada` la aplicación acepta estados `Regularizada`, `Aprobada` o `Promocionada` como cumplidores.
- El módulo con `id: "electives"` o cualquier módulo con `render:false` y `subjects` es el lugar donde la app buscará la lista de electivas.

---

## Persistencia: ¿dónde se guarda la información y qué contiene?

La aplicación es completamente cliente-side y persiste datos en `localStorage` del navegador.

- `subjectData:<CODE>` — clave por materia (ej. `subjectData:ASI`). Valor: JSON con forma aproximada:

```json
{
	"values": { "parcial1_1": "7", "parcial2_1": "6", "final1": "8" },
	"status": "Aprobada",           // estado calculado al guardar
	"overrideStatus": "Aprobada",  // opcional, si el usuario forzó el estado con override
	"savedAt": "2025-11-23T12:34:56.789Z"
}
```

	- `values` almacena los inputs del modal (parciales y finales).
	- `status` es el estado resultante calculado al guardar. Puede faltar si el usuario creó el objeto por el botón "Empezar".
	- `overrideStatus` si el usuario forzó un estado desde el select de override.

- `electives` — mapa de electivas colocadas en el tablero. Estructura:

```json
{
	"ELEC1": { "colIndex": 2 },
	"Electiva sin código": { "colIndex": 4 }
}
```

	- La clave es el `code` o `name` de la electiva. El valor indica la columna donde fue colocada. Al restaurar el tablero, la app usa `electivasList` (desde el plan) para obtener metadatos.

- `mostrarCorrelativas` — guarda la preferencia del toggle (cadena `'1'` para true, `'0'` para false).

Otras claves temporales se pueden usar, pero las anteriores son las principales que afectan persistencia visible.

---

## Reglas importantes de cálculo (resumen)

- Promocionada: si ambos primeros parciales >= 8 (o según recuperatorios) — la nota mostrada en badge se calcula como el promedio de los últimos parciales y se redondea.
- Aprobada: si hay un final con nota >=6. La nota mostrada en badge es la nota del final en el que la materia fue aprobada (primer final >=6 en orden).
- Regularizada: si cumple criterio de regularización en parciales → no se muestra badge (decisión UX actual).
- Faltan notas / No regularizada / Desaprobada: comportamiento visual distinto; la app evita mostrar badge verde si no hay nota numérica almacenada.

---

## Estadísticas calculadas

- Horas semanales en curso: suma de `weekHours` de materias "en curso" (subjectData presente y estado no terminal: no Aprobada/Promocionada/Regularizada/Desaprobada).
- Promedio de aprobadas: promedio (dos decimales) de las notas consideradas para materias Aprobadas/Promocionadas según las reglas de nota arriba; materias sin nota numérica no se cuentan.
- Conteo aprobado/total y barra de progreso: las aprobadas incluyen `Aprobada` y `Promocionada`; el total incluye materias y el requerimiento de electivas por módulo.

---

## Ejemplos de edición rápida del plan

- Para agregar placeholders de electivas a un módulo, poner la propiedad `electivas: N` en el módulo.
- Para marcar que un módulo no se deba renderizar (solo contiene datos), usar `render: false`.


---

## Uso de inteligencia articial
Este proyecto usó fuertenemente la Inteligencia Artificial en su desarrollo con gran intervención humana también.