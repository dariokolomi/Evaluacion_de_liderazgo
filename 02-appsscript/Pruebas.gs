/**
 * Prueba de humo, para correr a mano desde el editor de Apps Script.
 *
 * El editor no sabe pasarle argumentos a una función, así que generarInforme()
 * no se puede ejecutar directo desde el botón. Esto es la excusa para hacerlo:
 * toma el ID de la planilla de una propiedad del script y hace una corrida real.
 *
 * Antes de correrla, definir en Propiedades del script:
 *   PLANILLA_PRUEBA_ID = ID del archivo de Drive con la planilla de respuestas
 */

var PROP_PLANILLA_PRUEBA = 'PLANILLA_PRUEBA_ID';

function pruebaDeHumo() {
  var planillaId = PropertiesService.getScriptProperties().getProperty(PROP_PLANILLA_PRUEBA);
  if (!planillaId) {
    throw new Error(
      'Falta la propiedad ' + PROP_PLANILLA_PRUEBA + ' con el ID de la planilla de prueba.'
    );
  }

  var resultado = generarInforme({
    planillaId: planillaId,
    nombreEvaluado: 'Prueba de humo'
  });

  console.log('Informe generado en %s segundos', resultado.segundos);
  console.log('Archivo: %s', resultado.nombreArchivo);
  console.log('Link: %s', resultado.informeUrl);
  return resultado;
}

/**
 * Contrasta la lista de "Últimos informes" contra los archivos reales de Drive.
 *
 * La lista de la app sale del Sheet de historial, no de Drive. Son dos fuentes
 * distintas que nadie mantiene sincronizadas, así que esto responde la pregunta
 * concreta: ¿cada fila tiene su archivo, y cada archivo su fila?
 *
 * No toca nada: informa las diferencias y ya. Qué hacer con cada una es una
 * decisión de quien mira.
 */
function verificarHistorialContraDrive() {
  var config = configuracion();
  var r = compararHistorialConDrive(config.historialId, config.carpetaInformesId);

  console.log('Filas en el historial: %s · Archivos en la carpeta: %s', r.filas, r.archivos);

  if (r.sinArchivo.length) {
    console.warn('%s fila(s) apuntan a un informe que no está en la carpeta:', r.sinArchivo.length);
    r.sinArchivo.forEach(function (f) {
      console.warn('  fila %s · %s · %s', f.fila, f.evaluado, f.motivo);
    });
  }
  if (r.sinUrl.length) {
    console.warn('%s fila(s) sin un link de Drive utilizable:', r.sinUrl.length);
    r.sinUrl.forEach(function (f) {
      console.warn('  fila %s · %s · "%s"', f.fila, f.evaluado, f.informeUrl);
    });
  }
  if (r.sinFila.length) {
    console.warn('%s archivo(s) en la carpeta sin fila en el historial:', r.sinFila.length);
    r.sinFila.forEach(function (a) { console.warn('  %s', a.nombre); });
  }
  if (!r.sinArchivo.length && !r.sinUrl.length && !r.sinFila.length) {
    console.log('Sin diferencias: el historial y la carpeta dicen lo mismo.');
  }
  return r;
}

/**
 * Propiedad que confirma el vaciado del historial.
 *
 * Se pide una propiedad y no un argumento porque el editor no sabe pasarle
 * argumentos a una función: sin esto, `vaciarHistorial` sería un ítem más del
 * desplegable, al lado de las otras, y borrar todo quedaría a un click de
 * distancia de correr un diagnóstico.
 *
 * El valor tiene que ser la CANTIDAD de corridas que informa el simulacro.
 */
var PROP_CONFIRMAR_VACIADO = 'CONFIRMO_VACIAR_HISTORIAL';

/** Muestra qué se borraría del historial. No toca nada. */
function simularVaciadoDelHistorial() {
  var config = configuracion();
  var filas = contarCorridas(config.historialId);
  if (!filas) {
    console.log('El historial ya está vacío: no hay nada que borrar.');
    return 0;
  }
  console.log('Se borrarían %s corrida(s), dejando sólo el encabezado.', filas);
  console.log('Antes de borrar se copia todo a una hoja "%s<fecha>" del mismo libro.',
    HOJA_RESPALDO_PREFIJO);
  console.log('Para confirmar: definir la propiedad de script %s = %s y correr vaciarHistorial().',
    PROP_CONFIRMAR_VACIADO, filas);
  return filas;
}

/**
 * Vacía el historial. Exige que la propiedad de confirmación traiga la cantidad
 * exacta de corridas que hay.
 *
 * La propiedad se borra al terminar, así que una segunda corrida por accidente no
 * hace nada: hay que volver a confirmar a propósito.
 */
function vaciarHistorial() {
  var config = configuracion();
  var propiedades = PropertiesService.getScriptProperties();
  var confirmacion = propiedades.getProperty(PROP_CONFIRMAR_VACIADO);
  if (!confirmacion) {
    throw new Error(
      'Falta confirmar. Corré simularVaciadoDelHistorial(), y después definí la propiedad '
      + PROP_CONFIRMAR_VACIADO + ' con la cantidad de corridas que informó.'
    );
  }

  var resultado = vaciarCorridas(config.historialId, Number(confirmacion));
  propiedades.deleteProperty(PROP_CONFIRMAR_VACIADO);

  if (!resultado.borradas) {
    console.log('El historial ya estaba vacío.');
    return resultado;
  }
  console.log('Borradas %s corrida(s). Respaldo en la hoja "%s" del mismo libro.',
    resultado.borradas, resultado.respaldo);
  return resultado;
}

/** Verifica la configuración y el acceso sin generar nada. */
function verificarConfiguracion() {
  var config = configuracion();
  console.log('Carpeta de informes: %s', config.carpetaInformesId);
  console.log('Historial: %s', config.historialId);
  console.log('Grupo autorizado: %s', config.grupoAutorizado);
  console.log('Usuario actual: %s', usuarioActual());
  console.log('¿Autorizado?: %s', usuarioAutorizado(config.grupoAutorizado));
  return config;
}
