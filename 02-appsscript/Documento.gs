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
 * estructura narrativa que pidió el PO en `Informe-MA.docx`. Si no llegó —sin
 * clave, sin red, o la respuesta no pasó la validación— se emite la síntesis
 * determinista de siempre: el informe se genera igual, nunca queda a medias.
 */
function seccionSintesis(body, neo, cel, cam, pot, con, sintesis) {
  parrafo(body, '5. Síntesis de Evaluación de Liderazgo — para Feedback y registro al evaluado/a.', { negrita: true, centrado: true, tamano: 13 });
  body.appendParagraph('');

  if (sintesis) {
    sintesisNarrativa(body, sintesis);
    return;
  }
  sintesisDeterminista(body, neo, cel, cam, pot, con);
}

/** Estructura de `Informe-MA.docx`: resumen, fortalezas, áreas, inferencias,
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

  if (s.modelo) {
    body.appendParagraph('');
    // Sin el prefijo del proveedor ("nvidia/…"): el nombre del modelo alcanza, y
    // decía "sobre los percentiles y puntajes T", que era justo lo que el PO pidió
    // que este punto no mencione.
    parrafo(body, 'Síntesis asistida por IA ' + nombreDeModelo(s.modelo)
      + ' - Requiere revisión profesional antes de la devolución.',
      { cursiva: true, tamano: 8 });
  }
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
  if (cel.ConsInd >= 75) fortalezas.push('Consideración Individualizada (P' + cel.ConsInd + '): atiende activamente el desarrollo y las necesidades de cada colaborador/a, construyendo vínculos de confianza sólidos.');
  if (cam.Cons >= 75) fortalezas.push('Liderazgo Considerado (P' + cam.Cons + '): genera un ambiente de bienestar, contención y apoyo que favorece la retención y el compromiso del equipo.');
  if (cam.Part >= 75) fortalezas.push('Liderazgo Participativo (P' + cam.Part + '): involucra y consulta activamente al equipo en las decisiones, generando sentido de pertenencia y apropiación de los objetivos.');
  if (cam.Or >= 75) fortalezas.push('Orientación a Metas (P' + cam.Or + '): establece objetivos exigentes y alienta el rendimiento superior combinando desafío con apoyo.');
  if (con.Rel >= 75) fortalezas.push('Conductas de Relaciones (P' + con.Rel + '): reconocimiento de logros, apoyo cercano e información fluida al equipo como herramientas cotidianas de gestión.');
  if (con.Camb >= 75) fortalezas.push('Conductas Orientadas al Cambio (P' + con.Camb + '): genera alianzas, promueve nuevas estrategias y forma equipos orientados a la transformación.');
  if (cel.TransfTot >= 75) fortalezas.push('Liderazgo Transformacional (P' + cel.TransfTot + '): inspira y motiva al equipo hacia metas compartidas, trascendiendo el intercambio puramente transaccional.');
  if (pot.Intr >= 75) fortalezas.push('Motivación Intrínseca (P' + pot.Intr + '): ejerce el liderazgo por convicción y disfrute genuino del rol, lo que se traduce en consistencia y autenticidad.');
  if (neo.nivel.E === 'Alto' || neo.nivel.E === 'Muy Alto') fortalezas.push('Extraversión (' + neo.nivel.E + ', T=' + neo.t.E + '): sociabilidad y energía natural para construir vínculos de confianza y mantener al equipo conectado.');
  if (neo.nivel.N === 'Bajo' || neo.nivel.N === 'Muy Bajo') fortalezas.push('Estabilidad Emocional (' + neo.nivel.N + ', T=' + neo.t.N + '): manejo sólido del estrés y la presión del rol, recurso fundamental para el liderazgo sostenido.');
  if (!fortalezas.length) fortalezas.push('Ver análisis detallado en secciones anteriores.');
  vinetas(body, fortalezas);

  body.appendParagraph('');
  parrafo(body, 'Principales Áreas de Desarrollo', { negrita: true, tamano: 11 });
  // Las condiciones salen de brechasDeDesarrollo (Perfil.gs), que es la misma
  // función que decide la tabla de competencias de la sección 3. Antes cada sección
  // tenía su propia copia y sólo una de las dos miraba el dato.
  var b = brechasDeDesarrollo(neo, cel, cam, con);
  var areas = [];
  if (b.laissez) areas.push('Tendencia Laissez-Faire (P' + cel.Laissez + '): reducir los episodios de no-intervención o delegación sin acompañamiento, especialmente con colaboradores de menor madurez.');
  if (b.directivo) areas.push('Liderazgo Directivo (P' + cam.Dir + '): fortalecer la capacidad de dar instrucciones claras y establecer expectativas no negociables en situaciones de urgencia.');
  if (b.recompensa) areas.push('Recompensa Contingente (P' + cel.RecCont + '): implementar un sistema explícito y sistemático de reconocimiento del buen desempeño.');
  if (b.carisma) areas.push('Carisma e Influencia Simbólica (P' + cel.Carisma + '): desarrollar el impacto simbólico y la capacidad de inspirar a través del relato y la comunicación.');
  if (b.estimInt) areas.push('Estimulación Intelectual (P' + cel.EstimInt + '): incorporar el cuestionamiento analítico y el desafío intelectual como herramientas de desarrollo del equipo.');
  if (b.tarea) areas.push('Conductas de Tarea (P' + con.Tar + '): fortalecer el monitoreo sistemático y la definición explícita de estándares de desempeño.');
  if (b.autorregulacion) areas.push('Autorregulación Emocional (Neuroticismo ' + neo.nivel.N + ', T=' + neo.t.N + '): desarrollar estrategias para gestionar la reactividad emocional bajo presión sostenida.');
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
