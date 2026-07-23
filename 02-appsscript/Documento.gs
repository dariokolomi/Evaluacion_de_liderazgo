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

var ANCHO_GRAFICO_PT = 432; // 6 pulgadas, como Inches(6.0) en el original
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

function textoNormal(p, texto, opciones) {
  var o = opciones || {};
  var t = p.appendText(texto);
  if (o.tamano) t.setFontSize(o.tamano);
  if (o.cursiva) t.setItalic(true);
  return t;
}

function ponerCelda(tabla, fila, columna, texto, opciones) {
  var o = opciones || {};
  var celda = tabla.getCell(fila, columna);
  var t = celda.editAsText();
  t.setBold(!!o.negrita);
  t.setFontSize(o.tamano || 10);
  return celda;
}

function pintarCelda(tabla, fila, columna, color) {
  tabla.getCell(fila, columna).setBackgroundColor(color);
}

/**
 * Crea la tabla con su encabezado ya formateado.
 * @param {Array<string>} encabezados
 * @param {Array<Array<string>>} filas contenido, sin el encabezado
 */
function agregarTabla(body, encabezados, filas) {
  var tabla = body.appendTable([encabezados].concat(filas));
  for (var c = 0; c < encabezados.length; c++) {
    var celda = tabla.getCell(0, c);
    celda.setBackgroundColor(AZUL_INSTITUCIONAL);
    var t = celda.editAsText();
    t.setBold(true);
    t.setForegroundColor(BLANCO);
    t.setFontSize(10);
  }
  for (var f = 1; f <= filas.length; f++) {
    for (var col = 0; col < encabezados.length; col++) {
      ponerCelda(tabla, f, col, filas[f - 1][col]);
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

  portada(body, datos.nombre, datos.fecha);
  seccionCuantitativa(body, neo, cel, celv, cam, camv, pot, potv, con, conv);
  body.appendPageBreak();
  seccionCualitativa(body, neo, cel, celv, cam, pot, con, nivel);
  body.appendPageBreak();
  seccionPerfilIntegrado(body, neo, cel, cam, pot, con);
  body.appendPageBreak();
  seccionGrafico(body, datos.nombre, datos.imagenRadar, cel, cam, con);
  body.appendPageBreak();
  seccionSintesis(body, neo, cel, cam, pot, con);
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
  var tabla = agregarTabla(body, ['Dimensión', 'Puntaje Directo / T', 'Nivel', 'Interpretación Tendencial'], filasNeo);
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
  tabla = agregarTabla(body, ['Dimensión', 'Media', 'Percentil', 'Nivel'], filasCelid);
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
  tabla = agregarTabla(body, ['Estilo', 'Puntaje Directo', 'Percentil', 'Nivel'], filasCamin);
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
  tabla = agregarTabla(body, ['Dimensión', 'Puntaje Directo', 'Percentil', 'Nivel'], filasPoten);
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
  tabla = agregarTabla(body, ['Categoría conductual', 'Puntaje Directo', 'Percentil', 'Nivel'], filasConlid);
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

function seccionCualitativa(body, neo, cel, celv, cam, pot, con, nivel) {
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
  parrafo(body, 'La persona evaluada muestra un perfil de liderazgo Transformacional predominante (' + dec(celv.TransfTot) + ' / P' + cel.TransfTot + '), con Transaccional complementario (' + dec(celv.TransTot) + ' / P' + cel.TransTot + ') y Laissez-Faire (' + dec(celv.Laissez) + ' / P' + cel.Laissez + ') como zona de atención.');

  var p3 = body.appendParagraph('');
  textoNegrita(p3, 'Liderazgo Transformacional : ');
  textoNormal(p3, 'P' + cel.TransfTot + '. Con fortalezas en Consideración Individualizada (' + dec(celv.ConsInd) + ' / P' + cel.ConsInd + ') e Inspiración (' + dec(celv.Inspir) + ' / P' + cel.Inspir + '). El Carisma (' + dec(celv.Carisma) + ' / P' + cel.Carisma + ') y la Estimulación Intelectual (' + dec(celv.EstimInt) + ' / P' + cel.EstimInt + ') son zonas de crecimiento.');

  var p4 = body.appendParagraph('');
  textoNegrita(p4, 'Liderazgo Transaccional : ');
  textoNormal(p4, 'P' + cel.TransTot + '. Dirección por Excepción (P' + cel.DirExc + ') y Recompensa Contingente (P' + cel.RecCont + ') en niveles moderados. Interviene ante desvíos pero podría fortalecer el reconocimiento sistemático del buen desempeño.');

  var p5 = body.appendParagraph('');
  textoNegrita(p5, 'Laissez-Faire : ');
  textoNormal(p5, 'P' + cel.Laissez + '. Zona de mayor atención. Puede presentar tendencia a la no-intervención o delegación sin acompañamiento. En contextos de equipo maduro puede ser una fortaleza, pero ante colaboradores con menor madurez puede generar falta de dirección.');
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

function seccionPerfilIntegrado(body, neo, cel, cam, pot, con) {
  parrafo(body, '3. Perfil Integrado y Análisis Situacional', { negrita: true, centrado: true, tamano: 13 });
  parrafo(body, 'Integrando las cinco pruebas, el/la evaluado/a configura un perfil de Líder Relacional-Transformacional, con eje en la Consideración, la Participación y el Apoyo, sostenido por una base de extroversión ' + neo.nivel.E.toLowerCase() + ' (E T=' + neo.t.E + ') y motivación intrínseca genuina (P' + pot.Intr + '). Su estilo es altamente centrado en las personas: escucha, incluye, reconoce y apoya a sus colaboradores de manera consistente.');
  body.appendParagraph('');
  parrafo(body, 'El hallazgo más relevante del perfil es la combinación de un alto Liderazgo Considerado (P' + cam.Cons + ') y Participativo (P' + cam.Part + ') con una presencia de Laissez-Faire (P' + cel.Laissez + '). Esta tensión sugiere que el/la evaluado/a puede alternar entre un acompañamiento muy cercano y episodios de delegación sin el acompañamiento necesario, especialmente en conflictos o decisiones difíciles.');
  body.appendParagraph('');
  parrafo(body, 'En términos del modelo Situacional (Hersey & Blanchard) y Camino-Meta (House), maneja con solvencia los estilos Considerado y Participativo, y tiene buena disposición hacia las Metas (P' + cam.Or + '). El estilo Directivo (P' + cam.Dir + ') es el menos desarrollado y el área de mayor crecimiento potencial.');
  body.appendParagraph('');

  parrafo(body, 'Proyección hacia el Liderazgo Situacional — Competencias a desarrollar:', { negrita: true });
  body.appendParagraph('');
  var recomendaciones = [
    ['1. Reducir episodios de Laissez-Faire',
      'P' + cel.Laissez + ': tendencia a la no-intervención. Alta Amabilidad (T=' + neo.t.A + ') puede dificultar la confrontación.',
      'Definir criterios de cuándo intervenir vs. delegar. Formación en gestión del conflicto y toma de decisiones difíciles.'],
    ['2. Fortalecer el Liderazgo Directivo',
      'P' + cam.Dir + ': el menos desarrollado del perfil. Necesario en situaciones de baja madurez o alta urgencia.',
      'Práctica de comunicación de expectativas claras. Role-play de conversaciones directivas. Feedback de corrección oportuno.'],
    ['3. Incrementar la Recompensa Contingente',
      'P' + cel.RecCont + ': nivel moderado. El buen desempeño puede no sentirse sistemáticamente reconocido.',
      'Implementar reconocimiento contingente explícito. Formalizar acuerdos de desempeño + recompensa.'],
    ['4. Desarrollar Carisma y Estimulación Intelectual',
      'Carisma P' + cel.Carisma + ' y EstimInt P' + cel.EstimInt + ': influencia simbólica y cuestionamiento analítico en nivel Medio.',
      'Entrenamiento en storytelling y relato de propósito. Incorporar desafíos intelectuales al equipo.'],
    ['5. Gestionar la autorregulación emocional',
      'Neuroticismo T=' + neo.t.N + ' (' + neo.nivel.N + '): base para sostener el estilo Considerado sin agotamiento.',
      'Técnicas de gestión del estrés. Establecer rutinas de recuperación. Coaching ejecutivo.'],
    ['6. Resiliencia y Gestión del Cambio',
      'Neuroticismo T=' + neo.t.N + ' (' + neo.nivel.N + ') y Conductas de Cambio P' + con.Camb + ': la capacidad de mantener la calma bajo presión y gestionar la incertidumbre es clave para liderar transformaciones sostenidas.',
      'Formación en liderazgo en entornos de incertidumbre. Prácticas de mindfulness y regulación emocional. Construcción de red de pares líderes. Desarrollar narrativa del cambio como herramienta de conducción.']
  ];
  var tabla = agregarTabla(body, ['Competencia a desarrollar', 'Fundamento', 'Acción de desarrollo sugerida'], recomendaciones);
  recomendaciones.forEach(function (fila, i) {
    ponerCelda(tabla, i + 1, 0, fila[0], { negrita: true });
  });
}

function seccionGrafico(body, nombre, imagenRadar, cel, cam, con) {
  var p = body.appendParagraph('');
  textoNegrita(p, '4. GRÁFICO DE COHERENCIA PERSONALIDAD VS CONDUCTAS DE LIDERAZGO.', { tamano: 13 });
  parrafo(body, 'El siguiente gráfico contrasta el perfil de ' + nombre + ' con el perfil ideal de un Líder Situacional. Las zonas donde la línea del evaluado/a (naranja) se acerca al ideal (azul) representan fortalezas consolidadas; las zonas con mayor distancia indican brechas de desarrollo.', { cursiva: true, tamano: 10 });
  body.appendParagraph('');

  var imagen = body.appendImage(imagenRadar);
  // setWidth solo deformaría la imagen: hay que escalar el alto en proporción.
  var alto = Math.round(imagen.getHeight() * ANCHO_GRAFICO_PT / imagen.getWidth());
  imagen.setWidth(ANCHO_GRAFICO_PT);
  imagen.setHeight(alto);

  body.appendParagraph('');
  parrafo(body, 'Lectura del mapa:', { negrita: true });
  parrafo(body, 'Fortalezas consolidadas: Consideración Individualizada (P' + cel.ConsInd + '), Liderazgo Considerado (P' + cam.Cons + '), Liderazgo Participativo (P' + cam.Part + '), Orientado a Metas (P' + cam.Or + '), Conductas de Relaciones (P' + con.Rel + ').');
  parrafo(body, 'Brechas principales: Laissez-Faire (P' + cel.Laissez + ' — invertido en gráfico), Carisma (P' + cel.Carisma + ' vs ideal P90), Estimulación Intelectual (P' + cel.EstimInt + ' vs ideal P85).');
  parrafo(body, 'Brechas moderadas: Liderazgo Directivo (P' + cam.Dir + ' vs ideal P75) y Conductas de Tarea (P' + con.Tar + ' vs ideal P75).');
}

function seccionSintesis(body, neo, cel, cam, pot, con) {
  parrafo(body, '5. Síntesis de Evaluación de Liderazgo — para Feedback y registro al evaluado/a.', { negrita: true, centrado: true, tamano: 13 });
  body.appendParagraph('');

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
  var areas = [];
  if (cel.Laissez >= 75) areas.push('Tendencia Laissez-Faire (P' + cel.Laissez + '): reducir los episodios de no-intervención o delegación sin acompañamiento, especialmente con colaboradores de menor madurez.');
  if (cam.Dir < 50) areas.push('Liderazgo Directivo (P' + cam.Dir + '): fortalecer la capacidad de dar instrucciones claras y establecer expectativas no negociables en situaciones de urgencia.');
  if (cel.RecCont < 50) areas.push('Recompensa Contingente (P' + cel.RecCont + '): implementar un sistema explícito y sistemático de reconocimiento del buen desempeño.');
  if (cel.Carisma < 50) areas.push('Carisma e Influencia Simbólica (P' + cel.Carisma + '): desarrollar el impacto simbólico y la capacidad de inspirar a través del relato y la comunicación.');
  if (cel.EstimInt < 50) areas.push('Estimulación Intelectual (P' + cel.EstimInt + '): incorporar el cuestionamiento analítico y el desafío intelectual como herramientas de desarrollo del equipo.');
  if (con.Tar < 50) areas.push('Conductas de Tarea (P' + con.Tar + '): fortalecer el monitoreo sistemático y la definición explícita de estándares de desempeño.');
  if (neo.nivel.N === 'Alto' || neo.nivel.N === 'Muy Alto') areas.push('Autorregulación Emocional (Neuroticismo ' + neo.nivel.N + ', T=' + neo.t.N + '): desarrollar estrategias para gestionar la reactividad emocional bajo presión sostenida.');
  if (!areas.length) areas.push('El perfil no presenta brechas significativas. Ver análisis detallado en secciones anteriores.');
  vinetas(body, areas);

  body.appendParagraph('');
  parrafo(body, 'Objetivos de Desarrollo Sugeridos', { negrita: true, tamano: 11 });
  var objetivos = [];
  if (cel.Laissez >= 75 || cam.Dir < 50) {
    objetivos.push('Ampliar el repertorio directivo: practicar la intervención activa ante desvíos y la comunicación de expectativas no negociables. Definir criterios explícitos de cuándo dirigir, cuándo acompañar y cuándo delegar según la madurez del colaborador.');
  }
  if (cel.RecCont < 50 || cel.DirExc < 50) {
    objetivos.push('Implementar un sistema de reconocimiento contingente: formalizar acuerdos de desempeño con recompensas asociadas y pasar de un reconocimiento espontáneo a uno sistemático y oportuno.');
  }
  if (cel.Carisma < 50 || cel.EstimInt < 50) {
    objetivos.push('Desarrollar el impacto transformacional: entrenamiento en storytelling, relato de propósito compartido e incorporación de espacios de innovación y desafío intelectual en la dinámica del equipo.');
  }
  if (neo.nivel.N !== 'Bajo' && neo.nivel.N !== 'Muy Bajo') {
    objetivos.push('Fortalecer la autorregulación emocional: técnicas de gestión del estrés, rutinas de recuperación y construcción de una red de apoyo entre líderes del mismo nivel.');
  }
  if (con.Tar < 50) {
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
