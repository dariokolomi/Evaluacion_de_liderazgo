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
 * LA REGLA DE PREDOMINANCIA, RESPONDIDA POR EL PO EL 2026-07-27:
 * "debe considerar el predominante el estilo con percentil más alto".
 *
 * Antes se decidía por la media (escala 1 a 5) con un margen mínimo de 0,30. El
 * criterio nuevo es el percentil, y tiene un argumento a favor: las medias de los
 * tres estilos no son comparables entre sí —cada escala tiene su propio baremo, y
 * el del Laissez-Faire es mucho más bajo, así que una media de 3,00 en Laissez es
 * P75 y una de 3,45 en Transaccional es P50—. El percentil es lo único que los
 * pone en la misma referencia. La media se sigue imprimiendo al lado, porque el
 * lector la necesita para entender la magnitud.
 *
 * DOS CONSECUENCIAS DEL CRITERIO NUEVO QUE EL PO TIENE QUE MIRAR:
 *
 *   1. EMPATES. Los baremos devuelven nueve percentiles y nada más (1, 5, 10, 25,
 *      50, 75, 90, 95, 99), así que dos estilos empatan seguido: pasa en 2 de los 3
 *      perfiles reales que hay de referencia y en el 25 % de los sintéticos. Acá un
 *      empate en el tope se informa como perfil mixto —no hay forma de llamar
 *      predominante a uno de dos que están en el mismo percentil— y eso es un
 *      cambio visible: FM pasa de "Transformacional predominante" a "sin un estilo
 *      claramente predominante", aunque su media Transformacional (4,47) esté muy
 *      por encima de la del Laissez-Faire (3,00). Si el PO prefiere desempatar por
 *      la media, es un `||` más en el orden y queda dicho en el comentario.
 *   2. El Laissez-Faire predomina mucho más seguido que antes, por lo mismo: su
 *      baremo es bajo. No es un error —un perfil de no-intervención existe y hay
 *      que decirlo— pero la etiqueta resultante ("Líder Relacional-Laissez-Faire")
 *      es la que más va a llamar la atención en los informes nuevos.
 *
 * El margen del eje (abajo) es un criterio razonable, NO una norma validada.
 */

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
 *   - estilos: los tres de CELID ordenados de mayor a menor percentil
 *   - predominante: el primero, o null si empata con otro en el percentil más alto
 *   - mixto: true cuando dos o tres estilos comparten el percentil más alto
 *   - eje: 'Relacional' | 'Orientado a la Tarea' | 'Equilibrado'
 *   - etiqueta: cómo nombrar el perfil en el informe
 *   - menosDesarrollado: el estilo de CAMIN-A con el percentil más bajo
 */
function clasificarPerfil(resultados) {
  var medias = resultados.celid.valor;
  var pctCelid = resultados.celid.percentil;

  var estilos = ESTILOS_CELID.map(function (e) {
    return { nombre: e.nombre, media: medias[e.clave], percentil: pctCelid[e.clave] };
  }).sort(function (a, b) {
    // Manda el percentil. La media entra sólo para ordenar a los que empatan, así
    // la enumeración de la frase sale siempre igual; no decide la predominancia.
    return (b.percentil - a.percentil) || (b.media - a.media);
  });

  // Un empate en el percentil más alto no se desempata: no hay forma de llamar
  // predominante a uno de dos que están en el mismo lugar de la norma.
  var mixto = estilos[0].percentil === estilos[1].percentil;

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
    // Se nombra a los empatados como empatados: decir "quedan en valores cercanos
    // entre sí" sería falso cuando el tercero está muy abajo.
    var tope = perfil.estilos[0].percentil;
    var empatados = perfil.estilos.filter(function (e) { return e.percentil === tope; });
    var resto = perfil.estilos.slice(empatados.length);
    var frase = 'La persona evaluada no muestra un estilo de liderazgo claramente '
      + 'predominante: ' + enumerar(empatados.map(conValores));
    return resto.length
      ? frase + ' comparten el percentil más alto, por encima de '
        + enumerar(resto.map(conValores)) + '.'
      : frase + ' quedan en el mismo percentil.';
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

// ═══════════════════════════════════════════════════════════════════
// Brechas de desarrollo — una sola regla para las dos secciones que la usan
// ═══════════════════════════════════════════════════════════════════

/**
 * Qué dimensiones quedan por debajo del corte de desarrollo.
 *
 * Las condiciones NO son nuevas: son exactamente las que la síntesis del punto 5
 * (`sintesisDeterminista` en Documento.gs) ya venía aplicando. La tabla de
 * competencias de la sección 3 las ignoraba y emitía sus seis filas siempre, con
 * fundamentos que el dato podía desmentir. Extraerlas acá y hacer que las dos
 * secciones consuman la misma función es lo que impide que vuelvan a separarse: es
 * la contradicción entre secciones que describe HU2, resuelta por construcción en
 * vez de por cuidado al escribir.
 *
 * Los cortes son los que ya estaban, con sus defectos declarados: fortaleza >= 75,
 * brecha < 50, la banda P50–P74 muda, y el Laissez-Faire al revés. No se tocan acá.
 * Unificarlos es la pregunta 3 al PO; moverlos por cuenta propia cambiaría el
 * contenido de todos los informes sin que nadie lo haya firmado.
 */
function brechasDeDesarrollo(neo, cel, cam, con) {
  var neuroticismoAlto = neo.nivel.N === 'Alto' || neo.nivel.N === 'Muy Alto';
  return {
    laissez: cel.Laissez >= 75,
    directivo: cam.Dir < 50,
    recompensa: cel.RecCont < 50,
    dirExcepcion: cel.DirExc < 50,
    carisma: cel.Carisma < 50,
    estimInt: cel.EstimInt < 50,
    tarea: con.Tar < 50,
    cambio: con.Camb < 50,
    autorregulacion: neuroticismoAlto
  };
}

/**
 * Sección 3 — la tabla "Competencias a desarrollar".
 *
 * Antes eran seis filas fijas, emitidas las seis en todos los informes, incluido el
 * perfil sin una sola brecha. Ahora cada competencia aparece cuando su condición se
 * cumple, y la numeración se arma con las que quedaron.
 *
 * Las acciones de desarrollo sí siguen siendo texto fijo por competencia, y eso está
 * bien: son el catálogo de intervenciones, no una afirmación sobre el evaluado. Lo
 * que se verifica es que la competencia corresponda y que su fundamento no diga nada
 * que el dato desmienta.
 *
 * @return {Array<Array<string>>} filas [competencia, fundamento, acción], numeradas.
 */
function competenciasADesarrollar(neo, cel, cam, con, perfil) {
  var b = brechasDeDesarrollo(neo, cel, cam, con);
  var filas = [];

  if (b.laissez) {
    // La Amabilidad se nombra sólo si está alta. El fundamento decía "Alta
    // Amabilidad (T=…)" con T=30 y todo, que es lo contrario de alta.
    var amabilidadAlta = neo.nivel.A === 'Alto' || neo.nivel.A === 'Muy Alto';
    filas.push(['Reducir episodios de Laissez-Faire',
      'P' + cel.Laissez + ': tendencia a la no-intervención.'
        + (amabilidadAlta
          ? ' Amabilidad ' + neo.nivel.A.toLowerCase().replace('alto', 'alta')
            + ' (T=' + neo.t.A + ') puede dificultar la confrontación.'
          : ''),
      'Definir criterios de cuándo intervenir vs. delegar. Formación en gestión del conflicto y toma de decisiones difíciles.']);
  }

  if (b.directivo) {
    filas.push(['Fortalecer el Liderazgo Directivo',
      'P' + cam.Dir + ': ' + (perfil.menosDesarrollado.nombre === 'Directivo'
        ? 'el menos desarrollado del perfil'
        : 'nivel ' + nivelPorPercentil(cam.Dir).toLowerCase())
        + '. Necesario en situaciones de baja madurez o alta urgencia.',
      'Práctica de comunicación de expectativas claras. Role-play de conversaciones directivas. Feedback de corrección oportuno.']);
  }

  if (b.recompensa) {
    filas.push(['Incrementar la Recompensa Contingente',
      'P' + cel.RecCont + ': nivel ' + nivelPorPercentil(cel.RecCont).toLowerCase()
        + '. El buen desempeño puede no sentirse sistemáticamente reconocido.',
      'Implementar reconocimiento contingente explícito. Formalizar acuerdos de desempeño + recompensa.']);
  }

  if (b.carisma || b.estimInt) {
    // Se nombra sólo la que está por debajo del corte, y la acción se arma con las
    // que correspondan. Con las dos, la fila queda igual que la del informe original.
    var cuales = [];
    if (b.carisma) {
      cuales.push({ nombre: 'Carisma', percentil: cel.Carisma, rasgo: 'influencia simbólica',
        accion: 'Entrenamiento en storytelling y relato de propósito.' });
    }
    if (b.estimInt) {
      cuales.push({ nombre: 'Estimulación Intelectual', percentil: cel.EstimInt,
        rasgo: 'cuestionamiento analítico',
        accion: 'Incorporar desafíos intelectuales al equipo.' });
    }
    filas.push(['Desarrollar ' + enumerar(cuales.map(function (c) { return c.nombre; })),
      enumerar(cuales.map(function (c) {
        return c.nombre + ' P' + c.percentil + ' (nivel ' + nivelPorPercentil(c.percentil).toLowerCase() + ')';
      })) + ': ' + enumerar(cuales.map(function (c) { return c.rasgo; }))
        + ' por debajo del corte de desarrollo.',
      cuales.map(function (c) { return c.accion; }).join(' ')]);
  }

  if (b.autorregulacion) {
    // "sostener el estilo Considerado" sólo si el Considerado está alto: era otro
    // supuesto del informe viejo, que daba ese estilo por sentado.
    var sostiene = nivelPorPercentil(cam.Cons) === 'Alto' ? 'el estilo Considerado' : 'el rol';
    filas.push(['Gestionar la autorregulación emocional',
      'Neuroticismo T=' + neo.t.N + ' (' + neo.nivel.N + '): base para sostener '
        + sostiene + ' sin agotamiento.',
      'Técnicas de gestión del estrés. Establecer rutinas de recuperación. Coaching ejecutivo.']);
  }

  if (b.autorregulacion || b.cambio) {
    filas.push(['Resiliencia y Gestión del Cambio',
      'Neuroticismo T=' + neo.t.N + ' (' + neo.nivel.N + ') y Conductas de Cambio P'
        + con.Camb + ': la capacidad de mantener la calma bajo presión y gestionar la '
        + 'incertidumbre es clave para liderar transformaciones sostenidas.',
      'Formación en liderazgo en entornos de incertidumbre. Prácticas de mindfulness y regulación emocional. Construcción de red de pares líderes. Desarrollar narrativa del cambio como herramienta de conducción.']);
  }

  // Sin brechas no se inventa un plan de desarrollo. La tabla se emite igual —con
  // una fila que lo dice— para no dejar un encabezado suelto, y en los mismos
  // términos que ya usa el punto 5 para este caso.
  if (!filas.length) {
    filas.push(['Sin competencias con brecha',
      'Ninguna dimensión queda por debajo del corte de desarrollo que aplica el punto 5.',
      'Sostener el perfil actual y profundizar las fortalezas identificadas.']);
    return filas;
  }

  return filas.map(function (fila, i) {
    return [(i + 1) + '. ' + fila[0], fila[1], fila[2]];
  });
}

// ═══════════════════════════════════════════════════════════════════
// Sección 4 — la lectura del radar
// ═══════════════════════════════════════════════════════════════════

/**
 * Los 14 ejes del radar, en el orden de RADAR_ETIQUETAS, con el nombre largo que usa
 * la prosa del informe (las etiquetas del gráfico van abreviadas para que entren).
 */
var DIMENSIONES_RADAR = [
  { nombre: 'Carisma' },
  { nombre: 'Estimulación Intelectual' },
  { nombre: 'Inspiración' },
  { nombre: 'Consideración Individualizada' },
  { nombre: 'Laissez-Faire', invertida: true },
  { nombre: 'Recompensa Contingente' },
  { nombre: 'Dirección por Excepción' },
  { nombre: 'Liderazgo Directivo' },
  { nombre: 'Liderazgo Considerado' },
  { nombre: 'Liderazgo Participativo' },
  { nombre: 'Orientado a Metas' },
  { nombre: 'Conductas de Tarea' },
  { nombre: 'Conductas de Relaciones' },
  { nombre: 'Conductas de Cambio' }
];

// Cuántos puntos de percentil por debajo del ideal separan cada grupo.
var DISTANCIA_CONSOLIDADA = 10;
var DISTANCIA_BRECHA_PRINCIPAL = 30;

/**
 * Reparte los 14 ejes del radar por su distancia al perfil ideal.
 *
 * La regla no se inventa acá: es la que el propio informe imprime arriba del
 * gráfico —"las zonas donde la línea del evaluado/a se acerca al ideal representan
 * fortalezas consolidadas; las zonas con mayor distancia indican brechas"—. Lo que
 * faltaba era que las listas la obedecieran: eran tres listas fijas, siempre las
 * mismas dimensiones en el mismo grupo, con el percentil real al lado.
 *
 * El perfil ideal es RADAR_PERFIL_IDEAL, que ya estaba en Correccion.gs y que nadie
 * declaró nunca como norma. Sigue sin estar firmado —es la pregunta 2 al PO, la
 * definición matemática de brecha— pero al menos ahora el texto y el dibujo dicen
 * lo mismo.
 *
 * @param {Object} radar r.radar: {etiquetas, ideal, evaluado}
 * @param {number} laissezCrudo el percentil de Laissez-Faire SIN invertir
 */
function lecturaDelMapa(radar, laissezCrudo) {
  var dims = DIMENSIONES_RADAR.map(function (d, i) {
    return {
      nombre: d.nombre,
      invertida: !!d.invertida,
      ideal: radar.ideal[i],
      // El Laissez-Faire entra al radar invertido (100 - P). El informe lo nombra
      // con su percentil crudo, así que se guardan los dos por separado: la
      // distancia se mide sobre el valor del gráfico, el texto muestra el crudo.
      percentil: d.invertida ? laissezCrudo : radar.evaluado[i],
      distancia: radar.ideal[i] - radar.evaluado[i]
    };
  });

  var porDistancia = function (a, b) { return b.distancia - a.distancia; };
  return {
    consolidadas: dims.filter(function (d) { return d.distancia <= DISTANCIA_CONSOLIDADA; })
      .sort(function (a, b) { return a.distancia - b.distancia; }),
    principales: dims.filter(function (d) { return d.distancia >= DISTANCIA_BRECHA_PRINCIPAL; })
      .sort(porDistancia),
    moderadas: dims.filter(function (d) {
      return d.distancia > DISTANCIA_CONSOLIDADA && d.distancia < DISTANCIA_BRECHA_PRINCIPAL;
    }).sort(porDistancia)
  };
}

/**
 * Las tres líneas de "Lectura del mapa", en orden.
 * Un grupo vacío se dice, no se rellena con dimensiones que no le tocan.
 *
 * POR QUÉ NO DICEN "fortalezas" NI "brechas", que es lo que decían antes:
 *
 * El mapa clasifica por distancia al perfil ideal, y el ideal exige distinto de cada
 * dimensión (P90 al Liderazgo Participativo, P70 a la Dirección por Excepción). El
 * punto 5 clasifica por percentil absoluto, con un corte plano en P75. Son dos
 * preguntas distintas y las dos respuestas son legítimas, pero con las mismas
 * palabras se contradicen: un Participativo en P75 es fortaleza para el punto 5 y
 * queda a 15 puntos de su ideal para el mapa. Pasa en 4 de los 29 informes de
 * referencia y en 280 de los 2007 perfiles sintéticos.
 *
 * Elegir cuál de las dos reglas gana no es una decisión de código: el perfil ideal es
 * la pregunta 2 al PO y los umbrales la 3, y ninguna está respondida. Así que cada
 * sección conserva su regla y se le saca el vocabulario compartido: el mapa habla de
 * distancia, que es lo único que el mapa mide, y la palabra "fortaleza" queda con un
 * solo dueño, el punto 5.
 */
function frasesLecturaDelMapa(radar, laissezCrudo) {
  var m = lecturaDelMapa(radar, laissezCrudo);
  return [
    'Menor distancia al perfil ideal: ' + (m.consolidadas.length
      ? listarDimensiones(m.consolidadas, false)
      : 'ninguna dimensión llega al perfil ideal.'),
    'Mayor distancia al perfil ideal: ' + (m.principales.length
      ? listarDimensiones(m.principales, true)
      : 'ninguna dimensión se aleja del ideal lo suficiente.'),
    'Distancia intermedia: ' + (m.moderadas.length
      ? listarDimensiones(m.moderadas, true)
      : 'ninguna dimensión queda en distancia intermedia.')
  ];
}

/**
 * "Carisma (P40 vs ideal P90), Inspiración (P30 vs ideal P90)."
 *
 * Al Laissez-Faire no se le imprime el ideal: en el gráfico va invertido, así que
 * su ideal (85) está en la escala dada vuelta y ponerlo al lado de un percentil
 * crudo invitaría a compararlos, que es justo lo que no hay que hacer.
 */
function listarDimensiones(dims, conIdeal) {
  return dims.map(function (d) {
    if (d.invertida) return d.nombre + ' (P' + d.percentil + ' — invertido en gráfico)';
    return d.nombre + ' (P' + d.percentil + (conIdeal ? ' vs ideal P' + d.ideal : '') + ')';
  }).join(', ') + '.';
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
