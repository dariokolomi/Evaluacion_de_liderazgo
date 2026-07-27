/**
 * Verificación diferencial del armado del informe.
 *
 * Corre Documento.gs contra un DocumentApp simulado y compara la estructura
 * resultante, bloque por bloque, con la del .docx que genera el motor Python:
 * mismo orden de párrafos y tablas, mismo texto en cada tramo, mismo formato,
 * mismo sombreado de celdas.
 *
 * Uso:  python3 dump-docx.py && node verificar-documento.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { DocumentApp, Body, normalizar } = require('./stub-documentapp');

const RAIZ = path.resolve(__dirname, '..');
const DOCUMENTO = path.join(__dirname, 'documento-python.json');

const MAX_DIFERENCIAS = 12;

/**
 * El corte de nivel, reescrito a mano a propósito.
 *
 * Podría importarse de Correccion.gs, pero entonces un cambio en el corte movería a
 * la vez el informe y la verificación, y nada se pondría en rojo. Escrito acá, la
 * verificación es independiente y un cambio de umbral tiene que decidirse dos veces.
 */
function nivelDe(p) {
  if (p >= 75) return 'Alto';
  if (p >= 25) return 'Medio';
  return 'Bajo';
}

/** Devuelve la oración que contiene `marca`, o '' si ninguna la tiene. */
function oracionCon(texto, marca) {
  return texto.split(/(?<=\.)\s+/).find((o) => o.indexOf(marca) >= 0) || '';
}

const SUBESCALAS_TRANSF = [
  ['ConsInd', 'Consideración Individualizada'],
  ['Inspir', 'Inspiración'],
  ['Carisma', 'Carisma'],
  ['EstimInt', 'Estimulación Intelectual'],
];

/**
 * Párrafos que ya NO deben coincidir con el informe de Python, a propósito.
 *
 * Python afirmaba estas cosas de forma fija, cualquiera fuera el resultado —el primer
 * defecto que señala HU1—. Ahora se calculan, así que la comparación literal dejaría
 * de tener sentido. En vez de saltearlos, cada uno se verifica contra el dato que
 * ahora lo gobierna: el párrafo sigue revisado, sólo cambia contra qué. Así la
 * comparación con Python se acota de forma deliberada y no se erosiona sin que nadie
 * se dé cuenta.
 *
 * Lo que se revisa acá es que el informe no CONTRADIGA el dato. Las reglas mismas se
 * verifican con valores escritos a mano en verificar-perfil.js, que es lo único que
 * pone algo en rojo cuando la regla cambia.
 *
 * `desde` es el comienzo del párrafo TAL COMO LO ESCRIBÍA PYTHON.
 */
const DIVERGENCIAS = [
  {
    desde: 'La persona evaluada muestra un perfil de liderazgo',
    porque: 'el estilo predominante se calcula; Python decía "Transformacional" siempre',
    revisar: (texto, perfil) => (perfil.mixto
      ? (/no muestra un estilo de liderazgo claramente predominante/.test(texto)
        || 'debería decir que no hay un estilo predominante')
      : (texto.indexOf(perfil.estilos[0].nombre + ' predominante') >= 0
        || `debería nombrar a ${perfil.estilos[0].nombre} como predominante`)),
  },
  {
    desde: 'Liderazgo Transformacional : ',
    porque: 'el reparto de las 4 subescalas se calcula; Python daba fortalezas a '
      + 'ConsInd e Inspir y zonas de crecimiento a Carisma y EstimInt, siempre',
    revisar: (texto, perfil, r) => {
      const cel = r.celid.percentil;
      const oracion = {
        Alto: oracionCon(texto, 'fortaleza'),
        Medio: oracionCon(texto, 'nivel intermedio'),
        Bajo: oracionCon(texto, 'de crecimiento'),
      };
      const mal = SUBESCALAS_TRANSF
        .filter(([clave, nombre]) => oracion[nivelDe(cel[clave])].indexOf(nombre) < 0)
        .map(([clave, nombre]) => `${nombre} (P${cel[clave]}, ${nivelDe(cel[clave])})`);
      return mal.length === 0
        || `estas subescalas no están en el grupo que les toca: ${mal.join(', ')}`;
    },
  },
  {
    desde: 'Liderazgo Transaccional : ',
    porque: 'el nivel se calcula; Python decía "en niveles moderados" siempre',
    revisar: (texto, perfil, r) => {
      const cel = r.celid.percentil;
      const faltan = ['DirExc', 'RecCont']
        .filter((k) => texto.indexOf(`en nivel ${nivelDe(cel[k]).toLowerCase()} (P${cel[k]})`) < 0);
      if (faltan.length) return `no declara el nivel real de ${faltan.join(' y ')}`;
      return nivelDe(cel.RecCont) !== 'Alto' || texto.indexOf('podría fortalecer') < 0
        || `con la Recompensa Contingente en P${cel.RecCont} no puede pedir fortalecer el reconocimiento`;
    },
  },
  {
    desde: 'Laissez-Faire : ',
    porque: 'la escala está invertida; Python la marcaba "zona de mayor atención" '
      + 'incluso en P5, que es el valor deseable',
    revisar: (texto, perfil, r) => {
      const p = r.celid.percentil.Laissez;
      const esZona = texto.indexOf('Zona de mayor atención') >= 0;
      if (nivelDe(p) === 'Alto') {
        return esZona || `con Laissez-Faire en P${p} sí corresponde marcar la zona de atención`;
      }
      if (nivelDe(p) === 'Bajo') {
        return (!esZona && /valor deseable/.test(texto))
          || `P${p} es bajo, o sea lo deseable: no puede ser "zona de mayor atención"`;
      }
      return !esZona || `P${p} es intermedio: no corresponde la zona de mayor atención`;
    },
  },
  {
    desde: 'Integrando las cinco pruebas',
    porque: 'la etiqueta se calcula; Python decía "Líder Relacional-Transformacional" siempre',
    revisar: (texto, perfil) => texto.indexOf(perfil.etiqueta) >= 0
      || `debería contener la etiqueta calculada "${perfil.etiqueta}"`,
  },
  {
    desde: 'En términos del modelo Situacional',
    porque: 'el estilo menos desarrollado se calcula; Python decía "Directivo" siempre',
    revisar: (texto, perfil) => texto.indexOf('El estilo ' + perfil.menosDesarrollado.nombre) >= 0
      || `debería nombrar a ${perfil.menosDesarrollado.nombre} como el menos desarrollado`,
  },
  {
    desde: 'El hallazgo más relevante del perfil',
    porque: 'la tensión se verifica; Python la afirmaba con Considerado y '
      + 'Participativo en cualquier valor y sin mirar el Laissez-Faire',
    revisar: (texto, perfil, r) => {
      const cam = r.camin.percentil;
      const laissez = r.celid.percentil.Laissez;
      if (/alto Liderazgo Considerado/.test(texto) && nivelDe(cam.Cons) !== 'Alto') {
        return `afirma un Liderazgo Considerado alto con P${cam.Cons}`;
      }
      if (/y Participativo \(P/.test(texto) && nivelDe(cam.Part) !== 'Alto') {
        return `lo suma al Participativo como alto con P${cam.Part}`;
      }
      if (/presencia de Laissez-Faire/.test(texto) && nivelDe(laissez) === 'Bajo') {
        return `habla de una presencia de Laissez-Faire que está en P${laissez}`;
      }
      const hayTension = (nivelDe(cam.Cons) === 'Alto' || nivelDe(cam.Part) === 'Alto')
        && nivelDe(laissez) !== 'Bajo';
      return hayTension === /Esta tensión sugiere/.test(texto)
        || (hayTension
          ? 'la tensión se da en este perfil y el párrafo no la reporta'
          : 'reporta una tensión que este perfil no tiene');
    },
  },
];

/**
 * Lo mismo para una celda: el fundamento de la competencia 2 afirmaba "el menos
 * desarrollado del perfil" con el Directivo en P75 o P10 de perfiles donde no lo
 * era. Ahora eso se dice sólo cuando es cierto, y cuando lo es la frase queda
 * idéntica a la de Python, así que la celda sigue comparándose en esos casos.
 */
const DIVERGENCIA_CELDA = {
  coincide: (texto) => /^P\d+: el menos desarrollado del perfil\./.test(texto),
  porque: 'el fundamento afirmaba "el menos desarrollado" sin verificarlo',
  revisar: (texto, perfil) => (perfil.menosDesarrollado.nombre === 'Directivo'
    ? (texto.indexOf('el menos desarrollado del perfil') >= 0
      || 'el Directivo ES el menos desarrollado, la frase tendría que decirlo')
    : (texto.indexOf('el menos desarrollado') < 0
      || `el menos desarrollado es ${perfil.menosDesarrollado.nombre}, no debería atribuírselo al Directivo`)),
};

/**
 * Neutraliza las celdas que divergen a propósito, después de verificarlas aparte.
 * Devuelve los problemas encontrados; deja las dos celdas iguales para que la
 * comparación profunda no las marque.
 */
function resolverCeldasDivergentes(esperado, obtenido, perfil) {
  const problemas = [];
  if (!esperado || esperado.tipo !== 'tabla' || !obtenido || obtenido.tipo !== 'tabla') return problemas;
  esperado.filas.forEach((fila, f) => {
    fila.forEach((celda, c) => {
      if (!DIVERGENCIA_CELDA.coincide(celda.texto)) return;
      const otra = obtenido.filas[f] && obtenido.filas[f][c];
      if (!otra) return;
      const veredicto = DIVERGENCIA_CELDA.revisar(otra.texto, perfil);
      if (veredicto !== true) {
        problemas.push(`celda[${f}][${c}] (${DIVERGENCIA_CELDA.porque}): ${veredicto}`);
      }
      celda.texto = otra.texto; // ya verificada: se saca de la comparación literal
    });
  });
  return problemas;
}

function divergenciaDe(bloque) {
  if (!bloque || bloque.tipo !== 'parrafo' || !bloque.tramos.length) return null;
  const texto = bloque.tramos.map((t) => t.texto).join('');
  return DIVERGENCIAS.find((d) => texto.indexOf(d.desde) === 0) || null;
}

function cargarGs() {
  const fuente = ['Correccion.gs', 'Textos.gs', 'Perfil.gs', 'Documento.gs']
    .map((a) => fs.readFileSync(path.join(RAIZ, a), 'utf8'))
    .join('\n');
  return new Function('DocumentApp', `${fuente}\nreturn { corregir, construirInforme, seccionGrafico, ANCHO_GRAFICO_PT, clasificarPerfil };`)(DocumentApp);
}

/** La fecha y el tamaño natural del radar salen del informe de Python:
 *  compararlos contra sí mismos no probaría nada, pero fijarlos evita
 *  diferencias espurias por la fecha del día o por el tamaño del PNG. */
function contextoDe(bloques) {
  const portada = bloques.find((b) => b.tipo === 'tabla');
  const imagen = bloques.find((b) => b.tipo === 'imagen');
  return {
    fecha: portada.filas[0][1].texto,
    radar: { ancho: imagen.ancho, alto: imagen.alto },
  };
}

function comparar(ruta, esperado, obtenido, diferencias) {
  if (diferencias.length >= MAX_DIFERENCIAS) return;
  const tipoE = Array.isArray(esperado) ? 'array' : typeof esperado;
  const tipoO = Array.isArray(obtenido) ? 'array' : typeof obtenido;

  if (tipoE === 'array' || tipoO === 'array') {
    if (tipoE !== tipoO) {
      diferencias.push(`${ruta}: python=${JSON.stringify(esperado)} js=${JSON.stringify(obtenido)}`);
      return;
    }
    if (esperado.length !== obtenido.length) {
      diferencias.push(`${ruta}: python tiene ${esperado.length} elemento(s), js tiene ${obtenido.length}`);
    }
    for (let i = 0; i < Math.max(esperado.length, obtenido.length); i++) {
      comparar(`${ruta}[${i}]`, esperado[i], obtenido[i], diferencias);
    }
    return;
  }
  if (esperado && obtenido && tipoE === 'object' && tipoO === 'object') {
    const claves = new Set([...Object.keys(esperado), ...Object.keys(obtenido)]);
    for (const clave of claves) comparar(`${ruta}.${clave}`, esperado[clave], obtenido[clave], diferencias);
    return;
  }
  if (typeof esperado === 'number' && typeof obtenido === 'number') {
    if (Math.abs(esperado - obtenido) > 0.51) {
      diferencias.push(`${ruta}: python=${esperado} js=${obtenido}`);
    }
    return;
  }
  if (esperado !== obtenido) {
    diferencias.push(`${ruta}: python=${JSON.stringify(esperado)} js=${JSON.stringify(obtenido)}`);
  }
}

/** Describe un bloque en una línea, para que el diff se pueda ubicar. */
function resumir(bloque) {
  if (!bloque) return '(no existe)';
  if (bloque.tipo === 'salto') return 'salto de página';
  if (bloque.tipo === 'imagen') return `imagen ${bloque.ancho}×${bloque.alto}`;
  if (bloque.tipo === 'tabla') return `tabla de ${bloque.filas.length} filas: "${bloque.filas[0][0].texto}"`;
  const texto = bloque.tramos.map((t) => t.texto).join('');
  return texto ? `párrafo: "${texto.slice(0, 60)}${texto.length > 60 ? '…' : ''}"` : 'párrafo vacío';
}

function main() {
  if (!fs.existsSync(DOCUMENTO)) {
    console.error(`Falta ${path.basename(DOCUMENTO)}. Correr primero: python3 dump-docx.py`);
    return 1;
  }

  const { corregir, construirInforme, clasificarPerfil } = cargarGs();
  const informes = JSON.parse(fs.readFileSync(DOCUMENTO, 'utf8'));

  let fallados = 0;
  for (const informe of informes) {
    const respuestas = informe.respuestas;
    const { fecha, radar } = contextoDe(informe.bloques);
    const resultados = corregir(respuestas);
    const perfilDelCaso = clasificarPerfil(resultados);
    const body = new Body();
    construirInforme(body, {
      nombre: informe.nombre,
      fecha,
      resultados,
      imagenRadar: radar,
    });
    const obtenido = normalizar(body.bloques);
    const esperado = informe.bloques;

    const diferencias = [];
    if (esperado.length !== obtenido.length) {
      diferencias.push(`cantidad de bloques: python=${esperado.length} js=${obtenido.length}`);
    }
    for (let i = 0; i < Math.min(esperado.length, obtenido.length); i++) {
      const antes = diferencias.length;
      // El radar ahora ocupa el ancho útil de la página, así que sus dimensiones
      // ya no coinciden con el PNG de Python a propósito: se verifica que haya
      // una imagen, no su tamaño.
      const divergencia = divergenciaDe(esperado[i]);
      if (divergencia) {
        const obtenidoTexto = (obtenido[i] && obtenido[i].tramos || [])
          .map((t) => t.texto).join('');
        const veredicto = divergencia.revisar(obtenidoTexto, perfilDelCaso, resultados);
        if (veredicto !== true) {
          diferencias.push(`bloque[${i}] (${divergencia.porque}): ${veredicto}`);
        }
        continue;
      }
      const deCeldas = resolverCeldasDivergentes(esperado[i], obtenido[i], perfilDelCaso);
      if (deCeldas.length) diferencias.push(...deCeldas);
      if (esperado[i] && esperado[i].tipo === 'imagen') {
        if (!obtenido[i] || obtenido[i].tipo !== 'imagen') {
          diferencias.push(`bloque[${i}]: se esperaba una imagen, js=${resumir(obtenido[i])}`);
        }
        continue;
      }
      comparar(`bloque[${i}]`, esperado[i], obtenido[i], diferencias);
      if (diferencias.length > antes) {
        diferencias.splice(antes, 0, `  ↳ ${resumir(esperado[i])}`);
      }
      if (diferencias.length >= MAX_DIFERENCIAS) {
        diferencias.push('… (se corta acá)');
        break;
      }
    }

    if (diferencias.length) {
      fallados++;
      console.log(`✗ ${informe.nombre} (${esperado.length} bloques)`);
      diferencias.forEach((d) => console.log(`    ${d}`));
    } else {
      const tablas = esperado.filter((b) => b.tipo === 'tabla').length;
      console.log(`✓ ${informe.nombre}: ${esperado.length} bloques idénticos (${tablas} tablas)`);
    }
  }

  console.log(`\n${informes.length - fallados}/${informes.length} informes coinciden`);
  return (fallados + verificarTamanoDelRadar()) ? 1 : 0;
}

/**
 * El radar se dimensiona en píxeles, no en puntos.
 *
 * Se verifica aparte porque la comparación contra Python dejó de mirar el tamaño
 * de la imagen —ahora es una decisión de layout— y sin esta comprobación el bug
 * volvería sin que nada se ponga rojo. Pasó: `setWidth()` espera píxeles, se le
 * pasaban puntos, y el gráfico salía un 25 % más chico (338 pt en lugar de 451)
 * en tres informes seguidos antes de que alguien lo midiera.
 */
function verificarTamanoDelRadar() {
  const gs = cargarGs();
  const cuerpo = new Body();
  const radarFalso = { ancho: 800, alto: 660 };
  gs.seccionGrafico(cuerpo, 'Ana Pérez', radarFalso, {}, {}, {});
  const imagen = (cuerpo.bloques || []).find((b) => b.tipo === 'imagen');

  const esperadoPx = Math.round(gs.ANCHO_GRAFICO_PT * 96 / 72);
  const problemas = [];
  if (!imagen) {
    problemas.push('no se insertó ninguna imagen');
  } else {
    if (imagen.ancho !== esperadoPx) {
      problemas.push(`el ancho es ${imagen.ancho} px y tendría que ser ${esperadoPx} px`
        + ` (${gs.ANCHO_GRAFICO_PT} pt convertidos a 96 DPI)`);
    }
    if (imagen.ancho <= gs.ANCHO_GRAFICO_PT) {
      problemas.push('el ancho no está convertido: se le están pasando puntos a una API'
        + ' que espera píxeles, y el gráfico va a salir un 25 % más chico');
    }
    const proporcion = imagen.alto / imagen.ancho;
    const natural = radarFalso.alto / radarFalso.ancho;
    if (Math.abs(proporcion - natural) > 0.01) {
      problemas.push(`la imagen quedó deformada: proporción ${proporcion.toFixed(3)}`
        + ` contra ${natural.toFixed(3)} del original`);
    }
  }

  if (problemas.length) {
    console.log('\n✗ tamaño del radar');
    problemas.forEach((p) => console.log(`    ${p}`));
    return 1;
  }
  console.log(`✓ tamaño del radar: ${imagen.ancho}×${imagen.alto} px`
    + ` (= ${gs.ANCHO_GRAFICO_PT} pt de ancho, proporción conservada)`);
  return 0;
}

process.exit(main());
