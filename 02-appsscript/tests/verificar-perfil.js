/**
 * Verificación de la clasificación del perfil (Perfil.gs).
 *
 * Existe aparte porque las verificaciones que quedaron en verificar-documento.js
 * comprueban que el texto del informe refleje la clasificación, y eso NO alcanza:
 * si la regla cambia, el texto cambia con ella y la comparación sigue en verde.
 * Se probó rompiendo la regla a propósito —ordenando por percentil en vez de por
 * media— y verificar-documento.js no se enteró.
 *
 * Así que acá los valores esperados están escritos a mano. Es la única forma de que
 * un cambio en la regla ponga algo en rojo.
 *
 * Uso:  node verificar-perfil.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const REFERENCIA = path.join(__dirname, 'referencia-python.json');

let pasaron = 0;
const fallos = [];

function ok(condicion, nombre, detalle) {
  if (condicion) pasaron++;
  else fallos.push(detalle ? `${nombre} — ${detalle}` : nombre);
}

function cargarGs() {
  const fuente = ['Correccion.gs', 'Perfil.gs']
    .map((a) => fs.readFileSync(path.join(RAIZ, a), 'utf8'))
    .join('\n');
  return new Function(`${fuente}\nreturn { corregir, clasificarPerfil, frasePerfilCelid,
    fraseSituacional, MARGEN_PREDOMINANCIA, MARGEN_EJE };`)();
}

const gs = cargarGs();

/**
 * Arma unos `resultados` con los valores que interesan.
 * `medias` son las de CELID (escala 1-5); el resto son percentiles.
 */
function perfilDe({ medias, pctCelid, camin, conlid }) {
  return gs.clasificarPerfil({
    celid: {
      valor: Object.assign({ TransfTot: 3, TransTot: 3, Laissez: 3 }, medias),
      percentil: Object.assign({ TransfTot: 50, TransTot: 50, Laissez: 50 }, pctCelid || {}),
    },
    camin: { percentil: Object.assign({ Dir: 50, Cons: 50, Part: 50, Or: 50 }, camin || {}) },
    conlid: { percentil: Object.assign({ Tar: 50, Rel: 50, Camb: 50 }, conlid || {}) },
  });
}

// ── El estilo predominante sale de las medias, no de los percentiles ──
// Es la decisión de fondo: "predominante" es cuál ejerce más, que se lee en la
// propia escala 1-5. El percentil contesta en cuál se destaca frente a la
// población, que es otra pregunta.
let p = perfilDe({ medias: { TransfTot: 4.5, TransTot: 3.4, Laissez: 2.0 } });
ok(p.predominante && p.predominante.nombre === 'Transformacional',
  'con la media más alta en Transformacional, ése es el predominante',
  p.predominante && p.predominante.nombre);
ok(p.mixto === false, 'y no se lo informa como mixto');

p = perfilDe({
  medias: { TransfTot: 4.5, TransTot: 3.0, Laissez: 2.0 },
  pctCelid: { TransfTot: 50, TransTot: 50, Laissez: 99 },
});
ok(p.predominante && p.predominante.nombre === 'Transformacional',
  'el percentil más alto NO decide el predominante: manda la media',
  p.predominante && p.predominante.nombre);

// ── El margen mínimo evita la precisión falsa ──
p = perfilDe({ medias: { TransfTot: 4.50, TransTot: 4.30, Laissez: 2.0 } });
ok(p.mixto === true && p.predominante === null,
  'con 0,20 de ventaja no hay predominante: el perfil es mixto');

p = perfilDe({ medias: { TransfTot: 4.80, TransTot: 4.50, Laissez: 2.0 } });
ok(p.mixto === false,
  'con una ventaja de 0,30 exactos sí hay predominante, sin que el punto flotante decida');

p = perfilDe({ medias: { TransfTot: 4.50, TransTot: 4.20, Laissez: 2.0 } });
ok(p.mixto === false, 'y lo mismo con los otros valores que dan 0,30');

ok(gs.MARGEN_PREDOMINANCIA === 0.30,
  'el margen de predominancia sigue declarado en 0,30', String(gs.MARGEN_PREDOMINANCIA));

// ── Laissez-Faire también puede predominar ──
// No es una fortaleza, pero si es lo que más ejerce, el informe tiene que decirlo.
p = perfilDe({ medias: { Laissez: 4.2, TransfTot: 3.0, TransTot: 2.5 } });
ok(p.predominante && p.predominante.nombre === 'Laissez-Faire',
  'si el Laissez-Faire es el más alto, se informa como predominante',
  p.predominante && p.predominante.nombre);

// ── El eje se decide con percentiles, que sí son comparables entre instrumentos ──
p = perfilDe({
  medias: { TransfTot: 4.5, TransTot: 3.0, Laissez: 2.0 },
  camin: { Cons: 90, Part: 90, Dir: 25 },
  conlid: { Rel: 90, Tar: 25 },
});
ok(p.eje === 'Relacional', 'con lo relacional muy por encima, el eje es Relacional', p.eje);
ok(p.etiqueta === 'Líder Relacional-Transformacional',
  'y la etiqueta compone eje y estilo', p.etiqueta);

p = perfilDe({
  medias: { TransfTot: 4.5, TransTot: 3.0, Laissez: 2.0 },
  camin: { Cons: 25, Part: 25, Dir: 90 },
  conlid: { Rel: 25, Tar: 90 },
});
ok(p.eje === 'Orientado a la Tarea', 'y al revés, el eje es Orientado a la Tarea', p.eje);

p = perfilDe({
  medias: { TransfTot: 4.5, TransTot: 3.0, Laissez: 2.0 },
  camin: { Cons: 50, Part: 50, Dir: 50 },
  conlid: { Rel: 50, Tar: 50 },
});
ok(p.eje === 'Equilibrado', 'dentro del margen, el eje queda Equilibrado', p.eje);
ok(p.etiqueta === 'Líder Transformacional',
  'con eje equilibrado la etiqueta no lleva guion', p.etiqueta);

// El margen del eje: 15 puntos de percentil.
p = perfilDe({
  medias: { TransfTot: 4.5, TransTot: 3.0, Laissez: 2.0 },
  camin: { Cons: 60, Part: 60, Dir: 50 }, conlid: { Rel: 60, Tar: 50 },
});
ok(p.eje === 'Equilibrado', 'una ventaja de 10 puntos no alcanza para declarar el eje', p.eje);
p = perfilDe({
  medias: { TransfTot: 4.5, TransTot: 3.0, Laissez: 2.0 },
  camin: { Cons: 70, Part: 70, Dir: 50 }, conlid: { Rel: 70, Tar: 50 },
});
ok(p.eje === 'Relacional', 'una de 20 sí', p.eje);
ok(gs.MARGEN_EJE === 15, 'el margen del eje sigue declarado en 15', String(gs.MARGEN_EJE));

// ── La etiqueta mixta no inventa un estilo ──
p = perfilDe({
  medias: { TransfTot: 4.5, TransTot: 4.4, Laissez: 2.0 },
  camin: { Cons: 90, Part: 90, Dir: 25 }, conlid: { Rel: 90, Tar: 25 },
});
ok(p.etiqueta === 'Líder Relacional, sin un estilo claramente predominante',
  'sin estilo predominante, la etiqueta lo dice en vez de elegir uno', p.etiqueta);

// ── El estilo menos desarrollado es el mínimo real, no siempre el Directivo ──
p = perfilDe({ medias: { TransfTot: 4.5 }, camin: { Dir: 80, Cons: 10, Part: 60, Or: 70 } });
ok(p.menosDesarrollado.nombre === 'Considerado',
  'el menos desarrollado sale del percentil más bajo de CAMIN-A', p.menosDesarrollado.nombre);
ok(p.menosDesarrollado.percentil === 10, 'y viene con su percentil');

p = perfilDe({ medias: { TransfTot: 4.5 }, camin: { Dir: 10, Cons: 80, Part: 60, Or: 70 } });
ok(p.menosDesarrollado.nombre === 'Directivo',
  'cuando sí es el Directivo, lo informa igual', p.menosDesarrollado.nombre);

// ── Las frases que van al informe ──
p = perfilDe({ medias: { TransfTot: 4.47, TransTot: 3.45, Laissez: 3.0 },
  pctCelid: { TransfTot: 75, TransTot: 50, Laissez: 75 } });
let frase = gs.frasePerfilCelid(p);
ok(frase.indexOf('Transformacional predominante (4.47 / P75)') >= 0,
  'la frase de 2.2 nombra el predominante con su media y su percentil', frase);
ok(frase.indexOf('Transaccional (3.45 / P50)') >= 0 && frase.indexOf('Laissez-Faire (3.00 / P75)') >= 0,
  'y los otros dos en orden');
ok(!/zona de atención/.test(frase),
  'ya no afirma que el Laissez-Faire sea zona de atención sin mirarlo: en un perfil'
  + ' con Laissez-Faire bajo eso era falso');

p = perfilDe({ medias: { TransfTot: 4.5, TransTot: 4.4, Laissez: 4.35 } });
frase = gs.frasePerfilCelid(p);
ok(/no muestra un estilo de liderazgo claramente predominante/.test(frase),
  'con un perfil mixto la frase lo dice', frase);

p = perfilDe({ medias: { TransfTot: 4.5 }, camin: { Cons: 90, Part: 90, Or: 90, Dir: 30 } });
frase = gs.fraseSituacional(p, { Dir: 30, Cons: 90, Part: 90, Or: 90 });
ok(frase.indexOf('los estilos Considerado, Participativo y Orientado a Metas') >= 0,
  'la frase situacional enumera los estilos que están altos', frase);
ok(frase.indexOf('El estilo Directivo (P30) es el menos desarrollado') >= 0,
  'y nombra el menos desarrollado con su percentil');

frase = gs.fraseSituacional(
  perfilDe({ medias: { TransfTot: 4.5 }, camin: { Dir: 30, Cons: 40, Part: 50, Or: 60 } }),
  { Dir: 30, Cons: 40, Part: 50, Or: 60 });
ok(/no muestra un estilo que domine con claridad/.test(frase),
  'si ninguno está alto, no inventa solvencia', frase);

// ── Regresión sobre los perfiles reales ──
// El informe viejo etiquetaba a todos como "Líder Relacional-Transformacional".
// Acertaba en dos de los tres, que es justamente el problema: no se sabía cuándo.
const referencia = JSON.parse(fs.readFileSync(REFERENCIA, 'utf8'));
const reales = referencia.filter((c) => /Planilla de Preguntas/.test(c.planilla));
const esperadoReal = {
  'Planilla de Preguntas - Chavo 1.xlsx': 'Líder Relacional-Transformacional',
  'Planilla de Preguntas - Chavo.xlsx': 'Líder Relacional-Transformacional',
  'Planilla de Preguntas - Quico.xlsx': 'Líder Transformacional',
};
reales.forEach((caso) => {
  const obtenido = gs.clasificarPerfil(gs.corregir(caso.respuestas)).etiqueta;
  const nombre = caso.planilla.replace('Planilla de Preguntas - ', '');
  ok(obtenido === esperadoReal[caso.planilla],
    `${nombre} se clasifica como se espera`, `dio "${obtenido}"`);
});
ok(reales.length === 3, 'se revisaron los tres perfiles reales', `hay ${reales.length}`);

// ── Salida ──
console.log(`\n${pasaron}/${pasaron + fallos.length} verificaciones del perfil en verde`);
if (fallos.length) {
  console.log('\nFallaron:');
  fallos.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
