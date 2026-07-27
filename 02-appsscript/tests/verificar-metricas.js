/**
 * Verificación de las métricas.
 *
 * metricasDe() es pura, así que acá no hace falta simular ningún servicio de
 * Google: se le pasan corridas y se revisan los números.
 *
 * Uso:  node verificar-metricas.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');

function cargarGs() {
  const fuente = fs.readFileSync(path.join(RAIZ, 'Metricas.gs'), 'utf8');
  return new Function(`${fuente}\nreturn { metricasDe, claveDeFecha, claveDePeriodo,
    etiquetaDePeriodo, PERIODOS_EN_TABLERO };`)();
}

/**
 * El "ahora" de las pruebas: jueves 23 de julio de 2026.
 *
 * Va fijo a propósito. Las series terminan en el período en curso, así que con el
 * reloj de verdad estas verificaciones pasarían hoy y fallarían la semana que
 * viene, que es la peor clase de prueba: la que se rompe sola.
 */
const AHORA = new Date(2026, 6, 23, 15, 0);

/** leerCorridas() devuelve de la más nueva a la más vieja: se arma igual. */
function corridas(filas) {
  return filas.map((f, i) => ({
    fila: i + 2,
    fecha: f.fecha,
    evaluado: f.evaluado || 'Alguien',
    planilla: 'p.xlsx',
    informeUrl: 'https://drive/x',
    usuario: f.usuario || 'ana@kolektor.com.ar',
    segundos: f.segundos === undefined ? 4 : f.segundos,
    calificacion: f.calificacion === undefined ? '' : f.calificacion,
    comentario: '',
  })).reverse();
}

function main() {
  const { metricasDe, claveDeFecha, claveDePeriodo, etiquetaDePeriodo, PERIODOS_EN_TABLERO } = cargarGs();
  const revisiones = [];
  const revisar = (nombre, ok, detalle) => revisiones.push([nombre, ok, detalle]);

  // ── Caso base ──
  const m = metricasDe(corridas([
    { fecha: new Date(2026, 6, 20, 10), evaluado: 'Ana', calificacion: 4, segundos: 4 },
    { fecha: new Date(2026, 6, 20, 16), evaluado: 'Beto', calificacion: 2, segundos: 6 },
    { fecha: new Date(2026, 6, 22, 9), evaluado: 'Ana', calificacion: 5, segundos: 5 },
    { fecha: new Date(2026, 6, 22, 11), evaluado: 'Cami', segundos: 3 },
  ]), AHORA);

  revisar('cuenta todos los informes', m.total === 4, m.total);
  revisar('cuenta sólo los calificados', m.calificados === 3, m.calificados);
  revisar('promedia las calificaciones', m.promedioCalificacion === 3.67, m.promedioCalificacion);
  revisar('promedia los tiempos de todas las corridas', m.promedioSegundos === 4.5, m.promedioSegundos);
  revisar('calcula el porcentaje calificado', m.porcentajeCalificado === 75, m.porcentajeCalificado);

  // ── Actividad por período ──
  const dias = m.porPeriodo.dia;
  revisar('la serie por día llega hasta hoy, aunque hoy no haya corridas',
    dias[dias.length - 1].clave === '2026-07-23' && dias[dias.length - 1].cantidad === 0,
    JSON.stringify(dias.slice(-2)));
  revisar('y cuenta los informes del día que corresponde',
    dias.find((d) => d.clave === '2026-07-20').cantidad === 2,
    JSON.stringify(dias.filter((d) => d.cantidad)));
  revisar('los días sin ninguna corrida van en 0 en vez de faltar',
    dias.find((d) => d.clave === '2026-07-21').cantidad === 0);
  revisar('los períodos quedan en orden cronológico',
    dias.every((d, i) => i === 0 || dias[i - 1].clave < d.clave));

  const semanas = m.porPeriodo.semana;
  revisar('la semana agrupa desde el lunes',
    semanas[semanas.length - 1].clave === '2026-07-20'
    && semanas[semanas.length - 1].cantidad === 4,
    JSON.stringify(semanas.slice(-2)));
  revisar('y la semana anterior queda vacía',
    semanas[semanas.length - 2].clave === '2026-07-13'
    && semanas[semanas.length - 2].cantidad === 0);
  revisar('el mes agrupa las cuatro en julio',
    m.porPeriodo.mes[m.porPeriodo.mes.length - 1].clave === '2026-07'
    && m.porPeriodo.mes[m.porPeriodo.mes.length - 1].cantidad === 4,
    JSON.stringify(m.porPeriodo.mes.slice(-1)));

  revisar('cada período trae su etiqueta ya escrita para el eje',
    semanas[semanas.length - 1].etiqueta === '20/07'
    && m.porPeriodo.mes[m.porPeriodo.mes.length - 1].etiqueta === 'jul 26',
    semanas[semanas.length - 1].etiqueta + ' / ' + m.porPeriodo.mes[m.porPeriodo.mes.length - 1].etiqueta);

  // El lunes es el primer día de la semana: el domingo anterior cae en la semana
  // que arranca seis días antes, no en la que empieza al día siguiente.
  revisar('el domingo pertenece a la semana que empezó el lunes anterior',
    claveDePeriodo(new Date(2026, 6, 19), 'semana') === '2026-07-13',
    claveDePeriodo(new Date(2026, 6, 19), 'semana'));
  revisar('y el lunes abre la suya', claveDePeriodo(new Date(2026, 6, 20), 'semana') === '2026-07-20');
  revisar('el mes se corta por el calendario', claveDePeriodo(new Date(2026, 6, 1), 'mes') === '2026-07');
  revisar('la etiqueta del mes nombra el mes', etiquetaDePeriodo('2026-01', 'mes') === 'ene 26',
    etiquetaDePeriodo('2026-01', 'mes'));

  // ── Resumen del período en curso ──
  revisar('el resumen semanal cuenta lo de esta semana',
    m.resumenPorPeriodo.semana.actual === 4, m.resumenPorPeriodo.semana.actual);
  revisar('y cuenta las personas evaluadas distintas, no los informes',
    m.resumenPorPeriodo.semana.evaluados === 3, m.resumenPorPeriodo.semana.evaluados);
  revisar('y las personas que generaron',
    m.resumenPorPeriodo.semana.usuariosActivos === 1, m.resumenPorPeriodo.semana.usuariosActivos);
  revisar('sin período anterior la variación es null y no un porcentaje inventado',
    m.resumenPorPeriodo.semana.variacion === null, m.resumenPorPeriodo.semana.variacion);

  revisar('la distribución tiene los cinco puntajes siempre',
    m.distribucion.length === 5 && m.distribucion.every((d, i) => d.puntaje === i + 1));
  revisar('y cuenta bien cada uno',
    m.distribucion[1].cantidad === 1 && m.distribucion[3].cantidad === 1 && m.distribucion[4].cantidad === 1
    && m.distribucion[0].cantidad === 0,
    JSON.stringify(m.distribucion));

  revisar('la tendencia va de la más vieja a la más nueva',
    m.tendencia.length === 3 && m.tendencia[0].calificacion === 4 && m.tendencia[2].calificacion === 5,
    JSON.stringify(m.tendencia.map((t) => t.calificacion)));

  revisar('promedia por persona evaluada',
    m.porEvaluado.length === 2
    && m.porEvaluado[0].evaluado === 'Ana' && m.porEvaluado[0].promedio === 4.5
    && m.porEvaluado[0].cantidad === 2,
    JSON.stringify(m.porEvaluado));
  revisar('y ordena de mejor a peor', m.porEvaluado[0].promedio > m.porEvaluado[1].promedio);
  revisar('no cuenta como evaluado a quien no tiene calificación',
    !m.porEvaluado.some((e) => e.evaluado === 'Cami'));

  // ── Variación contra el período anterior ──
  const conAnterior = metricasDe(corridas([
    { fecha: new Date(2026, 6, 14) },
    { fecha: new Date(2026, 6, 15) },
    { fecha: new Date(2026, 6, 16) },
    { fecha: new Date(2026, 6, 17) },
    { fecha: new Date(2026, 6, 21) },
    { fecha: new Date(2026, 6, 22) },
    { fecha: new Date(2026, 6, 23) },
  ]), AHORA);
  revisar('la variación compara el período en curso con el anterior',
    conAnterior.resumenPorPeriodo.semana.actual === 3
    && conAnterior.resumenPorPeriodo.semana.anterior === 4
    && conAnterior.resumenPorPeriodo.semana.variacion === -25,
    JSON.stringify(conAnterior.resumenPorPeriodo.semana));

  // ── Uso por persona ──
  const equipo = metricasDe(corridas([
    { fecha: new Date(2026, 6, 20), usuario: 'ana@k.com', calificacion: 4, segundos: 4 },
    { fecha: new Date(2026, 6, 21), usuario: 'ana@k.com', calificacion: 2, segundos: 6 },
    { fecha: new Date(2026, 6, 22), usuario: 'ana@k.com', segundos: 8 },
    { fecha: new Date(2026, 6, 22), usuario: 'beto@k.com', calificacion: 5, segundos: 5 },
  ]), AHORA);
  revisar('ordena a las personas por cantidad de informes',
    equipo.porUsuario.length === 2 && equipo.porUsuario[0].usuario === 'ana@k.com'
    && equipo.porUsuario[0].informes === 3,
    JSON.stringify(equipo.porUsuario.map((u) => u.usuario + ':' + u.informes)));
  revisar('cuenta cuántos de sus informes se calificaron, y en qué proporción',
    equipo.porUsuario[0].calificados === 2 && equipo.porUsuario[0].porcentajeCalificado === 67,
    JSON.stringify(equipo.porUsuario[0]));
  revisar('promedia sólo sus calificaciones y sus tiempos',
    equipo.porUsuario[0].promedioCalificacion === 3 && equipo.porUsuario[0].promedioSegundos === 6,
    JSON.stringify(equipo.porUsuario[0]));
  revisar('y anota cuándo generó el último',
    equipo.porUsuario[0].ultima === '2026-07-22', equipo.porUsuario[0].ultima);
  revisar('sin ninguna calificación, el promedio es null y no un cero que se lee como nota',
    metricasDe(corridas([{ fecha: new Date(2026, 6, 22), usuario: 'sin@k.com' }]), AHORA)
      .porUsuario[0].promedioCalificacion === null);
  revisar('el resumen cuenta a las dos personas que generaron esta semana',
    equipo.resumenPorPeriodo.semana.usuariosActivos === 2,
    equipo.resumenPorPeriodo.semana.usuariosActivos);

  // ── Fechas ──
  revisar('una corrida de la tarde no se corre al día siguiente',
    claveDeFecha(new Date(2026, 6, 22, 21, 30)) === '2026-07-22',
    claveDeFecha(new Date(2026, 6, 22, 21, 30)));
  revisar('acepta también una fecha ya escrita como texto',
    claveDeFecha('2026-07-22 18:15') === '2026-07-22');

  // ── Tiempos ──
  const conCeros = metricasDe(corridas([
    { fecha: new Date(2026, 6, 20), segundos: 0 },
    { fecha: new Date(2026, 6, 20), segundos: '' },
    { fecha: new Date(2026, 6, 20), segundos: 5 },
  ]));
  revisar('descarta los tiempos vacíos o en cero',
    conCeros.tiempos.length === 1 && conCeros.promedioSegundos === 5,
    JSON.stringify(conCeros.tiempos));

  // ── Alerta ──
  const flojas = metricasDe(corridas([
    { fecha: new Date(2026, 6, 20), calificacion: 2 },
    { fecha: new Date(2026, 6, 21), calificacion: 1 },
    { fecha: new Date(2026, 6, 22), calificacion: 3 },
  ]));
  revisar('avisa cuando las últimas calificaciones vienen bajas', flojas.alerta === true);

  const dosFlojas = metricasDe(corridas([
    { fecha: new Date(2026, 6, 21), calificacion: 1 },
    { fecha: new Date(2026, 6, 22), calificacion: 2 },
  ]));
  revisar('pero no con menos de tres calificaciones', dosFlojas.alerta === false);

  const buenas = metricasDe(corridas([
    { fecha: new Date(2026, 6, 20), calificacion: 5 },
    { fecha: new Date(2026, 6, 21), calificacion: 4 },
    { fecha: new Date(2026, 6, 22), calificacion: 5 },
  ]));
  revisar('ni cuando vienen bien', buenas.alerta === false);

  const repuntando = metricasDe(corridas([
    { fecha: new Date(2026, 6, 10), calificacion: 1 },
    { fecha: new Date(2026, 6, 11), calificacion: 1 },
    { fecha: new Date(2026, 6, 12), calificacion: 1 },
    { fecha: new Date(2026, 6, 20), calificacion: 5 },
    { fecha: new Date(2026, 6, 21), calificacion: 5 },
    { fecha: new Date(2026, 6, 22), calificacion: 5 },
  ]));
  revisar('la alerta mira las últimas, no el histórico entero', repuntando.alerta === false);

  // ── Ventanas ──
  const muchas = [];
  for (let i = 0; i < 60; i++) {
    muchas.push({ fecha: new Date(2026, 4, 1 + i), calificacion: 4, segundos: 4 });
  }
  const largo = metricasDe(corridas(muchas), AHORA);
  revisar('el gráfico por día se limita a 30 días',
    largo.porPeriodo.dia.length === PERIODOS_EN_TABLERO.dia, largo.porPeriodo.dia.length);
  revisar('y son los 30 que terminan hoy',
    largo.porPeriodo.dia[29].clave === '2026-07-23'
    && largo.porPeriodo.dia[0].clave === '2026-06-24',
    largo.porPeriodo.dia[0].clave + ' … ' + largo.porPeriodo.dia[29].clave);
  revisar('las semanas se limitan a 12 y los meses a 12',
    largo.porPeriodo.semana.length === 12 && largo.porPeriodo.mes.length === 12,
    largo.porPeriodo.semana.length + ' / ' + largo.porPeriodo.mes.length);
  revisar('la tendencia se limita a 30 puntos', largo.tendencia.length === 30);
  revisar('los tiempos se limitan a 50 puntos', largo.tiempos.length === 50);
  revisar('pero los totales miran todo el historial', largo.total === 60);

  // ── Historial vacío ──
  const vacio = metricasDe([], AHORA);
  revisar('con historial vacío no rompe y devuelve ceros',
    vacio.total === 0 && vacio.promedioCalificacion === 0 && vacio.porcentajeCalificado === 0
    && vacio.alerta === false && vacio.distribucion.length === 5,
    JSON.stringify(vacio).slice(0, 90));
  revisar('y el gráfico del período igual se dibuja, todo en cero',
    vacio.porPeriodo.semana.length === 12
    && vacio.porPeriodo.semana.every((p) => p.cantidad === 0)
    && vacio.porUsuario.length === 0
    && vacio.resumenPorPeriodo.semana.actual === 0,
    JSON.stringify(vacio.resumenPorPeriodo.semana));

  let fallados = 0;
  for (const [nombre, ok, detalle] of revisiones) {
    console.log(`  ${ok ? '✓' : '✗'} ${nombre}`);
    if (!ok) {
      fallados++;
      if (detalle !== undefined) console.log(`      obtenido: ${detalle}`);
    }
  }
  console.log(fallados
    ? `\n${fallados} de ${revisiones.length} verificaciones fallaron`
    : `\nMétricas verificadas (${revisiones.length} verificaciones)`);
  return fallados ? 1 : 0;
}

process.exit(main());
