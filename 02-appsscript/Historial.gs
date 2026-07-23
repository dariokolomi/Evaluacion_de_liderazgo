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
