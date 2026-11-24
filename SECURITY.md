# Seguridad

## Reportar una vulnerabilidad

Si encontraste una vulnerabilidad en UTN-Tracker (en el código o en [utntracker.com.ar](https://utntracker.com.ar)), **no abras un issue público**.

Reportala en privado desde la pestaña [Security → Report a vulnerability](https://github.com/Duplino/UTN-Tracker/security/advisories/new) del repo. Incluí:

- Qué encontraste y dónde (endpoint, archivo o pantalla).
- Los pasos para reproducirlo.
- El impacto que creés que tiene.

Vas a recibir una respuesta lo antes posible. Te pedimos que no publiques el problema hasta que esté corregido.

## Qué no hacer

- No accedas, modifiques ni borres datos de otros usuarios. Para probar, usá tu propia cuenta o el entorno local (`docker-compose.dev.yml`, con login de prueba).
- No hagas pruebas de carga ni de denegación de servicio contra el sitio en producción.

## Versiones soportadas

Solo se mantiene la versión que está en `main`, que es la que corre en producción.
