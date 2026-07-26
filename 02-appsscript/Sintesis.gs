/**
 * Síntesis narrativa del punto 5 del informe, redactada por un LLM.
 *
 * Por qué un LLM acá y no una tabla de reglas: lo que pide el PO en
 * `Informe-MA.docx` no es una lista de dimensiones por encima de un umbral —eso
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
  areasDesarrollo: ['titulo', 'texto'],
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
    'Las menos prominentes, de menor a mayor: ' + perfil.destacadas.masBajas.join(', ') + '.'
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
    '   neutras. Tono descriptivo y respetuoso, nunca lapidario.',
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
    '  "areasDesarrollo": [{"titulo": "...", "texto": "..."}]',
    '}',
    '',
    'LARGO EXACTO:',
    '- resumenGeneral: 3 o 4 oraciones, nombrando las dimensiones y su nivel.',
    '- fortalezas: 3 elementos, "texto" de 1 o 2 oraciones.',
    '- areasDesarrollo: 3 elementos, "texto" de 1 o 2 oraciones.',
    'Títulos de 3 a 6 palabras, sin números adentro.',
    '',
    'En "areasDesarrollo" van brechas reales sostenidas por el dato. Está PROHIBIDO',
    'incluir ahí la motivación extrínseca o la social-normativa.'
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
    'En "recomendaciones", cada acción tiene que declarar su contexto de aplicación',
    '(a qué tipo de equipo o situación aplica) y ser una conducta concreta y',
    'observable, no un consejo general.',
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
    '- inferencias: 2 elementos, "texto" de 2 o 3 oraciones — es la parte que más',
    '  importa, dedicale la precisión.',
    '- recomendaciones: 3 elementos, "contexto" de 1 oración y "accion" de 1 o 2.',
    '- pendienteDefinir: 2 elementos, "texto" de 1 oración.',
    'Títulos de 3 a 6 palabras, sin números adentro.'
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

  var contenido = validarContenido(textoDeSintesis(datos), perfil);
  if (!contenido.ok) return contenido;

  if (datos.areasDesarrollo) {
    var motivacion = validarLecturaMotivacion(datos.areasDesarrollo);
    if (!motivacion.ok) return motivacion;
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

  var contenido = validarContenido(textoDeSintesis(sintesis), perfil);
  if (!contenido.ok) return contenido;

  return validarLecturaMotivacion(sintesis.areasDesarrollo);
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
 * Pide un bloque y lo valida. Devuelve null si no se pudo obtener uno válido.
 *
 * @param {Object} bloque SINTESIS_BLOQUE_DESCRIPTIVO o SINTESIS_BLOQUE_ANALITICO
 * @return {Object|null}
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
      return datos;
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
  return null;
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
 * @return {Object|null} síntesis validada
 */
function sintesisDeLiderazgo(nombre, resultados, avisar) {
  var anunciar = function (bloque) {
    if (typeof avisar === 'function') avisar(bloque);
  };
  var propiedades = PropertiesService.getScriptProperties();
  var clave = propiedades.getProperty(PROP_LLM_API_KEY);
  if (!clave) {
    console.warn('Sin ' + PROP_LLM_API_KEY + ' en Propiedades del script: la síntesis del punto 5 sale con el texto determinista.');
    return null;
  }
  var modelo = propiedades.getProperty(PROP_LLM_MODELO) || LLM_MODELO_POR_DEFECTO;
  var perfil = perfilParaSintesis(resultados);

  anunciar(0);
  var descriptivo = pedirBloque(
    SINTESIS_BLOQUE_DESCRIPTIVO,
    mensajesBloqueDescriptivo(nombre, perfil),
    perfil, clave, modelo
  );
  if (!descriptivo) return null;

  anunciar(1);
  var analitico = pedirBloque(
    SINTESIS_BLOQUE_ANALITICO,
    mensajesBloqueAnalitico(nombre, perfil, descriptivo),
    perfil, clave, modelo
  );
  if (!analitico) return null;

  var sintesis = {
    resumenGeneral: descriptivo.resumenGeneral,
    fortalezas: descriptivo.fortalezas,
    areasDesarrollo: descriptivo.areasDesarrollo,
    inferencias: analitico.inferencias,
    recomendaciones: analitico.recomendaciones,
    pendienteDefinir: analitico.pendienteDefinir
  };

  // Los bloques se validaron por separado; esta es la revisión de la pieza unida,
  // que es la que efectivamente va al informe.
  var revision = validarSintesis(sintesis, perfil);
  if (!revision.ok) {
    console.warn('La síntesis unida no validó (' + revision.motivo + '). Sale la determinista.');
    return null;
  }

  sintesis.modelo = modelo;
  return sintesis;
}
