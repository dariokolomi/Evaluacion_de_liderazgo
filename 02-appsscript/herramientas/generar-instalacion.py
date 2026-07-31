"""Arma INSTALACION-DESDE-CERO.docx, la guía breve para montar la app en Workspace.

QUÉ LA DIFERENCIA DE PUESTA-EN-MARCHA.docx: aquella se escribió cuando el código
todavía no estaba subido y su objetivo era la primera puesta en marcha, con la
verificación paso a paso de que el port funcionaba. Ya cumplió. Ésta asume que la
aplicación existe y funciona, y sirve para montarla de nuevo desde cero —otro
dominio, un entorno de prueba, una reinstalación—.

Dos cosas de la guía vieja quedaron desactualizadas y acá se corrigen:

  - El paso de publicación decía «Ejecutar como: Usuario que accede». El manifiesto
    declara `executeAs: USER_DEPLOYING` desde «Declarar en el manifiesto que la app
    corre como quien la desplegó», así que hoy es «Yo».
  - Ya no son 14 archivos ni 12 .gs: el punto 6 sumó Puesto.gs, y antes habían
    entrado Sintesis.gs y Progreso.gs.

Uso:  pip install python-docx && python3 herramientas/generar-instalacion.py
"""
from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

AZUL = RGBColor(0x2E, 0x54, 0x96)
AZUL_HEX = "2E5496"
AZUL_CLARO = "DCE6F1"
AMBAR = "FCE4D6"
GRIS_CODIGO = "F2F4F8"

SALIDA = Path(__file__).resolve().parents[1] / "INSTALACION-DESDE-CERO.docx"

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


def sombrear_parrafo(parrafo_, color):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), color)
    parrafo_._p.get_or_add_pPr().append(shd)


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
    for t in (f"Paso {numero}.  ", texto):
        r = p.add_run(t)
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
titulo("Instalación desde cero en Google Workspace", 17)
p = parrafo("Generador de Informes de Liderazgo — CCHH", cursiva=True, tamano=11)
p.paragraph_format.space_after = Pt(2)
parrafo("Guía resumida · versión de la app: v2.19", cursiva=True, tamano=9)

parrafo("")
parrafo(
    "Ocho pasos para dejar la aplicación funcionando en un Workspace vacío. Los pasos 1 a 5 "
    "preparan el terreno, el 6 y el 7 prueban que el motor anda, y recién el 8 publica la app "
    "para el equipo."
)
aviso(
    "No publiques la aplicación web (paso 8) sin haber hecho la corrida de prueba (paso 7). "
    "Si algo falla, el error se lee mucho mejor en el registro del editor que a través de la "
    "interfaz."
)

paso(1, "Crear los recursos de Workspace")
parrafo("De cada recurso hay que anotar un dato, que se carga en el paso 4.")
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
    "Las dos carpetas pueden ser la misma. Si lo son, los tres archivos de cada evaluación "
    "—informe, planilla y perfil de puesto— quedan juntos al ordenar por nombre, que es para lo "
    "que sirve el código correlativo."
)
aviso(
    "Agregá el grupo como miembro de la Unidad compartida con permiso de edición. Si no, la gente "
    "entra a la app pero no se pueden escribir los informes."
)

paso(2, "Crear el proyecto de Apps Script")
parrafo("Entrá a script.google.com, creá un proyecto nuevo y ponele un nombre reconocible.")
parrafo("Copiá el ID del script desde Configuración del proyecto (el engranaje de la izquierda).")

paso(3, "Subir el código")
parrafo("Una sola vez, desde una terminal:")
codigo(["npm install -g @google/clasp", "clasp login"])
parrafo("Habilitá la API de Apps Script, también una sola vez, entrando a:")
codigo(["https://script.google.com/home/usersettings"])
parrafo("Después, para subir el proyecto:")
codigo([
    "cd 02-appsscript",
    'echo \'{"scriptId":"PEGAR_EL_ID_ACA","rootDir":""}\' > .clasp.json',
    "clasp push",
])
parrafo(
    "Suben 18 archivos: 16 terminados en .gs, más Interfaz.html y appsscript.json. Si aparece algo "
    "de la carpeta tests o de herramientas, el .claspignore no se aplicó: pará y revisalo.",
)

paso(4, "Configurar las propiedades del script")
parrafo("En Configuración del proyecto → Propiedades del script:")
tabla(
    ["Propiedad", "Qué valor lleva", "¿Obligatoria?"],
    [
        ["CARPETA_INFORMES_ID", "ID de la carpeta Informes", "Sí"],
        ["CARPETA_PLANILLAS_ID", "ID de la carpeta Planillas", "Sí"],
        ["HISTORIAL_SHEET_ID", "ID del Sheet de historial", "Sí"],
        ["GRUPO_AUTORIZADO", "Dirección del Grupo de Google", "Sí"],
        ["PLANILLA_PRUEBA_ID", "ID de la planilla del paso 5", "Sólo para el paso 7"],
        ["NVIDIA_API_KEY", "Clave del proveedor del modelo", "No"],
    ],
    anchos=[5.2, 8.0, 3.3],
)
parrafo(
    "Sin NVIDIA_API_KEY la app funciona igual: los puntos 5 y 6 salen con el texto armado por "
    "reglas en vez del redactado por el modelo, y la interfaz avisa que pasó eso. Los números no "
    "dependen del modelo en ningún caso.",
    cursiva=True,
)
aviso(
    "No definas NVIDIA_MODELO salvo que sepas por qué. Si está, pisa la lista del código y te deja "
    "sin el modelo suplente: cuando el principal falla por cuota, el informe cae directo al texto "
    "por reglas en lugar de intentar con el otro.",
    color=AMBAR,
)

paso(5, "Dejar una planilla de prueba")
parrafo(
    "Subí “Planilla de Preguntas - Chavo.xlsx” (está en compartido/instrumentos/) a la carpeta "
    "Planillas."
)
aviso(
    "Subila SIN convertir a Google Sheets. Así se prueba el camino de conversión automática, que "
    "es el que van a recorrer las planillas reales."
)
parrafo("Copiá el ID del archivo subido y ponelo en PLANILLA_PRUEBA_ID.")

paso(6, "Chequeo previo, sin generar nada")
parrafo("En el editor, elegí la función verificarConfiguracion y apretá Ejecutar.")
parrafo(
    "La primera vez pide autorizar permisos: Documentos, Hojas de cálculo, Drive, tu dirección de "
    "correo y grupos. Revisá la lista y aceptá."
)
parrafo("En el registro tienen que aparecer tus IDs y la línea:")
codigo(["¿Autorizado?: true"])
parrafo("Si dice false, no estás en el grupo. Resolvelo antes de seguir.")

paso(7, "La corrida real")
parrafo("Elegí pruebaDeHumo y apretá Ejecutar. Tarda varios minutos: la mayor parte es el modelo.")
parrafo("Qué revisar, en este orden:", negrita=True)
vineta("el .docx tiene que estar en la carpeta Informes, con el código adelante (A01-INFORME …).",
       "El archivo: ")
vineta("una fila nueva, con el link al informe, el código y el usuario que lo generó.",
       "El Sheet de historial: ")
vineta("la planilla de prueba tiene que haberse renombrado con el mismo código (A01-PLANILLA …).",
       "El insumo: ")
vineta("en “Mi unidad” no puede quedar un radar temporal, ni un documento sin extensión, ni una "
       "copia terminada en “(convertida)”. Los tres se descartan solos.", "Que no haya basura: ")

paso(8, "Publicar la aplicación web")
parrafo("Recién ahora: Implementar → Nueva implementación → Aplicación web.")
tabla(
    ["Campo", "Valor"],
    [
        ["Ejecutar como", "Yo (la cuenta que despliega)"],
        ["Quién tiene acceso", "Cualquier usuario del dominio"],
    ],
    anchos=[6.0, 10.5],
)
aviso(
    "«Ejecutar como: Yo» no es una preferencia: lo declara el manifiesto (executeAs: "
    "USER_DEPLOYING) y el código depende de eso. La app entra a Drive con las credenciales del "
    "que despliega, así que los permisos de Drive no filtran a nadie y el Grupo de Google queda "
    "como única barrera. Por eso cada función verifica la pertenencia al grupo por su cuenta.",
    color=AMBAR,
)
parrafo(
    "Desplegá desde una cuenta de área o de servicio, no desde la personal de alguien. Si esa "
    "cuenta se desactiva, la aplicación deja de funcionar para todos.",
    negrita=True,
)
parrafo("Eso devuelve la URL para repartir al grupo. Probá desde la app: generar un informe, "
        "calificarlo desde el historial y abrir la pestaña Métricas.")

doc.add_page_break()

titulo("Después de instalar", 14)
parrafo("Cosas que conviene tener presentes desde el primer día.", espacio=8)

titulo("Actualizar la app", 12)
parrafo("Subir el código y mover la implementación fijada, en dos comandos:")
codigo([
    "clasp push",
    'clasp deploy -i <ID_DEL_DEPLOYMENT> -d "v2.20 - qué cambió"',
])
parrafo(
    "Actualizar el deployment existente —y no crear uno nuevo— es lo que mantiene la URL. Antes de "
    "pushear, subí a mano VERSION_APP en WebApp.gs: ese número es lo único que permite ver de un "
    "vistazo qué código está sirviendo el navegador.",
    cursiva=True,
)

titulo("Dar de alta a una persona", 12)
parrafo(
    "Agregarla al Grupo de Google y nada más: no necesita permisos propios sobre Drive. Tener en "
    "cuenta que dentro del grupo todos ven todo, así que el alta da acceso a los informes de todas "
    "las personas evaluadas. El detalle está en RESUMEN-Y-ACCESOS.md."
)

titulo("Si algo falla", 12)
tabla(
    ["Síntoma", "Dónde mirar"],
    [
        ["“Falta configurar el proyecto…”", "El mensaje nombra la propiedad que falta y para qué es"],
        ["“Sin acceso” con la cuenta correcta", "Membresía en el grupo; el alta puede tardar en propagar"],
        ["Se generó el informe pero no figura en el historial",
         "Ejecutar verificarHistorialContraDrive: lista los archivos sin fila"],
        ["El punto 5 sale con el texto básico",
         "La interfaz dice el motivo. Suele ser la clave o la cuota del modelo"],
        ["Cualquier error al generar", "Ejecuciones, en el menú izquierdo del editor"],
    ],
    anchos=[7.0, 9.5],
)
parrafo(
    "El registro de Ejecuciones es el primer lugar a mirar siempre: dice la duración, el estado y "
    "la excepción exacta de cada corrida.",
    cursiva=True,
)

doc.save(SALIDA)
print(f"Escrito: {SALIDA}")
