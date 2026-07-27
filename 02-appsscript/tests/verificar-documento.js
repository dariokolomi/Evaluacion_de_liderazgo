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
    desde: 'El siguiente gráfico contrasta el perfil de',
    porque: 'la frase equiparaba "cerca del ideal" con "fortaleza consolidada", que es '
      + 'el término que el punto 5 usa con otra regla',
    revisar: (texto) => (!/fortalezas consolidadas/.test(texto)
      && /se detalla en el punto 5/.test(texto))
      || 'debería remitir al punto 5 en vez de clasificar por su cuenta',
  },
  {
    desde: 'Fortalezas consolidadas: ',
    porque: 'el grupo sale de la distancia al ideal; Python listaba siempre las mismas 5',
    revisar: (texto, perfil, r) => revisarLineaDelMapa(texto, r, 'cercanas'),
  },
  {
    desde: 'Brechas principales: ',
    porque: 'el grupo sale de la distancia al ideal; Python listaba siempre las mismas 3',
    revisar: (texto, perfil, r) => revisarLineaDelMapa(texto, r, 'lejanas'),
  },
  {
    desde: 'Brechas moderadas: ',
    porque: 'el grupo sale de la distancia al ideal; Python listaba siempre las mismas 2',
    revisar: (texto, perfil, r) => revisarLineaDelMapa(texto, r, 'intermedias'),
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
 * La tabla de competencias a desarrollar, que ahora tiene un número variable de
 * filas: Python emitía las seis siempre, incluso en el perfil sin una sola brecha.
 * La comparación literal dejó de aplicar, así que se verifica el contenido.
 *
 * Qué competencias corresponden se recalcula acá, no se importa de Perfil.gs, por el
 * mismo motivo que `nivelDe`: si la condición cambiara de un lado tiene que ponerse
 * en rojo del otro.
 */
function competenciasEsperadas(r) {
  const cel = r.celid.percentil, cam = r.camin.percentil, con = r.conlid.percentil;
  const neuroticismoAlto = r.neo.nivel.N === 'Alto' || r.neo.nivel.N === 'Muy Alto';
  const esperadas = [];
  if (cel.Laissez >= 75) esperadas.push('Reducir episodios de Laissez-Faire');
  if (cam.Dir < 50) esperadas.push('Fortalecer el Liderazgo Directivo');
  if (cel.RecCont < 50) esperadas.push('Incrementar la Recompensa Contingente');
  if (cel.Carisma < 50 || cel.EstimInt < 50) {
    const cuales = [];
    if (cel.Carisma < 50) cuales.push('Carisma');
    if (cel.EstimInt < 50) cuales.push('Estimulación Intelectual');
    esperadas.push('Desarrollar ' + cuales.join(' y '));
  }
  if (neuroticismoAlto) esperadas.push('Gestionar la autorregulación emocional');
  if (neuroticismoAlto || con.Camb < 50) esperadas.push('Resiliencia y Gestión del Cambio');
  return esperadas.length ? esperadas : ['Sin competencias con brecha'];
}

const DIVERGENCIA_TABLA = {
  coincide: (bloque) => bloque && bloque.tipo === 'tabla' && bloque.filas[0]
    && bloque.filas[0][0].texto === 'Competencia a desarrollar',
  porque: 'las competencias se emiten cuando corresponden; Python emitía las 6 siempre',
  revisar: (tabla, r, perfil) => {
    const problemas = [];
    const filas = tabla.filas.slice(1);
    // Sin brechas la fila única no va numerada; con brechas, cada una lleva su número.
    const titulos = filas.map((f) => f[0].texto.replace(/^\d+\. /, ''));
    const esperadas = competenciasEsperadas(r);
    if (titulos.join(' | ') !== esperadas.join(' | ')) {
      problemas.push(`emite [${titulos.join(', ')}] y corresponden [${esperadas.join(', ')}]`);
    }
    if (esperadas.length > 1 || esperadas[0] !== 'Sin competencias con brecha') {
      filas.forEach((f, i) => {
        if (f[0].texto !== `${i + 1}. ${titulos[i]}`) {
          problemas.push(`la fila ${i} no está numerada como ${i + 1}`);
        }
      });
    }
    const fundamentos = filas.map((f) => f[1].texto).join(' ');
    if (/nivel moderado/.test(fundamentos)) {
      problemas.push('todavía hay un fundamento que afirma "nivel moderado" sin mirarlo');
    }
    const directivo = filas.find((f) => /Liderazgo Directivo/.test(f[0].texto));
    if (directivo && /el menos desarrollado/.test(directivo[1].texto)
      && perfil.menosDesarrollado.nombre !== 'Directivo') {
      problemas.push(`dice que el Directivo es el menos desarrollado y lo es ${perfil.menosDesarrollado.nombre}`);
    }
    const amabilidadAlta = r.neo.nivel.A === 'Alto' || r.neo.nivel.A === 'Muy Alto';
    if (/Amabilidad/.test(fundamentos) && !amabilidadAlta) {
      problemas.push(`invoca la Amabilidad como obstáculo con nivel ${r.neo.nivel.A} (T=${r.neo.t.A})`);
    }
    return problemas.length ? problemas.join('; ') : true;
  },
};

/**
 * Los 14 ejes del radar en el orden de RADAR_ETIQUETAS, con el nombre largo que usa
 * la prosa. Reescritos acá por el mismo motivo que todo lo demás de este archivo.
 */
const DIMS_RADAR = [
  'Carisma', 'Estimulación Intelectual', 'Inspiración', 'Consideración Individualizada',
  'Laissez-Faire', 'Recompensa Contingente', 'Dirección por Excepción',
  'Liderazgo Directivo', 'Liderazgo Considerado', 'Liderazgo Participativo',
  'Orientado a Metas', 'Conductas de Tarea', 'Conductas de Relaciones', 'Conductas de Cambio',
];

/** Qué dimensiones caen en cada grupo, por su distancia al perfil ideal del radar. */
function grupoDelMapa(r, cual) {
  return DIMS_RADAR.filter((_, i) => {
    const d = r.radar.ideal[i] - r.radar.evaluado[i];
    if (cual === 'cercanas') return d <= 10;
    if (cual === 'lejanas') return d >= 30;
    return d > 10 && d < 30;
  });
}

/** Revisa que una línea del mapa liste exactamente su grupo, ni más ni menos. */
function revisarLineaDelMapa(texto, r, cual) {
  const esperadas = grupoDelMapa(r, cual);
  const faltan = esperadas.filter((n) => texto.indexOf(n + ' (P') < 0);
  const sobran = DIMS_RADAR
    .filter((n) => esperadas.indexOf(n) < 0 && texto.indexOf(n + ' (P') >= 0);
  const problemas = [];
  if (faltan.length) problemas.push(`faltan ${faltan.join(', ')}`);
  if (sobran.length) problemas.push(`sobran ${sobran.join(', ')}`);
  if (!esperadas.length && !/ninguna dimensión/.test(texto)) {
    problemas.push('el grupo está vacío y la línea no lo dice');
  }
  return problemas.length ? problemas.join('; ') : true;
}

/**
 * Invariante de HU2, verificada en vez de asumida.
 *
 * El mapa clasifica por distancia al perfil ideal —que exige distinto de cada
 * dimensión— y el punto 5 por percentil absoluto con un corte plano. Son reglas
 * distintas, así que no pueden compartir el vocabulario: un Liderazgo Participativo
 * en P75 es fortaleza para el punto 5 y queda a 15 puntos de su ideal para el mapa.
 * Con las palabras viejas el informe se contradecía en 4 de los 29 casos.
 *
 * Se revisan dos cosas:
 *
 *   1. La sección 4 no usa los términos del punto 5. Es lo que mantiene la separación
 *      viva: sin esto, alcanza con que alguien "mejore la redacción" para que la
 *      contradicción vuelva.
 *   2. Ninguna dimensión aparece a la vez entre las más cercanas al ideal y entre las
 *      áreas de desarrollo del punto 5. Eso no debería pasar nunca —los ideales están
 *      entre P70 y P90, así que estar cerca implica percentil alto— y se midió en 0
 *      de 24.084 pares; queda verificado en cada corrida en vez de confiado.
 */
const PARES_MAPA_SINTESIS = [
  ['Laissez-Faire', 'Tendencia Laissez-Faire'],
  ['Liderazgo Directivo', 'Liderazgo Directivo'],
  ['Recompensa Contingente', 'Recompensa Contingente'],
  ['Carisma', 'Carisma e Influencia Simbólica'],
  ['Estimulación Intelectual', 'Estimulación Intelectual'],
  ['Conductas de Tarea', 'Conductas de Tarea'],
];

function revisarMapaContraSintesis(bloques) {
  const texto = (b) => (b.tramos || []).map((t) => t.texto).join('');
  const problemas = [];

  const inicio = bloques.findIndex((b) => texto(b).indexOf('4. GRÁFICO DE COHERENCIA') === 0);
  const fin = bloques.findIndex((b, i) => i > inicio && texto(b).indexOf('5. Síntesis') === 0);
  if (inicio >= 0 && fin > inicio) {
    const seccion4 = bloques.slice(inicio, fin).map(texto).join(' ');
    ['Fortalezas consolidadas', 'Brechas principales', 'Brechas moderadas']
      .filter((t) => seccion4.indexOf(t) >= 0)
      .forEach((t) => problemas.push(
        `la sección 4 usa "${t}", que es vocabulario del punto 5 con otra regla detrás`));
  }

  const cercanas = bloques.filter((b) => b.tipo === 'parrafo')
    .map(texto).find((t) => t.indexOf('Menor distancia al perfil ideal: ') === 0) || '';
  const desde = bloques.findIndex((b) => b.tipo === 'parrafo'
    && texto(b) === 'Principales Áreas de Desarrollo');
  const hasta = bloques.findIndex((b, i) => i > desde && b.tipo === 'parrafo'
    && texto(b) === 'Objetivos de Desarrollo Sugeridos');
  if (desde >= 0 && hasta > desde) {
    const areas = bloques.slice(desde + 1, hasta).map(texto).join(' ');
    PARES_MAPA_SINTESIS
      .filter(([enMapa, enSintesis]) => cercanas.indexOf(enMapa + ' (P') >= 0
        && areas.indexOf(enSintesis + ' (') >= 0)
      .forEach(([enMapa]) => problemas.push(
        `${enMapa} está entre las más cercanas al ideal y a la vez es área de desarrollo en el punto 5`));
  }
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

    const diferencias = revisarMapaContraSintesis(obtenido);
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
      if (DIVERGENCIA_TABLA.coincide(esperado[i])) {
        const veredicto = DIVERGENCIA_TABLA.coincide(obtenido[i])
          ? DIVERGENCIA_TABLA.revisar(obtenido[i], resultados, perfilDelCaso)
          : 'se esperaba la tabla de competencias';
        if (veredicto !== true) {
          diferencias.push(`bloque[${i}] (${DIVERGENCIA_TABLA.porque}): ${veredicto}`);
        }
        continue;
      }
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
  // El vector del radar no importa acá —lo que se mide es el tamaño de la imagen—
  // pero la lectura del mapa lo recorre, así que tiene que estar completo.
  const vector = { ideal: new Array(14).fill(75), evaluado: new Array(14).fill(75) };
  gs.seccionGrafico(cuerpo, 'Ana Pérez', radarFalso, vector, 25);
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
