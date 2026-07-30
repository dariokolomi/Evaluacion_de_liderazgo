/**
 * Historial de corridas y calificaciones.
 *
 * Reemplaza a .runs_history.json, que además de no ser una base de datos no
 * tenía lock de escritura: dos corridas simultáneas se pisaban. Un Sheet
 * serializa los appends por su cuenta, así que registrar una corrida no necesita
 * lock.
 *
 * Calificar sí: no es un append sino un leer-validar-escribir sobre una fila que
 * ya existe, y eso el Sheet no lo serializa. Ver `calificarCorrida`.
 *
 * Las columnas siguen las del Excel de calidad que arma hoy la app
 * (app.py:42-50), menos "Modelo": ya no hay archivo modelo que elegir.
 */

var HISTORIAL_HOJA = 'Corridas';

/**
 * OJO CON EL ORDEN: las columnas nuevas van AL FINAL, nunca en el medio.
 * `COL_CALIFICACION` y `COL_COMENTARIO` son posiciones fijas y `Metricas.gs` lee
 * por índice; insertar una columna adelante correría las calificaciones ya
 * cargadas sin que nada avise. Los historiales existentes se completan solos: las
 * filas viejas quedan con las celdas nuevas vacías.
 */
var HISTORIAL_COLUMNAS = [
  'Fecha', 'Evaluado', 'Planilla', 'Informe', 'Generado por',
  'Segundos', 'Calificación', 'Comentario', 'Código', 'Perfil de puesto'
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
    return hoja;
  }
  completarEncabezado(hoja);
  return hoja;
}

/**
 * Completa el encabezado de un historial creado antes de que existieran las
 * columnas nuevas.
 *
 * No toca ninguna fila de datos: sólo escribe los rótulos que faltan. Sin esto,
 * las corridas nuevas escribirían el código en una columna sin nombre y quien
 * abriera la planilla vería dos columnas sueltas sin saber qué son.
 */
function completarEncabezado(hoja) {
  if (hoja.getMaxColumns() < HISTORIAL_COLUMNAS.length) {
    hoja.insertColumnsAfter(hoja.getMaxColumns(),
      HISTORIAL_COLUMNAS.length - hoja.getMaxColumns());
  }
  var rango = hoja.getRange(1, 1, 1, HISTORIAL_COLUMNAS.length);
  var actual = rango.getValues()[0];
  var faltan = false;
  for (var i = 0; i < HISTORIAL_COLUMNAS.length; i++) {
    if (!actual[i]) faltan = true;
  }
  if (!faltan) return;
  rango.setValues([HISTORIAL_COLUMNAS]);
}

var COL_CALIFICACION = 7;
var COL_COMENTARIO = 8;

/**
 * Registra una corrida.
 * @param {Object} corrida {fecha, evaluado, planilla, informeUrl, usuario, segundos,
 *   codigo, perfilPuesto}
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
    '',
    corrida.codigo || '',
    corrida.perfilPuesto || ''
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
      comentario: fila[7],
      codigo: fila[8],
      perfilPuesto: fila[9]
    };
  }).reverse();
}

/**
 * Cuánto se espera por el lock antes de darse por vencido.
 *
 * La escritura en sí es de milisegundos; diez segundos alcanzan para varias
 * esperas encoladas y siguen siendo un tiempo que un botón puede sostener sin
 * que parezca colgado.
 */
/**
 * Saca el ID de Drive de la URL guardada en el historial.
 *
 * `registrarCorrida` guarda lo que devuelve `archivo.getUrl()`, que hoy tiene la
 * forma `https://drive.google.com/file/d/<id>/view?usp=drivesdk`. Se contempla
 * también la forma vieja con `?id=<id>`, porque el historial es acumulativo y
 * puede tener filas de cuando Drive devolvía la otra.
 *
 * @return {string} el ID, o '' si la URL no tiene forma de link de Drive
 */
function idDeUrlDeDrive(url) {
  var texto = String(url || '');
  var porRuta = texto.match(/\/d\/([-\w]+)/);
  if (porRuta) return porRuta[1];
  var porQuery = texto.match(/[?&]id=([-\w]+)/);
  return porQuery ? porQuery[1] : '';
}

/**
 * Compara el historial contra los archivos que hay de verdad en la carpeta.
 *
 * Existe porque "Últimos informes" NO lee Drive: sale del Sheet. Las dos fuentes
 * pueden separarse sin que nadie se entere —un informe borrado a mano, uno movido
 * de carpeta, uno generado cuando el registro falló— y la lista seguiría
 * mostrando links que no llevan a ningún lado.
 *
 * Es sólo de lectura: informa, no corrige. Qué hacer con una diferencia es una
 * decisión de quien mira, no del script.
 *
 * @return {Object} {filas, archivos, sinArchivo[], sinFila[], sinUrl[]}
 */
function compararHistorialConDrive(historialId, carpetaId, limite) {
  var corridas = leerCorridas(historialId, limite || 5000);

  var enCarpeta = {};
  var archivos = DriveApp.getFolderById(carpetaId).getFiles();
  while (archivos.hasNext()) {
    var archivo = archivos.next();
    enCarpeta[archivo.getId()] = archivo.getName();
  }

  var sinArchivo = [];
  var sinUrl = [];
  var referenciados = {};

  corridas.forEach(function (corrida) {
    var id = idDeUrlDeDrive(corrida.informeUrl);
    if (!id) {
      // Fila sin link utilizable: no se puede ni buscar el archivo.
      sinUrl.push({ fila: corrida.fila, evaluado: corrida.evaluado, informeUrl: corrida.informeUrl });
      return;
    }
    referenciados[id] = true;
    if (enCarpeta[id]) return;

    // No está en la carpeta. Distinguir por qué: borrado, en la papelera o movido
    // a otro lado son tres problemas distintos y se arreglan distinto.
    var motivo;
    try {
      motivo = DriveApp.getFileById(id).isTrashed()
        ? 'en la papelera'
        : 'fuera de la carpeta de informes';
    } catch (e) {
      motivo = 'no existe';
    }
    sinArchivo.push({ fila: corrida.fila, evaluado: corrida.evaluado, id: id, motivo: motivo });
  });

  var sinFila = Object.keys(enCarpeta)
    .filter(function (id) { return !referenciados[id]; })
    .map(function (id) { return { id: id, nombre: enCarpeta[id] }; });

  return {
    filas: corridas.length,
    archivos: Object.keys(enCarpeta).length,
    sinArchivo: sinArchivo,
    sinFila: sinFila,
    sinUrl: sinUrl
  };
}

// ═══════════════════════════════════════════════════════════════════
// El código de cada evaluación
// ═══════════════════════════════════════════════════════════════════

/**
 * Contador de códigos. Vive en las Propiedades del script y no en la planilla.
 *
 * POR QUÉ NO CONTAR LAS FILAS DEL HISTORIAL, que sería lo obvio: el código se
 * necesita ANTES de registrar la corrida —va en el nombre del archivo— y la fila
 * se escribe al final. Contar filas daría el mismo número a dos informes que se
 * generan a la vez, y el nombre del archivo es justamente donde un duplicado
 * duele: dos evaluaciones distintas con el mismo código en la carpeta.
 */
var PROP_ULTIMO_CODIGO = 'ULTIMO_CODIGO';

/** Cuántos códigos entran con una letra: A01…A99. Después sigue B01. */
var CODIGOS_POR_LETRA = 99;

/**
 * El código correlativo número n: 1 → A01, 99 → A99, 100 → B01.
 *
 * Pasada la Z sigue con dos letras (AA01), que es un caso que no va a llegar
 * —son 2574 evaluaciones— pero que si llegara no puede devolver un código roto ni
 * repetir uno viejo.
 */
function codigoDeNumero(n) {
  var indice = Math.floor((n - 1) / CODIGOS_POR_LETRA);
  var numero = ((n - 1) % CODIGOS_POR_LETRA) + 1;
  return letrasDeIndice(indice) + (numero < 10 ? '0' : '') + numero;
}

/** 0 → A, 25 → Z, 26 → AA, 27 → AB. */
function letrasDeIndice(indice) {
  var letras = '';
  var n = indice;
  do {
    letras = String.fromCharCode(65 + (n % 26)) + letras;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letras;
}

/**
 * Reserva el próximo código y lo devuelve.
 *
 * Toma el lock por lo mismo que `calificarCorrida`: es un leer-sumar-escribir, y
 * dos corridas simultáneas leerían el mismo número. Es el único lugar donde un
 * duplicado no se puede arreglar después.
 *
 * La primera vez, el contador se siembra con las corridas que ya hay: así el
 * historial existente no se pisa y los códigos siguen desde donde corresponde.
 *
 * SI LA CORRIDA FALLA DESPUÉS DE RESERVAR, ese código queda salteado. Es a
 * propósito: un hueco en la secuencia es inofensivo —se ve y se explica—, y un
 * código repetido en dos informes archivados no se arregla nunca.
 */
function reservarCodigo(historialId) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(ESPERA_LOCK_MS);
  } catch (e) {
    throw new Error('Hay otra generación en curso. Probá de nuevo en unos segundos.');
  }

  try {
    var propiedades = PropertiesService.getScriptProperties();
    // El crudo se mira antes de convertir: `Number(null)` es 0, así que preguntar
    // por el número no distingue "todavía no hay contador" de "va por el cero", y
    // el historial existente se pisaría desde A01.
    var crudo = propiedades.getProperty(PROP_ULTIMO_CODIGO);
    var guardado = crudo ? Number(crudo) : NaN;
    var ultimo = guardado >= 0 ? guardado : contarCorridas(historialId);
    var siguiente = ultimo + 1;
    propiedades.setProperty(PROP_ULTIMO_CODIGO, String(siguiente));
    return codigoDeNumero(siguiente);
  } finally {
    lock.releaseLock();
  }
}

var HOJA_RESPALDO_PREFIJO = 'Corridas-respaldo-';

/** Cuántas corridas hay registradas, sin contar el encabezado. No toca nada. */
function contarCorridas(historialId) {
  return Math.max(0, hojaDeHistorial(historialId).getLastRow() - 1);
}

/**
 * Vacía el historial dejando sólo el encabezado.
 *
 * DOS SALVAGUARDAS, porque esto no se deshace y se dispara desde un desplegable
 * del editor donde errarle al click cuesta un solo pixel:
 *
 *   1. Antes de borrar, copia la hoja entera a `Corridas-respaldo-<fecha>` dentro
 *      del mismo libro. El respaldo se hace primero: si falla, no se borra nada.
 *   2. Hay que declarar cuántas filas se espera borrar. Si no coinciden, no toca
 *      nada. Cubre el caso de haber corrido el simulacro, haberse distraído, y
 *      que en el medio se haya generado un informe más.
 *
 * Toma el lock por lo mismo que `calificarCorrida`: es un leer-validar-escribir,
 * y acá una calificación simultánea escribiría sobre filas que están por
 * desaparecer.
 *
 * @param {number} filasEsperadas cuántas corridas se espera borrar
 * @return {Object} {borradas, respaldo}
 */
function vaciarCorridas(historialId, filasEsperadas) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(ESPERA_LOCK_MS);
  } catch (e) {
    throw new Error('El historial está siendo usado en este momento. Probá de nuevo en unos segundos.');
  }

  try {
    var hoja = hojaDeHistorial(historialId);
    var filas = hoja.getLastRow() - 1;
    if (filas <= 0) return { borradas: 0, respaldo: null };

    if (filas !== filasEsperadas) {
      throw new Error(
        'Se esperaba borrar ' + filasEsperadas + ' corrida(s) y hay ' + filas + '. '
        + 'No se borró nada: volvé a correr el simulacro y confirmá con el número nuevo.'
      );
    }

    // El respaldo va antes del borrado, no después: si copyTo falla, el historial
    // sigue entero. Al revés, un fallo dejaría los datos perdidos sin copia.
    var nombre = HOJA_RESPALDO_PREFIJO
      + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmm');
    hoja.copyTo(SpreadsheetApp.openById(historialId)).setName(nombre);

    hoja.deleteRows(2, filas);
    return { borradas: filas, respaldo: nombre };
  } finally {
    lock.releaseLock();
  }
}

var ESPERA_LOCK_MS = 10000;

/**
 * Guarda la calificación de una corrida.
 *
 * Valida la fila contra el tamaño real de la hoja: el número viene del
 * navegador, y con un número cualquiera se escribiría sobre el encabezado o
 * fuera del rango.
 *
 * POR QUÉ HAY UN LOCK ACÁ Y NO EN `registrarCorrida`: registrar es un append, que
 * el Sheet serializa solo. Calificar es leer el tamaño de la hoja, validar contra
 * él y recién después escribir. Ese trío no es atómico, así que dos personas
 * calificando la misma corrida a la vez se pisan y gana la última, sin aviso. Con
 * un solo usuario era imposible; con el PO adentro pasa a ser un caso real.
 */
function calificarCorrida(historialId, fila, calificacion, comentario) {
  // El puntaje no toca la hoja: se valida antes de pedir el lock, para no hacer
  // esperar a nadie por un dato que ya sabemos que está mal.
  var puntaje = Number(calificacion);
  if (!(puntaje >= 1 && puntaje <= 5)) {
    throw new Error('La calificación tiene que ser un número del 1 al 5.');
  }

  // getScriptLock y no getUserLock: lo que hay que serializar son dos PERSONAS
  // escribiendo a la vez. El lock de usuario serializa a alguien consigo mismo,
  // que es justo el caso que no importa.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(ESPERA_LOCK_MS);
  } catch (e) {
    // El error de Apps Script no le dice nada a quien está usando la app.
    throw new Error('Otra persona está calificando en este momento. Probá de nuevo en unos segundos.');
  }

  try {
    // La validación de la fila lee la hoja, así que va adentro del lock: es la
    // primera mitad del leer-validar-escribir. Afuera validaría contra un tamaño
    // que puede haber cambiado para cuando se escriba.
    var hoja = hojaDeHistorial(historialId);
    var numero = Number(fila);
    if (!(numero >= 2 && numero <= hoja.getLastRow())) {
      throw new Error('La corrida indicada no existe en el historial.');
    }
    // Una sola escritura en vez de dos: las columnas son contiguas, así que es una
    // llamada a la API en lugar de dos y no existe el estado intermedio en el que
    // quedó guardado el puntaje pero todavía no el comentario.
    hoja.getRange(numero, COL_CALIFICACION, 1, 2)
      .setValues([[puntaje, String(comentario || '').slice(0, 500)]]);
  } finally {
    // En el finally para que el lock se suelte también cuando la fila es inválida:
    // un lock que queda tomado por un error de validación bloquea a todos los demás
    // hasta que expire.
    lock.releaseLock();
  }
}
