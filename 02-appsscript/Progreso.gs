/**
 * Progreso de la generación de un informe, para que la interfaz muestre por qué
 * etapa va.
 *
 * Apps Script no permite streaming: `google.script.run` es una sola llamada que
 * devuelve al terminar, así que el servidor no puede empujar el avance. La forma
 * de sostener un progreso real es que la generación deje la etapa en el Cache y
 * el navegador la vaya a buscar con llamadas cortas y aparte.
 *
 * Hasta ahora no valía la pena —la corrida entera tardaba poco más de un
 * segundo, y un spinner alcanzaba—. Con la síntesis del punto 5 la corrida pasó a
 * tardar entre 30 segundos y un par de minutos, y un spinner mudo durante ese
 * rato no distingue "está trabajando" de "se colgó".
 *
 * Las etapas son las de verdad: cada una se marca cuando efectivamente arranca
 * ese trabajo. No hay temporizador que las haga avanzar solas, porque un progreso
 * inventado que corre mientras el proceso está trabado es peor que no tener nada.
 *
 * El identificador de corrida lo genera el navegador y no identifica a nadie: es
 * la clave para encontrar el avance de esta corrida y nada más.
 */

/**
 * Siete etapas, dentro de las "entre 5 y 7" que pidió el PO.
 *
 * El punto 6 sumó "Contrastando con el puesto" y, para no pasarse, las dos
 * etapas de la síntesis se fusionaron en una. Se pierde el detalle de por cuál
 * de los dos bloques va —cada uno tarda unos 25 segundos—, y se gana que la
 * línea siga leyéndose de un vistazo, que es para lo que existe.
 *
 * "Contrastando con el puesto" sólo corre cuando se subió un perfil de puesto.
 * Sin perfil, esa etapa se saltea y su punto se pinta como hecha al pasar a la
 * siguiente: el contador y el nombre de la etapa en curso siguen diciendo la
 * verdad, que es lo que se mira. La alternativa —dos listas de etapas según haya
 * o no perfil— cambia la lista debajo de una barra que ya está dibujada.
 */
var ETAPAS_INFORME = [
  'Abriendo planilla',
  'Corrigiendo respuestas',
  'Armando el gráfico',
  'Redactando la síntesis',
  'Contrastando con el puesto',
  'Componiendo el documento',
  'Guardando en Drive'
];

/**
 * Las etapas del Informe 2, que son otras.
 *
 * No es la misma lista con un nombre cambiado: el flujo es distinto. No hay
 * gráfico —el modelo 2 no lo lleva— y el contraste con el puesto pasa a estar
 * ANTES de la redacción, porque el índice y el riesgo son parte de lo que se le
 * pasa al modelo para escribir el diagnóstico.
 *
 * Son seis contra las siete del otro. La lista viaja a la interfaz, así que la
 * línea de progreso se dibuja sola con la cantidad que corresponda.
 */
var ETAPAS_INFORME_2 = [
  'Abriendo planilla',
  'Corrigiendo respuestas',
  'Contrastando con el puesto',
  'Redactando el informe',
  'Componiendo el documento',
  'Guardando en Drive'
];

// Alcanza para la corrida más lenta que se midió, sin dejar basura en el Cache.
var PROGRESO_SEGUNDOS_VIDA = 900;

function claveDeProgreso(token) {
  return 'progreso-' + token;
}

/**
 * Deja anotada la etapa en curso.
 *
 * Nunca lanza: si el Cache falla, el informe tiene que seguir. Perder el progreso
 * es una molestia; perder el informe, no.
 *
 * @param {string} token identificador de la corrida, o vacío para no registrar
 * @param {number} indice posición en `etapas`
 * @param {Array<string>} etapas la lista del informe que se está generando
 */
function marcarEtapaDe(token, indice, etapas) {
  if (!token) return;
  try {
    CacheService.getScriptCache().put(
      claveDeProgreso(token),
      JSON.stringify({ etapa: indice, total: etapas.length, nombre: etapas[indice] }),
      PROGRESO_SEGUNDOS_VIDA
    );
  } catch (e) {
    console.warn('No se pudo registrar la etapa ' + indice + ': ' + e.message);
  }
}

/** La etapa en curso del Informe 1. */
function marcarEtapa(token, indice) {
  marcarEtapaDe(token, indice, ETAPAS_INFORME);
}

/** La etapa en curso del Informe 2. */
function marcarEtapa2(token, indice) {
  marcarEtapaDe(token, indice, ETAPAS_INFORME_2);
}

/** Borra el progreso al terminar, salga bien o mal. */
function limpiarProgreso(token) {
  if (!token) return;
  try {
    CacheService.getScriptCache().remove(claveDeProgreso(token));
  } catch (e) {
    console.warn('No se pudo limpiar el progreso: ' + e.message);
  }
}

/**
 * Etapa en curso de una corrida. La llama el navegador cada pocos segundos.
 *
 * Verifica el acceso como toda función invocable desde el navegador: que doGet lo
 * haya chequeado no protege a las demás.
 *
 * @param {string} token
 * @return {Object|null} {etapa, total, nombre} o null si todavía no hay nada
 */
function progresoDeInforme(token) {
  var config = configuracion();
  exigirAcceso(config.grupoAutorizado);
  if (!token) return null;
  try {
    var crudo = CacheService.getScriptCache().get(claveDeProgreso(token));
    return crudo ? JSON.parse(crudo) : null;
  } catch (e) {
    return null;
  }
}
