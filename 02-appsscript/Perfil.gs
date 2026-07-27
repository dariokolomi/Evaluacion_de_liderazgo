/**
 * Clasificación del perfil: qué estilo predomina y sobre qué eje.
 *
 * Existe porque el informe lo afirmaba sin mirar el dato. Decía "perfil de
 * liderazgo Transformacional predominante" y "configura un perfil de Líder
 * Relacional-Transformacional" en todos los informes, cualquiera fuera el
 * resultado, y "El estilo Directivo es el menos desarrollado" aunque no lo fuera.
 * Es el primer punto de HU1: prosa con números interpolados que parece derivada
 * del dato y no lo es.
 *
 * La clasificación se calcula y la narración se escribe alrededor. Separar las dos
 * cosas es lo que la hace verificable: una etiqueta es una regla de decisión sobre
 * tres números, que el PO puede revisar y firmar una vez, mientras que una frase
 * redactada no se puede comprobar.
 *
 * DOS DECISIONES QUE EL PO TIENE QUE CONFIRMAR, y por eso están acá arriba y no
 * enterradas en el código:
 *
 *   1. La predominancia se decide comparando las MEDIAS (escala 1 a 5), no los
 *      percentiles. "Predominante" es una lectura del propio perfil —cuál de los
 *      tres estilos ejerce más— y para eso sirve la media. El percentil contesta
 *      otra pregunta: en cuál se destaca más respecto de la población. El informe
 *      viejo imprimía los dos valores y afirmaba con el primero.
 *   2. Los márgenes de abajo son el mínimo para hablar de predominio. Sin margen,
 *      una diferencia de 0,02 se informaría como "predominante", que es precisión
 *      falsa. Los valores son un criterio razonable, NO una norma validada.
 */

// Diferencia mínima entre medias (escala 1-5) para llamar a un estilo predominante.
var MARGEN_PREDOMINANCIA = 0.30;

// Diferencia mínima en puntos de percentil para decir que un eje pesa más que otro.
var MARGEN_EJE = 15;

var ESTILOS_CELID = [
  { clave: 'TransfTot', nombre: 'Transformacional' },
  { clave: 'TransTot', nombre: 'Transaccional' },
  { clave: 'Laissez', nombre: 'Laissez-Faire' }
];

var ESTILOS_CAMIN = [
  { clave: 'Dir', nombre: 'Directivo' },
  { clave: 'Cons', nombre: 'Considerado' },
  { clave: 'Part', nombre: 'Participativo' },
  { clave: 'Or', nombre: 'Orientado a Metas' }
];

/**
 * @param {Object} resultados salida de corregir()
 * @return {Object} {estilos, predominante, mixto, eje, etiqueta, menosDesarrollado}
 *   - estilos: los tres de CELID ordenados de mayor a menor media
 *   - predominante: el primero, o null si ninguno saca ventaja suficiente
 *   - mixto: true cuando los dos primeros están dentro del margen
 *   - eje: 'Relacional' | 'Orientado a la Tarea' | 'Equilibrado'
 *   - etiqueta: cómo nombrar el perfil en el informe
 *   - menosDesarrollado: el estilo de CAMIN-A con el percentil más bajo
 */
function clasificarPerfil(resultados) {
  var medias = resultados.celid.valor;
  var pctCelid = resultados.celid.percentil;

  var estilos = ESTILOS_CELID.map(function (e) {
    return { nombre: e.nombre, media: medias[e.clave], percentil: pctCelid[e.clave] };
  }).sort(function (a, b) { return b.media - a.media; });

  // La diferencia se redondea antes de comparar: en punto flotante 4.8 - 4.5 da
  // 0.2999999999999998 y 4.5 - 4.2 da 0.30000000000000027, así que el mismo margen
  // caería de un lado o del otro según los valores. Redondeado, la regla es
  // determinista y se puede explicar.
  var ventaja = Math.round((estilos[0].media - estilos[1].media) * 100) / 100;
  var mixto = ventaja < MARGEN_PREDOMINANCIA;

  // El eje se decide con percentiles: son de instrumentos distintos y sólo la
  // referencia normativa los hace comparables entre sí.
  var cam = resultados.camin.percentil;
  var con = resultados.conlid.percentil;
  var relacional = promedio([cam.Cons, cam.Part, con.Rel]);
  var tarea = promedio([cam.Dir, con.Tar]);
  var eje = 'Equilibrado';
  if (relacional - tarea >= MARGEN_EJE) eje = 'Relacional';
  else if (tarea - relacional >= MARGEN_EJE) eje = 'Orientado a la Tarea';

  var menos = ESTILOS_CAMIN.map(function (e) {
    return { nombre: e.nombre, percentil: cam[e.clave] };
  }).sort(function (a, b) { return a.percentil - b.percentil; })[0];

  return {
    estilos: estilos,
    predominante: mixto ? null : estilos[0],
    mixto: mixto,
    eje: eje,
    etiqueta: etiquetaDePerfil(eje, mixto ? null : estilos[0]),
    menosDesarrollado: menos,
    ejeRelacional: relacional,
    ejeTarea: tarea
  };
}

/**
 * Cómo se nombra el perfil en el informe.
 * Sin estilo predominante no se inventa uno: se dice que es mixto, que es la
 * lectura honesta cuando los tres valores están cerca.
 */
function etiquetaDePerfil(eje, predominante) {
  if (!predominante) return 'Líder ' + eje + ', sin un estilo claramente predominante';
  if (eje === 'Equilibrado') return 'Líder ' + predominante.nombre;
  return 'Líder ' + eje + '-' + predominante.nombre;
}

function promedio(valores) {
  var suma = 0;
  for (var i = 0; i < valores.length; i++) suma += valores[i];
  return suma / valores.length;
}

/**
 * La primera frase de 2.2: qué estilo predomina y en qué orden quedan los tres.
 * Reemplaza a la que afirmaba "Transformacional predominante" siempre.
 */
function frasePerfilCelid(perfil) {
  if (perfil.mixto) {
    return 'La persona evaluada no muestra un estilo de liderazgo claramente '
      + 'predominante: ' + conValores(perfil.estilos[0]) + ', '
      + conValores(perfil.estilos[1]) + ' y ' + conValores(perfil.estilos[2])
      + ' quedan en valores cercanos entre sí.';
  }
  return 'La persona evaluada muestra un perfil de liderazgo '
    + perfil.estilos[0].nombre + ' predominante ('
    + perfil.estilos[0].media.toFixed(2) + ' / P' + perfil.estilos[0].percentil
    + '), seguido por ' + conValores(perfil.estilos[1])
    + ' y ' + conValores(perfil.estilos[2]) + '.';
}

/**
 * La frase del modelo situacional en la sección 3.
 * La versión anterior daba por sentado que el Considerado y el Participativo
 * estaban altos, que las Metas eran una buena disposición y que el Directivo era
 * el menos desarrollado. Ahora las tres cosas salen del dato.
 */
function fraseSituacional(perfil, cam) {
  var solventes = ESTILOS_CAMIN.filter(function (e) {
    return nivelPorPercentil(cam[e.clave]) === 'Alto';
  }).map(function (e) { return e.nombre; });

  var texto = 'En términos del modelo Situacional (Hersey & Blanchard) y Camino-Meta (House), ';
  texto += solventes.length
    ? 'maneja con solvencia ' + (solventes.length === 1 ? 'el estilo ' : 'los estilos ')
      + enumerar(solventes) + '. '
    : 'no muestra un estilo que domine con claridad por encima de la media. ';
  texto += 'El estilo ' + perfil.menosDesarrollado.nombre + ' (P'
    + perfil.menosDesarrollado.percentil + ') es el menos desarrollado y el área de '
    + 'mayor crecimiento potencial.';
  return texto;
}

// ═══════════════════════════════════════════════════════════════════
// Bloque 2.2 — las tres frases que repartían roles fijos entre las escalas
// ═══════════════════════════════════════════════════════════════════

/**
 * Las cuatro subescalas del Transformacional, cada una con su artículo.
 *
 * El artículo hace falta porque el reparto dejó de ser fijo: antes la frase estaba
 * escrita a mano con la Consideración Individualizada y la Inspiración siempre del
 * lado de las fortalezas y el Carisma y la Estimulación Intelectual siempre del
 * lado de las zonas de crecimiento. Ahora cualquiera de las cuatro puede caer en
 * cualquier grupo, y la frase tiene que seguir estando bien escrita en los 81
 * repartos posibles.
 */
var SUBESCALAS_TRANSF = [
  { clave: 'ConsInd', nombre: 'Consideración Individualizada', articulo: 'la' },
  { clave: 'Inspir', nombre: 'Inspiración', articulo: 'la' },
  { clave: 'Carisma', nombre: 'Carisma', articulo: 'el' },
  { clave: 'EstimInt', nombre: 'Estimulación Intelectual', articulo: 'la' }
];

/**
 * Reparte un grupo de escalas en altas / intermedias / bajas por su percentil, con
 * el mismo corte que ya usa el resto del informe (`nivelPorPercentil`, P75 y P25).
 *
 * El corte sale de ahí a propósito, y no de una constante nueva: los umbrales
 * oficiales son la pregunta 3 al PO y todavía no tienen respuesta. Cuando la
 * tengan se cambia en un solo lugar. Inventar acá una escala paralela sería crear
 * un vocabulario más para migrar después.
 */
function repartirPorNivel(escalas, percentiles, medias) {
  var grupos = { altas: [], intermedias: [], bajas: [] };
  escalas.forEach(function (e) {
    var p = percentiles[e.clave];
    var nivel = nivelPorPercentil(p);
    var destino = nivel === 'Alto' ? 'altas' : (nivel === 'Bajo' ? 'bajas' : 'intermedias');
    grupos[destino].push({
      nombre: e.nombre,
      articulo: e.articulo,
      percentil: p,
      media: medias ? medias[e.clave] : null
    });
  });
  return grupos;
}

/** "Carisma (4.20 / P80)", o "Carisma (P80)" si la escala no lleva media. */
function conValores(e) {
  return e.nombre + ' (' + (e.media == null ? '' : e.media.toFixed(2) + ' / ')
    + 'P' + e.percentil + ')';
}

/** Lo mismo con artículo: "el Carisma (4.20 / P80)". */
function conArticulo(e) {
  return e.articulo + ' ' + conValores(e);
}

/**
 * 2.2 — Liderazgo Transformacional.
 *
 * Antes: "Con fortalezas en Consideración Individualizada e Inspiración. El Carisma
 * y la Estimulación Intelectual son zonas de crecimiento", con los cuatro valores
 * reales impresos al lado del reparto equivocado. Ahora el reparto sale del
 * percentil de cada una. Las cuatro se siguen nombrando con su valor: no se pierde
 * información, cambia de qué lado queda cada una.
 */
function fraseTransformacional(cel, celv) {
  var g = repartirPorNivel(SUBESCALAS_TRANSF, cel, celv);
  var partes = [];
  if (g.altas.length) {
    partes.push('Con ' + (g.altas.length === 1 ? 'fortaleza' : 'fortalezas') + ' en '
      + enumerar(g.altas.map(conValores)) + '.');
  }
  if (g.intermedias.length) {
    partes.push(mayuscula(enumerar(g.intermedias.map(conArticulo)))
      + (g.intermedias.length === 1 ? ' queda' : ' quedan') + ' en un nivel intermedio.');
  }
  if (g.bajas.length) {
    partes.push(mayuscula(enumerar(g.bajas.map(conArticulo)))
      + (g.bajas.length === 1 ? ' es una zona' : ' son zonas') + ' de crecimiento.');
  }
  return 'P' + cel.TransfTot + '. ' + partes.join(' ');
}

/**
 * 2.2 — Liderazgo Transaccional.
 *
 * Antes decía "en niveles moderados" con las dos escalas en P5 o en P95, y cerraba
 * con "podría fortalecer el reconocimiento sistemático" incluso cuando la Recompensa
 * Contingente era lo más alto del perfil.
 *
 * ALCANCE: las frases de conducta son las que ya tenía el informe, repartidas por
 * nivel. Son provisorias. La matriz normativa por dimensión y nivel —el hueco 1 de
 * las preguntas al PO— no existe todavía; hasta que llegue, esto clasifica bien pero
 * no interpreta con respaldo. Cuando llegue, se reemplaza por texto firmado.
 */
function fraseTransaccional(cel) {
  var dirExc = nivelPorPercentil(cel.DirExc);
  var recCont = nivelPorPercentil(cel.RecCont);
  return 'P' + cel.TransTot + '. Dirección por Excepción en nivel ' + dirExc.toLowerCase()
    + ' (P' + cel.DirExc + ') y Recompensa Contingente en nivel ' + recCont.toLowerCase()
    + ' (P' + cel.RecCont + '). '
    + (dirExc === 'Bajo' ? 'Puede dejar pasar desvíos sin intervenir' : 'Interviene ante los desvíos')
    + (recCont === 'Alto'
      ? ' y reconoce el buen desempeño de manera sistemática.'
      : ' y podría fortalecer el reconocimiento sistemático del buen desempeño.');
}

/**
 * 2.2 — Laissez-Faire.
 *
 * ATENCIÓN: es la única escala del informe donde la dirección se invierte. Acá el
 * percentil ALTO es el problema y el BAJO es el valor deseable. El texto anterior la
 * marcaba como "Zona de mayor atención" siempre, incluso en P5, que es justo el caso
 * en que no hay nada que atender. Es el error más fácil de reintroducir de todo el
 * bloque: cualquier cambio acá tiene que respetar la inversión.
 */
function fraseLaissez(cel) {
  var nivel = nivelPorPercentil(cel.Laissez);
  if (nivel === 'Bajo') {
    return 'P' + cel.Laissez + '. Nivel bajo, que en esta escala es el valor deseable: '
      + 'la no-intervención no aparece como un rasgo del perfil.';
  }
  return 'P' + cel.Laissez + '. ' + (nivel === 'Alto'
    ? 'Zona de mayor atención. Puede presentar tendencia a la no-intervención o '
      + 'delegación sin acompañamiento. '
    : 'Nivel intermedio. Puede presentar episodios de no-intervención o delegación '
      + 'sin acompañamiento. ')
    + 'En contextos de equipo maduro puede ser una fortaleza, pero ante colaboradores '
    + 'con menor madurez puede generar falta de dirección.';
}

/**
 * Sección 3 — el "hallazgo más relevante".
 *
 * Afirmaba una tensión entre acompañamiento cercano y no-intervención dando por
 * hechas las tres cosas que la componen: Considerado alto, Participativo alto y
 * Laissez-Faire presente. Sobre los 2007 perfiles de referencia la combinación se da
 * en uno de cada cuatro; en los otros tres el informe la afirmaba igual.
 *
 * El párrafo se emite siempre —son tres números que el informe tiene que comentar—
 * pero dice lo que muestran, incluido el caso simétrico: no-intervención alta SIN
 * conductas de acompañamiento que la compensen, que es un hallazgo distinto y que la
 * versión anterior no podía ni nombrar.
 */
function fraseHallazgo(cam, cel) {
  var cercania = [
    { clave: 'Cons', nombre: 'Liderazgo Considerado', percentil: cam.Cons },
    { clave: 'Part', nombre: 'Liderazgo Participativo', percentil: cam.Part }
  ];
  var altas = cercania.filter(function (e) {
    return nivelPorPercentil(e.percentil) === 'Alto';
  });
  var laissez = nivelPorPercentil(cel.Laissez);

  // La redacción de dos altas es la del informe original, palabra por palabra: cuando
  // la afirmación es cierta no hay motivo para cambiarla.
  var listaAltas = altas.length === 2
    ? 'un alto Liderazgo Considerado (P' + cam.Cons + ') y Participativo (P' + cam.Part + ')'
    : (altas.length === 1 ? 'un alto ' + altas[0].nombre + ' (P' + altas[0].percentil + ')' : '');

  if (altas.length && laissez !== 'Bajo') {
    return 'El hallazgo más relevante del perfil es la combinación de ' + listaAltas
      + ' con una presencia de Laissez-Faire (P' + cel.Laissez + '). Esta tensión sugiere '
      + 'que el/la evaluado/a puede alternar entre un acompañamiento muy cercano y '
      + 'episodios de delegación sin el acompañamiento necesario, especialmente en '
      + 'conflictos o decisiones difíciles.';
  }
  if (altas.length) {
    return 'El hallazgo más relevante del perfil es la consistencia entre el '
      + 'acompañamiento cercano —' + listaAltas + '— y un Laissez-Faire bajo (P'
      + cel.Laissez + '): no aparece la alternancia entre cercanía y no-intervención.';
  }
  if (laissez === 'Alto') {
    return 'El hallazgo más relevante del perfil es un Laissez-Faire alto (P' + cel.Laissez
      + ') sin conductas de acompañamiento cercano que lo compensen: ni el Liderazgo '
      + 'Considerado (P' + cam.Cons + ') ni el Participativo (P' + cam.Part + ') alcanzan '
      + 'un nivel alto. La no-intervención no está sostenida por un vínculo de apoyo.';
  }
  return 'Ni el Liderazgo Considerado (P' + cam.Cons + ') ni el Participativo (P'
    + cam.Part + ') alcanzan un nivel alto, y el Laissez-Faire queda en P' + cel.Laissez
    + '. El perfil no presenta la tensión entre acompañamiento cercano y no-intervención.';
}

/** "a", "a y b", "a, b y c". La "y" pasa a "e" delante de i- o hi-, como corresponde. */
function enumerar(items) {
  if (items.length <= 1) return items[0] || '';
  var ultimo = items[items.length - 1];
  var conjuncion = /^[iI]|^[hH][iI](?![eE])/.test(ultimo) ? ' e ' : ' y ';
  return items.slice(0, -1).join(', ') + conjuncion + ultimo;
}

function mayuscula(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
