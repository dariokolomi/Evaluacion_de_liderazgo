"""Genera el informe de liderazgo usando MODELO_DE_INFORME_1.docx como base.

Si existe narrativa_generada.json (producido por narrativa_llm.py), las secciones
2a, 2b/2c y 3 se reemplazan con el texto generado por el LLM local.
De lo contrario se usa el texto estático incorporado en este script.
"""
from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from lxml import etree
import copy, json, os

# ── Cargar narrativa LLM si existe ────────────────────────────────────────
_NARRATIVA_FILE = "narrativa_generada.json"
_narrativa = {}
if os.path.exists(_NARRATIVA_FILE):
    with open(_NARRATIVA_FILE, encoding="utf-8") as _f:
        _narrativa = json.load(_f)
    print(f"[narrativa_llm] Usando texto generado por: {_narrativa.get('modelo','?')}")

def _llm(key):
    """Devuelve el texto LLM para una sección, o None si no existe."""
    return _narrativa.get(key)

def add_llm_paragraphs(doc, text, bold_colon=True):
    """Agrega párrafos desde texto LLM. Si la línea tiene 'Palabra — Nivel: texto',
    formatea la parte anterior a ':' en negrita."""
    for bloque in text.strip().split("\n\n"):
        bloque = bloque.strip()
        if not bloque:
            continue
        p = doc.add_paragraph()
        # Detectar patrón "Título — Nivel (Txx): resto"
        if bold_colon and ": " in bloque:
            titulo, _, resto = bloque.partition(": ")
            r = p.add_run(titulo + ": ")
            r.bold = True
            p.add_run(resto)
        else:
            p.add_run(bloque)

# Abrir el template como base (hereda estilos y configuración de página)
doc = Document("MODELO_DE_INFORME_1.docx")

# Limpiar todo el contenido del body manteniendo la sección de configuración
body = doc.element.body
# Eliminar todos los párrafos y tablas existentes
for child in list(body):
    tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
    if tag in ('p', 'tbl'):
        body.remove(child)

# Helpers
def shade_cell(cell, color_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), color_hex)
    tcPr.append(shd)

def bold_run(para, text, size=None, color=None, italic=False):
    r = para.add_run(text)
    r.bold = True
    if size:
        r.font.size = Pt(size)
    if color:
        r.font.color.rgb = color
    if italic:
        r.italic = True
    return r

def normal_run(para, text, size=None, italic=False):
    r = para.add_run(text)
    if size:
        r.font.size = Pt(size)
    r.italic = italic
    return r

def add_p(text="", bold=False, centered=False, size=None, italic=False):
    p = doc.add_paragraph()
    if centered:
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if text:
        r = p.add_run(text)
        r.bold = bold
        r.italic = italic
        if size:
            r.font.size = Pt(size)
    return p

def table_header(t, headers, fill="2E5496"):
    hdr = t.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = h
        shade_cell(hdr[i], fill)
        run = hdr[i].paragraphs[0].runs[0]
        run.bold = True
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        run.font.size = Pt(10)

def set_cell_text(cell, text, bold=False, size=10):
    cell.text = text
    if cell.paragraphs[0].runs:
        r = cell.paragraphs[0].runs[0]
        r.bold = bold
        r.font.size = Pt(size)

# ═══════════════════════════════════════════════════════
# PORTADA / TÍTULO
# ═══════════════════════════════════════════════════════
p = doc.add_paragraph()
r = p.add_run("INFORME: ")
r.bold = True
r.font.size = Pt(14)
r = p.add_run("Nombre y Apellido")
r.bold = True
r.font.size = Pt(14)
r.font.color.rgb = RGBColor(0x2E, 0x54, 0x96)

# Fecha y datos del evaluado (tabla simple)
t_datos = doc.add_table(rows=3, cols=2)
t_datos.style = "Normal Table"
datos = [
    ("Fecha de Evaluación", "16/04/2026"),
    ("Instrumentos administrados", "NEO-FFI · CELID-A · POTENLID · CAMIN-A · CONLID-A"),
    ("Profesional evaluador", "—"),
]
for i, (k, v) in enumerate(datos):
    set_cell_text(t_datos.rows[i].cells[0], k, bold=True)
    shade_cell(t_datos.rows[i].cells[0], "DCE6F1")
    set_cell_text(t_datos.rows[i].cells[1], v)

doc.add_paragraph()

# ═══════════════════════════════════════════════════════
# 1. DATOS CUANTITATIVOS
# ═══════════════════════════════════════════════════════
add_p("1. DATOS CUANTITATIVOS.", bold=True, centered=True, size=13)
add_p("Resultado cuantitativo de todos los test.", bold=True)

# ── 1a. NEO-FFI ──
add_p("Perfil de Personalidad (NEO-FFI)", bold=True)

t = doc.add_table(rows=6, cols=4)
t.style = "Normal Table"
table_header(t, ["Dimensión", "Puntaje Directo / T", "Nivel", "Interpretación Tendencial"])

neo_data = [
    ("Neuroticismo (N)",    "PD=7  |  T=39",  "Bajo",
     "Persona emocionalmente estable, tranquila y resistente al estrés. Tolera bien la presión laboral, rara vez se muestra ansiosa o desbordada. Este perfil es una fortaleza clave para el rol de conducción en escenarios de alta demanda."),
    ("Extraversión (E)",    "PD=41  |  T=64", "Alto",
     "Persona sociable, enérgica y con facilidad para entablar vínculos. Disfruta del trato interpersonal, del trabajo en equipo y de asumir un rol protagónico. Rasgo central para liderar."),
    ("Apertura (O)",        "PD=37  |  T=64", "Alto",
     "Curiosidad intelectual, creatividad y receptividad hacia nuevas ideas. Tiende a cuestionar lo establecido y buscar oportunidades de innovación. Rasgo potente para liderar procesos de cambio."),
    ("Amabilidad (A)",      "PD=24  |  T=37", "Bajo",
     "Perfil más pragmático y competitivo. Directo, crítico y con capacidad de sostener posiciones sin ceder por presión social. Debe atender el riesgo de que la asertividad se perciba como frialdad."),
    ("Responsabilidad (C)", "PD=37  |  T=53", "Promedio",
     "Nivel adecuado de organización y orientación al logro. Disciplinada cuando la tarea lo requiere, sin rasgos de rigidez perfeccionista. Flexible para adaptarse a imprevistos."),
]
for i, (dim, pd_t, nivel, interp) in enumerate(neo_data, start=1):
    set_cell_text(t.rows[i].cells[0], dim, bold=True)
    set_cell_text(t.rows[i].cells[1], pd_t)
    set_cell_text(t.rows[i].cells[2], nivel, bold=True)
    set_cell_text(t.rows[i].cells[3], interp)
    if nivel == "Alto":
        shade_cell(t.rows[i].cells[2], "E2EFDA")
    elif nivel == "Bajo":
        shade_cell(t.rows[i].cells[2], "FCE4D6")

doc.add_paragraph()

# ── 1b. CELID-A ──
p = doc.add_paragraph()
bold_run(p, "CELID-A:", size=11)
normal_run(p, "  Cuestionario de Estilos de Liderazgo")

t = doc.add_table(rows=10, cols=4)
t.style = "Normal Table"
table_header(t, ["Dimensión", "Media", "Percentil", "Nivel"])

celid_data = [
    ("Carisma (Transformacional)",     "3.75", "P25",  "Medio"),
    ("Estimulación Intelectual",       "4.57", "P75",  "Alto"),
    ("Inspiración",                    "3.67", "P50",  "Medio"),
    ("Consideración Individualizada",  "5.00", "P99",  "Alto"),
    ("TRANSFORMACIONAL – Total",       "4.29", "P75+", "Alto"),
    ("Recompensa Contingente",         "3.20", "P40",  "Medio"),
    ("Dirección por Excepción",        "3.67", "P65",  "Medio"),
    ("TRANSACCIONAL – Total",          "3.45", "P55",  "Medio"),
    ("LAISSEZ-FAIRE",                  "1.83", "P25",  "Medio-Bajo"),
]
for i, (dim, media, perc, nivel) in enumerate(celid_data, start=1):
    is_total = "Total" in dim or "LAISSEZ" in dim
    set_cell_text(t.rows[i].cells[0], dim, bold=is_total)
    set_cell_text(t.rows[i].cells[1], media)
    set_cell_text(t.rows[i].cells[2], perc)
    set_cell_text(t.rows[i].cells[3], nivel, bold=is_total)
    if is_total:
        for c in t.rows[i].cells:
            shade_cell(c, "DCE6F1")

doc.add_paragraph()

# ── 1c. CAMIN-A ──
p = doc.add_paragraph()
bold_run(p, "CAMIN-A:", size=11)
normal_run(p, "  Cuestionario de Liderazgo Camino-Meta")

t = doc.add_table(rows=5, cols=4)
t.style = "Normal Table"
table_header(t, ["Estilo", "Puntaje Directo", "Percentil", "Nivel"])
cam_data = [
    ("Liderazgo Directivo",              "19", "P75", "Alto"),
    ("Liderazgo Considerado (Apoyo)",    "18", "P62", "Medio"),
    ("Liderazgo Participativo",          "20", "P90", "Alto"),
    ("Liderazgo Orientado a Metas",      "16", "P62", "Medio"),
]
for i, row in enumerate(cam_data, start=1):
    for j, val in enumerate(row):
        set_cell_text(t.rows[i].cells[j], val, bold=(j == 0))
    if row[3] == "Alto":
        shade_cell(t.rows[i].cells[3], "E2EFDA")

doc.add_paragraph()

# ── 1d. POTENLID ──
p = doc.add_paragraph()
bold_run(p, "PONTELID-A:", size=11)
normal_run(p, "  Cuestionario de Potencial de Liderazgo – Motivación")

t = doc.add_table(rows=4, cols=4)
t.style = "Normal Table"
table_header(t, ["Dimensión", "Puntaje Directo", "Percentil", "Nivel"])
poten_data = [
    ("Motivación Intrínseca",        "14", "P75",  "Alto"),
    ("Motivación Extrínseca",        "10", "P75+", "Alto"),
    ("Motivación Social Normativa",  "3",  "P5",   "Muy Bajo"),
]
for i, row in enumerate(poten_data, start=1):
    for j, val in enumerate(row):
        set_cell_text(t.rows[i].cells[j], val, bold=(j == 0))
    if row[3] == "Alto":
        shade_cell(t.rows[i].cells[3], "E2EFDA")
    elif row[3] == "Muy Bajo":
        shade_cell(t.rows[i].cells[3], "FCE4D6")

doc.add_paragraph()

# ── 1e. CONLID-A ──
p = doc.add_paragraph()
bold_run(p, "CONLID-A:", size=11)
normal_run(p, "  Cuestionario de Conductas de Liderazgo")

t = doc.add_table(rows=4, cols=4)
t.style = "Normal Table"
table_header(t, ["Categoría conductual", "Puntaje Directo", "Percentil", "Nivel"])
con_data = [
    ("Orientadas a la Tarea",      "24", "P50", "Medio"),
    ("Orientadas a las Relaciones", "27", "P65", "Medio"),
    ("Orientadas al Cambio",        "25", "P80", "Alto"),
]
for i, row in enumerate(con_data, start=1):
    for j, val in enumerate(row):
        set_cell_text(t.rows[i].cells[j], val, bold=(j == 0))
    if row[3] == "Alto":
        shade_cell(t.rows[i].cells[3], "E2EFDA")

doc.add_page_break()

# ═══════════════════════════════════════════════════════
# 2. RESULTADOS CUALITATIVOS
# ═══════════════════════════════════════════════════════
add_p("2. Resultados Cualitativos", bold=True, centered=True, size=13)

# ── 2a. NEO – descripción de los 5 factores ──
add_p("Neo- descripción de los 5 factores de la personalidad registrados por el evaluado.", bold=True)

_neo_llm = _llm("neo")
if _neo_llm:
    add_llm_paragraphs(doc, _neo_llm)
else:
    neo_desc = [
        ("Neuroticismo — Bajo (T=39)",
         "Persona emocionalmente estable, tranquila y resistente al estrés. Tolera bien la presión laboral, rara vez se muestra ansiosa o desbordada. Presenta un locus de control interno, manteniendo la calma en situaciones complejas. Este perfil constituye una fortaleza para el rol de conducción, especialmente en escenarios de alta demanda."),
        ("Extraversión — Alto (T=64)",
         "Persona sociable, enérgica, activa y con facilidad para entablar vínculos. Disfruta del trato interpersonal, del trabajo en equipo y de asumir un rol protagónico. Muestra iniciativa, entusiasmo y capacidad para transmitir dinamismo a su entorno. Este rasgo es central en su potencial para liderar."),
        ("Apertura — Alto (T=64)",
         "Persona con curiosidad intelectual, creatividad y receptividad hacia nuevas ideas, enfoques y experiencias. Tiende a cuestionar lo establecido, valorar la diversidad de puntos de vista y buscar oportunidades de innovación. Es un rasgo potente para liderar procesos de cambio."),
        ("Amabilidad — Bajo (T=37)",
         "Perfil más pragmático, competitivo y orientado a resultados que a la armonía interpersonal. Puede mostrarse escéptico, directo, crítico, y eventualmente incisivo. Capaz de negociar con firmeza y de sostener posiciones sin ceder por presión social. Debe atender el riesgo de que la asertividad elevada se perciba como frialdad por los colaboradores."),
        ("Responsabilidad — Promedio (T=53)",
         "Nivel adecuado de organización, planificación y orientación al logro. Disciplinada y eficiente cuando la tarea lo requiere, sin exhibir rasgos de rigidez perfeccionista. Conserva flexibilidad para adaptarse a imprevistos. Compatible con un perfil de conducción efectiva."),
    ]
    for titulo, descripcion in neo_desc:
        p = doc.add_paragraph()
        bold_run(p, titulo + ": ")
        normal_run(p, descripcion)

doc.add_paragraph()

# ── 2b. Estilos de Liderazgo (CELID-A) ──
p = doc.add_paragraph()
bold_run(p, "\nEstilos de Liderazgo (CELID-A)", size=11)

_celid_llm = _llm("celid")
if _celid_llm:
    add_llm_paragraphs(doc, _celid_llm, bold_colon=False)
else:
    add_p("La persona evaluada demuestra una clara inclinación hacia un estilo de liderazgo Transformacional (4.29 / P>75), con Transaccional de apoyo (3.45 / P55) y presencia muy baja de Laissez-Faire (1.83 / P25).")

    p = doc.add_paragraph()
    bold_run(p, "Liderazgo Transformacional : ")
    normal_run(p, "Alto. Logra puntuaciones destacadas en Consideración Individualizada (5.00 / P99) y Estimulación Intelectual (4.57 / P75), indicando un líder que presta atención personalizada al desarrollo de cada colaborador e impulsa el pensamiento analítico. El Carisma (P25) y la Inspiración (P50) aparecen más moderados: el componente de generar un relato inspirador y entusiasmo colectivo es un área de crecimiento.")

    p = doc.add_paragraph()
    bold_run(p, "Liderazgo Transaccional : ")
    normal_run(p, "Medio. La Dirección por Excepción (P65) es levemente superior a la Recompensa Contingente (P40), sugiriendo que interviene más ante desvíos que premiando sistemáticamente el desempeño esperado. Hay espacio para fortalecer el reconocimiento contingente como herramienta motivacional.")

    p = doc.add_paragraph()
    bold_run(p, "Liderazgo Laissez-Faire : ")
    normal_run(p, "Bajo. La ausencia de conductas evitativas es una fortaleza central: el evaluado se involucra, decide, está disponible y asume responsabilidad.")

doc.add_paragraph()

# ── 2c. Motivación y Conductas ──
add_p("Motivación y Conductas de Liderazgo (POTENLID, CAMIN-A, CONLID-A)", bold=True)

_motiv_llm = _llm("motivacion")
if _motiv_llm:
    add_llm_paragraphs(doc, _motiv_llm, bold_colon=False)
else:
    p = doc.add_paragraph()
    bold_run(p, "Potencial de Liderazgo (POTENLID): ")
    normal_run(p, "Alta Motivación Intrínseca (P75) y alta Motivación Extrínseca (P75+): disfruta del rol de liderazgo por vocación y también valora los beneficios materiales y simbólicos. Motivación Social Normativa muy baja (P5): no asume el liderazgo por mandato o deber externo, sino por elección personal. Este perfil indica una vocación auténtica con marcado pragmatismo.")

    doc.add_paragraph()
    add_p("Estilo de Camino-Meta (CAMIN-A)", bold=True)

    p = doc.add_paragraph()
    bold_run(p, "Conducta de Apoyo : ")
    normal_run(p, "Liderazgo Considerado – Medio (P62). Presta atención al bienestar de los colaboradores, aunque no es el eje de su estilo. Puede profundizar el rol de contención emocional en situaciones que lo requieran.")

    p = doc.add_paragraph()
    bold_run(p, "Conducta Participativa : ")
    normal_run(p, "Liderazgo Participativo – Alto (P90). Es el estilo dominante: consulta, escucha e involucra activamente a los colaboradores en las decisiones. Genera alto sentido de pertenencia y compromiso.")

    p = doc.add_paragraph()
    bold_run(p, "Conducta Directiva : ")
    normal_run(p, "Liderazgo Directivo – Alto (P75). Comunica con claridad qué se espera y cómo ejecutar las tareas. Complementa bien el estilo participativo al dar estructura cuando es necesario. Liderazgo Orientado a Metas en nivel Medio (P62): hay margen para incrementar la presión positiva al rendimiento superior.")

    p = doc.add_paragraph()
    bold_run(p, "En cuanto a CONLID-A: ")
    normal_run(p, "Distribución equilibrada con acento en Conductas Orientadas al Cambio (P80): propone nuevas estrategias, construye equipos para implementar cambios y genera alianzas. Las Conductas de Relaciones (P65) y de Tarea (P50) están más niveladas; el monitoreo sistemático y la definición explícita de estándares son zonas de desarrollo para consolidar el rol.")

doc.add_page_break()

# ═══════════════════════════════════════════════════════
# 3. PERFIL INTEGRADO Y ANÁLISIS SITUACIONAL
# ═══════════════════════════════════════════════════════
add_p("3. Perfil Integrado y Análisis Situacional", bold=True, centered=True, size=13)

_perfil_llm = _llm("perfil")
if _perfil_llm:
    add_llm_paragraphs(doc, _perfil_llm, bold_colon=False)
else:
    add_p("Integrando las cinco pruebas, el evaluado configura un perfil de Líder Transformacional con fuerte orientación al Cambio y la Participación, sostenido por una base de estabilidad emocional (N bajo), extroversión marcada (E alto) y apertura intelectual (O alto). Su combinación de alta Motivación Intrínseca + Extrínseca define a un líder que disfruta del rol y lo ejerce con convicción, evaluando pragmáticamente los costos/beneficios de asumirlo.")

    doc.add_paragraph()

    add_p("El bajo nivel de Amabilidad (A=37) es el hallazgo más distintivo del perfil: convive con un elevado Liderazgo Participativo (P90) y una excepcional Consideración Individualizada (P99). El evaluado se vincula con sus colaboradores desde la atención a su desarrollo y la escucha, pero desde un encuadre competitivo, directo y de baja complacencia social. No es un líder 'afectivo' en sentido clásico: invierte en su gente como estrategia de desempeño y puede resultar exigente o incisivo. Esta configuración funciona especialmente bien con colaboradores maduros y tolerantes al feedback directo.")

    doc.add_paragraph()

    add_p("En términos del modelo Situacional (Hersey & Blanchard) y Camino-Meta (House), el evaluado dispone ya de dos estilos con alta soltura (Participativo y Directivo) y debe desarrollar los otros dos (Apoyo/Considerado y Orientado a Metas) para completar el repertorio flexible del líder situacional.")

doc.add_paragraph()

# Tabla de recomendaciones de desarrollo
add_p("Proyección hacia el Liderazgo Situacional — Competencias a desarrollar:", bold=True)
doc.add_paragraph()

t = doc.add_table(rows=6, cols=3)
t.style = "Normal Table"
table_header(t, ["Competencia a desarrollar", "Fundamento (factor NEO)", "Acción de desarrollo sugerida"])

recs = [
    ("1. Fortalecer Carisma e Inspiración",
     "Alta Extraversión (T=64) y Apertura (T=64): materia prima del liderazgo carismático.",
     "Entrenamiento en storytelling y comunicación simbólica. Construir un relato del propósito del equipo, visión a 3 años, ritos colectivos. Trabajar el uso del lenguaje emocional como compensación natural de la baja Amabilidad."),
    ("2. Ampliar Recompensa Contingente",
     "Alta Motivación Extrínseca como puente cognitivo para reconocer que los colaboradores también responden a refuerzos claros.",
     "Sistema explícito de feedback positivo semanal. Anticipar y formalizar recompensas vinculadas al cumplimiento de metas. Pasar de la Dirección por Excepción al reconocimiento proactivo."),
    ("3. Desarrollar Estilo Considerado / Apoyo",
     "Compensar la baja Amabilidad (T=37). La competencia que más tensión genera con el perfil de personalidad.",
     "Formación en Escucha Activa y Coaching ejecutivo. Verbalizar apoyo emocional, reducir la intensidad del sarcasmo. Solicitar feedback 360° para calibrar el impacto percibido del estilo directo."),
    ("4. Reforzar Orientado a Metas y Conductas de Tarea",
     "Responsabilidad Promedio (T=53): base suficiente, pero el rol exige sistematizar. La baja Amabilidad es aliada para sostener estándares sin ceder.",
     "Implementar rutinas de seguimiento (tableros de indicadores, 1:1 quincenales). Definir estándares de calidad explícitos. Capacitarse en OKRs / gestión por objetivos."),
    ("5. Gestionar el impacto de la baja Amabilidad",
     "Rasgo estable de personalidad: no se elimina, se gestiona. El bajo Neuroticismo permite autorregulación efectiva.",
     "Incorporar pausa reflexiva antes de emitir críticas. Técnica SBI (Situación-Conducta-Impacto). Identificar colaboradores sensibles y ajustar el registro comunicacional a su perfil."),
]
for i, (comp, fund, acc) in enumerate(recs, start=1):
    set_cell_text(t.rows[i].cells[0], comp, bold=True)
    set_cell_text(t.rows[i].cells[1], fund)
    set_cell_text(t.rows[i].cells[2], acc)

doc.add_page_break()

# ═══════════════════════════════════════════════════════
# 4. GRÁFICO DE COHERENCIA PERSONALIDAD VS CONDUCTAS
# ═══════════════════════════════════════════════════════
p = doc.add_paragraph()
bold_run(p, "4. GRÁFICO DE COHERENCIA PERSONALIDAD VS CONDUCTAS DE LIDERAZGO.", size=13)

add_p("El siguiente gráfico contrasta el perfil actual del evaluado con el perfil ideal de un Líder Situacional. Las zonas donde la línea del evaluado (naranja) se acerca al ideal (azul) representan fortalezas consolidadas; las zonas con mayor distancia indican brechas de desarrollo.", italic=True, size=10)

doc.add_paragraph()
doc.add_picture("grafico_radar.png", width=Inches(6.0))

doc.add_paragraph()

add_p("Lectura del mapa:", bold=True)
add_p("Fortalezas consolidadas: Consideración Individualizada, Liderazgo Participativo, Motivación Intrínseca y Conductas Orientadas al Cambio.")
add_p("Brechas principales: Carisma (P25 vs. ideal P90), Inspiración (P50 vs. P90) y Recompensa Contingente (P40 vs. P75).")
add_p("Brechas moderadas: Conductas de Tarea y Conductas de Relaciones (P50-P65 vs. P85 esperado).")

doc.add_page_break()

# ═══════════════════════════════════════════════════════
# MARCO DE REFERENCIA TEÓRICO (Heading 3 — igual que el template)
# ═══════════════════════════════════════════════════════
h = doc.add_heading("Marco de referencia teórico.", level=3)

marco = [
    ("1. Inteligencia Emocional y Empatía",
     "Es la capacidad de percibir, comprender y gestionar las emociones propias y las del equipo. En un entorno de alta presión, la validación del bienestar del colaborador es clave para la retención.",
     "Liderazgo Afiliativo. Se centra en crear armonía y construir vínculos emocionales fuertes. Es el 'pegamento' que mantiene unido al equipo en tiempos de crisis.",
     "Dada la baja Amabilidad (T=37), esta competencia requiere desarrollo consciente. Su alta Extraversión y Consideración Individualizada (P99) son el punto de partida."),
    ("2. Visión Estratégica y Adaptabilidad",
     "No basta con gestionar el presente; hay que anticipar el futuro. El mercado valora líderes que puedan pivotar rápidamente ante cambios tecnológicos sin perder de vista los objetivos a largo plazo.",
     "Liderazgo Visionario (o Orientativo). Inspira a las personas hacia un sueño compartido y explica el 'porqué' detrás de cada cambio, otorgando autonomía sobre el 'cómo'.",
     "La alta Apertura (T=64) y las Conductas Orientadas al Cambio (P80) lo posicionan bien para esta competencia. Fortalecer la Inspiración ampliará el impacto."),
    ("3. Coaching y Desarrollo de Talento",
     "Un líder moderno es evaluado por cuánto crecen sus subordinados. La capacidad de identificar el potencial de otros y delegar responsabilidades críticas es fundamental.",
     "Liderazgo Coach. Se enfoca más en el desarrollo personal de los colaboradores que en las tareas inmediatas. Ayuda a conectar las metas personales con las de la organización.",
     "La Consideración Individualizada excepcional (P99) y el Liderazgo Participativo (P90) son bases sólidas. Incorporar herramientas de coaching formales potenciará esta fortaleza natural."),
    ("4. Comunicación Transparente y Escucha Activa",
     "En la era de la información, la opacidad genera desconfianza. El mercado demanda líderes que sepan escuchar antes de hablar y que comuniquen con claridad, incluso las malas noticias.",
     "Liderazgo Democrático (Participativo). Fomenta el consenso y la colaboración. Valora la opinión del equipo para la toma de decisiones, lo que aumenta el compromiso.",
     "Su estilo Participativo dominante (P90) ya lo ejercita. El área de desarrollo es calibrar la franqueza y la crítica directa (baja Amabilidad) para que no genere resistencias."),
    ("5. Resiliencia y Gestión del Cambio",
     "La capacidad de mantener la calma bajo presión y ver los errores como oportunidades de aprendizaje es una de las habilidades más difíciles de encontrar en líderes.",
     "Liderazgo Transformacional. Busca cambiar los sistemas y la cultura organizacional a través de la motivación y la inspiración, movilizando al equipo fuera de su zona de confort.",
     "El Neuroticismo Bajo (T=39) es una fortaleza excepcional para la resiliencia. Sus Conductas Orientadas al Cambio (P80) confirman que ya opera en este registro."),
]

for titulo, desc, estilo, relevancia in marco:
    h = doc.add_heading(titulo, level=3)
    p = doc.add_paragraph(style="Normal (Web)")
    p.add_run(desc)
    p = doc.add_paragraph(style="Normal (Web)")
    r = p.add_run("Estilo asociado: ")
    r.bold = True
    p.add_run(estilo)
    p = doc.add_paragraph(style="Normal (Web)")
    r = p.add_run("Relevancia para el evaluado: ")
    r.bold = True
    r.font.color.rgb = RGBColor(0x2E, 0x54, 0x96)
    p.add_run(relevancia)

doc.save("INFORME_LIDERAZGO.docx")
print("INFORME_LIDERAZGO.docx generado correctamente con formato MODELO_DE_INFORME_1")
