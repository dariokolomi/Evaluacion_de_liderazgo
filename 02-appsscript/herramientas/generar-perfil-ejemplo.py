"""Arma "PERFIL DE PUESTO - ejemplo.pdf", el perfil de puesto de muestra del punto 6.

POR QUÉ ESTE ARCHIVO EXISTE Y NO EL ORIGINAL: el punto 6 se desarrolló y se probó
contra un perfil de puesto real, en la plantilla corporativa del cliente —con su
logo, sus colores y su línea de reporte—. Ese PDF no se puede versionar en un
repositorio público. Lo que hay que conservar no es su contenido sino su FORMA:
qué secciones tiene un perfil de puesto, con qué rótulos y en qué orden, que es
contra lo que `leerPerfilDePuesto` (Puesto.gs) aprendió a leer.

Así que esto reconstruye la estructura y la llena con contenido genérico de la
industria. No queda nada del original: ni marca, ni paleta, ni la línea de
reporte, ni la plantilla rasterizada que la traía incrustada.

El contenido de ejemplo sí es deliberado: las competencias de las dos últimas
filas son las que el lector mapea contra las dimensiones que miden los cinco
instrumentos, así que un ejemplo sin ellas no serviría para probar nada.

Uso:  pip install reportlab && python3 herramientas/generar-perfil-ejemplo.py
"""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (BaseDocTemplate, Frame, PageBreak, PageTemplate,
                                Paragraph, Spacer, Table, TableStyle)

# La paleta es la del propio informe (Documento.gs), no la del cliente: si el
# ejemplo se pareciera a la plantilla original volveríamos al problema que este
# archivo existe para resolver.
AZUL = colors.HexColor("#2E5496")
AZUL_CLARO = colors.HexColor("#DCE6F1")
GRIS = colors.HexColor("#7B8794")
BORDE = colors.HexColor("#B9C6D9")

SALIDA = Path(__file__).resolve().parents[2] / "compartido" / "modelos" / "PERFIL DE PUESTO - ejemplo.pdf"

titulo = ParagraphStyle("titulo", fontName="Helvetica-Bold", fontSize=16,
                        textColor=AZUL, spaceAfter=14)
seccion = ParagraphStyle("seccion", fontName="Helvetica-Bold", fontSize=11,
                         textColor=colors.white, alignment=TA_CENTER, leading=14)
rotulo = ParagraphStyle("rotulo", fontName="Helvetica-Bold", fontSize=8.5,
                        textColor=colors.HexColor("#2b3a4a"), leading=11)
cuerpo = ParagraphStyle("cuerpo", fontName="Helvetica", fontSize=8.5,
                        textColor=colors.HexColor("#2b3a4a"), leading=12)
pie = ParagraphStyle("pie", fontName="Helvetica-Oblique", fontSize=7.5,
                     textColor=GRIS, alignment=TA_CENTER)

PUESTO = "Scrum Master"

IDENTIFICACION = [
    ("GERENCIA", "Tecnología"),
    ("SECTOR", "Desarrollo de Software"),
    ("DEPENDE DE", "Jefatura de Desarrollo"),
    ("PERSONAL A CARGO", "Sí"),
]

MISION = (
    "Liderar y facilitar el funcionamiento de un equipo ágil, relevando y transformando "
    "necesidades de negocio en requerimientos funcionales claros, coordinando los recursos y "
    "procesos necesarios para asegurar la entrega continua de valor, la calidad de las "
    "soluciones y la mejora continua del equipo y del producto."
)

RESPONSABILIDADES_1 = [
    ("1) Liderazgo y Gestión del Equipo:", [
        "Guiar y motivar al equipo para alcanzar los objetivos del proyecto.",
        "Facilitar una comunicación efectiva dentro y hacia fuera del equipo.",
        "Establecer metas claras y medibles para el equipo.",
        "Velar por el cumplimiento del Framework Scrum, organizando y liderando reuniones "
        "diarias de scrum, retrospectivas y planificación de sprint.",
        "Eliminar obstáculos e impedimentos.",
        "Implementar procesos de mejora continua basados en retroalimentación y aprendizaje.",
        "Colaborar entre equipos y con otros líderes de área, promoviendo la comunicación "
        "efectiva entre equipos interdisciplinarios.",
    ]),
    ("2) Administración de Recursos y Proyectos:", [
        "Contribuir a la asignación de tareas y responsabilidades de manera eficiente.",
        "Gestionar la carga de trabajo y equilibrar la capacidad del equipo.",
        "Supervisar la disponibilidad y asignación de recursos.",
        "Realizar seguimiento del rendimiento individual y del equipo.",
        "Supervisar el progreso del producto y asegurar la entrega oportuna.",
    ]),
    ("3) Resolución de problemas:", [
        "Capacidad para analizar, obtener información y resolver un problema, realizando las "
        "delegaciones que correspondan.",
    ]),
]

RESPONSABILIDADES_2 = [
    ("4) Relevamiento y análisis de requerimientos:", [
        "Entendimiento del negocio.",
        "Relevar y gestionar las necesidades funcionales del negocio, entrevistando a los "
        "distintos stakeholders.",
        "Evaluar la factibilidad técnica de los requerimientos.",
        "Comprensión integral del proceso de punta a punta.",
    ]),
    ("5) Especificaciones técnicas de requerimientos:", [
        "Convertir necesidades de negocio en especificaciones claras, documentando en detalle "
        "en épicas y/o historias de usuario.",
        "Validar y obtener la aprobación de las definiciones del Product Owner.",
        "Detectar eventuales omisiones en el pedido de los stakeholders.",
        "Dar soporte a desarrolladores y testers, y soporte post implementación.",
    ]),
    ("6) Conocimiento técnico:", [
        "Contar con conocimiento en aplicaciones web y arquitectura de software, con "
        "entendimiento de las distintas capas de una aplicación.",
        "Conocimiento para realizar consultas a bases de datos y a servicios de aplicaciones.",
        "Lectura de logs de frontend y backend con el objetivo de analizar un problema.",
    ]),
]

REQUISITOS = [
    ("EXPERIENCIA", "EXCLUYENTE",
     "Al menos 4-5 años de experiencia total en IT y funciones de Análisis Funcional y/o "
     "Liderazgo Ágil."),
    ("", "NO EXCLUYENTE",
     "Experiencia previa en equipos distribuidos o multi-sede."),
    ("FORMACIÓN", "EXCLUYENTE",
     "Título universitario o terciario en Sistemas de Información, Ingeniería en Sistemas, "
     "Ingeniería Informática, Licenciatura en Informática, Analista de Sistemas o carreras afines."),
    ("", "NO EXCLUYENTE",
     "Certificación en marcos de trabajo ágiles."),
    ("COMPETENCIAS TÉCNICAS Y HABILIDADES", "",
     "Capacidad de Análisis, Orientación al Cliente, Toma de Decisiones, Autogestión, "
     "Capacidad de Adaptación, Productividad, Conocimiento Técnico."),
    ("COMPETENCIAS BLANDAS", "",
     "Iniciativa, Proactividad, Empatía, Relaciones Interpersonales, Responsabilidad, "
     "Comunicación eficiente, Comunicación asertiva."),
    ("OBSERVACIONES", "", "Jornada completa."),
]


def barra(texto):
    """El rótulo de sección: en el original es una banda de color con el texto centrado."""
    t = Table([[Paragraph(texto, seccion)]], colWidths=[17 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), AZUL),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def bloque_responsabilidades(grupos):
    filas = []
    for encabezado, puntos in grupos:
        filas.append([Paragraph(encabezado, rotulo)])
        for p in puntos:
            filas.append([Paragraph("• " + p, cuerpo)])
    t = Table(filas, colWidths=[17 * cm])
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.75, BORDE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    return t


def pie_de_pagina(canvas, doc):
    """En el original acá va el logo del cliente. Va un aviso en su lugar."""
    canvas.saveState()
    canvas.setFont("Helvetica-Oblique", 7.5)
    canvas.setFillColor(GRIS)
    canvas.drawCentredString(A4[0] / 2, 1.2 * cm,
                             "Documento de ejemplo — estructura de referencia, sin datos reales")
    canvas.restoreState()


def construir():
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(str(SALIDA), pagesize=A4,
                          leftMargin=2 * cm, rightMargin=2 * cm,
                          topMargin=2 * cm, bottomMargin=2 * cm,
                          title="Perfil de Puesto - ejemplo",
                          author="Ejemplo", subject="Perfil de puesto de muestra",
                          creator="generar-perfil-ejemplo.py")
    marco = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="base", frames=[marco], onPage=pie_de_pagina)])

    h = []
    h.append(Paragraph("PERFIL DE PUESTO: " + PUESTO, titulo))

    h.append(barra("IDENTIFICACIÓN DEL PUESTO"))
    ident = Table([[Paragraph(k, rotulo), Paragraph(v, cuerpo)] for k, v in IDENTIFICACION],
                  colWidths=[5 * cm, 12 * cm])
    ident.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.75, BORDE),
        ("BACKGROUND", (0, 0), (0, -1), AZUL_CLARO),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    h.append(ident)
    h.append(Spacer(1, 10))

    h.append(barra("MISIÓN DEL PUESTO"))
    mision = Table([[Paragraph(MISION, cuerpo)]], colWidths=[17 * cm])
    mision.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.75, BORDE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    h.append(mision)
    h.append(Spacer(1, 10))

    h.append(barra("PRINCIPALES RESPONSABILIDADES, FUNCIONES Y TAREAS"))
    h.append(bloque_responsabilidades(RESPONSABILIDADES_1))

    h.append(PageBreak())
    h.append(Paragraph("PERFIL DE PUESTO: " + PUESTO, titulo))
    h.append(barra("PRINCIPALES RESPONSABILIDADES, FUNCIONES Y TAREAS (continuación)"))
    h.append(bloque_responsabilidades(RESPONSABILIDADES_2))

    h.append(PageBreak())
    h.append(Paragraph("PERFIL DE PUESTO: " + PUESTO, titulo))
    h.append(barra("REQUISITOS PARA EL PUESTO"))
    filas = [[Paragraph(a, rotulo), Paragraph(b, rotulo), Paragraph(c, cuerpo)]
             for a, b, c in REQUISITOS]
    req = Table(filas, colWidths=[4.5 * cm, 3 * cm, 9.5 * cm])
    req.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.75, BORDE),
        ("BACKGROUND", (0, 0), (0, -1), AZUL_CLARO),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    h.append(req)

    doc.build(h)
    print("Escrito:", SALIDA)


if __name__ == "__main__":
    construir()
