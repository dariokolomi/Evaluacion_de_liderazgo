/**
 * Armado del Informe 2 — la estructura de `Modelo de Informe-2.docx`.
 *
 * Es el otro modelo de informe, no una variante del primero. Las diferencias que
 * mandan sobre todo lo demás:
 *
 *   - Cinco secciones distintas, en otro orden: el diagnóstico global va
 *     PRIMERO y los datos cuantitativos van al final, como anexo. El Informe 1
 *     arranca por los números.
 *   - Los valores se citan en la prosa. En el Informe 1 el punto 5 tiene
 *     prohibido nombrarlos porque es la devolución que lee la persona evaluada;
 *     acá el lector es RRHH y la jefatura, y la triangulación explícita
 *     —"Amabilidad T=62 con Considerado P90"— es el contenido del informe.
 *   - No lleva gráfico de radar. El modelo no lo tiene, así que la corrida
 *     tampoco lo arma: es medio minuto menos de generación.
 *   - Lleva la gerencia y el sector, que el Informe 1 no pide.
 *
 * UN SOLO CAMINO DE ARMADO. La síntesis que llega puede haberla escrito el
 * modelo o `sintesis2Determinista`, y este archivo no lo sabe: las dos tienen
 * exactamente la misma forma. En el Informe 1 el punto 5 tiene dos armados
 * paralelos y cada arreglo hay que hacerlo dos veces; acá lo único que cambia
 * entre un camino y el otro es la nota de autoría del pie.
 *
 * Los helpers de formato —`parrafo`, `agregarTabla`, `ponerCelda`, `pct`,
 * `dec`— son los de `Documento.gs`. Los dos informes son del mismo sistema y se
 * ven igual; una segunda copia de esos helpers los dejaría separarse.
 */

// ── Armado ─────────────────────────────────────────────────────────

/**
 * @param {Body} body cuerpo del Google Doc destino, ya vacío.
 * @param {Object} datos {nombre, fecha, gerencia, sector, resultados, sintesis,
 *   adecuacion} — `adecuacion` es null si no se cargó un perfil de puesto.
 */
function construirInforme2(body, datos) {
  portada2(body, datos);
  seccionResumenEjecutivo(body, datos.sintesis, datos.adecuacion);
  body.appendPageBreak();
  seccionMatrizDeCoincidencia(body, datos.sintesis, datos.adecuacion);
  body.appendPageBreak();
  seccionAnalisisCualitativo(body, datos.sintesis);
  body.appendPageBreak();
  seccionPlanDeDesarrollo(body, datos.nombre, datos.sintesis);
  notaDeAutoriaDelInforme2(body, datos.sintesis);
  body.appendPageBreak();
  anexoCuantitativo(body, datos.resultados);
}

function portada2(body, datos) {
  parrafo(body, 'Informe de Perfil de Liderazgo e Integración Organizacional',
    { negrita: true, centrado: true, tamano: 15 });

  // La línea del encabezado: puesto, gerencia y sector. Los dos últimos los
  // escribe quien genera el informe y no salen de ningún archivo, así que si no
  // se completaron no se inventan: se omiten y la línea queda con lo que hay.
  var encabezado = [];
  if (datos.puesto) encabezado.push('Puesto: ' + datos.puesto);
  if (datos.gerencia) encabezado.push('Gerencia: ' + datos.gerencia);
  if (datos.sector) encabezado.push('Sector: ' + datos.sector);
  encabezado.push('Fecha: ' + datos.fecha);
  parrafo(body, encabezado.join('  |  '), { centrado: true, tamano: 10 });
  body.appendParagraph('');

  var indice = datos.adecuacion && datos.adecuacion.porcentaje !== null
    ? datos.adecuacion.porcentaje + ' % (sobre ' + datos.adecuacion.cobertura.medidos
      + ' dimensiones medibles)'
    : 'no calculado';

  var celdas = [
    ['Colaborador: ' + datos.nombre, 'Fecha de Evaluación: ' + datos.fecha],
    ['Batería Administrada: NEO-FFI, CELID-A, CAMIN-A, POTENLID, CONLID-A',
      'Índice de Adecuación al Puesto: ' + indice]
  ];
  var tabla = body.appendTable(celdas);
  for (var f = 0; f < celdas.length; f++) {
    for (var c = 0; c < 2; c++) {
      ponerCelda(tabla, f, c, celdas[f][c]);
      pintarCelda(tabla, f, c, AZUL_CLARO);
    }
  }
  body.appendParagraph('');
}

// ── 1. Resumen Ejecutivo y Diagnóstico Global ──────────────────────

function seccionResumenEjecutivo(body, s, adecuacion) {
  parrafo(body, '1. Resumen Ejecutivo y Diagnóstico Global',
    { negrita: true, tamano: 13 });

  // El veredicto va en un recuadro, como en el modelo: es lo primero que se lee
  // y tiene que separarse del resto de la página. Una tabla de una columna y dos
  // filas —rótulo arriba, texto abajo— y no una celda con varios párrafos: la
  // segunda forma existe en Docs pero no en el resto de este informe, y una
  // estructura que aparece una sola vez es una que nadie vuelve a mirar.
  var recuadro = body.appendTable([
    ['Análisis Estratégico y Diagnóstico de Adecuación'],
    [s.veredicto]
  ]);
  ponerCelda(recuadro, 0, 0, 'Análisis Estratégico y Diagnóstico de Adecuación',
    { negrita: true });
  pintarCelda(recuadro, 0, 0, AZUL_CLARO);
  ponerCelda(recuadro, 1, 0, s.veredicto);

  // El nivel de riesgo lo calcula el código y va aparte del texto del modelo: es
  // la clasificación que después ordena el plan, y tenía que quedar claro de
  // dónde sale. Misma decisión que "lo calcula el sistema" al lado del
  // porcentaje en el punto 6 del Informe 1.
  var riesgo = body.appendParagraph('');
  textoNegrita(riesgo, 'Nivel de Riesgo Operativo: ');
  textoNegrita(riesgo, (adecuacion && adecuacion.riesgo) || 'no clasificable',
    { color: AZUL_INSTITUCIONAL });
  textoNormal(riesgo, adecuacion && adecuacion.riesgo
    ? '   lo calcula el sistema según cuántas exigencias críticas del puesto quedan sin cubrir'
    : '   sin perfil de puesto cargado no hay exigencias contra las cuales clasificarlo',
    { cursiva: true, tamano: 9 });
  body.appendParagraph('');

  parrafo(body, 'Resumen General', { negrita: true, tamano: 11 });
  parrafo(body, s.resumenGeneral);
  body.appendParagraph('');

  parrafo(body, 'Fortalezas Clave', { negrita: true, tamano: 11 });
  vinetasTrianguladas(body, s.fortalezas);
  body.appendParagraph('');

  parrafo(body, 'Áreas de Desarrollo', { negrita: true, tamano: 11 });
  vinetasTrianguladas(body, s.areasDesarrollo);
}

/**
 * Viñeta con el título, de qué pruebas sale el cruce y el desarrollo.
 *
 * Las fuentes van en el título y entre paréntesis —"(Triangulación NEO-FFI +
 * CAMIN-A)"— porque es lo que convierte la afirmación en algo que se puede ir a
 * verificar al anexo. Sin eso, la viñeta se lee como una opinión.
 */
function vinetasTrianguladas(body, items) {
  items.forEach(function (item) {
    var p = body.appendParagraph('');
    p.setIndentStart(SANGRIA_VINETA_PT);
    textoNegrita(p, '• ' + item.titulo);
    if (item.fuentes) {
      textoNegrita(p, ' (Triangulación ' + item.fuentes + ')');
    }
    textoNegrita(p, ': ');
    textoNormal(p, item.texto);
  });
}

// ── 2. Matriz de Coincidencia Estratégica ──────────────────────────

function seccionMatrizDeCoincidencia(body, s, adecuacion) {
  parrafo(body, '2. Matriz de Coincidencia Estratégica y Análisis de Puesto',
    { negrita: true, tamano: 13 });

  parrafo(body, 'Ajuste Perfil vs. Requerimientos del Puesto', { negrita: true, tamano: 11 });
  if (adecuacion && adecuacion.filas.length) {
    tablaDeAjuste(body, adecuacion);
  } else {
    // Sin perfil de puesto la sección NO se salta: el informe declara qué no se
    // pudo hacer. Un informe al que le falta una sección sin decirlo se lee como
    // si estuviera completo.
    parrafo(body, 'No se cargó un perfil de puesto, o ninguna de las exigencias que '
      + 'declara corresponde a lo que esta batería mide. Sin eso no hay índice de '
      + 'adecuación ni tabla de ajuste: lo que sigue se apoya únicamente en el perfil '
      + 'psicométrico.', { cursiva: true, tamano: 10 });
  }
  body.appendParagraph('');

  parrafo(body, 'Matriz de Fortalezas y Riesgos Operativos', { negrita: true, tamano: 11 });
  var filas = s.matrizOperativa.map(function (m) {
    return [m.categoria, m.hallazgo, m.impacto];
  });
  var tabla = agregarTabla(body,
    ['Categoría', 'Hallazgo Psicométrico Triangulado', 'Impacto y Riesgo Operativo en el Rol'],
    filas);
  s.matrizOperativa.forEach(function (m, i) {
    ponerCelda(tabla, i + 1, 0, m.categoria, { negrita: true });
    var color = m.categoria === 'Fortaleza Operativa' ? VERDE_SUAVE
      : (m.categoria === 'Riesgo Operativo Crítico' ? NARANJA_SUAVE : null);
    if (color) pintarCelda(tabla, i + 1, 0, color);
  });
  body.appendParagraph('');

  parrafo(body, 'Observaciones y Consideraciones Sobre el Índice',
    { negrita: true, tamano: 11 });
  observacionesSobreElIndice(body, adecuacion);
}

/** La tabla de ajuste. Todos sus valores los calculó `adecuacionAlPuesto`. */
function tablaDeAjuste(body, adecuacion) {
  var p = body.appendParagraph('');
  textoNegrita(p, 'Índice de adecuación: ', { tamano: 12 });
  textoNegrita(p, adecuacion.porcentaje === null ? 'no calculable'
    : adecuacion.porcentaje + ' %', { tamano: 12, color: AZUL_INSTITUCIONAL });
  textoNormal(p, '   lo calcula el sistema, no la IA', { cursiva: true, tamano: 9 });
  body.appendParagraph('');

  var filas = adecuacion.filas.map(function (f) {
    return [
      f.dimension + (f.critica ? ' (Crítica)' : ''),
      f.requerido,
      f.real + (f.percentil === null ? '' : ' (' + pct(f.percentil) + ')'),
      aporteEnPalabras(f)
    ];
  });
  var tabla = agregarTabla(body,
    ['Dimensión Requerida', 'Nivel Requerido', 'Nivel del Perfil', 'Aporte / Ajuste'],
    filas, [1, 2, 3]);
  adecuacion.filas.forEach(function (f, i) {
    ponerCelda(tabla, i + 1, 0, filas[i][0], { negrita: f.critica });
    // El color sale del aporte y no del nivel: lo que importa acá es si cubre lo
    // que el puesto pide, no si el nivel es alto en abstracto.
    var color = f.puntaje === 100 ? VERDE_SUAVE : (f.puntaje <= 50 ? NARANJA_SUAVE : null);
    if (color) pintarCelda(tabla, i + 1, 3, color);
  });
}

/** "100 / 100 (Alineación completa)" o "60 / 100 (Brecha de 40 puntos)". */
function aporteEnPalabras(fila) {
  return fila.puntaje + ' / 100 ' + (fila.puntaje === 100
    ? '(Alineación completa)'
    : '(Brecha de ' + (100 - fila.puntaje) + ' puntos)');
}

/**
 * Qué hay que saber para leer el índice: qué mide, qué pesa el doble y qué lo
 * mueve. Es todo deterministico —sale de `adecuacionAlPuesto`— porque son las
 * condiciones de validez del número, no una interpretación.
 */
function observacionesSobreElIndice(body, adecuacion) {
  if (!adecuacion || adecuacion.porcentaje === null) {
    parrafo(body, 'Sin índice calculado no hay observaciones sobre el índice.');
    return;
  }

  var observaciones = [
    'Cobertura: el índice evalúa ' + adecuacion.cobertura.medidos + ' de los '
      + adecuacion.cobertura.total + ' requisitos que declara el perfil de puesto. '
      + (adecuacion.cobertura.noMedidos === 1
        ? 'El otro —formación, experiencia o conocimientos técnicos— no lo mide'
        : 'Los otros ' + adecuacion.cobertura.noMedidos + ' —formación, experiencia y '
          + 'conocimientos técnicos— no los mide')
      + ' esta batería y se evalúan por otra vía.',
    'Ponderación: las exigencias que el perfil de puesto presenta como centrales del '
      + 'rol pesan el doble que las accesorias.'
  ];
  observaciones.forEach(function (texto, i) {
    var p = body.appendParagraph('');
    textoNegrita(p, (i + 1) + '. ');
    textoNormal(p, texto);
  });

  if (!adecuacion.alertas.length) {
    var sinAlertas = body.appendParagraph('');
    textoNegrita(sinAlertas, (observaciones.length + 1) + '. ');
    textoNormal(sinAlertas, 'No se detectaron inconsistencias que modifiquen la lectura '
      + 'del índice: todas las exigencias se apoyan en el texto del perfil de puesto y '
      + 'ninguna contradice al resto del informe.');
    return;
  }

  body.appendParagraph('');
  parrafo(body, 'Lo que empuja el índice en cada dirección, con el efecto medido en '
    + 'puntos porcentuales:', { cursiva: true, tamano: 10 });
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

// ── 3. Análisis Cualitativo Integrado ──────────────────────────────

function seccionAnalisisCualitativo(body, s) {
  parrafo(body, '3. Análisis Cualitativo Integrado e Inferencias del Perfil',
    { negrita: true, tamano: 13 });
  parrafo(body, 'La integración transversal de los cinco instrumentos permite leer las '
    + 'pautas de comportamiento en el entorno laboral cruzando la personalidad de base, '
    + 'los estilos de liderazgo, las motivaciones y las conductas reportadas.',
    { cursiva: true, tamano: 10 });
  body.appendParagraph('');

  parrafo(body, 'Análisis de Coherencia e Incoherencias Psicometría-Conducta',
    { negrita: true, tamano: 11 });
  s.coherencias.forEach(function (c) {
    var p = body.appendParagraph('');
    p.setIndentStart(SANGRIA_VINETA_PT);
    textoNegrita(p, '• ' + c.tipo + ' — ' + c.titulo + ': ');
    textoNormal(p, c.texto);
  });
  body.appendParagraph('');

  parrafo(body, 'Inferencias/Incontingencias del Perfil', { negrita: true, tamano: 11 });
  // Numeradas y no en viñetas, como en el modelo: son las conclusiones del
  // informe y después se las cita por número en la devolución.
  s.inferencias.forEach(function (inferencia, i) {
    var p = body.appendParagraph('');
    p.setIndentStart(SANGRIA_VINETA_PT);
    textoNegrita(p, (i + 1) + '. ' + inferencia.titulo);
    if (inferencia.fuentes) {
      textoNegrita(p, ' (Triangulación ' + inferencia.fuentes + ')');
    }
    textoNegrita(p, ': ');
    textoNormal(p, inferencia.texto);
  });
}

// ── 4. Plan Personalizado de Desarrollo ────────────────────────────

function seccionPlanDeDesarrollo(body, nombre, s) {
  parrafo(body, '4. Plan Personalizado de Desarrollo y Acciones Concretas',
    { negrita: true, tamano: 13 });

  parrafo(body, 'Recomendaciones de Acciones Concretas de Desarrollo',
    { negrita: true, tamano: 11 });
  parrafo(body, 'Hoja de ruta priorizada. Cada eje declara en qué dato se apoya, en qué '
    + 'contexto se aplica, con qué plazo y contra qué indicador se lo mide.',
    { cursiva: true, tamano: 10 });
  body.appendParagraph('');

  s.ejes.forEach(function (eje, i) {
    var titulo = body.appendParagraph('');
    textoNegrita(titulo, 'Eje ' + (i + 1) + ': ' + eje.titulo
      + ' (Prioridad ' + eje.prioridad + ')');

    [
      ['Fundamento triangulado: ', eje.fundamento],
      ['Contexto de aplicación: ', eje.contexto],
      ['Acción concreta: ', eje.accion],
      ['Plazo: ', eje.plazo],
      ['Indicador de gestión: ', eje.indicador]
    ].forEach(function (par) {
      var p = body.appendParagraph('');
      p.setIndentStart(SANGRIA_VINETA_PT);
      textoNegrita(p, '• ' + par[0]);
      textoNormal(p, par[1]);
    });
    body.appendParagraph('');
  });

  parrafo(body, 'Información Estratégica para el Líder del Evaluado',
    { negrita: true, tamano: 11 });
  [
    ['Pautas de acompañamiento: ', s.informacionLider.pautas],
    ['Frecuencia de seguimiento: ', s.informacionLider.frecuencia],
    ['Indicadores a monitorear: ', s.informacionLider.kpis],
    ['Disparadores de riesgo operativo: ', s.informacionLider.disparadores]
  ].forEach(function (par) {
    var p = body.appendParagraph('');
    p.setIndentStart(SANGRIA_VINETA_PT);
    textoNegrita(p, '• ' + par[0]);
    textoNormal(p, par[1]);
  });
  body.appendParagraph('');

  parrafo(body, 'Registros de Feedback para Sistema RRHH', { negrita: true, tamano: 11 });
  var filas = [
    ['Formato breve para el Líder Directivo', s.registros.lider],
    ['Formato breve para la persona evaluada (' + nombre + ')', s.registros.evaluado]
  ];
  var tabla = agregarTabla(body, ['Destinatario', 'Síntesis Breve para Registro Formal'],
    filas);
  filas.forEach(function (fila, i) {
    ponerCelda(tabla, i + 1, 0, fila[0], { negrita: true });
  });
  body.appendParagraph('');

  parrafo(body, 'Información de Clarificación', { negrita: true, tamano: 11 });
  parrafo(body, 'Se señalan los siguientes aspectos como pendientes de definir, con las '
    + 'preguntas de clarificación que hay que responder para ajustar el plan de '
    + 'intervención:');
  s.clarificaciones.forEach(function (c, i) {
    var p = body.appendParagraph('');
    p.setIndentStart(SANGRIA_VINETA_PT);
    textoNegrita(p, (i + 1) + '. Pendiente de definir — ' + c.titulo + ': ');
    textoNormal(p, c.pregunta);
  });
}

/**
 * Quién escribió el Informe 2.
 *
 * Misma forma que las notas del Informe 1, a propósito: es el mismo sistema y el
 * mismo dato. Sale SIEMPRE, salga el texto del modelo o el determinista, porque
 * el informe más pobre es justamente el que más necesita declararse: quien lo
 * lee en el legajo seis meses después no tiene otra forma de saberlo.
 */
function notaDeAutoriaDelInforme2(body, sintesis) {
  body.appendParagraph('');
  var quien = sintesis && sintesis.modelo
    ? 'Informe asistido por IA ' + nombreDeModelo(sintesis.modelo)
    : 'Informe generado con el texto determinista del sistema, sin asistencia de IA';
  parrafo(body, quien + '. Los valores, el índice de adecuación y el nivel de riesgo los '
    + 'calcula el sistema. Requiere revisión profesional antes de la devolución.',
    { cursiva: true, tamano: 8 });
}

// ── 5. Anexo: datos cuantitativos ──────────────────────────────────

/**
 * El anexo. Son los mismos números que la sección 1 del Informe 1, con los
 * rótulos del modelo 2 —"Nivel Operativo", "Interpretación Tendencial"— y sin el
 * gráfico. Salen de `corregir()`: acá no se calcula nada.
 */
function anexoCuantitativo(body, r) {
  var neo = r.neo;
  var cel = r.celid.percentil, celv = r.celid.valor;
  var cam = r.camin.percentil, camv = r.camin.valor;
  var pot = r.potenlid.percentil, potv = r.potenlid.valor;
  var con = r.conlid.percentil, conv = r.conlid.valor;

  parrafo(body, '5. Anexo: Datos Cuantitativos y Resultados Psicométricos',
    { negrita: true, tamano: 13 });
  parrafo(body, 'A continuación se presentan los registros cuantitativos obtenidos en '
    + 'cada uno de los instrumentos administrados.');
  body.appendParagraph('');

  parrafo(body, 'NEO-FFI: Cuestionario de Personalidad de 5 Factores',
    { negrita: true, tamano: 11 });
  var dims = ['N', 'E', 'O', 'A', 'C'];
  var filasNeo = dims.map(function (d) {
    return [NEO_NOMBRES_TABLA[d], 'PD=' + neo.raw[d] + ' / T=' + neo.t[d],
      neo.nivel[d], NEO_INTERPRETACION_BREVE[d]];
  });
  var tabla = agregarTabla(body,
    ['Dimensión', 'Puntaje Directo (PD) / T', 'Nivel', 'Interpretación Tendencial'],
    filasNeo, [1, 2]);
  dims.forEach(function (d, i) {
    ponerCelda(tabla, i + 1, 0, NEO_NOMBRES_TABLA[d], { negrita: true });
    ponerCelda(tabla, i + 1, 2, neo.nivel[d], { negrita: true });
    var color = colorDeNivel(neo.nivel[d]);
    if (color) pintarCelda(tabla, i + 1, 2, color);
  });
  body.appendParagraph('');

  parrafo(body, 'CELID-A: Cuestionario de Estilos de Liderazgo',
    { negrita: true, tamano: 11 });
  var filasCelid = [
    ['Carisma (Transformacional)', dec(celv.Carisma), pct(cel.Carisma), nivelPorPercentil(cel.Carisma)],
    ['Estimulación Intelectual', dec(celv.EstimInt), pct(cel.EstimInt), nivelPorPercentil(cel.EstimInt)],
    ['Inspiración', dec(celv.Inspir), pct(cel.Inspir), nivelPorPercentil(cel.Inspir)],
    ['Consideración Individualizada', dec(celv.ConsInd), pct(cel.ConsInd), nivelPorPercentil(cel.ConsInd)],
    ['TRANSFORMACIONAL - Total', dec(celv.TransfTot), pct(cel.TransfTot), nivelPorPercentil(cel.TransfTot)],
    ['Recompensa Contingente', dec(celv.RecCont), pct(cel.RecCont), nivelPorPercentil(cel.RecCont)],
    ['Dirección por Excepción', dec(celv.DirExc), pct(cel.DirExc), nivelPorPercentil(cel.DirExc)],
    ['TRANSACCIONAL - Total', dec(celv.TransTot), pct(cel.TransTot), nivelPorPercentil(cel.TransTot)],
    // En el Laissez-Faire el nivel bajo es lo deseable, y decir "Bajo" a secas al
    // lado de ocho filas donde bajo es lo malo se lee al revés. El modelo 2 lo
    // aclara en la misma celda.
    ['LAISSEZ-FAIRE', dec(celv.Laissez), pct(cel.Laissez),
      nivelPorPercentil(cel.Laissez) + (nivelPorPercentil(cel.Laissez) === 'Bajo' ? ' (Deseable)' : '')]
  ];
  tabla = agregarTabla(body, ['Dimensión / Estilo', 'Media', 'Percentil', 'Nivel Operativo'],
    filasCelid, [1, 2, 3]);
  filasCelid.forEach(function (fila, i) {
    var esTotal = fila[0].indexOf('Total') >= 0 || fila[0].indexOf('LAISSEZ') >= 0;
    ponerCelda(tabla, i + 1, 0, fila[0], { negrita: esTotal });
    ponerCelda(tabla, i + 1, 3, fila[3], { negrita: esTotal });
    if (esTotal) {
      for (var c = 0; c < 4; c++) pintarCelda(tabla, i + 1, c, AZUL_CLARO);
    }
  });
  body.appendParagraph('');

  parrafo(body, 'CAMIN-A: Cuestionario de Liderazgo Camino-Meta',
    { negrita: true, tamano: 11 });
  var filasCamin = [
    ['Liderazgo Directivo', String(camv.Dir), pct(cam.Dir), nivelPorPercentil(cam.Dir)],
    ['Liderazgo Considerado (Apoyo)', String(camv.Cons), pct(cam.Cons), nivelPorPercentil(cam.Cons)],
    ['Liderazgo Participativo', String(camv.Part), pct(cam.Part), nivelPorPercentil(cam.Part)],
    ['Liderazgo Orientado a Metas', String(camv.Or), pct(cam.Or), nivelPorPercentil(cam.Or)]
  ];
  tabla = agregarTabla(body,
    ['Estilo de Liderazgo', 'Puntaje Directo (PD)', 'Percentil', 'Nivel'],
    filasCamin, [1, 2, 3]);
  pintarNivelesDeFilas(tabla, filasCamin);
  body.appendParagraph('');

  parrafo(body, 'POTENLID-A y CONLID-A: Motivación y Conductas de Liderazgo',
    { negrita: true, tamano: 11 });
  var filasUltima = [
    ['POTENLID: Motivación Intrínseca', String(potv.Intr), pct(pot.Intr), nivelPorPercentil(pot.Intr)],
    ['POTENLID: Motivación Extrínseca', String(potv.Extr), pct(pot.Extr), nivelPorPercentil(pot.Extr)],
    ['POTENLID: Motivación Social Normativa', String(potv.Soc), pct(pot.Soc), nivelPorPercentil(pot.Soc)],
    ['CONLID-A: Orientadas a la Tarea', String(conv.Tar), pct(con.Tar), nivelPorPercentil(con.Tar)],
    ['CONLID-A: Orientadas a las Relaciones', String(conv.Rel), pct(con.Rel), nivelPorPercentil(con.Rel)],
    ['CONLID-A: Orientadas al Cambio', String(conv.Camb), pct(con.Camb), nivelPorPercentil(con.Camb)]
  ];
  tabla = agregarTabla(body,
    ['Prueba / Dimensión', 'Puntaje Directo (PD)', 'Percentil', 'Nivel'],
    filasUltima, [1, 2, 3]);
  pintarNivelesDeFilas(tabla, filasUltima);
}
