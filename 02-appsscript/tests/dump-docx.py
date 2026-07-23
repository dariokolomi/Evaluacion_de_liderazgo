"""Genera el informe con el motor Python y vuelca su estructura a JSON.

No compara archivos .docx byte a byte —eso no diría nada— sino la estructura
que el informe tiene adentro: el orden de los párrafos y tablas, el texto de
cada tramo con su formato, y el sombreado de cada celda. Es lo que después
tiene que reproducir Documento.gs (ver verificar-documento.js).

Las 3 planillas reales no recorren las secciones condicionales del informe
(fortalezas, áreas de desarrollo, objetivos) ni los 25 textos de NEO, así que
además se escriben planillas sintéticas de verdad —archivos .xlsx con la misma
disposición— y se las hace pasar por el motor completo.

Uso:  python3 dump-docx.py                  # reales + 12 sintéticas
      python3 dump-docx.py --sinteticas 30  # más perfiles sintéticos
      python3 dump-docx.py <planilla.xlsx>  # una planilla puntual
"""
import importlib.util
import json
import random
import sys
import tempfile
from pathlib import Path

import openpyxl
from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

RAIZ = Path(__file__).resolve().parents[2]
MOTOR = RAIZ / "01-legacy-python"
PLANILLAS = RAIZ / "compartido" / "instrumentos"
# Ojo: "MODELO DE INFORME.docx" no sirve — no trae el estilo 'Normal Table' y el
# motor falla con él. Este es el mismo archivo que usa la distribución Windows.
MODELO = RAIZ / "compartido" / "modelos" / "MODELO DE INFORME 2.docx"
SALIDA = Path(__file__).parent / "documento-python.json"

sys.path.insert(0, str(MOTOR))
from run_engine import run_informe  # noqa: E402


def _importar(nombre, ruta):
    """El nombre del archivo tiene guiones, así que no se puede importar directo."""
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


referencia = _importar("dump_referencia", Path(__file__).parent / "dump-referencia.py")

EMU_POR_PUNTO = 12700


# ── Planillas sintéticas ────────────────────────────────────────────

def escribir_planilla(destino, respuestas):
    """Escribe un .xlsx con la disposición que espera el motor."""
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    hoja = wb.create_sheet("NEO")
    hoja["A1"] = "Instrucciones"
    for item, letra in respuestas["neo"].items():
        hoja.cell(row=5 + item, column=1, value=f"{item}. enunciado del ítem")
        hoja.cell(row=5 + item, column=2, value=letra)

    hoja = wb.create_sheet("CELID-A")
    hoja["A1"] = "Instrucciones"
    for item, valor in respuestas["celid"].items():
        hoja.cell(row=3 + item, column=1, value=item)
        hoja.cell(row=3 + item, column=4, value=valor)

    for nombre, clave in (("POTENLID", "potenlid"), ("CAMIN-A", "camin"), ("CONLID-A", "conlid")):
        hoja = wb.create_sheet(nombre)
        hoja["A1"] = "Instrucciones"
        for item, valor in respuestas[clave].items():
            hoja.cell(row=2 + item, column=1, value=item)
            hoja.cell(row=2 + item, column=3, value=valor)

    wb.save(destino)


def respuestas_neo_dirigidas(neo_key, dim, objetivo, respuestas):
    """Lleva una dimensión de NEO a un puntaje directo exacto, sin tocar las otras.

    Cada ítem pertenece a una sola dimensión, así que se la puede empujar
    aparte. Se apunta a un puntaje y no al extremo de la escala porque los
    baremos no cubren todo el rango posible: en Apertura, por ejemplo, llegan
    hasta 44 sobre un máximo de 48, y lo que queda afuera cae en el T=50 por
    defecto. Apuntando a los extremos del baremo aparecen 'Muy Alto' y
    'Muy Bajo', que ningún perfil al azar alcanza."""
    dirigidas = {clave: dict(valores) for clave, valores in respuestas.items()}
    restante = objetivo
    for signo, item in neo_key[dim]:
        aporte = max(0, min(4, restante))
        restante -= aporte
        indice = aporte if signo == "+" else 4 - aporte
        dirigidas["neo"][item] = "ABCDE"[indice]
    return dirigidas


def a_puntos(largo):
    return None if largo is None else round(largo / EMU_POR_PUNTO, 2)


def color_de(run):
    color = run.font.color
    if color is None or color.rgb is None:
        return None
    return "#" + str(color.rgb)


def tiene_salto_de_pagina(p):
    for br in p._p.findall(".//" + qn("w:br")):
        if br.get(qn("w:type")) == "page":
            return True
    return False


def imagen_de(p):
    extents = p._p.findall(".//" + qn("wp:extent"))
    if not extents:
        return None
    ext = extents[0]
    return {
        "ancho": round(int(ext.get("cx")) / EMU_POR_PUNTO, 2),
        "alto": round(int(ext.get("cy")) / EMU_POR_PUNTO, 2),
    }


def relleno_de(celda):
    tcPr = celda._tc.tcPr
    if tcPr is None:
        return None
    shd = tcPr.find(qn("w:shd"))
    if shd is None:
        return None
    fill = shd.get(qn("w:fill"))
    return None if fill in (None, "auto") else "#" + fill.upper()


def formato_de_celda(celda):
    runs = celda.paragraphs[0].runs if celda.paragraphs else []
    primero = runs[0] if runs else None
    return {
        "texto": celda.text,
        "negrita": bool(primero.bold) if primero is not None else False,
        "tamano": (primero.font.size.pt if primero is not None and primero.font.size else None),
        "color": color_de(primero) if primero is not None else None,
        "fondo": relleno_de(celda),
    }


def estructura(ruta_docx):
    doc = Document(str(ruta_docx))
    bloques = []
    for hijo in doc.element.body.iterchildren():
        etiqueta = hijo.tag.split("}")[-1]
        if etiqueta == "p":
            p = Paragraph(hijo, doc)
            if tiene_salto_de_pagina(p):
                bloques.append({"tipo": "salto"})
                continue
            imagen = imagen_de(p)
            if imagen:
                bloques.append({"tipo": "imagen", **imagen})
                continue
            bloques.append({
                "tipo": "parrafo",
                "centrado": p.alignment is not None and p.alignment == 1,
                "sangria": a_puntos(p.paragraph_format.left_indent),
                "tramos": [
                    {
                        "texto": r.text,
                        "negrita": bool(r.bold),
                        "cursiva": bool(r.italic),
                        "tamano": r.font.size.pt if r.font.size else None,
                        "color": color_de(r),
                    }
                    for r in p.runs
                ],
            })
        elif etiqueta == "tbl":
            tabla = Table(hijo, doc)
            bloques.append({
                "tipo": "tabla",
                "filas": [[formato_de_celda(c) for c in fila.cells] for fila in tabla.rows],
            })
    return bloques


def main():
    argv = sys.argv[1:]
    sinteticas = 12
    if "--sinteticas" in argv:
        i = argv.index("--sinteticas")
        sinteticas = int(argv[i + 1])
        argv = argv[:i] + argv[i + 2:]
    rutas = [Path(a) for a in argv]
    if not rutas:
        rutas = sorted(PLANILLAS.glob("Planilla de Preguntas - *.xlsx"))
    else:
        sinteticas = 0

    codigo = referencia.bloque_de_correccion()
    informes = []

    with tempfile.TemporaryDirectory() as tmp:
        def generar(nombre, ruta_planilla, respuestas):
            salida = Path(tmp) / f"{nombre}.docx"
            radar = Path(tmp) / f"{nombre}.png"
            try:
                run_informe(str(ruta_planilla), str(MODELO), str(salida), str(radar), nombre, lambda *_: None)
            except Exception as e:
                print(f"  ✗ {nombre}: {type(e).__name__}: {e}")
                return False
            informes.append({
                "planilla": Path(ruta_planilla).name,
                "nombre": nombre,
                "respuestas": {k: referencia.a_claves_str(v) for k, v in respuestas.items()},
                "bloques": estructura(salida),
            })
            print(f"  ✓ {nombre} → {len(informes[-1]['bloques'])} bloques")
            return True

        for ruta in rutas:
            nombre = ruta.stem.replace("Planilla de Preguntas - ", "")
            ambito = referencia.corregir(codigo, openpyxl, ruta)
            respuestas = {
                "neo": ambito["neo_resp"], "celid": ambito["celid"],
                "potenlid": ambito["poten"], "camin": ambito["cam"], "conlid": ambito["con"],
            }
            generar(nombre, ruta, respuestas)

        rnd = random.Random(20260723)
        perfiles = []
        for letra in ("A", "E"):
            for extremo in ("min", "max"):
                perfiles.append((f"borde-{letra}-{extremo}", referencia.respuestas_borde(letra, extremo)))

        ambito = referencia.corregir(codigo, openpyxl, rutas[0]) if rutas else None
        if ambito:
            neo_key, neo_baremo = ambito["neo_key"], ambito["neo_baremo"]
            for dim in "NEOAC":
                # Los extremos del baremo, que son los que dan Muy Bajo y Muy Alto.
                for objetivo in (min(neo_baremo[dim]), max(neo_baremo[dim])):
                    base = referencia.respuestas_al_azar(rnd)
                    perfiles.append((
                        f"neo-{dim}-{objetivo}",
                        respuestas_neo_dirigidas(neo_key, dim, objetivo, base),
                    ))

        if ambito:
            # Perfil sin brechas: es el único que dispara los textos de respaldo
            # ("no presenta brechas significativas", "continuar profundizando").
            ideal = referencia.respuestas_borde("A", "max")
            ideal["neo"] = respuestas_neo_dirigidas(
                ambito["neo_key"], "N", min(ambito["neo_baremo"]["N"]), ideal
            )["neo"]
            for item in (1, 6, 20, 27, 31, 32):  # ítems de Laissez-Faire, invertidos
                ideal["celid"][item] = 1
            perfiles.append(("perfil-sin-brechas", ideal))

        while len(perfiles) < sinteticas:
            perfiles.append((f"sintetico-{len(perfiles) + 1:02d}", referencia.respuestas_al_azar(rnd)))

        for nombre, respuestas in perfiles[:sinteticas]:
            planilla = Path(tmp) / f"{nombre}.xlsx"
            escribir_planilla(planilla, respuestas)
            generar(nombre, planilla, respuestas)

    SALIDA.write_text(json.dumps(informes, ensure_ascii=False), encoding="utf-8")
    print(f"\n{len(informes)} informe(s) → {SALIDA.relative_to(RAIZ)}")
    return 0 if informes else 1


if __name__ == "__main__":
    sys.exit(main())
