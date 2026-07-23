/**
 * Verificación diferencial de la lectura de planillas.
 *
 * Corre extraerRespuestas() de Lectura.gs sobre las celdas crudas de las
 * planillas reales y exige que devuelva exactamente las mismas respuestas que
 * leyó el motor Python. Después las pasa por la corrección, para comprobar que
 * la cadena entrada → corrección da los mismos resultados punta a punta.
 *
 * Uso:  python3 dump-referencia.py && python3 dump-celdas.py && node verificar-lectura.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const CELDAS = path.join(__dirname, 'celdas-python.json');
const REFERENCIA = path.join(__dirname, 'referencia-python.json');

const INSTRUMENTOS = ['neo', 'celid', 'potenlid', 'camin', 'conlid'];
const HOJA_DE = {
  neo: 'NEO', celid: 'CELID-A', potenlid: 'POTENLID', camin: 'CAMIN-A', conlid: 'CONLID-A',
};

// Los .gs no exportan nada: definen globales. Los evaluamos tal cual, para
// verificar los archivos que se van a subir y no una copia adaptada.
function cargar(archivos, devolver) {
  const fuente = archivos.map((a) => fs.readFileSync(path.join(RAIZ, a), 'utf8')).join('\n');
  return new Function(`${fuente}\nreturn {${devolver.join(', ')}};`)();
}

function comparaRespuestas(esperado, obtenido, instrumento, diferencias) {
  const claves = new Set([...Object.keys(esperado), ...Object.keys(obtenido)]);
  for (const item of [...claves].sort((a, b) => Number(a) - Number(b))) {
    const e = esperado[item];
    const o = obtenido[item];
    if (e === undefined) {
      diferencias.push(`${instrumento}[${item}]: python no lo leyó, js leyó ${JSON.stringify(o)}`);
    } else if (o === undefined) {
      diferencias.push(`${instrumento}[${item}]: python leyó ${JSON.stringify(e)}, js no lo leyó`);
    } else if (e !== o) {
      diferencias.push(`${instrumento}[${item}]: python=${JSON.stringify(e)} js=${JSON.stringify(o)}`);
    }
  }
}

function main() {
  for (const [archivo, comando] of [[CELDAS, 'dump-celdas.py'], [REFERENCIA, 'dump-referencia.py']]) {
    if (!fs.existsSync(archivo)) {
      console.error(`Falta ${path.basename(archivo)}. Correr primero: python3 ${comando}`);
      return 1;
    }
  }

  const { extraerRespuestas, itemsFaltantes, mensajeDeFaltantes, corregir } = cargar(
    ['Lectura.gs', 'Correccion.gs'],
    ['extraerRespuestas', 'itemsFaltantes', 'mensajeDeFaltantes', 'corregir']
  );

  const volcados = JSON.parse(fs.readFileSync(CELDAS, 'utf8'));
  const referencia = new Map(
    JSON.parse(fs.readFileSync(REFERENCIA, 'utf8')).map((c) => [c.planilla, c])
  );

  let fallados = 0;
  for (const volcado of volcados) {
    const grillas = {};
    for (const clave of INSTRUMENTOS) grillas[clave] = volcado.grillas[HOJA_DE[clave]];

    const obtenido = extraerRespuestas(grillas);
    const faltantes = itemsFaltantes(obtenido);
    const caso = referencia.get(volcado.planilla);

    // Sin caso en la referencia, el motor Python no pudo procesarla: lo único
    // exigible es que la lectura la rechace con un mensaje entendible.
    if (!caso) {
      if (Object.keys(faltantes).length) {
        console.log(`✓ ${volcado.planilla} (rechazada, como en Python)`);
        console.log(`    ${mensajeDeFaltantes(faltantes)}`);
      } else {
        fallados++;
        console.log(`✗ ${volcado.planilla}: Python no la procesa, pero la lectura JS la dio por válida`);
      }
      continue;
    }

    const diferencias = [];
    for (const clave of INSTRUMENTOS) {
      comparaRespuestas(caso.respuestas[clave], obtenido[clave], clave, diferencias);
    }
    if (Object.keys(faltantes).length) {
      diferencias.push(`la planilla es válida en Python pero la lectura la marca incompleta: ${mensajeDeFaltantes(faltantes)}`);
    }

    // Punta a punta: lo leído tiene que corregir igual que en Python.
    if (!diferencias.length) {
      const resultados = corregir(obtenido);
      const esperado = caso.esperado;
      for (const dim of Object.keys(esperado.neo.t)) {
        if (resultados.neo.t[dim] !== esperado.neo.t[dim]) {
          diferencias.push(`corrección neo.t.${dim}: python=${esperado.neo.t[dim]} js=${resultados.neo.t[dim]}`);
        }
      }
      for (const ins of ['celid', 'potenlid', 'camin', 'conlid']) {
        for (const k of Object.keys(esperado[ins].percentil)) {
          if (resultados[ins].percentil[k] !== esperado[ins].percentil[k]) {
            diferencias.push(`corrección ${ins}.${k}: python=P${esperado[ins].percentil[k]} js=P${resultados[ins].percentil[k]}`);
          }
        }
      }
    }

    if (diferencias.length) {
      fallados++;
      console.log(`✗ ${volcado.planilla}`);
      diferencias.forEach((d) => console.log(`    ${d}`));
    } else {
      console.log(`✓ ${volcado.planilla} (lectura + corrección idénticas a Python)`);
    }
  }

  console.log(`\n${volcados.length - fallados}/${volcados.length} planillas correctas`);
  fallados += casosConstruidos(extraerRespuestas, itemsFaltantes);
  return fallados ? 1 : 0;
}

// ── Casos construidos ──────────────────────────────────────────────
// Bordes que las planillas reales no tienen: celdas basura, filas de
// encabezado que se parecen a ítems, numeración rota.

const DISPOSICION_TEST = {
  neo:      { filaInicial: 6, colItem: 1, colRespuesta: 2, items: 60, letra: true },
  celid:    { filaInicial: 4, colItem: 1, colRespuesta: 4, items: 34 },
  potenlid: { filaInicial: 3, colItem: 1, colRespuesta: 3, items: 9 },
  camin:    { filaInicial: 3, colItem: 1, colRespuesta: 3, items: 12 },
  conlid:   { filaInicial: 3, colItem: 1, colRespuesta: 3, items: 18 },
};

/** Grillas completas y válidas, para después romperlas de a una celda. */
function grillasValidas() {
  const grillas = {};
  for (const [clave, d] of Object.entries(DISPOSICION_TEST)) {
    const filas = Array.from({ length: d.filaInicial - 1 }, () => ['', '', '', '']);
    for (let item = 1; item <= d.items; item++) {
      const fila = ['', '', '', ''];
      fila[d.colItem - 1] = d.letra ? `${item}. enunciado` : item;
      fila[d.colRespuesta - 1] = d.letra ? 'C' : 3;
      filas.push(fila);
    }
    grillas[clave] = filas;
  }
  return grillas;
}

function celdaDe(grillas, clave, item, columna) {
  const d = DISPOSICION_TEST[clave];
  return [d.filaInicial - 1 + item - 1, d[columna] - 1];
}

function casosConstruidos(extraerRespuestas, itemsFaltantes) {
  const casos = [
    ['planilla completa: no falta nada', (g) => g, {}],
    ['respuesta vacía → ítem faltante', (g) => {
      const [f, c] = celdaDe(g, 'neo', 7, 'colRespuesta');
      g.neo[f][c] = '';
      return g;
    }, { neo: [7] }],
    ['letra fuera de la escala → ítem faltante', (g) => {
      const [f, c] = celdaDe(g, 'neo', 12, 'colRespuesta');
      g.neo[f][c] = 'X';
      return g;
    }, { neo: [12] }],
    ['ítem con decimales → fila ignorada', (g) => {
      const [f, c] = celdaDe(g, 'celid', 5, 'colItem');
      g.celid[f][c] = 5.5;
      return g;
    }, { celid: [5] }],
    ['encabezado que parece un ítem → no se cuenta', (g) => {
      g.neo[2] = ['1. instrucciones de ejemplo', 'E', '', ''];
      const [f, c] = celdaDe(g, 'neo', 1, 'colRespuesta');
      g.neo[f][c] = 'A';
      return g;
    }, {}],
    ['hoja vacía → todos los ítems faltantes', (g) => {
      g.potenlid = [];
      return g;
    }, { potenlid: [1, 2, 3, 4, 5, 6, 7, 8, 9] }],
  ];

  let fallados = 0;
  console.log('\nCasos construidos:');
  for (const [nombre, romper, esperado] of casos) {
    const grillas = romper(grillasValidas());
    const respuestas = extraerRespuestas(grillas);
    const obtenido = itemsFaltantes(respuestas);
    const iguales = JSON.stringify(obtenido) === JSON.stringify(esperado);

    // El encabezado impostor no debe pisar la respuesta real del ítem 1.
    const pisado = nombre.startsWith('encabezado') && respuestas.neo[1] !== 'A';

    if (iguales && !pisado) {
      console.log(`  ✓ ${nombre}`);
    } else {
      fallados++;
      console.log(`  ✗ ${nombre}`);
      console.log(`      esperado ${JSON.stringify(esperado)}, obtenido ${JSON.stringify(obtenido)}`);
      if (pisado) console.log(`      el ítem 1 quedó en ${JSON.stringify(respuestas.neo[1])} en vez de "A"`);
    }
  }
  return fallados;
}

process.exit(main());
