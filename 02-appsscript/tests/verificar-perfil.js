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
    fraseSituacional, fraseTransformacional, fraseTransaccional, fraseLaissez,
    fraseHallazgo, brechasDeDesarrollo, competenciasADesarrollar, lecturaDelMapa,
    frasesLecturaDelMapa, MARGEN_PREDOMINANCIA, MARGEN_EJE,
    DISTANCIA_CONSOLIDADA, DISTANCIA_BRECHA_PRINCIPAL };`)();
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

// ═══════════════════════════════════════════════════════════════════
// Bloque 2.2 — las frases que repartían roles fijos
// ═══════════════════════════════════════════════════════════════════

/** Percentiles de CELID con lo que no se declara en P50, y medias parejas. */
function cel(pcts) {
  return Object.assign({
    TransfTot: 50, TransTot: 50, Laissez: 50,
    ConsInd: 50, Inspir: 50, Carisma: 50, EstimInt: 50, DirExc: 50, RecCont: 50,
  }, pcts);
}
const MEDIAS = {
  ConsInd: 4.00, Inspir: 3.50, Carisma: 3.25, EstimInt: 2.75,
  TransfTot: 3.40, TransTot: 3.00, Laissez: 2.00,
};

// ── Transformacional: el reparto de las 4 subescalas sale del percentil ──
// El caso que motivó todo: Carisma y Estimulación Intelectual altos, Consideración
// Individualizada e Inspiración bajas. El informe viejo decía exactamente lo
// contrario, con estos mismos números impresos al lado.
frase = gs.fraseTransformacional(
  cel({ TransfTot: 80, Carisma: 90, EstimInt: 85, ConsInd: 10, Inspir: 5 }), MEDIAS);
ok(/Con fortalezas en Carisma \(3\.25 \/ P90\) y Estimulación Intelectual \(2\.75 \/ P85\)\./.test(frase),
  'las subescalas altas son las fortalezas, sean cuales sean', frase);
ok(/La Consideración Individualizada \(4\.00 \/ P10\) y la Inspiración \(3\.50 \/ P5\) son zonas de crecimiento\./.test(frase),
  'y las bajas son las zonas de crecimiento', frase);
ok(frase.indexOf('P80. ') === 0, 'la frase sigue abriendo con el percentil total', frase);

// Las cuatro altas: no aparece ninguna zona de crecimiento inventada.
frase = gs.fraseTransformacional(
  cel({ ConsInd: 99, Inspir: 90, Carisma: 80, EstimInt: 75 }), MEDIAS);
ok(!/crecimiento|intermedio/.test(frase),
  'con las cuatro altas no se inventa ni una zona de crecimiento ni un nivel intermedio', frase);
ok((frase.match(/P\d+/g) || []).length === 5,
  'y las cuatro se siguen nombrando con su valor, más el total', frase);

// P75 exacto entra como alto: es el corte que usa el resto del informe. Si el PO
// resuelve que P75 no es fortaleza (pregunta 3), esta verificación tiene que caer.
frase = gs.fraseTransformacional(cel({ ConsInd: 75, Inspir: 74 }), MEDIAS);
ok(/fortaleza en Consideración Individualizada/.test(frase),
  'P75 exacto cuenta como fortaleza, y en singular cuando es una sola', frase);
ok(/Inspiración \(3\.50 \/ P74\).*nivel intermedio/.test(frase),
  'P74 no llega: queda en el nivel intermedio', frase);

// Las cuatro bajas.
frase = gs.fraseTransformacional(
  cel({ ConsInd: 1, Inspir: 5, Carisma: 10, EstimInt: 24 }), MEDIAS);
ok(/son zonas de crecimiento\.$/.test(frase) && !/fortaleza/.test(frase),
  'con las cuatro bajas no se inventa una fortaleza', frase);
ok(/^P50\. La Consideración Individualizada .*, la Inspiración .*, el Carisma .* y la Estimulación Intelectual/.test(frase),
  'cada una lleva su artículo y la enumeración se arma bien', frase);

// La "y" delante de "Inspiración" tiene que ser "e".
frase = gs.fraseTransformacional(cel({ ConsInd: 90, Inspir: 90 }), MEDIAS);
ok(/Consideración Individualizada \(4\.00 \/ P90\) e Inspiración/.test(frase),
  'la conjunción es "e" delante de Inspiración', frase);

// ── Transaccional: el nivel es el de cada escala, no "moderado" siempre ──
frase = gs.fraseTransaccional(cel({ TransTot: 90, DirExc: 99, RecCont: 90 }));
ok(/Dirección por Excepción en nivel alto \(P99\) y Recompensa Contingente en nivel alto \(P90\)/.test(frase),
  'cada escala declara su nivel real', frase);
ok(/reconoce el buen desempeño de manera sistemática/.test(frase)
  && !/podría fortalecer/.test(frase),
  'con la Recompensa Contingente alta no se pide fortalecer el reconocimiento', frase);

frase = gs.fraseTransaccional(cel({ TransTot: 5, DirExc: 5, RecCont: 5 }));
ok(/en nivel bajo \(P5\) y Recompensa Contingente en nivel bajo \(P5\)/.test(frase),
  'y lo mismo en el extremo bajo', frase);
ok(/Puede dejar pasar desvíos sin intervenir/.test(frase),
  'con la Dirección por Excepción baja no se afirma que interviene', frase);

frase = gs.fraseTransaccional(cel({ DirExc: 50, RecCont: 50 }));
ok(/en nivel medio \(P50\) y Recompensa Contingente en nivel medio \(P50\)/.test(frase),
  'en el medio dice medio, que es lo que antes decía siempre', frase);

// ── Laissez-Faire: la escala está invertida ──
// Es la verificación que impide reintroducir el error más fácil del bloque.
frase = gs.fraseLaissez(cel({ Laissez: 5 }));
ok(!/Zona de mayor atención/.test(frase),
  'P5 en Laissez-Faire NO es zona de atención: es el valor deseable', frase);
ok(/valor deseable/.test(frase) && /no aparece como un rasgo del perfil/.test(frase),
  'y se dice que es lo deseable, no que falte información', frase);
ok(!/menor madurez/.test(frase),
  'sin Laissez-Faire presente no se advierte sobre la falta de dirección', frase);

frase = gs.fraseLaissez(cel({ Laissez: 90 }));
ok(/^P90\. Zona de mayor atención\./.test(frase),
  'P90 sí es zona de mayor atención', frase);
ok(/menor madurez puede generar falta de dirección\.$/.test(frase),
  'y conserva la advertencia del informe original', frase);

frase = gs.fraseLaissez(cel({ Laissez: 50 }));
ok(/^P50\. Nivel intermedio\./.test(frase) && !/Zona de mayor atención/.test(frase),
  'P50 es intermedio, ni deseable ni zona de atención', frase);

// ── El hallazgo de la sección 3: las cuatro configuraciones ──
frase = gs.fraseHallazgo({ Cons: 90, Part: 85, Dir: 50, Or: 50 }, cel({ Laissez: 80 }));
ok(/combinación de un alto Liderazgo Considerado \(P90\) y Participativo \(P85\)/.test(frase)
  && /Esta tensión sugiere/.test(frase),
  'cercanía alta + Laissez-Faire presente: la tensión existe y se reporta', frase);

frase = gs.fraseHallazgo({ Cons: 90, Part: 85, Dir: 50, Or: 50 }, cel({ Laissez: 5 }));
ok(!/Esta tensión sugiere/.test(frase) && /Laissez-Faire bajo \(P5\)/.test(frase),
  'con el Laissez-Faire bajo no hay tensión que reportar', frase);

frase = gs.fraseHallazgo({ Cons: 20, Part: 10, Dir: 50, Or: 50 }, cel({ Laissez: 90 }));
ok(/Laissez-Faire alto \(P90\) sin conductas de acompañamiento cercano/.test(frase),
  'no-intervención alta sin acompañamiento: es el hallazgo simétrico, que la versión'
  + ' anterior no podía ni nombrar', frase);
ok(!/alto Liderazgo Considerado/.test(frase),
  'y no le atribuye un Considerado alto que no tiene', frase);

frase = gs.fraseHallazgo({ Cons: 40, Part: 30, Dir: 50, Or: 50 }, cel({ Laissez: 40 }));
ok(/no presenta la tensión entre acompañamiento cercano y no-intervención/.test(frase),
  'sin nada alto, se dice que la tensión no está', frase);
ok(/P40\) ni el Participativo \(P30\)/.test(frase),
  'y se nombran igual los valores, que el informe tiene que comentar', frase);

// Una sola de las dos conductas de cercanía alta: se nombra esa, no las dos.
frase = gs.fraseHallazgo({ Cons: 90, Part: 30, Dir: 50, Or: 50 }, cel({ Laissez: 80 }));
ok(/combinación de un alto Liderazgo Considerado \(P90\) con una presencia/.test(frase),
  'con una sola conducta alta, la frase nombra sólo esa', frase);
ok(!/P30/.test(frase), 'y no suma el Participativo bajo a la afirmación', frase);

// ═══════════════════════════════════════════════════════════════════
// Sección 3 — la tabla de competencias a desarrollar
// ═══════════════════════════════════════════════════════════════════

/** Un perfil sin ninguna brecha, sobre el que se enciende una cosa por vez. */
function competencias({ celid, camin, conlid, neoNivel, neoT, menosDesarrollado }) {
  const neo = {
    nivel: Object.assign({ N: 'Promedio', A: 'Promedio', E: 'Promedio' }, neoNivel || {}),
    t: Object.assign({ N: 50, A: 50, E: 50 }, neoT || {}),
  };
  return gs.competenciasADesarrollar(
    neo,
    cel(Object.assign({ Laissez: 10, RecCont: 90, Carisma: 90, EstimInt: 90, DirExc: 90 }, celid || {})),
    Object.assign({ Dir: 90, Cons: 50, Part: 50, Or: 50 }, camin || {}),
    Object.assign({ Tar: 90, Rel: 90, Camb: 90 }, conlid || {}),
    { menosDesarrollado: { nombre: menosDesarrollado || 'Considerado' } });
}
const titulos = (filas) => filas.map((f) => f[0]);

// Sin brechas no se emite un plan de desarrollo de seis puntos.
let filas = competencias({});
ok(filas.length === 1 && filas[0][0] === 'Sin competencias con brecha',
  'un perfil sin brechas no recibe seis competencias a desarrollar', JSON.stringify(titulos(filas)));
ok(!/^\d\. /.test(filas[0][0]),
  'y esa fila única no va numerada, porque no es la primera de una lista', filas[0][0]);

// Cada condición enciende su competencia y sólo la suya.
ok(titulos(competencias({ celid: { Laissez: 75 } })).join() === '1. Reducir episodios de Laissez-Faire',
  'P75 en Laissez-Faire enciende la competencia 1 y nada más',
  JSON.stringify(titulos(competencias({ celid: { Laissez: 75 } }))));
ok(titulos(competencias({ celid: { Laissez: 74 } })).join() === 'Sin competencias con brecha',
  'P74 no llega al corte');
ok(titulos(competencias({ camin: { Dir: 49 } })).join() === '1. Fortalecer el Liderazgo Directivo',
  'P49 en Directivo enciende la competencia del Directivo');
ok(titulos(competencias({ camin: { Dir: 50 } })).join() === 'Sin competencias con brecha',
  'P50 exacto no es brecha: el corte es estricto');

// La numeración se arma con las que quedaron, no con la posición del catálogo.
filas = competencias({ celid: { Laissez: 90, RecCont: 10 }, conlid: { Camb: 10 } });
ok(titulos(filas).join(' / ') === '1. Reducir episodios de Laissez-Faire'
  + ' / 2. Incrementar la Recompensa Contingente / 3. Resiliencia y Gestión del Cambio',
  'tres competencias salteadas del catálogo se numeran 1, 2 y 3',
  JSON.stringify(titulos(filas)));

// La Amabilidad se invoca sólo si está alta: el fundamento decía "Alta Amabilidad"
// con T=30 y todo.
filas = competencias({ celid: { Laissez: 90 }, neoNivel: { A: 'Bajo' }, neoT: { A: 30 } });
ok(!/Amabilidad/.test(filas[0][1]),
  'con la Amabilidad baja no se la nombra como obstáculo para confrontar', filas[0][1]);
filas = competencias({ celid: { Laissez: 90 }, neoNivel: { A: 'Muy Alto' }, neoT: { A: 70 } });
ok(/Amabilidad muy alta \(T=70\)/.test(filas[0][1]),
  'y con la Amabilidad muy alta sí, concordando en género', filas[0][1]);

// Carisma y Estimulación Intelectual: se nombra la que está por debajo del corte.
filas = competencias({ celid: { Carisma: 20 } });
ok(filas[0][0] === '1. Desarrollar Carisma',
  'con sólo el Carisma bajo, la competencia no arrastra la Estimulación Intelectual', filas[0][0]);
ok(!/desafíos intelectuales/.test(filas[0][2]),
  'y la acción tampoco', filas[0][2]);
filas = competencias({ celid: { Carisma: 20, EstimInt: 30 } });
ok(filas[0][0] === '1. Desarrollar Carisma y Estimulación Intelectual',
  'con las dos, la fila queda como la del informe original', filas[0][0]);
ok(/Carisma P20 \(nivel bajo\) y Estimulación Intelectual P30 \(nivel medio\)/.test(filas[0][1]),
  'y cada una declara su nivel real, no "en nivel Medio" para las dos', filas[0][1]);

// "sostener el estilo Considerado" era otro supuesto: sólo si el Considerado está alto.
filas = competencias({ neoNivel: { N: 'Alto' }, neoT: { N: 65 }, camin: { Cons: 30 } });
ok(/base para sostener el rol sin agotamiento/.test(filas[0][1]),
  'con el Considerado bajo no se afirma que ése sea el estilo a sostener', filas[0][1]);
filas = competencias({ neoNivel: { N: 'Alto' }, neoT: { N: 65 }, camin: { Cons: 90 } });
ok(/sostener el estilo Considerado/.test(filas[0][1]),
  'y con el Considerado alto sí', filas[0][1]);

// El Neuroticismo alto enciende dos competencias, como en el informe original.
ok(competencias({ neoNivel: { N: 'Muy Alto' }, neoT: { N: 70 } }).length === 2,
  'el Neuroticismo alto enciende autorregulación y resiliencia');

ok(gs.brechasDeDesarrollo({ nivel: { N: 'Alto' }, t: { N: 65 } },
  cel({ Laissez: 75, RecCont: 49, Carisma: 49, EstimInt: 49, DirExc: 49 }),
  { Dir: 49 }, { Tar: 49, Camb: 49 }).autorregulacion === true,
  'brechasDeDesarrollo expone la condición de autorregulación por separado');

// ═══════════════════════════════════════════════════════════════════
// Sección 4 — la lectura del radar
// ═══════════════════════════════════════════════════════════════════

/** Radar de 14 ejes: el ideal real, y el evaluado con lo que se declare. */
function radarCon(evaluado) {
  const ideal = [90, 85, 90, 90, 85, 75, 70, 75, 80, 90, 85, 75, 85, 85];
  return { ideal, evaluado: ideal.map((v, i) => (evaluado[i] === undefined ? v : evaluado[i])) };
}

// Los tres grupos salen de la distancia, y el corte es el declarado.
let mapa = gs.lecturaDelMapa(radarCon({ 0: 80, 1: 65, 2: 40 }), 10);
ok(mapa.consolidadas.some((d) => d.nombre === 'Carisma'),
  'a 10 puntos del ideal (P80 contra P90), la dimensión está en el grupo cercano',
  JSON.stringify(mapa.consolidadas.map((d) => d.nombre)));
ok(mapa.moderadas.some((d) => d.nombre === 'Estimulación Intelectual'),
  'a 20 del ideal, queda en distancia intermedia',
  JSON.stringify(mapa.moderadas.map((d) => d.nombre)));
ok(mapa.principales.some((d) => d.nombre === 'Inspiración'),
  'a 50 del ideal, queda en el grupo lejano');

// Los dos bordes, que es donde un cambio de umbral se tiene que notar.
mapa = gs.lecturaDelMapa(radarCon({ 0: 79, 1: 55 }), 10);
ok(mapa.moderadas.some((d) => d.nombre === 'Carisma'),
  'a 11 del ideal ya no es cercana', JSON.stringify(mapa.moderadas.map((d) => d.nombre)));
ok(mapa.principales.some((d) => d.nombre === 'Estimulación Intelectual'),
  'y a 30 exactos ya es lejana, no intermedia',
  JSON.stringify(mapa.principales.map((d) => d.nombre)));
ok(gs.DISTANCIA_CONSOLIDADA === 10 && gs.DISTANCIA_BRECHA_PRINCIPAL === 30,
  'los dos umbrales siguen declarados donde el PO los puede ver');

// El Laissez-Faire entra invertido al radar y se muestra con su percentil crudo.
mapa = gs.lecturaDelMapa(radarCon({ 4: 95 }), 5);
const laissez = mapa.consolidadas.find((d) => d.nombre === 'Laissez-Faire');
ok(laissez && laissez.percentil === 5,
  'el Laissez-Faire se muestra con el percentil crudo, no con el del gráfico',
  laissez && String(laissez.percentil));
ok(laissez && laissez.distancia === -10,
  'pero la distancia se mide sobre el valor invertido del gráfico',
  laissez && String(laissez.distancia));

let lineas = gs.frasesLecturaDelMapa(radarCon({ 4: 95 }), 5);
ok(/Laissez-Faire \(P5 — invertido en gráfico\)/.test(lineas[0]),
  'y la línea lo aclara, sin ponerle al lado un ideal de la escala dada vuelta', lineas[0]);
ok(!/Laissez-Faire \(P5 vs ideal/.test(lineas[0]),
  'porque comparar un percentil crudo contra el ideal invertido induciría al error');

// Un grupo vacío se dice.
lineas = gs.frasesLecturaDelMapa(radarCon({}), 10);
ok(/^Mayor distancia al perfil ideal: ninguna dimensión/.test(lineas[1]),
  'sin dimensiones lejanas, la línea lo dice en vez de rellenar', lineas[1]);
ok(/^Distancia intermedia: ninguna dimensión/.test(lineas[2]),
  'y lo mismo con la intermedia', lineas[2]);

// El orden pone primero lo más lejano, que es lo que hace útil la lista.
lineas = gs.frasesLecturaDelMapa(radarCon({ 0: 20, 1: 50, 2: 10 }), 10);
ok(lineas[1].indexOf('Inspiración') < lineas[1].indexOf('Carisma'),
  'las lejanas van de mayor a menor distancia', lineas[1]);

// La separación de vocabularios: es lo que impide que vuelva la contradicción.
ok(!/[Ff]ortaleza|[Bb]recha/.test(lineas.join(' ')),
  'la lectura del mapa no usa las palabras del punto 5, que clasifica con otra regla',
  lineas.join(' | '));

// ── Regresión sobre los perfiles reales ──
// El informe viejo etiquetaba a todos como "Líder Relacional-Transformacional".
// Acertaba en dos de los tres, que es justamente el problema: no se sabía cuándo.
const referencia = JSON.parse(fs.readFileSync(REFERENCIA, 'utf8'));
const reales = referencia.filter((c) => /Planilla de Preguntas/.test(c.planilla));
const esperadoReal = {
  'Planilla de Preguntas - FM 1.xlsx': 'Líder Relacional-Transformacional',
  'Planilla de Preguntas - FM.xlsx': 'Líder Relacional-Transformacional',
  'Planilla de Preguntas - SM.xlsx': 'Líder Transformacional',
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
