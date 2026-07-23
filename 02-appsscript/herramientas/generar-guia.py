"""Arma PUESTA-EN-MARCHA.docx, la guía para subir el proyecto a Workspace.

El documento es el entregable; esto es lo que lo produce. Se versiona para que
la guía se pueda corregir editando el texto acá y regenerando, en vez de
retocar el .docx a mano y perder el rastro de qué cambió.

Uso:  python3 herramientas/generar-guia.py
"""
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

AZUL = RGBColor(0x2E, 0x54, 0x96)
AZUL_HEX = "2E5496"
AZUL_CLARO = "DCE6F1"
GRIS_CODIGO = "F2F4F8"
NARANJA = RGBColor(0xC5, 0x50, 0x00)

doc = Document()
for seccion in doc.sections:
    seccion.top_margin = Cm(2)
    seccion.bottom_margin = Cm(2)
    seccion.left_margin = Cm(2.2)
    seccion.right_margin = Cm(2.2)

normal = doc.styles["Normal"]
normal.font.name = "Calibri"
normal.font.size = Pt(10.5)


def sombrear(celda, color):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), color)
    celda._tc.get_or_add_tcPr().append(shd)


def sombrear_parrafo(parrafo, color):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), color)
    parrafo._p.get_or_add_pPr().append(shd)


def titulo(texto, tamano=16):
    p = doc.add_paragraph()
    r = p.add_run(texto)
    r.bold = True
    r.font.size = Pt(tamano)
    r.font.color.rgb = AZUL
    p.paragraph_format.space_after = Pt(6)
    return p


def paso(numero, texto):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run(f"Paso {numero}.  ")
    r.bold = True
    r.font.size = Pt(12.5)
    r.font.color.rgb = AZUL
    r = p.add_run(texto)
    r.bold = True
    r.font.size = Pt(12.5)
    r.font.color.rgb = AZUL
    return p


def parrafo(texto, negrita=False, cursiva=False, tamano=10.5, espacio=4):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(espacio)
    if texto:
        r = p.add_run(texto)
        r.bold = negrita
        r.italic = cursiva
        r.font.size = Pt(tamano)
    return p


def vineta(texto, negrita_hasta=None):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.6)
    p.paragraph_format.space_after = Pt(3)
    if negrita_hasta:
        r = p.add_run("• " + negrita_hasta)
        r.bold = True
        r.font.size = Pt(10.5)
        r = p.add_run(texto)
        r.font.size = Pt(10.5)
    else:
        r = p.add_run("• " + texto)
        r.font.size = Pt(10.5)
    return p


def codigo(lineas):
    for linea in lineas:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.5)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.space_before = Pt(0)
        sombrear_parrafo(p, GRIS_CODIGO)
        r = p.add_run(linea if linea else " ")
        r.font.name = "Consolas"
        r.font.size = Pt(9.5)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)


def tabla(encabezados, filas, anchos=None):
    t = doc.add_table(rows=len(filas) + 1, cols=len(encabezados))
    t.style = "Table Grid"
    for i, h in enumerate(encabezados):
        celda = t.rows[0].cells[i]
        celda.text = h
        sombrear(celda, AZUL_HEX)
        run = celda.paragraphs[0].runs[0]
        run.bold = True
        run.font.size = Pt(9.5)
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    for f, fila in enumerate(filas, start=1):
        for c, valor in enumerate(fila):
            celda = t.rows[f].cells[c]
            celda.text = str(valor)
            for run in celda.paragraphs[0].runs:
                run.font.size = Pt(9.5)
    if anchos:
        for fila in t.rows:
            for celda, ancho in zip(fila.cells, anchos):
                celda.width = Cm(ancho)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    return t


def aviso(texto, color=AZUL_CLARO):
    t = doc.add_table(rows=1, cols=1)
    celda = t.rows[0].cells[0]
    celda.text = texto
    sombrear(celda, color)
    for run in celda.paragraphs[0].runs:
        run.font.size = Pt(10)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)


# ─────────────────────────────────────────────────────────────────────
titulo("Puesta en marcha — Generador de Informes de Liderazgo", 17)
p = parrafo("Migración a Google Workspace (Apps Script + Drive + Sheets)", cursiva=True, tamano=11)
p.paragraph_format.space_after = Pt(2)
parrafo("Versión del 23/07/2026 · Proyecto fran (CCHH)", cursiva=True, tamano=9)

parrafo("")
parrafo(
    "Esta guía lleva el proyecto desde el código fuente hasta la aplicación funcionando para el "
    "equipo. Son ocho pasos. Los primeros cinco preparan el terreno, el sexto y el séptimo prueban "
    "que el motor funciona, y recién el octavo publica la app.",
)
aviso(
    "Importante: no publiques la aplicación web (paso 8) sin haber hecho antes la corrida de prueba "
    "(paso 7). Si algo falla, el error se lee mucho mejor en el registro del editor que a través de "
    "la interfaz."
)

paso(1, "Crear los recursos de Workspace")
parrafo("De cada recurso hay que anotar un dato, que después se carga en el paso 4.")
tabla(
    ["Recurso", "Dónde se crea", "Qué anotar"],
    [
        ["Grupo de Google", "admin.google.com o groups.google.com",
         "La dirección, ej. informes-rrhh@kolektor.com.ar"],
        ["Unidad compartida", "Drive → Unidades compartidas → nueva", "—"],
        ["Carpeta Informes", "dentro de la Unidad compartida", "El ID: en la URL, después de /folders/"],
        ["Carpeta Planillas", "dentro de la Unidad compartida", "El ID: igual que la anterior"],
        ["Sheet de historial", "dentro de la Unidad compartida", "El ID: en la URL, entre /d/ y /edit"],
    ],
    anchos=[3.6, 5.4, 7.5],
)
aviso(
    "Agregá el grupo como miembro de la Unidad compartida, con permiso de edición. Si no, la gente "
    "entra a la app pero no puede escribir los informes."
)

paso(2, "Crear el proyecto de Apps Script")
parrafo("Entrá a script.google.com y creá un proyecto nuevo. Ponele un nombre reconocible.")
parrafo("Copiá el ID del script desde Configuración del proyecto (el engranaje de la izquierda).")

paso(3, "Subir el código")
parrafo("Desde una terminal, una sola vez:")
codigo(["npm install -g @google/clasp", "clasp login"])
parrafo("Habilitá la API de Apps Script, también una sola vez, entrando a:")
codigo(["https://script.google.com/home/usersettings"])
parrafo("Después, para subir el proyecto:")
codigo([
    "cd /home/coder/CCHH/fran/02-appsscript",
    'echo \'{"scriptId":"PEGAR_EL_ID_ACA","rootDir":"."}\' > .clasp.json',
    "clasp push",
])
parrafo(
    "Tienen que subir 14 archivos: 12 terminados en .gs, más Interfaz.html y appsscript.json. "
    "Si aparece algo de la carpeta tests, el archivo .claspignore no se aplicó: pará ahí y avisame.",
)
parrafo(
    "Si no tenés navegador para hacer el clasp login, la alternativa es crear los archivos a mano en "
    "el editor web: Archivo → Nuevo → Script para cada .gs, Archivo → Nuevo → HTML para Interfaz, y "
    "activar “Mostrar el archivo de manifiesto appsscript.json” en Configuración.",
    cursiva=True,
)

paso(4, "Configurar las propiedades del script")
parrafo("En Configuración del proyecto → Propiedades del script, agregar estas cinco:")
tabla(
    ["Propiedad", "Qué valor lleva"],
    [
        ["CARPETA_INFORMES_ID", "ID de la carpeta Informes"],
        ["CARPETA_PLANILLAS_ID", "ID de la carpeta Planillas"],
        ["HISTORIAL_SHEET_ID", "ID del Sheet de historial"],
        ["GRUPO_AUTORIZADO", "Dirección del Grupo de Google"],
        ["PLANILLA_PRUEBA_ID", "ID de la planilla de prueba (paso 5)"],
    ],
    anchos=[6.0, 10.5],
)
parrafo(
    "Ninguno de estos valores está escrito en el código: cambian entre el entorno de prueba y el "
    "real, y un ID pegado en el código sería un cambio de código cada vez.",
    cursiva=True,
)

paso(5, "Dejar una planilla de prueba")
parrafo(
    "Subí el archivo “Planilla de Preguntas - Chavo.xlsx” (está en compartido/instrumentos/) a la "
    "carpeta Planillas."
)
aviso(
    "Subila SIN convertir a Google Sheets. Así se prueba el camino de conversión automática, que es "
    "el que conviene verificar."
)
parrafo("Copiá el ID del archivo subido y ponelo en la propiedad PLANILLA_PRUEBA_ID.")

paso(6, "Chequeo previo, sin generar nada")
parrafo("En el editor de Apps Script, elegí la función verificarConfiguracion y apretá Ejecutar.")
parrafo(
    "La primera vez te va a pedir autorizar permisos: Documentos, Hojas de cálculo, Drive, tu "
    "dirección de correo y grupos. Revisá la lista y aceptá."
)
parrafo("En el registro tenés que ver tus tres IDs y la línea:")
codigo(["¿Autorizado?: true"])
parrafo("Si dice false, no estás en el grupo. Resolvelo antes de seguir.")

paso(7, "La corrida real")
parrafo("Elegí la función pruebaDeHumo y apretá Ejecutar. En el registro esperás algo así:")
codigo([
    "Informe generado en 4.2 segundos",
    "Archivo: INFORME_Prueba de humo_20260723_181500.docx",
    "Link: https://drive.google.com/file/d/...",
])
parrafo("Qué revisar, en este orden:", negrita=True)
vineta("abrilo y compará contra 01-legacy-python/salidas/INFORME_Chavo.docx. Las tablas, los colores y los textos tienen que coincidir.", "El .docx en la carpeta Informes: ")
vineta("es lo único que cambia de tecnología. Miralo con la comparación que ya aprobaste.", "El gráfico radar: ")
vineta("una fila nueva, con el link al informe.", "El Sheet de historial: ")
vineta("en “Mi unidad” no tiene que quedar radar-temporal, ni un documento llamado INFORME_… sin extensión, ni una copia terminada en “(convertida)”. Los tres van a la papelera solos.", "Que no haya quedado basura: ")

paso(8, "Publicar la aplicación web")
parrafo("Recién ahora, con el motor probado: Implementar → Nueva implementación → Aplicación web.")
tabla(
    ["Campo", "Valor"],
    [
        ["Ejecutar como", "Usuario que accede"],
        ["Quién tiene acceso", "Cualquier usuario de Kolektor"],
    ],
    anchos=[6.0, 10.5],
)
parrafo(
    "Eso devuelve la URL para repartir al grupo. El control fino lo hace el código: aunque alguien "
    "de Kolektor tenga la URL, si no está en el grupo ve una pantalla de “Sin acceso”."
)
parrafo("Probá desde la app: generar un informe, calificarlo desde el historial y abrir la pestaña Métricas.")

doc.add_page_break()

titulo("Si algo falla", 14)
parrafo(
    "Todo el código está verificado en una computadora, contra servicios de Google simulados. Eso "
    "da confianza sobre la lógica —las cuentas, los textos, el formato— pero no prueba que la API "
    "real se comporte igual que el simulacro. Estos son los tres puntos donde espero fricción, en "
    "orden de probabilidad:"
)
tabla(
    ["Dónde", "Síntoma", "Qué mirar"],
    [
        ["Exportación a .docx\n(Informe.gs)", "Error “No se pudo exportar el informe a .docx”",
         "El código de error que aparece en el mensaje"],
        ["Imagen del radar\n(Radar.gs)", "Error al exportar el gráfico como imagen",
         "Si el gráfico llegó a insertarse en la planilla temporal"],
        ["Opciones del radar\n(Radar.gs)", "El gráfico sale, pero la escala no se ve como se esperaba",
         "El eje: en un gráfico polar puede comportarse distinto"],
    ],
    anchos=[4.2, 6.3, 6.0],
)
aviso(
    "Si algo falla, copiá el mensaje completo del registro y pasámelo. No edites el código en el "
    "editor web: el próximo clasp push lo pisa, y el cambio queda fuera del repositorio y de las "
    "verificaciones.",
    color="FCE4D6",
)

titulo("Dos cosas pendientes que no bloquean nada", 14)
p = parrafo("")
r = p.add_run("Puntajes NEO fuera del baremo. ")
r.bold = True
r.font.color.rgb = NARANJA
r = p.add_run(
    "El motor actual informa “Promedio” cuando el puntaje directo no está en la tabla de baremos, y "
    "las tablas no cubren todo el rango posible. En Apertura, por ejemplo, el baremo llega hasta 44 "
    "sobre un máximo de 48: alguien con el puntaje más alto posible recibe un informe que dice "
    "“Promedio”. Pasa lo mismo con Extraversión por debajo de 13, y con Amabilidad y Responsabilidad "
    "por debajo de 16. Está portado tal cual, sin cambios. Es una decisión psicométrica, no técnica: "
    "hay que definir si corresponde extrapolar al extremo de la tabla o marcar el puntaje como fuera "
    "de rango."
)
r.font.size = Pt(10.5)

p = parrafo("")
r = p.add_run("Un modelo .docx que rompe el generador actual. ")
r.bold = True
r.font.color.rgb = NARANJA
r = p.add_run(
    "El archivo compartido/modelos/MODELO DE INFORME.docx no tiene el estilo “Normal Table” y hace "
    "fallar a la app Python; sin embargo aparece igual en el desplegable, porque la app lista toda "
    "la carpeta. En la versión de Workspace el problema desaparece, porque ya no hay modelo que "
    "elegir. Queda anotado por si se sigue usando la versión vieja en paralelo."
)
r.font.size = Pt(10.5)

SALIDA = Path(__file__).resolve().parents[1] / "PUESTA-EN-MARCHA.docx"
doc.save(SALIDA)
print(f"Guía generada: {SALIDA}")
