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

## Uso de inteligencia artificial

Este proyecto usó fuertemente inteligencia artificial en su desarrollo, con intervención humana también.
