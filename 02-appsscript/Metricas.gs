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

var CORRIDAS_EN_TENDENCIA = 30;
var CORRIDAS_EN_TIEMPOS = 50;
var CALIFICACIONES_PARA_ALERTA = 3;
var UMBRAL_DE_ALERTA = 3;

/**
 * Cuántos períodos entran en el gráfico de actividad, por granularidad.
 *
 * La semana es la que se muestra por defecto: el día es demasiado ruidoso para
 * ver una tendencia —hay días sin ninguna corrida— y el mes tarda demasiado en
 * decir algo. Doce semanas son un trimestre, que es el horizonte en el que se
 * mira si el uso crece o se apaga.
 */
var PERIODOS_EN_TABLERO = { dia: 30, semana: 12, mes: 12 };

var GRANULARIDADES = ['dia', 'semana', 'mes'];

var MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

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

/**
 * Se llama `promedioDe` y no `promedio` porque en Apps Script todos los archivos
 * comparten un único ámbito global, y `Perfil.gs` ya define un `promedio()`.
 * Convivían por casualidad: son casi iguales, salvo que el de Perfil.gs devuelve
 * NaN con la lista vacía y éste devuelve 0. Con el historial recién creado, o sin
 * ninguna calificación cargada, el tablero mostraba "NaN" según cuál de los dos
 * archivo cargara último.
 */
function promedioDe(numeros) {
  if (!numeros.length) return 0;
  var suma = numeros.reduce(function (a, b) { return a + b; }, 0);
  return suma / numeros.length;
}

function redondear(numero, decimales) {
  var factor = Math.pow(10, decimales);
  return Math.round(numero * factor) / factor;
}

// ═══════════════════════════════════════════════════════════════════
// Períodos
// ═══════════════════════════════════════════════════════════════════

/** Una fecha que puede venir como Date o como texto del Sheet, siempre Date. */
function comoFecha(valor) {
  if (valor instanceof Date) return valor;
  var texto = String(valor);
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  // Con `new Date('2026-07-20')` el navegador interpreta UTC y la fecha se corre
  // un día para atrás en Buenos Aires. Construida por partes, es local.
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(texto);
}

/**
 * El comienzo del período que contiene a `fecha`, a medianoche local.
 * La semana empieza el lunes: es lo que se entiende por "esta semana" en una
 * oficina, y evita el enredo de la numeración ISO cuando el año arranca a mitad
 * de semana.
 */
function inicioDePeriodo(fecha, granularidad) {
  var d = comoFecha(fecha);
  if (granularidad === 'mes') return new Date(d.getFullYear(), d.getMonth(), 1);
  var dia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (granularidad === 'semana') {
    // getDay(): 0 es domingo. El lunes queda a 6 días del domingo, no a -1.
    var desdeLunes = (dia.getDay() + 6) % 7;
    dia.setDate(dia.getDate() - desdeLunes);
  }
  return dia;
}

/** El período anterior al que empieza en `inicio`. */
function periodoAnterior(inicio, granularidad) {
  if (granularidad === 'mes') return new Date(inicio.getFullYear(), inicio.getMonth() - 1, 1);
  var dias = granularidad === 'semana' ? 7 : 1;
  return new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() - dias);
}

/** Clave ordenable del período: yyyy-mm-dd, o yyyy-mm para el mes. */
function claveDePeriodo(fecha, granularidad) {
  var inicio = inicioDePeriodo(fecha, granularidad);
  var clave = claveDeFecha(inicio);
  return granularidad === 'mes' ? clave.slice(0, 7) : clave;
}

/** Cómo se lee el período en el eje del gráfico. */
function etiquetaDePeriodo(clave, granularidad) {
  var partes = String(clave).split('-');
  if (granularidad === 'mes') {
    return MESES_CORTOS[Number(partes[1]) - 1] + ' ' + partes[0].slice(2);
  }
  return partes[2] + '/' + partes[1];
}

/**
 * La serie de actividad, sin agujeros.
 *
 * Los períodos vacíos van con cantidad 0 en vez de faltar. Si se saltearan, dos
 * semanas sin una sola corrida quedarían pegadas en el gráfico y la caída no se
 * vería: el hueco es justamente el dato.
 *
 * La serie termina en el período que contiene a `ahora`, no en el de la última
 * corrida, por el mismo motivo — que nadie haya generado nada esta semana tiene
 * que verse.
 */
function serieDePeriodos(cronologicas, granularidad, ahora) {
  var cantidad = PERIODOS_EN_TABLERO[granularidad];
  var conteo = {};
  var usuarios = {};
  cronologicas.forEach(function (c) {
    var clave = claveDePeriodo(c.fecha, granularidad);
    conteo[clave] = (conteo[clave] || 0) + 1;
    if (!usuarios[clave]) usuarios[clave] = {};
    usuarios[clave][c.usuario || '(sin usuario)'] = true;
  });

  var serie = [];
  var inicio = inicioDePeriodo(ahora, granularidad);
  for (var i = 0; i < cantidad; i++) {
    var clave = claveDePeriodo(inicio, granularidad);
    serie.unshift({
      clave: clave,
      etiqueta: etiquetaDePeriodo(clave, granularidad),
      cantidad: conteo[clave] || 0,
      usuarios: Object.keys(usuarios[clave] || {}).length
    });
    inicio = periodoAnterior(inicio, granularidad);
  }
  return serie;
}

/**
 * El período en curso comparado con el anterior.
 * La variación es la pregunta que se hace mirando el tablero —¿venimos más o
 * menos que la semana pasada?— y restar dos barras a ojo no es leerla.
 */
function resumenDePeriodo(cronologicas, granularidad, ahora) {
  var claveActual = claveDePeriodo(ahora, granularidad);
  var claveAnterior = claveDePeriodo(periodoAnterior(inicioDePeriodo(ahora, granularidad), granularidad), granularidad);

  var delActual = cronologicas.filter(function (c) {
    return claveDePeriodo(c.fecha, granularidad) === claveActual;
  });
  var delAnterior = cronologicas.filter(function (c) {
    return claveDePeriodo(c.fecha, granularidad) === claveAnterior;
  });

  var distintos = function (corridas, campo) {
    var vistos = {};
    corridas.forEach(function (c) { vistos[c[campo] || '(sin dato)'] = true; });
    return Object.keys(vistos).length;
  };

  return {
    actual: delActual.length,
    anterior: delAnterior.length,
    // Sin período anterior no hay variación: null, y la interfaz muestra un guion.
    // Un 0 % o un 100 % inventado se leería como un dato y no lo es.
    variacion: delAnterior.length
      ? Math.round((delActual.length - delAnterior.length) / delAnterior.length * 100)
      : null,
    usuariosActivos: distintos(delActual, 'usuario'),
    evaluados: distintos(delActual, 'evaluado')
  };
}

/**
 * Quién genera, cuánto y con qué resultado.
 *
 * Existe porque la app pasó a ser multiusuario y el historial ya guarda quién
 * generó cada informe (columna "Generado por"), pero el tablero no lo miraba:
 * no se podía saber si la usa todo el equipo o una sola persona.
 *
 * Va ordenado por cantidad de informes, que es la lectura de uso. La calificación
 * promedio se informa al lado, pero conviene leerla con cuidado: quien califica
 * es quien revisa, no quien genera, así que mide el informe y no a la persona.
 */
function metricasPorUsuario(cronologicas) {
  var porPersona = {};
  cronologicas.forEach(function (c) {
    var quien = c.usuario || '(sin usuario)';
    if (!porPersona[quien]) {
      porPersona[quien] = { informes: 0, puntajes: [], tiempos: [], ultima: null };
    }
    var registro = porPersona[quien];
    registro.informes++;
    if (Number(c.calificacion) > 0) registro.puntajes.push(Number(c.calificacion));
    if (Number(c.segundos) > 0) registro.tiempos.push(Number(c.segundos));
    var fecha = claveDeFecha(c.fecha);
    if (!registro.ultima || fecha > registro.ultima) registro.ultima = fecha;
  });

  return Object.keys(porPersona).map(function (usuario) {
    var r = porPersona[usuario];
    return {
      usuario: usuario,
      informes: r.informes,
      calificados: r.puntajes.length,
      porcentajeCalificado: Math.round(r.puntajes.length / r.informes * 100),
      promedioCalificacion: r.puntajes.length ? redondear(promedioDe(r.puntajes), 2) : null,
      promedioSegundos: r.tiempos.length ? redondear(promedioDe(r.tiempos), 1) : null,
      ultima: r.ultima
    };
  }).sort(function (a, b) { return b.informes - a.informes; });
}

/**
 * @param {Array<Object>} corridas las que devuelve leerCorridas(), de la más
 *   nueva a la más vieja.
 * @param {Date=} ahora hasta cuándo llegan las series. Se recibe en vez de
 *   leerlo del reloj para que la función siga siendo pura y verificable: con el
 *   reloj adentro, un test que pasa hoy falla la semana que viene.
 * @return {Object} números listos para dibujar.
 */
function metricasDe(corridas, ahora) {
  var momento = ahora || new Date();
  // De la más vieja a la más nueva: las series temporales se leen así.
  var cronologicas = corridas.slice().reverse();
  var calificadas = cronologicas.filter(function (c) { return Number(c.calificacion) > 0; });
  var total = cronologicas.length;

  var puntajes = calificadas.map(function (c) { return Number(c.calificacion); });
  var tiempos = cronologicas
    .map(function (c) { return Number(c.segundos); })
    .filter(function (s) { return s > 0; });

  // Actividad por período. Se calculan las tres granularidades de una vez: son
  // unos pocos recorridos sobre una lista que ya está en memoria, y así cambiar
  // de Semana a Mes en el tablero no vuelve a pedirle nada al servidor.
  var porPeriodo = {};
  var resumenPorPeriodo = {};
  GRANULARIDADES.forEach(function (granularidad) {
    porPeriodo[granularidad] = serieDePeriodos(cronologicas, granularidad, momento);
    resumenPorPeriodo[granularidad] = resumenDePeriodo(cronologicas, granularidad, momento);
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
      promedio: redondear(promedioDe(porPersona[evaluado]), 2),
      cantidad: porPersona[evaluado].length
    };
  }).sort(function (a, b) { return b.promedio - a.promedio; });

  // Alerta: si las últimas calificaciones vienen flojas, algo se rompió
  var ultimas = puntajes.slice(-5);
  var alerta = ultimas.length >= CALIFICACIONES_PARA_ALERTA
    && promedioDe(ultimas) < UMBRAL_DE_ALERTA;

  return {
    total: total,
    calificados: calificadas.length,
    promedioCalificacion: redondear(promedioDe(puntajes), 2),
    promedioSegundos: redondear(promedioDe(tiempos), 1),
    porcentajeCalificado: total ? Math.round(calificadas.length / total * 100) : 0,
    porPeriodo: porPeriodo,
    resumenPorPeriodo: resumenPorPeriodo,
    porUsuario: metricasPorUsuario(cronologicas),
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
