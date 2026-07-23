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
