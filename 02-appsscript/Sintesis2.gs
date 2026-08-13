/**
 * La redacción del Informe 2, separada de la del Informe 1.
 *
 * POR QUÉ ES UN MÓDULO APARTE Y NO UNA VARIANTE DEL PUNTO 5
 *
 * Los dos informes le hablan al mismo endpoint con las mismas herramientas
 * —`respuestaDelModelo`, la lista de modelos, el plazo, el interruptor del
 * razonamiento, todo eso vive en Sintesis.gs y se reusa— pero le piden cosas
 * opuestas:
 *
 *   - El punto 5 del Informe 1 es la DEVOLUCIÓN que lee la persona evaluada.
 *     Tiene PROHIBIDO escribir números y nombrar los cuestionarios: habla de
 *     niveles y de conductas. Ver SINTESIS_JERGA_PROHIBIDA.
 *   - El Informe 2 es un informe TÉCNICO para RRHH y para la jefatura. Su valor
 *     está justamente en la triangulación explícita —"Amabilidad T=62 con
 *     Liderazgo Considerado P90"—, así que los valores y las siglas no sólo se
 *     permiten: se piden.
 *
 * Meter las dos cosas en el mismo prompt con un interruptor terminaría en un
 * prompt que se contradice, y en validaciones que hay que acordarse de apagar.
 * Separados, cada informe se puede tocar sin mover al otro, y la interfaz elige
 * cuál generar.
 *
 * LO QUE NO CAMBIA
 *
 *   1. Los números los calcula el código. Al modelo se le pasan ya calculados
 *      —percentiles, puntajes T, el índice de adecuación, el aporte de cada
 *      dimensión— y no se le pide que los recalcule ni que los estime.
 *   2. `validarCitasPsicometricas` rechaza la respuesta si cita un percentil o
 *      un puntaje T que no está en el perfil. Es la contracara de permitir
 *      números: si se pueden escribir, hay que verificarlos uno por uno.
 *   3. El nombre de la persona no viaja al modelo. Va el marcador de siempre
 *      (`SINTESIS_MARCADOR_NOMBRE`) y el nombre se pone acá, del lado del
 *      servidor. La gerencia y el sector SÍ viajan: son unidades de la
 *      organización, no datos de la persona, y sin ellas las recomendaciones y
 *      las pautas para la jefatura no se pueden aterrizar.
 *   4. Si el modelo falla, el informe se genera igual con
 *      `sintesis2Determinista`, que devuelve EXACTAMENTE la misma forma. El
 *      documento tiene un solo camino de armado; lo único que cambia es quién
 *      escribió el texto, y eso lo dice la nota al pie.
 *
 * CUATRO BLOQUES
 *
 * Misma razón que en el punto 5: `UrlFetchApp` corta a los 60 segundos. El
 * Informe 2 pide bastante más texto que el punto 5, así que se parte en cuatro
 * pedidos de ~650 tokens cada uno en vez de dos de ~600:
 *
 *   1. ejecutivo — veredicto, resumen general y fortalezas.
 *   2. brechas   — áreas de desarrollo y matriz de fortalezas y riesgos.
 *   3. analítico — coherencias, inferencias y pedidos de clarificación.
 *   4. plan      — ejes de desarrollo, pautas para el líder y registros de RRHH.
 *
 * Si un bloque no valida después de sus intentos, se descarta la síntesis
 * entera y se prueba el modelo siguiente. Mezclar prosa de dos modelos —o del
 * modelo con la fija— deja dos voces en el mismo informe.
 */

// Techo por bloque. Los bloques del Informe 2 devuelven ~650 tokens y alguno
// —el del plan, que lleva tres ejes con siete campos cada uno— puede pasar de
// 900. El doble del techo del punto 5 evita que se corte a la mitad, que es la
// forma más cara de fallar: gasta la llamada entera y no devuelve nada usable.
var SINTESIS2_MAX_TOKENS = 1600;

var SINTESIS2_INTENTOS = 2;

/** Campos obligatorios de cada lista. Vacío o faltante invalida el bloque. */
var SINTESIS2_CAMPOS = {
  // `fuentes` es de qué pruebas sale el cruce ("NEO-FFI + CAMIN-A"). Se imprime:
  // es lo que convierte una afirmación en una triangulación verificable.
  fortalezas: ['titulo', 'fuentes', 'texto'],
  // `dimension` NO se imprime: es la declaración de en qué dato se apoya la
  // brecha, y es lo que permite verificarla contra el perfil. Misma defensa que
  // en el punto 5 — ver validarBrechasDeclaradas en Sintesis.gs.
  areasDesarrollo: ['dimension', 'titulo', 'fuentes', 'texto'],
  matrizOperativa: ['categoria', 'hallazgo', 'impacto'],
  coherencias: ['tipo', 'titulo', 'texto'],
  inferencias: ['titulo', 'fuentes', 'texto'],
  ejes: ['titulo', 'prioridad', 'fundamento', 'contexto', 'accion', 'plazo', 'indicador'],
  clarificaciones: ['titulo', 'pregunta']
};

/**
 * Valores cerrados. Un valor libre en estas columnas rompe la tabla: la
 * categoría pinta la fila y la prioridad ordena el plan, así que "Riesgo alto"
 * y "Riesgo Operativo Crítico" no pueden ser dos formas de lo mismo.
 */
var SINTESIS2_CATEGORIAS = ['Fortaleza Operativa', 'Riesgo Operativo Crítico',
  'Riesgo Operativo Moderado'];
var SINTESIS2_TIPOS_COHERENCIA = ['Coherencia', 'Incoherencia'];
var SINTESIS2_PRIORIDADES = ['Alta', 'Media', 'Baja'];

/** Campos de los dos objetos sueltos, que no son listas. */
var SINTESIS2_INFO_LIDER = ['pautas', 'frecuencia', 'kpis', 'disparadores'];
var SINTESIS2_REGISTROS = ['lider', 'evaluado'];

/**
 * Jerga que no puede aparecer en el Informe 2.
 *
 * Es MUCHO más corta que la del punto 5, y a propósito: acá las siglas de los
 * cuestionarios y la palabra "percentil" son parte de lo que se pide. Lo que
 * sigue prohibido es el vocabulario interno del código —el que sólo tiene
 * sentido leyendo este archivo— y los nombres de los campos del JSON, que el
 * modelo a veces copia adentro del texto.
 */
var SINTESIS2_JERGA_PROHIBIDA = [
  'escala invertida',
  'referencia orientativa',
  'areasDesarrollo',
  'matrizOperativa',
  'informacionLider',
  'resumenGeneral'
];

/** Los cuatro bloques, en orden. */
var SINTESIS2_BLOQUE_EJECUTIVO = {
  clave: 'ejecutivo',
  textos: ['veredicto', 'resumenGeneral'],
  listas: ['fortalezas'],
  objetos: []
};

var SINTESIS2_BLOQUE_BRECHAS = {
  clave: 'brechas',
  textos: [],
  listas: ['areasDesarrollo', 'matrizOperativa'],
  objetos: []
};

var SINTESIS2_BLOQUE_ANALITICO = {
  clave: 'analítico',
  textos: [],
  listas: ['coherencias', 'inferencias', 'clarificaciones'],
  objetos: []
};

var SINTESIS2_BLOQUE_PLAN = {
  clave: 'plan',
  textos: [],
  listas: ['ejes'],
  objetos: ['informacionLider', 'registros']
};

var SINTESIS2_BLOQUES = [
  SINTESIS2_BLOQUE_EJECUTIVO,
  SINTESIS2_BLOQUE_BRECHAS,
  SINTESIS2_BLOQUE_ANALITICO,
  SINTESIS2_BLOQUE_PLAN
];

// ═══════════════════════════════════════════════════════════════════
// El perfil, con los valores adentro
// ═══════════════════════════════════════════════════════════════════

/**
 * El perfil del punto 5 más los valores que el Informe 2 sí puede citar.
 *
 * Se construye SOBRE `perfilParaSintesis` (Sintesis.gs) en vez de al lado: los
 * nombres de las dimensiones y sus niveles tienen que ser los mismos en los dos
 * informes. Si cada uno armara su lista, un mismo perfil podría llamarse
 * "Estimulación Intelectual" en uno y "Estímulo Intelectual" en el otro, y las
 * validaciones de niveles —que comparan por nombre— dejarían de ver nada.
 *
 * @param {Object} resultados salida de corregir()
 * @return {Object} el perfil, más {tes, percentiles, valores}
 */
function perfilParaSintesis2(resultados) {
  var perfil = perfilParaSintesis(resultados);

  // Los puntajes T y los percentiles que existen de verdad. Es contra estas dos
  // listas que se verifica cada número que el modelo escriba.
  var tes = [];
  NEO_DIMENSIONES.forEach(function (d) {
    tes.push(resultados.neo.t[d]);
  });
  var percentiles = perfil.dimensiones.map(function (d) { return d.percentil; });

  // El NEO se recorre por NOMBRE y no por posición: `perfilParaSintesis` arma su
  // lista con NEO_NOMBRES, y atarse al orden haría que agregar una dimensión allá
  // le pegara acá el puntaje T de otra sin que nada avise.
  var claveDeNombre = {};
  NEO_DIMENSIONES.forEach(function (clave) {
    claveDeNombre[NEO_NOMBRES[clave]] = clave;
  });
  perfil.neo.forEach(function (d) {
    var clave = claveDeNombre[d.dimension];
    if (!clave) return;
    d.clave = clave;
    d.t = resultados.neo.t[clave];
    d.pd = resultados.neo.raw[clave];
  });

  perfil.tes = tes;
  perfil.percentiles = percentiles;
  return perfil;
}

/**
 * El contraste con el puesto, en las palabras con las que se le habla al modelo.
 *
 * Todo lo numérico —el índice, el aporte de cada dimensión, la brecha en
 * puntos— ya está calculado por `adecuacionAlPuesto` (Puesto.gs). Acá sólo se
 * transcribe: si el modelo tuviera que deducir la brecha restando niveles,
 * inventaría el número, que es exactamente lo que este sistema no hace.
 *
 * @param {Object|null} adecuacion salida de adecuacionAlPuesto(), o null
 * @return {string} el bloque de texto, o el aviso de que no hubo perfil
 */
function contrasteParaElModelo(adecuacion) {
  if (!adecuacion) {
    return [
      'CONTRASTE CON EL PERFIL DE PUESTO: no se cargó el perfil de puesto, así',
      'que no hay índice de adecuación ni niveles requeridos. NO inventes',
      'requerimientos del puesto ni hables de brechas contra un perfil objetivo:',
      'escribí el análisis sobre el perfil psicométrico y sobre lo que el rol de',
      'conducción exige en general.'
    ].join('\n');
  }

  var lineas = adecuacion.filas.map(function (f) {
    return '- ' + f.dimension + (f.critica ? ' (crítica para el puesto)' : '')
      + ': el puesto la pide en nivel ' + f.requerido.toLowerCase()
      + ', la persona está en nivel ' + f.real.toLowerCase()
      + ' — aporte ' + f.puntaje + ' de 100'
      + (f.puntaje === 100 ? ' (alineación completa)'
        : ' (brecha de ' + (100 - f.puntaje) + ' puntos)');
  });

  return [
    'CONTRASTE CON EL PERFIL DE PUESTO (todo esto lo calculó el sistema; citalo,',
    'no lo recalcules):',
    '- Índice de adecuación al puesto: ' + (adecuacion.porcentaje === null
      ? 'no calculable' : adecuacion.porcentaje + ' %'),
    '- Calculado sobre ' + adecuacion.cobertura.medidos + ' de los '
      + adecuacion.cobertura.total + ' requisitos del perfil de puesto; '
      + (adecuacion.cobertura.noMedidos === 1
        ? 'el otro es un requisito de formación, experiencia o conocimientos técnicos'
        : 'los otros ' + adecuacion.cobertura.noMedidos + ' son requisitos de formación, '
          + 'experiencia o conocimientos técnicos')
      + ', que esta batería no mide.',
    '- Nivel de riesgo operativo: ' + (adecuacion.riesgo || 'no clasificable')
      + ' — sale de cuántas exigencias críticas quedan sin cubrir.',
    '',
    'DIMENSIÓN POR DIMENSIÓN:',
    lineas.length ? lineas.join('\n') : '  (ninguna exigencia del puesto es medible con esta batería)'
  ].join('\n');
}

/**
 * Los datos del perfil, tal como los ve el modelo.
 *
 * Al revés que en el punto 5, acá van los valores: es un informe técnico y la
 * triangulación con el número al lado es lo que se le pide. Van con la etiqueta
 * de su instrumento porque el informe cita "CELID-A P50" y sin saber de qué
 * prueba sale cada dimensión el modelo se las atribuye a la que le queda cerca.
 */
function datosDelPerfil2(perfil, adecuacion, contexto) {
  var porInstrumento = {};
  perfil.dimensiones.forEach(function (d) {
    if (!porInstrumento[d.instrumento]) porInstrumento[d.instrumento] = [];
    porInstrumento[d.instrumento].push(
      '- ' + d.dimension + ': ' + pct(d.percentil) + ', nivel ' + d.nivel
      + (d.invertida
        ? ' — OJO, acá el valor alto es lo indeseable: cuanto más alto, mayor'
          + ' tendencia a la no-intervención'
        : '')
    );
  });

  var lineasLiderazgo = [];
  for (var instrumento in porInstrumento) {
    if (!Object.prototype.hasOwnProperty.call(porInstrumento, instrumento)) continue;
    lineasLiderazgo.push(instrumento + ':');
    lineasLiderazgo.push(porInstrumento[instrumento].join('\n'));
  }

  var lineasNeo = perfil.neo.map(function (d) {
    return '- ' + d.dimension + ': PD=' + d.pd + ', T=' + d.t + ', nivel ' + d.nivel
      + '. ' + d.descripcion;
  });

  return [
    'PERSONA EVALUADA: no se informa su nombre. Cada vez que necesites nombrarla,',
    'escribí exactamente ' + SINTESIS_MARCADOR_NOMBRE + ', con los corchetes. No',
    'inventes un nombre ni uses uno de ejemplo.',
    '',
    'CONTEXTO ORGANIZACIONAL:',
    '- Puesto: ' + (contexto.puesto || 'no informado'),
    '- Gerencia: ' + (contexto.gerencia || 'no informada'),
    '- Sector: ' + (contexto.sector || 'no informado'),
    '',
    'NEO-FFI (personalidad; niveles Muy Alto, Alto, Promedio, Bajo o Muy Bajo):',
    lineasNeo.join('\n'),
    '',
    'PRUEBAS DE LIDERAZGO (niveles Alto, Medio o Bajo):',
    lineasLiderazgo.join('\n'),
    '',
    // La misma información agrupada por nivel. Redundante a propósito: es la
    // defensa que en el punto 5 resolvió que el modelo confundiera "Liderazgo
    // Orientado a Metas" con "Conductas Orientadas a la Tarea". Ver
    // agrupadoPorNivel en Sintesis.gs.
    'EL MISMO PERFIL AGRUPADO POR NIVEL. Antes de decir que algo es alto, medio o',
    'bajo, verificá acá. Hay dimensiones con nombres parecidos que están en',
    'niveles distintos: no las mezcles.',
    agrupadoPorNivel(perfil),
    '',
    contrasteParaElModelo(adecuacion)
  ].join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// Los prompts
// ═══════════════════════════════════════════════════════════════════

/**
 * Reglas que valen para los cuatro bloques. Se escriben una sola vez para que no
 * se desincronicen: si un bloque olvidara una, el modelo la incumpliría sólo ahí.
 */
function reglasComunes2() {
  return [
    'Sos psicólogo/a laboral especializado/a en evaluación de liderazgo y desarrollo',
    'organizacional. Estás redactando un informe técnico de integración psicométrica',
    'que leen el área de Recursos Humanos y la jefatura directa, y que se archiva en',
    'el legajo. No es la devolución a la persona evaluada.',
    '',
    'REGLAS QUE NO SE NEGOCIAN:',
    '1. LOS VALORES SE CITAN, NO SE INVENTAN. Este informe se apoya en la',
    '   triangulación explícita entre pruebas, así que escribí los percentiles y los',
    '   puntajes T tal cual figuran abajo: "Amabilidad (NEO-FFI T=62)", "Liderazgo',
    '   Participativo (CAMIN-A P99+)". Está PROHIBIDO escribir un percentil o un',
    '   puntaje T que no esté en los datos de abajo, aunque sea para redondear o',
    '   para dar un ejemplo.',
    '2. LOS NIVELES REQUERIDOS POR EL PUESTO VAN EN PALABRAS. El perfil de puesto',
    '   los declara como alto, medio o bajo: no los traduzcas a percentiles ni',
    '   escribas "Alto (P90)". Ese número no existe en ningún lado.',
    '3. Triangulá siempre que puedas: una afirmación vale cuando la sostienen dos o',
    '   más fuentes que apuntan a lo mismo, o cuando dos fuentes se contradicen y esa',
    '   contradicción es el hallazgo. Nombrá las pruebas de las que sale cada cruce.',
    '4. No supongas nada que los instrumentos no midieron: ni la madurez del equipo,',
    '   ni el tamaño del área, ni las herramientas de la empresa, ni resultados de',
    '   negocio. Todo eso va, como pregunta, en los pedidos de clarificación.',
    '5. Si una afirmación no se apoya en un dato, no la escribas.',
    '6. Escribí en español rioplatense profesional, en tercera persona, sin tutear a',
    '   la persona evaluada y sin suponer su género: usá el marcador del nombre o',
    '   construcciones neutras. Todo en castellano: ni una palabra en inglés.',
    '   Revisá la concordancia de los verbos antes de cerrar cada oración.',
    '7. Tono técnico y descriptivo, nunca lapidario. Una brecha se describe por lo',
    '   que la persona no hace todavía, no por lo que le falta como persona.',
    '',
    'CÓMO LEER LA MOTIVACIÓN PARA LIDERAR: las tres motivaciones (intrínseca,',
    'extrínseca, social-normativa) son un perfil, no un ranking. Un valor bajo en',
    'extrínseca o social-normativa NO es un déficit: indica que el interés por el rol',
    'no pasa por la recompensa externa ni por el deber, lo cual suele ser deseable.',
    'PROHIBIDO presentarlas como un problema o como algo a desarrollar.',
    '',
    'CÓMO SE ESCRIBE: el valor es el fundamento, no el contenido. Citá el dato y',
    'después decí QUÉ HACE la persona en el trabajo, en conducta observable.',
    '  MAL:  "Presenta un nivel alto en Consideración Individualizada, lo que indica',
    '        una fuerte capacidad de atención a las necesidades individuales."',
    '  BIEN: "El nivel alto en Consideración Individualizada (CELID-A P90) converge',
    '        con la Amabilidad en T=62 (NEO-FFI): escucha a cada colaborador, entiende',
    '        sus necesidades y las contempla al repartir el trabajo."',
    '',
    'Devolvé EXCLUSIVAMENTE un objeto JSON válido, sin texto alrededor y sin bloques',
    'de código markdown.'
  ];
}

/** Bloque 1 — veredicto, resumen general y fortalezas. */
function mensajesBloqueEjecutivo(perfil, adecuacion, contexto, modelo) {
  var instrucciones = reglasComunes2().concat([
    '',
    'Ésta es la PRIMERA de cuatro partes: el diagnóstico global. No escribas todavía',
    'áreas de desarrollo, inferencias ni recomendaciones: cada cosa se pide aparte.',
    '',
    'Forma exacta de la respuesta:',
    '{',
    '  "veredicto":      "...",',
    '  "resumenGeneral": "...",',
    '  "fortalezas":     [{"titulo": "...", "fuentes": "...", "texto": "..."}]',
    '}',
    '',
    'EL "veredicto" es el encuadre metodológico y el diagnóstico de adecuación, en',
    '3 o 4 oraciones. Dice de qué se trata esta evaluación —una integración de cinco',
    'instrumentos estandarizados leída contra lo que el rol exige—, si el perfil es',
    'compatible con el puesto y dónde se concentran las fortalezas y las brechas.',
    'Si hay índice de adecuación, nombralo con su valor. NO repitas el nivel de',
    'riesgo operativo: lo imprime el sistema en la misma tabla, arriba de este texto.',
    '',
    'EL "resumenGeneral" retrata a la persona en 4 o 5 oraciones, triangulando. Tiene',
    'que poder leerse como la descripción de alguien: cómo conduce, en qué se apoya y',
    'dónde se le nota la falta, con los valores que lo sostienen entre paréntesis.',
    '',
    'EN "fortalezas" van 3 elementos:',
    '- "titulo": el concepto, de 3 a 8 palabras, sin números adentro.',
    '  Así: "Acompañamiento, Inclusión y Construcción de Clima".',
    '- "fuentes": las pruebas que sostienen el cruce, y nada más. Así:',
    '  "NEO-FFI + CAMIN-A". Sin valores adentro.',
    '- "texto": 2 o 3 oraciones. Primero el cruce con los valores citados, después',
    '  qué se ve de eso en el ejercicio del rol.',
    'Elegí fortalezas que estén en la parte alta del perfil y que le sirvan a este',
    'puesto. Si el nivel bajo de una dimensión es lo deseable —la no-intervención lo',
    'es—, eso también es una fortaleza y conviene decirlo.'
  ]).join('\n');

  return [
    { role: 'system', content: apagarRazonamiento(modelo) + '\n\n' + instrucciones },
    { role: 'user', content: datosDelPerfil2(perfil, adecuacion, contexto) }
  ];
}

/** Bloque 2 — áreas de desarrollo y matriz de fortalezas y riesgos operativos. */
function mensajesBloqueBrechas(perfil, adecuacion, contexto, previo, modelo) {
  var instrucciones = reglasComunes2().concat([
    '',
    'Ésta es la SEGUNDA de cuatro partes: las brechas y su impacto operativo.',
    '',
    'Forma exacta de la respuesta:',
    '{',
    '  "areasDesarrollo": [{"dimension": "...", "titulo": "...", "fuentes": "...", "texto": "..."}],',
    '  "matrizOperativa": [{"categoria": "...", "hallazgo": "...", "impacto": "..."}]',
    '}',
    '',
    'EN "areasDesarrollo" van 3 elementos. Cada uno es una brecha MEDIBLE contra lo',
    'que el rol pide, no una impresión:',
    '- "dimension": el nombre EXACTO, copiado tal cual, de la dimensión de la lista',
    '  de abajo en la que se apoya la brecha. No se imprime en el informe: sirve para',
    '  verificar que la brecha exista en el dato. Si no podés copiar un nombre de esa',
    '  lista, entonces esa brecha no existe.',
    '- "titulo": el concepto, de 3 a 8 palabras, sin números.',
    '- "fuentes": las pruebas del cruce. Así: "CELID-A + NEO-FFI".',
    '- "texto": 2 o 3 oraciones. Citá los valores, decí contra qué nivel requerido',
    '  queda corto —usá el aporte sobre 100 y la brecha en puntos que te damos, si',
    '  hay perfil de puesto— y qué deja de pasar en el trabajo por eso.',
    '',
    'LAS ÚNICAS BRECHAS QUE PODÉS USAR son éstas. No hay otras: todo lo que no',
    'figure en esta lista está en la parte alta del perfil y es una fortaleza.',
    brechasDisponibles(perfil),
    'Elegí tres de ahí. Está prohibido presentar como carencia algo que no esté en',
    'esa lista, ni directamente, ni con otras palabras, ni cambiándole el nombre.',
    'Y está prohibido poner ahí la motivación extrínseca o la social-normativa.',
    '',
    'EN "matrizOperativa" van 5 elementos: 2 fortalezas y 3 riesgos, o la mezcla que',
    'el dato sostenga. Es la tabla que lee la jefatura, así que cada fila es corta:',
    '- "categoria": exactamente una de estas tres, copiada tal cual:',
    '  "Fortaleza Operativa", "Riesgo Operativo Crítico", "Riesgo Operativo Moderado".',
    '  Crítico es el riesgo que toca una exigencia que el puesto presenta como',
    '  central del rol; moderado, el resto.',
    '- "hallazgo": el cruce con sus valores, en una línea y sin verbo. Así:',
    '  "Liderazgo Participativo P99+ (CAMIN-A) + Amabilidad T=62 (NEO-FFI)".',
    '- "impacto": una oración sobre qué provoca eso en el día a día del rol.'
  ]).join('\n');

  return [
    { role: 'system', content: apagarRazonamiento(modelo) + '\n\n' + instrucciones },
    { role: 'user', content: conLoYaEscrito(datosDelPerfil2(perfil, adecuacion, contexto), previo) }
  ];
}

/** Bloque 3 — coherencias, inferencias y pedidos de clarificación. */
function mensajesBloqueAnalitico2(perfil, adecuacion, contexto, previo, modelo) {
  var ejesPendientes = [
    'la madurez y el grado de autonomía del equipo que conduce hoy',
    'los estándares y las herramientas con las que la organización mide y reconoce el desempeño',
    'los requisitos técnicos y de trayectoria del puesto, que esta batería no mide'
  ];

  var instrucciones = reglasComunes2().concat([
    '',
    'Ésta es la TERCERA de cuatro partes: el análisis cualitativo integrado. Es la',
    'parte que más importa del informe. No repitas la descripción de las partes',
    'anteriores: acá se cruzan los datos entre sí.',
    '',
    'Forma exacta de la respuesta:',
    '{',
    '  "coherencias":     [{"tipo": "...", "titulo": "...", "texto": "..."}],',
    '  "inferencias":     [{"titulo": "...", "fuentes": "...", "texto": "..."}],',
    '  "clarificaciones": [{"titulo": "...", "pregunta": "..."}]',
    '}',
    '',
    'EN "coherencias" van 2 o 3 elementos sobre la relación entre lo que las pruebas',
    'psicométricas dicen y las conductas que la persona reporta:',
    '- "tipo": exactamente "Coherencia" o "Incoherencia", copiado tal cual.',
    '  Coherencia es cuando varias fuentes convergen; Incoherencia, cuando un rasgo',
    '  de base no tiene la conducta que le correspondería, o al revés.',
    '- "titulo": de 3 a 9 palabras.',
    '- "texto": 2 o 3 oraciones con los valores de todas las fuentes que entran.',
    'Escribí al menos una de cada tipo si el dato las sostiene. No fuerces una',
    'incoherencia donde el perfil no la muestra.',
    '',
    'EN "inferencias" van 3 elementos: lo que se deduce del perfil y que ninguna',
    'prueba dice por separado. Priorizá, en este orden, las que el dato sostenga:',
    '  a. Estilo relacional muy alto conviviendo con no-intervención o con ausencia',
    '     de mecanismos de control: presencia fuerte en lo afectivo y ausencia en lo',
    '     operativo, justo cuando aparece la fricción.',
    '  b. Un total alto sostenido por una sola subescala mientras las otras quedan en',
    '     la media: el rótulo global describe peor a la persona que sus componentes.',
    '  c. Un rasgo de personalidad marcado sin las conductas que le corresponderían,',
    '     o conductas sin el rasgo que las sostenga.',
    '- "fuentes": las pruebas del cruce, así: "CAMIN-A + CELID-A".',
    '- "texto": 3 o 4 oraciones. Primero el cruce con los valores, después qué',
    '   implica concretamente para el ejercicio del rol en este puesto.',
    '',
    'EN "clarificaciones" van 3 elementos: lo que la evaluación NO midió y que hace',
    'falta para aterrizar el plan. Uno por cada uno de estos ejes:',
    ejesPendientes.map(function (e) { return '  - ' + e + '.'; }).join('\n'),
    '- "titulo": qué está pendiente de definir, de 3 a 9 palabras.',
    '- "pregunta": la pregunta concreta que hay que hacerle a la organización,',
    '  terminada en signo de interrogación.',
    'No pongas ahí nada que la evaluación ya haya medido.'
  ]).join('\n');

  return [
    { role: 'system', content: apagarRazonamiento(modelo) + '\n\n' + instrucciones },
    { role: 'user', content: conLoYaEscrito(datosDelPerfil2(perfil, adecuacion, contexto), previo) }
  ];
}

/** Bloque 4 — plan de desarrollo, pautas para la jefatura y registros de RRHH. */
function mensajesBloquePlan(perfil, adecuacion, contexto, previo, modelo) {
  var instrucciones = reglasComunes2().concat([
    '',
    'Ésta es la CUARTA y última parte: qué se hace con todo lo anterior.',
    '',
    'Forma exacta de la respuesta:',
    '{',
    '  "ejes": [{"titulo": "...", "prioridad": "...", "fundamento": "...",',
    '           "contexto": "...", "accion": "...", "plazo": "...", "indicador": "..."}],',
    '  "informacionLider": {"pautas": "...", "frecuencia": "...", "kpis": "...",',
    '                       "disparadores": "..."},',
    '  "registros": {"lider": "...", "evaluado": "..."}',
    '}',
    '',
    'EN "ejes" van 3 elementos, del más urgente al menos urgente. Cada uno es una',
    'PRÁCTICA con nombre propio, como si fuera un instrumento que la persona va a',
    'implementar el lunes, no un consejo general:',
    '- "titulo": el nombre del eje, de 3 a 9 palabras. Así: "Liderazgo Directivo y',
    '  Claridad Operativa".',
    '- "prioridad": exactamente "Alta", "Media" o "Baja", copiado tal cual. Alta es',
    '  la brecha que toca una exigencia central del rol.',
    '- "fundamento": los valores que justifican el eje, en una línea. Así:',
    '  "Liderazgo Directivo P75 (CAMIN-A) y Dirección por Excepción P1 (CELID-A)".',
    '- "contexto": en qué situación se aplica, discriminando por la MADUREZ del',
    '  equipo (baja, media o alta autonomía) o por un momento puntual del trabajo.',
    '  Una oración. Tiene que NO valer para cualquiera.',
    '- "accion": la mecánica, en 2 o 3 oraciones: qué se define, cada cuánto, con',
    '  qué pasos y qué se evita. Nombrá la actividad de formación o de coaching',
    '  cuando corresponda. Nada de "implementar reuniones periódicas de seguimiento".',
    '- "plazo": el horizonte de la meta, con una unidad de tiempo concreta. Así:',
    '  "90 días" o "dos ciclos trimestrales".',
    '- "indicador": la meta operativa, medible y con número o porcentaje. Así:',
    '  "80 % de los desvíos abordados dentro de la semana en que se detectan".',
    '  Este número es una META que se propone, no un resultado de las pruebas: acá',
    '  sí podés escribir un porcentaje que no esté en los datos.',
    '',
    'EN "informacionLider" va lo que necesita la jefatura de la persona evaluada.',
    'Es lo único del informe escrito para quien supervisa, no sobre quien es',
    'evaluado. Una a tres oraciones por campo:',
    '- "pautas": cómo acompañar y supervisar a esta persona en concreto, y en qué',
    '  situaciones conviene respaldarla.',
    '- "frecuencia": cada cuánto tener reuniones de seguimiento y de qué duración,',
    '  y qué se revisa en cada una.',
    '- "kpis": los indicadores de desempeño concretos a monitorear, con su unidad.',
    '- "disparadores": las señales tempranas de que el riesgo operativo se está',
    '  materializando, y qué hacer cuando aparecen.',
    '',
    'EN "registros" van las dos síntesis breves para el sistema de RRHH, de 3 a 5',
    'oraciones cada una:',
    '- "lider": para la jefatura. Fortalezas con sus valores, brechas con sus valores',
    '  y en qué enfocar el acompañamiento.',
    '- "evaluado": para la persona evaluada. Las mismas cosas dichas en segunda',
    '  persona formal ("Su perfil se destaca por…"), en tono de desarrollo y sin',
    '  ninguna palabra que suene a sanción.'
  ]).join('\n');

  return [
    { role: 'system', content: apagarRazonamiento(modelo) + '\n\n' + instrucciones },
    { role: 'user', content: conLoYaEscrito(datosDelPerfil2(perfil, adecuacion, contexto), previo) }
  ];
}

/**
 * Le suma a los datos los títulos de lo ya redactado.
 *
 * Los cuatro bloques son partes del mismo informe y se leen seguidos: sin esto,
 * el bloque del plan vuelve a contar las mismas tres brechas con otras palabras.
 * Van sólo los títulos, no los textos: alcanza para no repetirse y no infla el
 * pedido, que es lo que empuja la llamada contra el corte de los 60 segundos.
 */
function conLoYaEscrito(datos, previo) {
  var titulos = [];
  ['fortalezas', 'areasDesarrollo', 'inferencias', 'coherencias'].forEach(function (lista) {
    ((previo && previo[lista]) || []).forEach(function (item) {
      titulos.push('- ' + item.titulo);
    });
  });
  if (!titulos.length) return datos;
  return datos + '\n\nYA SE ESCRIBIÓ EN ESTE MISMO INFORME sobre estos puntos. No los'
    + ' repitas: usalos como base para lo que sigue.\n' + titulos.join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// Validaciones
// ═══════════════════════════════════════════════════════════════════

/** Que estén los campos que el documento va a imprimir y que no vengan vacíos. */
function validarEstructura2(datos, bloque) {
  if (!datos || typeof datos !== 'object') {
    return { ok: false, motivo: 'la respuesta no es un objeto' };
  }

  var lleno = function (valor) {
    return typeof valor === 'string' && valor.trim();
  };

  for (var t = 0; t < bloque.textos.length; t++) {
    if (!lleno(datos[bloque.textos[t]])) {
      return { ok: false, motivo: 'falta ' + bloque.textos[t] };
    }
  }

  for (var i = 0; i < bloque.listas.length; i++) {
    var lista = bloque.listas[i];
    var items = datos[lista];
    if (!Array.isArray(items) || !items.length) {
      return { ok: false, motivo: 'falta la lista ' + lista + ' o vino vacía' };
    }
    var campos = SINTESIS2_CAMPOS[lista];
    for (var j = 0; j < items.length; j++) {
      for (var k = 0; k < campos.length; k++) {
        if (!lleno(items[j][campos[k]])) {
          return { ok: false, motivo: lista + '[' + j + '] no tiene ' + campos[k] };
        }
      }
    }
  }

  for (var o = 0; o < bloque.objetos.length; o++) {
    var nombre = bloque.objetos[o];
    var objeto = datos[nombre];
    if (!objeto || typeof objeto !== 'object') {
      return { ok: false, motivo: 'falta ' + nombre };
    }
    var esperados = nombre === 'informacionLider' ? SINTESIS2_INFO_LIDER : SINTESIS2_REGISTROS;
    for (var c = 0; c < esperados.length; c++) {
      if (!lleno(objeto[esperados[c]])) {
        return { ok: false, motivo: nombre + ' no tiene ' + esperados[c] };
      }
    }
  }

  return { ok: true, motivo: '' };
}

/**
 * Que las columnas de valor cerrado traigan uno de los valores.
 *
 * Se valida y no se normaliza a propósito: si el modelo escribió "Riesgo alto"
 * donde tenía que escribir "Riesgo Operativo Crítico", no es sólo el rótulo lo
 * que está mal —es que no leyó qué se le pedía en esa fila—, y arreglarle la
 * palabra dejaría el resto de la fila sin revisar.
 */
function validarValoresCerrados(datos) {
  var revisar = function (items, campo, permitidos, lista) {
    for (var i = 0; i < (items || []).length; i++) {
      if (permitidos.indexOf(items[i][campo]) < 0) {
        return 'en ' + lista + '[' + i + '], ' + campo + ' dice "' + items[i][campo]
          + '" y tiene que ser uno de: ' + permitidos.join(', ');
      }
    }
    return '';
  };

  var motivo = revisar(datos.matrizOperativa, 'categoria', SINTESIS2_CATEGORIAS, 'matrizOperativa')
    || revisar(datos.coherencias, 'tipo', SINTESIS2_TIPOS_COHERENCIA, 'coherencias')
    || revisar(datos.ejes, 'prioridad', SINTESIS2_PRIORIDADES, 'ejes');
  return motivo ? { ok: false, motivo: motivo } : { ok: true, motivo: '' };
}

/**
 * Que cada percentil y cada puntaje T que el texto cita exista en el perfil.
 *
 * Es la contracara de permitir números. En el punto 5 la regla es que no haya
 * ninguno y alcanza con buscarlos; acá el informe se apoya en ellos, así que hay
 * que verificarlos uno por uno. Sin esto, "Amabilidad T=62" —el dato— y
 * "Amabilidad T=72" —inventado— se leen exactamente igual, y el segundo termina
 * en el legajo.
 *
 * Se revisan sólo los números escritos en notación psicométrica (P50, T=62,
 * "percentil 90"): son los que afirman un resultado de la evaluación. Los otros
 * números del informe —"80 % de los desvíos", "90 días", "en 4 pasos"— son metas
 * y plazos del plan de desarrollo, que se proponen y no se miden acá.
 */
function validarCitasPsicometricas(texto, perfil) {
  var esta = function (valor, lista) {
    return lista.indexOf(valor) >= 0;
  };

  var percentiles = percentilesCitados(texto);
  for (var i = 0; i < percentiles.length; i++) {
    if (!esta(percentiles[i], perfil.percentiles)) {
      return { ok: false, motivo: 'cita el percentil P' + percentiles[i]
        + ', que no está en el perfil' };
    }
  }

  // "percentil 90" escrito con todas las letras. Es la otra forma de decir lo
  // mismo, y sin esto pasaba entera.
  var enPalabras = /percentil(?:es)?\s+(\d{1,3})/gi;
  var m;
  while ((m = enPalabras.exec(texto)) !== null) {
    if (!esta(Number(m[1]), perfil.percentiles)) {
      return { ok: false, motivo: 'cita el percentil ' + m[1] + ', que no está en el perfil' };
    }
  }

  var tes = puntajesTCitados(texto);
  for (var j = 0; j < tes.length; j++) {
    if (!esta(tes[j], perfil.tes)) {
      return { ok: false, motivo: 'cita el puntaje T=' + tes[j] + ', que no está en el perfil' };
    }
  }

  return { ok: true, motivo: '' };
}

/** Jerga interna del código. Mucho más corta que la del punto 5: ver arriba. */
function validarJerga2(texto) {
  for (var i = 0; i < SINTESIS2_JERGA_PROHIBIDA.length; i++) {
    var jerga = SINTESIS2_JERGA_PROHIBIDA[i];
    if (texto.toLowerCase().indexOf(jerga.toLowerCase()) >= 0) {
      return { ok: false, motivo: 'usa jerga interna ("' + jerga + '") en el texto del informe' };
    }
  }
  return { ok: true, motivo: '' };
}

/** Todo el texto de un bloque o de la síntesis entera, para revisarlo junto. */
function textoDeSintesis2(datos) {
  var partes = [datos.veredicto, datos.resumenGeneral];

  for (var lista in SINTESIS2_CAMPOS) {
    if (!Object.prototype.hasOwnProperty.call(SINTESIS2_CAMPOS, lista)) continue;
    (datos[lista] || []).forEach(function (item) {
      SINTESIS2_CAMPOS[lista].forEach(function (campo) {
        // La dimensión declarada no se imprime: es la referencia al dato, no
        // prosa, y revisarla acá haría que el nombre de una dimensión con un
        // número adentro se leyera como una cita.
        if (lista === 'areasDesarrollo' && campo === 'dimension') return;
        partes.push(item[campo]);
      });
    });
  }

  if (datos.informacionLider) {
    SINTESIS2_INFO_LIDER.forEach(function (campo) {
      partes.push(datos.informacionLider[campo]);
    });
  }
  if (datos.registros) {
    SINTESIS2_REGISTROS.forEach(function (campo) {
      partes.push(datos.registros[campo]);
    });
  }

  return partes.filter(function (p) { return typeof p === 'string'; }).join(' \n ');
}

/** Valida un bloque suelto, tal como vuelve de la API. */
function validarBloque2(bloque, datos, perfil) {
  var estructura = validarEstructura2(datos, bloque);
  if (!estructura.ok) return estructura;

  var cerrados = validarValoresCerrados(datos);
  if (!cerrados.ok) return cerrados;

  var texto = textoDeSintesis2(datos);

  var jerga = validarJerga2(texto);
  if (!jerga.ok) return jerga;

  var citas = validarCitasPsicometricas(texto, perfil);
  if (!citas.ok) return citas;

  // Las dos validaciones que se comparten con el punto 5. Son las mismas reglas
  // psicométricas: el nivel que se le atribuye a una dimensión tiene que ser el
  // que tiene, y una brecha tiene que existir en el dato. Que el Informe 2 sea
  // otro informe no las cambia, así que se reusan en vez de copiarse.
  var niveles = validarNivelesCoherentes(texto, perfil);
  if (!niveles.ok) return niveles;

  if (datos.areasDesarrollo) {
    var motivacion = validarLecturaMotivacion(datos.areasDesarrollo);
    if (!motivacion.ok) return motivacion;
    var brechas = validarBrechasDeclaradas(datos.areasDesarrollo, perfil);
    if (!brechas.ok) return brechas;
  }

  return { ok: true, motivo: '' };
}

/** Valida la síntesis completa, ya unida. Es la última puerta antes del informe. */
function validarSintesis2(sintesis, perfil) {
  for (var i = 0; i < SINTESIS2_BLOQUES.length; i++) {
    var estructura = validarEstructura2(sintesis, SINTESIS2_BLOQUES[i]);
    if (!estructura.ok) return estructura;
  }

  var cerrados = validarValoresCerrados(sintesis);
  if (!cerrados.ok) return cerrados;

  var texto = textoDeSintesis2(sintesis);

  var jerga = validarJerga2(texto);
  if (!jerga.ok) return jerga;

  var citas = validarCitasPsicometricas(texto, perfil);
  if (!citas.ok) return citas;

  var niveles = validarNivelesCoherentes(texto, perfil);
  if (!niveles.ok) return niveles;

  var motivacion = validarLecturaMotivacion(sintesis.areasDesarrollo);
  if (!motivacion.ok) return motivacion;

  return validarBrechasDeclaradas(sintesis.areasDesarrollo, perfil);
}

/**
 * Pone el nombre real donde el modelo dejó el marcador.
 * Recorre la misma forma que arma el documento, así no queda un `[NOMBRE]`
 * suelto en un campo que nadie se acordó de recorrer.
 */
function ponerNombre2(datos, nombre) {
  var reemplazar = function (texto) {
    return typeof texto === 'string'
      ? texto.split(SINTESIS_MARCADOR_NOMBRE).join(nombre)
      : texto;
  };

  datos.veredicto = reemplazar(datos.veredicto);
  datos.resumenGeneral = reemplazar(datos.resumenGeneral);

  for (var lista in SINTESIS2_CAMPOS) {
    if (!Object.prototype.hasOwnProperty.call(SINTESIS2_CAMPOS, lista)) continue;
    (datos[lista] || []).forEach(function (item) {
      SINTESIS2_CAMPOS[lista].forEach(function (campo) {
        item[campo] = reemplazar(item[campo]);
      });
    });
  }

  if (datos.informacionLider) {
    SINTESIS2_INFO_LIDER.forEach(function (campo) {
      datos.informacionLider[campo] = reemplazar(datos.informacionLider[campo]);
    });
  }
  if (datos.registros) {
    SINTESIS2_REGISTROS.forEach(function (campo) {
      datos.registros[campo] = reemplazar(datos.registros[campo]);
    });
  }
  return datos;
}

// ═══════════════════════════════════════════════════════════════════
// Las llamadas
// ═══════════════════════════════════════════════════════════════════

/**
 * Pide un bloque y lo valida.
 *
 * @param {number} vencimiento momento (ms) después del cual no se pide nada más
 * @return {Object} {datos: Object|null, motivo: string} — el motivo viaja hasta
 *   la interfaz cuando el bloque falla, así el respaldo deja de ser silencioso.
 */
function pedirBloque2(bloque, mensajes, perfil, clave, modelo, vencimiento) {
  var ultimoMotivo = '';

  for (var intento = 1; intento <= SINTESIS2_INTENTOS; intento++) {
    if (!hayTiempo(vencimiento)) {
      ultimoMotivo = ultimoMotivo
        ? ultimoMotivo + ' (y no quedaba tiempo para reintentar)'
        : 'no quedaba tiempo para pedirlo';
      break;
    }
    try {
      var respuesta = respuestaDelModelo(mensajes, clave, modelo, SINTESIS2_MAX_TOKENS);
      if (!respuesta.datos) {
        ultimoMotivo = respuesta.motivo;
        continue;
      }
      var revision = validarBloque2(bloque, respuesta.datos, perfil);
      if (!revision.ok) {
        ultimoMotivo = revision.motivo;
        continue;
      }
      return { datos: respuesta.datos, motivo: '' };
    } catch (e) {
      // Acá caen los cortes por tiempo de UrlFetchApp. Ver pedirBloque en
      // Sintesis.gs: partido en bloques, un corte suele ser un atasco puntual de
      // la cola del servicio y el reintento sale a velocidad normal.
      ultimoMotivo = 'la llamada se interrumpió: ' + e.message;
      console.warn('El bloque ' + bloque.clave + ' del Informe 2 se interrumpió ('
        + e.message + '). Se reintenta.');
    }
  }

  console.warn('No se pudo obtener el bloque ' + bloque.clave + ' del Informe 2 ('
    + SINTESIS2_INTENTOS + ' intentos). Último motivo: ' + ultimoMotivo + '.');
  return { datos: null, motivo: 'bloque ' + bloque.clave + ': ' + ultimoMotivo };
}

/**
 * La síntesis completa con UN modelo: los cuatro bloques y la revisión de la
 * pieza unida. Devuelve null si cualquiera de las cinco cosas no salió.
 *
 * @return {Object} {sintesis: Object|null, motivo: string}
 */
function sintesis2ConModelo(modelo, perfil, adecuacion, contexto, clave, anunciar, vencimiento) {
  var unida = {};

  var pedidos = [
    function (previo) {
      return mensajesBloqueEjecutivo(perfil, adecuacion, contexto, modelo);
    },
    function (previo) {
      return mensajesBloqueBrechas(perfil, adecuacion, contexto, previo, modelo);
    },
    function (previo) {
      return mensajesBloqueAnalitico2(perfil, adecuacion, contexto, previo, modelo);
    },
    function (previo) {
      return mensajesBloquePlan(perfil, adecuacion, contexto, previo, modelo);
    }
  ];

  for (var i = 0; i < SINTESIS2_BLOQUES.length; i++) {
    anunciar(i);
    var bloque = SINTESIS2_BLOQUES[i];
    var pedido = pedirBloque2(bloque, pedidos[i](unida), perfil, clave, modelo, vencimiento);
    if (!pedido.datos) return { sintesis: null, motivo: pedido.motivo };
    // Se acumula sobre el mismo objeto: el bloque siguiente recibe los títulos
    // de todo lo anterior, no sólo del inmediatamente previo.
    for (var campo in pedido.datos) {
      if (!Object.prototype.hasOwnProperty.call(pedido.datos, campo)) continue;
      unida[campo] = pedido.datos[campo];
    }
  }

  var revision = validarSintesis2(unida, perfil);
  if (!revision.ok) {
    return { sintesis: null, motivo: 'la síntesis unida no validó: ' + revision.motivo };
  }

  unida.modelo = modelo;
  return { sintesis: unida, motivo: '' };
}

/**
 * La redacción del Informe 2. Nunca lanza: si ningún modelo puede escribirla,
 * devuelve null y el informe sale con `sintesis2Determinista`.
 *
 * @param {string} nombre de la persona evaluada. NO viaja al modelo: se usa acá
 *   para reemplazar el marcador cuando la síntesis ya volvió.
 * @param {Object} resultados salida de corregir()
 * @param {Object|null} adecuacion salida de adecuacionAlPuesto(), o null si no
 *   se cargó un perfil de puesto
 * @param {Object} contexto {puesto, gerencia, sector}
 * @param {Function} [avisar] recibe el índice del bloque que arranca, para que
 *   la interfaz pueda mostrar por cuál va
 * @param {number} [vencimiento] momento (ms) después del cual no se pide nada más
 * @return {Object} {sintesis: Object|null, motivo: string}
 */
function sintesisDelInforme2(nombre, resultados, adecuacion, contexto, avisar, vencimiento) {
  var anunciar = function (bloque) {
    if (typeof avisar === 'function') avisar(bloque);
  };
  var propiedades = PropertiesService.getScriptProperties();
  var clave = propiedades.getProperty(PROP_LLM_API_KEY);
  if (!clave) {
    var sinClave = 'falta la propiedad ' + PROP_LLM_API_KEY + ' en Propiedades del script';
    console.warn('Sin ' + PROP_LLM_API_KEY + ': el Informe 2 sale con el texto determinista.');
    return { sintesis: null, motivo: sinClave };
  }

  var modelos = modelosConfigurados(propiedades);
  var perfil = perfilParaSintesis2(resultados);
  var plazo = vencimiento || (new Date().getTime() + LLM_PLAZO_MS);
  var motivos = [];

  for (var i = 0; i < modelos.length; i++) {
    var intento = sintesis2ConModelo(modelos[i], perfil, adecuacion, contexto || {},
      clave, anunciar, plazo);
    if (intento.sintesis) {
      if (i > 0) {
        console.warn('El Informe 2 salió con el modelo suplente ' + modelos[i]
          + '. El principal falló: ' + motivos.join(' | '));
      }
      return { sintesis: ponerNombre2(intento.sintesis, nombre), motivo: '' };
    }
    motivos.push(modelos[i] + ' → ' + intento.motivo);

    if (!hayTiempo(plazo)) {
      if (i + 1 < modelos.length) motivos.push('sin tiempo para probar los modelos que quedaban');
      break;
    }
  }

  var motivo = motivos.join(' | ');
  console.warn('Ningún modelo pudo redactar el Informe 2 (' + motivo + '). Sale el determinista.');
  return { sintesis: null, motivo: motivo };
}

// ═══════════════════════════════════════════════════════════════════
// El respaldo determinista
// ═══════════════════════════════════════════════════════════════════

/**
 * El Informe 2 armado por reglas, con la MISMA forma que devuelve el modelo.
 *
 * Que las dos formas sean idénticas es la decisión que sostiene todo el módulo:
 * `Documento2.gs` tiene un solo camino de armado y no sabe —ni le importa— cuál
 * de los dos escribió el texto. En el Informe 1 hay dos caminos de armado para
 * el punto 5 y cada mejora hay que hacerla dos veces; acá no.
 *
 * Es más pobre que la del modelo, y tiene que serlo: cruzar veinticuatro
 * dimensiones entre sí no se puede enumerar de antemano sin escribir una regla
 * por cada par. Lo que sí hace es no decir nada que el dato no sostenga.
 *
 * @param {Object} resultados salida de corregir()
 * @param {Object|null} adecuacion salida de adecuacionAlPuesto(), o null
 * @param {Object} contexto {puesto, gerencia, sector}
 */
function sintesis2Determinista(resultados, adecuacion, contexto) {
  var neo = resultados.neo;
  var cel = resultados.celid.percentil;
  var cam = resultados.camin.percentil;
  var pot = resultados.potenlid.percentil;
  var con = resultados.conlid.percentil;
  var perfil = clasificarPerfil(resultados);
  var b = brechasDeDesarrollo(neo, cel, cam, con);
  var ctx = contexto || {};

  return {
    veredicto: veredictoDeterminista(perfil, adecuacion, ctx),
    resumenGeneral: resumenDeterminista(perfil, neo, pot, cel, cam),
    fortalezas: fortalezasDeterministas(neo, cel, cam, pot, con),
    areasDesarrollo: areasDeterministas(neo, cel, cam, con, b),
    matrizOperativa: matrizDeterminista(adecuacion, cel, cam, con, b),
    coherencias: coherenciasDeterministas(neo, cel, cam, con),
    inferencias: inferenciasDeterministas(neo, cel, cam, pot, con, b),
    ejes: ejesDeterministas(resultados, perfil, adecuacion),
    informacionLider: informacionLiderDeterminista(adecuacion, b),
    registros: registrosDeterministas(adecuacion, b),
    clarificaciones: clarificacionesDeterministas(adecuacion),
    // Sin modelo: es lo que la nota de autoría del pie mira para decir quién
    // escribió el informe.
    modelo: ''
  };
}

function veredictoDeterminista(perfil, adecuacion, contexto) {
  var partes = ['Esta evaluación integra cinco instrumentos estandarizados —NEO-FFI, '
    + 'CELID-A, CAMIN-A, POTENLID y CONLID-A— y los lee de forma conjunta: cada '
    + 'afirmación se sostiene en el cruce entre pruebas y no en un resultado suelto.'];

  if (contexto.puesto) {
    partes.push('El perfil se contrasta contra los requerimientos del puesto de '
      + contexto.puesto + (contexto.gerencia ? ' (' + contexto.gerencia
        + (contexto.sector ? ' — ' + contexto.sector : '') + ')' : '') + '.');
  }

  if (adecuacion && adecuacion.porcentaje !== null) {
    partes.push('El índice de adecuación al puesto se sitúa en el '
      + adecuacion.porcentaje + ' %, calculado sobre ' + adecuacion.cobertura.medidos
      + ' de los ' + adecuacion.cobertura.total + ' requisitos que declara el perfil '
      + 'del puesto.');
  } else {
    partes.push('No se calculó un índice de adecuación: sin perfil de puesto cargado, '
      + 'o sin exigencias que esta batería pueda medir, no hay contra qué contrastar.');
  }

  partes.push('El perfil configura ' + perfil.etiqueta + '.');
  return partes.join(' ');
}

function resumenDeterminista(perfil, neo, pot, cel, cam) {
  return 'El perfil integrado configura ' + perfil.etiqueta + ', sostenido por una base '
    + 'de extraversión ' + neo.nivel.E.toLowerCase() + ' (NEO-FFI T=' + neo.t.E + ') y '
    + 'motivación intrínseca para liderar en nivel '
    + nivelPorPercentil(pot.Intr).toLowerCase() + ' (POTENLID ' + pct(pot.Intr) + '). '
    + 'En estilos de liderazgo, el total transformacional queda en nivel '
    + nivelPorPercentil(cel.TransfTot).toLowerCase() + ' (CELID-A ' + pct(cel.TransfTot)
    + ') y el transaccional en nivel ' + nivelPorPercentil(cel.TransTot).toLowerCase()
    + ' (CELID-A ' + pct(cel.TransTot) + '), con la no-intervención en nivel '
    + nivelPorPercentil(cel.Laissez).toLowerCase() + ' (CELID-A ' + pct(cel.Laissez) + '). '
    + fraseSituacional(perfil, cam);
}

/** Una fortaleza por cada dimensión consolidada, hasta tres. */
function fortalezasDeterministas(neo, cel, cam, pot, con) {
  var candidatas = [
    [cel.ConsInd, 'Atención al Desarrollo Individual', 'CELID-A',
      'Consideración Individualizada (CELID-A ' + pct(cel.ConsInd) + ')',
      'atiende el desarrollo y las necesidades de cada colaborador, y construye vínculos de confianza sostenidos.'],
    [cam.Cons, 'Soporte y Clima de Trabajo', 'CAMIN-A',
      'Liderazgo Considerado (CAMIN-A ' + pct(cam.Cons) + ')',
      'genera un ambiente de contención y apoyo que favorece la permanencia y el compromiso del equipo.'],
    [cam.Part, 'Conducción Participativa', 'CAMIN-A',
      'Liderazgo Participativo (CAMIN-A ' + pct(cam.Part) + ')',
      'consulta e involucra al equipo en las decisiones, lo que genera apropiación de los objetivos.'],
    [cam.Or, 'Orientación al Logro', 'CAMIN-A',
      'Liderazgo Orientado a Metas (CAMIN-A ' + pct(cam.Or) + ')',
      'fija objetivos exigentes y sostiene el rendimiento combinando desafío con apoyo.'],
    [con.Rel, 'Gestión Relacional Cotidiana', 'CONLID-A',
      'Conductas Orientadas a las Relaciones (CONLID-A ' + pct(con.Rel) + ')',
      'usa el reconocimiento, el apoyo cercano y la información fluida como herramientas de gestión diaria.'],
    [con.Camb, 'Impulso de la Transformación', 'CONLID-A',
      'Conductas Orientadas al Cambio (CONLID-A ' + pct(con.Camb) + ')',
      'construye alianzas, promueve nuevas estrategias y arma equipos orientados a la transformación.'],
    [cel.TransfTot, 'Influencia Transformacional', 'CELID-A',
      'Liderazgo Transformacional total (CELID-A ' + pct(cel.TransfTot) + ')',
      'moviliza al equipo hacia metas compartidas y trasciende el intercambio puramente transaccional.'],
    [pot.Intr, 'Motivación Genuina para Conducir', 'POTENLID',
      'Motivación Intrínseca (POTENLID ' + pct(pot.Intr) + ')',
      'ejerce el rol por convicción propia, lo que se traduce en consistencia a lo largo del tiempo.']
  ];

  var fortalezas = candidatas.filter(function (c) {
    return esFortalezaConsolidada(c[0]);
  }).sort(function (a, b) {
    return b[0] - a[0];
  }).slice(0, 3).map(function (c) {
    return {
      titulo: c[1],
      fuentes: c[2],
      texto: 'El nivel de ' + c[3] + ' se ubica entre lo más alto del perfil: ' + c[4]
    };
  });

  // La estabilidad emocional y la no-intervención baja son fortalezas que no
  // salen de un percentil alto, así que se agregan si quedó lugar.
  if (fortalezas.length < 3 && (neo.nivel.N === 'Bajo' || neo.nivel.N === 'Muy Bajo')) {
    fortalezas.push({
      titulo: 'Estabilidad Emocional bajo Presión',
      fuentes: 'NEO-FFI',
      texto: 'El Neuroticismo en nivel ' + neo.nivel.N.toLowerCase() + ' (NEO-FFI T='
        + neo.t.N + ') indica un manejo sólido del estrés sostenido, que es un recurso '
        + 'central para la conducción en contextos de exigencia.'
    });
  }
  if (fortalezas.length < 3 && nivelPorPercentil(cel.Laissez) === 'Bajo') {
    fortalezas.push({
      titulo: 'Presencia Sostenida en la Conducción',
      fuentes: 'CELID-A',
      texto: 'El nivel bajo en Laissez-Faire (CELID-A ' + pct(cel.Laissez) + ') descarta '
        + 'la delegación sin acompañamiento y el abandono de las funciones de conducción: '
        + 'la persona se hace presente en el rol.'
    });
  }
  if (!fortalezas.length) {
    fortalezas.push({
      titulo: 'Perfil sin Dimensiones Destacadas',
      fuentes: 'CELID-A + CAMIN-A + CONLID-A',
      texto: 'Ninguna dimensión de liderazgo alcanza el corte de fortaleza consolidada. '
        + 'El detalle por instrumento está en el anexo cuantitativo.'
    });
  }
  return fortalezas;
}

/** Un área de desarrollo por cada brecha, hasta tres, y con su dimensión declarada. */
function areasDeterministas(neo, cel, cam, con, b) {
  var candidatas = [];
  var agregar = function (condicion, dimension, titulo, fuentes, texto) {
    if (condicion) candidatas.push({ dimension: dimension, titulo: titulo,
      fuentes: fuentes, texto: texto });
  };

  agregar(b.laissez, 'Laissez-Faire', 'Episodios de No-Intervención', 'CELID-A',
    'El Laissez-Faire en nivel alto (CELID-A ' + pct(cel.Laissez) + ') marca episodios '
    + 'de no-intervención o de delegación sin acompañamiento. La brecha se cierra '
    + 'interviniendo antes, sobre todo con colaboradores de menor autonomía.');
  agregar(b.directivo, 'Liderazgo Directivo', 'Directividad Situacional', 'CAMIN-A',
    'El Liderazgo Directivo queda en nivel ' + nivelPorPercentil(cam.Dir).toLowerCase()
    + ' (CAMIN-A ' + pct(cam.Dir) + '): faltan instrucciones explícitas y expectativas '
    + 'no negociables en las situaciones que no admiten consenso.');
  agregar(b.recompensa, 'Recompensa Contingente', 'Contingencias de Desempeño', 'CELID-A',
    'La Recompensa Contingente queda en nivel ' + nivelPorPercentil(cel.RecCont).toLowerCase()
    + ' (CELID-A ' + pct(cel.RecCont) + '): el reconocimiento del buen desempeño no '
    + 'está formalizado ni ligado a metas acordadas de antemano.');
  agregar(b.carisma, 'Carisma / Influencia Idealizada', 'Proyección de Visión e Influencia', 'CELID-A',
    'El Carisma queda en nivel ' + nivelPorPercentil(cel.Carisma).toLowerCase()
    + ' (CELID-A ' + pct(cel.Carisma) + '): la presencia simbólica y la capacidad de '
    + 'movilizar al equipo a través del relato quedan por debajo de lo que el rol pide.');
  agregar(b.estimInt, 'Estimulación Intelectual', 'Cuestionamiento y Desafío Analítico', 'CELID-A',
    'La Estimulación Intelectual queda en nivel ' + nivelPorPercentil(cel.EstimInt).toLowerCase()
    + ' (CELID-A ' + pct(cel.EstimInt) + '): el equipo no recibe el desafío analítico '
    + 'que empuja a revisar los modos de trabajo instalados.');
  agregar(b.tarea, 'Conductas Orientadas a la Tarea', 'Estructuración y Seguimiento', 'CONLID-A',
    'Las Conductas Orientadas a la Tarea quedan en nivel '
    + nivelPorPercentil(con.Tar).toLowerCase() + ' (CONLID-A ' + pct(con.Tar) + '): '
    + 'faltan el monitoreo sistemático y la definición explícita de estándares.');
  agregar(b.autorregulacion, 'Neuroticismo', 'Autorregulación Emocional', 'NEO-FFI',
    'El Neuroticismo en nivel ' + neo.nivel.N.toLowerCase() + ' (NEO-FFI T=' + neo.t.N
    + ') señala reactividad emocional bajo presión sostenida, que en la conducción se '
    + 'traslada al clima del equipo.');

  if (!candidatas.length) {
    return [{
      dimension: '',
      titulo: 'Sin Brechas Significativas',
      fuentes: 'CELID-A + CAMIN-A + CONLID-A + NEO-FFI',
      texto: 'El perfil no presenta brechas por debajo de los cortes del sistema. El '
        + 'plan de desarrollo se orienta a profundizar las fortalezas ya consolidadas.'
    }];
  }
  return candidatas.slice(0, 3);
}

/** La matriz de fortalezas y riesgos: lo que el puesto exige y cómo queda cubierto. */
function matrizDeterminista(adecuacion, cel, cam, con, b) {
  var filas = [];

  if (adecuacion) {
    adecuacion.fortalezas.slice(0, 2).forEach(function (f) {
      filas.push({
        categoria: 'Fortaleza Operativa',
        hallazgo: f.dimension + (f.percentil === null ? '' : ' ' + pct(f.percentil))
          + ' en nivel ' + f.real.toLowerCase(),
        impacto: 'Cubre lo que el puesto pide en nivel ' + f.requerido.toLowerCase()
          + ': es una capacidad instalada sobre la que el rol puede apoyarse desde el inicio.'
      });
    });
    adecuacion.brechas.slice(0, 3).forEach(function (f) {
      filas.push({
        categoria: f.critica ? 'Riesgo Operativo Crítico' : 'Riesgo Operativo Moderado',
        hallazgo: f.dimension + (f.percentil === null ? '' : ' ' + pct(f.percentil))
          + ' en nivel ' + f.real.toLowerCase() + ', requerido nivel '
          + f.requerido.toLowerCase(),
        impacto: 'Aporta ' + f.puntaje + ' de 100 al índice'
          + (f.critica ? ' y el puesto la presenta como central del rol' : '')
          + ': queda expuesta la parte del rol que depende de esta dimensión.'
      });
    });
  }

  // Sin perfil de puesto no hay exigencias, así que las filas salen de las
  // brechas del propio perfil, que es lo único que el dato sostiene.
  if (!filas.length) {
    if (b.laissez) {
      filas.push({
        categoria: 'Riesgo Operativo Crítico',
        hallazgo: 'Laissez-Faire ' + pct(cel.Laissez) + ' en nivel alto',
        impacto: 'La no-intervención ante los desvíos deja que los problemas escalen '
          + 'antes de que alguien los tome.'
      });
    }
    if (b.tarea) {
      filas.push({
        categoria: 'Riesgo Operativo Moderado',
        hallazgo: 'Conductas Orientadas a la Tarea ' + pct(con.Tar),
        impacto: 'El seguimiento del cumplimiento no es sistemático, lo que retrasa la '
          + 'detección de los desvíos.'
      });
    }
    if (esFortalezaConsolidada(cam.Part)) {
      filas.push({
        categoria: 'Fortaleza Operativa',
        hallazgo: 'Liderazgo Participativo ' + pct(cam.Part),
        impacto: 'Sostiene la cohesión del equipo y la construcción de acuerdos.'
      });
    }
  }

  if (!filas.length) {
    filas.push({
      categoria: 'Fortaleza Operativa',
      hallazgo: 'Perfil sin desvíos marcados en ninguna dimensión',
      impacto: 'No se detectan riesgos operativos derivados del perfil psicométrico. '
        + 'El detalle está en el anexo cuantitativo.'
    });
  }
  return filas;
}

/** Coherencias e incoherencias que las reglas sí pueden afirmar. */
function coherenciasDeterministas(neo, cel, cam, con) {
  var filas = [];
  var amabilidadAlta = neo.nivel.A === 'Alto' || neo.nivel.A === 'Muy Alto';

  if (amabilidadAlta && esFortalezaConsolidada(cam.Cons)) {
    filas.push({
      tipo: 'Coherencia',
      titulo: 'Orientación Prosocial Sostenida en la Conducta',
      texto: 'La Amabilidad en nivel ' + neo.nivel.A.toLowerCase() + ' (NEO-FFI T='
        + neo.t.A + ') converge con el Liderazgo Considerado (CAMIN-A ' + pct(cam.Cons)
        + '): el rasgo de base se traduce en la conducta de conducción que le '
        + 'corresponde, sin que una cosa contradiga a la otra.'
    });
  }

  if (esFortalezaConsolidada(cam.Part) && nivelPorPercentil(cel.RecCont) !== 'Alto') {
    filas.push({
      tipo: 'Incoherencia',
      titulo: 'Inclusión Alta con Control de Cumplimiento Bajo',
      texto: 'El Liderazgo Participativo (CAMIN-A ' + pct(cam.Part) + ') convive con una '
        + 'Recompensa Contingente en nivel ' + nivelPorPercentil(cel.RecCont).toLowerCase()
        + ' (CELID-A ' + pct(cel.RecCont) + '). La persona involucra al equipo en las '
        + 'decisiones pero no activa después los mecanismos que aseguran que lo acordado '
        + 'se cumpla.'
    });
  }

  if (nivelPorPercentil(con.Camb) === 'Alto' && nivelPorPercentil(cel.EstimInt) !== 'Alto') {
    filas.push({
      tipo: 'Incoherencia',
      titulo: 'Impulso al Cambio sin Cuestionamiento Propio',
      texto: 'Las Conductas Orientadas al Cambio en nivel alto (CONLID-A ' + pct(con.Camb)
        + ') contrastan con la Estimulación Intelectual en nivel '
        + nivelPorPercentil(cel.EstimInt).toLowerCase() + ' (CELID-A ' + pct(cel.EstimInt)
        + '): acompaña e implementa los cambios que otros diseñan, con menos iniciativa '
        + 'para formular los propios.'
    });
  }

  if (!filas.length) {
    filas.push({
      tipo: 'Coherencia',
      titulo: 'Perfil Internamente Consistente',
      texto: 'Los rasgos de personalidad, los estilos de liderazgo y las conductas '
        + 'reportadas apuntan en la misma dirección, sin contradicciones que la lectura '
        + 'por reglas pueda señalar. El detalle por instrumento está en el anexo.'
    });
  }
  return filas;
}

/** Las inferencias que se pueden derivar de un cruce fijo entre dos dimensiones. */
function inferenciasDeterministas(neo, cel, cam, pot, con, b) {
  var filas = [];

  if (esFortalezaConsolidada(cam.Cons) && (b.laissez || b.directivo)) {
    filas.push({
      titulo: 'Presencia Relacional con Baja Intervención Operativa',
      fuentes: 'CAMIN-A + CELID-A',
      texto: 'El Liderazgo Considerado (CAMIN-A ' + pct(cam.Cons) + ') convive con un '
        + 'Liderazgo Directivo en nivel ' + nivelPorPercentil(cam.Dir).toLowerCase()
        + ' (CAMIN-A ' + pct(cam.Dir) + '). La lectura conjunta sugiere una presencia '
        + 'fuerte en el plano del vínculo y más débil en el operativo, que es donde '
        + 'aparece la fricción. En la práctica, el riesgo es que el clima se preserve a '
        + 'costa de no abordar los desvíos.'
    });
  }

  if (nivelPorPercentil(cel.TransfTot) === 'Alto'
      && (nivelPorPercentil(cel.Carisma) !== 'Alto' || nivelPorPercentil(cel.EstimInt) !== 'Alto')) {
    filas.push({
      titulo: 'Total Transformacional Sostenido por Pocas Subescalas',
      fuentes: 'CELID-A',
      texto: 'El total transformacional queda en nivel alto (CELID-A '
        + pct(cel.TransfTot) + ') mientras el Carisma (' + pct(cel.Carisma)
        + ') y la Estimulación Intelectual (' + pct(cel.EstimInt) + ') quedan por debajo. '
        + 'El rótulo global describe a la persona peor que sus componentes: lo que sostiene '
        + 'el total es el eje relacional, no el simbólico ni el analítico.'
    });
  }

  if (pot.Soc > pot.Intr) {
    filas.push({
      titulo: 'Motivación Ligada a la Expectativa Institucional',
      fuentes: 'POTENLID + NEO-FFI',
      texto: 'La Motivación Social-Normativa (POTENLID ' + pct(pot.Soc) + ') pesa más que '
        + 'la Intrínseca (POTENLID ' + pct(pot.Intr) + '), con la Responsabilidad en nivel '
        + neo.nivel.C.toLowerCase() + ' (NEO-FFI T=' + neo.t.C + '). La conducta se '
        + 'moviliza sobre todo por la adhesión a lo que la organización espera del rol, '
        + 'lo que la vuelve más dependiente de que ese marco esté explícito.'
    });
  }

  if (!filas.length) {
    filas.push({
      titulo: 'Sin Tensiones Entre Dimensiones',
      fuentes: 'CELID-A + CAMIN-A + CONLID-A + POTENLID + NEO-FFI',
      texto: 'El cruce entre instrumentos no muestra tensiones que la lectura por reglas '
        + 'pueda afirmar: las dimensiones acompañan a los rasgos que les corresponden. '
        + 'La lectura fina de las tensiones es lo que aporta la redacción asistida, que en '
        + 'esta corrida no estuvo disponible.'
    });
  }
  return filas;
}

/**
 * Los ejes del plan.
 *
 * Salen de `competenciasConClave` (Perfil.gs) —el mismo catálogo de
 * intervenciones que usa el Informe 1— ordenado por lo que este puesto vuelve
 * prioritario. Un catálogo propio del Informe 2 terminaría recomendando cosas
 * distintas que el Informe 1 para la misma brecha.
 */
function ejesDeterministas(resultados, perfil, adecuacion) {
  var filas = adecuacion
    ? planDeDesarrolloParaElPuesto(resultados, adecuacion).prioritarias
    : [];

  // Sin puesto —o sin coincidencias con lo que el puesto exige— se usan las
  // competencias tal como las lista la sección 3 del Informe 1.
  if (!filas.length) {
    filas = competenciasADesarrollar(resultados.neo, resultados.celid.percentil,
      resultados.camin.percentil, resultados.conlid.percentil, perfil);
  }

  return filas.slice(0, 3).map(function (fila, i) {
    return {
      // La numeración la pone el documento: acá el título es sólo el nombre.
      titulo: String(fila[0]).replace(/^\d+\.\s*/, ''),
      prioridad: i === 0 ? 'Alta' : (i === 1 ? 'Alta' : 'Media'),
      fundamento: fila[1],
      contexto: 'Aplicable con colaboradores de autonomía baja o media, y en los '
        + 'momentos del trabajo en los que el consenso no alcanza para destrabar.',
      accion: fila[2],
      plazo: '90 días',
      indicador: 'Práctica implementada y sostenida en al menos el 80 % de los ciclos '
        + 'de trabajo del período.'
    };
  });
}

function informacionLiderDeterminista(adecuacion, b) {
  var criticas = adecuacion
    ? adecuacion.brechas.filter(function (f) { return f.critica; })
    : [];
  var riesgo = adecuacion && adecuacion.riesgo ? adecuacion.riesgo.toLowerCase() : 'no clasificado';

  return {
    pautas: 'Acompañar a la persona en el establecimiento de límites operativos y '
      + 'respaldar su autoridad en las situaciones de confrontación de desvíos. El nivel '
      + 'de riesgo operativo calculado es ' + riesgo + '.',
    frecuencia: 'Reuniones de seguimiento quincenales de 45 minutos durante los primeros '
      + '90 días, y mensuales después, con una agenda fija: acuerdos del período, desvíos '
      + 'abordados y compromisos pendientes.',
    kpis: criticas.length
      ? 'Monitorear el avance sobre las exigencias críticas sin cubrir: '
        + criticas.map(function (f) { return f.dimension; }).join(', ')
        + '. Medir la frecuencia de conversaciones de feedback formal registradas y el '
        + 'porcentaje de hitos de control cumplidos.'
      : 'Monitorear la frecuencia de conversaciones de feedback formal registradas, el '
        + 'porcentaje de hitos de control cumplidos y la claridad de los criterios de '
        + 'cierre acordados con el equipo.',
    disparadores: (b.laissez || b.directivo
      ? 'Señal temprana: desvíos que se repiten sin que se los aborde, o compromisos que '
        + 'vencen sin conversación. '
      : 'Señal temprana: compromisos que vencen sin conversación. ')
      + 'Cuando aparezcan, revisar en la reunión siguiente qué controles intermedios '
      + 'faltaron y acordar uno concreto para el ciclo próximo.'
  };
}

function registrosDeterministas(adecuacion, b) {
  var brechas = adecuacion && adecuacion.brechas.length
    ? adecuacion.brechas.slice(0, 3).map(function (f) { return f.dimension; }).join(', ')
    : 'las señaladas en el punto de áreas de desarrollo';
  var fortalezas = adecuacion && adecuacion.fortalezas.length
    ? adecuacion.fortalezas.slice(0, 3).map(function (f) { return f.dimension; }).join(', ')
    : 'las señaladas en el punto de fortalezas clave';

  return {
    lider: 'El perfil evaluado muestra fortalezas consolidadas en ' + fortalezas
      + ', y requiere acompañamiento en ' + brechas + '. El plan de desarrollo se '
      + 'concentra en formalizar los controles intermedios, el feedback oportuno ante los '
      + 'desvíos y la explicitación de los objetivos acordados.',
    evaluado: 'Su perfil se destaca en ' + fortalezas + '. La hoja de ruta de desarrollo '
      + 'prioriza el fortalecimiento de las herramientas de estructuración de metas, el '
      + 'seguimiento formal de los acuerdos y la comunicación de la visión, para potenciar '
      + 'el ejercicio del rol de conducción.'
  };
}

function clarificacionesDeterministas(adecuacion) {
  var filas = [
    {
      titulo: 'Madurez y Autonomía del Equipo Actual',
      pregunta: '¿Cuál es el nivel de autonomía técnica y de madurez del equipo que la '
        + 'persona conduce hoy?'
    },
    {
      titulo: 'Herramientas Formales de Gestión del Desempeño',
      pregunta: '¿Con qué instrumentos institucionales de evaluación, reconocimiento y '
        + 'seguimiento del desempeño cuenta hoy la organización?'
    }
  ];

  if (adecuacion && adecuacion.cobertura.noMedidos) {
    filas.push({
      titulo: 'Validación de los Requisitos Técnicos del Puesto',
      pregunta: '¿Cuál fue el resultado de la evaluación técnica de los '
        + adecuacion.cobertura.noMedidos + ' requisitos de formación, experiencia y '
        + 'conocimientos que esta batería no mide?'
    });
  } else {
    filas.push({
      titulo: 'Requisitos Técnicos y de Trayectoria del Puesto',
      pregunta: '¿Qué requisitos de formación, experiencia y conocimientos técnicos exige '
        + 'el puesto, y por qué vía se los evalúa?'
    });
  }
  return filas;
}
