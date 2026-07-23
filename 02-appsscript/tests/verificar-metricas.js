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
  return new Function(`${fuente}\nreturn { metricasDe, claveDeFecha };`)();
}

/** leerCorridas() devuelve de la más nueva a la más vieja: se arma igual. */
function corridas(filas) {
  return filas.map((f, i) => ({
    fila: i + 2,
    fecha: f.fecha,
    evaluado: f.evaluado || 'Alguien',
    planilla: 'p.xlsx',
    informeUrl: 'https://drive/x',
    usuario: 'ana@kolektor.com.ar',
    segundos: f.segundos === undefined ? 4 : f.segundos,
    calificacion: f.calificacion === undefined ? '' : f.calificacion,
    comentario: '',
  })).reverse();
}

function main() {
  const { metricasDe, claveDeFecha } = cargarGs();
  const revisiones = [];
  const revisar = (nombre, ok, detalle) => revisiones.push([nombre, ok, detalle]);

  // ── Caso base ──
  const m = metricasDe(corridas([
    { fecha: new Date(2026, 6, 20, 10), evaluado: 'Ana', calificacion: 4, segundos: 4 },
    { fecha: new Date(2026, 6, 20, 16), evaluado: 'Beto', calificacion: 2, segundos: 6 },
    { fecha: new Date(2026, 6, 22, 9), evaluado: 'Ana', calificacion: 5, segundos: 5 },
    { fecha: new Date(2026, 6, 22, 11), evaluado: 'Cami', segundos: 3 },
  ]));

  revisar('cuenta todos los informes', m.total === 4, m.total);
  revisar('cuenta sólo los calificados', m.calificados === 3, m.calificados);
  revisar('promedia las calificaciones', m.promedioCalificacion === 3.67, m.promedioCalificacion);
  revisar('promedia los tiempos de todas las corridas', m.promedioSegundos === 4.5, m.promedioSegundos);
  revisar('calcula el porcentaje calificado', m.porcentajeCalificado === 75, m.porcentajeCalificado);

  revisar('agrupa los informes por día',
    m.porFecha.length === 2 && m.porFecha[0].fecha === '2026-07-20' && m.porFecha[0].cantidad === 2,
    JSON.stringify(m.porFecha));
  revisar('los días quedan en orden cronológico',
    m.porFecha[0].fecha < m.porFecha[1].fecha);

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
  const largo = metricasDe(corridas(muchas));
  revisar('el gráfico por día se limita a 30 días', largo.porFecha.length === 30, largo.porFecha.length);
  revisar('y son los 30 más recientes', largo.porFecha[29].fecha === '2026-06-29', largo.porFecha[29].fecha);
  revisar('la tendencia se limita a 30 puntos', largo.tendencia.length === 30);
  revisar('los tiempos se limitan a 50 puntos', largo.tiempos.length === 50);
  revisar('pero los totales miran todo el historial', largo.total === 60);

  // ── Historial vacío ──
  const vacio = metricasDe([]);
  revisar('con historial vacío no rompe y devuelve ceros',
    vacio.total === 0 && vacio.promedioCalificacion === 0 && vacio.porcentajeCalificado === 0
    && vacio.porFecha.length === 0 && vacio.alerta === false && vacio.distribucion.length === 5,
    JSON.stringify(vacio).slice(0, 90));

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
