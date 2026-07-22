"""Genera el informe de liderazgo para Quico usando MODELO_DE_INFORME_1.docx como base.
Lee las respuestas directamente de 'Planilla de Preguntas - Quico.xlsx' y
calcula todos los puntajes antes de construir el documento.
"""
import re, os, math
import openpyxl
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

XLSX = "Planilla de Preguntas - Quico.xlsx"
MODELO = "MODELO_DE_INFORME_1.docx"
OUTPUT = "INFORME_Quico.docx"
RADAR_FILE = "grafico_radar_Quico.png"

# ═══════════════════════════════════════════════════════
# 1. LECTURA Y CORRECCIÓN
# ═══════════════════════════════════════════════════════

wb = openpyxl.load_workbook(XLSX)

# ── NEO-FFI ──
ws = wb["NEO"]
neo_resp = {}
for row in ws.iter_rows(min_row=6, values_only=True):
    if row[0] and row[1]:
        m = re.match(r"^(\d+)\.", str(row[0]).strip())
        if m:
            neo_resp[int(m.group(1))] = str(row[1]).strip()[0].upper()

letter = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4}
neo_key = {
    "N": [("+",1),("-",6),("+",11),("+",16),("+",21),("+",26),("+",31),("+",36),("-",41),("-",46),("+",51),("-",56)],
    "E": [("+",2),("+",7),("+",12),("-",17),("+",22),("-",27),("+",32),("-",37),("-",42),("+",47),("+",52),("-",57)],
    "O": [("+",3),("-",8),("+",13),("+",18),("-",23),("+",28),("+",33),("-",38),("-",43),("+",48),("+",53),("-",58)],
    "A": [("+",4),("-",9),("-",14),("-",19),("+",24),("+",29),("-",34),("+",39),("+",44),("+",49),("-",54),("-",59)],
    "C": [("-",5),("+",10),("+",15),("+",20),("+",25),("+",30),("+",35),("+",40),("+",45),("-",50),("-",55),("-",60)],
}

def score_neo(dim):
    total = 0
    for sign, item in neo_key[dim]:
        val = letter[neo_resp[item]]
        if sign == "-":
            val = 4 - val
        total += val
    return total

neo_raw = {d: score_neo(d) for d in "NEOAC"}

neo_baremo = {
    "N": {0:25,1:30,2:32,3:34,4:35,5:36,6:38,7:39,8:41,9:42,10:44,11:46,12:47,13:49,14:50,
          15:51,16:53,17:54,18:55,19:56,20:58,21:59,22:60,23:61,24:62,25:63,26:64,27:65,28:66,29:67,30:68,31:69,32:70,33:71,34:72,35:73,36:75,37:75,38:75,39:75,40:75,41:75,42:75,43:75,44:75,45:75,46:75,47:75,48:75},
    "E": {13:25,14:25,15:26,16:27,17:29,18:30,19:31,20:32,21:33,22:35,23:37,24:38,25:39,26:41,27:42,28:44,29:45,30:47,31:48,32:50,
          33:51,34:53,35:54,36:56,37:55,38:56,39:61,40:63,41:64,42:66,43:68,44:70,45:72,46:75,47:75,48:75},
    "O": {11:25,12:28,13:29,14:30,15:31,16:33,17:34,18:36,19:37,20:38,21:39,22:41,23:42,24:44,25:45,26:47,27:48,28:50,
          29:51,30:53,31:54,32:56,33:57,34:59,35:61,36:62,37:64,38:65,39:67,40:69,41:71,42:72,43:73,44:75},
    "A": {16:25,17:26,18:27,19:29,20:30,21:32,22:33,23:36,24:37,25:38,26:39,27:40,28:42,29:44,30:46,31:48,32:50,
          33:53,34:55,35:58,36:57,37:59,38:61,39:62,40:64,41:65,42:67,43:68,44:70,45:72,46:74,47:75,48:75},
    "C": {16:25,17:26,18:26,19:27,20:28,21:29,22:30,23:32,24:33,25:34,26:35,27:37,28:38,29:39,30:40,31:42,32:44,33:46,34:47,35:50,
          36:51,37:53,38:54,39:56,40:57,41:59,42:61,43:62,44:65,45:67,46:69,47:72,48:75},
}
neo_t   = {d: neo_baremo[d].get(neo_raw[d], 50) for d in "NEOAC"}

def nivel_t(t):
    if t >= 66: return "Muy Alto"
    if t >= 56: return "Alto"
    if t >= 45: return "Promedio"
    if t >= 35: return "Bajo"
    return "Muy Bajo"

neo_niv = {d: nivel_t(neo_t[d]) for d in "NEOAC"}

# ── CELID-A ──
ws = wb["CELID-A"]
celid = {}
for row in ws.iter_rows(min_row=4, values_only=True):
    if row[0] is not None and isinstance(row[0], int) and row[3] is not None:
        celid[row[0]] = row[3]

def mean(items): return sum(celid[i] for i in items) / len(items)

carisma      = mean([3,21,33,34])
est_int      = mean([4,15,23,25,28,29,30])
inspir       = mean([19,22,24])
cons_ind     = mean([13,14,17])
transf_total = sum(celid[i] for i in [3,21,33,34,4,15,23,25,28,29,30,19,22,24,13,14,17]) / 17
rec_cont     = mean([8,10,11,12,16])
dir_exc      = mean([2,5,7,9,18,26])
trans_total  = sum(celid[i] for i in [8,10,11,12,16,2,5,7,9,18,26]) / 11
laissez      = mean([1,6,20,27,31,32])

celid_bar = {
    "Carisma":  [(99,5.00),(95,4.75),(90,4.75),(75,4.25),(50,4.00),(25,3.75),(10,3.23),(5,3.00)],
    "EstimInt": [(99,5.00),(95,4.86),(90,4.71),(75,4.43),(50,4.00),(25,3.43),(10,3.14),(5,2.94)],
    "Inspir":   [(99,5.00),(95,5.00),(90,4.67),(75,4.33),(50,3.67),(25,3.33),(10,3.00),(5,2.67)],
    "ConsInd":  [(99,5.00),(95,5.00),(90,5.00),(75,4.67),(50,4.00),(25,3.67),(10,3.33),(5,3.00)],
    "TransfTot":[(99,4.94),(95,4.70),(90,4.48),(75,4.20),(50,3.96),(25,3.65),(10,3.28),(5,3.20)],
    "RecCont":  [(99,4.80),(95,4.60),(90,4.40),(75,3.80),(50,3.40),(25,2.80),(10,2.40),(5,2.00)],
    "DirExc":   [(99,4.83),(95,4.50),(90,4.30),(75,3.83),(50,3.33),(25,3.00),(10,2.50),(5,2.33)],
    "TransTot": [(99,4.38),(95,4.25),(90,4.07),(75,3.72),(50,3.33),(25,3.00),(10,2.66),(5,2.34)],
    "Laissez":  [(99,4.20),(95,3.83),(90,3.33),(75,2.83),(50,2.33),(25,1.83),(10,1.67),(5,1.33)],
}

def percentil(valor, tabla):
    for p, c in tabla:
        if valor >= c: return p
    return 1

def nivel_pct(p):
    if p >= 75: return "Alto"
    if p >= 25: return "Medio"
    return "Bajo"

cel_p = {
    "Carisma":  percentil(carisma,      celid_bar["Carisma"]),
    "EstimInt": percentil(est_int,      celid_bar["EstimInt"]),
    "Inspir":   percentil(inspir,       celid_bar["Inspir"]),
    "ConsInd":  percentil(cons_ind,     celid_bar["ConsInd"]),
    "TransfTot":percentil(transf_total, celid_bar["TransfTot"]),
    "RecCont":  percentil(rec_cont,     celid_bar["RecCont"]),
    "DirExc":   percentil(dir_exc,      celid_bar["DirExc"]),
    "TransTot": percentil(trans_total,  celid_bar["TransTot"]),
    "Laissez":  percentil(laissez,      celid_bar["Laissez"]),
}

# ── POTENLID ──
ws = wb["POTENLID"]
poten = {}
for row in ws.iter_rows(min_row=3, values_only=True):
    if row[0] is not None and isinstance(row[0], int) and row[2] is not None:
        poten[row[0]] = row[2]

m_intr = poten[1] + poten[6] + poten[8]
m_extr = poten[2] + poten[4] + poten[7]
m_soc  = poten[3] + poten[5] + poten[9]

poten_bar = {
    "Intr": [(99,15),(95,15),(90,15),(75,13),(50,11),(25,9),(10,6),(5,5)],
    "Extr": [(99,15),(95,13),(90,11),(75,9),(50,6),(25,3),(10,3),(5,3)],
    "Soc":  [(99,15),(95,13),(90,12),(75,10),(50,8),(25,6),(10,5),(5,3)],
}
pot_p = {
    "Intr": percentil(m_intr, poten_bar["Intr"]),
    "Extr": percentil(m_extr, poten_bar["Extr"]),
    "Soc":  percentil(m_soc,  poten_bar["Soc"]),
}

# ── CAMIN-A ──
ws = wb["CAMIN-A"]
cam = {}
for row in ws.iter_rows(min_row=3, values_only=True):
    if row[0] is not None and isinstance(row[0], int) and row[2] is not None:
        cam[row[0]] = row[2]

directivo    = cam[1] + cam[5] + cam[9]
considerado  = cam[2] + cam[6] + cam[10]
participativo= cam[3] + cam[7] + cam[11]
orientado    = cam[4] + cam[8] + cam[12]

cam_bar = {
    "Dir":  [(99,21),(95,21),(90,21),(75,19),(50,18),(25,15),(10,12),(5,11)],
    "Cons": [(99,21),(95,21),(90,20),(75,19),(50,17),(25,15),(10,13),(5,12)],
    "Part": [(99,21),(95,21),(90,20),(75,18),(50,16),(25,13),(10,10),(5,9)],
    "Or":   [(99,21),(95,21),(90,19),(75,17),(50,15),(25,12),(10,10),(5,8)],
}
cam_p = {
    "Dir":  percentil(directivo,    cam_bar["Dir"]),
    "Cons": percentil(considerado,  cam_bar["Cons"]),
    "Part": percentil(participativo,cam_bar["Part"]),
    "Or":   percentil(orientado,    cam_bar["Or"]),
}

# ── CONLID-A ──
ws = wb["CONLID-A"]
con = {}
for row in ws.iter_rows(min_row=3, values_only=True):
    if row[0] is not None and isinstance(row[0], int) and row[2] is not None:
        con[row[0]] = row[2]

tarea = con[2]+con[5]+con[8]+con[11]+con[14]+con[17]
rel   = con[1]+con[4]+con[7]+con[10]+con[13]+con[16]
camb  = con[3]+con[6]+con[9]+con[12]+con[15]+con[18]

con_bar = {
    "Tar":  [(99,30),(95,30),(90,29),(75,27),(50,24),(25,22),(10,19),(5,17)],
    "Rel":  [(99,30),(95,30),(90,29),(75,28),(50,26),(25,24),(10,21),(5,19)],
    "Camb": [(99,30),(95,28),(90,26),(75,24),(50,21),(25,18),(10,16),(5,14)],
}
con_p = {
    "Tar":  percentil(tarea, con_bar["Tar"]),
    "Rel":  percentil(rel,   con_bar["Rel"]),
    "Camb": percentil(camb,  con_bar["Camb"]),
}

# ═══════════════════════════════════════════════════════
# 2. GRÁFICO RADAR
# ═══════════════════════════════════════════════════════

labels = [
    "Carisma", "Estim.\nIntelectual", "Inspiración", "Consid.\nIndiv.",
    "Laissez\n(inv.)", "Rec.\nContingente", "Dir. por\nExcepción",
    "Lid. Directivo", "Lid. Considerado", "Lid. Participativo",
    "Lid. a Metas", "Tarea", "Relaciones", "Cambio"
]

laissez_pct = cel_p["Laissez"]
laissez_inv = max(1, 100 - laissez_pct)

evaluado = [
    cel_p["Carisma"],
    cel_p["EstimInt"],
    cel_p["Inspir"],
    cel_p["ConsInd"],
    laissez_inv,
    cel_p["RecCont"],
    cel_p["DirExc"],
    cam_p["Dir"],
    cam_p["Cons"],
    cam_p["Part"],
    cam_p["Or"],
    con_p["Tar"],
    con_p["Rel"],
    con_p["Camb"],
]

ideal = [90, 85, 90, 90, 85, 75, 70, 75, 80, 90, 85, 75, 85, 85]

N = len(labels)
angles = np.linspace(0, 2 * np.pi, N, endpoint=False).tolist()
angles += angles[:1]

ev = [v/100 for v in evaluado] + [evaluado[0]/100]
id_ = [v/100 for v in ideal]   + [ideal[0]/100]

fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(polar=True))
ax.plot(angles, id_, "o-", linewidth=2, color="#2E5496", label="Perfil ideal")
ax.fill(angles, id_, alpha=0.10, color="#2E5496")
ax.plot(angles, ev, "o-", linewidth=2, color="#1E7B34", label="Quico")
ax.fill(angles, ev, alpha=0.15, color="#1E7B34")
ax.set_thetagrids(np.degrees(angles[:-1]), labels, fontsize=8)
ax.set_ylim(0, 1)
ax.set_yticks([0.25, 0.50, 0.75, 1.00])
ax.set_yticklabels(["P25", "P50", "P75", "P99"], fontsize=7)
ax.legend(loc="upper right", bbox_to_anchor=(1.25, 1.10))
ax.set_title("Coherencia Personalidad – Conductas de Liderazgo (Quico)", y=1.08, fontsize=11)
plt.tight_layout()
plt.savefig(RADAR_FILE, dpi=150, bbox_inches="tight")
plt.close()
print(f"Radar generado: {RADAR_FILE}")

# ═══════════════════════════════════════════════════════
# 3. CONSTRUCCIÓN DEL DOCUMENTO
# ═══════════════════════════════════════════════════════

doc = Document(MODELO)
body = doc.element.body
for child in list(body):
    tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
    if tag in ("p", "tbl"):
        body.remove(child)

# ── Helpers ──
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
    if size: r.font.size = Pt(size)
    if color: r.font.color.rgb = color
    if italic: r.italic = True
    return r

def normal_run(para, text, size=None, italic=False):
    r = para.add_run(text)
    if size: r.font.size = Pt(size)
    r.italic = italic
    return r

def add_p(text="", bold=False, centered=False, size=None, italic=False):
    p = doc.add_paragraph()
    if centered: p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if text:
        r = p.add_run(text)
        r.bold = bold
        r.italic = italic
        if size: r.font.size = Pt(size)
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

def color_nivel(nivel):
    if nivel in ("Alto", "Muy Alto"): return "E2EFDA"
    if nivel in ("Bajo", "Muy Bajo"): return "FCE4D6"
    return None

# ═══════════════════════════════════════════════════════
# PORTADA
# ═══════════════════════════════════════════════════════
p = doc.add_paragraph()
r = p.add_run("INFORME: ")
r.bold = True; r.font.size = Pt(14)
r = p.add_run("Quico")
r.bold = True; r.font.size = Pt(14)
r.font.color.rgb = RGBColor(0x2E, 0x54, 0x96)

t_datos = doc.add_table(rows=3, cols=2)
t_datos.style = "Normal Table"
datos = [
    ("Fecha de Evaluación",       "21/04/2026"),
    ("Instrumentos administrados","NEO-FFI · CELID-A · POTENLID · CAMIN-A · CONLID-A"),
    ("Profesional evaluador",     "—"),
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

neo_interp = {
    "N": (
        f"PD={neo_raw['N']}  |  T={neo_t['N']}",
        neo_niv["N"],
        "Persona emocionalmente muy estable. Maneja el estrés con solidez y mantiene la calma en situaciones de presión sostenida. Base fundamental para el ejercicio del liderazgo en entornos de alta demanda."
    ),
    "E": (
        f"PD={neo_raw['E']}  |  T={neo_t['E']}",
        neo_niv["E"],
        "Perfil equilibrado entre introversión y extraversión. No busca el protagonismo por sí mismo, pero sí la conexión genuina con el equipo. Reflexivo/a y selectivo/a en sus interacciones; genera un impacto de calidad sobre el grupo más que en cantidad de contactos."
    ),
    "O": (
        f"PD={neo_raw['O']}  |  T={neo_t['O']}",
        neo_niv["O"],
        "Alta apertura a nuevas experiencias, ideas y perspectivas. Curiosidad intelectual marcada, disposición al aprendizaje continuo y capacidad para moverse con comodidad en contextos de cambio. Fundamento del altísimo Carisma y la Estimulación Intelectual registrados."
    ),
    "A": (
        f"PD={neo_raw['A']}  |  T={neo_t['A']}",
        neo_niv["A"],
        "Alta orientación prosocial, empatía y disposición a la cooperación. Facilita vínculos de confianza, genera un clima de trabajo positivo y es percibido/a como accesible y justo/a por el equipo. Rasgo que sostiene el Liderazgo Considerado y el bajo Laissez-Faire."
    ),
    "C": (
        f"PD={neo_raw['C']}  |  T={neo_t['C']}",
        neo_niv["C"],
        "Elevada organización, disciplina y orientación al logro. Confiable y comprometido/a con los objetivos. Tiende a cumplir lo que promete y a mantener altos estándares propios. Esta fortaleza potencia el Liderazgo Directivo y la Orientación a Metas del repertorio situacional."
    ),
}

dim_names = {
    "N": "Neuroticismo (N)", "E": "Extraversión (E)", "O": "Apertura (O)",
    "A": "Amabilidad (A)",   "C": "Responsabilidad (C)"
}
for i, d in enumerate("NEOAC", start=1):
    pd_t, nivel, interp = neo_interp[d]
    set_cell_text(t.rows[i].cells[0], dim_names[d], bold=True)
    set_cell_text(t.rows[i].cells[1], pd_t)
    set_cell_text(t.rows[i].cells[2], nivel, bold=True)
    set_cell_text(t.rows[i].cells[3], interp)
    c = color_nivel(nivel)
    if c: shade_cell(t.rows[i].cells[2], c)

doc.add_paragraph()

# ── 1b. CELID-A ──
p = doc.add_paragraph()
bold_run(p, "CELID-A:", size=11)
normal_run(p, "  Cuestionario de Estilos de Liderazgo")

t = doc.add_table(rows=10, cols=4)
t.style = "Normal Table"
table_header(t, ["Dimensión", "Media", "Percentil", "Nivel"])

def pct_str(p):
    if p >= 95: return f"P{p}+"
    return f"P{p}"

celid_data = [
    ("Carisma (Transformacional)",    f"{carisma:.2f}",      pct_str(cel_p["Carisma"]),   nivel_pct(cel_p["Carisma"])),
    ("Estimulación Intelectual",      f"{est_int:.2f}",      pct_str(cel_p["EstimInt"]),  nivel_pct(cel_p["EstimInt"])),
    ("Inspiración",                   f"{inspir:.2f}",       pct_str(cel_p["Inspir"]),    nivel_pct(cel_p["Inspir"])),
    ("Consideración Individualizada", f"{cons_ind:.2f}",     pct_str(cel_p["ConsInd"]),   nivel_pct(cel_p["ConsInd"])),
    ("TRANSFORMACIONAL – Total",      f"{transf_total:.2f}", pct_str(cel_p["TransfTot"]), nivel_pct(cel_p["TransfTot"])),
    ("Recompensa Contingente",        f"{rec_cont:.2f}",     pct_str(cel_p["RecCont"]),   nivel_pct(cel_p["RecCont"])),
    ("Dirección por Excepción",       f"{dir_exc:.2f}",      pct_str(cel_p["DirExc"]),    nivel_pct(cel_p["DirExc"])),
    ("TRANSACCIONAL – Total",         f"{trans_total:.2f}",  pct_str(cel_p["TransTot"]),  nivel_pct(cel_p["TransTot"])),
    ("LAISSEZ-FAIRE",                 f"{laissez:.2f}",      pct_str(cel_p["Laissez"]),   nivel_pct(cel_p["Laissez"])),
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
    elif "LAISSEZ" in dim:
        shade_cell(t.rows[i].cells[3], "E2EFDA")

doc.add_paragraph()

# ── 1c. CAMIN-A ──
p = doc.add_paragraph()
bold_run(p, "CAMIN-A:", size=11)
normal_run(p, "  Cuestionario de Liderazgo Camino-Meta")

t = doc.add_table(rows=5, cols=4)
t.style = "Normal Table"
table_header(t, ["Estilo", "Puntaje Directo", "Percentil", "Nivel"])
cam_data = [
    ("Liderazgo Directivo",           str(directivo),    pct_str(cam_p["Dir"]),  nivel_pct(cam_p["Dir"])),
    ("Liderazgo Considerado (Apoyo)", str(considerado),  pct_str(cam_p["Cons"]), nivel_pct(cam_p["Cons"])),
    ("Liderazgo Participativo",       str(participativo),pct_str(cam_p["Part"]), nivel_pct(cam_p["Part"])),
    ("Liderazgo Orientado a Metas",   str(orientado),    pct_str(cam_p["Or"]),   nivel_pct(cam_p["Or"])),
]
for i, row in enumerate(cam_data, start=1):
    for j, val in enumerate(row):
        set_cell_text(t.rows[i].cells[j], val, bold=(j == 0))
    c = color_nivel(row[3])
    if c: shade_cell(t.rows[i].cells[3], c)

doc.add_paragraph()

# ── 1d. POTENLID ──
p = doc.add_paragraph()
bold_run(p, "PONTELID-A:", size=11)
normal_run(p, "  Cuestionario de Potencial de Liderazgo – Motivación")

t = doc.add_table(rows=4, cols=4)
t.style = "Normal Table"
table_header(t, ["Dimensión", "Puntaje Directo", "Percentil", "Nivel"])
poten_data = [
    ("Motivación Intrínseca",       str(m_intr), pct_str(pot_p["Intr"]), nivel_pct(pot_p["Intr"])),
    ("Motivación Extrínseca",       str(m_extr), pct_str(pot_p["Extr"]), nivel_pct(pot_p["Extr"])),
    ("Motivación Social Normativa", str(m_soc),  pct_str(pot_p["Soc"]),  nivel_pct(pot_p["Soc"])),
]
for i, row in enumerate(poten_data, start=1):
    for j, val in enumerate(row):
        set_cell_text(t.rows[i].cells[j], val, bold=(j == 0))
    c = color_nivel(row[3])
    if c: shade_cell(t.rows[i].cells[3], c)

doc.add_paragraph()

# ── 1e. CONLID-A ──
p = doc.add_paragraph()
bold_run(p, "CONLID-A:", size=11)
normal_run(p, "  Cuestionario de Conductas de Liderazgo")

t = doc.add_table(rows=4, cols=4)
t.style = "Normal Table"
table_header(t, ["Categoría conductual", "Puntaje Directo", "Percentil", "Nivel"])
con_data = [
    ("Orientadas a la Tarea",       str(tarea), pct_str(con_p["Tar"]),  nivel_pct(con_p["Tar"])),
    ("Orientadas a las Relaciones", str(rel),   pct_str(con_p["Rel"]),  nivel_pct(con_p["Rel"])),
    ("Orientadas al Cambio",        str(camb),  pct_str(con_p["Camb"]), nivel_pct(con_p["Camb"])),
]
for i, row in enumerate(con_data, start=1):
    for j, val in enumerate(row):
        set_cell_text(t.rows[i].cells[j], val, bold=(j == 0))
    c = color_nivel(row[3])
    if c: shade_cell(t.rows[i].cells[3], c)

doc.add_page_break()

# ═══════════════════════════════════════════════════════
# 2. RESULTADOS CUALITATIVOS
# ═══════════════════════════════════════════════════════
add_p("2. Resultados Cualitativos", bold=True, centered=True, size=13)

# ── 2a. NEO ──
add_p("NEO-FFI: descripción de los 5 factores de la personalidad registrados por el evaluado/a.", bold=True)

neo_desc = [
    (f"Neuroticismo — Bajo (T={neo_t['N']})",
     "Alta estabilidad emocional. Maneja la presión con ecuanimidad y difícilmente reacciona de forma impulsiva ante situaciones de conflicto o incertidumbre. Esta solidez emocional es uno de los pilares más valiosos para el ejercicio del liderazgo: permite sostener la calma del equipo incluso en momentos de crisis y gestionar las tensiones interpersonales sin escalada emocional."),
    (f"Extraversión — Promedio (T={neo_t['E']})",
     "Perfil equilibrado entre introversión y extraversión. No lidera desde la visibilidad constante sino desde la presencia selectiva y de calidad. Es reflexivo/a antes de hablar, lo que refuerza la percepción de solidez y confiabilidad. Puede operar con eficacia tanto en interacciones individuales como en espacios grupales, adaptando su nivel de activación social a las demandas del contexto."),
    (f"Apertura — Alto (T={neo_t['O']})",
     "Marcada curiosidad intelectual y disposición a explorar nuevas ideas, perspectivas y metodologías. Se siente a gusto en entornos de cambio y aprendizaje continuo. Esta apertura está en la base del altísimo Carisma y la Estimulación Intelectual reportados: genera en el equipo un ambiente de desafío intelectual y renovación. Puede tensionar con colaboradores más conservadores o reacios al cambio, lo que requiere sensibilidad situacional."),
    (f"Amabilidad — Alto (T={neo_t['A']})",
     "Alta orientación prosocial, empatía y cooperación. Genera vínculos de confianza con facilidad y es percibido/a como accesible, justo/a y considerado/a. Esta característica sostiene el Liderazgo Considerado (P75) y es el motor de un clima de trabajo positivo. El riesgo asociado es la dificultad para sostener posiciones de forma asertiva ante el desacuerdo; es importante que la alta Amabilidad no derive en evitación del conflicto necesario."),
    (f"Responsabilidad — Alto (T={neo_t['C']})",
     "Elevada disciplina, organización y compromiso con los objetivos. Cumple lo que promete, mantiene altos estándares propios y espera consistencia en el equipo. Esta característica potencia el Liderazgo Directivo (P75) y es la base de la credibilidad operativa del rol. El riesgo es la tendencia a aplicar los mismos estándares de exigencia a todos los colaboradores sin considerar la madurez individual, lo que puede generar tensión con perfiles menos estructurados."),
]
for titulo, descripcion in neo_desc:
    p = doc.add_paragraph()
    bold_run(p, titulo + ": ")
    normal_run(p, descripcion)

doc.add_paragraph()

# ── 2b. Estilos de Liderazgo (CELID-A) ──
p = doc.add_paragraph()
bold_run(p, "\nEstilos de Liderazgo (CELID-A)", size=11)

add_p(f"El perfil CELID-A de Quico presenta un patrón transformacional de alta intensidad ({transf_total:.2f} / P{cel_p['TransfTot']}), con el hallazgo más destacado del perfil completo: un Carisma en el percentil máximo (P{cel_p['Carisma']}+). El componente transaccional está en nivel Medio ({trans_total:.2f} / P{cel_p['TransTot']}) y el Laissez-Faire es prácticamente nulo ({laissez:.2f} / P{cel_p['Laissez']}), lo que configura un líder altamente comprometido y presente en el rol.")

p = doc.add_paragraph()
bold_run(p, "Liderazgo Transformacional : ")
normal_run(p, f"Muy Alto (P{cel_p['TransfTot']}). El Carisma excepcional ({carisma:.2f} / P{cel_p['Carisma']}+) y la alta Estimulación Intelectual ({est_int:.2f} / P{cel_p['EstimInt']}) configuran a Quico como una figura de gran impacto simbólico e intelectual sobre el equipo: genera orgullo de pertenencia, desafía el pensamiento y propone perspectivas novedosas. La Consideración Individualizada ({cons_ind:.2f} / P{cel_p['ConsInd']}) en nivel Medio indica que el foco en el desarrollo individual de cada colaborador es el área a profundizar. El punto de atención más relevante es la Inspiración ({inspir:.2f} / P{cel_p['Inspir']}): la capacidad de articular visiones motivadoras y transmitir propósito emocional es la brecha principal del perfil transformacional.")

p = doc.add_paragraph()
bold_run(p, "Liderazgo Transaccional : ")
normal_run(p, f"Medio (P{cel_p['TransTot']}). La Dirección por Excepción ({dir_exc:.2f} / P{cel_p['DirExc']}) en nivel Medio indica que interviene ante desvíos cuando es necesario. La Recompensa Contingente ({rec_cont:.2f} / P{cel_p['RecCont']}) es el componente más bajo del perfil: el reconocimiento sistemático y explícito del buen desempeño no es un hábito consolidado. Dado el alto estándar de exigencia propio (alta Responsabilidad NEO), puede dar por supuesto lo que el colaborador necesita escuchar de forma explícita.")

p = doc.add_paragraph()
bold_run(p, "Laissez-Faire : ")
normal_run(p, f"Muy Bajo (P{cel_p['Laissez']}). Resultado excepcional: prácticamente ausente la tendencia a la no-intervención, la evasión de decisiones o la delegación sin acompañamiento. Quico muestra un liderazgo altamente comprometido, presente y activo. Esta dimensión, invertida en el gráfico de radar, aparece como una fortaleza estructural del perfil.")

doc.add_paragraph()

# ── 2c. Motivación y Conductas ──
add_p("Motivación y Conductas de Liderazgo (POTENLID, CAMIN-A, CONLID-A)", bold=True)

p = doc.add_paragraph()
bold_run(p, "Potencial de Liderazgo (POTENLID): ")
normal_run(p, f"Las tres fuentes motivacionales (Intrínseca P{pot_p['Intr']}, Extrínseca P{pot_p['Extr']}, Social Normativa P{pot_p['Soc']}) se ubican en nivel Medio, lo que refleja un perfil motivacional distribuido y equilibrado: no hay un motor dominante único. Lidera desde la convergencia de múltiples razones —vocación, beneficio y responsabilidad social— lo que puede aportar solidez y sostenibilidad al rol. El área de desarrollo es fortalecer la conexión con la motivación intrínseca: clarificar el propósito personal profundo del liderazgo potenciará la autenticidad y la resiliencia del rol a largo plazo.")

doc.add_paragraph()
add_p("Estilo de Camino-Meta (CAMIN-A)", bold=True)

p = doc.add_paragraph()
bold_run(p, "Conducta Directiva : ")
normal_run(p, f"Alto (P{cam_p['Dir']}). Clarifica expectativas, define roles y comunica con precisión qué se espera. Esta fortaleza, combinada con la alta Responsabilidad NEO, garantiza que el equipo tenga un marco de referencia claro para la acción.")

p = doc.add_paragraph()
bold_run(p, "Conducta Considerada (Apoyo) : ")
normal_run(p, f"Alto (P{cam_p['Cons']}). Fortaleza consolidada: atiende las necesidades personales del equipo y genera un ambiente de bienestar. Coherente con la alta Amabilidad del perfil NEO. Facilita la retención de talento y el compromiso afectivo con el rol.")

p = doc.add_paragraph()
bold_run(p, "Conducta Participativa : ")
normal_run(p, f"Alto (P{cam_p['Part']}). Consulta, involucra y valora el aporte del equipo en la toma de decisiones. Genera sentido de pertenencia y co-responsabilidad. Este estilo convive con fluidez con el alto Carisma: no impone, sino que convoca.")

p = doc.add_paragraph()
bold_run(p, "Conducta Orientada a Metas : ")
normal_run(p, f"Medio (P{cam_p['Or']}). Establece objetivos con claridad, aunque el énfasis en el rendimiento superior y los estándares exigentes aún puede desarrollarse. En contraste con los tres estilos anteriores (todos en P75), este es el único que no alcanza ese nivel, lo que sugiere que el foco en el desafío y el alto desempeño es el área de crecimiento del repertorio situacional.")

p = doc.add_paragraph()
bold_run(p, "En cuanto a CONLID-A: ")
normal_run(p, f"Perfil equilibrado con predominio en Conductas Orientadas al Cambio (P{con_p['Camb']}): genera alianzas, forma equipos para la transformación y promueve nuevas estrategias. Las Conductas de Tarea (P{con_p['Tar']}) y Relaciones (P{con_p['Rel']}) en nivel Medio indican un buen balance de base; el área de desarrollo es profundizar el monitoreo sistemático del desempeño (Tarea) y la atención diferenciada al desarrollo individual (Relaciones), para completar el repertorio conductual.")

doc.add_page_break()

# ═══════════════════════════════════════════════════════
# 3. PERFIL INTEGRADO Y ANÁLISIS SITUACIONAL
# ═══════════════════════════════════════════════════════
add_p("3. Perfil Integrado y Análisis Situacional", bold=True, centered=True, size=13)

add_p(f"Integrando las cinco pruebas, Quico configura un perfil de Líder Transformacional de Alto Impacto Simbólico, caracterizado por un Carisma excepcional (P{cel_p['Carisma']}+), alta Estimulación Intelectual (P{cel_p['EstimInt']}) y un Laissez-Faire prácticamente ausente (P{cel_p['Laissez']}). La base de personalidad —alta Apertura (T={neo_t['O']}), Amabilidad (T={neo_t['A']}), Responsabilidad (T={neo_t['C']}) y baja Neuroticismo (T={neo_t['N']})— es una de las configuraciones más favorables para el ejercicio del liderazgo: estabilidad emocional, orientación al otro, exigencia propia y apertura al cambio.")

doc.add_paragraph()

add_p(f"El hallazgo más relevante del perfil es la tensión entre un Carisma excepcional y una Inspiración relativamente baja (P{cel_p['Inspir']}). Esta combinación describe a un líder que genera admiración, orgullo de pertenencia y estimulación intelectual en el equipo, pero que aún no ha desarrollado plenamente la capacidad de articular visiones compartidas de manera emocionalmente movilizadora. Complementar el impacto simbólico con un relato de propósito más explícito y emocional es la palanca de desarrollo transformacional más potente disponible.")

doc.add_paragraph()

add_p(f"El repertorio situacional (CAMIN-A) es notablemente equilibrado y robusto: tres de los cuatro estilos —Directivo (P{cam_p['Dir']}), Considerado (P{cam_p['Cons']}), Participativo (P{cam_p['Part']})— están en P75, lo que indica alta adaptabilidad situacional. El estilo Orientado a Metas (P{cam_p['Or']}) en nivel Medio es el único gap del repertorio. La baja Recompensa Contingente (P{cel_p['RecCont']}) es el complemento necesario de este gap: fortalecer el reconocimiento explícito del rendimiento excepcional y la fijación de metas desafiantes completará un perfil situacional de alto nivel.")

doc.add_paragraph()

# Tabla de recomendaciones
add_p("Proyección hacia el Liderazgo Situacional — Competencias a desarrollar:", bold=True)
doc.add_paragraph()

t = doc.add_table(rows=6, cols=3)
t.style = "Normal Table"
table_header(t, ["Competencia a desarrollar", "Fundamento", "Acción de desarrollo sugerida"])

recs = [
    ("1. Desarrollar la comunicación Inspiracional",
     f"Inspiración P{cel_p['Inspir']}: es la brecha principal del perfil transformacional. El alto Carisma (P{cel_p['Carisma']}+) y la Estimulación Intelectual (P{cel_p['EstimInt']}) no se traducen aún en visiones emocionalmente movilizadoras para el equipo.",
     "Entrenamiento en storytelling de liderazgo y construcción de relato de propósito. Trabajar el lenguaje inspiracional: por qué hacemos lo que hacemos, a dónde vamos. Practicar comunicaciones formales (reuniones de equipo, mensajes de inicio de proyecto) con foco en el propósito y los valores compartidos. Coaching ejecutivo con foco en la dimensión visionaria del rol."),
    ("2. Fortalecer la Recompensa Contingente",
     f"RecCont P{cel_p['RecCont']}: el reconocimiento sistemático y explícito del buen desempeño es el componente más bajo del perfil. La alta Responsabilidad propia puede generar un sesgo hacia lo que aún falta, en detrimento del reconocimiento de lo logrado.",
     "Implementar un protocolo de reconocimiento contingente: formal (reuniones de feedback, evaluaciones) e informal (reconocimiento verbal inmediato). Trabajar el hábito de hacer explícito lo que se da por supuesto. Establecer acuerdos claros de desempeño y cerrarlos con reconocimiento cuando se cumplen."),
    ("3. Incrementar la Orientación a Metas",
     f"Lid. Orientado a Metas P{cam_p['Or']}: único estilo del CAMIN-A en nivel Medio. Fortalecer el énfasis en objetivos exigentes y el impulso al rendimiento superior completará el repertorio situacional.",
     "Establecer OKRs o metas de equipo con estándares elevados y seguimiento explícito. Incorporar conversaciones regulares de desafío y rendimiento: ¿qué tan alto podemos llegar? Combinar el Considerado y el Participativo (ya sólidos) con el estímulo explícito a la excelencia."),
    ("4. Profundizar la Consideración Individualizada",
     f"ConsInd P{cel_p['ConsInd']}: en nivel Medio. El Carisma y la Estimulación Intelectual operan sobre el grupo; la Consideración Individualizada requiere foco diferenciado en cada persona.",
     "Incorporar reuniones individuales periódicas con enfoque en el desarrollo personal de cada colaborador/a. Construir un mapa de las necesidades, motivaciones y metas de cada miembro del equipo. Practicar la escucha activa sin agenda: ¿qué necesita esta persona en particular?"),
    ("5. Consolidar la conexión con la motivación intrínseca",
     f"POTENLID: motivación distribuida en nivel Medio en las tres dimensiones. Clarificar el propósito personal profundo del liderazgo fortalecerá la autenticidad y la resiliencia a largo plazo.",
     "Explorar en procesos de coaching o supervisión las preguntas de sentido: ¿qué es lo que más disfruta del rol de líder? ¿qué tipo de impacto quiere generar? Conectar los objetivos organizacionales con el propósito personal. Desarrollar una narrativa de liderazgo propia que integre los tres motores motivacionales."),
]
for i, (comp, fund, acc) in enumerate(recs, start=1):
    set_cell_text(t.rows[i].cells[0], comp, bold=True)
    set_cell_text(t.rows[i].cells[1], fund)
    set_cell_text(t.rows[i].cells[2], acc)

doc.add_page_break()

# ═══════════════════════════════════════════════════════
# 4. GRÁFICO DE COHERENCIA
# ═══════════════════════════════════════════════════════
p = doc.add_paragraph()
bold_run(p, "4. GRÁFICO DE COHERENCIA PERSONALIDAD VS CONDUCTAS DE LIDERAZGO.", size=13)

add_p("El siguiente gráfico contrasta el perfil de Quico con el perfil ideal de un Líder Situacional. Las zonas donde la línea del evaluado/a (verde) se acerca al ideal (azul) representan fortalezas consolidadas; las zonas con mayor distancia indican brechas de desarrollo.", italic=True, size=10)

doc.add_paragraph()
doc.add_picture(RADAR_FILE, width=Inches(6.0))
doc.add_paragraph()

add_p("Lectura del mapa:", bold=True)
add_p(f"Fortalezas consolidadas: Carisma (P{cel_p['Carisma']}+), Estimulación Intelectual (P{cel_p['EstimInt']}), Laissez-Faire casi ausente (Invertido P{cel_p['Laissez']} → posición alta en el radar), Liderazgo Directivo (P{cam_p['Dir']}), Considerado (P{cam_p['Cons']}), Participativo (P{cam_p['Part']}), Conductas de Cambio (P{con_p['Camb']}).")
add_p(f"Brechas principales: Inspiración (P{cel_p['Inspir']} vs. ideal P90), Recompensa Contingente (P{cel_p['RecCont']} vs. ideal P75), Consideración Individualizada (P{cel_p['ConsInd']} vs. ideal P90).")
add_p(f"Brechas moderadas: Liderazgo Orientado a Metas (P{cam_p['Or']} vs. ideal P85), Conductas de Tarea (P{con_p['Tar']} vs. ideal P75) y Relaciones (P{con_p['Rel']} vs. ideal P85).")

doc.add_page_break()

# ═══════════════════════════════════════════════════════
# MARCO DE REFERENCIA TEÓRICO
# ═══════════════════════════════════════════════════════
h = doc.add_heading("Marco de referencia teórico.", level=3)

marco = [
    ("1. Inteligencia Emocional y Empatía",
     "Es la capacidad de percibir, comprender y gestionar las emociones propias y las del equipo. En un entorno de alta presión, la validación del bienestar del colaborador es clave para la retención.",
     "Liderazgo Afiliativo. Se centra en crear armonía y construir vínculos emocionales fuertes. Es el 'pegamento' que mantiene unido al equipo en tiempos de crisis.",
     f"La alta Amabilidad (T={neo_t['A']}), el bajo Neuroticismo (T={neo_t['N']}) y el Liderazgo Considerado (P{cam_p['Cons']}) muestran una base de inteligencia emocional sólida. El área de desarrollo es traducir esta capacidad en Consideración Individualizada diferenciada (P{cel_p['ConsInd']} → objetivo: profundizar el conocimiento de cada colaborador/a)."),
    ("2. Visión Estratégica y Adaptabilidad",
     "No basta con gestionar el presente; hay que anticipar el futuro. El mercado valora líderes que puedan pivotar rápidamente ante cambios tecnológicos sin perder de vista los objetivos a largo plazo.",
     "Liderazgo Visionario (o Orientativo). Inspira a las personas hacia un sueño compartido y explica el 'porqué' detrás de cada cambio, otorgando autonomía sobre el 'cómo'.",
     f"La alta Apertura (T={neo_t['O']}), el Carisma excepcional (P{cel_p['Carisma']}+) y las Conductas de Cambio (P{con_p['Camb']}) son la base de un liderazgo estratégico de alto potencial. Desarrollar la comunicación Inspiracional (P{cel_p['Inspir']}) es el puente entre el impacto simbólico actual y el liderazgo visionario pleno."),
    ("3. Coaching y Desarrollo de Talento",
     "Un líder moderno es evaluado por cuánto crecen sus subordinados. La capacidad de identificar el potencial de otros y delegar responsabilidades críticas es fundamental.",
     "Liderazgo Coach. Se enfoca más en el desarrollo personal de los colaboradores que en las tareas inmediatas. Ayuda a conectar las metas personales con las de la organización.",
     f"El Liderazgo Participativo (P{cam_p['Part']}) y la Consideración Individualizada (P{cel_p['ConsInd']}) son la base. La ausencia de Laissez-Faire (P{cel_p['Laissez']}) garantiza que el coaching no degenere en abandono. El paso siguiente es incorporar herramientas formales de coaching para convertir el talento natural en una práctica sistemática de desarrollo de personas."),
    ("4. Comunicación Transparente y Escucha Activa",
     "En la era de la información, la opacidad genera desconfianza. El mercado demanda líderes que sepan escuchar antes de hablar y que comuniquen con claridad, incluso las malas noticias.",
     "Liderazgo Democrático (Participativo). Fomenta el consenso y la colaboración. Valora la opinión del equipo para la toma de decisiones, lo que aumenta el compromiso.",
     f"El Liderazgo Participativo (P{cam_p['Part']}) y el Carisma (P{cel_p['Carisma']}+) garantizan que la comunicación sea un punto fuerte del perfil. El área de desarrollo es la comunicación inspiracional y el cierre del ciclo de reconocimiento: el Carisma atrae, pero la Recompensa Contingente (P{cel_p['RecCont']}) es lo que consolida el compromiso cotidiano del equipo."),
    ("5. Resiliencia y Gestión del Cambio",
     "La capacidad de mantener la calma bajo presión y ver los errores como oportunidades de aprendizaje es una de las habilidades más difíciles de encontrar en líderes.",
     "Liderazgo Transformacional. Busca cambiar los sistemas y la cultura organizacional a través de la motivación y la inspiración, movilizando al equipo fuera de su zona de confort.",
     f"El Neuroticismo Bajo (T={neo_t['N']}) es la base de la resiliencia personal: Quico procesa las adversidades sin agotamiento emocional. Las Conductas de Cambio (P{con_p['Camb']}) confirman que ya opera como agente de transformación. El desarrollo de la comunicación Inspiracional es el catalizador que llevará este liderazgo transformacional al siguiente nivel de impacto organizacional."),
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
    r = p.add_run("Relevancia para el evaluado/a: ")
    r.bold = True
    r.font.color.rgb = RGBColor(0x2E, 0x54, 0x96)
    p.add_run(relevancia)

doc.save(OUTPUT)
print(f"\n{OUTPUT} generado correctamente con formato {MODELO}")
