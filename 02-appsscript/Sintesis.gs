/**
 * Síntesis narrativa del punto 5 del informe, redactada por un LLM.
 *
 * Por qué un LLM acá y no una tabla de reglas: lo que pide el PO en
 * `Informe-Chilindrina.docx` no es una lista de dimensiones por encima de un umbral —eso
 * ya lo hace la síntesis determinista y es lo que quedó pobre—, sino el cruce
 * entre dimensiones que se contradicen entre sí ("busca estar presente y a la
 * vez cae en no-intervención"). Ese razonamiento sobre 24 dimensiones no se
 * puede enumerar de antemano sin escribir una regla por cada par posible.
 *
 * POR QUÉ SON DOS LLAMADAS Y NO UNA
 *
 * `UrlFetchApp` corta a los 60 segundos y no se puede configurar. Medido contra
 * la API con el prompt real, una sola llamada que devuelve la síntesis completa
 * tarda entre 36 y 72 segundos: el servicio rinde 20-30 tokens por segundo y la
 * cola es impredecible, así que una parte de los informes chocaba contra el
 * límite. Lo que importa no es el tiempo total —el script tiene 6 minutos— sino
 * que ninguna llamada suelta se pase de 60 segundos.
 *
 * Así que el pedido se parte en dos bloques de la mitad del tamaño:
 *
 *   1. descriptivo — resumen, fortalezas y áreas de desarrollo.
 *   2. analítico   — inferencias, recomendaciones y vacíos por definir.
 *
 * Cada bloque devuelve ~600 tokens, que incluso al peor rendimiento medido
 * entran cómodos en el límite. De paso se gana algo que la llamada única no
 * daba: cuando un bloque no valida, se reintenta solo ese bloque en vez de
 * descartar toda la síntesis.
 *
 * El segundo bloque recibe los títulos del primero para no repetir lo ya dicho.
 *
 * QUÉ IMPIDE QUE EL MODELO INVENTE
 *
 *   1. El prompt recibe SOLO los números ya calculados por `corregir()`. El
 *      modelo no ve respuestas crudas ni recalcula nada.
 *   2. Se le prohíbe suponer contexto que el instrumento no mide (madurez del
 *      equipo, herramientas de la empresa): eso va al bloque "Pendiente de
 *      definir", que es lo que el propio informe del PO hace.
 *   3. Las validaciones de abajo rechazan la respuesta si cita un número que no
 *      le pasamos, si usa jerga interna del código o si presenta la motivación
 *      extrínseca como un déficit. Las tres cosas se midieron: el modelo las
 *      hacía igual habiéndoselas prohibido en el prompt. Una instrucción no es
 *      una garantía; una verificación sí.
 *
 * Si el LLM falla —sin clave, sin red, cuota agotada, respuesta inválida— el
 * informe se genera igual con la síntesis determinista. La generación del
 * informe no puede depender de un servicio externo.
 */

var PROP_LLM_API_KEY = 'NVIDIA_API_KEY';
var PROP_LLM_MODELO = 'NVIDIA_MODELO';

var LLM_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

// Elegido midiendo, no por descarte. De los 118 modelos del endpoint, los más
// rápidos que se probaron con este prompt o no están disponibles (404) o son de
// razonamiento sin interruptor efectivo —`nemotron-3-super-120b-a12b` volcó 6000
// caracteres de pensamiento en `content` y nunca llegó al JSON—, o son bastante
// más lentos: `deepseek-v4-flash` 100 s, `mistral-medium-3.5` 137 s,
// `llama-4-maverick` sin responder a los 240 s. Los chicos y rápidos
// (`llama-3.1-8b`) escriben mal: errores de concordancia, generizan a la persona
// evaluada y convierten la motivación extrínseca baja en un déficit.
var LLM_MODELO_POR_DEFECTO = 'nvidia/llama-3.3-nemotron-super-49b-v1.5';

// El modelo es de razonamiento: sin apagarlo gasta el presupuesto de tokens
// pensando y puede devolver `content: null`. Medido: "detailed thinking off"
// —el interruptor documentado de la familia Nemotron— NO lo apaga en este
// modelo; `/no_think` sí. Se usa el que funciona.
var LLM_SISTEMA_THINKING = '/no_think';

var LLM_TEMPERATURA = 0.6;
var LLM_TOP_P = 0.95;

// Techo por bloque. Cada bloque pide ~600 tokens; el doble alcanza para que una
// respuesta algo más larga no se corte a la mitad, y evita que una generación
// desbocada consuma el presupuesto entero sin devolver nada.
var LLM_MAX_TOKENS = 1200;

// Dos intentos por bloque. Cubren las tres formas de fallar: JSON mal formado,
// un número inventado (esporádicos con temperatura 0,6, suelen salir bien a la
// segunda) y el corte por tiempo, que partido en bloques pasó a ser un atasco
// puntual del servicio y no la norma. Ver `pedirBloque`.
//
// Peor caso: 2 bloques × 2 intentos × 60 s = 4 minutos, dentro de los 6 que da
// Apps Script contando lo que tarda el resto del informe (~2 s).
var LLM_INTENTOS = 2;

/**
 * Nombres largos de cada dimensión, para que el modelo escriba como el informe
 * y no con las abreviaturas internas del código.
 */
var SINTESIS_ETIQUETAS = {
  celid: {
    Carisma:   'Carisma / Influencia Idealizada',
    EstimInt:  'Estimulación Intelectual',
    Inspir:    'Inspiración / Motivación Inspiracional',
    ConsInd:   'Consideración Individualizada',
    TransfTot: 'Liderazgo Transformacional (total)',
    RecCont:   'Recompensa Contingente',
    DirExc:    'Dirección por Excepción',
    TransTot:  'Liderazgo Transaccional (total)',
    Laissez:   'Laissez-Faire'
  },
  potenlid: {
    Intr: 'Motivación Intrínseca para liderar',
    Extr: 'Motivación Extrínseca para liderar',
    Soc:  'Motivación Social-Normativa para liderar'
  },
  camin: {
    Dir:  'Liderazgo Directivo',
    Cons: 'Liderazgo Considerado',
    Part: 'Liderazgo Participativo',
    Or:   'Liderazgo Orientado a Metas'
  },
  conlid: {
    Tar:  'Conductas Orientadas a la Tarea',
    Rel:  'Conductas Orientadas a las Relaciones',
    Camb: 'Conductas Orientadas al Cambio'
  }
};

var NOMBRE_INSTRUMENTO = {
  celid: 'CELID-A (estilos de liderazgo)',
  potenlid: 'POTENLID (motivación para liderar)',
  camin: 'CAMIN-A (conductas de liderazgo)',
  conlid: 'CONLID-A (conductas orientadas)'
};

/**
 * Vocabulario interno que no puede aparecer en el informe: o es jerga del código
 * o es el nombre técnico de un instrumento. La persona evaluada lee este texto.
 */
var SINTESIS_JERGA_PROHIBIDA = [
  'escala invertida',
  'referencia orientativa',
  // El PO pidió que el punto 5 no mencione valores: la devolución habla de
  // niveles (Alto, Medio, Bajo), no de puntajes. "percentil" y "puntaje t"
  // entran acá porque nombrar la métrica ya arrastra el número.
  'percentil',
  'puntaje t',
  'puntuación t',
  'CELID',
  'CONLID',
  'CAMIN',
  'POTENLID',
  'NEO-FFI',
  'pendienteDefinir',
  'areasDesarrollo'
];

/**
 * Dimensiones donde un percentil alto es lo indeseable.
 * Sin esto el modelo lee "Laissez-Faire P90" como una fortaleza.
 */
var SINTESIS_INVERTIDAS = { Laissez: true };

/**
 * Dimensiones donde el rol espera un nivel alto.
 *
 * OJO: salen de la prosa fija del informe anterior (`Documento.gs` §4, "vs ideal
 * P90"), no de una matriz normativa validada. Están acá, juntas y declaradas,
 * para que el PO las revise en un solo lugar — es el hueco #2 de
 * PLAN-REFINAMIENTO.md. Mientras no estén validadas el modelo las usa como
 * orientación, nunca como veredicto.
 *
 * Antes eran percentiles (90, 85, 75). Al pedir el PO que el informe no mencione
 * valores, quedan reducidas a "el rol espera nivel alto acá", que es lo que se le
 * puede decir sin nombrar un número. Se pierde el matiz entre 90 y 75: si el PO
 * quiere distinguirlos habrá que darles nombre de nivel, no de puntaje.
 */
var SINTESIS_ESPERA_NIVEL_ALTO = ['Carisma', 'EstimInt', 'Dir', 'Tar'];

/** Campos obligatorios de cada lista de la síntesis. */
var SINTESIS_LISTAS = {
  fortalezas: ['titulo', 'texto'],
  // `dimension` no se imprime: es la declaración de en qué dato se apoya la
  // brecha, y permite verificarla. Ver validarBrechasDeclaradas.
  areasDesarrollo: ['dimension', 'titulo', 'texto'],
  inferencias: ['titulo', 'texto'],
  recomendaciones: ['titulo', 'contexto', 'accion'],
  pendienteDefinir: ['titulo', 'texto']
};

/** Los dos bloques en que se parte el pedido, en orden. */
var SINTESIS_BLOQUE_DESCRIPTIVO = {
  clave: 'descriptivo',
  resumen: true,
  listas: ['fortalezas', 'areasDesarrollo']
};

var SINTESIS_BLOQUE_ANALITICO = {
  clave: 'analítico',
  resumen: false,
  listas: ['inferencias', 'recomendaciones', 'pendienteDefinir']
};

/**
 * Traduce los resultados de `corregir()` al mínimo de hechos que el modelo
 * necesita. Función pura: es lo que se verifica en los tests.
 *
 * @param {Object} resultados salida de corregir()
 * @return {Object} perfil con dimensiones, percentiles válidos y NEO
 */
function perfilParaSintesis(resultados) {
  var dimensiones = [];

  ['celid', 'potenlid', 'camin', 'conlid'].forEach(function (instrumento) {
    var etiquetas = SINTESIS_ETIQUETAS[instrumento];
    var bloque = resultados[instrumento];
    for (var clave in etiquetas) {
      if (!Object.prototype.hasOwnProperty.call(etiquetas, clave)) continue;
      var p = bloque.percentil[clave];
      if (p === undefined) continue;
      dimensiones.push({
        instrumento: NOMBRE_INSTRUMENTO[instrumento],
        dimension: etiquetas[clave],
        // El percentil queda en el perfil para poder ordenar el ranking de abajo,
        // pero NO se le pasa al modelo: el prompt solo lleva niveles.
        percentil: p,
        // `nivelPorPercentil()` es la misma función con la que el informe rotula
        // sus tablas en las secciones 1 a 4. Usar otra banda acá haría que el
        // punto 5 dijera "Bajo" donde la tabla dice "Medio", que es exactamente
        // la contradicción entre secciones que el PO señaló en HU2.
        nivel: nivelPorPercentil(p),
        invertida: !!SINTESIS_INVERTIDAS[clave],
        esperaAlto: SINTESIS_ESPERA_NIVEL_ALTO.indexOf(clave) >= 0
      });
    }
  });

  var neo = [];
  NEO_DIMENSIONES.forEach(function (dim) {
    neo.push({
      dimension: NEO_NOMBRES[dim],
      nivel: resultados.neo.nivel[dim],
      descripcion: NEO_INTERPRETACION_BREVE[dim]
    });
  });

  return {
    dimensiones: dimensiones,
    neo: neo,
    destacadas: dimensionesDestacadas(dimensiones)
  };
}

/**
 * Las dimensiones más y menos prominentes del perfil.
 *
 * Hace falta porque la banda de niveles es gruesa: con tres niveles, una
 * dimensión en el techo de la distribución y otra apenas sobre el umbral quedan
 * las dos en "Alto", y el modelo pierde el contraste que necesita para cruzar
 * datos y encontrar tensiones. Ordenar por el percentil real recupera ese
 * contraste sin nombrar ningún número: es un ranking, no una medida.
 *
 * En las invertidas el orden se lee al revés: estar arriba en Laissez-Faire no
 * es destacarse, así que se excluyen del ranking de fortalezas.
 */
function dimensionesDestacadas(dimensiones) {
  var ordenables = dimensiones.filter(function (d) { return !d.invertida; });
  var porPercentil = ordenables.slice().sort(function (a, b) { return b.percentil - a.percentil; });
  var nombres = function (lista) {
    return lista.map(function (d) { return d.dimension; });
  };
  return {
    masAltas: nombres(porPercentil.slice(0, 4)),
    masBajas: nombres(porPercentil.slice(-4).reverse())
  };
}

/**
 * El perfil listado por nivel en vez de por instrumento.
 *
 * Es información redundante con la lista principal, y está a propósito: el modelo
 * atribuía el nivel de una dimensión a otra de nombre parecido. Leer "en nivel
 * Alto están: …" es mucho más difícil de confundir que buscar cada dimensión en
 * una lista de diecinueve.
 */
function agrupadoPorNivel(perfil) {
  var orden = ['Alto', 'Medio', 'Bajo'];
  var grupos = {};
  perfil.dimensiones.forEach(function (d) {
    if (!grupos[d.nivel]) grupos[d.nivel] = [];
    grupos[d.nivel].push(d.dimension + (d.invertida ? ' (acá alto es lo indeseable)' : ''));
  });
  var lineas = [];
  orden.forEach(function (nivel) {
    if (grupos[nivel] && grupos[nivel].length) {
      lineas.push('- En nivel ' + nivel + ': ' + grupos[nivel].join('; ') + '.');
    }
  });

  var porNeo = {};
  perfil.neo.forEach(function (d) {
    if (!porNeo[d.nivel]) porNeo[d.nivel] = [];
    porNeo[d.nivel].push(d.dimension);
  });
  for (var nivelNeo in porNeo) {
    if (!Object.prototype.hasOwnProperty.call(porNeo, nivelNeo)) continue;
    lineas.push('- Personalidad en nivel ' + nivelNeo + ': ' + porNeo[nivelNeo].join('; ') + '.');
  }
  return lineas.join('\n');
}

/**
 * Las dimensiones de las que puede salir un área de desarrollo: las que NO están
 * en nivel alto, más las invertidas altas, donde alto es justamente el problema.
 *
 * Es una lista de lo permitido y no de lo prohibido a propósito. Prohibir no
 * alcanzó: con la orientación a metas en nivel alto, el informe escribió que la
 * persona "prioriza el bienestar relacional sobre el logro de metas concretas";
 * al nombrarle esa dimensión como intocable, el modelo movió el mismo error a las
 * conductas de cambio —también altas— con otras palabras. La validación de niveles
 * no ve ninguno de los dos casos porque no citan la dimensión junto a un nivel.
 * Acotar de dónde puede elegir es más difícil de eludir que enumerar qué no hacer.
 */
function dimensionesConBrecha(perfil) {
  var candidatas = perfil.dimensiones.filter(function (d) {
    return d.invertida ? d.nivel === 'Alto' : d.nivel !== 'Alto';
  });
  // Los rasgos de personalidad fuera del promedio también pueden sostener una
  // brecha; el neuroticismo alto es el caso típico.
  perfil.neo.forEach(function (d) {
    if (d.nivel !== 'Promedio') candidatas.push(d);
  });
  return candidatas;
}

/** Los nombres solamente, para validar lo que el modelo declara. */
function nombresConBrecha(perfil) {
  return dimensionesConBrecha(perfil).map(function (d) { return d.dimension; });
}

function brechasDisponibles(perfil) {
  var lineas = dimensionesConBrecha(perfil).map(function (d) {
    return d.dimension + (d.invertida
      ? ' (acá el nivel alto ES la brecha)'
      : ' (nivel ' + d.nivel + ')');
  });
  return lineas.length ? '  - ' + lineas.join('\n  - ') : '  (el perfil no muestra brechas)';
}

/** Los datos del perfil, tal como los ve el modelo. Iguales en los dos bloques. */
function datosDelPerfil(nombre, perfil) {
  var lineas = perfil.dimensiones.map(function (d) {
    // Ni el instrumento, ni la expresión "escala invertida", ni ningún número:
    // el modelo copia el vocabulario del input. Medido, repetía "escala
    // invertida" y "NEO-FFI" dentro de la prosa que lee la persona evaluada. La
    // forma más confiable de que no lo escriba es no escribírselo.
    var texto = '- ' + d.dimension + ': nivel ' + d.nivel;
    if (d.invertida) {
      texto += ' — en esta dimensión un nivel más alto significa MAYOR tendencia'
        + ' a la no-intervención, que es lo indeseable';
    }
    if (d.esperaAlto) texto += ' — en este rol se espera un nivel alto';
    return texto;
  });

  var lineasNeo = perfil.neo.map(function (d) {
    return '- ' + d.dimension + ': nivel ' + d.nivel + '. ' + d.descripcion;
  });

  return [
    'PERSONA EVALUADA: ' + nombre,
    '',
    'NIVEL POR DIMENSIÓN DE LIDERAZGO (Alto, Medio o Bajo):',
    lineas.join('\n'),
    '',
    'RASGOS DE PERSONALIDAD (Muy Alto, Alto, Promedio, Bajo o Muy Bajo):',
    lineasNeo.join('\n'),
    '',
    'ORDEN RELATIVO DENTRO DEL PERFIL. Varias dimensiones comparten el mismo',
    'nivel, así que este orden te dice cuáles pesan más y cuáles menos. Usalo para',
    'elegir de qué hablar y para encontrar tensiones, sin mencionarlo como ranking.',
    'Las más prominentes, de mayor a menor: ' + perfil.destacadas.masAltas.join(', ') + '.',
    'Las menos prominentes, de menor a mayor: ' + perfil.destacadas.masBajas.join(', ') + '.',
    '',
    // La lista de arriba está por instrumento; ésta agrupa por nivel. Es la misma
    // información dos veces a propósito: el modelo confundía "Liderazgo Orientado
    // a Metas" (Alto) con "Conductas Orientadas a la Tarea" (Medio) —tres
    // dimensiones arrancan con "Orientad-"— y afirmaba el nivel equivocado en tres
    // corridas seguidas. Agrupar por nivel hace mucho más difícil equivocarse.
    'EL MISMO PERFIL AGRUPADO POR NIVEL. Antes de decir que algo es alto, medio o',
    'bajo, verificá acá. Hay dimensiones con nombres parecidos que están en niveles',
    'distintos: no las mezcles.',
    agrupadoPorNivel(perfil)
  ].join('\n');
}

/** Reglas que valen para los dos bloques. Se escriben una sola vez para que no
 *  se desincronicen: si un bloque olvidara una, el modelo la incumpliría solo ahí. */
function reglasComunes() {
  return [
    'Sos psicólogo/a laboral especializado/a en evaluación de liderazgo. Redactás la',
    'síntesis de devolución que se le entrega a la persona evaluada y se archiva en su legajo.',
    '',
    'REGLAS QUE NO SE NEGOCIAN:',
    '1. PROHIBIDO escribir números, puntajes o percentiles. Ni "P75", ni "T=64", ni',
    '   "percentil 90", ni "puntaje", ni la palabra "percentil". Esta devolución se',
    '   lee sin tecnicismos: hablá de NIVELES con las palabras que te damos —alto,',
    '   medio, bajo, promedio— y de conductas concretas. Ejemplo de lo que se',
    '   espera: "muestra un nivel alto de consideración individualizada", nunca',
    '   "obtuvo P99 en consideración individualizada".',
    '2. No supongas nada que los instrumentos no midieron: ni la madurez del equipo,',
    '   ni el tamaño del área, ni las herramientas de la empresa, ni resultados de',
    '   negocio.',
    '3. Si una afirmación no se apoya en un dato, no la escribas.',
    '4. Escribí en español rioplatense profesional, en tercera persona, sin tutear a',
    '   la persona evaluada y sin suponer su género: usá el nombre o construcciones',
    '   neutras. Tono descriptivo y respetuoso, nunca lapidario. Todo en castellano:',
    '   ni una palabra en inglés (escribí "cuestionar", no "challenger"). Revisá la',
    '   concordancia de los verbos antes de cerrar cada oración.',
    '5. Nada de jerga técnica. La persona evaluada lee este texto: no escribas',
    '   "escala invertida", "percentil válido", "referencia orientativa" ni las',
    '   siglas de los cuestionarios usados. Nombrá las dimensiones por su nombre y',
    '   nada más. Decilo en castellano llano: en Laissez-Faire, un valor alto',
    '   significa mayor tendencia a la no-intervención, y así hay que redactarlo.',
    '',
    'CÓMO LEER LA MOTIVACIÓN PARA LIDERAR: las tres motivaciones (intrínseca,',
    'extrínseca, social-normativa) son un perfil, no un ranking. Un valor bajo en',
    'extrínseca o social-normativa NO es un déficit: indica que el interés por el rol',
    'no pasa por la recompensa externa ni por el deber, lo cual suele ser deseable.',
    'PROHIBIDO presentarlas como un problema o como algo a desarrollar.',
    '',
    'CÓMO SE ESCRIBE (esto es lo que separa una devolución útil de una lista de',
    'rótulos). El nivel es el fundamento, no el contenido: nombralo si hace falta,',
    'pero lo que tiene que leerse es QUÉ HACE la persona, en conducta observable.',
    '  MAL: "Muestra un nivel alto en Consideración Individualizada, lo que indica',
    '       una fuerte capacidad para atender las necesidades individuales."',
    '  BIEN: "Escucha a cada colaborador, entiende sus necesidades particulares y',
    '        los involucra en las decisiones del área."',
    'No arranques los textos con "Muestra un nivel…" ni "Presenta un nivel…" ni',
    '"Con un nivel…". No repitas el nombre técnico de la dimensión como si fuera la',
    'explicación: traducilo a lo que se ve en el día a día del rol.',
    '',
    'Los títulos nombran un concepto, no una dimensión del cuestionario:',
    '"Acompañamiento e Inclusión", "Clima Colaborativo", "Inacción ante el',
    'conflicto" — no "Alta Consideración Individualizada".',
    '',
    'Devolvé EXCLUSIVAMENTE un objeto JSON válido, sin texto alrededor y sin bloques',
    'de código markdown.'
  ];
}

/**
 * Mensajes del primer bloque: resumen, fortalezas y áreas de desarrollo.
 * Función pura y separada del fetch a propósito: el prompt es la parte que más
 * se ajusta y tiene que poder revisarse en un test sin gastar una llamada.
 */
function mensajesBloqueDescriptivo(nombre, perfil) {
  var instrucciones = reglasComunes().concat([
    '',
    'Esta es la PRIMERA de dos partes. Acá va la lectura descriptiva del perfil.',
    'No escribas todavía inferencias, recomendaciones ni acciones: eso va en la',
    'segunda parte y se pide aparte.',
    '',
    'Forma exacta de la respuesta:',
    '{',
    '  "resumenGeneral": "...",',
    '  "fortalezas":      [{"titulo": "...", "texto": "..."}],',
    '  "areasDesarrollo": [{"dimension": "...", "titulo": "...", "texto": "..."}]',
    '}',
    '',
    'En cada área de desarrollo, "dimension" es el nombre EXACTO, copiado tal cual,',
    'de la dimensión de la lista de abajo en la que se apoya esa brecha. No se',
    'imprime en el informe: sirve para verificar que la brecha exista en el dato.',
    'Si no podés copiar un nombre de esa lista, entonces esa brecha no existe.',
    '',
    'El "resumenGeneral" retrata a la persona, no enumera dimensiones. Tiene que',
    'poder leerse como la descripción de alguien: cómo conduce, en qué se apoya y',
    'dónde se le nota la falta. Un ejemplo del tono buscado: "Presenta un perfil con',
    'clara orientación hacia las personas, el bienestar del equipo y la',
    'participación activa. Muestra predisposición para construir vínculos de',
    'confianza y un estilo integrador. Sin embargo, evidencia fragilidad en las',
    'conductas ligadas a estructurar el trabajo, fijar límites y hacer seguimiento."',
    'Fijate que no nombra ni una dimensión del cuestionario: describe a la persona.',
    '',
    'LARGO EXACTO:',
    '- resumenGeneral: 3 o 4 oraciones.',
    '- fortalezas: 3 elementos, "texto" de 1 o 2 oraciones de conducta observable.',
    '- areasDesarrollo: 3 elementos, "texto" de 1 o 2 oraciones de conducta',
    '  observable: qué le cuesta hacer, no qué dimensión tiene baja.',
    'Títulos de 3 a 6 palabras, sin números adentro.',
    '',
    'En "areasDesarrollo" van brechas reales sostenidas por el dato. Está PROHIBIDO',
    'incluir ahí la motivación extrínseca o la social-normativa.',
    '',
    '',
    'LAS ÚNICAS BRECHAS QUE PODÉS USAR son éstas. No hay otras: todo lo que no',
    'figure en esta lista está en nivel alto y es una fortaleza de esta persona.',
    brechasDisponibles(perfil),
    'Elegí tres de ahí. Está prohibido presentar como carencia algo que no esté en',
    'esa lista, ni directamente, ni con otras palabras, ni cambiándole el nombre.',
    'Concretamente: si la orientación a metas o las conductas de cambio no aparecen',
    'arriba, entonces NO escribas que descuida los objetivos, ni que prioriza el',
    'consenso sobre la innovación, ni nada equivalente. El dato dice lo contrario.'
  ]).join('\n');

  return [
    { role: 'system', content: LLM_SISTEMA_THINKING + '\n\n' + instrucciones },
    { role: 'user', content: datosDelPerfil(nombre, perfil) }
  ];
}

/**
 * Mensajes del segundo bloque: inferencias, recomendaciones y vacíos por definir.
 *
 * @param {Object} previo lo que devolvió el primer bloque, o null. Se le pasan
 *   los títulos para que no repita lo ya dicho.
 */
function mensajesBloqueAnalitico(nombre, perfil, previo) {
  var ejesPendientes = [
    'la madurez y el grado de autonomía del equipo que conduce hoy',
    'los estándares de desempeño con los que el área mide el cumplimiento',
    'las herramientas corporativas formales de gestión de desempeño, reconocimiento o seguimiento'
  ];

  var instrucciones = reglasComunes().concat([
    '',
    'Esta es la SEGUNDA de dos partes. La lectura descriptiva del perfil ya se',
    'redactó; acá va el análisis. No repitas la descripción: cruzá los datos.',
    '',
    'LO MÁS IMPORTANTE — "inferencias": ahí va el valor real de la síntesis. Buscá',
    'tensiones ENTRE dimensiones que, leídas juntas, dicen algo que ninguna dice por',
    'separado. Priorizá, en este orden, las que el dato sostenga:',
    '  a. Estilo relacional muy alto (consideración, participación, relaciones)',
    '     conviviendo con no-intervención alta: sugiere presencia fuerte en el plano',
    '     afectivo y ausencia en el operativo, cuando aparece la fricción.',
    '  b. Un total alto sostenido por una sola subescala mientras las otras quedan en',
    '     la media: el rótulo global describe peor a la persona que sus componentes.',
    '  c. Rasgo de personalidad alto sin las conductas correspondientes observadas,',
    '     o al revés.',
    'Nombrá las dimensiones y el nivel de cada una para que se entienda de dónde',
    'sale la tensión, y explicá qué implica para el ejercicio del rol. Escribí solo',
    'las que el dato sostenga y no fuerces una tensión donde el perfil no la muestra.',
    '',
    'En "recomendaciones" NO van consejos generales. Cada una es una PRÁCTICA con',
    'nombre propio, como si fuera un instrumento que la persona va a implementar, y',
    'la acción dice su mecánica: qué se define, cada cuánto, y qué se evita. Así:',
    '  título:   "Matriz de Claridad Operativa y Expectativas"',
    '  contexto: "Equipos con madurez baja o media: personas en aprendizaje, con',
    '             poca autonomía o en roles nuevos."',
    '  acción:   "Establecer acuerdos explícitos al inicio de cada proyecto o ciclo,',
    '             definiendo el resultado esperado, el nivel de autonomía otorgado y',
    '             los puntos de control intermedios obligatorios."',
    'Otro: "Protocolo de Conversaciones de Feedback Correctivo" → "Abordar los',
    'desvíos dentro de un plazo cercano, sobre hechos objetivos y sin juicios de',
    'valor, explicitando el impacto y acordando compromisos de ajuste."',
    'Nada de "implementar reuniones periódicas de seguimiento" ni "promover espacios',
    'de discusión": eso no le dice a nadie qué hacer el lunes.',
    '',
    'El "contexto" tiene que discriminar según la MADUREZ del equipo (baja, media o',
    'alta autonomía) o una situación puntual, no valer para cualquiera.',
    '',
    'QUÉ VA EN "pendienteDefinir": únicamente vacíos de contexto organizacional que',
    'la evaluación no midió y que hacen falta para aterrizar las recomendaciones.',
    'Elegí dos de estos ejes y redactalos como algo a relevar con la organización:',
    ejesPendientes.map(function (e) { return '  - ' + e + '.'; }).join('\n'),
    'No pongas ahí "seguir explorando la personalidad" ni nada que la evaluación ya',
    'haya medido.',
    '',
    'Forma exacta de la respuesta:',
    '{',
    '  "inferencias":      [{"titulo": "...", "texto": "..."}],',
    '  "recomendaciones":  [{"titulo": "...", "contexto": "...", "accion": "..."}],',
    '  "pendienteDefinir": [{"titulo": "...", "texto": "..."}]',
    '}',
    '',
    'LARGO EXACTO:',
    '- inferencias: 3 elementos, "texto" de 2 o 3 oraciones — es la parte que más',
    '  importa, dedicale la precisión. Si el perfil sólo sostiene 2, poné 2.',
    '- recomendaciones: 3 elementos, "contexto" de 1 oración y "accion" de 1 o 2.',
    '- pendienteDefinir: 2 elementos, "texto" de 1 oración.',
    'Títulos de 3 a 7 palabras, sin números adentro.'
  ]);

  var datos = datosDelPerfil(nombre, perfil);
  if (previo) {
    var titulos = []
      .concat((previo.fortalezas || []).map(function (f) { return f.titulo; }))
      .concat((previo.areasDesarrollo || []).map(function (a) { return a.titulo; }));
    if (titulos.length) {
      datos += '\n\nYA SE ESCRIBIÓ, en la parte descriptiva, sobre estos puntos. No los'
        + ' repitas: usalos como base para cruzar los datos.\n'
        + titulos.map(function (t) { return '- ' + t; }).join('\n');
    }
  }

  return [
    { role: 'system', content: LLM_SISTEMA_THINKING + '\n\n' + instrucciones },
    { role: 'user', content: datos }
  ];
}

// ═══════════════════════════════════════════════════════════════════
// Validaciones
// ═══════════════════════════════════════════════════════════════════

/** Estructura: que estén los campos y que no vengan vacíos. */
function validarEstructura(datos, listas, exigirResumen) {
  if (!datos || typeof datos !== 'object') {
    return { ok: false, motivo: 'la respuesta no es un objeto' };
  }
  if (exigirResumen && (typeof datos.resumenGeneral !== 'string' || !datos.resumenGeneral.trim())) {
    return { ok: false, motivo: 'falta resumenGeneral' };
  }
  for (var i = 0; i < listas.length; i++) {
    var lista = listas[i];
    var items = datos[lista];
    if (!Array.isArray(items) || !items.length) {
      return { ok: false, motivo: 'falta la lista ' + lista + ' o vino vacía' };
    }
    var campos = SINTESIS_LISTAS[lista];
    for (var j = 0; j < items.length; j++) {
      for (var k = 0; k < campos.length; k++) {
        if (typeof items[j][campos[k]] !== 'string' || !items[j][campos[k]].trim()) {
          return { ok: false, motivo: lista + '[' + j + '] no tiene ' + campos[k] };
        }
      }
    }
  }
  return { ok: true, motivo: '' };
}

/**
 * Contenido: jerga técnica y puntajes.
 *
 * Se valida además de pedirlo en el prompt porque, medido, el modelo lo escribía
 * igual: una instrucción no es una garantía, una verificación sí. Ya pasó dos
 * veces —"escala invertida" y "NEO-FFI"— y las dos las atajó esta función.
 *
 * El PO pidió que el punto 5 no mencione valores, así que la regla es la más
 * simple posible: ningún puntaje, de ningún tipo. Antes se verificaba que los
 * números citados existieran en el perfil; ahora directamente no puede haberlos,
 * lo que además elimina la clase entera de errores por número mal citado.
 * Los valores siguen estando en las secciones 1 a 4 del informe, que son las que
 * sostienen la trazabilidad; el punto 5 es la devolución.
 */
function validarContenido(texto, perfil) {
  for (var i = 0; i < SINTESIS_JERGA_PROHIBIDA.length; i++) {
    var jerga = SINTESIS_JERGA_PROHIBIDA[i];
    if (texto.toLowerCase().indexOf(jerga.toLowerCase()) >= 0) {
      return { ok: false, motivo: 'usa jerga técnica ("' + jerga + '") en el texto del informe' };
    }
  }

  var percentiles = percentilesCitados(texto);
  if (percentiles.length) {
    return { ok: false, motivo: 'menciona el puntaje P' + percentiles[0] + ', y la devolución no lleva números' };
  }

  var tes = puntajesTCitados(texto);
  if (tes.length) {
    return { ok: false, motivo: 'menciona el puntaje T=' + tes[0] + ', y la devolución no lleva números' };
  }

  return { ok: true, motivo: '' };
}

/**
 * Palabras con las que el texto puede nombrar un nivel, de la más larga a la más
 * corta para que "muy alto" no se confunda con "alto".
 *
 * "medio" y "promedio" cuentan como lo mismo: las dimensiones de liderazgo usan
 * Medio y las de personalidad Promedio, y para el lector son el mismo nivel.
 */
// Un nivel atribuido a dimensiones: "nivel alto en X", "niveles medios de X e Y".
// Se exige el conector (en/de/para) a propósito: es lo que ata el nivel a lo que
// viene después. Sin él, "Inspiración muestra un nivel alto, la Estimulación
// Intelectual se encuentra en nivel medio" haría que "alto" se le pegara a
// Estimulación —la oración es correcta y el rechazo era falso—.
var SINTESIS_NIVEL_ATRIBUIDO = new RegExp(
  'nivel(?:es)?\\s+(muy\\s+alt[oa]s?|muy\\s+baj[oa]s?|alt[oa]s?|baj[oa]s?|promedios?|medi[oa]s?)'
  + '\\s+(?:en|de|para)\\s+',
  'gi'
);

/** Dónde empieza el próximo nivel declarado, para cortar el alcance del actual. */
var SINTESIS_CUALQUIER_NIVEL = /nivel(?:es)?\s+(?:muy\s+)?(?:alt|baj|medi|promedi)/gi;

// Dónde termina la enumeración y empieza otra cláusula. Sin esto el alcance de un
// nivel se come la dimensión de la cláusula siguiente: en "nivel alto en
// Inspiración, su Carisma se encuentra en nivel medio" —que es correcto— el
// "alto" le caía también a Carisma. Ojo con " y ": une una lista, no la corta.
var SINTESIS_CORTE_DE_CLAUSULA = new RegExp(
  ',\\s*(?:su|sus|pero|aunque|mientras|si\\s+bien|en\\s+cambio|lo\\s+que|esto|y\\s+su)\\b'
  + '|\\s(?:pero|aunque|mientras|en\\s+cambio|si\\s+bien|frente\\s+a|contrasta)\\b',
  'i'
);

/** Lleva cualquier forma de nombrar un nivel a una etiqueta comparable.
 *  "Medio" y "Promedio" cuentan como el mismo nivel: las dimensiones de liderazgo
 *  usan Medio y las de personalidad Promedio, y para el lector son lo mismo. */
function nivelNormalizado(texto) {
  var t = String(texto).toLowerCase();
  if (/muy\s*alt/.test(t)) return 'MUY ALTO';
  if (/muy\s*baj/.test(t)) return 'MUY BAJO';
  if (/alt/.test(t)) return 'ALTO';
  if (/baj/.test(t)) return 'BAJO';
  return 'MEDIO';
}

/**
 * Que el nivel que el texto le atribuye a una dimensión sea el que tiene.
 *
 * Hace falta porque pasó dos veces en informes reales: el modelo escribió "un
 * nivel medio en Conductas Orientadas a la Tarea y Liderazgo Orientado a Metas" y
 * "el nivel medio en Liderazgo Orientado a Metas" cuando esa dimensión estaba en
 * Alto. El error no cita números ni usa jerga, así que ninguna otra validación lo
 * veía, y encima contradecía a la sección 3 del mismo informe: es exactamente la
 * inconsistencia entre secciones que el PO señaló en HU2.
 *
 * Sólo se revisa la construcción "nivel X en/de <dimensiones>", que es la que
 * ata sin ambigüedad un nivel a las dimensiones que lo siguen. Las otras formas
 * ("X muestra un nivel alto") se dejan pasar: distinguirlas exigiría analizar
 * sintaxis, y un rechazo falso cuesta una llamada al modelo y puede terminar en
 * la síntesis pobre. Vale más dejar pasar un error raro que rechazar texto bueno.
 */
function validarNivelesCoherentes(texto, perfil) {
  var dimensiones = perfil.dimensiones.map(function (d) {
    return { nombre: d.dimension, nivel: nivelNormalizado(d.nivel) };
  }).concat(perfil.neo.map(function (d) {
    return { nombre: d.dimension, nivel: nivelNormalizado(d.nivel) };
  }));

  var oraciones = String(texto).split(/[.;\n]+/);
  for (var i = 0; i < oraciones.length; i++) {
    var oracion = oraciones[i];

    // Dónde arranca cada nivel declarado, para saber hasta dónde llega el alcance
    // del anterior.
    var cortes = [];
    SINTESIS_CUALQUIER_NIVEL.lastIndex = 0;
    var c;
    while ((c = SINTESIS_CUALQUIER_NIVEL.exec(oracion)) !== null) cortes.push(c.index);

    SINTESIS_NIVEL_ATRIBUIDO.lastIndex = 0;
    var m;
    while ((m = SINTESIS_NIVEL_ATRIBUIDO.exec(oracion)) !== null) {
      var declarado = nivelNormalizado(m[1]);
      var desde = m.index + m[0].length;
      var hasta = oracion.length;
      for (var k = 0; k < cortes.length; k++) {
        if (cortes[k] >= desde) { hasta = cortes[k]; break; }
      }
      var alcance = oracion.slice(desde, hasta);
      // El nivel alcanza hasta donde termina su enumeración, no hasta la próxima
      // dimensión: la de la cláusula siguiente tiene su propio nivel.
      var corte = alcance.search(SINTESIS_CORTE_DE_CLAUSULA);
      if (corte >= 0) alcance = alcance.slice(0, corte);

      for (var j = 0; j < dimensiones.length; j++) {
        var dim = dimensiones[j];
        if (alcance.indexOf(dim.nombre) < 0) continue;
        if (dim.nivel !== declarado) {
          return {
            ok: false,
            motivo: 'le atribuye nivel ' + declarado.toLowerCase() + ' a "' + dim.nombre
              + '", que está en ' + dim.nivel.toLowerCase()
          };
        }
      }
    }
  }
  return { ok: true, motivo: '' };
}

/**
 * Que cada área de desarrollo declare una dimensión que realmente tenga brecha.
 *
 * Es la única defensa que funcionó contra un error que el modelo repitió en tres
 * corridas: presentar como carencia una dimensión que está en nivel alto, sin
 * nombrarla y con otras palabras. "Prioriza el bienestar relacional sobre el logro
 * de metas concretas" con la orientación a metas en alto; y cuando se le prohibió
 * esa, "priorizar el consenso sobre la innovación" con las conductas de cambio,
 * también altas. Ninguna validación de texto lo ve, porque no hay dimensión ni
 * nivel citados: es una paráfrasis.
 *
 * Pedirle que declare de dónde sale la brecha convierte el problema en algo
 * verificable. El campo no se imprime en el informe.
 */
function validarBrechasDeclaradas(areasDesarrollo, perfil) {
  var permitidas = nombresConBrecha(perfil);
  for (var i = 0; i < (areasDesarrollo || []).length; i++) {
    var declarada = areasDesarrollo[i].dimension;
    if (permitidas.indexOf(declarada) < 0) {
      return {
        ok: false,
        motivo: 'presenta "' + declarada + '" como área de desarrollo, y esa dimensión'
          + ' no tiene brecha en este perfil'
      };
    }
  }
  return { ok: true, motivo: '' };
}

/**
 * La motivación extrínseca y la social-normativa bajas no son una brecha: si
 * aparecen como área de desarrollo, la lectura psicométrica está mal.
 */
function validarLecturaMotivacion(areasDesarrollo) {
  var texto = (areasDesarrollo || []).map(function (a) {
    return a.titulo + ' ' + a.texto;
  }).join(' ').toLowerCase();
  if (/extr[íi]nseca|social-?normativa/.test(texto)) {
    return { ok: false, motivo: 'presenta la motivación extrínseca o social-normativa como área de desarrollo' };
  }
  return { ok: true, motivo: '' };
}

/** Valida un bloque suelto, tal como vuelve de la API. */
function validarBloque(bloque, datos, perfil) {
  var estructura = validarEstructura(datos, bloque.listas, bloque.resumen);
  if (!estructura.ok) return estructura;

  var texto = textoDeSintesis(datos);
  var contenido = validarContenido(texto, perfil);
  if (!contenido.ok) return contenido;

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

/**
 * Valida la síntesis completa, ya unida. Es la última puerta antes del informe.
 *
 * @return {Object} {ok: boolean, motivo: string}
 */
function validarSintesis(sintesis, perfil) {
  var todasLasListas = SINTESIS_BLOQUE_DESCRIPTIVO.listas.concat(SINTESIS_BLOQUE_ANALITICO.listas);
  var estructura = validarEstructura(sintesis, todasLasListas, true);
  if (!estructura.ok) return estructura;

  var texto = textoDeSintesis(sintesis);
  var contenido = validarContenido(texto, perfil);
  if (!contenido.ok) return contenido;

  var niveles = validarNivelesCoherentes(texto, perfil);
  if (!niveles.ok) return niveles;

  var motivacion = validarLecturaMotivacion(sintesis.areasDesarrollo);
  if (!motivacion.ok) return motivacion;

  return validarBrechasDeclaradas(sintesis.areasDesarrollo, perfil);
}

/** Todo el texto de una síntesis o de un bloque, para revisar jerga y citas. */
function textoDeSintesis(datos) {
  var partes = [datos.resumenGeneral];
  for (var lista in SINTESIS_LISTAS) {
    if (!Object.prototype.hasOwnProperty.call(SINTESIS_LISTAS, lista)) continue;
    (datos[lista] || []).forEach(function (item) {
      partes.push(item.titulo, item.texto, item.contexto, item.accion);
    });
  }
  return partes.filter(function (p) { return typeof p === 'string'; }).join(' \n ');
}

function percentilesCitados(texto) {
  var encontrados = [];
  var re = /\bP(\d{1,2})\b/g;
  var m;
  while ((m = re.exec(texto)) !== null) encontrados.push(Number(m[1]));
  return encontrados;
}

function puntajesTCitados(texto) {
  var encontrados = [];
  var re = /\bT\s*=\s*(\d{1,3})\b/g;
  var m;
  while ((m = re.exec(texto)) !== null) encontrados.push(Number(m[1]));
  return encontrados;
}

/**
 * Extrae el JSON de la respuesta del modelo.
 * Aunque se le pide JSON pelado, a veces lo envuelve en ```json — en vez de
 * fallar por eso, se recorta desde la primera llave hasta la última.
 */
function jsonDeRespuesta(contenido) {
  if (!contenido) return null;
  var desde = contenido.indexOf('{');
  var hasta = contenido.lastIndexOf('}');
  if (desde < 0 || hasta <= desde) return null;
  try {
    return JSON.parse(contenido.slice(desde, hasta + 1));
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Las llamadas
// ═══════════════════════════════════════════════════════════════════

/**
 * Pide un bloque y lo valida.
 *
 * @param {Object} bloque SINTESIS_BLOQUE_DESCRIPTIVO o SINTESIS_BLOQUE_ANALITICO
 * @return {Object} {datos: Object|null, motivo: string} — el motivo viaja hasta
 *   la interfaz cuando el bloque falla, así el fallback deja de ser silencioso.
 */
function pedirBloque(bloque, mensajes, perfil, clave, modelo) {
  var ultimoMotivo = '';

  for (var intento = 1; intento <= LLM_INTENTOS; intento++) {
    try {
      var respuesta = UrlFetchApp.fetch(LLM_URL, {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + clave },
        payload: JSON.stringify({
          model: modelo,
          messages: mensajes,
          temperature: LLM_TEMPERATURA,
          top_p: LLM_TOP_P,
          max_tokens: LLM_MAX_TOKENS,
          stream: false
        }),
        muteHttpExceptions: true
      });

      var codigo = respuesta.getResponseCode();
      if (codigo !== 200) {
        ultimoMotivo = 'la API respondió ' + codigo + ': ' + respuesta.getContentText().slice(0, 300);
        continue;
      }

      var cuerpo = JSON.parse(respuesta.getContentText());
      var eleccion = cuerpo.choices && cuerpo.choices[0];
      var datos = jsonDeRespuesta(eleccion && eleccion.message && eleccion.message.content);
      if (!datos) {
        ultimoMotivo = 'la respuesta no traía JSON interpretable';
        continue;
      }

      var revision = validarBloque(bloque, datos, perfil);
      if (!revision.ok) {
        ultimoMotivo = revision.motivo;
        continue;
      }
      return { datos: datos, motivo: '' };
    } catch (e) {
      // Acá caen los cortes por tiempo de UrlFetchApp. Con la llamada única no
      // valía la pena reintentar: tardaba 45-72 s y el reintento chocaba contra
      // el mismo límite. Partido en bloques, un bloque tarda ~25 s, así que un
      // corte es casi siempre un atasco puntual de la cola del servicio —medido:
      // un bloque de 693 tokens que normalmente sale en 25 s tardó 77 s— y el
      // reintento tiene buenas chances de salir a velocidad normal.
      ultimoMotivo = 'la llamada se interrumpió: ' + e.message;
      console.warn('El bloque ' + bloque.clave + ' se interrumpió (' + e.message + '). Se reintenta.');
    }
  }

  console.warn('No se pudo obtener el bloque ' + bloque.clave + ' de la síntesis ('
    + LLM_INTENTOS + ' intentos). Último motivo: ' + ultimoMotivo + '.');
  return { datos: null, motivo: 'bloque ' + bloque.clave + ': ' + ultimoMotivo };
}

/**
 * Pide la síntesis al LLM, en dos llamadas. Devuelve null si no se pudo obtener
 * una válida y completa.
 *
 * No lanza: el informe tiene que generarse igual. El motivo del fallo queda en
 * el log para poder diagnosticarlo después.
 *
 * Si un bloque falla se descarta la síntesis entera y sale la determinista. Es a
 * propósito: mezclar prosa del modelo con prosa fija en la misma sección deja
 * dos voces y habilita justamente las contradicciones que el PO señaló en HU2.
 *
 * @param {string} nombre
 * @param {Object} resultados salida de corregir()
 * @param {Function} [avisar] recibe 0 o 1 al arrancar cada bloque, para que la
 *   interfaz pueda mostrar por cuál va. Opcional: sin él todo funciona igual.
 * @return {Object} {sintesis: Object|null, motivo: string}. El motivo se devuelve
 *   —y no sólo se loguea— porque un fallback silencioso obliga a adivinar por qué
 *   el informe salió con el texto pobre. Va hasta la interfaz.
 */
function sintesisDeLiderazgo(nombre, resultados, avisar) {
  var anunciar = function (bloque) {
    if (typeof avisar === 'function') avisar(bloque);
  };
  var propiedades = PropertiesService.getScriptProperties();
  var clave = propiedades.getProperty(PROP_LLM_API_KEY);
  if (!clave) {
    var sinClave = 'falta la propiedad ' + PROP_LLM_API_KEY + ' en Propiedades del script';
    console.warn('Sin ' + PROP_LLM_API_KEY + ': la síntesis del punto 5 sale con el texto determinista.');
    return { sintesis: null, motivo: sinClave };
  }
  var modelo = propiedades.getProperty(PROP_LLM_MODELO) || LLM_MODELO_POR_DEFECTO;
  var perfil = perfilParaSintesis(resultados);

  anunciar(0);
  var descriptivo = pedirBloque(
    SINTESIS_BLOQUE_DESCRIPTIVO,
    mensajesBloqueDescriptivo(nombre, perfil),
    perfil, clave, modelo
  );
  if (!descriptivo.datos) return { sintesis: null, motivo: descriptivo.motivo };

  anunciar(1);
  var analitico = pedirBloque(
    SINTESIS_BLOQUE_ANALITICO,
    mensajesBloqueAnalitico(nombre, perfil, descriptivo.datos),
    perfil, clave, modelo
  );
  if (!analitico.datos) return { sintesis: null, motivo: analitico.motivo };

  var sintesis = {
    resumenGeneral: descriptivo.datos.resumenGeneral,
    fortalezas: descriptivo.datos.fortalezas,
    areasDesarrollo: descriptivo.datos.areasDesarrollo,
    inferencias: analitico.datos.inferencias,
    recomendaciones: analitico.datos.recomendaciones,
    pendienteDefinir: analitico.datos.pendienteDefinir
  };

  // Los bloques se validaron por separado; esta es la revisión de la pieza unida,
  // que es la que efectivamente va al informe.
  var revision = validarSintesis(sintesis, perfil);
  if (!revision.ok) {
    console.warn('La síntesis unida no validó (' + revision.motivo + '). Sale la determinista.');
    return { sintesis: null, motivo: 'la síntesis unida no validó: ' + revision.motivo };
  }

  sintesis.modelo = modelo;
  return { sintesis: sintesis, motivo: '' };
}
