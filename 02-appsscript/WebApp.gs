/**
 * Aplicación web: lo que ve y llama el navegador.
 *
 * Reemplaza a app.py. Las diferencias que importan:
 *   - No hay login propio: entra quien está en el Grupo de Google.
 *   - No hay SSE: Apps Script no permite streaming. El progreso por etapas se
 *     sostiene con el Cache y llamadas cortas del navegador, que es lo que
 *     reemplaza al stream. Ver Progreso.gs — con la síntesis del punto 5 la
 *     corrida pasó de un segundo a minutos, y ahí el spinner mudo dejó de
 *     alcanzar.
 *   - No hay endpoint /download: los informes son archivos de Drive.
 *
 * Cada función llamada desde el navegador vuelve a verificar el acceso.
 * google.script.run llega directo a la función: que doGet haya chequeado no
 * protege a las demás.
 */

var TITULO = 'Informes de Liderazgo — CCHH';
var LIMITE_HISTORIAL_COMPLETO = 5000;

function doGet() {
  var config;
  try {
    config = configuracion();
  } catch (e) {
    return HtmlService.createHtmlOutput(paginaDeError('Configuración incompleta', e.message));
  }
  if (!usuarioAutorizado(config.grupoAutorizado)) {
    return HtmlService.createHtmlOutput(paginaDeError(
      'Sin acceso',
      'Esta aplicación es del equipo de RRHH. Pedí que te agreguen al grupo ' + config.grupoAutorizado + '.'
    ));
  }

  var plantilla = HtmlService.createTemplateFromFile('Interfaz');
  plantilla.usuario = usuarioActual();
  // Los nombres de las etapas viajan desde el servidor para no tener la lista
  // escrita dos veces: si se agrega una etapa en Progreso.gs, la interfaz la
  // dibuja sola.
  plantilla.etapasJson = JSON.stringify(ETAPAS_INFORME);
  return plantilla.evaluate()
    .setTitle(TITULO)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function paginaDeError(titulo, detalle) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8">'
    + '<style>body{font-family:system-ui,sans-serif;max-width:34rem;margin:4rem auto;padding:0 1.5rem;color:#2b3a4a}'
    + 'h1{color:#2E5496;font-size:1.3rem}p{line-height:1.6}</style></head><body>'
    + '<h1>' + escaparHtml(titulo) + '</h1><p>' + escaparHtml(detalle) + '</p></body></html>';
}

function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Funciones que llama el navegador ───────────────────────────────

var MIMES_DE_PLANILLA = [
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
];

/** Planillas disponibles en la carpeta configurada, la más nueva primero. */
function listarPlanillas() {
  var config = configuracion();
  exigirAcceso(config.grupoAutorizado);

  var archivos = DriveApp.getFolderById(config.carpetaPlanillasId).getFiles();
  var planillas = [];
  while (archivos.hasNext()) {
    var archivo = archivos.next();
    if (MIMES_DE_PLANILLA.indexOf(archivo.getMimeType()) < 0) continue;
    planillas.push({
      id: archivo.getId(),
      nombre: archivo.getName(),
      actualizado: archivo.getLastUpdated().getTime()
    });
  }
  planillas.sort(function (a, b) { return b.actualizado - a.actualizado; });
  return planillas;
}

/** Genera el informe. Devuelve lo mismo que generarInforme(). */
function generarDesdeInterfaz(pedido) {
  return generarInforme(pedido); // ya verifica configuración y acceso
}

function listarHistorial(limite) {
  var config = configuracion();
  exigirAcceso(config.grupoAutorizado);
  return leerCorridas(config.historialId, limite || 25).map(function (corrida) {
    return {
      fila: corrida.fila,
      fecha: corrida.fecha instanceof Date
        ? Utilities.formatDate(corrida.fecha, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
        : String(corrida.fecha),
      evaluado: corrida.evaluado,
      informeUrl: corrida.informeUrl,
      usuario: corrida.usuario,
      segundos: corrida.segundos,
      calificacion: corrida.calificacion,
      comentario: corrida.comentario
    };
  });
}

/**
 * Métricas del tablero. Lee todo el historial, no las últimas 25: un promedio
 * sobre una ventana móvil no es el promedio.
 */
function obtenerMetricas() {
  var config = configuracion();
  exigirAcceso(config.grupoAutorizado);
  return metricasDe(leerCorridas(config.historialId, LIMITE_HISTORIAL_COMPLETO));
}

function calificarInforme(fila, calificacion, comentario) {
  var config = configuracion();
  exigirAcceso(config.grupoAutorizado);
  calificarCorrida(config.historialId, fila, calificacion, comentario);
  return true;
}
