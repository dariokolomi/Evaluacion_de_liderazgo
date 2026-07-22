"""Motor de generación de informes de liderazgo — versión parametrizada con callbacks de progreso."""
import re, os
import openpyxl
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from datetime import date
from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


def run_informe(xlsx_path, modelo_path, output_path, radar_path, evaluado_name, progress_callback):
    pc = progress_callback

    # ═══ 1. LECTURA Y CORRECCIÓN ═══
    pc(5, "Cargando planilla de respuestas...")
    wb = openpyxl.load_workbook(xlsx_path)

    # ── NEO-FFI ──
    pc(10, "Calculando NEO-FFI...")
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
            if sign == "-": val = 4 - val
            total += val
        return total

    neo_raw = {d: score_neo(d) for d in "NEOAC"}
    neo_baremo = {
        "N": {0:25,1:30,2:32,3:34,4:35,5:36,6:38,7:39,8:41,9:42,10:44,11:46,12:47,13:49,14:50,15:51,16:53,17:54,18:55,19:56,20:58,21:59,22:60,23:61,24:62,25:63,26:64,27:65,28:66,29:67,30:68,31:69,32:70,33:71,34:72,35:73,36:75,37:75,38:75,39:75,40:75,41:75,42:75,43:75,44:75,45:75,46:75,47:75,48:75},
        "E": {13:25,14:25,15:26,16:27,17:29,18:30,19:31,20:32,21:33,22:35,23:37,24:38,25:39,26:41,27:42,28:44,29:45,30:47,31:48,32:50,33:51,34:53,35:54,36:56,37:55,38:56,39:61,40:63,41:64,42:66,43:68,44:70,45:72,46:75,47:75,48:75},
        "O": {11:25,12:28,13:29,14:30,15:31,16:33,17:34,18:36,19:37,20:38,21:39,22:41,23:42,24:44,25:45,26:47,27:48,28:50,29:51,30:53,31:54,32:56,33:57,34:59,35:61,36:62,37:64,38:65,39:67,40:69,41:71,42:72,43:73,44:75},
        "A": {16:25,17:26,18:27,19:29,20:30,21:32,22:33,23:36,24:37,25:38,26:39,27:40,28:42,29:44,30:46,31:48,32:50,33:53,34:55,35:58,36:57,37:59,38:61,39:62,40:64,41:65,42:67,43:68,44:70,45:72,46:74,47:75,48:75},
        "C": {16:25,17:26,18:26,19:27,20:28,21:29,22:30,23:32,24:33,25:34,26:35,27:37,28:38,29:39,30:40,31:42,32:44,33:46,34:47,35:50,36:51,37:53,38:54,39:56,40:57,41:59,42:61,43:62,44:65,45:67,46:69,47:72,48:75},
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
    pc(25, "Calculando CELID-A (Estilos de Liderazgo)...")
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
        "Carisma":   percentil(carisma,      celid_bar["Carisma"]),
        "EstimInt":  percentil(est_int,       celid_bar["EstimInt"]),
        "Inspir":    percentil(inspir,        celid_bar["Inspir"]),
        "ConsInd":   percentil(cons_ind,      celid_bar["ConsInd"]),
        "TransfTot": percentil(transf_total,  celid_bar["TransfTot"]),
        "RecCont":   percentil(rec_cont,      celid_bar["RecCont"]),
        "DirExc":    percentil(dir_exc,       celid_bar["DirExc"]),
        "TransTot":  percentil(trans_total,   celid_bar["TransTot"]),
        "Laissez":   percentil(laissez,       celid_bar["Laissez"]),
    }

    # ── POTENLID ──
    pc(40, "Calculando POTENLID (Motivación)...")
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
    pc(52, "Calculando CAMIN-A (Camino-Meta)...")
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
    pc(62, "Calculando CONLID-A (Conductas)...")
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

    # ═══ 2. GRÁFICO RADAR ═══
    pc(72, "Generando gráfico radar...")
    labels = [
        "Carisma", "Estim.\nIntelectual", "Inspiración", "Consid.\nIndiv.",
        "Laissez\n(inv.)", "Rec.\nContingente", "Dir. por\nExcepción",
        "Lid. Directivo", "Lid. Considerado", "Lid. Participativo",
        "Lid. a Metas", "Tarea", "Relaciones", "Cambio"
    ]
    laissez_inv = max(1, 100 - cel_p["Laissez"])
    evaluado_vals = [
        cel_p["Carisma"], cel_p["EstimInt"], cel_p["Inspir"], cel_p["ConsInd"],
        laissez_inv, cel_p["RecCont"], cel_p["DirExc"],
        cam_p["Dir"], cam_p["Cons"], cam_p["Part"], cam_p["Or"],
        con_p["Tar"], con_p["Rel"], con_p["Camb"],
    ]
    ideal = [90, 85, 90, 90, 85, 75, 70, 75, 80, 90, 85, 75, 85, 85]
    N = len(labels)
    angles = np.linspace(0, 2*np.pi, N, endpoint=False).tolist()
    angles += angles[:1]
    ev  = [v/100 for v in evaluado_vals] + [evaluado_vals[0]/100]
    id_ = [v/100 for v in ideal]         + [ideal[0]/100]

    fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(polar=True))
    ax.plot(angles, id_, "o-", linewidth=2, color="#2E5496", label="Perfil ideal")
    ax.fill(angles, id_, alpha=0.10, color="#2E5496")
    ax.plot(angles, ev, "o-", linewidth=2, color="#FF6600", label=evaluado_name)
    ax.fill(angles, ev, alpha=0.15, color="#FF6600")
    ax.set_thetagrids(np.degrees(angles[:-1]), labels, fontsize=8)
    ax.set_ylim(0, 1)
    ax.set_yticks([0.25, 0.50, 0.75, 1.00])
    ax.set_yticklabels(["P25", "P50", "P75", "P99"], fontsize=7)
    ax.legend(loc="upper right", bbox_to_anchor=(1.25, 1.10))
    ax.set_title(f"Coherencia Personalidad – Conductas de Liderazgo ({evaluado_name})", y=1.08, fontsize=11)
    plt.tight_layout()
    plt.savefig(radar_path, dpi=150, bbox_inches="tight")
    plt.close()

    # ═══ 3. CONSTRUCCIÓN DEL DOCUMENTO ═══
    pc(80, "Construyendo documento Word...")
    doc = Document(modelo_path)
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

    def bold_run(para, text, size=None, color=None):
        r = para.add_run(text)
        r.bold = True
        if size:  r.font.size = Pt(size)
        if color: r.font.color.rgb = color
        return r

    def normal_run(para, text, size=None, italic=False):
        r = para.add_run(text)
        if size:   r.font.size = Pt(size)
        if italic: r.italic = True
        return r

    def add_p(text="", bold=False, centered=False, size=None, italic=False):
        p = doc.add_paragraph()
        if centered: p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        if text:
            r = p.add_run(text)
            r.bold   = bold
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

    def set_cell(cell, text, bold=False, size=10):
        cell.text = text
        if cell.paragraphs[0].runs:
            r = cell.paragraphs[0].runs[0]
            r.bold = bold
            r.font.size = Pt(size)

    def color_nivel(nivel):
        if nivel in ("Alto", "Muy Alto"): return "E2EFDA"
        if nivel in ("Bajo", "Muy Bajo"): return "FCE4D6"
        return None

    def pct_str(p):
        return f"P{p}+" if p >= 95 else f"P{p}"

    # ─── PORTADA ───
    p = doc.add_paragraph()
    r = p.add_run("INFORME: ")
    r.bold = True; r.font.size = Pt(14)
    r = p.add_run(evaluado_name)
    r.bold = True; r.font.size = Pt(14)
    r.font.color.rgb = RGBColor(0x2E, 0x54, 0x96)

    t_datos = doc.add_table(rows=3, cols=2)
    t_datos.style = "Normal Table"
    for i, (k, v) in enumerate([
        ("Fecha de Evaluación",         date.today().strftime("%d/%m/%Y")),
        ("Instrumentos administrados",  "NEO-FFI · CELID-A · POTENLID · CAMIN-A · CONLID-A"),
        ("Profesional evaluador",       "—"),
    ]):
        set_cell(t_datos.rows[i].cells[0], k, bold=True)
        shade_cell(t_datos.rows[i].cells[0], "DCE6F1")
        set_cell(t_datos.rows[i].cells[1], v)
    doc.add_paragraph()

    # ─── 1. DATOS CUANTITATIVOS ───
    pc(84, "Generando sección 1 — datos cuantitativos...")
    add_p("1. DATOS CUANTITATIVOS.", bold=True, centered=True, size=13)
    add_p("Resultado cuantitativo de todos los test.", bold=True)

    add_p("Perfil de Personalidad (NEO-FFI)", bold=True)
    t = doc.add_table(rows=6, cols=4)
    t.style = "Normal Table"
    table_header(t, ["Dimensión", "Puntaje Directo / T", "Nivel", "Interpretación Tendencial"])
    dim_names = {"N":"Neuroticismo (N)","E":"Extraversión (E)","O":"Apertura (O)","A":"Amabilidad (A)","C":"Responsabilidad (C)"}
    neo_interp_short = {
        "N": "Nivel de reactividad emocional y vulnerabilidad al estrés.",
        "E": "Sociabilidad, energía y orientación al contacto interpersonal.",
        "O": "Apertura a la novedad, creatividad y flexibilidad intelectual.",
        "A": "Orientación prosocial, cooperación y empatía interpersonal.",
        "C": "Organización, planificación y orientación al logro.",
    }
    for i, d in enumerate("NEOAC", start=1):
        set_cell(t.rows[i].cells[0], dim_names[d], bold=True)
        set_cell(t.rows[i].cells[1], f"PD={neo_raw[d]}  |  T={neo_t[d]}")
        set_cell(t.rows[i].cells[2], neo_niv[d], bold=True)
        set_cell(t.rows[i].cells[3], neo_interp_short[d])
        c = color_nivel(neo_niv[d])
        if c: shade_cell(t.rows[i].cells[2], c)
    doc.add_paragraph()

    p = doc.add_paragraph()
    bold_run(p, "CELID-A:", size=11)
    normal_run(p, "  Cuestionario de Estilos de Liderazgo")
    t = doc.add_table(rows=10, cols=4)
    t.style = "Normal Table"
    table_header(t, ["Dimensión", "Media", "Percentil", "Nivel"])
    celid_rows = [
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
    for i, (dim, media, perc, nivel) in enumerate(celid_rows, start=1):
        is_total = "Total" in dim or "LAISSEZ" in dim
        set_cell(t.rows[i].cells[0], dim, bold=is_total)
        set_cell(t.rows[i].cells[1], media)
        set_cell(t.rows[i].cells[2], perc)
        set_cell(t.rows[i].cells[3], nivel, bold=is_total)
        if is_total:
            for c in t.rows[i].cells: shade_cell(c, "DCE6F1")
        elif "LAISSEZ" in dim and nivel == "Alto":
            shade_cell(t.rows[i].cells[3], "FCE4D6")
    doc.add_paragraph()

    p = doc.add_paragraph()
    bold_run(p, "CAMIN-A:", size=11)
    normal_run(p, "  Cuestionario de Liderazgo Camino-Meta")
    t = doc.add_table(rows=5, cols=4)
    t.style = "Normal Table"
    table_header(t, ["Estilo", "Puntaje Directo", "Percentil", "Nivel"])
    for i, (dim, pd, pc_v, nv) in enumerate([
        ("Liderazgo Directivo",           str(directivo),    pct_str(cam_p["Dir"]),  nivel_pct(cam_p["Dir"])),
        ("Liderazgo Considerado (Apoyo)", str(considerado),  pct_str(cam_p["Cons"]), nivel_pct(cam_p["Cons"])),
        ("Liderazgo Participativo",       str(participativo),pct_str(cam_p["Part"]), nivel_pct(cam_p["Part"])),
        ("Liderazgo Orientado a Metas",   str(orientado),    pct_str(cam_p["Or"]),   nivel_pct(cam_p["Or"])),
    ], start=1):
        set_cell(t.rows[i].cells[0], dim, bold=True)
        set_cell(t.rows[i].cells[1], pd)
        set_cell(t.rows[i].cells[2], pc_v)
        set_cell(t.rows[i].cells[3], nv)
        c = color_nivel(nv)
        if c: shade_cell(t.rows[i].cells[3], c)
    doc.add_paragraph()

    p = doc.add_paragraph()
    bold_run(p, "PONTELID-A:", size=11)
    normal_run(p, "  Cuestionario de Potencial de Liderazgo – Motivación")
    t = doc.add_table(rows=4, cols=4)
    t.style = "Normal Table"
    table_header(t, ["Dimensión", "Puntaje Directo", "Percentil", "Nivel"])
    for i, (dim, pd, pc_v, nv) in enumerate([
        ("Motivación Intrínseca",       str(m_intr), pct_str(pot_p["Intr"]), nivel_pct(pot_p["Intr"])),
        ("Motivación Extrínseca",       str(m_extr), pct_str(pot_p["Extr"]), nivel_pct(pot_p["Extr"])),
        ("Motivación Social Normativa", str(m_soc),  pct_str(pot_p["Soc"]),  nivel_pct(pot_p["Soc"])),
    ], start=1):
        set_cell(t.rows[i].cells[0], dim, bold=True)
        set_cell(t.rows[i].cells[1], pd)
        set_cell(t.rows[i].cells[2], pc_v)
        set_cell(t.rows[i].cells[3], nv)
        c = color_nivel(nv)
        if c: shade_cell(t.rows[i].cells[3], c)
    doc.add_paragraph()

    p = doc.add_paragraph()
    bold_run(p, "CONLID-A:", size=11)
    normal_run(p, "  Cuestionario de Conductas de Liderazgo")
    t = doc.add_table(rows=4, cols=4)
    t.style = "Normal Table"
    table_header(t, ["Categoría conductual", "Puntaje Directo", "Percentil", "Nivel"])
    for i, (dim, pd, pc_v, nv) in enumerate([
        ("Orientadas a la Tarea",       str(tarea), pct_str(con_p["Tar"]),  nivel_pct(con_p["Tar"])),
        ("Orientadas a las Relaciones", str(rel),   pct_str(con_p["Rel"]),  nivel_pct(con_p["Rel"])),
        ("Orientadas al Cambio",        str(camb),  pct_str(con_p["Camb"]), nivel_pct(con_p["Camb"])),
    ], start=1):
        set_cell(t.rows[i].cells[0], dim, bold=True)
        set_cell(t.rows[i].cells[1], pd)
        set_cell(t.rows[i].cells[2], pc_v)
        set_cell(t.rows[i].cells[3], nv)
        c = color_nivel(nv)
        if c: shade_cell(t.rows[i].cells[3], c)

    doc.add_page_break()

    # ─── 2. RESULTADOS CUALITATIVOS ───
    pc(87, "Generando sección 2 — resultados cualitativos...")
    add_p("2. Resultados Cualitativos", bold=True, centered=True, size=13)

    # 2.1 NEO
    add_p("2.1 NEO-FFI: interpretación tendencial conjugando los 5 factores de la personalidad registrados por el evaluado/a y cómo su perfil podría actuar en el desempeño laboral concreto.", bold=True)

    _neo_dim_nombres = {
        "N": "Neuroticismo", "E": "Extraversión", "O": "Apertura a la Experiencia",
        "A": "Amabilidad",   "C": "Responsabilidad (Conscientiousness)",
    }
    _neo_textos = {
        "N": {
            "Muy Alto": "Alta tendencia a la reactividad emocional y el malestar psicológico. Puede experimentar ansiedad, irritabilidad y dificultad para manejar el estrés de forma sostenida. Para un rol de conducción es prioritario desarrollar estrategias activas de regulación emocional y construir redes de apoyo que amortigüen la demanda del puesto.",
            "Alto":     "Tendencia moderada-alta a la reactividad emocional. En situaciones de presión prolongada puede mostrar mayor vulnerabilidad al estrés, lo que puede impactar en la toma de decisiones y el clima del equipo. Conviene trabajar estrategias de autorregulación como recurso central para sostener el rol.",
            "Promedio": "Presenta un nivel intermedio de reactividad emocional. Ante situaciones de estrés moderado mantiene la compostura, aunque puede experimentar tensión ante demandas prolongadas o alta incertidumbre. Para un rol de conducción, este nivel sugiere la conveniencia de desarrollar estrategias de autorregulación emocional como recurso preventivo.",
            "Bajo":     "Buen nivel de estabilidad emocional. Generalmente mantiene la calma ante situaciones de presión y no se deja dominar por el estrés cotidiano. Recurso valioso para el rol de conducción, especialmente en contextos de incertidumbre y alta demanda sostenida.",
            "Muy Bajo": "Alta estabilidad emocional, rasgo notable para roles de conducción. Mantiene la calma incluso bajo presión sostenida, transmite serenidad al equipo y toma decisiones con menor carga emocional. Esta fortaleza permite sostener el rol exigente de liderazgo con consistencia.",
        },
        "E": {
            "Muy Alto": "Persona de muy alta energía social y orientación al contacto. Genera dinamismo y entusiasmo en el equipo. La clave en el liderazgo es canalizar esta energía en escucha activa y sostener la atención a las necesidades individuales de cada colaborador sin perder profundidad en el vínculo.",
            "Alto":     "Persona sociable, enérgica y con marcada orientación al contacto interpersonal. Disfruta del trabajo en equipo, se muestra disponible y activa en la relación con sus colaboradores. Esta característica es una fortaleza central para construir vínculos de confianza y ejercer un liderazgo cercano y participativo.",
            "Promedio": "Nivel equilibrado de sociabilidad. Puede funcionar con eficacia tanto en tareas individuales como grupales, adaptando su nivel de energía social según el contexto. Cuenta con recursos para el contacto interpersonal sin depender exclusivamente de él para funcionar.",
            "Bajo":     "Tendencia a la introversión. Prefiere los vínculos más selectivos y el trabajo reflexivo. En el liderazgo esto puede traducirse en mayor capacidad de escucha y análisis, aunque conviene fortalecer la visibilidad y la presencia activa ante el equipo para consolidar el rol.",
            "Muy Bajo": "Marcada orientación introspectiva. Se desenvuelve mejor en entornos de trabajo independiente. Para el liderazgo de equipos será importante desarrollar estrategias activas de comunicación y presencia que requieren un esfuerzo deliberado más allá del estilo natural.",
        },
        "O": {
            "Muy Alto": "Alta apertura a nuevas ideas, creatividad e innovación. Busca activamente la novedad y puede generar un ambiente de experimentación y cambio. En el liderazgo el desafío es equilibrar el impulso innovador con la necesidad de estabilidad y consistencia que el equipo requiere.",
            "Alto":     "Clara apertura a la novedad y las nuevas ideas. Perfil receptivo a la innovación y el cambio. Facilita la adaptación ante nuevos desafíos y la generación de soluciones creativas ante problemas complejos del entorno laboral.",
            "Promedio": "Equilibrio entre apertura a nuevas ideas y apego a lo conocido. No tiene un perfil marcadamente innovador, aunque se adapta a los cambios con normalidad. Aporta pragmatismo y consistencia: propone cambios cuando los percibe como funcionales, sin buscar la novedad por sí misma.",
            "Bajo":     "Tendencia a preferir lo conocido y probado. Pragmatismo y consistencia como fortalezas: confiable y predecible en entornos estables. En contextos de alta velocidad de cambio puede necesitar apoyo para adaptarse a transformaciones aceleradas.",
            "Muy Bajo": "Fuerte preferencia por lo establecido y los procedimientos conocidos. Alta consistencia y confiabilidad en entornos estables. En contextos de innovación o cambio organizacional acelerado será importante trabajar la flexibilidad y la tolerancia a la ambigüedad.",
        },
        "A": {
            "Muy Alto": "Alta orientación prosocial y necesidad de armonía. Tendencia a priorizar el bienestar del grupo por encima de la consecución de objetivos. En el liderazgo el riesgo es la complacencia y la dificultad para sostener posiciones y dar feedback negativo. Es importante desarrollar la asertividad como competencia complementaria indispensable.",
            "Alto":     "Fuerte orientación colaborativa y empática. Construye relaciones de alta confianza con el equipo. El desafío es mantener la capacidad de confrontación productiva y la exigencia necesaria para el logro de resultados sin caer en la complacencia.",
            "Promedio": "Perfil equilibrado entre la orientación prosocial y la asertividad. Puede ser empático/a y cooperativo/a, y también sostener posiciones con firmeza cuando la situación lo requiere. Este balance facilita la gestión de conflictos y la negociación sin caer en la complacencia ni en la confrontación innecesaria.",
            "Bajo":     "Tendencia más asertiva e independiente. Puede sostener posiciones con firmeza y dar feedback directo sin dificultad. El desafío es desarrollar la sensibilidad hacia las necesidades emocionales del equipo para equilibrar el foco en resultados con el clima organizacional.",
            "Muy Bajo": "Marcada independencia y tendencia a la confrontación directa. Fuerte asertividad que puede generar fricciones en el equipo. Será importante trabajar la empatía y las habilidades de comunicación empática para construir relaciones de confianza sostenibles.",
        },
        "C": {
            "Muy Alto": "Alta organización, planificación y orientación al logro. Perfil metódico orientado a la excelencia. El riesgo es el perfeccionismo y la dificultad para delegar o aceptar resultados 'suficientemente buenos'. Conviene desarrollar flexibilidad ante la imperfección y tolerancia al error ajeno.",
            "Alto":     "Clara orientación a la planificación, el orden y el logro. Confiable y consistente en la ejecución de compromisos. Esta característica es una fortaleza para la organización del equipo y el cumplimiento de objetivos con calidad.",
            "Promedio": "Nivel adecuado de planificación, organización y orientación al logro. Eficiente y confiable sin rasgos de rigidez perfeccionista. Conserva flexibilidad para adaptarse a cambios de planes, lo que lo/la hace apto/a para entornos dinámicos donde la priorización constante es parte del rol.",
            "Bajo":     "Menor énfasis en la planificación sistemática. Mayor flexibilidad y espontaneidad, con menor atención a los detalles formales. En el liderazgo conviene apoyarse en estructuras y herramientas de gestión que compensen la tendencia a la improvisación y aseguren el cumplimiento de compromisos.",
            "Muy Bajo": "Tendencia marcada a la espontaneidad y menor orientación a la planificación. Puede presentar dificultades en el cumplimiento consistente de compromisos y en la organización sistemática del equipo. Se recomienda desarrollar herramientas de gestión del tiempo y planificación como competencias clave para el rol.",
        },
    }

    for d in "NEOAC":
        p = doc.add_paragraph()
        bold_run(p, f"{_neo_dim_nombres[d]} — {neo_niv[d]} (T={neo_t[d]}): ")
        normal_run(p, _neo_textos[d][neo_niv[d]])
    doc.add_paragraph()

    # 2.2 CELID-A
    p = doc.add_paragraph()
    bold_run(p, "2.2 Estilos de Liderazgo (CELID-A)", size=11)
    add_p(f"La persona evaluada muestra un perfil de liderazgo Transformacional predominante ({transf_total:.2f} / P{cel_p['TransfTot']}), con Transaccional complementario ({trans_total:.2f} / P{cel_p['TransTot']}) y Laissez-Faire ({laissez:.2f} / P{cel_p['Laissez']}) como zona de atención.")

    p = doc.add_paragraph()
    bold_run(p, "Liderazgo Transformacional : ")
    normal_run(p, f"P{cel_p['TransfTot']}. Con fortalezas en Consideración Individualizada ({cons_ind:.2f} / P{cel_p['ConsInd']}) e Inspiración ({inspir:.2f} / P{cel_p['Inspir']}). El Carisma ({carisma:.2f} / P{cel_p['Carisma']}) y la Estimulación Intelectual ({est_int:.2f} / P{cel_p['EstimInt']}) son zonas de crecimiento.")

    p = doc.add_paragraph()
    bold_run(p, "Liderazgo Transaccional : ")
    normal_run(p, f"P{cel_p['TransTot']}. Dirección por Excepción (P{cel_p['DirExc']}) y Recompensa Contingente (P{cel_p['RecCont']}) en niveles moderados. Interviene ante desvíos pero podría fortalecer el reconocimiento sistemático del buen desempeño.")

    p = doc.add_paragraph()
    bold_run(p, "Laissez-Faire : ")
    normal_run(p, f"P{cel_p['Laissez']}. Zona de mayor atención. Puede presentar tendencia a la no-intervención o delegación sin acompañamiento. En contextos de equipo maduro puede ser una fortaleza, pero ante colaboradores con menor madurez puede generar falta de dirección.")
    doc.add_paragraph()

    # 2.3 Motivación y Conductas
    add_p("2.3 Motivación y Conductas de Liderazgo (POTENLID, CAMIN-A, CONLID-A): potencialidades y motivaciones esperables que se observen en el evaluado/a.", bold=True)

    p = doc.add_paragraph()
    bold_run(p, "Potencial de Liderazgo (POTENLID): ")
    normal_run(p, f"Motivación Intrínseca P{pot_p['Intr']}, Extrínseca P{pot_p['Extr']}, Social Normativa P{pot_p['Soc']}. " + ("Lidera por convicción genuina: el rol no está impulsado por beneficios materiales ni obligación social." if pot_p["Intr"] >= 75 else "Perfil motivacional equilibrado entre factores intrínsecos y extrínsecos."))

    doc.add_paragraph()
    add_p("Estilo de Camino-Meta (CAMIN-A)", bold=True)
    for label, key, extra in [
        ("Conducta Considerada (Apoyo)", "Cons", "Atiende activamente las necesidades personales de los colaboradores."),
        ("Conducta Participativa",       "Part", "Consulta, escucha e involucra al equipo en las decisiones."),
        ("Conducta Directiva",           "Dir",  "Comunica expectativas con claridad cuando la situación lo requiere."),
        ("Conducta Orientada a Metas",   "Or",   "Establece objetivos exigentes y alienta el rendimiento superior."),
    ]:
        p = doc.add_paragraph()
        bold_run(p, f"{label} : ")
        normal_run(p, f"{nivel_pct(cam_p[key])} (P{cam_p[key]}). {extra}")

    p = doc.add_paragraph()
    bold_run(p, "CONLID-A: ")
    normal_run(p, f"Relaciones P{con_p['Rel']}, Cambio P{con_p['Camb']}, Tarea P{con_p['Tar']}. " + ("Predominio en conductas relacionales con alta orientación al cambio. Las conductas de tarea son el área de desarrollo para consolidar el rol." if con_p["Rel"] > con_p["Tar"] else "Distribución equilibrada entre los tres tipos de conductas de liderazgo."))

    doc.add_page_break()

    # ─── 3. PERFIL INTEGRADO ───
    pc(91, "Generando sección 3 — perfil integrado...")
    add_p("3. Perfil Integrado y Análisis Situacional", bold=True, centered=True, size=13)
    add_p(f"Integrando las cinco pruebas, el/la evaluado/a configura un perfil de Líder Relacional-Transformacional, con eje en la Consideración, la Participación y el Apoyo, sostenido por una base de extroversión {neo_niv['E'].lower()} (E T={neo_t['E']}) y motivación intrínseca genuina (P{pot_p['Intr']}). Su estilo es altamente centrado en las personas: escucha, incluye, reconoce y apoya a sus colaboradores de manera consistente.")
    doc.add_paragraph()
    add_p(f"El hallazgo más relevante del perfil es la combinación de un alto Liderazgo Considerado (P{cam_p['Cons']}) y Participativo (P{cam_p['Part']}) con una presencia de Laissez-Faire (P{cel_p['Laissez']}). Esta tensión sugiere que el/la evaluado/a puede alternar entre un acompañamiento muy cercano y episodios de delegación sin el acompañamiento necesario, especialmente en conflictos o decisiones difíciles.")
    doc.add_paragraph()
    add_p(f"En términos del modelo Situacional (Hersey & Blanchard) y Camino-Meta (House), maneja con solvencia los estilos Considerado y Participativo, y tiene buena disposición hacia las Metas (P{cam_p['Or']}). El estilo Directivo (P{cam_p['Dir']}) es el menos desarrollado y el área de mayor crecimiento potencial.")
    doc.add_paragraph()

    add_p("Proyección hacia el Liderazgo Situacional — Competencias a desarrollar:", bold=True)
    doc.add_paragraph()
    t = doc.add_table(rows=7, cols=3)
    t.style = "Normal Table"
    table_header(t, ["Competencia a desarrollar", "Fundamento", "Acción de desarrollo sugerida"])
    recs = [
        ("1. Reducir episodios de Laissez-Faire",
         f"P{cel_p['Laissez']}: tendencia a la no-intervención. Alta Amabilidad (T={neo_t['A']}) puede dificultar la confrontación.",
         "Definir criterios de cuándo intervenir vs. delegar. Formación en gestión del conflicto y toma de decisiones difíciles."),
        ("2. Fortalecer el Liderazgo Directivo",
         f"P{cam_p['Dir']}: el menos desarrollado del perfil. Necesario en situaciones de baja madurez o alta urgencia.",
         "Práctica de comunicación de expectativas claras. Role-play de conversaciones directivas. Feedback de corrección oportuno."),
        ("3. Incrementar la Recompensa Contingente",
         f"P{cel_p['RecCont']}: nivel moderado. El buen desempeño puede no sentirse sistemáticamente reconocido.",
         "Implementar reconocimiento contingente explícito. Formalizar acuerdos de desempeño + recompensa."),
        ("4. Desarrollar Carisma y Estimulación Intelectual",
         f"Carisma P{cel_p['Carisma']} y EstimInt P{cel_p['EstimInt']}: influencia simbólica y cuestionamiento analítico en nivel Medio.",
         "Entrenamiento en storytelling y relato de propósito. Incorporar desafíos intelectuales al equipo."),
        ("5. Gestionar la autorregulación emocional",
         f"Neuroticismo T={neo_t['N']} ({neo_niv['N']}): base para sostener el estilo Considerado sin agotamiento.",
         "Técnicas de gestión del estrés. Establecer rutinas de recuperación. Coaching ejecutivo."),
        ("6. Resiliencia y Gestión del Cambio",
         f"Neuroticismo T={neo_t['N']} ({neo_niv['N']}) y Conductas de Cambio P{con_p['Camb']}: la capacidad de mantener la calma bajo presión y gestionar la incertidumbre es clave para liderar transformaciones sostenidas.",
         "Formación en liderazgo en entornos de incertidumbre. Prácticas de mindfulness y regulación emocional. Construcción de red de pares líderes. Desarrollar narrativa del cambio como herramienta de conducción."),
    ]
    for i, (comp, fund, acc) in enumerate(recs, start=1):
        set_cell(t.rows[i].cells[0], comp, bold=True)
        set_cell(t.rows[i].cells[1], fund)
        set_cell(t.rows[i].cells[2], acc)

    doc.add_page_break()

    # ─── 4. GRÁFICO DE COHERENCIA ───
    pc(94, "Insertando gráfico de coherencia...")
    p = doc.add_paragraph()
    bold_run(p, "4. GRÁFICO DE COHERENCIA PERSONALIDAD VS CONDUCTAS DE LIDERAZGO.", size=13)
    add_p(f"El siguiente gráfico contrasta el perfil de {evaluado_name} con el perfil ideal de un Líder Situacional. Las zonas donde la línea del evaluado/a (naranja) se acerca al ideal (azul) representan fortalezas consolidadas; las zonas con mayor distancia indican brechas de desarrollo.", italic=True, size=10)
    doc.add_paragraph()
    doc.add_picture(radar_path, width=Inches(6.0))
    doc.add_paragraph()
    add_p("Lectura del mapa:", bold=True)
    add_p(f"Fortalezas consolidadas: Consideración Individualizada (P{cel_p['ConsInd']}), Liderazgo Considerado (P{cam_p['Cons']}), Liderazgo Participativo (P{cam_p['Part']}), Orientado a Metas (P{cam_p['Or']}), Conductas de Relaciones (P{con_p['Rel']}).")
    add_p(f"Brechas principales: Laissez-Faire (P{cel_p['Laissez']} — invertido en gráfico), Carisma (P{cel_p['Carisma']} vs ideal P90), Estimulación Intelectual (P{cel_p['EstimInt']} vs ideal P85).")
    add_p(f"Brechas moderadas: Liderazgo Directivo (P{cam_p['Dir']} vs ideal P75) y Conductas de Tarea (P{con_p['Tar']} vs ideal P75).")

    doc.add_page_break()

    # ─── 5. SÍNTESIS ───
    pc(97, "Generando sección 5 — síntesis de evaluación...")
    add_p("5. Síntesis de Evaluación de Liderazgo — para Feedback y registro al evaluado/a.", bold=True, centered=True, size=13)
    doc.add_paragraph()

    add_p("Principales Fortalezas", bold=True, size=11)
    fortalezas = []
    if cel_p["ConsInd"] >= 75:   fortalezas.append(f"Consideración Individualizada (P{cel_p['ConsInd']}): atiende activamente el desarrollo y las necesidades de cada colaborador/a, construyendo vínculos de confianza sólidos.")
    if cam_p["Cons"] >= 75:      fortalezas.append(f"Liderazgo Considerado (P{cam_p['Cons']}): genera un ambiente de bienestar, contención y apoyo que favorece la retención y el compromiso del equipo.")
    if cam_p["Part"] >= 75:      fortalezas.append(f"Liderazgo Participativo (P{cam_p['Part']}): involucra y consulta activamente al equipo en las decisiones, generando sentido de pertenencia y apropiación de los objetivos.")
    if cam_p["Or"] >= 75:        fortalezas.append(f"Orientación a Metas (P{cam_p['Or']}): establece objetivos exigentes y alienta el rendimiento superior combinando desafío con apoyo.")
    if con_p["Rel"] >= 75:       fortalezas.append(f"Conductas de Relaciones (P{con_p['Rel']}): reconocimiento de logros, apoyo cercano e información fluida al equipo como herramientas cotidianas de gestión.")
    if con_p["Camb"] >= 75:      fortalezas.append(f"Conductas Orientadas al Cambio (P{con_p['Camb']}): genera alianzas, promueve nuevas estrategias y forma equipos orientados a la transformación.")
    if cel_p["TransfTot"] >= 75: fortalezas.append(f"Liderazgo Transformacional (P{cel_p['TransfTot']}): inspira y motiva al equipo hacia metas compartidas, trascendiendo el intercambio puramente transaccional.")
    if pot_p["Intr"] >= 75:      fortalezas.append(f"Motivación Intrínseca (P{pot_p['Intr']}): ejerce el liderazgo por convicción y disfrute genuino del rol, lo que se traduce en consistencia y autenticidad.")
    if neo_niv["E"] in ("Alto", "Muy Alto"):  fortalezas.append(f"Extraversión ({neo_niv['E']}, T={neo_t['E']}): sociabilidad y energía natural para construir vínculos de confianza y mantener al equipo conectado.")
    if neo_niv["N"] in ("Bajo", "Muy Bajo"):  fortalezas.append(f"Estabilidad Emocional ({neo_niv['N']}, T={neo_t['N']}): manejo sólido del estrés y la presión del rol, recurso fundamental para el liderazgo sostenido.")
    if not fortalezas: fortalezas.append("Ver análisis detallado en secciones anteriores.")
    for f in fortalezas:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.5)
        normal_run(p, f"• {f}")

    doc.add_paragraph()
    add_p("Principales Áreas de Desarrollo", bold=True, size=11)
    areas = []
    if cel_p["Laissez"] >= 75:  areas.append(f"Tendencia Laissez-Faire (P{cel_p['Laissez']}): reducir los episodios de no-intervención o delegación sin acompañamiento, especialmente con colaboradores de menor madurez.")
    if cam_p["Dir"] < 50:       areas.append(f"Liderazgo Directivo (P{cam_p['Dir']}): fortalecer la capacidad de dar instrucciones claras y establecer expectativas no negociables en situaciones de urgencia.")
    if cel_p["RecCont"] < 50:   areas.append(f"Recompensa Contingente (P{cel_p['RecCont']}): implementar un sistema explícito y sistemático de reconocimiento del buen desempeño.")
    if cel_p["Carisma"] < 50:   areas.append(f"Carisma e Influencia Simbólica (P{cel_p['Carisma']}): desarrollar el impacto simbólico y la capacidad de inspirar a través del relato y la comunicación.")
    if cel_p["EstimInt"] < 50:  areas.append(f"Estimulación Intelectual (P{cel_p['EstimInt']}): incorporar el cuestionamiento analítico y el desafío intelectual como herramientas de desarrollo del equipo.")
    if con_p["Tar"] < 50:       areas.append(f"Conductas de Tarea (P{con_p['Tar']}): fortalecer el monitoreo sistemático y la definición explícita de estándares de desempeño.")
    if neo_niv["N"] in ("Alto", "Muy Alto"): areas.append(f"Autorregulación Emocional (Neuroticismo {neo_niv['N']}, T={neo_t['N']}): desarrollar estrategias para gestionar la reactividad emocional bajo presión sostenida.")
    if not areas: areas.append("El perfil no presenta brechas significativas. Ver análisis detallado en secciones anteriores.")
    for a in areas:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.5)
        normal_run(p, f"• {a}")

    doc.add_paragraph()
    add_p("Objetivos de Desarrollo Sugeridos", bold=True, size=11)
    objetivos = []
    if cel_p["Laissez"] >= 75 or cam_p["Dir"] < 50:
        objetivos.append("Ampliar el repertorio directivo: practicar la intervención activa ante desvíos y la comunicación de expectativas no negociables. Definir criterios explícitos de cuándo dirigir, cuándo acompañar y cuándo delegar según la madurez del colaborador.")
    if cel_p["RecCont"] < 50 or cel_p["DirExc"] < 50:
        objetivos.append("Implementar un sistema de reconocimiento contingente: formalizar acuerdos de desempeño con recompensas asociadas y pasar de un reconocimiento espontáneo a uno sistemático y oportuno.")
    if cel_p["Carisma"] < 50 or cel_p["EstimInt"] < 50:
        objetivos.append("Desarrollar el impacto transformacional: entrenamiento en storytelling, relato de propósito compartido e incorporación de espacios de innovación y desafío intelectual en la dinámica del equipo.")
    if neo_niv["N"] not in ("Bajo", "Muy Bajo"):
        objetivos.append("Fortalecer la autorregulación emocional: técnicas de gestión del estrés, rutinas de recuperación y construcción de una red de apoyo entre líderes del mismo nivel.")
    if con_p["Tar"] < 50:
        objetivos.append("Consolidar las conductas de tarea: establecer rutinas de monitoreo de indicadores, definir estándares explícitos de desempeño y practicar el feedback de corrección de manera sistemática.")
    if not objetivos:
        objetivos.append("Continuar profundizando las fortalezas identificadas a través de procesos de coaching o mentoring ejecutivo.")
    for idx, obj in enumerate(objetivos, 1):
        p = doc.add_paragraph()
        bold_run(p, f"Objetivo {idx}: ")
        normal_run(p, obj)

    # ─── GUARDAR ───
    pc(99, "Guardando informe...")
    doc.save(output_path)
    try:
        os.remove(radar_path)
    except Exception:
        pass
    pc(100, f"Informe generado: {os.path.basename(output_path)}")
