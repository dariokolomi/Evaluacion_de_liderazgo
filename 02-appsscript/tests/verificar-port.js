/**
 * Verificación diferencial del port de la corrección.
 *
 * Corre Correccion.gs sobre las mismas respuestas que procesó el motor Python
 * y exige coincidencia exacta en puntajes, percentiles, niveles y radar.
 * Los baremos son datos validados: "parecido" no alcanza.
 *
 * Uso:  node verificar-port.js      (correr antes dump-referencia.py)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const REFERENCIA = path.join(__dirname, 'referencia-python.json');

// Correccion.gs es un script de Apps Script: no exporta nada, define globales.
// Lo evaluamos tal cual para verificar el archivo que se va a subir, sin copias.
function cargarCorreccion() {
  const fuente = fs.readFileSync(path.join(RAIZ, 'Correccion.gs'), 'utf8');
  return new Function(`${fuente}\nreturn corregir;`)();
}

const TOLERANCIA = 1e-12; // sólo para medias; enteros y textos se exigen idénticos

function comparar(ruta, esperado, obtenido, diferencias) {
  if (typeof esperado === 'number' && typeof obtenido === 'number') {
    if (Math.abs(esperado - obtenido) > TOLERANCIA) {
      diferencias.push(`${ruta}: python=${esperado} js=${obtenido}`);
    }
    return;
  }
  if (Array.isArray(esperado)) {
    esperado.forEach((v, i) => comparar(`${ruta}[${i}]`, v, obtenido && obtenido[i], diferencias));
    return;
  }
  if (esperado !== null && typeof esperado === 'object') {
    for (const clave of Object.keys(esperado)) {
      comparar(`${ruta}.${clave}`, esperado[clave], obtenido && obtenido[clave], diferencias);
    }
    return;
  }
  if (esperado !== obtenido) {
    diferencias.push(`${ruta}: python=${JSON.stringify(esperado)} js=${JSON.stringify(obtenido)}`);
  }
}

/**
 * El nivel por percentil lo aplica Python recién al armar el documento.
 *
 * El corte bajo/medio ya no es el de Python: el PO lo movió a "bajo <= P25" el
 * 2026-07-27, así que un P25 que Python rotulaba Medio acá tiene que dar Bajo.
 * Es divergencia buscada, no deriva del port.
 */
function nivelPorPercentilEsperado(percentiles) {
  const niveles = {};
  for (const [clave, p] of Object.entries(percentiles)) {
    niveles[clave] = p >= 75 ? 'Alto' : p > 25 ? 'Medio' : 'Bajo';
  }
  return niveles;
}

function main() {
  if (!fs.existsSync(REFERENCIA)) {
    console.error('Falta referencia-python.json. Correr primero: python3 dump-referencia.py');
    return 1;
  }

  const corregir = cargarCorreccion();
  const casos = JSON.parse(fs.readFileSync(REFERENCIA, 'utf8'));
  let fallados = 0;
  let comparaciones = 0;

  for (const caso of casos) {
    const obtenido = corregir(caso.respuestas);
    const esperado = caso.esperado;
    const diferencias = [];

    for (const instrumento of ['neo', 'celid', 'potenlid', 'camin', 'conlid']) {
      comparar(instrumento, esperado[instrumento], obtenido[instrumento], diferencias);
      if (instrumento !== 'neo') {
        comparar(
          `${instrumento}.nivel`,
          nivelPorPercentilEsperado(esperado[instrumento].percentil),
          obtenido[instrumento].nivel,
          diferencias
        );
      }
    }
    comparar('radar.evaluado', esperado.radar.evaluado, obtenido.radar.evaluado, diferencias);
    comparar('radar.ideal', esperado.radar.ideal, obtenido.radar.ideal, diferencias);

    comparaciones += contarHojas(esperado);
    if (diferencias.length) {
      fallados++;
      console.log(`✗ ${caso.planilla}`);
      diferencias.forEach((d) => console.log(`    ${d}`));
    } else {
      console.log(`✓ ${caso.planilla}`);
    }
  }

  console.log(
    `\n${casos.length - fallados}/${casos.length} planillas coinciden ` +
    `(~${comparaciones} valores comparados)`
  );
  return fallados ? 1 : 0;
}

function contarHojas(valor) {
  if (valor === null || typeof valor !== 'object') return 1;
  return Object.values(valor).reduce((total, v) => total + contarHojas(v), 0);
}

process.exit(main());
