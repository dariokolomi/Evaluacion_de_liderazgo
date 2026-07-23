/**
 * Historial de corridas y calificaciones.
 *
 * Reemplaza a .runs_history.json, que además de no ser una base de datos no
 * tenía lock de escritura: dos corridas simultáneas se pisaban. Un Sheet
 * serializa los appends por su cuenta.
 *
 * Las columnas siguen las del Excel de calidad que arma hoy la app
 * (app.py:42-50), menos "Modelo": ya no hay archivo modelo que elegir.
 */

var HISTORIAL_HOJA = 'Corridas';

var HISTORIAL_COLUMNAS = [
  'Fecha', 'Evaluado', 'Planilla', 'Informe', 'Generado por',
  'Segundos', 'Calificación', 'Comentario'
];

/** Devuelve la hoja de corridas, creándola con su encabezado si hace falta. */
function hojaDeHistorial(historialId) {
  var libro = SpreadsheetApp.openById(historialId);
  var hoja = libro.getSheetByName(HISTORIAL_HOJA);
  if (!hoja) {
    hoja = libro.insertSheet(HISTORIAL_HOJA);
  }
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(HISTORIAL_COLUMNAS);
    hoja.setFrozenRows(1);
  }
  return hoja;
}

var COL_CALIFICACION = 7;
var COL_COMENTARIO = 8;

/**
 * Registra una corrida.
 * @param {Object} corrida {fecha, evaluado, planilla, informeUrl, usuario, segundos}
 */
function registrarCorrida(historialId, corrida) {
  hojaDeHistorial(historialId).appendRow([
    corrida.fecha,
    corrida.evaluado,
    corrida.planilla,
    corrida.informeUrl,
    corrida.usuario,
    corrida.segundos,
    '', // la calificación la carga después quien revisa el informe
    ''
  ]);
}

/**
 * Últimas corridas, de la más reciente a la más vieja.
 * Devuelve también el número de fila: es lo que después identifica a la
 * corrida para calificarla.
 */
function leerCorridas(historialId, limite) {
  var hoja = hojaDeHistorial(historialId);
  var ultima = hoja.getLastRow();
  if (ultima < 2) return [];

  var cantidad = Math.min(limite || 50, ultima - 1);
  var primera = ultima - cantidad + 1;
  var valores = hoja.getRange(primera, 1, cantidad, HISTORIAL_COLUMNAS.length).getValues();

  return valores.map(function (fila, i) {
    return {
      fila: primera + i,
      fecha: fila[0],
      evaluado: fila[1],
      planilla: fila[2],
      informeUrl: fila[3],
      usuario: fila[4],
      segundos: fila[5],
      calificacion: fila[6],
      comentario: fila[7]
    };
  }).reverse();
}

/**
 * Guarda la calificación de una corrida.
 * Valida la fila contra el tamaño real de la hoja: el número viene del
 * navegador, y con un número cualquiera se escribiría sobre el encabezado o
 * fuera del rango.
 */
function calificarCorrida(historialId, fila, calificacion, comentario) {
  var hoja = hojaDeHistorial(historialId);
  var numero = Number(fila);
  if (!(numero >= 2 && numero <= hoja.getLastRow())) {
    throw new Error('La corrida indicada no existe en el historial.');
  }
  var puntaje = Number(calificacion);
  if (!(puntaje >= 1 && puntaje <= 5)) {
    throw new Error('La calificación tiene que ser un número del 1 al 5.');
  }
  hoja.getRange(numero, COL_CALIFICACION).setValue(puntaje);
  hoja.getRange(numero, COL_COMENTARIO).setValue(String(comentario || '').slice(0, 500));
}
