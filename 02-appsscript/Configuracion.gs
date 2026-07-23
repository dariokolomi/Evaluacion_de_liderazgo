/**
 * Configuración del proyecto.
 *
 * Nada de esto se hardcodea: los IDs de Drive y el grupo autorizado cambian
 * entre el entorno de prueba y el real, y un ID pegado en el código es un
 * cambio de código cada vez. Se cargan de las Propiedades del Script
 * (Configuración del proyecto → Propiedades del script).
 */

var PROP_CARPETA_INFORMES = 'CARPETA_INFORMES_ID';
var PROP_HISTORIAL = 'HISTORIAL_SHEET_ID';
var PROP_GRUPO_AUTORIZADO = 'GRUPO_AUTORIZADO';

var DESCRIPCION_PROPIEDADES = {};
DESCRIPCION_PROPIEDADES[PROP_CARPETA_INFORMES] = 'ID de la carpeta de la Unidad compartida donde se guardan los informes';
DESCRIPCION_PROPIEDADES[PROP_HISTORIAL] = 'ID del Google Sheet de historial y calificaciones';
DESCRIPCION_PROPIEDADES[PROP_GRUPO_AUTORIZADO] = 'Dirección del Grupo de Google que puede usar la app (ej. informes-rrhh@kolektor.com.ar)';

/**
 * @return {Object} {carpetaInformesId, historialId, grupoAutorizado}
 * @throws {Error} si falta alguna propiedad, diciendo cuál y para qué es.
 */
function configuracion() {
  var propiedades = PropertiesService.getScriptProperties().getProperties();
  var faltantes = [];
  [PROP_CARPETA_INFORMES, PROP_HISTORIAL, PROP_GRUPO_AUTORIZADO].forEach(function (clave) {
    if (!propiedades[clave]) faltantes.push(clave + ' (' + DESCRIPCION_PROPIEDADES[clave] + ')');
  });
  if (faltantes.length) {
    throw new Error(
      'Falta configurar el proyecto. Definir en Propiedades del script: ' + faltantes.join(' · ')
    );
  }
  return {
    carpetaInformesId: propiedades[PROP_CARPETA_INFORMES],
    historialId: propiedades[PROP_HISTORIAL],
    grupoAutorizado: propiedades[PROP_GRUPO_AUTORIZADO]
  };
}
