/**
 * Verificación del punto 6 — contraste con el Perfil de Puesto (Puesto.gs).
 *
 * Lo que se prueba acá es lo que sostiene que el índice de adecuación se pueda
 * defender delante de alguien: que una exigencia sin respaldo en el documento no
 * entre a la cuenta, que el porcentaje salga de los mismos cortes que el resto
 * del informe, y que cada alerta diga cuántos puntos porcentuales mueve.
 *
 * No llama a la API. Los valores esperados están ESCRITOS A MANO y calculados
 * aparte, como en verificar-perfil.js: si salieran de correr el código, un cambio
 * en la fórmula seguiría en verde.
 *
 * Uso:  node verificar-puesto.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');

let pasaron = 0;
const fallos = [];

function ok(condicion, nombre, detalle) {
  if (condicion) pasaron++;
  else fallos.push(detalle ? `${nombre} — ${detalle}` : nombre);
}

function cargarGs(propiedades) {
  const fuente = ['Correccion.gs', 'Textos.gs', 'Perfil.gs', 'Sintesis.gs', 'Puesto.gs']
    .map((a) => fs.readFileSync(path.join(RAIZ, a), 'utf8'))
    .join('\n');
  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (k) => (propiedades && propiedades[k]) || null,
      getProperties: () => propiedades || {},
    }),
  };
  return new Function(
    'PropertiesService', 'UrlFetchApp', 'DriveApp', 'DocumentApp', 'Drive', 'MimeType', 'console',
    `${fuente}\nreturn { catalogoDeExigibles, exigibleLlamado, textoComparable,
      verificarExigencias, indiceDeAdecuacion, nivelDeRiesgo, alertasDeAdecuacion,
      adecuacionAlPuesto, sanearLecturaDePuesto, planDeDesarrolloParaElPuesto,
      mensajesDeExtraccion, validarNarrativa, ponerNombreEnNarrativa, nivelNeoEnTresBandas,
      extensionDePerfil, perfilParaSintesis, clasificarPerfil, PUESTO_PUNTAJE,
      SINTESIS_MARCADOR_NOMBRE, MAX_PERFIL_BYTES };`
  )(PropertiesService, {}, {}, {}, {}, {}, { warn() {}, log() {} });
}

const gs = cargarGs({ NVIDIA_API_KEY: 'clave-de-prueba' });

// ═══════════════════════════════════════════════════════════════════
// Un perfil de persona escrito a mano
// ═══════════════════════════════════════════════════════════════════

/**
 * Los niveles que salen de estos percentiles, con `nivelPorPercentil` (>75 Alto,
 * >25 Medio, resto Bajo):
 *   Carisma 90 → Alto      Estimulación Intelectual 50 → Medio
 *   Laissez-Faire 80 → Alto   Liderazgo Directivo 20 → Bajo
 *   Conductas a la Tarea 50 → Medio   Inspiración 80 → Alto
 */
function resultadosDePrueba(cambios) {
  const base = {
    neo: {
      nivel: { N: 'Alto', E: 'Alto', O: 'Promedio', A: 'Muy Alto', C: 'Promedio' },
      t: { N: 60, E: 60, O: 50, A: 70, C: 50 },
      raw: { N: 30, E: 30, O: 25, A: 35, C: 25 },
    },
    celid: {
      percentil: {
        Carisma: 90, EstimInt: 50, Inspir: 80, ConsInd: 99, TransfTot: 85,
        RecCont: 40, DirExc: 30, TransTot: 35, Laissez: 80,
      },
      valor: {
        Carisma: 4, EstimInt: 3, Inspir: 4, ConsInd: 4.8, TransfTot: 4.2,
        RecCont: 3, DirExc: 2.5, TransTot: 3, Laissez: 2,
      },
    },
    potenlid: { percentil: { Intr: 80, Extr: 40, Soc: 60 }, valor: { Intr: 4, Extr: 3, Soc: 3.5 } },
    camin: { percentil: { Dir: 20, Cons: 90, Part: 85, Or: 60 }, valor: { Dir: 2, Cons: 4, Part: 4, Or: 3.5 } },
    conlid: { percentil: { Tar: 50, Rel: 90, Camb: 70 }, valor: { Tar: 3, Rel: 4, Camb: 3.5 } },
  };
  if (cambios && cambios.celidPercentil) {
    Object.assign(base.celid.percentil, cambios.celidPercentil);
  }
  return base;
}

const RESULTADOS = resultadosDePrueba();

function exigencia(dimension, nivelRequerido, critica) {
  const e = gs.exigibleLlamado(dimension);
  if (!e) throw new Error('dimensión inexistente en el test: ' + dimension);
  return {
    clave: e.clave, instrumento: e.instrumento, esNeo: e.esNeo, invertida: e.invertida,
    dimension: e.dimension, nivelRequerido, critica: !!critica, cita: 'cita',
  };
}

const CARISMA = 'Carisma / Influencia Idealizada';
const DIRECTIVO = 'Liderazgo Directivo';
const LAISSEZ = 'Laissez-Faire';
const ESTIMULACION = 'Estimulación Intelectual';
const TAREA = 'Conductas Orientadas a la Tarea';

// ═══════════════════════════════════════════════════════════════════
// El catálogo
// ═══════════════════════════════════════════════════════════════════

const catalogo = gs.catalogoDeExigibles();
ok(catalogo.length === 24, 'el catálogo tiene las 19 dimensiones de liderazgo y las 5 del NEO',
  `son ${catalogo.length}`);
ok(catalogo.some((d) => d.dimension === CARISMA && !d.invertida),
  'el Carisma es exigible y no está invertido');
ok(catalogo.some((d) => d.dimension === LAISSEZ && d.invertida),
  'el Laissez-Faire figura como invertido: pedirlo alto no es pedir algo bueno');
ok(catalogo.some((d) => d.dimension === 'Neuroticismo' && d.invertida && d.esNeo),
  'el Neuroticismo entra por el NEO y también invertido');
ok(gs.exigibleLlamado('carisma / influencia idealizada') !== null
  && gs.exigibleLlamado('CARISMA / INFLUENCIA IDEALIZADA') !== null,
  'la dimensión se reconoce sin importar mayúsculas ni tildes');
ok(gs.exigibleLlamado('Capacidad de Análisis') === null,
  'una competencia que la batería no mide no es exigible');

// ═══════════════════════════════════════════════════════════════════
// Comparación de textos
// ═══════════════════════════════════════════════════════════════════

ok(gs.textoComparable('Planiﬁcación') === gs.textoComparable('Planificacion'),
  'la ligadura ﬁ del PDF y las dos letras sueltas son la misma cita');
ok(gs.textoComparable('Eliminar   obstáculos\n e impedimentos')
  === 'eliminar obstaculos e impedimentos',
  'los saltos de línea y los espacios de más no rompen la comparación');
ok(gs.textoComparable('requeri-\nmientos') === 'requerimientos',
  'el guion de corte de renglón se une');

// ═══════════════════════════════════════════════════════════════════
// La verificación de las exigencias — el corazón del asunto
// ═══════════════════════════════════════════════════════════════════

const DOCUMENTO = [
  'Scrum Master. Liderar y facilitar el funcionamiento de un equipo ágil.',
  'Guiar y motivar al equipo para alcanzar los objetivos del proyecto.',
  'Eliminar obstáculos e impedimentos.',
  'Título universitario o terciario en Sistemas de Información.',
].join('\n');

const leido = gs.verificarExigencias({
  puesto: 'Scrum Master',
  exigencias: [
    { dimension: CARISMA, nivelRequerido: 'Alto', critica: true,
      cita: 'Guiar y motivar al equipo para alcanzar los objetivos del proyecto' },
    { dimension: DIRECTIVO, nivelRequerido: 'Alto', critica: true,
      cita: 'Eliminar obstáculos e impedimentos' },
    // Inventada: la frase no está en el documento.
    { dimension: ESTIMULACION, nivelRequerido: 'Alto', critica: false,
      cita: 'Fomentar el pensamiento crítico del equipo' },
    // Una competencia que la batería no mide.
    { dimension: 'Capacidad de Análisis', nivelRequerido: 'Alto', critica: true,
      cita: 'Liderar y facilitar el funcionamiento de un equipo ágil' },
    // Nivel que no existe.
    { dimension: LAISSEZ, nivelRequerido: 'Nulo', critica: false,
      cita: 'Eliminar obstáculos e impedimentos' },
  ],
  noMedidos: [
    { requisito: 'Título universitario', cita: 'Título universitario o terciario en Sistemas' },
    { requisito: 'Inglés avanzado', cita: 'Nivel de inglés avanzado excluyente' },
  ],
}, DOCUMENTO);

ok(leido.exigencias.length === 2,
  'sólo entran las exigencias que el documento sostiene',
  JSON.stringify(leido.exigencias.map((e) => e.dimension)));
ok(leido.puesto === 'Scrum Master', 'se conserva el nombre del puesto');
ok(leido.descartadas.length === 3, 'las otras tres quedan registradas, no se callan',
  JSON.stringify(leido.descartadas));
ok(leido.descartadas.some((d) => d.dimension === ESTIMULACION
  && /cita no está textualmente/.test(d.motivo)),
  'la cita inventada se descarta diciendo que no está en el documento');
ok(leido.descartadas.some((d) => d.dimension === 'Capacidad de Análisis'
  && /no es una dimensión que esta batería mida/.test(d.motivo)),
  'la competencia que la batería no mide se descarta diciendo por qué');
ok(leido.descartadas.some((d) => d.dimension === LAISSEZ && /Alto, Medio ni Bajo/.test(d.motivo)),
  'un nivel inventado descarta la exigencia');
ok(leido.noMedidos.length === 1 && leido.noMedidos[0].requisito === 'Título universitario',
  'los requisitos no medidos también se verifican contra el documento',
  JSON.stringify(leido.noMedidos));

// La misma dimensión dos veces.
const repetida = gs.verificarExigencias({
  exigencias: [
    { dimension: CARISMA, nivelRequerido: 'Alto', critica: true, cita: 'Guiar y motivar al equipo' },
    { dimension: CARISMA, nivelRequerido: 'Alto', critica: false, cita: 'Eliminar obstáculos' },
  ],
}, DOCUMENTO);
ok(repetida.exigencias.length === 1 && repetida.exigencias[0].critica === true,
  'la misma exigencia declarada dos veces igual cuenta una sola vez');

const contradictoria = gs.verificarExigencias({
  exigencias: [
    { dimension: CARISMA, nivelRequerido: 'Alto', critica: true, cita: 'Guiar y motivar al equipo' },
    { dimension: CARISMA, nivelRequerido: 'Bajo', critica: true, cita: 'Eliminar obstáculos' },
  ],
}, DOCUMENTO);
ok(contradictoria.exigencias.length === 0,
  'si el perfil la exige en dos niveles distintos, no se elige uno: se van las dos');
ok(contradictoria.descartadas.some((d) => /dos niveles distintos/.test(d.motivo)),
  'y queda dicho que el perfil de puesto se contradice');

// ═══════════════════════════════════════════════════════════════════
// El índice
// ═══════════════════════════════════════════════════════════════════

/**
 * Cuenta hecha a mano con la tabla de PUESTO_PUNTAJE:
 *   Carisma            requerido Alto  / real Alto  = 100 × peso 2 → 200 de 200
 *   Liderazgo Directivo requerido Alto / real Bajo  =  20 × peso 2 →  40 de 200
 *   Laissez-Faire      requerido Bajo  / real Alto  =  20 × peso 1 →  20 de 100
 *   Estimulación Int.  requerido Medio / real Medio = 100 × peso 1 → 100 de 100
 *   ──────────────────────────────────────────────────────────────────────────
 *   360 de 600 → 60 %
 */
const EXIGENCIAS_BASE = [
  exigencia(CARISMA, 'Alto', true),
  exigencia(DIRECTIVO, 'Alto', true),
  exigencia(LAISSEZ, 'Bajo', false),
  exigencia(ESTIMULACION, 'Medio', false),
];

/**
 * La tabla de puntajes, escrita a mano acá también. Es el corazón del número que
 * va a leer alguien que decide sobre una persona: si cambia, tiene que cambiar a
 * la vista y no de costado.
 *
 *              persona Alto  Medio  Bajo
 *   requerido Alto      100     60    20
 *   requerido Medio     100    100    50
 *   requerido Bajo       20     60   100
 */
const P = gs.PUESTO_PUNTAJE;
ok(P.Alto.Alto === 100 && P.Alto.Medio === 60 && P.Alto.Bajo === 20,
  'donde el puesto pide nivel alto: 100 / 60 / 20',
  JSON.stringify(P.Alto));
ok(P.Medio.Alto === 100 && P.Medio.Medio === 100 && P.Medio.Bajo === 50,
  'donde pide nivel medio, superarlo no penaliza: 100 / 100 / 50',
  JSON.stringify(P.Medio));
ok(P.Bajo.Alto === 20 && P.Bajo.Medio === 60 && P.Bajo.Bajo === 100,
  'donde pide nivel bajo, la tabla es el espejo de la primera: 20 / 60 / 100',
  JSON.stringify(P.Bajo));

const indice = gs.indiceDeAdecuacion(EXIGENCIAS_BASE, RESULTADOS);
ok(indice.porcentaje === 60, 'el índice da 60 %, la cuenta escrita a mano',
  `dio ${indice.porcentaje}`);
ok(indice.filas.length === 4, 'la tabla trae una fila por exigencia');
ok(indice.filas[0].real === 'Alto' && indice.filas[1].real === 'Bajo',
  'el nivel real sale de nivelPorPercentil, el mismo que rotula las tablas 1 a 4');
ok(indice.filas[1].puntaje === 20,
  'quedarse en nivel bajo donde el puesto pide alto aporta 20');
ok(indice.filas[2].puntaje === 20,
  'estar en nivel alto donde el puesto pide bajo aporta lo mismo: la tabla es simétrica');

// Una dimensión crítica pesa el doble. Sin peso, la misma cuenta da 60 % también,
// así que se prueba con un caso donde el peso sí mueve:
//   Carisma  Alto/Alto = 100 × 2 → 200 de 200
//   Directivo Alto/Bajo = 20 × 1 →  20 de 100
//   220 de 300 → 73,33 → 73 %
const conPeso = gs.indiceDeAdecuacion(
  [exigencia(CARISMA, 'Alto', true), exigencia(DIRECTIVO, 'Alto', false)], RESULTADOS);
ok(conPeso.porcentaje === 73, 'una exigencia crítica pesa el doble que una accesoria',
  `dio ${conPeso.porcentaje}`);

// El NEO se compara en las tres bandas del resto del informe.
ok(gs.nivelNeoEnTresBandas('Muy Alto') === 'Alto'
  && gs.nivelNeoEnTresBandas('Promedio') === 'Medio'
  && gs.nivelNeoEnTresBandas('Muy Bajo') === 'Bajo',
  'los cinco niveles del NEO se llevan a las tres bandas del puesto');
const conNeo = gs.indiceDeAdecuacion([exigencia('Amabilidad', 'Alto', false)], RESULTADOS);
ok(conNeo.porcentaje === 100,
  'una exigencia sobre un rasgo de personalidad se resuelve con el nivel del NEO');

ok(gs.indiceDeAdecuacion([], RESULTADOS).porcentaje === null,
  'sin exigencias calculables el índice es null, no 0 %: 0 % se leería como un veredicto');

// ═══════════════════════════════════════════════════════════════════
// Riesgo operativo
// ═══════════════════════════════════════════════════════════════════

const fila = (critica, puntaje) => ({ critica, puntaje });
ok(gs.nivelDeRiesgo([]) === null,
  'sin exigencias calculables el riesgo no se clasifica: "Bajo" se leería como un resultado');
ok(gs.nivelDeRiesgo([fila(true, 100), fila(false, 20)]) === 'Bajo',
  'sin críticas sin cubrir, el riesgo es bajo — una accesoria floja no lo mueve');
ok(gs.nivelDeRiesgo([fila(true, 60)]) === 'Medio', 'una crítica sin cubrir: riesgo medio');
ok(gs.nivelDeRiesgo([fila(true, 60), fila(true, 20)]) === 'Medio', 'dos críticas: sigue medio');
ok(gs.nivelDeRiesgo([fila(true, 60), fila(true, 20), fila(true, 20)]) === 'Alto',
  'tres críticas sin cubrir: riesgo alto');

// ═══════════════════════════════════════════════════════════════════
// Las alertas — cada una con su efecto en puntos porcentuales
// ═══════════════════════════════════════════════════════════════════

/**
 * Descartada: Inspiración (percentil 80 → Alto). Si entrara, como el supuesto más
 * exigente es "requerido Alto, no crítica", aporta 100 de 100:
 *   460 de 700 → 65,71 → 66 %, contra el 60 % real → sube 6 pp.
 */
const conDescartada = gs.alertasDeAdecuacion(
  { exigencias: EXIGENCIAS_BASE, descartadas: [
    { dimension: 'Inspiración / Motivación Inspiracional', motivo: 'la cita no está textualmente en el perfil de puesto' },
  ], noMedidos: [] },
  indice, RESULTADOS, gs.clasificarPerfil(RESULTADOS));
const alertaDescartada = conDescartada.find((a) => /quedaron fuera del cálculo/.test(a.alerta));
ok(!!alertaDescartada, 'lo descartado por falta de cita sale como alerta');
ok(alertaDescartada && alertaDescartada.direccion === 'sube' && alertaDescartada.puntos === 6,
  'y dice que el índice subiría 6 puntos porcentuales si se contara',
  alertaDescartada && `${alertaDescartada.direccion} ${alertaDescartada.puntos}`);

/**
 * Crítica indulgente: se agrega Conductas Orientadas a la Tarea (percentil 50 →
 * Medio) requerida en nivel medio y crítica. Aporta 100 × 2 = 200 de 200:
 *   560 de 800 → 70 %.
 * Si el rol la exigiera en nivel alto, aportaría 60 × 2 = 120 de 200:
 *   480 de 800 → 60 %.  → baja 10 pp.
 */
const conIndulgente = EXIGENCIAS_BASE.concat([exigencia(TAREA, 'Medio', true)]);
const indiceIndulgente = gs.indiceDeAdecuacion(conIndulgente, RESULTADOS);
ok(indiceIndulgente.porcentaje === 70, 'la cuenta con la crítica indulgente da 70 %',
  `dio ${indiceIndulgente.porcentaje}`);
const alertasIndulgente = gs.alertasDeAdecuacion(
  { exigencias: conIndulgente, descartadas: [], noMedidos: [] },
  indiceIndulgente, RESULTADOS, gs.clasificarPerfil(RESULTADOS));
const alertaIndulgente = alertasIndulgente.find((a) => /área de\s*\ndesarrollo|área de desarrollo/.test(a.alerta));
ok(!!alertaIndulgente,
  'una crítica que suma 100 estando en brecha se declara: si no, el punto 6 parece contradecir al punto 5');
ok(alertaIndulgente && alertaIndulgente.direccion === 'baja' && alertaIndulgente.puntos === 10,
  'y dice cuánto bajaría el índice si el rol la exigiera en nivel alto: 10 pp',
  alertaIndulgente && `${alertaIndulgente.direccion} ${alertaIndulgente.puntos}`);

// La invertida alta: penaliza en el índice y se declara para no contarla dos veces.
const alertaInvertida = conDescartada.find((a) => /el nivel alto es lo indeseable/.test(a.alerta));
ok(!!alertaInvertida && alertaInvertida.direccion === 'baja' && alertaInvertida.puntos === 0,
  'el Laissez-Faire alto sale como alerta, ya descontada del índice');

// Cobertura: no mueve el índice, le cambia el alcance.
const conCobertura = gs.alertasDeAdecuacion(
  { exigencias: EXIGENCIAS_BASE, descartadas: [], noMedidos: [
    { requisito: 'Título universitario', cita: '' },
    { requisito: 'Cuatro años de experiencia', cita: '' },
  ] },
  indice, RESULTADOS, gs.clasificarPerfil(RESULTADOS));
const alertaCobertura = conCobertura.find((a) => /El índice cubre/.test(a.alerta));
ok(!!alertaCobertura && /cubre 4 de 6 requisitos/.test(alertaCobertura.alerta),
  'la cobertura se declara con los números reales: 4 de 6',
  alertaCobertura && alertaCobertura.alerta);
ok(alertaCobertura && alertaCobertura.direccion === 'indefinida' && alertaCobertura.puntos === 0,
  'y no mueve el índice: le cambia el alcance, que es otra cosa');

/**
 * Sensibilidad al peso: con Carisma crítica (100×2) y Directivo accesoria (20×1)
 * el índice es 220/300 → 73 %. Contando las dos igual: 120/200 → 60 %. Baja 13 pp.
 */
const alertasPeso = gs.alertasDeAdecuacion(
  { exigencias: [exigencia(CARISMA, 'Alto', true), exigencia(DIRECTIVO, 'Alto', false)],
    descartadas: [], noMedidos: [] },
  conPeso, RESULTADOS, gs.clasificarPerfil(RESULTADOS));
const alertaPeso = alertasPeso.find((a) => /pesan el doble/.test(a.alerta));
ok(!!alertaPeso && alertaPeso.direccion === 'baja' && alertaPeso.puntos === 13,
  'la sensibilidad al peso de las críticas se declara con su efecto: 13 pp',
  alertaPeso && `${alertaPeso.direccion} ${alertaPeso.puntos}`);

// Cuando el peso no mueve nada, no se emite una alerta que no aporta.
ok(!conDescartada.some((a) => /pesan el doble/.test(a.alerta)),
  'si quitarle el peso a las críticas no mueve el índice, no se alerta');

// Perfil sin estilo predominante.
const mixtos = resultadosDePrueba({ celidPercentil: { TransfTot: 80, Laissez: 80 } });
const alertasMixto = gs.alertasDeAdecuacion(
  { exigencias: EXIGENCIAS_BASE, descartadas: [], noMedidos: [] },
  gs.indiceDeAdecuacion(EXIGENCIAS_BASE, mixtos), mixtos, gs.clasificarPerfil(mixtos));
ok(alertasMixto.some((a) => /no tiene un estilo de liderazgo predominante/.test(a.alerta)),
  'un perfil empatado arriba se declara: la lectura situacional se apoya en una inferencia');

ok(gs.alertasDeAdecuacion({ exigencias: [], descartadas: [], noMedidos: [] },
  gs.indiceDeAdecuacion([], RESULTADOS), RESULTADOS, gs.clasificarPerfil(RESULTADOS)).length === 0,
  'sin índice no hay alertas sobre el índice');

// ═══════════════════════════════════════════════════════════════════
// El punto 6 armado
// ═══════════════════════════════════════════════════════════════════

const adecuacion = gs.adecuacionAlPuesto({
  puesto: 'Scrum Master',
  exigencias: EXIGENCIAS_BASE,
  descartadas: [],
  noMedidos: [{ requisito: 'Título universitario', cita: '' }],
  modelo: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
}, RESULTADOS);

ok(adecuacion.porcentaje === 60, 'el punto 6 arma el índice con la misma cuenta');
ok(adecuacion.riesgo === 'Medio',
  'con el Liderazgo Directivo crítico sin cubrir, el riesgo operativo es medio');
ok(adecuacion.cobertura.medidos === 4 && adecuacion.cobertura.total === 5,
  'la cobertura declara 4 de 5');
ok(adecuacion.fortalezas.length === 1 && adecuacion.fortalezas[0].dimension === CARISMA,
  'sólo el Carisma es fortaleza apalancable: la Estimulación cubre lo pedido pero no está consolidada',
  JSON.stringify(adecuacion.fortalezas.map((f) => f.dimension)));
ok(adecuacion.brechas.length === 2 && adecuacion.brechas[0].dimension === DIRECTIVO,
  'las brechas van con las críticas primero',
  JSON.stringify(adecuacion.brechas.map((b) => b.dimension)));

const plan = gs.planDeDesarrolloParaElPuesto(RESULTADOS, adecuacion);
ok(plan.prioritarias.length === 3,
  'el plan prioriza las competencias de la sección 3 que este puesto exige',
  JSON.stringify(plan.prioritarias.map((f) => f[0])));
ok(plan.prioritarias[0][0] === 'Fortalecer el Liderazgo Directivo',
  'y arriba va la que corresponde a una exigencia crítica',
  plan.prioritarias[0] && plan.prioritarias[0][0]);
ok(plan.otras.length === 3,
  'las demás competencias no desaparecen: quedan aparte',
  JSON.stringify(plan.otras.map((f) => f[0])));

// ═══════════════════════════════════════════════════════════════════
// Lo que vuelve del navegador
// ═══════════════════════════════════════════════════════════════════

const saneada = gs.sanearLecturaDePuesto({
  id: 'archivo-id', nombre: 'perfil.pdf', puesto: 'Scrum Master',
  exigencias: [
    { dimension: CARISMA, nivelRequerido: 'Alto', critica: true, cita: 'x' },
    { dimension: 'Dimensión Inventada', nivelRequerido: 'Alto', critica: true, cita: 'x' },
    { dimension: DIRECTIVO, nivelRequerido: 'Altísimo', critica: true, cita: 'x' },
    { dimension: CARISMA, nivelRequerido: 'Bajo', critica: false, cita: 'x' },
  ],
  noMedidos: [], descartadas: [],
});
ok(saneada.exigencias.length === 1 && saneada.exigencias[0].dimension === CARISMA,
  'del navegador sólo se aceptan dimensiones del catálogo, niveles válidos y una vez cada una',
  JSON.stringify(saneada.exigencias.map((e) => e.dimension + '/' + e.nivelRequerido)));
ok(saneada.exigencias[0].clave === 'Carisma' && saneada.exigencias[0].instrumento === 'celid',
  'y la clave y el instrumento se vuelven a resolver acá, no se copian de lo que llegó');
ok(gs.sanearLecturaDePuesto(null) === null
  && gs.sanearLecturaDePuesto({ exigencias: [] }) === null
  && gs.sanearLecturaDePuesto({ exigencias: [{ dimension: 'Nada' }] }) === null,
  'sin nada utilizable devuelve null y el informe sale sin punto 6');

// ═══════════════════════════════════════════════════════════════════
// El pedido al modelo y la revisión de su prosa
// ═══════════════════════════════════════════════════════════════════

const mensajes = gs.mensajesDeExtraccion('texto del puesto', 'nvidia/llama-3.3-nemotron-super-49b-v1.5');
const pedido = mensajes[1].content;
ok(mensajes.length === 2 && mensajes[0].role === 'system',
  'el pedido de extracción lleva el interruptor del razonamiento en el mensaje de sistema');
ok(pedido.indexOf(CARISMA) > 0 && pedido.indexOf('Neuroticismo') > 0,
  'se le pasa el catálogo de dimensiones exigibles con el nombre exacto');
ok(/CITA LITERAL/.test(pedido), 'y se le exige la cita literal, que es lo que después se verifica');
ok(!/persona evaluada/i.test(pedido) || /NO conocés a ninguna persona evaluada/.test(pedido),
  'al leer el puesto no se le manda ningún dato de la persona evaluada');

const perfilSintesis = gs.perfilParaSintesis(RESULTADOS);
const narrativaBuena = {
  lecturaGeneral: 'El perfil llega al puesto con una capacidad de influencia sólida y una '
    + 'orientación clara al vínculo con el equipo, y con menos recorrido en la conducción directiva.',
  fortalezasApalancables: [{ titulo: 'Influencia', texto: 'Sostiene la conducción de un equipo ágil.' }],
  riesgos: [{ titulo: 'Conducción directiva', texto: 'En contextos de urgencia puede demorar la bajada de línea.' }],
};
ok(gs.validarNarrativa(narrativaBuena, perfilSintesis).ok, 'una narrativa correcta pasa');

const conNumero = JSON.parse(JSON.stringify(narrativaBuena));
conNumero.riesgos[0].texto = 'Su conducción directiva está en P20.';
ok(!gs.validarNarrativa(conNumero, perfilSintesis).ok,
  'el punto 6 tampoco puede citar puntajes: la misma regla que el punto 5');

const conJerga = JSON.parse(JSON.stringify(narrativaBuena));
conJerga.lecturaGeneral = 'El CELID muestra una escala invertida en el perfil.';
ok(!gs.validarNarrativa(conJerga, perfilSintesis).ok,
  'ni jerga interna ni el nombre de los instrumentos');

const conNivelMal = JSON.parse(JSON.stringify(narrativaBuena));
conNivelMal.lecturaGeneral = 'Se observa un nivel bajo en Carisma / Influencia Idealizada.';
ok(!gs.validarNarrativa(conNivelMal, perfilSintesis).ok,
  'ni atribuirle a una dimensión un nivel que no tiene');

const sinLista = JSON.parse(JSON.stringify(narrativaBuena));
sinLista.riesgos = [];
ok(!gs.validarNarrativa(sinLista, perfilSintesis).ok, 'ni venir a medias');

const conMarcador = gs.ponerNombreEnNarrativa({
  lecturaGeneral: gs.SINTESIS_MARCADOR_NOMBRE + ' llega bien parada al puesto.',
  fortalezasApalancables: [{ titulo: 'x', texto: gs.SINTESIS_MARCADOR_NOMBRE + ' escucha.' }],
  riesgos: [{ titulo: 'y', texto: 'sin marcador' }],
}, 'Ana Pérez');
ok(conMarcador.lecturaGeneral.indexOf('Ana Pérez') === 0
  && conMarcador.fortalezasApalancables[0].texto.indexOf('Ana Pérez') === 0,
  'el nombre se pone al volver, no viaja en el pedido al modelo');

// ═══════════════════════════════════════════════════════════════════
// La subida
// ═══════════════════════════════════════════════════════════════════

ok(gs.extensionDePerfil('Perfil de Puesto.pdf') && gs.extensionDePerfil('perfil.DOCX')
  && !gs.extensionDePerfil('planilla.xlsx'),
  'el perfil de puesto acepta .pdf y .docx, y no una planilla');
ok(gs.MAX_PERFIL_BYTES === 10 * 1024 * 1024, 'el tope de tamaño es de 10 MB');

// ═══════════════════════════════════════════════════════════════════

if (fallos.length) {
  console.error(`\n${fallos.length} de ${pasaron + fallos.length} verificaciones fallaron`);
  fallos.forEach((f) => console.error('  ✗ ' + f));
  process.exit(1);
}
console.log(`\n${pasaron}/${pasaron} verificaciones del punto 6 en verde`);
