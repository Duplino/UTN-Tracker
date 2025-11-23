(**UTN-Tracker**)

Pequeña aplicación frontend para gestionar el progreso de materias (parciales, finales, estados) usando solo HTML, CSS y JavaScript. Los datos del usuario se guardan en `localStorage` por materia para persistencia local.

**Características**
- **Persistencia local:** guarda notas y estado por materia en `localStorage` (clave `subjectData:<CODE>`).
- **Modal de edición:** editar intentos de parciales y finales; cálculo automático de estado (Promocionada, Regularizada, Aprobada, No regularizada, Desaprobada, Faltan notas).
- **Requisitos y correlativas:** las materias se marcan como disponibles o deshabilitadas según correlativas; se dibujan flechas entre materias cuando se pasa el cursor.
- **Flujos de UX:** botón grande `Empezar` para iniciar una materia disponible; botón `Dar de baja`/`Recursar` para borrar progreso; override manual de estado desde el banner.
- **Visuales:** tarjetas con fondos tenues según estado, borde punteado para materias disponibles y animación para resaltar correlativas faltantes.

**Estructura del proyecto**
- `index.html` — página principal y modal para editar materias.
- `assets/css/index.css` — estilos personalizados y animaciones.
- `assets/js/index.js` — lógica principal: renderizado de tarjetas, modal, persistencia en `localStorage`, cálculo de estados y overlay de correlativas.
- `assets/data/subjects.json` — definición de materias, códigos y requisitos.
- `assets/data/userData.json` — (opcional) espejo en memoria del progreso del usuario.

**Instalación y ejecución (desarrollo local)**
- Abrir una terminal en la raíz del proyecto:

```bash
cd /path/to/UTN-Tracker
python3 -m http.server 8000
```

- Abrir `http://localhost:8000` en tu navegador.

Nota: el proyecto es solo frontend; `localStorage` se usa para guardar los progresos de cada materia.

**Cómo usar**
- Haz clic en una tarjeta de materia para abrir el modal y editar parciales/finales.
- Si la materia no cumple correlativas, la tarjeta aparecerá deshabilitada; al hacer clic en ella se resaltarán las materias que hacen falta.
- Usa el botón `Empezar` en materias disponibles para crear un registro inicial.
- Guarda los cambios en el modal para persistir en `localStorage`.

**Personalización y desarrollo**
- `assets/data/subjects.json` contiene la estructura de materias y sus requisitos. Modifica este archivo para ajustar el plan de estudios.
- Las reglas de negocio (qué significa `Regularizada`, `Promocionada`, umbrales de nota, intentos) están en `assets/js/index.js` — puedes adaptarlas según la normativa.

**Pruebas y comprobaciones**
- Prueba abrir/cerrar modal y verificar que los valores persisten.
- Revisa la consola del navegador para detectar errores (ej.: `computeStats` previamente contenía un carácter sobrante corregido).

**Contribuir**
- Haz un fork y abre pull requests con mejoras. Describe claramente los cambios y asegúrate de no romper la experiencia existente.

**Licencia**
- Proyecto de ejemplo / educativo. Añade licencia si lo vas a publicar.

---

Si querés, puedo:
- añadir un script de pruebas simples, o
- crear un `package.json` y tareas npm para servir y formatear el proyecto, o
- generar un pequeño checklist de pruebas manuales para validar flujos comunes.

Indica qué preferís y lo implemento.
