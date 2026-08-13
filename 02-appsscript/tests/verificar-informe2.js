/**
 * Verificación del Informe 2: la redacción (Sintesis2.gs) y el armado
 * (Documento2.gs).
 *
 * No llama a la API. Lo que se prueba es todo lo que rodea a la llamada, que es
 * donde el informe se puede romper sin que nadie se entere.
 *
 * LO QUE MÁS IMPORTA ACÁ es la validación de las citas. El Informe 1 tiene
 * prohibido escribir números y alcanza con buscarlos; el Informe 2 se apoya en
 * ellos —"Amabilidad T=64 con Considerado P99" es su contenido— así que hay que
 * verificar uno por uno que existan. Sin eso, un percentil inventado y uno real
 * se leen exactamente igual, y el inventado termina en el legajo.
 *
 * Uso:  node verificar-informe2.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { DocumentApp, Body, normalizar } = require('./stub-documentapp');

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

/**
 * Sintesis2.gs se apoya en el punto 5 (perfil, validaciones de nivel y de
 * brecha) y en el formato del informe (`pct`, `dec`), así que se carga todo
 * junto. Es la misma pila que corre en Apps Script.
 */
function cargarGs(propiedades, fetchSimulado) {
  const fuente = ['Correccion.gs', 'Textos.gs', 'Perfil.gs', 'Puesto.gs',
    'Documento.gs', 'Documento2.gs', 'Sintesis.gs', 'Sintesis2.gs']
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
    'PropertiesService', 'UrlFetchApp', 'console', 'DocumentApp',
    `${fuente}\nreturn { corregir, perfilParaSintesis, perfilParaSintesis2,
      sintesis2Determinista, sintesisDelInforme2, validarSintesis2, validarBloque2,
      validarCitasPsicometricas, validarValoresCerrados, textoDeSintesis2, ponerNombre2,
      mensajesBloqueEjecutivo, mensajesBloqueBrechas, mensajesBloqueAnalitico2,
      mensajesBloquePlan, contrasteParaElModelo, construirInforme2, adecuacionAlPuesto,
      SINTESIS2_BLOQUE_EJECUTIVO, SINTESIS2_BLOQUE_BRECHAS, SINTESIS2_BLOQUE_ANALITICO,
      SINTESIS2_BLOQUE_PLAN, SINTESIS2_MAX_TOKENS, SINTESIS_MARCADOR_NOMBRE,
      nivelPorPercentil };`
  )(PropertiesService, UrlFetchApp, consolaMuda, DocumentApp);
}

/** Una copia honda, para poder romper un campo sin arrastrar al resto. */
function copia(objeto) {
  return JSON.parse(JSON.stringify(objeto));
}

/**
 * Un perfil de puesto ya leído, como el que devuelve `leerPerfilDePuesto`.
 * Los niveles requeridos están elegidos contra el caso 0 del fixture para que
 * haya de las tres cosas: alineación completa, brecha y exigencia crítica.
 */
function lecturaDePuesto() {
  return {
    id: 'perfil-id',
    nombre: 'Perfil Scrum Master.pdf',
    puesto: 'Scrum Master',
    modelo: 'nvidia/modelo-de-prueba',
    exigencias: [
      { clave: 'Carisma', instrumento: 'celid', esNeo: false, invertida: false,
        dimension: 'Carisma / Influencia Idealizada', nivelRequerido: 'Alto',
        critica: true, cita: 'liderazgo inspirador' },
      { clave: 'Part', instrumento: 'camin', esNeo: false, invertida: false,
        dimension: 'Liderazgo Participativo', nivelRequerido: 'Alto',
        critica: true, cita: 'facilitación del equipo' },
      { clave: 'Tar', instrumento: 'conlid', esNeo: false, invertida: false,
        dimension: 'Conductas Orientadas a la Tarea', nivelRequerido: 'Alto',
        critica: false, cita: 'seguimiento de entregables' },
    ],
    descartadas: [],
    noMedidos: [{ requisito: 'Título universitario en Sistemas', cita: 'título' }],
  };
}

/** Los bloques que devuelve la API, armados sobre valores que existen. */
function bloqueEjecutivo() {
  return {
    veredicto: 'La evaluación integra cinco instrumentos y los lee de forma conjunta. '
      + 'El perfil resulta parcialmente compatible con el puesto.',
    resumenGeneral: 'Conduce apoyándose en el vínculo con cada integrante del equipo, '
      + 'con Consideración Individualizada en P99 (CELID-A) y Extraversión en T=64 (NEO-FFI).',
    fortalezas: [
      { titulo: 'Acompañamiento e Inclusión', fuentes: 'NEO-FFI + CAMIN-A',
        texto: 'La Extraversión en T=64 converge con el Liderazgo Considerado en P99 (CAMIN-A): '
          + 'escucha a cada colaborador y contempla sus necesidades al repartir el trabajo.' },
      { titulo: 'Conducción Participativa', fuentes: 'CAMIN-A',
        texto: 'El Liderazgo Participativo en P99 se traduce en decisiones consultadas.' },
      { titulo: 'Impulso de la Transformación', fuentes: 'CONLID-A',
        texto: 'Las Conductas Orientadas al Cambio en P90 sostienen los cambios de proceso.' },
    ],
  };
}

function bloqueBrechas() {
  return {
    areasDesarrollo: [
      { dimension: 'Recompensa Contingente', titulo: 'Contingencias de Desempeño',
        fuentes: 'CELID-A', texto: 'La Recompensa Contingente en P25 deja el reconocimiento '
          + 'librado a la ocasión.' },
      { dimension: 'Liderazgo Directivo', titulo: 'Directividad Situacional',
        fuentes: 'CAMIN-A', texto: 'El Liderazgo Directivo en P50 no alcanza para las '
          + 'situaciones que no admiten consenso.' },
      { dimension: 'Conductas Orientadas a la Tarea', titulo: 'Estructuración y Seguimiento',
        fuentes: 'CONLID-A', texto: 'Las Conductas Orientadas a la Tarea en P50 dejan el '
          + 'seguimiento sin sistematizar.' },
    ],
    matrizOperativa: [
      { categoria: 'Fortaleza Operativa', hallazgo: 'Liderazgo Participativo P99 (CAMIN-A)',
        impacto: 'Sostiene la cohesión del equipo.' },
      { categoria: 'Riesgo Operativo Crítico', hallazgo: 'Recompensa Contingente P25 (CELID-A)',
        impacto: 'Los acuerdos no tienen contingencia asociada.' },
      { categoria: 'Riesgo Operativo Moderado', hallazgo: 'Conductas de Tarea P50 (CONLID-A)',
        impacto: 'El seguimiento llega tarde.' },
    ],
  };
}

function bloqueAnalitico() {
  return {
    coherencias: [
      { tipo: 'Coherencia', titulo: 'Orientación Prosocial Sostenida',
        texto: 'La Extraversión en T=64 acompaña al Liderazgo Considerado en P99.' },
      { tipo: 'Incoherencia', titulo: 'Inclusión sin Control de Cumplimiento',
        texto: 'El Liderazgo Participativo en P99 convive con la Recompensa Contingente en P25.' },
    ],
    inferencias: [
      { titulo: 'Presencia Relacional con Baja Intervención', fuentes: 'CAMIN-A + CELID-A',
        texto: 'La conducción se apoya en el vínculo y no en el control del cumplimiento. '
          + 'El riesgo es que el clima se preserve a costa de no abordar los desvíos.' },
      { titulo: 'Cambio sin Cuestionamiento Propio', fuentes: 'CONLID-A + CELID-A',
        texto: 'Las Conductas de Cambio en P90 contrastan con la Estimulación Intelectual en P50.' },
      { titulo: 'Motivación Ligada a la Expectativa', fuentes: 'POTENLID',
        texto: 'La Motivación Intrínseca en P75 sostiene el interés por el rol.' },
    ],
    clarificaciones: [
      { titulo: 'Madurez del Equipo Actual', pregunta: '¿Qué autonomía tiene hoy el equipo?' },
      { titulo: 'Herramientas de Desempeño', pregunta: '¿Con qué instrumentos formales se mide?' },
      { titulo: 'Requisitos Técnicos', pregunta: '¿Cómo se evalúan los requisitos técnicos?' },
    ],
  };
}

function bloquePlan() {
  return {
    ejes: [
      { titulo: 'Claridad Operativa y Expectativas', prioridad: 'Alta',
        fundamento: 'Liderazgo Directivo P50 (CAMIN-A)', contexto: 'Equipos de baja autonomía.',
        accion: 'Acordar al inicio de cada ciclo el resultado esperado y los puntos de control.',
        plazo: '90 días', indicador: '80 % de los ciclos con acuerdos escritos.' },
      { titulo: 'Reconocimiento Contingente', prioridad: 'Alta',
        fundamento: 'Recompensa Contingente P25 (CELID-A)', contexto: 'Equipos de madurez media.',
        accion: 'Registrar quincenalmente los reconocimientos ligados a metas cumplidas.',
        plazo: 'dos trimestres', indicador: 'Un registro por quincena, sin excepciones.' },
      { titulo: 'Estructuración del Seguimiento', prioridad: 'Media',
        fundamento: 'Conductas de Tarea P50 (CONLID-A)', contexto: 'Equipos de alta autonomía.',
        accion: 'Definir estándares explícitos de cierre y revisarlos en cada entrega.',
        plazo: '180 días', indicador: '100 % de las entregas con criterio de cierre acordado.' },
    ],
    informacionLider: {
      pautas: 'Respaldar su autoridad cuando tenga que confrontar un desvío.',
      frecuencia: 'Reuniones quincenales de 45 minutos durante los primeros 90 días.',
      kpis: 'Frecuencia de feedback formal registrado y porcentaje de hitos cumplidos.',
      disparadores: 'Desvíos que se repiten sin que se los aborde.',
    },
    registros: {
      lider: 'Fortalezas en Liderazgo Participativo P99 y brechas en Recompensa Contingente P25.',
      evaluado: 'Su perfil se destaca por la construcción de acuerdos y la cercanía con el equipo.',
    },
  };
}

/** La síntesis completa, como queda después de unir los cuatro bloques. */
function sintesisValida() {
  return Object.assign({}, bloqueEjecutivo(), bloqueBrechas(), bloqueAnalitico(), bloquePlan());
}

/** Responde el bloque que corresponda según lo que pide el prompt. */
function fetchPorBloque(registro, torcer) {
  return (url, opciones) => {
    const cuerpo = JSON.parse(opciones.payload);
    const instrucciones = cuerpo.messages[0].content;
    const clave = instrucciones.indexOf('PRIMERA de cuatro') >= 0 ? 'ejecutivo'
      : (instrucciones.indexOf('SEGUNDA de cuatro') >= 0 ? 'brechas'
        : (instrucciones.indexOf('TERCERA de cuatro') >= 0 ? 'analitico' : 'plan'));
    registro.llamadas.push(clave);
    registro.modelos.push(cuerpo.model);
    registro.tokens = cuerpo.max_tokens;
    const datos = { ejecutivo: bloqueEjecutivo(), brechas: bloqueBrechas(),
      analitico: bloqueAnalitico(), plan: bloquePlan() }[clave];
    return (torcer && torcer(clave, datos, registro))
      || respuestaSimulada(200, JSON.stringify(datos));
  };
}

function respuestaSimulada(codigo, contenido) {
  return {
    getResponseCode: () => codigo,
    getContentText: () => (codigo === 200
      ? JSON.stringify({ choices: [{ message: { content: contenido } }] })
      : contenido),
  };
}

// ───────────────────────────────────────────────────────────────────
const gs = cargarGs();
const referencia = JSON.parse(fs.readFileSync(REFERENCIA, 'utf8'));
const resultados = gs.corregir(referencia[0].respuestas);
const perfil = gs.perfilParaSintesis2(resultados);
const adecuacion = gs.adecuacionAlPuesto(lecturaDePuesto(), resultados);
const CONTEXTO = { puesto: 'Scrum Master', gerencia: 'Tecnología', sector: 'Infraestructura' };

// ── El perfil que ve el modelo ──
// Es el MISMO perfil del punto 5 con los valores agregados. Que se construya
// sobre él y no al lado es lo que garantiza que los nombres y los niveles de las
// dimensiones sean idénticos en los dos informes: las validaciones de nivel
// comparan por nombre y, si se separaran, dejarían de ver nada.
const perfilDelPunto5 = gs.perfilParaSintesis(resultados);
ok(perfil.dimensiones.length === perfilDelPunto5.dimensiones.length
  && perfil.dimensiones.every((d, i) => d.dimension === perfilDelPunto5.dimensiones[i].dimension
    && d.nivel === perfilDelPunto5.dimensiones[i].nivel),
  'el perfil del Informe 2 trae las mismas dimensiones y niveles que el del punto 5');
ok(perfil.neo.every((d) => typeof d.t === 'number' && typeof d.pd === 'number'),
  'y además el puntaje directo y el T de cada rasgo, que el Informe 2 sí cita');
const amabilidad = perfil.neo.find((d) => d.dimension === 'Amabilidad');
ok(amabilidad && amabilidad.t === resultados.neo.t.A,
  'el T de cada rasgo es el suyo: el NEO se recorre por nombre, no por posición',
  amabilidad && `Amabilidad T=${amabilidad.t}, esperado ${resultados.neo.t.A}`);
ok(perfil.percentiles.length === perfil.dimensiones.length && perfil.tes.length === 5,
  'la lista de valores citables lleva los 19 percentiles y los 5 puntajes T');

// ── Los cuatro prompts ──
const prompts = [
  ['ejecutivo', gs.mensajesBloqueEjecutivo(perfil, adecuacion, CONTEXTO)],
  ['brechas', gs.mensajesBloqueBrechas(perfil, adecuacion, CONTEXTO, bloqueEjecutivo())],
  ['analítico', gs.mensajesBloqueAnalitico2(perfil, adecuacion, CONTEXTO, bloqueEjecutivo())],
  ['plan', gs.mensajesBloquePlan(perfil, adecuacion, CONTEXTO, bloqueEjecutivo())],
];

prompts.forEach(([nombre, m]) => {
  ok(m.length === 2 && m[0].role === 'system' && m[1].role === 'user',
    `el bloque ${nombre} son dos mensajes, sistema y usuario`);
  ok(m[0].content.indexOf('/no_think') === 0,
    `el bloque ${nombre} arranca apagando el razonamiento del modelo`);
  // El nombre de la persona no sale del proyecto, igual que en el Informe 1.
  ok(m[1].content.indexOf(gs.SINTESIS_MARCADOR_NOMBRE) >= 0,
    `el bloque ${nombre} manda el marcador en lugar del nombre`);
  // Al revés que el punto 5: acá los valores SÍ viajan, porque el informe se
  // apoya en la triangulación explícita.
  ok(/\bP\d{1,2}\b/.test(m[1].content),
    `los percentiles viajan al bloque ${nombre}: son el contenido de este informe`);
  ok(/\bT=\d+\b/.test(m[1].content),
    `y los puntajes T también, al bloque ${nombre}`);
  ok(m[1].content.indexOf('Gerencia: Tecnología') >= 0
    && m[1].content.indexOf('Sector: Infraestructura') >= 0,
    `la gerencia y el sector llegan al bloque ${nombre}`);
  ok(m[1].content.indexOf('EL MISMO PERFIL AGRUPADO POR NIVEL') >= 0,
    `el bloque ${nombre} lleva el perfil agrupado por nivel, que es lo que evita confundir dimensiones parecidas`);
  ok(m[0].content.indexOf('no los traduzcas a percentiles') >= 0,
    `el bloque ${nombre} prohíbe inventar el percentil del nivel que pide el puesto`);
});

const soloEjecutivo = prompts[0][1][0].content;
ok(soloEjecutivo.indexOf('PRIMERA de cuatro') >= 0, 'el prompt dice cuál de los cuatro bloques es');
ok(prompts[3][1][0].content.indexOf('informacionLider') >= 0,
  'el bloque del plan pide las pautas para la jefatura');
ok(prompts[3][1][0].content.indexOf('disparadores') >= 0,
  'incluidos los disparadores de riesgo operativo');
ok(prompts[3][1][0].content.indexOf('"plazo"') >= 0
  && prompts[3][1][0].content.indexOf('"indicador"') >= 0,
  'y cada eje del plan pide su plazo y su indicador de gestión');
ok(prompts[1][1][1].content.indexOf('YA SE ESCRIBIÓ EN ESTE MISMO INFORME') >= 0,
  'los bloques posteriores reciben los títulos de lo ya escrito, para no repetirlo');
ok(prompts[0][1][1].content.indexOf('YA SE ESCRIBIÓ EN ESTE MISMO INFORME') < 0,
  'y el primero no, porque todavía no hay nada escrito');

// El contraste con el puesto viaja YA CALCULADO. Si el modelo tuviera que
// deducir la brecha restando niveles, inventaría el número.
const contraste = gs.contrasteParaElModelo(adecuacion);
ok(contraste.indexOf('Índice de adecuación al puesto: ' + adecuacion.porcentaje + ' %') >= 0,
  'el índice viaja calculado, no se le pide al modelo que lo estime', contraste.slice(0, 120));
ok(contraste.indexOf('aporte') >= 0 && contraste.indexOf('brecha de') >= 0,
  'y con el aporte y la brecha de cada dimensión, también calculados');
const sinPuesto = gs.contrasteParaElModelo(null);
ok(sinPuesto.indexOf('no se cargó el perfil de puesto') >= 0
  && sinPuesto.indexOf('NO inventes') >= 0,
  'sin perfil de puesto se le dice al modelo que no invente requerimientos');

// ── Las validaciones ──
const valida = sintesisValida();
ok(gs.validarSintesis2(valida, perfil).ok, 'una síntesis bien formada valida',
  gs.validarSintesis2(valida, perfil).motivo);

// LO QUE MÁS IMPORTA: los valores citados tienen que existir.
const conPercentilInventado = copia(valida);
conPercentilInventado.fortalezas[0].texto = 'El Liderazgo Considerado en P87 sostiene el clima.';
ok(!gs.validarSintesis2(conPercentilInventado, perfil).ok,
  'rechaza un percentil que no está en el perfil',
  gs.validarSintesis2(conPercentilInventado, perfil).motivo);

const conTInventado = copia(valida);
conTInventado.fortalezas[0].texto = 'La Extraversión en T=71 sostiene la presencia.';
ok(!gs.validarSintesis2(conTInventado, perfil).ok,
  'rechaza un puntaje T que no está en el perfil');

const conPercentilEnPalabras = copia(valida);
conPercentilEnPalabras.resumenGeneral = 'Alcanza el percentil 87 en consideración.';
ok(!gs.validarSintesis2(conPercentilEnPalabras, perfil).ok,
  'y también cuando el percentil se escribe con todas las letras');

const conValorReal = copia(valida);
conValorReal.resumenGeneral = 'La Consideración Individualizada llega a P99 y la Extraversión a T=64.';
ok(gs.validarSintesis2(conValorReal, perfil).ok,
  'los valores que sí están en el perfil pasan', gs.validarSintesis2(conValorReal, perfil).motivo);

// El número de una meta del plan no es una cita psicométrica: "80 % de los
// ciclos" tiene que poder escribirse.
const conMeta = copia(valida);
conMeta.ejes[0].indicador = '95 % de los ciclos con acuerdos escritos en 30 días.';
ok(gs.validarSintesis2(conMeta, perfil).ok,
  'las metas y los plazos del plan sí pueden llevar números propios',
  gs.validarSintesis2(conMeta, perfil).motivo);

// Valores cerrados: la categoría pinta la fila y la prioridad ordena el plan.
const conCategoriaLibre = copia(valida);
conCategoriaLibre.matrizOperativa[0].categoria = 'Riesgo alto';
ok(!gs.validarSintesis2(conCategoriaLibre, perfil).ok,
  'rechaza una categoría que no es una de las tres de la tabla');
const conPrioridadLibre = copia(valida);
conPrioridadLibre.ejes[0].prioridad = 'Urgente';
ok(!gs.validarSintesis2(conPrioridadLibre, perfil).ok,
  'rechaza una prioridad que no es Alta, Media o Baja');
const conTipoLibre = copia(valida);
conTipoLibre.coherencias[0].tipo = 'Convergencia';
ok(!gs.validarSintesis2(conTipoLibre, perfil).ok,
  'rechaza un tipo de coherencia inventado');

// Las dos validaciones que se comparten con el punto 5.
const conBrechaFalsa = copia(valida);
conBrechaFalsa.areasDesarrollo[0].dimension = 'Liderazgo Participativo';
ok(!gs.validarSintesis2(conBrechaFalsa, perfil).ok,
  'rechaza una brecha declarada sobre una dimensión que está en nivel alto');
const conMotivacion = copia(valida);
conMotivacion.areasDesarrollo[0].titulo = 'Motivación extrínseca baja';
ok(!gs.validarSintesis2(conMotivacion, perfil).ok,
  'rechaza presentar la motivación extrínseca como área de desarrollo');
const conNivelMal = copia(valida);
conNivelMal.resumenGeneral = 'Se observa un nivel bajo en Liderazgo Participativo.';
ok(!gs.validarSintesis2(conNivelMal, perfil).ok,
  'rechaza atribuirle a una dimensión un nivel que no tiene');

// Estructura.
['veredicto', 'resumenGeneral'].forEach((campo) => {
  const roto = copia(valida);
  roto[campo] = '';
  ok(!gs.validarSintesis2(roto, perfil).ok, `rechaza la síntesis sin ${campo}`);
});
const sinCampoDeEje = copia(valida);
delete sinCampoDeEje.ejes[0].indicador;
ok(!gs.validarSintesis2(sinCampoDeEje, perfil).ok,
  'rechaza un eje del plan sin indicador de gestión');
const sinLider = copia(valida);
delete sinLider.informacionLider.disparadores;
ok(!gs.validarSintesis2(sinLider, perfil).ok,
  'rechaza la información para la jefatura sin los disparadores de riesgo');
const sinRegistro = copia(valida);
sinRegistro.registros.evaluado = '   ';
ok(!gs.validarSintesis2(sinRegistro, perfil).ok,
  'rechaza el registro de RRHH sin la síntesis para la persona evaluada');

// La jerga interna sigue prohibida, aunque las siglas de los cuestionarios no.
const conSiglas = copia(valida);
conSiglas.resumenGeneral = 'El CELID-A y el NEO-FFI convergen en la lectura del perfil.';
ok(gs.validarSintesis2(conSiglas, perfil).ok,
  'las siglas de los cuestionarios se permiten: este informe es técnico',
  gs.validarSintesis2(conSiglas, perfil).motivo);
const conJerga = copia(valida);
conJerga.resumenGeneral = 'La escala invertida del Laissez-Faire se lee al revés.';
ok(!gs.validarSintesis2(conJerga, perfil).ok,
  'pero el vocabulario interno del código no');

// ── El respaldo determinista ──
// Que tenga la MISMA forma es lo que permite que Documento2.gs tenga un solo
// camino de armado. Si se separan, el informe pobre deja de imprimirse entero.
const determinista = gs.sintesis2Determinista(resultados, adecuacion, CONTEXTO);
ok(Object.keys(valida).every((campo) => determinista[campo] !== undefined),
  'la síntesis determinista trae todos los campos que trae la del modelo',
  Object.keys(valida).filter((c) => determinista[c] === undefined).join(', '));
const revisionDeterminista = gs.validarSintesis2(determinista, perfil);
ok(revisionDeterminista.ok,
  'y pasa las mismas validaciones que se le exigen al modelo', revisionDeterminista.motivo);
ok(determinista.modelo === '',
  'sin modelo: es lo que mira la nota de autoría para decir quién escribió el informe');
ok(gs.textoDeSintesis2(determinista).indexOf(gs.SINTESIS_MARCADOR_NOMBRE) < 0,
  'y no deja el marcador del nombre suelto, porque no pasa por el modelo');

const sinPuestoDeterminista = gs.sintesis2Determinista(resultados, null,
  { puesto: '', gerencia: 'Tecnología', sector: 'Infraestructura' });
ok(gs.validarSintesis2(sinPuestoDeterminista, perfil).ok,
  'la síntesis determinista también sale sin perfil de puesto',
  gs.validarSintesis2(sinPuestoDeterminista, perfil).motivo);
ok(sinPuestoDeterminista.veredicto.indexOf('No se calculó un índice') >= 0,
  'y ahí dice que no hay índice, en vez de imprimir un cero');

// ── El nombre se pone del lado del servidor ──
const conMarcador = copia(valida);
conMarcador.veredicto = 'El perfil de ' + gs.SINTESIS_MARCADOR_NOMBRE + ' es parcialmente compatible.';
conMarcador.ejes[0].accion = gs.SINTESIS_MARCADOR_NOMBRE + ' acuerda los puntos de control.';
conMarcador.registros.evaluado = 'El perfil de ' + gs.SINTESIS_MARCADOR_NOMBRE + ' se destaca.';
conMarcador.informacionLider.pautas = 'Acompañar a ' + gs.SINTESIS_MARCADOR_NOMBRE + ' en los límites.';
const conNombre = gs.ponerNombre2(conMarcador, 'Ana Pérez');
ok(gs.textoDeSintesis2(conNombre).indexOf(gs.SINTESIS_MARCADOR_NOMBRE) < 0,
  'el marcador se reemplaza en todos los campos, incluidos los objetos sueltos');
ok(conNombre.veredicto.indexOf('Ana Pérez') >= 0
  && conNombre.registros.evaluado.indexOf('Ana Pérez') >= 0
  && conNombre.informacionLider.pautas.indexOf('Ana Pérez') >= 0,
  'y en su lugar queda el nombre real');

// ── Las llamadas ──
const registro = { llamadas: [], modelos: [], tokens: 0 };
const conApi = cargarGs({ NVIDIA_API_KEY: 'clave-de-prueba' }, fetchPorBloque(registro));
const salida = conApi.sintesisDelInforme2('Ana Pérez', resultados, adecuacion, CONTEXTO,
  null, Date.now() + 300000);
ok(!!salida.sintesis, 'con la API respondiendo, la síntesis sale del modelo', salida.motivo);
ok(registro.llamadas.join(',') === 'ejecutivo,brechas,analitico,plan',
  'y se piden los cuatro bloques, en orden', registro.llamadas.join(','));
ok(registro.tokens === conApi.SINTESIS2_MAX_TOKENS,
  'con el techo de tokens del Informe 2, que es más alto que el del punto 5',
  String(registro.tokens));
ok(salida.sintesis && salida.sintesis.modelo === 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
  'la síntesis dice con qué modelo se escribió');

// Un bloque que no valida descarta la síntesis entera y se prueba el suplente:
// mezclar prosa de dos modelos en el mismo informe deja dos voces.
const registro2 = { llamadas: [], modelos: [], tokens: 0 };
const conBloqueMalo = cargarGs({ NVIDIA_API_KEY: 'clave' }, fetchPorBloque(registro2,
  (clave, datos, reg) => {
    if (clave === 'analitico' && reg.modelos[reg.modelos.length - 1].indexOf('v1.5') >= 0) {
      const roto = copia(datos);
      roto.inferencias[0].texto = 'La Consideración Individualizada llega a P87.';
      return respuestaSimulada(200, JSON.stringify(roto));
    }
    return null;
  }));
const conSuplente = conBloqueMalo.sintesisDelInforme2('Ana Pérez', resultados, adecuacion,
  CONTEXTO, null, Date.now() + 300000);
ok(!!conSuplente.sintesis && conSuplente.sintesis.modelo.indexOf('v1.5') < 0,
  'si un bloque no valida, la síntesis se rehace entera con el modelo suplente',
  conSuplente.sintesis && conSuplente.sintesis.modelo);

const sinClave = cargarGs({}).sintesisDelInforme2('Ana Pérez', resultados, adecuacion,
  CONTEXTO, null, Date.now() + 300000);
ok(sinClave.sintesis === null && sinClave.motivo.indexOf('NVIDIA_API_KEY') >= 0,
  'sin clave configurada no hay síntesis, y el motivo lo dice');

// ── El armado del documento ──
function armar(sintesis, conPuesto) {
  const cuerpo = new Body(false);
  gs.construirInforme2(cuerpo, {
    nombre: 'Ana Pérez',
    fecha: '12/08/2026',
    puesto: conPuesto ? 'Scrum Master' : '',
    gerencia: 'Tecnología',
    sector: 'Infraestructura',
    resultados: resultados,
    sintesis: sintesis,
    adecuacion: conPuesto ? adecuacion : null,
  });
  return normalizar(cuerpo.bloques);
}

/** Todo el texto del documento, párrafos y celdas, para buscar adentro. */
function aTexto(bloques) {
  return bloques.map((b) => {
    if (b.tipo === 'parrafo') return b.tramos.map((t) => t.texto).join('');
    if (b.tipo === 'tabla') return b.filas.map((f) => f.map((c) => c.texto).join(' ')).join(' ');
    return '';
  }).join('\n');
}

const documento = armar(valida, true);
const textoPlano = aTexto(documento);

['1. Resumen Ejecutivo y Diagnóstico Global',
  '2. Matriz de Coincidencia Estratégica y Análisis de Puesto',
  '3. Análisis Cualitativo Integrado e Inferencias del Perfil',
  '4. Plan Personalizado de Desarrollo y Acciones Concretas',
  '5. Anexo: Datos Cuantitativos y Resultados Psicométricos'].forEach((titulo) => {
  ok(textoPlano.indexOf(titulo) >= 0, `el informe tiene la sección "${titulo.slice(0, 20)}…"`);
});

// Los dos campos que este informe agrega: van en el encabezado, que es donde el
// modelo del PO los pone.
ok(textoPlano.indexOf('Gerencia: Tecnología') >= 0 && textoPlano.indexOf('Sector: Infraestructura') >= 0,
  'la gerencia y el sector salen impresos en el encabezado');
ok(textoPlano.indexOf('Puesto: Scrum Master') >= 0, 'y el puesto al lado, cuando se cargó el perfil');
ok(textoPlano.indexOf('Colaborador: Ana Pérez') >= 0, 'la portada nombra a la persona evaluada');

// Los números del informe los calcula el sistema, y el informe lo declara.
ok(textoPlano.indexOf('Índice de Adecuación al Puesto: ' + adecuacion.porcentaje + ' %') >= 0,
  'el índice de adecuación aparece en la portada', String(adecuacion.porcentaje));
ok(textoPlano.indexOf('lo calcula el sistema, no la IA') >= 0,
  'y dice que lo calcula el sistema, no el modelo');
ok(textoPlano.indexOf('Nivel de Riesgo Operativo: ' + adecuacion.riesgo) >= 0,
  'el nivel de riesgo también sale del cálculo, no del texto del modelo');

// Las secciones que vienen de la redacción.
ok(textoPlano.indexOf('(Triangulación NEO-FFI + CAMIN-A)') >= 0,
  'cada fortaleza dice de qué pruebas sale el cruce');
ok(textoPlano.indexOf('Eje 1: Claridad Operativa y Expectativas (Prioridad Alta)') >= 0,
  'los ejes del plan salen numerados y con su prioridad');
ok(textoPlano.indexOf('Plazo:') >= 0 && textoPlano.indexOf('Indicador de gestión:') >= 0,
  'con su plazo y su indicador de gestión');
ok(textoPlano.indexOf('Disparadores de riesgo operativo:') >= 0
  && textoPlano.indexOf('Frecuencia de seguimiento:') >= 0,
  'la información para la jefatura lleva la frecuencia y los disparadores');
ok(textoPlano.indexOf('Formato breve para el Líder Directivo') >= 0
  && textoPlano.indexOf('Formato breve para la persona evaluada (Ana Pérez)') >= 0,
  'los registros de RRHH salen en su tabla, con los dos destinatarios');

// El anexo: los mismos números que corrigió el motor.
ok(textoPlano.indexOf('PD=' + resultados.neo.raw.A + ' / T=' + resultados.neo.t.A) >= 0,
  'el anexo trae el puntaje directo y el T de cada rasgo');
ok(textoPlano.indexOf('LAISSEZ-FAIRE') >= 0,
  'y las cuatro tablas de los instrumentos');
const tablas = documento.filter((b) => b.tipo === 'tabla');
ok(tablas.length >= 8, 'el informe arma sus tablas', `armó ${tablas.length}`);

// La nota de autoría sale por los dos caminos, y dice cuál fue.
ok(textoPlano.indexOf('Informe generado con el texto determinista del sistema') >= 0
  || textoPlano.indexOf('Informe asistido por IA') >= 0,
  'el informe declara quién lo escribió');
const conModelo = copia(valida);
conModelo.modelo = 'nvidia/llama-3.3-nemotron-super-49b-v1.5';
const textoConModelo = aTexto(armar(conModelo, true));
ok(textoConModelo.indexOf('Informe asistido por IA llama-3.3-nemotron-super-49b-v1.5') >= 0,
  'con el nombre del modelo cuando lo escribió el modelo');
ok(textoPlano.indexOf('Informe generado con el texto determinista del sistema') >= 0,
  'y diciendo que fue el texto fijo cuando no hubo modelo');

// Sin perfil de puesto el informe sale igual, y declara lo que le falta en vez
// de imprimir un cero que se leería como "no sirve para el puesto".
const sinPuestoDoc = aTexto(armar(valida, false));
ok(sinPuestoDoc.indexOf('Índice de Adecuación al Puesto: no calculado') >= 0,
  'sin perfil de puesto, el índice se declara no calculado');
ok(sinPuestoDoc.indexOf('No se cargó un perfil de puesto') >= 0,
  'y la sección 2 dice por qué le falta la tabla de ajuste');
ok(sinPuestoDoc.indexOf('5. Anexo') >= 0 && sinPuestoDoc.indexOf('4. Plan Personalizado') >= 0,
  'el resto del informe sale completo igual');

// ───────────────────────────────────────────────────────────────────
fallos.forEach((f) => console.log(`  ✗ ${f}`));
console.log(fallos.length
  ? `\n${fallos.length} de ${pasaron + fallos.length} verificaciones fallaron`
  : `\nInforme 2 verificado (${pasaron} verificaciones)`);
process.exit(fallos.length ? 1 : 0);
