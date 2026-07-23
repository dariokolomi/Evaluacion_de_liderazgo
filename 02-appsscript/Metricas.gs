/**
 * Métricas del historial — port de /api/metrics (app.py:262-307).
 *
 * metricasDe() es pura: recibe las corridas y devuelve los números. No toca
 * Sheets ni Drive, así que se verifica sin simular nada.
 *
 * Una métrica del tablero actual no se porta: "calidad por modelo" perdió
 * sentido cuando desapareció el archivo modelo. En su lugar va la distribución
 * de calificaciones, que responde la misma pregunta —cómo viene saliendo el
 * informe— sin depender de algo que ya no existe.
 */

var DIAS_EN_TABLERO = 30;
var CORRIDAS_EN_TENDENCIA = 30;
var CORRIDAS_EN_TIEMPOS = 50;
var CALIFICACIONES_PARA_ALERTA = 3;
var UMBRAL_DE_ALERTA = 3;

/** yyyy-mm-dd en hora local: con toISOString, una corrida de la tarde puede caer al día siguiente. */
function claveDeFecha(valor) {
  if (valor instanceof Date) {
    var mes = String(valor.getMonth() + 1);
    var dia = String(valor.getDate());
    return valor.getFullYear()
      + '-' + (mes.length < 2 ? '0' + mes : mes)
      + '-' + (dia.length < 2 ? '0' + dia : dia);
  }
  return String(valor).slice(0, 10);
}

function promedio(numeros) {
  if (!numeros.length) return 0;
  var suma = numeros.reduce(function (a, b) { return a + b; }, 0);
  return suma / numeros.length;
}

function redondear(numero, decimales) {
  var factor = Math.pow(10, decimales);
  return Math.round(numero * factor) / factor;
}

/**
 * @param {Array<Object>} corridas las que devuelve leerCorridas(), de la más
 *   nueva a la más vieja.
 * @return {Object} números listos para dibujar.
 */
function metricasDe(corridas) {
  // De la más vieja a la más nueva: las series temporales se leen así.
  var cronologicas = corridas.slice().reverse();
  var calificadas = cronologicas.filter(function (c) { return Number(c.calificacion) > 0; });
  var total = cronologicas.length;

  var puntajes = calificadas.map(function (c) { return Number(c.calificacion); });
  var tiempos = cronologicas
    .map(function (c) { return Number(c.segundos); })
    .filter(function (s) { return s > 0; });

  // Informes por día
  var conteoPorFecha = {};
  cronologicas.forEach(function (c) {
    var clave = claveDeFecha(c.fecha);
    conteoPorFecha[clave] = (conteoPorFecha[clave] || 0) + 1;
  });
  var porFecha = Object.keys(conteoPorFecha).sort().slice(-DIAS_EN_TABLERO).map(function (fecha) {
    return { fecha: fecha, cantidad: conteoPorFecha[fecha] };
  });

  // Distribución de calificaciones
  var distribucion = [1, 2, 3, 4, 5].map(function (puntaje) {
    return {
      puntaje: puntaje,
      cantidad: puntajes.filter(function (p) { return p === puntaje; }).length
    };
  });

  // Promedio por persona evaluada, de mejor a peor
  var porPersona = {};
  calificadas.forEach(function (c) {
    if (!porPersona[c.evaluado]) porPersona[c.evaluado] = [];
    porPersona[c.evaluado].push(Number(c.calificacion));
  });
  var porEvaluado = Object.keys(porPersona).map(function (evaluado) {
    return {
      evaluado: evaluado,
      promedio: redondear(promedio(porPersona[evaluado]), 2),
      cantidad: porPersona[evaluado].length
    };
  }).sort(function (a, b) { return b.promedio - a.promedio; });

  // Alerta: si las últimas calificaciones vienen flojas, algo se rompió
  var ultimas = puntajes.slice(-5);
  var alerta = ultimas.length >= CALIFICACIONES_PARA_ALERTA
    && promedio(ultimas) < UMBRAL_DE_ALERTA;

  return {
    total: total,
    calificados: calificadas.length,
    promedioCalificacion: redondear(promedio(puntajes), 2),
    promedioSegundos: redondear(promedio(tiempos), 1),
    porcentajeCalificado: total ? Math.round(calificadas.length / total * 100) : 0,
    porFecha: porFecha,
    distribucion: distribucion,
    tendencia: calificadas.slice(-CORRIDAS_EN_TENDENCIA).map(function (c) {
      return {
        fecha: claveDeFecha(c.fecha),
        calificacion: Number(c.calificacion),
        evaluado: c.evaluado
      };
    }),
    tiempos: tiempos.slice(-CORRIDAS_EN_TIEMPOS),
    porEvaluado: porEvaluado,
    alerta: alerta
  };
}
