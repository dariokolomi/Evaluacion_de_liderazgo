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

/**
 * Versión de la aplicación, visible en el encabezado.
 *
 * Existe para poder saber de un vistazo qué código está sirviendo el navegador.
 * Sin esto, un deployment que quedó pinneado en una versión vieja o una pestaña
 * cacheada se ven exactamente igual que un error del código nuevo, y el
 * diagnóstico se vuelve adivinanza.
 *
 * SE SUBE A MANO EN CADA DESPLIEGUE: sumar 1 al último número (2.1 → 2.2 → …
 * → 2.99). Cuando llegue a 2.99 se pasa a 3.1. No se calcula solo a propósito:
 * el número de versión de Apps Script cuenta cada `clasp push`, que no es lo
 * mismo que un despliegue, y un número que se mueve sin que nadie lo decida no
 * sirve para hablar de "la 2.4".
 */
var VERSION_APP = 'v2.17';

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
  plantilla.version = VERSION_APP;
  // Los nombres de las etapas viajan desde el servidor para no tener la lista
  // escrita dos veces: si se agrega una etapa en Progreso.gs, la interfaz la
  // dibuja sola.
  plantilla.etapasJson = JSON.stringify(ETAPAS_INFORME);
  return plantilla.evaluate()
    .setTitle(TITULO + ' ' + VERSION_APP)
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

/** Con qué tipo se guarda en Drive la planilla que llega del navegador. */
var MIME_DE_PLANILLA = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Cuánto puede pesar una planilla que se sube desde el navegador.
 *
 * Las reales pesan entre 20 y 60 KB. Diez megas es holgado para cualquier
 * variante con imágenes pegadas y sigue siendo chico para lo que aguanta
 * google.script.run, que es por donde viaja el archivo en base64.
 */
var MAX_PLANILLA_BYTES = 10 * 1024 * 1024;

var EXTENSIONES_DE_PLANILLA = ['.xlsx', '.xls'];

/**
 * Deja una planilla nueva en la carpeta configurada.
 *
 * Hasta ahora la única forma de sumar una planilla era dejarla a mano en la
 * carpeta de Drive: quien no tuviera acceso a la carpeta —o no supiera cuál
 * es— no podía generar un informe aunque tuviera la planilla en la máquina.
 *
 * El archivo se guarda tal como llega, sin convertirlo a Google Sheets:
 * `abrirComoPlanilla` (Informe.gs) ya convierte al vuelo cuando genera el
 * informe y descarta la copia al terminar. Convertir acá dejaría en la carpeta
 * un archivo distinto del que subió la persona.
 *
 * Lo que NO se valida acá es que la planilla tenga las 5 hojas y las respuestas
 * completas: eso exige convertirla y leerla entera, que es la mitad del trabajo
 * de generar el informe. La generación ya lo valida y lo dice con precisión
 * ("La planilla no tiene la hoja CELID-A", "faltan los ítems 3, 7").
 *
 * @param {Object} pedido {nombre, datosBase64}
 * @return {Object} {id, nombre} de la planilla guardada
 */
function subirPlanilla(pedido) {
  var config = configuracion();
  exigirAcceso(config.grupoAutorizado);

  var nombre = nombreDeArchivoSeguro((pedido && pedido.nombre) || '');
  var datos = (pedido && pedido.datosBase64) || '';
  if (!nombre) throw new Error('El archivo no tiene nombre.');
  if (!datos) throw new Error('El archivo llegó vacío.');
  if (!extensionDePlanilla(nombre)) {
    throw new Error('Sólo se pueden subir planillas .xlsx o .xls. Llegó "' + nombre + '".');
  }

  var bytes = Utilities.base64Decode(datos);
  if (bytes.length > MAX_PLANILLA_BYTES) {
    throw new Error('La planilla pesa ' + Math.round(bytes.length / 1024 / 1024)
      + ' MB y el máximo es ' + (MAX_PLANILLA_BYTES / 1024 / 1024) + ' MB.');
  }

  var blob = Utilities.newBlob(bytes, MIME_DE_PLANILLA, nombre);
  var archivo = DriveApp.getFolderById(config.carpetaPlanillasId).createFile(blob);
  return { id: archivo.getId(), nombre: archivo.getName() };
}

function extensionDePlanilla(nombre) {
  var minusculas = String(nombre).toLowerCase();
  for (var i = 0; i < EXTENSIONES_DE_PLANILLA.length; i++) {
    var extension = EXTENSIONES_DE_PLANILLA[i];
    if (minusculas.slice(-extension.length) === extension) return true;
  }
  return false;
}

/**
 * El nombre que manda el navegador, reducido a un nombre de archivo.
 * Los separadores de ruta se cambian por guiones: un nombre con barras no puede
 * crear carpetas en Drive, pero sí queda ilegible en la lista.
 */
function nombreDeArchivoSeguro(nombre) {
  return String(nombre).replace(/[\/\\]+/g, '-').trim();
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
  // El reloj se pasa desde acá: metricasDe() es pura y las series terminan en el
  // período en curso, no en el de la última corrida.
  return metricasDe(leerCorridas(config.historialId, LIMITE_HISTORIAL_COMPLETO), new Date());
}

function calificarInforme(fila, calificacion, comentario) {
  var config = configuracion();
  exigirAcceso(config.grupoAutorizado);
  calificarCorrida(config.historialId, fila, calificacion, comentario);
  return true;
}
