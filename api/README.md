# UTN-Tracker API

This folder contains static JSON API endpoints for the UTN-Tracker application.

## Endpoints

### GET `/api/stats.json`

Returns information about all available statistics in the UTN-Tracker application.

**Response Structure:**

```json
{
  "metadata": {
    "version": "1.0",
    "description": "UTN-Tracker Statistics API - Returns available statistics and their definitions",
    "generatedAt": "2026-01-26T23:33:00Z"
  },
  "stats": [
    {
      "id": "horasSemanales",
      "name": "Horas semanales",
      "description": "Total weekly hours for subjects currently in progress",
      "unit": "hours",
      "category": "workload"
    }
    // ... more stats
  ],
  "config": {
    "maxStatsDisplayed": 5,
    "defaultWeekHours": 6,
    "defaultSelectedStats": ["horasSemanales", "promedio", ...]
  }
}
```

**Available Statistics:**

| ID | Name | Category | Description |
|----|------|----------|-------------|
| `horasSemanales` | Horas semanales | workload | Total weekly hours for subjects in progress |
| `promedio` | Promedio | performance | Average grade of approved subjects |
| `materiasAprobadas` | Materias aprobadas | progress | Number of approved subjects |
| `finalesPendientes` | Finales pendientes | progress | Number of pending final exams |
| `materiasCursables` | Materias que pueden cursarse | planning | Number of available subjects |
| `puedePromocionar` | Materias en condición de promoción | performance | Subjects eligible for promotion |
| `debeRecuperar` | Materias a recuperar | progress | Subjects requiring recovery exams |
| `desaprobadas` | Cantidad de materias desaprobadas | performance | Number of failed subjects |
| `aniosAntiguedad` | Años de antigüedad | planning | Years since starting the program |
| `pesoAcademico` | Peso académico | performance | Academic weight (calculated) |

**Usage Example:**

```javascript
// Fetch stats information
fetch('/api/stats.json')
  .then(response => response.json())
  .then(data => {
    console.log('Available stats:', data.stats.length);
    console.log('Default stats:', data.config.defaultSelectedStats);
  });
```

## Notes

- These are static JSON files served via GitHub Pages
- The actual computation of stats values is done client-side in the main application
- This endpoint provides metadata and definitions, not live calculated values
