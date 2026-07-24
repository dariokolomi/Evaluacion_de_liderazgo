/**
 * Orquestador: de la planilla de respuestas al informe guardado en Drive.
 *
 * Es el equivalente de run_informe() (run_engine.py:16) más lo que hacía la
 * app Flask alrededor: resolver el archivo de entrada, guardar la salida y
 * registrar la corrida.
 *
 * Regla de la casa acá: todo lo que se crea en el camino —la copia convertida
 * de la planilla, el Google Doc intermedio— se descarta al terminar, salga
 * bien o mal. Si no, cada informe deja dos archivos huérfanos en el Drive.
 */

/**
 * Genera el informe de una persona evaluada.
 *
 * @param {Object} pedido {planillaId, nombreEvaluado}
 * @return {Object} {informeId, informeUrl, nombreArchivo, evaluado, segundos}
 */
function generarInforme(pedido) {
  var inicio = new Date();
  var config = configuracion();
  exigirAcceso(config.grupoAutorizado);

  var nombre = ((pedido && pedido.nombreEvaluado) || '').trim();
  if (!pedido || !pedido.planillaId) {
    throw new Error('Falta indicar la planilla de respuestas.');
  }
  if (!nombre) {
    throw new Error('Falta el nombre de la persona evaluada.');
  }

  var temporales = [];
  try {
    var planilla = abrirComoPlanilla(pedido.planillaId, temporales);
    var resultados = corregir(leerPlanilla(planilla.libro));
    var radar = generarImagenRadar(resultados, nombre);

    var nombreArchivo = nombreDeInforme(nombre, inicio);
    var doc = DocumentApp.create(nombreArchivo);
    temporales.push(doc.getId());

    var cuerpo = doc.getBody();
    cuerpo.clear();
    construirInforme(cuerpo, {
      nombre: nombre,
      fecha: Utilities.formatDate(inicio, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
      resultados: resultados,
      imagenRadar: radar
    });
    quitarParrafoInicialVacio(cuerpo);
    doc.saveAndClose();

    var archivo = guardarComoDocx(doc.getId(), nombreArchivo, config.carpetaInformesId);
    var segundos = Math.round((new Date().getTime() - inicio.getTime()) / 100) / 10;

    registrarCorrida(config.historialId, {
      fecha: inicio,
      evaluado: nombre,
      planilla: planilla.nombre,
      informeUrl: archivo.getUrl(),
      usuario: usuarioActual(),
      segundos: segundos
    });

    return {
      informeId: archivo.getId(),
      informeUrl: archivo.getUrl(),
      nombreArchivo: nombreArchivo + '.docx',
      evaluado: nombre,
      segundos: segundos
    };
  } finally {
    descartarTemporales(temporales);
  }
}

/**
 * Abre la planilla de entrada como Google Sheet.
 * Si el archivo es un .xlsx subido, Drive lo convierte al copiarlo; la copia
 * es descartable y se anota para borrarla al final.
 */
function abrirComoPlanilla(archivoId, temporales) {
  var archivo = DriveApp.getFileById(archivoId);
  if (archivo.getMimeType() === MimeType.GOOGLE_SHEETS) {
    return { libro: SpreadsheetApp.openById(archivoId), nombre: archivo.getName() };
  }
  var copia = Drive.Files.copy(
    { name: archivo.getName() + ' (convertida)', mimeType: MimeType.GOOGLE_SHEETS },
    archivoId,
    // Sin esto, el servicio avanzado de Drive no ve los archivos que están en
    // Unidades compartidas y responde "File not found". DriveApp sí las maneja
    // solo, pero la API REST cruda necesita que se lo pidan explícitamente.
    { supportsAllDrives: true }
  );
  temporales.push(copia.id);
  return { libro: SpreadsheetApp.openById(copia.id), nombre: archivo.getName() };
}

/**
 * Exporta el Doc como .docx y lo deja en la carpeta de informes.
 * DocumentApp no sabe exportar: hay que pedirle el .docx al endpoint de
 * exportación de Docs con el token del propio script.
 */
function guardarComoDocx(docId, nombreArchivo, carpetaId) {
  var url = 'https://docs.google.com/feeds/download/documents/export/Export'
    + '?id=' + encodeURIComponent(docId) + '&exportFormat=docx';
  var respuesta = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (respuesta.getResponseCode() !== 200) {
    throw new Error('No se pudo exportar el informe a .docx (código ' + respuesta.getResponseCode() + ').');
  }
  var blob = respuesta.getBlob().setName(nombreArchivo + '.docx');
  return DriveApp.getFolderById(carpetaId).createFile(blob);
}

/** INFORME_Ana Pérez_20260723_181500 — mismo formato que la app actual. */
function nombreDeInforme(nombre, momento) {
  var sello = Utilities.formatDate(momento, Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  return 'INFORME_' + nombre + '_' + sello;
}

/** Un Doc recién creado trae un párrafo vacío que quedaría arriba del título. */
function quitarParrafoInicialVacio(cuerpo) {
  if (cuerpo.getNumChildren() < 2) return;
  var primero = cuerpo.getChild(0);
  if (primero.getType() !== DocumentApp.ElementType.PARAGRAPH) return;
  if (primero.asParagraph().getText() === '') primero.removeFromParent();
}

/** Se ejecuta siempre; que falle un borrado no puede tapar el error original. */
function descartarTemporales(ids) {
  ids.forEach(function (id) {
    try {
      DriveApp.getFileById(id).setTrashed(true);
    } catch (e) {
      console.warn('No se pudo descartar el archivo temporal ' + id + ': ' + e.message);
    }
  });
}
