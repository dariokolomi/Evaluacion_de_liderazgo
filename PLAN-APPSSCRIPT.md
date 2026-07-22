# Plan aprobado — Migración a Google Apps Script nativo

**Estado:** APROBADO por el usuario (gestionti@kolektor.com.ar) el 2026-07-22.
**Objetivo:** convertir el generador de informes de liderazgo en una aplicación
multiusuario dentro de Google Workspace, con autenticación por cuenta corporativa.

---

## 1. Decisión de arquitectura

**Elegido: Apps Script nativo + Drive + Sheets. Sin GCP, sin facturación, sin servidor.**

Alternativas evaluadas y descartadas:

| Opción | Motivo del descarte |
|---|---|
| Cloud Run + IAP | Rechazada por el usuario: demasiada infraestructura. Requiere proyecto GCP con facturación, Docker, Artifact Registry, despliegue. |
| App Engine Standard | Misma objeción: sigue necesitando proyecto GCP con facturación. |
| VM propia + oauth2-proxy | HTTPS, uptime, backups y actualizaciones quedan a cargo del usuario. |

**Por qué Apps Script gana:** desaparece la infraestructura entera. El multiusuario y
el SSO dejan de ser un problema a resolver y pasan a ser el comportamiento por defecto
de la plataforma. Costo cero dentro de la licencia Workspace ya contratada.

### Decisiones de producto ya tomadas

- **Auth:** SSO de Workspace, sin roles ni jerarquía dentro de la app.
- **Acceso:** restringido a un Grupo de Google (ej. `informes-rrhh@kolektor.com.ar`).
  Dentro del grupo, todos ven todo.
- **Almacenamiento:** Unidad compartida de Drive para los informes `.docx` +
  un Google Sheet para historial y calificaciones.
- **Gráfico radar:** la versión nativa de Sheets fue evaluada visualmente y
  **aceptada por el usuario** (ver sección 4).

---

## 2. Hallazgos del análisis del código actual

Estos hallazgos son los que hicieron viable la migración. No repetir el análisis.

1. **El `.docx` modelo NO es una plantilla.** `run_engine.py:234-239` abre el
   `MODELO DE INFORME.docx` y **borra todos sus párrafos y tablas**. Después construye
   el informe entero por código (~420 líneas). Del modelo solo sobreviven estilos,
   márgenes y encabezados. → No hay plantilla compleja que preservar.

2. **Una corrida tarda 1,1 segundos** (medido en `.runs_history.json`).
   El límite de ejecución de Apps Script (6 min) no se roza.

3. **Todo el formato usado tiene equivalente en `DocumentApp`:** sombreado de celdas
   (`setBackgroundColor`), negrita, tamaño de fuente, color, alineación, imagen
   incrustada. La preocupación inicial sobre la pobreza de la API era infundada.

4. **El motor es una función pura:**
   `run_informe(xlsx, modelo, output, radar, nombre, callback)`. Se porta como unidad.

5. **`narrativa_llm.py` está desconectado** del motor actual y apunta a Ollama en
   `localhost:11434`. Queda fuera del alcance de esta migración.

### Deudas del proyecto actual (arrastradas, decidir si se portan)

- `/download/<path:filename>` tiene **path traversal** (`app.py:307-312`):
  `os.path.join(BASE_DIR, filename)` sin sanitizar. Desaparece al migrar a Drive por ID.
- El filesystem funciona como base de datos: `/api/files` lista el directorio.
- `.runs_history.json` sin lock de escritura concurrente.

---

## 3. Alcance del port

| Pieza | Origen | Destino Apps Script | Riesgo |
|---|---|---|---|
| Corrección 5 instrumentos | `run_engine.py:16-193` | JS puro: aritmética + tablas lookup. Port 1:1. | Nulo |
| Lectura de planilla | `openpyxl` | Drive convierte `.xlsx` → Sheet; `SpreadsheetApp` lee. | Bajo |
| Armado del informe | `run_engine.py:234-653` | `DocumentApp` | Bajo (volumen) |
| Salida `.docx` | `python-docx` | Google Doc → export `.docx` vía Drive | Nulo |
| Login + grupo | *no existe* | `Session.getActiveUser()` + `GroupsApp` | Nulo |
| Drive + historial | archivos locales | Unidad compartida + Sheet | Nulo |
| **Gráfico radar** | `matplotlib` polar | **ver sección 4** | Medio |
| UI | `templates/index.html` + SSE | `HtmlService`; SSE no existe → spinner o polling | Bajo |

**Instrumentos:** NEO-FFI, CELID-A, POTENLID, CAMIN-A, CONLID-A.
Claves y baremos están hardcodeados en `run_engine.py` — se copian tal cual, sin
reinterpretar. Son datos validados, no inventar ni "mejorar".

---

## 4. Gráfico radar — resuelto

Se generó una comparación visual con datos inventados en `_comparativa_radar/`:

- `1_ACTUAL_matplotlib.png` — código exacto de `run_engine.py:211-230`.
- `2_SIMULACION_sheets.png` — simulación del tipo `RADAR` nativo de Sheets.

**Veredicto del usuario: "absolutamente aceptables".** Se va con el radar nativo de Sheets.

Pérdidas asumidas conscientemente:
1. **Sin relleno de área.** La brecha contra el perfil ideal deja de leerse de un
   vistazo; hay que comparar eje por eje.
2. Eje radial numérico (`20/40/60/80/100`) en lugar de percentiles (`P25/P50/P75/P99`).
3. Los números del eje se superponen con las líneas de datos.
4. Etiquetas de una línea y paleta Google en vez de azul/naranja institucional.

**Plan B si el relleno resulta innegociable más adelante:** dibujar el radar con la
API de Slides (polígonos con relleno translúcido) y exportar como PNG. Recupera
casi el gráfico actual, a costa de trabajo artesanal.

Datos usados en la comparación:
`evaluado = [62, 88, 45, 95, 70, 40, 55, 78, 52, 90, 63, 50, 68, 82]`
`ideal    = [90, 85, 90, 90, 85, 75, 70, 75, 80, 90, 85, 75, 85, 85]` (hardcodeado en el motor)

---

## 5. Pasos pendientes

### Bloqueante antes de empezar
- [ ] **Confirmar que el dominio permite crear proyectos de Apps Script.**
      Algunas organizaciones lo restringen por política de admin. Si está bloqueado,
      toda esta opción se cae y hay que volver a evaluar.
- [ ] Definir el nombre del Grupo de Google y crearlo si no existe.
- [ ] Crear la Unidad compartida de Drive para los informes.

### Implementación
- [ ] Port de la corrección de los 5 instrumentos (mecánico, sin sorpresas).
- [ ] Port del armado del documento con `DocumentApp`.
- [ ] Radar con `EmbeddedChartBuilder` tipo `RADAR` → insertar como imagen.
- [ ] Historial + calificaciones en Sheet.
- [ ] UI con `HtmlService` (adaptar `templates/index.html`, quitar SSE).
- [ ] Restricción de acceso por `GroupsApp` en `doGet`.

---

## 6. Reglas de trabajo acordadas

- El usuario prefiere **soluciones simples**. Rechazó explícitamente GCP,
  contenedores y pipelines de despliegue. No reintroducir infraestructura
  sin que la pida.
- Las claves y baremos psicométricos **no se tocan ni se reinterpretan**.
- Son datos personales sensibles de empleados: el acceso se controla por
  Workspace, no por lógica propia.
