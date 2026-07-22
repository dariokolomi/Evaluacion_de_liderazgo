"""
narrativa_llm.py — Genera la narrativa cualitativa del informe vía Ollama.

Uso:
    python3 narrativa_llm.py                        # usa qwen2.5:7b por defecto
    python3 narrativa_llm.py --model llama3.1:8b
    python3 narrativa_llm.py --model mistral:7b --host http://localhost:11434

Salida:
    narrativa_generada.json  (leído automáticamente por generar_informe.py)

Modelos recomendados (en orden):
    qwen2.5:7b      → mejor español para texto estructurado → narrativa
    llama3.1:8b     → segunda opción, buen español
    mistral:7b      → rápido, español aceptable
    gemma3:4b       → muy liviano, calidad menor

Para instalar un modelo:
    ollama pull qwen2.5:7b
"""

import json, sys, io, urllib.request, urllib.error, argparse

# ── Importar scores de corregir.py suprimiendo sus prints ─────────────────
_buf = io.StringIO()
sys.stdout = _buf
from corregir import (
    neo_raw, neo_t, neo_niv,
    carisma, est_int, inspir, cons_ind, transf_total,
    rec_cont, dir_exc, trans_total, laissez,
    m_intr, m_extr, m_soc,
    directivo, considerado, participativo, orientado,
    tarea, rel, camb,
    percentil, nivel_pct,
    celid_bar, poten_bar, cam_bar, con_bar,
)
sys.stdout = sys.__stdout__

# ── Recalcular percentiles ─────────────────────────────────────────────────
celid_pcts = {k: percentil(v, celid_bar[k]) for k, v in [
    ("Carisma", carisma), ("EstimInt", est_int), ("Inspir", inspir),
    ("ConsInd", cons_ind), ("TransfTot", transf_total),
    ("RecCont", rec_cont), ("DirExc", dir_exc),
    ("TransTot", trans_total), ("Laissez", laissez),
]}
poten_pcts = {k: percentil(v, poten_bar[k]) for k, v in [
    ("Intr", m_intr), ("Extr", m_extr), ("Soc", m_soc),
]}
cam_pcts = {k: percentil(v, cam_bar[k]) for k, v in [
    ("Dir", directivo), ("Cons", considerado),
    ("Part", participativo), ("Or", orientado),
]}
con_pcts = {k: percentil(v, con_bar[k]) for k, v in [
    ("Tar", tarea), ("Rel", rel), ("Camb", camb),
]}


# ── Cliente Ollama ─────────────────────────────────────────────────────────
def ollama(prompt, model, host, max_tokens=700):
    url = f"{host}/api/generate"
    payload = json.dumps({
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.6, "num_predict": max_tokens},
    }).encode()
    req = urllib.request.Request(
        url, data=payload, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.loads(r.read())["response"].strip()
    except urllib.error.URLError as e:
        print(f"\n[ERROR] No se pudo conectar con Ollama en {host}")
        print("        Verificá que esté corriendo:  ollama serve")
        print(f"        Y que el modelo exista:      ollama pull {model}")
        sys.exit(1)


# ── Prompts ────────────────────────────────────────────────────────────────
SISTEMA = (
    "Sos psicólogo organizacional especialista en evaluación de liderazgo. "
    "Redactás informes psicométricos profesionales en español rioplatense. "
    "Usás tercera persona, tono formal pero accesible. "
    "Escribís en prosa continua, sin viñetas ni bullets. "
    "Solo interpretás los datos que te dan; no inventás información."
)


def prompt_neo():
    dims = [
        ("N", "Neuroticismo",    "inestabilidad emocional, ansiedad y reactividad al estrés"),
        ("E", "Extraversión",    "sociabilidad, energía, asertividad y optimismo"),
        ("O", "Apertura",        "curiosidad intelectual, creatividad y apertura al cambio"),
        ("A", "Amabilidad",      "cooperación, empatía y orientación prosocial"),
        ("C", "Responsabilidad", "organización, autodisciplina y orientación al logro"),
    ]
    lineas = "\n".join(
        f"- {nombre} ({d}): T={neo_t.get(d,'?')}, Nivel={neo_niv.get(d,'?')}. Mide: {desc}."
        for d, nombre, desc in dims
    )
    return f"""{SISTEMA}

DATOS NEO-FFI del evaluado (baremo Varones+Mujeres, Casullo & Pérez 2008):
{lineas}

TAREA: Escribí un párrafo interpretativo por cada una de las 5 dimensiones.
Formato exacto para cada párrafo:
  <Nombre de la dimensión> — <Nivel> (T=<valor>): <texto de 3 a 5 oraciones>

Requisitos:
- Explicá qué implica ese puntaje para el liderazgo organizacional.
- Señalá una fortaleza o un riesgo concreto para el rol de conducción.
- Tercera persona, español formal.
- Separá cada párrafo con una línea en blanco.
- No agregues títulos, encabezados ni viñetas adicionales."""


def prompt_celid():
    return f"""{SISTEMA}

DATOS CELID-A del evaluado (estilos de liderazgo, Bass & Avolio):

Estilo Transformacional:
  Carisma: {carisma:.2f}/5 — P{celid_pcts['Carisma']} — {nivel_pct(celid_pcts['Carisma'])}
  Estimulación Intelectual: {est_int:.2f}/5 — P{celid_pcts['EstimInt']} — {nivel_pct(celid_pcts['EstimInt'])}
  Inspiración: {inspir:.2f}/5 — P{celid_pcts['Inspir']} — {nivel_pct(celid_pcts['Inspir'])}
  Consideración Individualizada: {cons_ind:.2f}/5 — P{celid_pcts['ConsInd']} — {nivel_pct(celid_pcts['ConsInd'])}
  TOTAL Transformacional: {transf_total:.2f}/5 — P{celid_pcts['TransfTot']} — {nivel_pct(celid_pcts['TransfTot'])}

Estilo Transaccional:
  Recompensa Contingente: {rec_cont:.2f}/5 — P{celid_pcts['RecCont']} — {nivel_pct(celid_pcts['RecCont'])}
  Dirección por Excepción: {dir_exc:.2f}/5 — P{celid_pcts['DirExc']} — {nivel_pct(celid_pcts['DirExc'])}
  TOTAL Transaccional: {trans_total:.2f}/5 — P{celid_pcts['TransTot']} — {nivel_pct(celid_pcts['TransTot'])}

Laissez-Faire: {laissez:.2f}/5 — P{celid_pcts['Laissez']} — {nivel_pct(celid_pcts['Laissez'])}

TAREA: Redactá el análisis de estilos de liderazgo en exactamente 4 párrafos separados por línea en blanco:
1. Síntesis del perfil de estilos (qué estilo predomina y qué lo caracteriza).
2. Análisis del estilo Transformacional: qué dimensiones lo sostienen y cuáles son brechas de desarrollo.
3. Análisis del estilo Transaccional y Laissez-Faire: implicancias para la gestión cotidiana.
4. Una recomendación concreta de desarrollo basada en los datos.
Entre 3 y 5 oraciones por párrafo. Español formal, tercera persona. Solo prosa."""


def prompt_motivacion_conductas():
    return f"""{SISTEMA}

DATOS de motivación y conductas del evaluado:

POTENLID (fuentes de motivación para el liderazgo):
  Motivación Intrínseca: PD={m_intr} — P{poten_pcts['Intr']} — {nivel_pct(poten_pcts['Intr'])}
  Motivación Extrínseca: PD={m_extr} — P{poten_pcts['Extr']} — {nivel_pct(poten_pcts['Extr'])}
  Motivación Social Normativa: PD={m_soc} — P{poten_pcts['Soc']} — {nivel_pct(poten_pcts['Soc'])}

CAMIN-A (conductas Camino-Meta, House 1971):
  Directivo: PD={directivo} — P{cam_pcts['Dir']} — {nivel_pct(cam_pcts['Dir'])}
  Considerado/Apoyo: PD={considerado} — P{cam_pcts['Cons']} — {nivel_pct(cam_pcts['Cons'])}
  Participativo: PD={participativo} — P{cam_pcts['Part']} — {nivel_pct(cam_pcts['Part'])}
  Orientado a Metas: PD={orientado} — P{cam_pcts['Or']} — {nivel_pct(cam_pcts['Or'])}

CONLID-A (foco conductual):
  Tarea: PD={tarea} — P{con_pcts['Tar']} — {nivel_pct(con_pcts['Tar'])}
  Relaciones: PD={rel} — P{con_pcts['Rel']} — {nivel_pct(con_pcts['Rel'])}
  Cambio: PD={camb} — P{con_pcts['Camb']} — {nivel_pct(con_pcts['Camb'])}

TAREA: Redactá el análisis de motivación y conductas en 3 párrafos separados por línea en blanco:
1. Perfil motivacional (POTENLID): qué impulsa al evaluado a ejercer el liderazgo.
2. Estilos conductuales dominantes (CAMIN-A): cuáles son sus fortalezas y áreas de desarrollo.
3. Foco conductual (CONLID-A): cómo se distribuye su energía entre tarea, relaciones y cambio.
Entre 3 y 5 oraciones por párrafo. Español formal, tercera persona. Solo prosa."""


def prompt_perfil_integrado():
    return f"""{SISTEMA}

PERFIL COMPLETO del evaluado — síntesis de 5 instrumentos:

NEO-FFI: N=T{neo_t.get('N')} ({neo_niv.get('N')}), E=T{neo_t.get('E')} ({neo_niv.get('E')}), \
O=T{neo_t.get('O')} ({neo_niv.get('O')}), A=T{neo_t.get('A')} ({neo_niv.get('A')}), \
C=T{neo_t.get('C')} ({neo_niv.get('C')})

CELID-A: Transformacional={transf_total:.2f}/P{celid_pcts['TransfTot']} \
({nivel_pct(celid_pcts['TransfTot'])}), \
Transaccional={trans_total:.2f}/P{celid_pcts['TransTot']} ({nivel_pct(celid_pcts['TransTot'])}), \
Laissez-Faire={laissez:.2f}/P{celid_pcts['Laissez']} ({nivel_pct(celid_pcts['Laissez'])})

POTENLID: Intrínseca={m_intr}/P{poten_pcts['Intr']} ({nivel_pct(poten_pcts['Intr'])}), \
Extrínseca={m_extr}/P{poten_pcts['Extr']} ({nivel_pct(poten_pcts['Extr'])}), \
SocNormativa={m_soc}/P{poten_pcts['Soc']} ({nivel_pct(poten_pcts['Soc'])})

CAMIN-A: Participativo=P{cam_pcts['Part']} ({nivel_pct(cam_pcts['Part'])}), \
Directivo=P{cam_pcts['Dir']} ({nivel_pct(cam_pcts['Dir'])}), \
Considerado=P{cam_pcts['Cons']} ({nivel_pct(cam_pcts['Cons'])}), \
OrMetas=P{cam_pcts['Or']} ({nivel_pct(cam_pcts['Or'])})

CONLID-A: Cambio=P{con_pcts['Camb']} ({nivel_pct(con_pcts['Camb'])}), \
Relaciones=P{con_pcts['Rel']} ({nivel_pct(con_pcts['Rel'])}), \
Tarea=P{con_pcts['Tar']} ({nivel_pct(con_pcts['Tar'])})

TAREA: Redactá el Perfil Integrado en exactamente 3 párrafos separados por línea en blanco:

1. SÍNTESIS GENERAL: Integrá los 5 instrumentos en una caracterización coherente del estilo de liderazgo. \
Mencioná los rasgos de personalidad que sustentan las conductas observadas.

2. HALLAZGO DISTINTIVO: Analizá la combinación de puntajes aparentemente contradictorios \
(baja Amabilidad vs. alta Consideración Individualizada y Participativo muy alto). \
Explicá cómo conviven y qué implican para la dinámica con el equipo.

3. PROYECCIÓN SITUACIONAL: Indicá qué estilos ya están consolidados y cuáles debe desarrollar \
para completar el repertorio del líder situacional (referenciá el modelo de Hersey & Blanchard o House). \
Cerrá con una perspectiva de desarrollo.

Entre 4 y 6 oraciones por párrafo. Español formal, tercera persona. Solo prosa."""


# ── Main ───────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Genera la narrativa del informe de liderazgo vía Ollama"
    )
    parser.add_argument("--model", default="qwen2.5:7b",
                        help="Modelo Ollama (default: qwen2.5:7b)")
    parser.add_argument("--host", default="http://localhost:11434",
                        help="URL de Ollama (default: http://localhost:11434)")
    parser.add_argument("--out", default="narrativa_generada.json",
                        help="Archivo de salida (default: narrativa_generada.json)")
    args = parser.parse_args()

    print(f"Modelo: {args.model}  |  Host: {args.host}")
    print("─" * 50)

    secciones = [
        ("neo",       "Sección 2a — Narrativa NEO (5 dimensiones)",      prompt_neo,                  700),
        ("celid",     "Sección 2b — Estilos de liderazgo CELID-A",        prompt_celid,                600),
        ("motivacion","Sección 2c — Motivación y conductas",              prompt_motivacion_conductas, 600),
        ("perfil",    "Sección 3  — Perfil integrado",                    prompt_perfil_integrado,     700),
    ]

    resultado = {"modelo": args.model}
    for key, titulo, fn_prompt, max_tok in secciones:
        print(f"\n{titulo}")
        print("  Generando...", end=" ", flush=True)
        texto = ollama(fn_prompt(), args.model, args.host, max_tokens=max_tok)
        resultado[key] = texto
        print(f"OK  ({len(texto)} caracteres)")

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)

    print(f"\n{'─'*50}")
    print(f"Narrativa guardada en: {args.out}")
    print("Siguiente paso:        python3 generar_informe.py")


if __name__ == "__main__":
    main()
