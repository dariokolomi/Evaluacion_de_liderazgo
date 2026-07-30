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
 * @param {Object} pedido {planillaId, nombreEvaluado, token, puesto}
 *   `puesto` es lo que devolvió `subirPerfilDePuesto` y es OPCIONAL: sin él el
 *   informe sale con las cinco secciones de siempre.
 * @return {Object} {informeId, informeUrl, nombreArchivo, codigo, evaluado, segundos}
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

  // El navegador manda un identificador para poder seguir el avance. Si no viene
  // —por ejemplo, si generarInforme se llama desde el editor— no se registra nada
  // y todo funciona igual. Ver Progreso.gs.
  var token = (pedido && pedido.token) || '';

  // La lectura del perfil de puesto ya se hizo al subir el archivo: acá sólo se
  // usa. Ver Puesto.gs — la corrida no tiene presupuesto para leerlo.
  var lecturaDePuesto = sanearLecturaDePuesto(pedido && pedido.puesto);

  var temporales = [];
  try {
    marcarEtapa(token, 0);
    var planilla = abrirComoPlanilla(pedido.planillaId, temporales);

    marcarEtapa(token, 1);
    var resultados = corregir(leerPlanilla(planilla.libro));

    marcarEtapa(token, 2);
    var radar = generarImagenRadar(resultados, nombre);

    // El plazo del LLM se abre acá y lo comparten la síntesis del punto 5 y la
    // narrativa del punto 6: son dos secciones del mismo informe y los seis
    // minutos de Apps Script son uno solo. Ver LLM_PLAZO_MS en Sintesis.gs.
    var vencimiento = new Date().getTime() + LLM_PLAZO_MS;

    // Devuelve null si el LLM no está configurado o no contestó a tiempo; en ese
    // caso el punto 5 sale con la síntesis determinista. Ver Sintesis.gs.
    // Las dos etapas de la síntesis las marca el propio módulo, que es el que
    // sabe cuándo arranca cada bloque.
    var intentoSintesis = sintesisDeLiderazgo(nombre, resultados, function (bloque) {
      marcarEtapa(token, bloque === 0 ? 3 : 4);
    }, vencimiento);
    var sintesis = intentoSintesis.sintesis;

    // El punto 6, si se subió un perfil de puesto. Los números y las tablas son
    // deterministas; sólo la prosa pasa por el modelo, y si no sale, sale la fija.
    var puesto = null;
    if (lecturaDePuesto) {
      marcarEtapa(token, 5);
      puesto = adecuacionAlPuesto(lecturaDePuesto, resultados);
      var intentoNarrativa = narrativaDelPuesto(puesto, resultados, vencimiento);
      puesto.narrativa = ponerNombreEnNarrativa(intentoNarrativa.narrativa, nombre);
      puesto.narrativaMotivo = intentoNarrativa.motivo;
    }

    marcarEtapa(token, 6);
    var codigo = reservarCodigo(config.historialId);
    var nombreArchivo = nombreDeInforme(codigo, nombre, inicio);
    var doc = DocumentApp.create(nombreArchivo);
    temporales.push(doc.getId());

    var cuerpo = doc.getBody();
    cuerpo.clear();
    construirInforme(cuerpo, {
      nombre: nombre,
      fecha: Utilities.formatDate(inicio, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
      resultados: resultados,
      imagenRadar: radar,
      sintesis: sintesis,
      puesto: puesto
    });
    quitarParrafoInicialVacio(cuerpo);
    doc.saveAndClose();

    marcarEtapa(token, 7);
    var archivo = guardarComoDocx(doc.getId(), nombreArchivo, config.carpetaInformesId);

    // Los insumos se renombran DESPUÉS de que el informe existe: si la corrida se
    // cae antes, los archivos quedan con el nombre con el que se subieron y no
    // con el código de un informe que no llegó a generarse.
    var nombrePlanilla = renombrarInsumo(pedido.planillaId, codigo, 'PLANILLA', nombre);
    var nombrePerfil = lecturaDePuesto
      ? renombrarInsumo(lecturaDePuesto.id, codigo, 'PERFIL',
          lecturaDePuesto.puesto || lecturaDePuesto.nombre)
      : '';

    var segundos = Math.round((new Date().getTime() - inicio.getTime()) / 100) / 10;

    registrarCorrida(config.historialId, {
      fecha: inicio,
      evaluado: nombre,
      planilla: nombrePlanilla || planilla.nombre,
      informeUrl: archivo.getUrl(),
      usuario: usuarioActual(),
      segundos: segundos,
      codigo: codigo,
      perfilPuesto: nombrePerfil
    });

    return {
      informeId: archivo.getId(),
      informeUrl: archivo.getUrl(),
      nombreArchivo: nombreArchivo + '.docx',
      codigo: codigo,
      evaluado: nombre,
      segundos: segundos,
      // Para que la interfaz pueda avisar cuando el punto 5 salió con el texto
      // determinista, y por qué. Sin esto el informe sale pobre en silencio y hay
      // que adivinar si fue la clave, la cuota o una validación.
      sintesisAsistida: !!sintesis,
      sintesisMotivo: intentoSintesis.motivo,
      conPuesto: !!puesto,
      adecuacion: puesto ? puesto.porcentaje : null
    };
  } finally {
    descartarTemporales(temporales);
    limpiarProgreso(token);
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

/**
 * A01-INFORME Ana Pérez 20260723-1815
 *
 * El formato cambió respecto de la app anterior (`INFORME_Ana Pérez_20260723_181500`):
 * adelante va el código de la evaluación, los guiones bajos pasan a espacios y el
 * sello pierde los segundos. Los segundos estaban para desempatar dos informes de
 * la misma persona; ahora los desempata el código, que además es único por
 * evaluación y no depende del reloj.
 */
function nombreDeInforme(codigo, nombre, momento) {
  var sello = Utilities.formatDate(momento, Session.getScriptTimeZone(), 'yyyyMMdd-HHmm');
  return codigo + '-INFORME ' + nombre + ' ' + sello;
}

/**
 * Un texto reducido a nombre de archivo.
 *
 * Los separadores de ruta se cambian por guiones: un nombre con barras no puede
 * crear carpetas en Drive, pero sí queda ilegible en la lista.
 *
 * Vive acá y no en WebApp.gs —donde nació, para los nombres que manda el
 * navegador— porque ahora también lo usa el renombrado de los insumos, y los
 * nombres de archivo se arman en este módulo.
 */
function nombreDeArchivoSeguro(nombre) {
  return String(nombre).replace(/[\/\\]+/g, '-').trim();
}

/**
 * Le pone el código de la evaluación a un archivo de entrada.
 *
 * Con los informes, las planillas y los perfiles de puesto conviviendo en Drive,
 * el código es lo único que dice qué archivo va con qué informe: ordenando la
 * carpeta por nombre, los tres de una evaluación quedan juntos.
 *
 * Nunca lanza. El informe ya está guardado cuando esto corre, y perder el informe
 * por no haber podido renombrar un insumo —permisos, un archivo movido a mano—
 * sería cambiar algo importante por algo cosmético.
 *
 * OJO: si la misma planilla se reutiliza en dos corridas, queda con el código de
 * la última. El historial guarda el nombre con el que se usó en cada una, así que
 * la corrida vieja sigue siendo rastreable.
 *
 * @return {string} el nombre nuevo, o '' si no se pudo renombrar
 */
function renombrarInsumo(archivoId, codigo, tipo, base) {
  if (!archivoId) return '';
  try {
    var archivo = DriveApp.getFileById(archivoId);
    var extension = '';
    var punto = archivo.getName().lastIndexOf('.');
    if (punto > 0) extension = archivo.getName().slice(punto);
    var nombre = codigo + '-' + tipo + ' ' + nombreDeArchivoSeguro(base) + extension;
    archivo.setName(nombre);
    return nombre;
  } catch (e) {
    console.warn('No se pudo renombrar el ' + tipo.toLowerCase() + ' ' + archivoId
      + ': ' + e.message);
    return '';
  }
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
