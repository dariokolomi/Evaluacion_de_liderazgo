/**
 * Verificación de la síntesis del punto 5 redactada por el LLM.
 *
 * No llama a la API: lo que se prueba acá es todo lo que rodea a la llamada, que
 * es donde puede romperse el informe. En particular las validaciones, porque son
 * la única garantía de que un número inventado o la jerga interna del código no
 * lleguen al informe que se archiva en el legajo.
 *
 * Uso:  node verificar-sintesis.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const REFERENCIA = path.join(__dirname, 'referencia-python.json');

let pasaron = 0;
const fallos = [];

function ok(condicion, nombre, detalle) {
  if (condicion) {
    pasaron++;
  } else {
    fallos.push(detalle ? `${nombre} — ${detalle}` : nombre);
  }
}

/** Sintesis.gs necesita PropertiesService y UrlFetchApp: se inyectan simulados. */
function cargarGs(propiedades, fetchSimulado) {
  const fuente = ['Correccion.gs', 'Textos.gs', 'Sintesis.gs']
    .map((a) => fs.readFileSync(path.join(RAIZ, a), 'utf8'))
    .join('\n');
  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (k) => (propiedades && propiedades[k]) || null,
      getProperties: () => propiedades || {},
    }),
  };
  const UrlFetchApp = { fetch: fetchSimulado || (() => { throw new Error('fetch no esperado'); }) };
  const consolaMuda = { warn() {}, log() {}, error() {} };
  return new Function(
    'PropertiesService', 'UrlFetchApp', 'console',
    `${fuente}\nreturn { corregir, perfilParaSintesis, validarSintesis, validarBloque,
      mensajesBloqueDescriptivo, mensajesBloqueAnalitico, jsonDeRespuesta,
      percentilesCitados, puntajesTCitados, sintesisDeLiderazgo, nivelPorPercentil,
      validarNivelesCoherentes, ponerNombre, SINTESIS_MARCADOR_NOMBRE,
      SINTESIS_BLOQUE_DESCRIPTIVO, SINTESIS_BLOQUE_ANALITICO,
      pedirBloque, hayTiempo, modelosConfigurados, LLM_PLAZO_MS,
      LLM_MODELOS_POR_DEFECTO };`
  )(PropertiesService, UrlFetchApp, consolaMuda);
}

/** Los dos bloques que devuelve la API, por separado. */
function bloqueDescriptivo() {
  const s = sintesisValida();
  return {
    resumenGeneral: s.resumenGeneral,
    fortalezas: s.fortalezas,
    areasDesarrollo: s.areasDesarrollo,
  };
}

function bloqueAnalitico() {
  const s = sintesisValida();
  return {
    inferencias: s.inferencias,
    recomendaciones: s.recomendaciones,
    pendienteDefinir: s.pendienteDefinir,
  };
}

/** Responde el bloque que corresponda según lo que pide el prompt. */
function fetchPorBloque(registro, torcer) {
  return (url, opciones) => {
    const cuerpo = JSON.parse(opciones.payload);
    const esAnalitico = cuerpo.messages[0].content.indexOf('SEGUNDA de dos partes') >= 0;
    const clave = esAnalitico ? 'analitico' : 'descriptivo';
    registro.llamadas.push(clave);
    (registro.modelos = registro.modelos || []).push(cuerpo.model);
    registro.tokens = cuerpo.max_tokens;
    const datos = esAnalitico ? bloqueAnalitico() : bloqueDescriptivo();
    return (torcer && torcer(clave, datos, registro)) || respuestaSimulada(200, JSON.stringify(datos));
  };
}

function respuestaSimulada(codigo, contenido) {
  return {
    getResponseCode: () => codigo,
    getContentText: () =>
      codigo === 200
        ? JSON.stringify({ choices: [{ message: { content: contenido } }] })
        : contenido,
  };
}

/** Una síntesis válida para el caso 0 del fixture, usada como base.
 *  Sin un solo número: el PO pidió que la devolución hable de niveles. */
function sintesisValida() {
  return {
    resumenGeneral: 'Perfil con eje en las personas: nivel alto de consideración individualizada, con el liderazgo directivo en nivel medio.',
    fortalezas: [
      { titulo: 'Orientación a las personas', texto: 'Nivel alto de consideración individualizada.' },
      { titulo: 'Conducción participativa', texto: 'Nivel alto de liderazgo participativo.' },
      { titulo: 'Interés genuino en el rol', texto: 'Motivación intrínseca en nivel alto.' },
    ],
    // `dimension` declara en qué dato se apoya la brecha y no se imprime.
    areasDesarrollo: [
      { dimension: 'Recompensa Contingente', titulo: 'Reconocimiento sistemático', texto: 'La recompensa contingente queda en nivel medio.' },
      { dimension: 'Liderazgo Directivo', titulo: 'Dirección explícita', texto: 'El liderazgo directivo queda en nivel medio.' },
      { dimension: 'Conductas Orientadas a la Tarea', titulo: 'Seguimiento operativo', texto: 'Las conductas de tarea quedan en nivel medio.' },
    ],
    inferencias: [
      { titulo: 'Presencia afectiva y dirección difusa', texto: 'Consideración en nivel alto conviviendo con un liderazgo directivo en nivel medio.' },
      { titulo: 'Apertura sin conductas de cambio', texto: 'Apertura en nivel promedio frente a conductas de cambio en nivel alto.' },
    ],
    recomendaciones: [
      { titulo: 'Acuerdos explícitos de inicio', contexto: 'Equipos de baja autonomía.', accion: 'Definir resultado esperado y puntos de control.' },
      { titulo: 'Conversaciones correctivas', contexto: 'Ante desvíos de rendimiento.', accion: 'Abordar el desvío sobre hechos observables.' },
      { titulo: 'Reconocimiento del logro', contexto: 'Equipos de madurez media o alta.', accion: 'Rutina mensual de reconocimiento del logro concreto.' },
    ],
    pendienteDefinir: [
      { titulo: 'Madurez del equipo', texto: 'Relevar el grado de autonomía de los colaboradores actuales.' },
      { titulo: 'Estándares del área', texto: 'Definir con qué indicadores mide el área el cumplimiento.' },
    ],
  };
}

// ───────────────────────────────────────────────────────────────────
const gs = cargarGs();
const referencia = JSON.parse(fs.readFileSync(REFERENCIA, 'utf8'));
const resultados = gs.corregir(referencia[0].respuestas);
const perfil = gs.perfilParaSintesis(resultados);

// ── El perfil que ve el modelo ──
ok(perfil.dimensiones.length === 19, 'el perfil lleva las 19 dimensiones de los cuatro instrumentos',
  `trajo ${perfil.dimensiones.length}`);
ok(perfil.neo.length === 5, 'el perfil lleva las cinco dimensiones del NEO-FFI');

const laissez = perfil.dimensiones.find((d) => d.dimension === 'Laissez-Faire');
ok(laissez && laissez.invertida === true, 'Laissez-Faire va marcada como invertida');
const consInd = perfil.dimensiones.find((d) => d.dimension === 'Consideración Individualizada');
ok(consInd && consInd.invertida === false, 'Consideración Individualizada no va marcada como invertida');

ok(perfil.dimensiones.every((d) => typeof d.nivel === 'string' && d.nivel),
  'toda dimensión llega con su nivel en palabras');
ok(perfil.neo.every((d) => typeof d.nivel === 'string' && d.nivel),
  'todo rasgo de personalidad llega con su nivel en palabras');
ok(perfil.neo.every((d) => d.t === undefined),
  'el puntaje T no viaja en el perfil: la devolución no lo menciona');

// El nivel tiene que ser el mismo con el que el informe rotula sus tablas en las
// secciones 1 a 4: otra banda haría que el punto 5 contradiga a la tabla (HU2).
ok(consInd.nivel === 'Alto', 'Consideración Individualizada (P99) queda en nivel Alto', consInd.nivel);
const recCont = perfil.dimensiones.find((d) => d.dimension === 'Recompensa Contingente');
ok(recCont.nivel === gs.nivelPorPercentil(25),
  'el nivel sale de la misma función que rotula las tablas del informe', recCont.nivel);

// El orden relativo recupera el contraste que la banda gruesa pierde.
ok(Array.isArray(perfil.destacadas.masAltas) && perfil.destacadas.masAltas.length === 4,
  'el perfil trae las cuatro dimensiones más prominentes');
ok(perfil.destacadas.masAltas.indexOf('Consideración Individualizada') >= 0,
  'la dimensión del techo del perfil aparece entre las más prominentes',
  perfil.destacadas.masAltas.join(', '));
ok(perfil.destacadas.masAltas.indexOf('Laissez-Faire') < 0
  && perfil.destacadas.masBajas.indexOf('Laissez-Faire') < 0,
  'Laissez-Faire queda fuera del ranking: estar arriba ahí no es destacarse');

// ── Los dos prompts ──
const mDesc = gs.mensajesBloqueDescriptivo('Fran prueba', perfil);
const mAnal = gs.mensajesBloqueAnalitico('Fran prueba', perfil, bloqueDescriptivo());

[['descriptivo', mDesc], ['analítico', mAnal]].forEach(([nombre, m]) => {
  ok(m.length === 2 && m[0].role === 'system' && m[1].role === 'user',
    `el bloque ${nombre} son dos mensajes, sistema y usuario`);
  ok(m[0].content.indexOf('/no_think') === 0,
    `el bloque ${nombre} arranca apagando el razonamiento del modelo`);
  // Cada modelo entiende su propio interruptor: el de la v1.5 no apagaba a la v1.
  // Si el razonamiento queda prendido, el modelo puede volcar el pensamiento en
  // `content` y no llegar nunca al JSON, que es lo que descartó al 120b.
  const conV1 = nombre === 'descriptivo'
    ? gs.mensajesBloqueDescriptivo('Fran prueba', perfil, 'nvidia/llama-3.3-nemotron-super-49b-v1')
    : gs.mensajesBloqueAnalitico('Fran prueba', perfil, bloqueDescriptivo(), 'nvidia/llama-3.3-nemotron-super-49b-v1');
  ok(conV1[0].content.indexOf('detailed thinking off') === 0,
    `el bloque ${nombre} usa el interruptor que entiende el modelo suplente`,
    conV1[0].content.slice(0, 30));
  ok(conV1[0].content.replace('detailed thinking off', '') === m[0].content.replace('/no_think', ''),
    `y el resto de las instrucciones del bloque ${nombre} son las mismas para los dos modelos`);
  ok(m[1].content.indexOf('Fran prueba') < 0,
    `el nombre NO llega al bloque ${nombre}: no sale del proyecto`);
  // Los números NO llegan al prompt: es la garantía más fuerte de que el modelo
  // no los escriba, por lo mismo que con "escala invertida" y "NEO-FFI".
  ok(!/\bP\d{1,2}\b/.test(m[1].content),
    `no viaja ningún percentil al bloque ${nombre}`);
  ok(!/\bT\s*=\s*\d/.test(m[1].content),
    `no viaja ningún puntaje T al bloque ${nombre}`);
  ok(m[1].content.indexOf('nivel Alto') >= 0,
    `los niveles en palabras llegan al bloque ${nombre}`);
  ok(m[1].content.indexOf('Las más prominentes') >= 0,
    `el orden relativo del perfil llega al bloque ${nombre}`);
  ok(m[1].content.indexOf('escala invertida') < 0,
    `el bloque ${nombre} no usa la expresión que el modelo copiaba al informe`);
  ok(m[1].content.indexOf('no-intervención') >= 0,
    `el bloque ${nombre} explica la dimensión invertida en castellano llano`);
  // El modelo copia el vocabulario del input: cada término que la validación
  // prohíbe en la salida tiene que estar ausente de los datos que se le pasan.
  // "NEO-FFI" en el encabezado hacía que lo escribiera y el bloque se rechazara.
  ['CELID', 'CONLID', 'CAMIN', 'POTENLID', 'NEO-FFI'].forEach((sigla) => {
    ok(m[1].content.indexOf(sigla) < 0,
      `la sigla ${sigla} no aparece en los datos del bloque ${nombre}`);
  });
  ok(/PROHIBIDO/.test(m[0].content),
    `el bloque ${nombre} lleva la regla de lectura de la motivación`);
});

// ── El nombre de la persona no sale del proyecto ──
// Antes el prompt llevaba "PERSONA EVALUADA: <nombre>" junto al perfil
// psicométrico completo, o sea un dato identificatorio pegado a una evaluación que
// termina en un legajo, saliendo a la API de un tercero.
const mPriv = gs.mensajesBloqueDescriptivo('Don Ramon', perfil);
const mPrivA = gs.mensajesBloqueAnalitico('Don Ramon', perfil, bloqueDescriptivo());
[['descriptivo', mPriv], ['analítico', mPrivA]].forEach(([nombre, m]) => {
  const todo = m.map((x) => x.content).join(' ');
  ok(todo.indexOf('Don') < 0 && todo.indexOf('Ramon') < 0,
    `el nombre de la persona no viaja en el bloque ${nombre}`);
  ok(todo.indexOf(gs.SINTESIS_MARCADOR_NOMBRE) >= 0,
    `el bloque ${nombre} le da al modelo el marcador para nombrarla`);
});

// Y el nombre se pone de vuelta al armar el informe.
const conMarcador = sintesisValida();
conMarcador.resumenGeneral = gs.SINTESIS_MARCADOR_NOMBRE + ' conduce con eje en las personas.';
conMarcador.fortalezas[0].texto = 'A ' + gs.SINTESIS_MARCADOR_NOMBRE + ' le sale escuchar.';
const conNombre = gs.ponerNombre(conMarcador, 'Don Ramon');
ok(conNombre.resumenGeneral.indexOf('Don Ramon conduce') === 0,
  'el nombre real reemplaza al marcador en el resumen', conNombre.resumenGeneral);
ok(conNombre.fortalezas[0].texto.indexOf('A Don Ramon le sale') === 0,
  'y también dentro de las listas', conNombre.fortalezas[0].texto);
ok(JSON.stringify(conNombre).indexOf(gs.SINTESIS_MARCADOR_NOMBRE) < 0,
  'no queda ningún marcador sin reemplazar');

const sinMarcador = gs.ponerNombre(sintesisValida(), 'Don Ramon');
ok(sinMarcador.resumenGeneral.indexOf('Don Ramon') < 0,
  'si el modelo no usó el marcador, el texto queda intacto');

// Cada bloque pide lo suyo y nada más: es lo que mantiene las llamadas cortas.
ok(/PRIMERA de dos partes/.test(mDesc[0].content), 'el primer bloque se declara como primera parte');
ok(/SEGUNDA de dos partes/.test(mAnal[0].content), 'el segundo bloque se declara como segunda parte');
ok(mDesc[0].content.indexOf('"fortalezas"') >= 0 && mDesc[0].content.indexOf('"inferencias"') < 0,
  'el bloque descriptivo pide fortalezas y no pide inferencias');
ok(mAnal[0].content.indexOf('"inferencias"') >= 0 && mAnal[0].content.indexOf('"fortalezas"') < 0,
  'el bloque analítico pide inferencias y no pide fortalezas');
ok(mAnal[1].content.indexOf('Orientación a las personas') >= 0,
  'el bloque analítico recibe los títulos del descriptivo para no repetirlos');
ok(gs.mensajesBloqueAnalitico('Fran', perfil, null)[1].content.indexOf('YA SE ESCRIBIÓ') < 0,
  'sin bloque previo, el analítico no inventa una lista de títulos');

// ── Validación: el caso bueno pasa ──
ok(gs.validarSintesis(sintesisValida(), perfil).ok === true,
  'una síntesis bien formada y con números del perfil se acepta');

// ── Validación: percentiles y T inventados ──
function conCambio(f) {
  const s = sintesisValida();
  f(s);
  return gs.validarSintesis(s, perfil);
}

// El PO pidió que la devolución no mencione valores: se rechaza CUALQUIER
// puntaje, incluso los que sí están en el perfil. Es una regla más simple que la
// anterior y elimina de raíz la clase de error por número mal citado.
let r = conCambio((s) => { s.fortalezas[0].texto = 'Consideración Individualizada en P99.'; });
ok(!r.ok && /P99/.test(r.motivo),
  'se rechaza un percentil aunque sea el correcto del perfil', r.motivo);

r = conCambio((s) => { s.fortalezas[0].texto = 'Consideración Individualizada en P83.'; });
ok(!r.ok, 'se rechaza un percentil inventado', r.motivo);

r = conCambio((s) => { s.resumenGeneral = 'Extraversión en T=64, alta.'; });
ok(!r.ok && /64/.test(r.motivo), 'se rechaza un puntaje T aunque sea el correcto', r.motivo);

r = conCambio((s) => { s.inferencias[0].texto = 'Su nivel de consideración es alto y el percentil lo confirma.'; });
ok(!r.ok && /percentil/.test(r.motivo),
  'se rechaza la palabra "percentil" aunque no venga con número', r.motivo);

r = conCambio((s) => { s.resumenGeneral = 'Su puntaje T es elevado.'; });
ok(!r.ok, 'se rechaza mencionar el puntaje T aunque no se dé el valor', r.motivo);

r = conCambio((s) => {
  s.inferencias[0].texto = 'Consideración en nivel alto conviviendo con no-intervención alta.';
});
ok(r.ok, 'una inferencia escrita en niveles, sin números, se acepta', r.motivo);

// Números que no son puntajes no molestan: la regla apunta a P<n> y T=<n>.
r = conCambio((s) => {
  s.recomendaciones[0].accion = 'Acordar 3 puntos de control por proyecto.';
});
ok(r.ok, 'un número que no es un puntaje no se rechaza', r.motivo);

// ── Validación: jerga interna ──
r = conCambio((s) => { s.areasDesarrollo[1].texto = 'El directivo (P50, escala invertida).'; });
ok(!r.ok && /jerga/.test(r.motivo), 'se rechaza la jerga "escala invertida" en el texto', r.motivo);

r = conCambio((s) => { s.fortalezas[0].texto = 'Según el CELID-A, P99 en consideración.'; });
ok(!r.ok && /jerga/.test(r.motivo), 'se rechaza el nombre técnico del instrumento', r.motivo);

// ── Validación: lectura psicométrica de la motivación ──
r = conCambio((s) => {
  s.areasDesarrollo[0] = { dimension: 'Motivación Extrínseca para liderar', titulo: 'Baja motivación extrínseca', texto: 'La motivación extrínseca queda en nivel medio.' };
});
ok(!r.ok && /extr/.test(r.motivo),
  'se rechaza la motivación extrínseca presentada como área de desarrollo', r.motivo);

r = conCambio((s) => {
  s.areasDesarrollo[0] = { dimension: 'Motivación Social-Normativa para liderar', titulo: 'Motivación social-normativa', texto: 'La social-normativa queda en nivel medio.' };
});
ok(!r.ok, 'se rechaza la motivación social-normativa como área de desarrollo', r.motivo);

r = conCambio((s) => {
  s.fortalezas[2].texto = 'Su motivación no depende de la recompensa extrínseca.';
});
ok(r.ok, 'mencionar la motivación extrínseca fuera de las áreas de desarrollo es válido', r.motivo);

// ── Validación: estructura incompleta ──
r = conCambio((s) => { delete s.inferencias; });
ok(!r.ok && /inferencias/.test(r.motivo), 'se rechaza una síntesis sin inferencias', r.motivo);

r = conCambio((s) => { s.recomendaciones[0].contexto = ''; });
ok(!r.ok && /contexto/.test(r.motivo), 'se rechaza una recomendación sin contexto de aplicación', r.motivo);

r = conCambio((s) => { s.fortalezas = []; });
ok(!r.ok, 'se rechaza una lista vacía');

ok(!gs.validarSintesis(null, perfil).ok, 'se rechaza una respuesta nula');
ok(!gs.validarSintesis('texto', perfil).ok, 'se rechaza una respuesta que no es objeto');

// ── Recorte del JSON ──
ok(gs.jsonDeRespuesta('```json\n{"a":1}\n```').a === 1, 'se recorta el JSON envuelto en markdown');
ok(gs.jsonDeRespuesta('Acá va: {"a":2} listo').a === 2, 'se recorta el JSON con texto alrededor');
ok(gs.jsonDeRespuesta('sin json') === null, 'sin JSON devuelve null');
ok(gs.jsonDeRespuesta('{roto') === null, 'un JSON roto devuelve null');
ok(gs.jsonDeRespuesta(null) === null, 'un contenido nulo devuelve null');

// ── Citas ──
ok(gs.percentilesCitados('va P75 y P99 acá').join(',') === '75,99', 'se detectan los percentiles citados');
ok(gs.puntajesTCitados('con T=64 y T = 50').join(',') === '64,50', 'se detectan los puntajes T citados');

// ── Coherencia entre el nivel que dice el texto y el que tiene la dimensión ──
// Pasó en un informe real: el modelo escribió "un nivel medio en Conductas
// Orientadas a la Tarea y Liderazgo Orientado a Metas" cuando la segunda está en
// Alto. No cita números ni usa jerga, así que ninguna otra validación lo veía, y
// además contradecía a la sección 3 del mismo informe (HU2).
[
  [false, 'el error real del informe',
    'Con un nivel medio en Conductas Orientadas a la Tarea y Liderazgo Orientado a Metas, hay oportunidad.'],
  [true, 'varias dimensiones que sí comparten el nivel',
    'Presenta un nivel alto en Consideración Individualizada, Liderazgo Considerado y Liderazgo Participativo.'],
  [false, 'el mismo error escrito como contraste',
    'El nivel alto en Liderazgo Participativo contrasta con el nivel medio en Liderazgo Orientado a Metas.'],
  [true, 'dos niveles distintos en la misma oración, ambos correctos',
    'Aunque la Inspiración y Motivación Inspiracional muestra un nivel alto, la Estimulación Intelectual se encuentra en nivel medio.'],
  [true, 'la dimensión antes del nivel no se revisa',
    'La Estimulación Intelectual se encuentra en nivel medio.'],
  [true, 'una inferencia larga y correcta',
    'La combinación de niveles altos en Consideración Individualizada, Liderazgo Considerado y Conductas Orientadas a las Relaciones, junto con un nivel alto en Liderazgo Participativo, sugiere presencia afectiva.'],
  // Salidas reales del modelo que el validador rechazaba de más: el alcance de un
  // nivel se comía la dimensión de la cláusula siguiente, que tiene su propio nivel.
  [true, 'dos cláusulas separadas por "su"',
    'Aunque Fran muestra un nivel alto en Consideración Individualizada, su Carisma / Influencia Idealizada se encuentra en nivel medio.'],
  [true, 'dos cláusulas separadas por "pero"',
    'Con un nivel alto en Extraversión y Conductas Orientadas a las Relaciones, pero un nivel medio en Conductas Orientadas a la Tarea y Liderazgo Directivo, Fran demuestra energía.'],
  [false, 'un error metido en el medio de una lista correcta',
    'Presenta un nivel alto en Consideración Individualizada, Liderazgo Considerado y Conductas Orientadas a la Tarea.'],
  [false, 'un nivel bajo donde la dimensión está alta',
    'Muestra un nivel bajo en Liderazgo Participativo.'],
  [true, 'un rasgo de personalidad bien atribuido', 'Se observa un nivel alto de Extraversión.'],
  [false, 'un rasgo de personalidad mal atribuido', 'Se observa un nivel bajo de Extraversión.'],
  [true, '"promedio" cuenta como "medio"', 'Un nivel promedio en Conductas Orientadas a la Tarea.'],
  [true, 'una oración sin niveles', 'Fortalece la intervención con acuerdos de inicio de ciclo.'],
  [true, '"bajo presión" no es un nivel', 'Mantener la calma bajo presión sostenida es clave para el rol.'],
].forEach(([esperaOk, nombre, texto]) => {
  const res = gs.validarNivelesCoherentes(texto, perfil);
  ok(res.ok === esperaOk, `niveles — ${nombre}`, res.motivo || 'lo aceptó y no debía');
});

// Y que la validación esté enchufada, no sólo definida.
r = conCambio((s) => {
  s.areasDesarrollo[0].texto = 'Con un nivel medio en Liderazgo Orientado a Metas hay oportunidad.';
});
ok(!r.ok && /Orientado a Metas/.test(r.motivo),
  'la síntesis completa rechaza un nivel mal atribuido', r.motivo);

// ── La brecha declarada tiene que existir en el perfil ──
// Es la única defensa que funcionó contra un error que el modelo repitió tres
// veces: presentar como carencia una dimensión que está en nivel alto, sin
// nombrarla y con otras palabras ("prioriza el consenso sobre la innovación" con
// las conductas de cambio en alto). Ninguna validación de texto puede verlo.
r = conCambio((s) => {
  s.areasDesarrollo[0] = {
    dimension: 'Liderazgo Orientado a Metas',
    titulo: 'Enfoque en resultados',
    texto: 'Prioriza el bienestar relacional sobre el logro de objetivos concretos.',
  };
});
ok(!r.ok && /Orientado a Metas/.test(r.motivo),
  'se rechaza una brecha apoyada en una dimensión que está en nivel alto', r.motivo);

r = conCambio((s) => {
  s.areasDesarrollo[0] = {
    dimension: 'Conductas Orientadas al Cambio',
    titulo: 'Impulso al cambio',
    texto: 'Prioriza el consenso sobre la innovación.',
  };
});
ok(!r.ok, 'y también cuando el modelo mueve el error a otra dimensión alta', r.motivo);

r = conCambio((s) => { s.areasDesarrollo[0].dimension = 'Fortaleza inventada'; });
ok(!r.ok, 'se rechaza una dimensión que no existe en el perfil', r.motivo);

// El Laissez-Faire de este perfil quedó en nivel medio cuando el corte de Alto pasó
// a > P75, así que la propiedad se prueba sobre una copia con esa dimensión en alto:
// lo que importa acá no es cuánto puntúa este perfil sino que una escala invertida
// en nivel alto pueda sostener una brecha.
const perfilLaissezAlto = JSON.parse(JSON.stringify(perfil));
perfilLaissezAlto.dimensiones.find((d) => d.dimension === 'Laissez-Faire').nivel = 'Alto';
const conLaissez = sintesisValida();
conLaissez.areasDesarrollo[0].dimension = 'Laissez-Faire';
r = gs.validarSintesis(conLaissez, perfilLaissezAlto);
ok(r.ok, 'una dimensión invertida en nivel alto SÍ puede sostener una brecha', r.motivo);

r = conCambio((s) => { delete s.areasDesarrollo[1].dimension; });
ok(!r.ok && /dimension/.test(r.motivo),
  'se rechaza un área de desarrollo que no declara de dónde sale', r.motivo);

// ── Validación por bloque ──
ok(gs.validarBloque(gs.SINTESIS_BLOQUE_DESCRIPTIVO, bloqueDescriptivo(), perfil).ok,
  'el bloque descriptivo bien formado se acepta');
ok(gs.validarBloque(gs.SINTESIS_BLOQUE_ANALITICO, bloqueAnalitico(), perfil).ok,
  'el bloque analítico bien formado se acepta');
ok(!gs.validarBloque(gs.SINTESIS_BLOQUE_DESCRIPTIVO, bloqueAnalitico(), perfil).ok,
  'el bloque descriptivo no se conforma con la respuesta del analítico');
ok(!gs.validarBloque(gs.SINTESIS_BLOQUE_ANALITICO, bloqueDescriptivo(), perfil).ok,
  'el bloque analítico no se conforma con la respuesta del descriptivo');

let bd = bloqueDescriptivo();
bd.fortalezas[0].texto = 'Consideración en P83.';
ok(!gs.validarBloque(gs.SINTESIS_BLOQUE_DESCRIPTIVO, bd, perfil).ok,
  'un percentil inventado se detecta ya en el bloque, sin esperar la unión');

// ── El camino completo, con la API simulada ──
const CLAVE = { NVIDIA_API_KEY: 'clave-de-prueba' };

let sinClave = cargarGs({}, () => { throw new Error('no debería llamar'); });
const sinClaveR = sinClave.sintesisDeLiderazgo('Fran', resultados);
ok(sinClaveR.sintesis === null, 'sin clave configurada no devuelve síntesis y no llama a la API');
ok(/NVIDIA_API_KEY/.test(sinClaveR.motivo),
  'y el motivo nombra la propiedad que falta, para no tener que adivinar', sinClaveR.motivo);

let reg = { llamadas: [] };
let bueno = cargarGs(CLAVE, fetchPorBloque(reg));
let obtenida = bueno.sintesisDeLiderazgo('Fran', resultados).sintesis;
ok(obtenida !== null, 'con las dos respuestas válidas devuelve la síntesis');
ok(reg.llamadas.join(',') === 'descriptivo,analitico',
  'son dos llamadas, primero la descriptiva y después la analítica', reg.llamadas.join(','));
ok(reg.tokens <= 1200,
  'el techo de tokens por bloque queda acotado para que la llamada no se corte', `es ${reg.tokens}`);
ok(obtenida && obtenida.modelo, 'la síntesis queda sellada con el modelo que la redactó');
ok(obtenida && obtenida.resumenGeneral && obtenida.inferencias && obtenida.recomendaciones,
  'la síntesis unida trae los campos de los dos bloques');
ok(gs.validarSintesis(obtenida, perfil).ok, 'la síntesis unida pasa la validación completa');

// Si el primer bloque falla, no se pide el segundo: no tiene sentido gastarlo.
reg = { llamadas: [] };
let falla1 = cargarGs(CLAVE, fetchPorBloque(reg, (clave) =>
  clave === 'descriptivo' ? respuestaSimulada(500, 'boom') : null));
const falla1R = falla1.sintesisDeLiderazgo('Fran', resultados);
ok(falla1R.sintesis === null, 'si falla el bloque descriptivo no devuelve síntesis');
ok(/descriptivo/.test(falla1R.motivo) && /500/.test(falla1R.motivo),
  'el motivo dice qué bloque falló y con qué error', falla1R.motivo);
ok(reg.llamadas.indexOf('analitico') < 0,
  'si falla el primer bloque no se pide el segundo', reg.llamadas.join(','));

// Si falla el segundo, se descarta todo: mezclar prosa del modelo con prosa fija
// en la misma sección habilitaría las contradicciones que el PO señaló en HU2.
reg = { llamadas: [] };
let falla2 = cargarGs(CLAVE, fetchPorBloque(reg, (clave) =>
  clave === 'analitico' ? respuestaSimulada(500, 'boom') : null));
const falla2R = falla2.sintesisDeLiderazgo('Fran', resultados);
ok(falla2R.sintesis === null, 'si falla el bloque analítico se descarta la síntesis entera');
ok(/anal/.test(falla2R.motivo), 'y el motivo nombra el bloque analítico', falla2R.motivo);

// Reintento acotado a su propio bloque.
reg = { llamadas: [] };
let reintenta = cargarGs(CLAVE, fetchPorBloque(reg, (clave, datos, r) => {
  const previas = r.llamadas.filter((l) => l === clave).length;
  if (clave === 'analitico' && previas === 1) return respuestaSimulada(200, 'esto no es json');
  return null;
}));
ok(reintenta.sintesisDeLiderazgo('Fran', resultados).sintesis !== null,
  'un JSON roto en el bloque analítico se recupera en su segundo intento');
ok(reg.llamadas.filter((l) => l === 'descriptivo').length === 1,
  'el reintento del analítico no vuelve a pedir el descriptivo',
  reg.llamadas.join(','));

reg = { llamadas: [] };
let error500 = cargarGs(CLAVE, fetchPorBloque(reg, () => respuestaSimulada(500, 'boom')));
ok(error500.sintesisDeLiderazgo('Fran', resultados).sintesis === null,
  'un error de la API no devuelve síntesis');
// 2 intentos × 2 modelos: el error se reintenta dentro del modelo, y después la
// síntesis entera se rehace con el suplente.
ok(reg.llamadas.length === 4, 'un error de la API se reintenta una vez por bloque y por modelo', `hubo ${reg.llamadas.length}`);

reg = { llamadas: [] };
let invalido = cargarGs(CLAVE, fetchPorBloque(reg, (clave, datos) => {
  if (clave !== 'descriptivo') return null;
  datos.fortalezas[0].texto = 'Consideración en P83.'; // percentil inventado
  return respuestaSimulada(200, JSON.stringify(datos));
}));
const invR = invalido.sintesisDeLiderazgo('Fran', resultados);
ok(invR.sintesis === null, 'un bloque que no valida no llega al informe');
ok(/P83/.test(invR.motivo), 'y el motivo dice qué número inventó el modelo', invR.motivo);

// Un corte por tiempo sí se reintenta: partido en bloques, un corte es un atasco
// puntual del servicio (medido: un bloque de 25 s que tardó 77 s), no el techo
// estructural que era con la llamada única.
reg = { llamadas: [] };
let corte = cargarGs(CLAVE, () => {
  reg.llamadas.push('x');
  throw new Error('Address unavailable: tardó demasiado');
});
const corteR = corte.sintesisDeLiderazgo('Fran', resultados);
ok(corteR.sintesis === null, 'si el corte por tiempo persiste, no devuelve síntesis');
ok(/interrump/.test(corteR.motivo), 'y el motivo dice que la llamada se interrumpió', corteR.motivo);
ok(reg.llamadas.length === 4,
  'un corte por tiempo se reintenta una vez con cada modelo', `hubo ${reg.llamadas.length}`);

// Y si el reintento sale a velocidad normal, la síntesis se completa igual.
reg = { llamadas: [] };
let corteRecupera = cargarGs(CLAVE, fetchPorBloque(reg, (clave, datos, r) => {
  if (r.llamadas.filter((l) => l === clave).length === 1) {
    throw new Error('Address unavailable: tardó demasiado');
  }
  return null;
}));
ok(corteRecupera.sintesisDeLiderazgo('Fran', resultados).sintesis !== null,
  'un corte en el primer intento de cada bloque se recupera en el segundo');

// ── El modelo suplente ──
//
// Es lo que evita caer en el texto determinista cuando el problema es el modelo y
// no la síntesis: una cuota agotada devuelve 429 y no tiene nada que ver con lo
// que se le pidió, así que otro modelo tiene todas las chances de contestar bien.
const PRINCIPAL = 'nvidia/llama-3.3-nemotron-super-49b-v1.5';
const SUPLENTE = 'nvidia/llama-3.3-nemotron-super-49b-v1';
ok(gs.LLM_MODELOS_POR_DEFECTO.join(',') === `${PRINCIPAL},${SUPLENTE}`,
  'el principal va primero y el suplente después', gs.LLM_MODELOS_POR_DEFECTO.join(','));

reg = { llamadas: [] };
let conCuota = cargarGs(CLAVE, fetchPorBloque(reg, (clave, datos, r) =>
  (r.modelos[r.modelos.length - 1] === PRINCIPAL
    ? respuestaSimulada(429, 'Too Many Requests')
    : null)));
const conCuotaR = conCuota.sintesisDeLiderazgo('Fran', resultados);
ok(conCuotaR.sintesis !== null,
  'si el modelo principal agota la cuota, el suplente redacta la síntesis', conCuotaR.motivo);
ok(conCuotaR.sintesis && conCuotaR.sintesis.modelo === SUPLENTE,
  'y la síntesis queda sellada con el modelo que efectivamente la escribió',
  conCuotaR.sintesis && conCuotaR.sintesis.modelo);
ok(reg.modelos.indexOf(SUPLENTE) > reg.modelos.lastIndexOf(PRINCIPAL),
  'el suplente entra después del principal, no antes', reg.modelos.join(','));
// Los dos bloques del informe los escribe el mismo modelo: si el suplente
// redactara sólo el que falló, la sección quedaría con dos voces.
ok(reg.llamadas.slice(reg.modelos.indexOf(SUPLENTE)).join(',') === 'descriptivo,analitico',
  'el suplente rehace la síntesis entera, no sólo el bloque que falló',
  reg.llamadas.join(','));

reg = { llamadas: [] };
let dosFallan = cargarGs(CLAVE, fetchPorBloque(reg, () => respuestaSimulada(429, 'Too Many Requests')));
const dosFallanR = dosFallan.sintesisDeLiderazgo('Fran', resultados);
ok(dosFallanR.sintesis === null, 'si los dos modelos fallan sale el texto determinista');
ok(dosFallanR.motivo.indexOf(PRINCIPAL) >= 0 && dosFallanR.motivo.indexOf(SUPLENTE) >= 0,
  'y el motivo nombra a los dos modelos, para no adivinar cuál falló', dosFallanR.motivo);

// Quien tenga NVIDIA_MODELO configurado con un solo modelo sigue con ese y nada
// más: sumarle un suplente en silencio sería cambiarle lo que eligió.
reg = { llamadas: [] };
let unoSolo = cargarGs(
  { NVIDIA_API_KEY: 'clave-de-prueba', NVIDIA_MODELO: 'un/modelo-elegido' },
  fetchPorBloque(reg, () => respuestaSimulada(429, 'Too Many Requests')));
unoSolo.sintesisDeLiderazgo('Fran', resultados);
ok(reg.modelos.every((m) => m === 'un/modelo-elegido'),
  'con un solo modelo configurado no se prueba ningún otro', reg.modelos.join(','));

reg = { llamadas: [] };
let dosConfigurados = cargarGs(
  { NVIDIA_API_KEY: 'clave-de-prueba', NVIDIA_MODELO: ' primero/a , segundo/b ' },
  fetchPorBloque(reg, (clave, datos, r) =>
    (r.modelos[r.modelos.length - 1] === 'primero/a' ? respuestaSimulada(429, 'no') : null)));
const dosConfR = dosConfigurados.sintesisDeLiderazgo('Fran', resultados);
ok(dosConfR.sintesis && dosConfR.sintesis.modelo === 'segundo/b',
  'la propiedad admite varios modelos separados por coma, en ese orden',
  reg.modelos.join(','));

// El plazo. Sin él, dos modelos × dos bloques × dos intentos × 60 s se pasarían
// de los 6 minutos de Apps Script y el informe no saldría nunca.
ok(gs.LLM_PLAZO_MS + 90000 <= 360000,
  'el plazo de la síntesis deja margen para el resto de la corrida dentro de los 6 minutos',
  `${gs.LLM_PLAZO_MS} ms`);
ok(!gs.hayTiempo(new Date().getTime()), 'con el plazo vencido no entra ninguna llamada más');
ok(!gs.hayTiempo(new Date().getTime() + 59000),
  'ni con menos tiempo del que puede tardar una llamada suelta');
ok(gs.hayTiempo(new Date().getTime() + gs.LLM_PLAZO_MS), 'y al arrancar sí entra');

reg = { llamadas: [] };
let vencido = cargarGs(CLAVE, fetchPorBloque(reg));
const vencidoR = vencido.pedirBloque(
  vencido.SINTESIS_BLOQUE_DESCRIPTIVO,
  vencido.mensajesBloqueDescriptivo('Fran', perfil),
  perfil, 'clave-de-prueba', PRINCIPAL, new Date().getTime() - 1);
ok(vencidoR.datos === null && /tiempo/.test(vencidoR.motivo),
  'con el plazo vencido el bloque no se pide y el motivo lo dice', vencidoR.motivo);
ok(reg.llamadas.length === 0,
  'y no se llama a la API para nada', reg.llamadas.join(','));

// ── El renderizado en el documento ──
const { DocumentApp, Body } = require('./stub-documentapp');

function cargarDocumento() {
  // Perfil.gs entra porque la síntesis determinista pasó a decidir sus áreas de
  // desarrollo con `brechasDeDesarrollo`, la misma función que usa la sección 3.
  const fuente = ['Correccion.gs', 'Textos.gs', 'Perfil.gs', 'Documento.gs']
    .map((a) => fs.readFileSync(path.join(RAIZ, a), 'utf8'))
    .join('\n');
  return new Function('DocumentApp', `${fuente}\nreturn { seccionSintesis };`)(DocumentApp);
}

const doc = cargarDocumento();
const cel = resultados.celid.percentil;
const cam = resultados.camin.percentil;
const pot = resultados.potenlid.percentil;
const con = resultados.conlid.percentil;

function textoDe(body) {
  return JSON.stringify(body.bloques || body);
}

const conModelo = sintesisValida();
conModelo.modelo = 'nvidia/llama-3.3-nemotron-super-49b-v1.5';
const conLlm = new Body();
doc.seccionSintesis(conLlm, resultados.neo, cel, cam, pot, con, conModelo);
const renderLlm = textoDe(conLlm);

['Resumen General', 'Fortalezas Clave', 'Áreas de Desarrollo', 'Inferencias del Perfil',
  'Recomendaciones de Acciones Concretas de Desarrollo', 'Contexto de aplicación',
  'Pendiente de Definir'].forEach((titulo) => {
  ok(renderLlm.indexOf(titulo) >= 0, `el informe con LLM incluye el bloque "${titulo}"`);
});
ok(renderLlm.indexOf('Presencia afectiva y dirección difusa') >= 0,
  'las inferencias del modelo llegan al documento');
ok(renderLlm.indexOf('Principales Fortalezas') < 0,
  'con síntesis del LLM no se emite además el texto determinista');
ok(/asistida por IA/.test(renderLlm),
  'el informe declara que la síntesis fue asistida por IA');
ok(renderLlm.indexOf('llama-3.3-nemotron-super-49b-v1.5') >= 0
  && renderLlm.indexOf('nvidia/') < 0,
  'la nota nombra el modelo sin el prefijo del proveedor');
ok(!/percentiles y puntajes/.test(renderLlm),
  'la nota no menciona percentiles ni puntajes: el PO pidió que este punto no los lleve');
ok(/revisión profesional/.test(renderLlm),
  'la nota conserva la advertencia de revisión profesional');

// El rótulo va en negrita y el contenido no. En Docs appendText hereda el formato
// del tramo anterior, así que sin apagar la negrita explícitamente el párrafo
// entero salía en negrita — pasaba en todos los informes generados hasta ahora.
const parrafosLlm = conLlm.bloques.filter((b) => b.tipo === 'parrafo' && b.tramos.length > 1);
ok(parrafosLlm.length > 0, 'hay párrafos con rótulo y contenido para revisar');
const mezclados = parrafosLlm.filter((p) => p.tramos.some((t) => t.negrita)
  && p.tramos.some((t) => !t.negrita));
ok(mezclados.length === parrafosLlm.length,
  'en todo párrafo de rótulo + contenido, sólo el rótulo va en negrita',
  parrafosLlm.filter((p) => p.tramos.every((t) => t.negrita))
    .map((p) => p.tramos.map((t) => t.texto).join('')).join(' | '));

const conAccion = parrafosLlm.find((p) => p.tramos[0].texto.indexOf('Acción:') >= 0);
ok(conAccion && conAccion.tramos[0].negrita === true && conAccion.tramos[1].negrita === false,
  '"Acción:" va en negrita y lo que sigue no',
  conAccion && JSON.stringify(conAccion.tramos.map((t) => [t.texto.slice(0, 20), t.negrita])));

const sinLlm = new Body();
doc.seccionSintesis(sinLlm, resultados.neo, cel, cam, pot, con, null);
const renderSinLlm = textoDe(sinLlm);
ok(renderSinLlm.indexOf('Principales Fortalezas') >= 0,
  'sin síntesis del LLM se emite el texto determinista de siempre');
ok(renderSinLlm.indexOf('Objetivos de Desarrollo Sugeridos') >= 0,
  'el texto determinista conserva sus objetivos de desarrollo');
ok(renderSinLlm.indexOf('Inferencias del Perfil') < 0,
  'el texto determinista no promete inferencias que no calcula');
// El informe siempre declara qué lo escribió, incluso —sobre todo— cuando lo
// escribió el texto fijo: es el caso que más importa avisar, porque es el que hay
// que revisar más.
ok(/texto determinista/.test(renderSinLlm),
  'el texto determinista declara que la síntesis no la escribió una IA');
ok(!/asistida por IA/.test(renderSinLlm),
  'y no se atribuye a ningún modelo');
ok(/revisión profesional/.test(renderSinLlm),
  'el texto determinista también pide la revisión profesional antes de la devolución');
ok(!/llama|nemotron|nvidia/i.test(renderSinLlm),
  'no nombra ningún modelo cuando no intervino ninguno');

// ── Salida ──
console.log(`\n${pasaron}/${pasaron + fallos.length} verificaciones de la síntesis en verde`);
if (fallos.length) {
  console.log('\nFallaron:');
  fallos.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
