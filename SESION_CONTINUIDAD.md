# Sesión de perfilamiento de liderazgo — Registro de continuidad

**Última actualización:** 2026-04-18
**Fecha original:** 2026-04-16
**Usuario:** gestionti@kolektor.com.ar
**Estado:** Informe generado. Página de documentación interactiva creada.

---

## 1. Objetivo de la tarea

Perfilar a un líder de la organización a partir de 5 cuestionarios estandarizados, aplicando claves y baremos provistos por el usuario, y devolver un informe siguiendo la plantilla `MODELO DE INFORME.docx` que incluya:

1. Resultados cuantitativos de cada prueba.
2. Análisis cualitativo de personalidad y perfil de liderazgo.
3. Mapa de competencias gráfico: evaluado vs. líder situacional.
4. Proyección de competencias a desarrollar, alineada a los factores de personalidad.

**Regla clave dada por el usuario:** usar las claves y baremos provistos, sin modificar la aplicación.

---

## 2. Materiales de entrada (carpeta `/home/coder/LIDER/fran/FRAN/`)

- `Planilla de Preguntas (1).xlsx` — instrumentos (NEO, CELID-A, POTENLID, CAMIN-A, CONLID-A).
- `Correccion, CAMIN-A.xlsx` — clave + baremos CAMIN-A.
- `Correccion, CELID A nueva versión.xlsx` — clave + baremos CELID-A.
- `Correccion, CONLID.xlsx` — clave + baremos CONLID-A.
- `Correccion, PONTELID.xlsx` — clave + baremos POTENLID.
- `Analisis Neo y SCL 90.xlsm` — contiene el baremo T-score NEO-FFI (hoja oculta "NEO Fii", filas 123-209, baremo Varones+Mujeres, Casullo & Pérez 2008).
- `MODELO DE INFORME.docx` — plantilla del informe.
- `Interpretacon NEO-pi-r.pdf` — material de interpretación NEO.
- `teoria-y-evaluacion-del-liderazgo.pdf` — marco teórico.

---

## 3. Respuestas del evaluado

Registradas en `respuestas_evaluado.md`:
- **NEO-FFI:** 60 ítems (a-e).
- **CELID-A:** 34 ítems (1-5).
- **POTENLID:** 9 ítems (1-5).
- **CAMIN-A:** 12 ítems (1-7).
- **CONLID-A:** 18 ítems (1-5).

---

## 4. Metodología de corrección

### 4.1 NEO-FFI
- Escala: a=0, b=1, c=2, d=3, e=4 (ítems inversos: a=4 … e=0).
- Clave estándar Costa & McCrae 1992 aplicada en `corregir.py`:
  - **N** (directos): 1, 11, 16, 21, 26, 31, 36, 51; **inversos**: 6, 41, 46, 56.
  - **E** (directos): 2, 7, 12, 22, 32, 47, 52; **inversos**: 17, 27, 37, 42, 57.
  - **O** (directos): 3, 13, 18, 28, 33, 48, 53; **inversos**: 8, 23, 38, 43, 58.
  - **A** (directos): 4, 24, 29, 39, 44, 49; **inversos**: 9, 14, 19, 34, 54, 59.
  - **C** (directos): 10, 15, 20, 25, 30, 35, 40, 45; **inversos**: 5, 50, 55, 60.
- Conversión PD → T usando baremo Varones+Mujeres (hoja "NEO Fii" del xlsm).
- Niveles: Muy Alto ≥66 · Alto 56-65 · Promedio 45-55 · Bajo 35-44 · Muy Bajo <35.

**Nota histórica:** en la primera versión del script había un error en la clave C (ítems 15 y 30 como inversos, y 60 como directo). Se corrigió en `corregir.py`. C raw pasó de 29 → 37; T de 39 → 53.

### 4.2 CELID-A (media por dimensión)
- Claves tomadas de `Correccion, CELID A nueva versión.xlsx`.
- Transformacional: Carisma (3,21,33,34), Estim.Intelectual (4,15,23,25,28,29,30), Inspiración (19,22,24), Consid.Individualizada (13,14,17).
- Transaccional: Rec.Contingente (8,10,11,12,16), Dir.Excepción (2,5,7,9,18,26).
- Laissez-Faire: 1,6,20,27,31,32.
- Percentiles según tabla de la hoja "Baremos". Niveles: Alto ≥P75, Medio P25-P75, Bajo ≤P25.

### 4.3 POTENLID (suma por dimensión)
- Intrínseca: 1,6,8 · Extrínseca: 2,4,7 · Social Normativa: 3,5,9.

### 4.4 CAMIN-A (suma por dimensión)
- Directivo: 1,5,9 · Considerado: 2,6,10 · Participativo: 3,7,11 · Orientado a Metas: 4,8,12.

### 4.5 CONLID-A (suma por dimensión, 6 ítems c/u)
- Tarea: 2,5,8,11,14,17 · Relaciones: 1,4,7,10,13,16 · Cambio: 3,6,9,12,15,18.

---

## 5. Resultados obtenidos

### NEO-FFI
| Dim | PD | T | Nivel |
|---|---|---|---|
| N | 7 | 39 | Bajo |
| E | 41 | 64 | Alto |
| O | 37 | 64 | Alto |
| A | 24 | 37 | Bajo |
| C | 37 | 53 | Promedio |

### CELID-A
| Dimensión | Media | P~ | Nivel |
|---|---|---|---|
| Carisma | 3.75 | P25 | Medio |
| Estim.Intelectual | 4.57 | P75 | Alto |
| Inspiración | 3.67 | P50 | Medio |
| Consid.Individualizada | 5.00 | P99 | Alto |
| **Transformacional Total** | **4.29** | **P75+** | **Alto** |
| Rec.Contingente | 3.20 | P40 | Medio |
| Dir.Excepción | 3.67 | P65 | Medio |
| **Transaccional Total** | **3.45** | **P55** | **Medio** |
| **Laissez-Faire** | **1.83** | **P25** | **Medio-Bajo** |

### POTENLID
| Dimensión | PD | P~ | Nivel |
|---|---|---|---|
| M.Intrínseca | 14 | P75 | Alto |
| M.Extrínseca | 10 | P75+ | Alto |
| M.Social Normativa | 3 | P5 | Muy Bajo |

### CAMIN-A
| Estilo | PD | P~ | Nivel |
|---|---|---|---|
| Directivo | 19 | P75 | Alto |
| Considerado | 18 | P62 | Medio |
| Participativo | 20 | P90 | Alto |
| Orientado a Metas | 16 | P62 | Medio |

### CONLID-A
| Categoría | PD | P~ | Nivel |
|---|---|---|---|
| Tarea | 24 | P50 | Medio |
| Relaciones | 27 | P65 | Medio |
| Cambio | 25 | P80 | Alto |

---

## 6. Síntesis cualitativa (lo que quedó en el informe)

- **Perfil:** Líder Transformacional con fuerte orientación al cambio y la participación.
- **Fortalezas naturales (NEO):** estabilidad emocional, extroversión activa, apertura intelectual.
- **Hallazgo distintivo:** baja Amabilidad (T=37) convive con altísima Consideración Individualizada (P99) y Liderazgo Participativo (P90). Lectura: invierte en su gente desde un encuadre directo, pragmático y competitivo; no es un líder "afectivo" en sentido clásico.
- **Perfil motivacional:** vocación auténtica (Intrínseca alta) + alto pragmatismo (Extrínseca alta) + ausencia de liderazgo por deber (Social Normativa muy baja).
- **Brechas principales vs. Líder Situacional ideal:** Carisma, Inspiración, Recompensa Contingente, Estilo Considerado/Apoyo.

---

## 7. Archivos producidos

| Archivo | Propósito |
|---|---|
| `respuestas_evaluado.md` | Registro de las respuestas cargadas para todos los instrumentos |
| `corregir.py` | Script de corrección con claves y baremos |
| `graficos.py` | Script de generación de gráficos (matplotlib) |
| `generar_informe.py` | Script de generación del docx final |
| `grafico_neo.png` | Barras horizontales T-scores NEO |
| `grafico_celid.png` | Barras de estilos CELID-A |
| `grafico_radar.png` | Mapa de competencias radar (evaluado vs. ideal) |
| `INFORME_LIDERAZGO.docx` | Informe final (portada + 5 secciones) |
| `SESION_CONTINUIDAD.md` | Este archivo — índice de sesión |

---

## 8. Para retomar

- Dependencias: `openpyxl`, `python-docx`, `matplotlib` (instaladas con `pip --break-system-packages`).
- Reproducir resultados: `python3 corregir.py && python3 graficos.py && python3 generar_informe.py`.
- Cambios probables durante la revisión del usuario:
  - Ajustes en la clave NEO si detecta otra versión oficial.
  - Ajustes en interpretación cualitativa o recomendaciones.
  - Posible personalización con nombre/datos del evaluado (hoy figuran como "—").
  - Aplicación a nuevos evaluados con la misma metodología → reutilizar `corregir.py` cambiando solo los diccionarios de respuestas.

---

## 9. Protocolo para nuevos evaluados (mismo caso de uso)

1. Usuario envía las 5 planillas una por una.
2. Cargar respuestas en `respuestas_evaluado.md` (o archivo equivalente por evaluado).
3. Actualizar diccionarios `neo_resp`, `celid`, `poten`, `cam`, `con` en `corregir.py`.
4. Correr los 3 scripts en orden.
5. Renombrar `INFORME_LIDERAZGO.docx` con identificación del evaluado.

---

## 10. Sesión 2026-04-18 — Página de documentación interactiva

**Tarea:** Crear una página HTML interactiva que explique qué es FRAN, cómo funciona y qué produce.

**Archivo generado:** `index.html` (raíz del proyecto)

### Contenido de la página

La página es un sitio de una sola página (SPA) autocontenida (HTML + CSS + JS inline, sin dependencias externas) con las siguientes secciones:

| Sección | Descripción |
|---|---|
| **Hero** | Presentación del sistema con estadísticas: 5 instrumentos, 133 ítems, 3 scripts, 3 gráficos, 5 secciones del informe |
| **¿Qué hace FRAN?** | 6 tarjetas: ingesta, corrección, visualización, informe Word, reproducibilidad, trazabilidad |
| **Flujo de trabajo** | Pipeline interactivo de 5 pasos; al hacer clic en cada paso se despliega código real del proyecto |
| **Los 5 instrumentos** | Acordeón con NEO-FFI, CELID-A, POTENLID, CAMIN-A, CONLID-A; incluye dimensiones, proceso de corrección y ejemplos |
| **Demo interactiva** | 4 pestañas: perfil NEO animado con barras, estilos CELID con barras, radar de competencias (canvas), estructura del informe Word |
| **Outputs** | 6 tarjetas describiendo cada archivo producido |
| **Stack técnico** | Lenguaje, librerías, formatos y tabla de archivos clave con tamaños |
| **Cómo usar** | Guía de 3 pasos para evaluar a un nuevo líder |

### Características técnicas de `index.html`

- Diseño dark mode (paleta coherente con GitHub Dark)
- Navegación fija con scroll suave
- Animaciones CSS (scroll reveal, barras animadas, gráfico radar en canvas)
- Totalmente autocontenida: sin frameworks, sin CDNs, sin imágenes externas
- Responsive (adaptada a mobile)
- Código real del proyecto incrustado en los bloques de código del flujo

### Para visualizar

Abrir `index.html` directamente en el navegador (doble clic o `file://`) — no requiere servidor.
