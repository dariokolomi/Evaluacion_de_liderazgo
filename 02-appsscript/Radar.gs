/**
 * Gráfico radar — reemplazo del polar de matplotlib (run_engine.py:195-230).
 *
 * Apps Script no tiene matplotlib. Se usa el tipo RADAR nativo de Sheets:
 * se vuelca la serie en una planilla descartable, se arma el gráfico y se
 * exporta como PNG para insertarlo en el informe.
 *
 * El usuario vio la comparación visual contra el gráfico actual y la aprobó,
 * asumiendo lo que se pierde (ver PLAN-APPSSCRIPT.md, sección 4):
 *   - No hay relleno de área: la brecha contra el ideal ya no se lee de un
 *     vistazo, hay que comparar eje por eje.
 *   - El eje radial va en percentiles numéricos (20/40/...) y no en P25/P50/P75/P99.
 * Si el relleno se vuelve innegociable, el plan B es dibujar el radar con la
 * API de Slides. No es una decisión que se cambie acá sin volver a hablarlo.
 */

var RADAR_COLOR_IDEAL = '#2E5496';
var RADAR_COLOR_EVALUADO = '#FF6600';
var RADAR_LADO_PX = 800;
var RADAR_SERIE_IDEAL = 'Perfil ideal';

/**
 * Tabla que alimenta al gráfico: encabezado + una fila por competencia.
 * Es función pura para poder verificar la serie contra la que grafica Python.
 *
 * @param {Object} resultados lo que devuelve corregir()
 * @param {string} nombreEvaluado rotula la serie, como en el gráfico actual
 * @return {Array<Array>} filas listas para setValues()
 */
function datosParaRadar(resultados, nombreEvaluado) {
  var radar = resultados.radar;
  // El encabezado de la columna de dominio va vacío a propósito: Sheets lo
  // dibuja como un rótulo suelto arriba del radar (se veía un eje fantasma
  // "Competencia"). Los nombres de serie —columnas 2 y 3— sí alimentan la
  // leyenda, así que quedan.
  var filas = [['', RADAR_SERIE_IDEAL, nombreEvaluado]];
  for (var i = 0; i < radar.etiquetas.length; i++) {
    filas.push([radar.etiquetas[i], radar.ideal[i], radar.evaluado[i]]);
  }
  return filas;
}

function opcionesDelRadar(nombreEvaluado) {
  return {
    title: 'Coherencia Personalidad – Conductas de Liderazgo (' + nombreEvaluado + ')',
    width: RADAR_LADO_PX,
    height: RADAR_LADO_PX,
    // Escala fija: sin esto cada informe se autoescalaría y dos informes
    // dejarían de ser comparables entre sí.
    vAxis: { minValue: 0, maxValue: 100 },
    series: {
      0: { color: RADAR_COLOR_IDEAL },
      1: { color: RADAR_COLOR_EVALUADO }
    },
    // Abajo, no arriba: al exportar el gráfico a PNG, la leyenda superior sale
    // sin los textos de las series (solo los cuadraditos de color). Abajo se
    // dibuja con "Perfil ideal" y el nombre del evaluado, como en la comparación
    // aprobada (PLAN-APPSSCRIPT.md, sección 4).
    legend: { position: 'bottom' }
  };
}

/**
 * Genera el PNG del radar.
 *
 * Trabaja sobre una planilla descartable y la manda a la papelera al terminar,
 * pase lo que pase: si quedara viva, cada informe dejaría basura en el Drive.
 *
 * @return {Blob} imagen PNG lista para insertar en el documento.
 */
function generarImagenRadar(resultados, nombreEvaluado) {
  var libro = SpreadsheetApp.create('radar-temporal');
  try {
    var hoja = libro.getSheets()[0];
    var filas = datosParaRadar(resultados, nombreEvaluado);
    hoja.getRange(1, 1, filas.length, 3).setValues(filas);

    var constructor = hoja.newChart()
      .setChartType(Charts.ChartType.RADAR)
      .addRange(hoja.getRange(1, 1, filas.length, 3))
      .setPosition(1, 5, 0, 0);

    var opciones = opcionesDelRadar(nombreEvaluado);
    for (var clave in opciones) {
      if (Object.prototype.hasOwnProperty.call(opciones, clave)) {
        constructor.setOption(clave, opciones[clave]);
      }
    }

    hoja.insertChart(constructor.build());
    SpreadsheetApp.flush();

    // Hay que recuperarlo de la hoja: el gráfico recién insertado es el que
    // sabe exportarse a imagen.
    var grafico = hoja.getCharts()[0];
    return grafico.getAs('image/png').setName('radar.png');
  } finally {
    DriveApp.getFileById(libro.getId()).setTrashed(true);
  }
}
