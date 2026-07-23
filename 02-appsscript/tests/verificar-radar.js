/**
 * Verificación del gráfico radar.
 *
 * Lo que se puede verificar sin Apps Script es lo que importa acá: que la serie
 * y las etiquetas que se mandan a graficar sean exactamente las que grafica
 * matplotlib hoy, y que el andamiaje temporal se limpie siempre. Que el dibujo
 * salga lindo no lo decide un test — eso ya se comparó visualmente y está
 * aprobado (PLAN-APPSSCRIPT.md, sección 4).
 *
 * Uso:  python3 dump-referencia.py && node verificar-radar.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const REFERENCIA = path.join(__dirname, 'referencia-python.json');

// ── Servicios simulados ────────────────────────────────────────────
// Registran lo que Radar.gs les pide, para poder revisarlo después.

function crearEntorno(opciones) {
  const o = opciones || {};
  const registro = {
    valores: null,
    rangos: [],
    opciones: {},
    tipo: null,
    posicion: null,
    graficoInsertado: false,
    exportadoComo: null,
    libroCreado: null,
    libroDescartado: null,
  };

  const rango = (fila, columna, filas, columnas) => ({
    descripcion: `${fila},${columna},${filas},${columnas}`,
    setValues(v) { registro.valores = v; return this; },
  });

  const constructor = {
    setChartType(t) { registro.tipo = t; return this; },
    addRange(r) { registro.rangos.push(r.descripcion); return this; },
    setPosition(...args) { registro.posicion = args.join(','); return this; },
    setOption(clave, valor) { registro.opciones[clave] = valor; return this; },
    build() { return { esGrafico: true }; },
  };

  const grafico = {
    getAs(tipo) {
      registro.exportadoComo = tipo;
      if (o.fallaExportacion) throw new Error('falla simulada al exportar');
      return { setName(n) { return { nombre: n, tipo }; } };
    },
  };

  const hoja = {
    getRange: (...args) => rango(...args),
    newChart: () => constructor,
    insertChart(g) { registro.graficoInsertado = !!g.esGrafico; },
    getCharts: () => [grafico],
  };

  const SpreadsheetApp = {
    create(nombre) {
      registro.libroCreado = nombre;
      if (o.fallaCreacion) throw new Error('falla simulada al crear la planilla');
      return { getId: () => 'id-temporal', getSheets: () => [hoja] };
    },
    flush() {},
  };

  const Charts = { ChartType: { RADAR: 'RADAR', LINE: 'LINE', COLUMN: 'COLUMN' } };

  const DriveApp = {
    getFileById(id) {
      return { setTrashed(v) { registro.libroDescartado = v ? id : null; } };
    },
  };

  return { registro, globales: { SpreadsheetApp, Charts, DriveApp } };
}

function cargarGs(globales) {
  const fuente = ['Correccion.gs', 'Radar.gs']
    .map((a) => fs.readFileSync(path.join(RAIZ, a), 'utf8'))
    .join('\n');
  const nombres = Object.keys(globales);
  return new Function(
    ...nombres,
    `${fuente}\nreturn { corregir, datosParaRadar, generarImagenRadar };`
  )(...nombres.map((n) => globales[n]));
}

function main() {
  if (!fs.existsSync(REFERENCIA)) {
    console.error('Falta referencia-python.json. Correr primero: python3 dump-referencia.py');
    return 1;
  }

  const entorno = crearEntorno();
  const gs = cargarGs(entorno.globales);
  const casos = JSON.parse(fs.readFileSync(REFERENCIA, 'utf8'));

  // ── 1. La serie graficada es la misma que grafica Python ──
  let fallados = 0;
  let comparados = 0;
  const diferencias = [];
  for (const caso of casos) {
    const esperado = caso.esperado.radar;
    const filas = gs.datosParaRadar(gs.corregir(caso.respuestas), 'Evaluado');
    const cuerpo = filas.slice(1);

    if (cuerpo.length !== esperado.etiquetas.length) {
      diferencias.push(`${caso.planilla}: python grafica ${esperado.etiquetas.length} ejes, js ${cuerpo.length}`);
      continue;
    }
    for (let i = 0; i < cuerpo.length; i++) {
      const [etiqueta, ideal, evaluado] = cuerpo[i];
      if (etiqueta !== esperado.etiquetas[i]) {
        diferencias.push(`${caso.planilla} eje ${i}: python="${esperado.etiquetas[i]}" js="${etiqueta}"`);
      }
      if (ideal !== esperado.ideal[i]) {
        diferencias.push(`${caso.planilla} ideal[${i}]: python=${esperado.ideal[i]} js=${ideal}`);
      }
      if (evaluado !== esperado.evaluado[i]) {
        diferencias.push(`${caso.planilla} evaluado[${i}]: python=${esperado.evaluado[i]} js=${evaluado}`);
      }
      comparados += 3;
    }
  }
  if (diferencias.length) {
    fallados++;
    console.log(`✗ serie graficada (${diferencias.length} diferencias)`);
    diferencias.slice(0, 10).forEach((d) => console.log(`    ${d}`));
  } else {
    console.log(`✓ serie graficada idéntica a matplotlib en ${casos.length} perfiles (${comparados} valores)`);
  }

  // ── 2. Armado del gráfico ──
  const revisiones = [];
  const registro = entorno.registro;
  const resultados = gs.corregir(casos[0].respuestas);
  const blob = gs.generarImagenRadar(resultados, 'Ana Pérez');

  revisiones.push(['usa el tipo RADAR nativo', registro.tipo === 'RADAR']);
  revisiones.push(['grafica el rango completo (15 filas × 3 columnas)', registro.rangos.includes('1,1,15,3')]);
  revisiones.push(['escala fija 0-100', registro.opciones.vAxis && registro.opciones.vAxis.minValue === 0 && registro.opciones.vAxis.maxValue === 100]);
  revisiones.push(['azul institucional para el perfil ideal', registro.opciones.series[0].color === '#2E5496']);
  revisiones.push(['naranja para el evaluado', registro.opciones.series[1].color === '#FF6600']);
  revisiones.push(['el título nombra al evaluado', registro.opciones.title.indexOf('Ana Pérez') > 0]);
  revisiones.push(['la serie del evaluado se rotula con su nombre', registro.valores[0][2] === 'Ana Pérez']);
  revisiones.push(['inserta el gráfico y lo exporta como PNG', registro.graficoInsertado && registro.exportadoComo === 'image/png']);
  revisiones.push(['devuelve el blob nombrado', blob && blob.nombre === 'radar.png']);
  revisiones.push(['descarta la planilla temporal', registro.libroDescartado === 'id-temporal']);

  // ── 3. La limpieza ocurre aunque falle la exportación ──
  const entornoRoto = crearEntorno({ fallaExportacion: true });
  const gsRoto = cargarGs(entornoRoto.globales);
  let exploto = false;
  try {
    gsRoto.generarImagenRadar(gsRoto.corregir(casos[0].respuestas), 'Ana Pérez');
  } catch (e) {
    exploto = true;
  }
  revisiones.push(['si falla la exportación, el error se propaga', exploto]);
  revisiones.push(['si falla la exportación, igual descarta la planilla', entornoRoto.registro.libroDescartado === 'id-temporal']);

  console.log('\nArmado del gráfico:');
  for (const [nombre, ok] of revisiones) {
    console.log(`  ${ok ? '✓' : '✗'} ${nombre}`);
    if (!ok) fallados++;
  }

  console.log(fallados ? `\n${fallados} verificación(es) fallaron` : '\nRadar verificado');
  return fallados ? 1 : 0;
}

process.exit(main());
