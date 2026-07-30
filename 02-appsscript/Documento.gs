/**
 * Armado del informe — port de run_engine.py:232-644 sobre DocumentApp.
 *
 * El motor Python abre el .docx modelo y le borra todos los párrafos y tablas:
 * el informe se construye entero por código. Acá pasa lo mismo, así que no hay
 * plantilla que mantener, sólo esta estructura.
 *
 * Los helpers de abajo son los mismos que usa el original (add_p, bold_run,
 * set_cell, shade_cell) para que las dos versiones se puedan leer en paralelo.
 */

var AZUL_INSTITUCIONAL = '#2E5496';
var AZUL_CLARO = '#DCE6F1';
var VERDE_SUAVE = '#E2EFDA';
var NARANJA_SUAVE = '#FCE4D6';
var BLANCO = '#FFFFFF';

// Ancho útil de una página A4 (595 pt) con márgenes de 72 pt: 595 - 2×72 ≈ 451.
// A4 es el tamaño de página del Workspace en es-AR.
var ANCHO_GRAFICO_PT = 451;

// setWidth()/setHeight() de InlineImage esperan PÍXELES, no puntos —está así en
// la documentación—, y Docs los convierte a 96 DPI al exportar. Pasarle puntos
// directamente encogía la imagen un 25 %: 451 puntos entraban como 451 px y
// salían como 338 pt en el .docx, más chico incluso que los 432 pt (6") del
// informe original. Medido sobre tres informes generados antes de encontrarlo.
var PIXELES_POR_PUNTO = 96 / 72;

function puntosAPixeles(puntos) {
  return Math.round(puntos * PIXELES_POR_PUNTO);
}
var SANGRIA_VINETA_PT = 14.173228; // Cm(0.5)

// ── Helpers ────────────────────────────────────────────────────────

function parrafo(body, texto, opciones) {
  var o = opciones || {};
  var p = body.appendParagraph('');
  if (o.centrado) p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  if (texto) {
    var t = p.appendText(texto);
    t.setBold(!!o.negrita);
    t.setItalic(!!o.cursiva);
    if (o.tamano) t.setFontSize(o.tamano);
  }
  return p;
}

function textoNegrita(p, texto, opciones) {
  var o = opciones || {};
  var t = p.appendText(texto);
  t.setBold(true);
  if (o.tamano) t.setFontSize(o.tamano);
  if (o.color) t.setForegroundColor(o.color);
  return t;
}

/**
 * Tramo de texto sin formato.
 *
 * La negrita y la cursiva se apagan EXPLÍCITAMENTE. En Docs, appendText hereda el
 * formato del tramo anterior del mismo párrafo, así que después de un
 * textoNegrita() —el patrón "Acción: " + el texto— todo lo que sigue salía
 * también en negrita. Pasaba en el informe entero, no sólo en el punto 5:
 * la sección 2 imprimía "Liderazgo Transformacional : P75. Con fortalezas…"
 * completo en negrita.
 */
function textoNormal(p, texto, opciones) {
  var o = opciones || {};
  var t = p.appendText(texto);
  t.setBold(false);
  t.setItalic(!!o.cursiva);
  if (o.tamano) t.setFontSize(o.tamano);
  return t;
}

function ponerCelda(tabla, fila, columna, texto, opciones) {
  var o = opciones || {};
  var celda = tabla.getCell(fila, columna);
  var t = celda.editAsText();
  t.setBold(!!o.negrita);
  t.setFontSize(o.tamano || 10);
  if (o.centrado) centrarCelda(celda);
  return celda;
}

/** La alineación vive en el/los párrafo(s) de la celda, no en la celda misma. */
function centrarCelda(celda) {
  for (var i = 0; i < celda.getNumChildren(); i++) {
    var hijo = celda.getChild(i);
    if (hijo.getType() === DocumentApp.ElementType.PARAGRAPH) {
      hijo.asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    }
  }
}

function pintarCelda(tabla, fila, columna, color) {
  tabla.getCell(fila, columna).setBackgroundColor(color);
}

/**
 * Crea la tabla con su encabezado ya formateado.
 * @param {Array<string>} encabezados
 * @param {Array<Array<string>>} filas contenido, sin el encabezado
 * @param {Array<number>} [columnasCentradas] índices de columna a centrar
 *   (encabezado y cuerpo): las de valores numéricos y códigos. Las columnas de
 *   texto —nombre de la dimensión, interpretación— se dejan a la izquierda.
 */
function agregarTabla(body, encabezados, filas, columnasCentradas) {
  var centradas = columnasCentradas || [];
  var tabla = body.appendTable([encabezados].concat(filas));
  for (var c = 0; c < encabezados.length; c++) {
    var celda = tabla.getCell(0, c);
    celda.setBackgroundColor(AZUL_INSTITUCIONAL);
    var t = celda.editAsText();
    t.setBold(true);
    t.setForegroundColor(BLANCO);
    t.setFontSize(10);
    if (centradas.indexOf(c) >= 0) centrarCelda(celda);
  }
  for (var f = 1; f <= filas.length; f++) {
    for (var col = 0; col < encabezados.length; col++) {
      ponerCelda(tabla, f, col, filas[f - 1][col], { centrado: centradas.indexOf(col) >= 0 });
    }
  }
  return tabla;
}

function colorDeNivel(nivel) {
  if (nivel === 'Alto' || nivel === 'Muy Alto') return VERDE_SUAVE;
  if (nivel === 'Bajo' || nivel === 'Muy Bajo') return NARANJA_SUAVE;
  return null;
}

function pct(p) {
  return p >= 95 ? 'P' + p + '+' : 'P' + p;
}

/**
 * Cómo se nombra un nivel en el punto 5: con la palabra, nunca con el puntaje.
 *
 * El PO pidió que la síntesis de devolución no mencione valores. La síntesis del
 * LLM ya lo cumple —`validarContenido` rechaza cualquier "P75" o "T=64"—, pero la
 * determinista, que es la que sale cuando el LLM falla, seguía imprimiéndolos: de
 * ahí salieron los "(P75)" que el PO vio en un informe real. La regla tiene que
 * valer en los dos caminos, porque quien lee el informe no sabe cuál se usó.
 *
 * Los puntajes siguen estando en las secciones 1 a 4, que son las que sostienen la
 * trazabilidad. El punto 5 es la devolución.
 */
function nivelEntreParentesis(p) {
  return '(nivel ' + nivelPorPercentil(p).toLowerCase() + ')';
}

function dec(valor) {
  return valor.toFixed(2);
}

// ── Armado ─────────────────────────────────────────────────────────

/**
 * @param {Body} body cuerpo del Google Doc destino, ya vacío.
 * @param {Object} datos {nombre, fecha (dd/mm/aaaa), resultados, imagenRadar}
 *   resultados es lo que devuelve corregir(); imagenRadar es un Blob.
 */
function construirInforme(body, datos) {
  var r = datos.resultados;
  var neo = r.neo;
  var cel = r.celid.percentil, celv = r.celid.valor;
  var pot = r.potenlid.percentil, potv = r.potenlid.valor;
  var cam = r.camin.percentil, camv = r.camin.valor;
  var con = r.conlid.percentil, conv = r.conlid.valor;
  var nivel = nivelPorPercentil; // definido en Correccion.gs
  // Estilo predominante, eje y estilo menos desarrollado. Se calcula una sola vez
  // y lo comparten las secciones 2 y 3: si cada una lo decidiera por su cuenta
  // podrían contradecirse, que es lo que HU2 señala. Ver Perfil.gs.
  var perfil = clasificarPerfil(r);

  portada(body, datos.nombre, datos.fecha);
  seccionCuantitativa(body, neo, cel, celv, cam, camv, pot, potv, con, conv);
  body.appendPageBreak();
  seccionCualitativa(body, neo, cel, celv, cam, pot, con, nivel, perfil);
  body.appendPageBreak();
  seccionPerfilIntegrado(body, neo, cel, cam, pot, con, perfil);
  body.appendPageBreak();
  seccionGrafico(body, datos.nombre, datos.imagenRadar, r.radar, cel.Laissez);
  body.appendPageBreak();
  seccionSintesis(body, neo, cel, cam, pot, con, datos.sintesis);

  // El punto 6 sólo existe si se subió un perfil de puesto. Sin él, el informe
  // termina en el punto 5 exactamente como antes: es información que se agrega,
  // no una sección que quede vacía o con un "no aplica".
  if (datos.puesto) {
    body.appendPageBreak();
    seccionPuesto(body, datos.nombre, datos.puesto, r);
  }
}

function portada(body, nombre, fecha) {
  var p = body.appendParagraph('');
  textoNegrita(p, 'INFORME: ', { tamano: 14 });
  textoNegrita(p, nombre, { tamano: 14, color: AZUL_INSTITUCIONAL });

  var datos = [
    ['Fecha de Evaluación', fecha],
    ['Instrumentos administrados', 'NEO-FFI · CELID-A · POTENLID · CAMIN-A · CONLID-A'],
    ['Profesional evaluador', '—']
  ];
  var tabla = body.appendTable(datos);
  for (var i = 0; i < datos.length; i++) {
    ponerCelda(tabla, i, 0, datos[i][0], { negrita: true });
    pintarCelda(tabla, i, 0, AZUL_CLARO);
    ponerCelda(tabla, i, 1, datos[i][1]);
  }
  body.appendParagraph('');
}

function seccionCuantitativa(body, neo, cel, celv, cam, camv, pot, potv, con, conv) {
  parrafo(body, '1. DATOS CUANTITATIVOS.', { negrita: true, centrado: true, tamano: 13 });
  parrafo(body, 'Resultado cuantitativo de todos los test.', { negrita: true });

  // NEO-FFI
  parrafo(body, 'Perfil de Personalidad (NEO-FFI)', { negrita: true });
  var dims = ['N', 'E', 'O', 'A', 'C'];
  var filasNeo = dims.map(function (d) {
    return [
      NEO_NOMBRES_TABLA[d],
      'PD=' + neo.raw[d] + '  |  T=' + neo.t[d],
      neo.nivel[d],
      NEO_INTERPRETACION_BREVE[d]
    ];
  });
  var tabla = agregarTabla(body, ['Dimensión', 'Puntaje Directo / T', 'Nivel', 'Interpretación Tendencial'], filasNeo, [1, 2]);
  dims.forEach(function (d, i) {
    ponerCelda(tabla, i + 1, 0, NEO_NOMBRES_TABLA[d], { negrita: true });
    ponerCelda(tabla, i + 1, 2, neo.nivel[d], { negrita: true });
    var color = colorDeNivel(neo.nivel[d]);
    if (color) pintarCelda(tabla, i + 1, 2, color);
  });
  body.appendParagraph('');

  // CELID-A
  var p = body.appendParagraph('');
  textoNegrita(p, 'CELID-A:', { tamano: 11 });
  textoNormal(p, '  Cuestionario de Estilos de Liderazgo');
  var filasCelid = [
    ['Carisma (Transformacional)', dec(celv.Carisma), pct(cel.Carisma), nivelPorPercentil(cel.Carisma)],
    ['Estimulación Intelectual', dec(celv.EstimInt), pct(cel.EstimInt), nivelPorPercentil(cel.EstimInt)],
    ['Inspiración', dec(celv.Inspir), pct(cel.Inspir), nivelPorPercentil(cel.Inspir)],
    ['Consideración Individualizada', dec(celv.ConsInd), pct(cel.ConsInd), nivelPorPercentil(cel.ConsInd)],
    ['TRANSFORMACIONAL – Total', dec(celv.TransfTot), pct(cel.TransfTot), nivelPorPercentil(cel.TransfTot)],
    ['Recompensa Contingente', dec(celv.RecCont), pct(cel.RecCont), nivelPorPercentil(cel.RecCont)],
    ['Dirección por Excepción', dec(celv.DirExc), pct(cel.DirExc), nivelPorPercentil(cel.DirExc)],
    ['TRANSACCIONAL – Total', dec(celv.TransTot), pct(cel.TransTot), nivelPorPercentil(cel.TransTot)],
    ['LAISSEZ-FAIRE', dec(celv.Laissez), pct(cel.Laissez), nivelPorPercentil(cel.Laissez)]
  ];
  tabla = agregarTabla(body, ['Dimensión', 'Media', 'Percentil', 'Nivel'], filasCelid, [1, 2, 3]);
  filasCelid.forEach(function (fila, i) {
    var esTotal = fila[0].indexOf('Total') >= 0 || fila[0].indexOf('LAISSEZ') >= 0;
    ponerCelda(tabla, i + 1, 0, fila[0], { negrita: esTotal });
    ponerCelda(tabla, i + 1, 3, fila[3], { negrita: esTotal });
    if (esTotal) {
      for (var c = 0; c < 4; c++) pintarCelda(tabla, i + 1, c, AZUL_CLARO);
    } else if (fila[0].indexOf('LAISSEZ') >= 0 && fila[3] === 'Alto') {
      pintarCelda(tabla, i + 1, 3, NARANJA_SUAVE);
    }
  });
  body.appendParagraph('');

  // CAMIN-A
  p = body.appendParagraph('');
  textoNegrita(p, 'CAMIN-A:', { tamano: 11 });
  textoNormal(p, '  Cuestionario de Liderazgo Camino-Meta');
  var filasCamin = [
    ['Liderazgo Directivo', String(camv.Dir), pct(cam.Dir), nivelPorPercentil(cam.Dir)],
    ['Liderazgo Considerado (Apoyo)', String(camv.Cons), pct(cam.Cons), nivelPorPercentil(cam.Cons)],
    ['Liderazgo Participativo', String(camv.Part), pct(cam.Part), nivelPorPercentil(cam.Part)],
    ['Liderazgo Orientado a Metas', String(camv.Or), pct(cam.Or), nivelPorPercentil(cam.Or)]
  ];
  tabla = agregarTabla(body, ['Estilo', 'Puntaje Directo', 'Percentil', 'Nivel'], filasCamin, [1, 2, 3]);
  pintarNivelesDeFilas(tabla, filasCamin);
  body.appendParagraph('');

  // POTENLID
  p = body.appendParagraph('');
  textoNegrita(p, 'PONTELID-A:', { tamano: 11 });
  textoNormal(p, '  Cuestionario de Potencial de Liderazgo – Motivación');
  var filasPoten = [
    ['Motivación Intrínseca', String(potv.Intr), pct(pot.Intr), nivelPorPercentil(pot.Intr)],
    ['Motivación Extrínseca', String(potv.Extr), pct(pot.Extr), nivelPorPercentil(pot.Extr)],
    ['Motivación Social Normativa', String(potv.Soc), pct(pot.Soc), nivelPorPercentil(pot.Soc)]
  ];
  tabla = agregarTabla(body, ['Dimensión', 'Puntaje Directo', 'Percentil', 'Nivel'], filasPoten, [1, 2, 3]);
  pintarNivelesDeFilas(tabla, filasPoten);
  body.appendParagraph('');

  // CONLID-A
  p = body.appendParagraph('');
  textoNegrita(p, 'CONLID-A:', { tamano: 11 });
  textoNormal(p, '  Cuestionario de Conductas de Liderazgo');
  var filasConlid = [
    ['Orientadas a la Tarea', String(conv.Tar), pct(con.Tar), nivelPorPercentil(con.Tar)],
    ['Orientadas a las Relaciones', String(conv.Rel), pct(con.Rel), nivelPorPercentil(con.Rel)],
    ['Orientadas al Cambio', String(conv.Camb), pct(con.Camb), nivelPorPercentil(con.Camb)]
  ];
  tabla = agregarTabla(body, ['Categoría conductual', 'Puntaje Directo', 'Percentil', 'Nivel'], filasConlid, [1, 2, 3]);
  pintarNivelesDeFilas(tabla, filasConlid);
}

/** Primera columna en negrita y última coloreada según el nivel. */
function pintarNivelesDeFilas(tabla, filas) {
  filas.forEach(function (fila, i) {
    ponerCelda(tabla, i + 1, 0, fila[0], { negrita: true });
    var color = colorDeNivel(fila[3]);
    if (color) pintarCelda(tabla, i + 1, 3, color);
  });
}

function seccionCualitativa(body, neo, cel, celv, cam, pot, con, nivel, perfil) {
  parrafo(body, '2. Resultados Cualitativos', { negrita: true, centrado: true, tamano: 13 });
  parrafo(body, '2.1 NEO-FFI: interpretación tendencial conjugando los 5 factores de la personalidad registrados por el evaluado/a y cómo su perfil podría actuar en el desempeño laboral concreto.', { negrita: true });

  ['N', 'E', 'O', 'A', 'C'].forEach(function (d) {
    var p = body.appendParagraph('');
    textoNegrita(p, NEO_NOMBRES[d] + ' — ' + neo.nivel[d] + ' (T=' + neo.t[d] + '): ');
    textoNormal(p, NEO_TEXTOS[d][neo.nivel[d]]);
  });
  body.appendParagraph('');

  var p2 = body.appendParagraph('');
  textoNegrita(p2, '2.2 Estilos de Liderazgo (CELID-A)', { tamano: 11 });
  // Calculado, no afirmado: antes decía "Transformacional predominante" en todos
  // los informes. Ver Perfil.gs.
  parrafo(body, frasePerfilCelid(perfil));

  // Las tres frases salen del percentil de cada escala. Antes repartían roles fijos:
  // las mismas dos subescalas eran fortalezas siempre, las otras dos zonas de
  // crecimiento siempre, el Transaccional estaba "moderado" siempre y el
  // Laissez-Faire era "zona de mayor atención" incluso en P5. Ver Perfil.gs.
  var p3 = body.appendParagraph('');
  textoNegrita(p3, 'Liderazgo Transformacional : ');
  textoNormal(p3, fraseTransformacional(cel, celv));

  var p4 = body.appendParagraph('');
  textoNegrita(p4, 'Liderazgo Transaccional : ');
  textoNormal(p4, fraseTransaccional(cel));

  var p5 = body.appendParagraph('');
  textoNegrita(p5, 'Laissez-Faire : ');
  textoNormal(p5, fraseLaissez(cel));
  body.appendParagraph('');

  parrafo(body, '2.3 Motivación y Conductas de Liderazgo (POTENLID, CAMIN-A, CONLID-A): potencialidades y motivaciones esperables que se observen en el evaluado/a.', { negrita: true });

  var p6 = body.appendParagraph('');
  textoNegrita(p6, 'Potencial de Liderazgo (POTENLID): ');
  textoNormal(p6, 'Motivación Intrínseca P' + pot.Intr + ', Extrínseca P' + pot.Extr + ', Social Normativa P' + pot.Soc + '. ' + (pot.Intr >= 75
    ? 'Lidera por convicción genuina: el rol no está impulsado por beneficios materiales ni obligación social.'
    : 'Perfil motivacional equilibrado entre factores intrínsecos y extrínsecos.'));

  body.appendParagraph('');
  parrafo(body, 'Estilo de Camino-Meta (CAMIN-A)', { negrita: true });
  CAMIN_CONDUCTAS.forEach(function (conducta) {
    var p = body.appendParagraph('');
    textoNegrita(p, conducta[0] + ' : ');
    textoNormal(p, nivel(cam[conducta[1]]) + ' (P' + cam[conducta[1]] + '). ' + conducta[2]);
  });

  var p7 = body.appendParagraph('');
  textoNegrita(p7, 'CONLID-A: ');
  textoNormal(p7, 'Relaciones P' + con.Rel + ', Cambio P' + con.Camb + ', Tarea P' + con.Tar + '. ' + (con.Rel > con.Tar
    ? 'Predominio en conductas relacionales con alta orientación al cambio. Las conductas de tarea son el área de desarrollo para consolidar el rol.'
    : 'Distribución equilibrada entre los tres tipos de conductas de liderazgo.'));
}

function seccionPerfilIntegrado(body, neo, cel, cam, pot, con, perfil) {
  parrafo(body, '3. Perfil Integrado y Análisis Situacional', { negrita: true, centrado: true, tamano: 13 });
  // La etiqueta sale de la clasificación, no de una frase fija que decía
  // "Líder Relacional-Transformacional" en todos los informes. Ver Perfil.gs.
  parrafo(body, 'Integrando las cinco pruebas, el/la evaluado/a configura un perfil de '
    + perfil.etiqueta + ', sostenido por una base de extroversión ' + neo.nivel.E.toLowerCase()
    + ' (E T=' + neo.t.E + ') y motivación intrínseca ' + nivelPorPercentil(pot.Intr).toLowerCase()
    + ' (P' + pot.Intr + ').');
  body.appendParagraph('');
  // La tensión se afirma sólo cuando está: antes se daba por hecho que el Considerado
  // y el Participativo estaban altos y que había Laissez-Faire presente. Ver Perfil.gs.
  parrafo(body, fraseHallazgo(cam, cel));
  body.appendParagraph('');
  parrafo(body, fraseSituacional(perfil, cam));
  body.appendParagraph('');

  parrafo(body, 'Proyección hacia el Liderazgo Situacional — Competencias a desarrollar:', { negrita: true });
  body.appendParagraph('');
  // Cada competencia aparece cuando su condición se cumple, y la condición es la
  // misma que aplica la síntesis del punto 5. Antes eran seis filas fijas, emitidas
  // las seis incluso en un perfil sin brechas. Ver Perfil.gs.
  var recomendaciones = competenciasADesarrollar(neo, cel, cam, con, perfil);
  var tabla = agregarTabla(body, ['Competencia a desarrollar', 'Fundamento', 'Acción de desarrollo sugerida'], recomendaciones);
  recomendaciones.forEach(function (fila, i) {
    ponerCelda(tabla, i + 1, 0, fila[0], { negrita: true });
  });
}

function seccionGrafico(body, nombre, imagenRadar, radar, laissez) {
  var p = body.appendParagraph('');
  textoNegrita(p, '4. GRÁFICO DE COHERENCIA PERSONALIDAD VS CONDUCTAS DE LIDERAZGO.', { tamano: 13 });
  // Esta frase era la que equiparaba "cerca del ideal" con "fortaleza consolidada", y
  // es el origen de la ambigüedad: el punto 5 usa esa misma palabra con otra regla.
  // El gráfico muestra distancia; la clasificación vive en un solo lugar. Ver Perfil.gs.
  parrafo(body, 'El siguiente gráfico contrasta el perfil de ' + nombre + ' con el perfil ideal de un Líder Situacional. Las zonas donde la línea del evaluado/a (naranja) se acerca al ideal (azul) son las de menor distancia al perfil de referencia; las de mayor distancia señalan dónde queda más recorrido. La clasificación de fortalezas y áreas de desarrollo se detalla en el punto 5.', { cursiva: true, tamano: 10 });
  body.appendParagraph('');

  var imagen = body.appendImage(imagenRadar);
  // Ocupa el ancho útil de la página, en píxeles porque es lo que espera la API.
  // El alto se escala en proporción: setWidth a secas deformaría la imagen. La
  // proporción se calcula con getHeight()/getWidth(), que están en la misma
  // unidad, así que no hace falta convertirlos.
  var anchoPx = puntosAPixeles(ANCHO_GRAFICO_PT);
  var altoPx = Math.round(imagen.getHeight() * anchoPx / imagen.getWidth());
  imagen.setWidth(anchoPx);
  imagen.setHeight(altoPx);

  body.appendParagraph('');
  parrafo(body, 'Lectura del mapa:', { negrita: true });
  // Las tres listas eran fijas: siempre las mismas dimensiones en el mismo grupo,
  // con el percentil real al lado. Ahora salen de la distancia al perfil ideal, que
  // es la regla que el párrafo de arriba ya declaraba. Ver Perfil.gs.
  frasesLecturaDelMapa(radar, laissez).forEach(function (linea) {
    parrafo(body, linea);
  });
}

/**
 * Punto 5 del informe.
 *
 * Si llegó una síntesis del LLM ya validada (ver Sintesis.gs), se redacta con la
 * estructura narrativa que pidió el PO en `Informe-Chilindrina.docx`. Si no llegó —sin
 * clave, sin red, o la respuesta no pasó la validación— se emite la síntesis
 * determinista de siempre: el informe se genera igual, nunca queda a medias.
 */
function seccionSintesis(body, neo, cel, cam, pot, con, sintesis) {
  parrafo(body, '5. Síntesis de Evaluación de Liderazgo — para Feedback y registro al evaluado/a.', { negrita: true, centrado: true, tamano: 13 });
  body.appendParagraph('');

  if (sintesis) {
    sintesisNarrativa(body, sintesis);
  } else {
    sintesisDeterminista(body, neo, cel, cam, pot, con);
  }
  // La nota va acá y no adentro de cada variante para que no haya forma de que un
  // camino la emita y el otro no: quien lee el informe tiene que poder saber
  // siempre qué lo escribió.
  notaDeAutoria(body, sintesis);
}

/**
 * Quién escribió el punto 5.
 *
 * El informe se archiva en un legajo y se usa en una devolución. Quien lo lee
 * después no tiene cómo saber cuál de los dos caminos salió —el modelo redacta
 * con una estructura y el texto fijo con otra, pero eso hay que conocerlo—, y la
 * diferencia importa: una síntesis asistida por IA se revisa distinto que un
 * texto armado con reglas, y si hubo dos modelos posibles, cuál de los dos la
 * escribió cambia qué tan probada está esa redacción.
 *
 * Antes la nota salía sólo cuando había modelo, así que el texto determinista era
 * justamente el que no se declaraba: el informe más pobre era el que menos decía
 * de sí mismo.
 */
function notaDeAutoria(body, sintesis) {
  body.appendParagraph('');
  // Sin el prefijo del proveedor ("nvidia/…"): el nombre del modelo alcanza.
  var quien = sintesis && sintesis.modelo
    ? 'Síntesis asistida por IA ' + nombreDeModelo(sintesis.modelo)
    : 'Síntesis generada con el texto determinista del sistema, sin asistencia de IA';
  parrafo(body, quien + ' - Requiere revisión profesional antes de la devolución.',
    { cursiva: true, tamano: 8 });
}

/** Estructura de `Informe-Chilindrina.docx`: resumen, fortalezas, áreas, inferencias,
 *  recomendaciones con contexto de aplicación y vacíos por definir. */
function sintesisNarrativa(body, s) {
  parrafo(body, 'Resumen General', { negrita: true, tamano: 11 });
  parrafo(body, s.resumenGeneral);
  body.appendParagraph('');

  parrafo(body, 'Fortalezas Clave', { negrita: true, tamano: 11 });
  vinetasConTitulo(body, s.fortalezas);
  body.appendParagraph('');

  parrafo(body, 'Áreas de Desarrollo', { negrita: true, tamano: 11 });
  vinetasConTitulo(body, s.areasDesarrollo);
  body.appendParagraph('');

  parrafo(body, 'Inferencias del Perfil', { negrita: true, tamano: 11 });
  parrafo(body, 'En el análisis del perfil se observan las siguientes inferencias cualitativas:');
  vinetasConTitulo(body, s.inferencias);
  body.appendParagraph('');

  parrafo(body, 'Recomendaciones de Acciones Concretas de Desarrollo', { negrita: true, tamano: 11 });
  parrafo(body, 'Las acciones sugeridas evalúan el contexto y el grado de autonomía (madurez) de los colaboradores que lidera:');
  s.recomendaciones.forEach(function (item) {
    var p = body.appendParagraph('');
    p.setIndentStart(SANGRIA_VINETA_PT);
    textoNegrita(p, '• ' + item.titulo);
    var pc = body.appendParagraph('');
    pc.setIndentStart(SANGRIA_VINETA_PT);
    textoNegrita(pc, 'Contexto de aplicación: ');
    textoNormal(pc, item.contexto);
    var pa = body.appendParagraph('');
    pa.setIndentStart(SANGRIA_VINETA_PT);
    textoNegrita(pa, 'Acción: ');
    textoNormal(pa, item.accion);
  });
  body.appendParagraph('');

  parrafo(body, 'Información estratégica — Pendiente de Definir', { negrita: true, tamano: 11 });
  vinetasConTitulo(body, s.pendienteDefinir);
  // La nota de autoría la pone `seccionSintesis`, común a los dos caminos.
}

/** "nvidia/llama-3.3-nemotron-super-49b-v1.5" → "llama-3.3-nemotron-super-49b-v1.5" */
function nombreDeModelo(modelo) {
  var partes = String(modelo).split('/');
  return partes[partes.length - 1];
}

/** Viñeta con el título en negrita y el desarrollo a continuación. */
function vinetasConTitulo(body, items) {
  items.forEach(function (item) {
    var p = body.appendParagraph('');
    p.setIndentStart(SANGRIA_VINETA_PT);
    textoNegrita(p, '• ' + item.titulo + ': ');
    textoNormal(p, item.texto);
  });
}

function sintesisDeterminista(body, neo, cel, cam, pot, con) {
  parrafo(body, 'Principales Fortalezas', { negrita: true, tamano: 11 });
  var fortalezas = [];
  if (esFortalezaConsolidada(cel.ConsInd)) fortalezas.push('Consideración Individualizada ' + nivelEntreParentesis(cel.ConsInd) + ': atiende activamente el desarrollo y las necesidades de cada colaborador/a, construyendo vínculos de confianza sólidos.');
  if (esFortalezaConsolidada(cam.Cons)) fortalezas.push('Liderazgo Considerado ' + nivelEntreParentesis(cam.Cons) + ': genera un ambiente de bienestar, contención y apoyo que favorece la retención y el compromiso del equipo.');
  if (esFortalezaConsolidada(cam.Part)) fortalezas.push('Liderazgo Participativo ' + nivelEntreParentesis(cam.Part) + ': involucra y consulta activamente al equipo en las decisiones, generando sentido de pertenencia y apropiación de los objetivos.');
  if (esFortalezaConsolidada(cam.Or)) fortalezas.push('Orientación a Metas ' + nivelEntreParentesis(cam.Or) + ': establece objetivos exigentes y alienta el rendimiento superior combinando desafío con apoyo.');
  if (esFortalezaConsolidada(con.Rel)) fortalezas.push('Conductas de Relaciones ' + nivelEntreParentesis(con.Rel) + ': reconocimiento de logros, apoyo cercano e información fluida al equipo como herramientas cotidianas de gestión.');
  if (esFortalezaConsolidada(con.Camb)) fortalezas.push('Conductas Orientadas al Cambio ' + nivelEntreParentesis(con.Camb) + ': genera alianzas, promueve nuevas estrategias y forma equipos orientados a la transformación.');
  if (esFortalezaConsolidada(cel.TransfTot)) fortalezas.push('Liderazgo Transformacional ' + nivelEntreParentesis(cel.TransfTot) + ': inspira y motiva al equipo hacia metas compartidas, trascendiendo el intercambio puramente transaccional.');
  if (esFortalezaConsolidada(pot.Intr)) fortalezas.push('Motivación Intrínseca ' + nivelEntreParentesis(pot.Intr) + ': ejerce el liderazgo por convicción y disfrute genuino del rol, lo que se traduce en consistencia y autenticidad.');
  // El NEO no tiene percentil acá: su nivel ya viene en palabras, así que se usa
  // ese mismo. Lo que se va es el "T=64", que es el puntaje.
  if (neo.nivel.E === 'Alto' || neo.nivel.E === 'Muy Alto') fortalezas.push('Extraversión (nivel ' + neo.nivel.E.toLowerCase() + '): sociabilidad y energía natural para construir vínculos de confianza y mantener al equipo conectado.');
  if (neo.nivel.N === 'Bajo' || neo.nivel.N === 'Muy Bajo') fortalezas.push('Estabilidad Emocional (neuroticismo en nivel ' + neo.nivel.N.toLowerCase() + '): manejo sólido del estrés y la presión del rol, recurso fundamental para el liderazgo sostenido.');
  if (!fortalezas.length) fortalezas.push('Ver análisis detallado en secciones anteriores.');
  vinetas(body, fortalezas);

  body.appendParagraph('');
  parrafo(body, 'Principales Áreas de Desarrollo', { negrita: true, tamano: 11 });
  // Las condiciones salen de brechasDeDesarrollo (Perfil.gs), que es la misma
  // función que decide la tabla de competencias de la sección 3. Antes cada sección
  // tenía su propia copia y sólo una de las dos miraba el dato.
  var b = brechasDeDesarrollo(neo, cel, cam, con);
  var areas = [];
  // En Laissez-Faire el nivel alto ES la brecha, así que decir "(nivel alto)" al
  // lado de una carencia se lee al revés. Se nombra la conducta, que es lo que la
  // devolución tiene que dejar claro.
  if (b.laissez) areas.push('Tendencia Laissez-Faire (marcada): reducir los episodios de no-intervención o delegación sin acompañamiento, especialmente con colaboradores de menor madurez.');
  if (b.directivo) areas.push('Liderazgo Directivo ' + nivelEntreParentesis(cam.Dir) + ': fortalecer la capacidad de dar instrucciones claras y establecer expectativas no negociables en situaciones de urgencia.');
  if (b.recompensa) areas.push('Recompensa Contingente ' + nivelEntreParentesis(cel.RecCont) + ': implementar un sistema explícito y sistemático de reconocimiento del buen desempeño.');
  if (b.carisma) areas.push('Carisma e Influencia Simbólica ' + nivelEntreParentesis(cel.Carisma) + ': desarrollar el impacto simbólico y la capacidad de inspirar a través del relato y la comunicación.');
  if (b.estimInt) areas.push('Estimulación Intelectual ' + nivelEntreParentesis(cel.EstimInt) + ': incorporar el cuestionamiento analítico y el desafío intelectual como herramientas de desarrollo del equipo.');
  if (b.tarea) areas.push('Conductas de Tarea ' + nivelEntreParentesis(con.Tar) + ': fortalecer el monitoreo sistemático y la definición explícita de estándares de desempeño.');
  if (b.autorregulacion) areas.push('Autorregulación Emocional (neuroticismo en nivel ' + neo.nivel.N.toLowerCase() + '): desarrollar estrategias para gestionar la reactividad emocional bajo presión sostenida.');
  if (!areas.length) areas.push('El perfil no presenta brechas significativas. Ver análisis detallado en secciones anteriores.');
  vinetas(body, areas);

  body.appendParagraph('');
  parrafo(body, 'Objetivos de Desarrollo Sugeridos', { negrita: true, tamano: 11 });
  var objetivos = [];
  if (b.laissez || b.directivo) {
    objetivos.push('Ampliar el repertorio directivo: practicar la intervención activa ante desvíos y la comunicación de expectativas no negociables. Definir criterios explícitos de cuándo dirigir, cuándo acompañar y cuándo delegar según la madurez del colaborador.');
  }
  if (b.recompensa || b.dirExcepcion) {
    objetivos.push('Implementar un sistema de reconocimiento contingente: formalizar acuerdos de desempeño con recompensas asociadas y pasar de un reconocimiento espontáneo a uno sistemático y oportuno.');
  }
  if (b.carisma || b.estimInt) {
    objetivos.push('Desarrollar el impacto transformacional: entrenamiento en storytelling, relato de propósito compartido e incorporación de espacios de innovación y desafío intelectual en la dinámica del equipo.');
  }
  // Este corte NO es el de `autorregulacion`: acá alcanza con que el Neuroticismo no
  // sea bajo. Es una condición distinta, más amplia, y se deja como estaba: cambiarla
  // movería el contenido de los informes, que no es lo que esta corrección hace.
  if (neo.nivel.N !== 'Bajo' && neo.nivel.N !== 'Muy Bajo') {
    objetivos.push('Fortalecer la autorregulación emocional: técnicas de gestión del estrés, rutinas de recuperación y construcción de una red de apoyo entre líderes del mismo nivel.');
  }
  if (b.tarea) {
    objetivos.push('Consolidar las conductas de tarea: establecer rutinas de monitoreo de indicadores, definir estándares explícitos de desempeño y practicar el feedback de corrección de manera sistemática.');
  }
  if (!objetivos.length) {
    objetivos.push('Continuar profundizando las fortalezas identificadas a través de procesos de coaching o mentoring ejecutivo.');
  }
  objetivos.forEach(function (objetivo, i) {
    var p = body.appendParagraph('');
    textoNegrita(p, 'Objetivo ' + (i + 1) + ': ');
    textoNormal(p, objetivo);
  });
}

function vinetas(body, items) {
  items.forEach(function (item) {
    var p = body.appendParagraph('');
    p.setIndentStart(SANGRIA_VINETA_PT);
    textoNormal(p, '• ' + item);
  });
}

// ═══════════════════════════════════════════════════════════════════
// Punto 6 — contraste con el Perfil de Puesto
// ═══════════════════════════════════════════════════════════════════

/**
 * Punto 6 del informe.
 *
 * Se emite sólo cuando se subió un perfil de puesto. TODOS los números de esta
 * sección —el índice, la cobertura, el nivel de riesgo, el efecto de cada
 * alerta— salen de `Puesto.gs`, que los calcula con los mismos cortes que usan
 * las secciones 1 a 5. Lo único que puede venir del modelo es la prosa, y cuando
 * no viene, la sección se emite igual con el texto armado por reglas.
 *
 * @param {Object} adecuacion salida de adecuacionAlPuesto()
 * @param {Object} resultados salida de corregir(), para el plan de desarrollo
 */
function seccionPuesto(body, nombre, adecuacion, resultados) {
  parrafo(body, '6. Contraste con el Perfil de Puesto', { negrita: true, centrado: true, tamano: 13 });
  if (adecuacion.puesto) {
    parrafo(body, 'Puesto evaluado: ' + adecuacion.puesto, { negrita: true });
  }
  body.appendParagraph('');

  matrizDeCoincidencia(body, nombre, adecuacion, resultados.camin.percentil);
  body.appendParagraph('');
  alertasSobreElIndice(body, adecuacion);
  body.appendParagraph('');
  fortalezasYRiesgos(body, adecuacion);
  body.appendParagraph('');
  planDeDesarrollo(body, adecuacion, resultados);
  notaDeAutoriaDelPuesto(body, adecuacion);
}

/** 6.1 — el índice, su cobertura y la tabla que lo sostiene. */
function matrizDeCoincidencia(body, nombre, adecuacion, cam) {
  parrafo(body, '6.1 Matriz de Coincidencia Estratégica', { negrita: true, tamano: 11 });

  if (adecuacion.porcentaje === null) {
    // Sin exigencias calculables no se imprime un 0 %: se leería como "no sirve
    // para el puesto", que es lo contrario de lo que el dato dice.
    parrafo(body, 'No se pudo calcular un índice de adecuación: ninguna de las '
      + 'exigencias que el perfil de puesto declara corresponde a lo que estos '
      + 'instrumentos miden.');
    return;
  }

  var p = body.appendParagraph('');
  textoNegrita(p, 'Índice de adecuación: ', { tamano: 12 });
  textoNegrita(p, adecuacion.porcentaje + ' %', { tamano: 12, color: AZUL_INSTITUCIONAL });

  parrafo(body, 'Calculado sobre ' + adecuacion.cobertura.medidos + ' de los '
    + adecuacion.cobertura.total + ' requisitos que declara el perfil de puesto: los '
    + 'otros ' + adecuacion.cobertura.noMedidos + ' —formación, experiencia y '
    + 'conocimientos técnicos— no los mide esta batería y se evalúan por otra vía.',
    { cursiva: true, tamano: 10 });
  body.appendParagraph('');

  var filas = adecuacion.filas.map(function (f) {
    return [
      f.dimension + (f.critica ? ' (crítica)' : ''),
      f.requerido,
      f.real,
      f.puntaje + ' / 100'
    ];
  });
  var tabla = agregarTabla(body,
    ['Dimensión que el puesto exige', 'Nivel requerido', 'Nivel del perfil', 'Aporte al índice'],
    filas, [1, 2, 3]);
  adecuacion.filas.forEach(function (f, i) {
    ponerCelda(tabla, i + 1, 0, filas[i][0], { negrita: f.critica });
    // El color sale del aporte y no del nivel: acá lo que importa es si cubre lo
    // que el puesto pide, no si el nivel es alto en abstracto. Una dimensión en
    // nivel bajo que el puesto quiere baja tiene que verse en verde.
    var color = f.puntaje === 100 ? VERDE_SUAVE : (f.puntaje <= 50 ? NARANJA_SUAVE : null);
    if (color) pintarCelda(tabla, i + 1, 3, color);
  });

  body.appendParagraph('');
  // La misma frase que la sección 3, con la misma función: el ajuste situacional
  // no puede decir una cosa en la página 3 y otra en la 6.
  parrafo(body, fraseSituacional(adecuacion.perfil, cam));
}

/** 6.2 — qué empuja el índice para arriba o para abajo. */
function alertasSobreElIndice(body, adecuacion) {
  parrafo(body, '6.2 Alertas sobre el índice', { negrita: true, tamano: 11 });

  if (adecuacion.porcentaje === null) {
    parrafo(body, 'Sin índice no hay alertas sobre el índice.');
    return;
  }
  if (!adecuacion.alertas.length) {
    parrafo(body, 'No se detectaron inconsistencias que modifiquen la lectura del '
      + 'índice: todas las exigencias se apoyan en el texto del perfil de puesto y '
      + 'ninguna contradice al resto del informe.');
    return;
  }

  parrafo(body, 'El índice es una cuenta con supuestos. Esto es lo que lo empuja en '
    + 'cada dirección, con el efecto medido en puntos porcentuales:', { cursiva: true, tamano: 10 });
  body.appendParagraph('');

  var filas = adecuacion.alertas.map(function (a) {
    return [a.alerta, flechaDeAlerta(a), a.queMirar];
  });
  var tabla = agregarTabla(body, ['Inconsistencia detectada', 'Efecto', 'Qué mirar'],
    filas, [1]);
  adecuacion.alertas.forEach(function (a, i) {
    var color = a.direccion === 'baja' ? NARANJA_SUAVE
      : (a.direccion === 'sube' ? VERDE_SUAVE : null);
    if (color) pintarCelda(tabla, i + 1, 1, color);
  });
}

/**
 * Cómo se escribe el efecto de una alerta.
 * Sin puntos, la alerta describe el alcance del índice y no lo mueve: decir
 * "0 pp" ahí haría pensar que se midió y dio cero.
 */
function flechaDeAlerta(alerta) {
  if (!alerta.puntos) return 'alcance';
  return (alerta.direccion === 'sube' ? '▲ +' : '▼ −') + alerta.puntos + ' pp';
}

/** 6.3 y 6.4 — fortalezas apalancables, riesgos y nivel de riesgo operativo. */
function fortalezasYRiesgos(body, adecuacion) {
  var n = adecuacion.narrativa;

  parrafo(body, '6.3 Fortalezas Clave para el Puesto', { negrita: true, tamano: 11 });
  if (n) {
    vinetasConTitulo(body, n.fortalezasApalancables);
  } else if (adecuacion.fortalezas.length) {
    vinetas(body, adecuacion.fortalezas.map(function (f) {
      return f.dimension + ' (nivel ' + f.real.toLowerCase() + '): cubre lo que el '
        + 'puesto pide en nivel ' + f.requerido.toLowerCase() + '.';
    }));
  } else {
    parrafo(body, 'Ninguna de las dimensiones que el puesto exige aparece como '
      + 'fortaleza consolidada en este perfil.');
  }
  body.appendParagraph('');

  parrafo(body, '6.4 Riesgos y Brechas', { negrita: true, tamano: 11 });
  var p = body.appendParagraph('');
  textoNegrita(p, 'Nivel de riesgo operativo: ');
  textoNegrita(p, adecuacion.riesgo || 'no clasificable', { color: AZUL_INSTITUCIONAL });
  textoNormal(p, adecuacion.riesgo
    ? ' — según cuántas exigencias que el puesto presenta como centrales del rol '
      + 'quedan sin cubrir.'
    : ' — ninguna de las exigencias del puesto pudo contrastarse con esta batería.');
  body.appendParagraph('');

  if (n) {
    vinetasConTitulo(body, n.riesgos);
  } else if (adecuacion.brechas.length) {
    vinetas(body, adecuacion.brechas.map(function (f) {
      return f.dimension + (f.critica ? ' (crítica para el puesto)' : '')
        + ': el puesto la pide en nivel ' + f.requerido.toLowerCase()
        + ' y el perfil está en nivel ' + f.real.toLowerCase() + '.';
    }));
  } else {
    parrafo(body, 'El perfil cubre todas las exigencias que el puesto declara y que '
      + 'esta batería puede medir.');
  }
}

/** 6.5 — el plan de desarrollo, ordenado por lo que este puesto necesita. */
function planDeDesarrollo(body, adecuacion, resultados) {
  parrafo(body, '6.5 Plan Personalizado de Desarrollo', { negrita: true, tamano: 11 });

  var plan = planDeDesarrolloParaElPuesto(resultados, adecuacion);
  if (!plan.prioritarias.length) {
    parrafo(body, 'Ninguna de las competencias a desarrollar de la sección 3 '
      + 'corresponde a una dimensión que este puesto exija. El plan de desarrollo '
      + 'aplicable es el de esa sección, sin prioridades propias de este puesto.');
    return;
  }

  parrafo(body, 'Las competencias de la sección 3 que este puesto vuelve '
    + 'prioritarias, en ese orden:', { cursiva: true, tamano: 10 });
  body.appendParagraph('');

  var filas = plan.prioritarias.map(function (fila, i) {
    return [(i + 1) + '. ' + fila[0], fila[1], fila[2]];
  });
  var tabla = agregarTabla(body,
    ['Competencia prioritaria', 'Fundamento', 'Acción de desarrollo sugerida'], filas);
  filas.forEach(function (fila, i) {
    ponerCelda(tabla, i + 1, 0, fila[0], { negrita: true });
  });
}

/**
 * Quién escribió la prosa del punto 6.
 *
 * Misma razón que `notaDeAutoria` en el punto 5: el informe se archiva y quien lo
 * lee después tiene que poder saber qué parte la redactó un modelo. Acá se agrega
 * algo más —que los números son del sistema— porque es justamente lo que
 * distingue a esta sección: la prosa puede ser asistida, la cuenta nunca lo es.
 */
function notaDeAutoriaDelPuesto(body, adecuacion) {
  body.appendParagraph('');
  var quien = adecuacion.narrativa && adecuacion.narrativa.modelo
    ? 'Prosa asistida por IA ' + nombreDeModelo(adecuacion.narrativa.modelo)
    : 'Prosa generada con el texto determinista del sistema, sin asistencia de IA';
  var comoSeLeyo = adecuacion.modelo
    ? ' El perfil de puesto lo interpretó ' + nombreDeModelo(adecuacion.modelo)
      + ', y cada exigencia se verificó contra una cita literal del documento.'
    : '';
  parrafo(body, quien + '. El índice de adecuación, la cobertura, el nivel de riesgo '
    + 'y las alertas los calcula el sistema con los mismos cortes que el resto del '
    + 'informe.' + comoSeLeyo + ' Requiere revisión profesional antes de la devolución.',
    { cursiva: true, tamano: 8 });
}
