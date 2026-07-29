/**
 * Mide un modelo contra el prompt real de la síntesis del punto 5.
 *
 * POR QUÉ EXISTE: la elección de modelo de `Sintesis.gs` está apoyada en
 * mediciones —latencias, modelos que devuelven 404, modelos que escriben mal— que
 * se hicieron con scripts sueltos que después se perdieron. Cada vez que hay que
 * revisar la decisión, alguien rehace el trabajo. Esto es ese trabajo, versionado.
 *
 * Lo que mide es lo que importa para esta app, en este orden:
 *
 *   1. Si el modelo existe. Figurar en `/v1/models` no alcanza: el
 *      `llama-3.1-nemotron-70b-instruct` está en el listado y devuelve 404.
 *   2. Cuánto tarda CADA BLOQUE. El límite real no es el total sino los 60 s a los
 *      que `UrlFetchApp` corta una llamada suelta, y por eso el pedido está partido
 *      en dos. Un modelo que promedia 70 s por bloque no sirve, por bueno que sea.
 *   3. Si la respuesta pasa las validaciones —las mismas que corren en producción—.
 *   4. Qué escribió, para poder juzgar la prosa a ojo. Ninguna validación mide si
 *      el texto es blando, que es el defecto por el que se descartó el 70B.
 *
 * Uso:  NVIDIA_API_KEY=nvapi-… node herramientas/medir-modelo.js [modelo…]
 *
 * Sin argumentos mide los modelos configurados por defecto en Sintesis.gs.
 * No toca nada del proyecto: sólo lee los .gs y llama a la API.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const REFERENCIA = path.join(RAIZ, 'tests', 'referencia-python.json');

const CLAVE = process.env.NVIDIA_API_KEY;
if (!CLAVE) {
  console.error('Falta NVIDIA_API_KEY. Uso: NVIDIA_API_KEY=nvapi-… node herramientas/medir-modelo.js [modelo…]');
  process.exit(1);
}

/** Sintesis.gs se carga igual que en los tests: sin los servicios de Apps Script. */
function cargarGs() {
  const fuente = ['Correccion.gs', 'Textos.gs', 'Sintesis.gs']
    .map((a) => fs.readFileSync(path.join(RAIZ, a), 'utf8'))
    .join('\n');
  const PropertiesService = { getScriptProperties: () => ({ getProperty: () => null }) };
  const UrlFetchApp = { fetch: () => { throw new Error('esta herramienta llama por su cuenta'); } };
  return new Function(
    'PropertiesService', 'UrlFetchApp', 'console',
    `${fuente}\nreturn { corregir, perfilParaSintesis, mensajesBloqueDescriptivo,
      mensajesBloqueAnalitico, validarBloque, jsonDeRespuesta, textoDeSintesis,
      LLM_URL, LLM_TEMPERATURA, LLM_TOP_P, LLM_MAX_TOKENS, LLM_MODELOS_POR_DEFECTO,
      SINTESIS_BLOQUE_DESCRIPTIVO, SINTESIS_BLOQUE_ANALITICO };`
  )(PropertiesService, UrlFetchApp, console);
}

const gs = cargarGs();
const referencia = JSON.parse(fs.readFileSync(REFERENCIA, 'utf8'));
// Caso 0 del fixture: datos sintéticos que ya están versionados. Acá no viaja
// ningún dato de una persona real, ni siquiera un nombre —el prompt usa un
// marcador, por lo mismo que en producción—.
const perfil = gs.perfilParaSintesis(gs.corregir(referencia[0].respuestas));

// El techo de una llamada suelta en Apps Script. Es el número contra el que se
// compara cada bloque: pasarse de acá significa que el bloque se corta.
const TECHO_APPS_SCRIPT_MS = 60000;

async function pedir(modelo, mensajes) {
  const arranque = Date.now();
  const respuesta = await fetch(gs.LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CLAVE}` },
    body: JSON.stringify({
      model: modelo,
      messages: mensajes,
      temperature: gs.LLM_TEMPERATURA,
      top_p: gs.LLM_TOP_P,
      max_tokens: gs.LLM_MAX_TOKENS,
      stream: false,
    }),
    // Más que el techo de Apps Script a propósito: interesa saber CUÁNTO se pasa,
    // no sólo que se pasó. Un modelo de 65 s se puede intentar acortar; uno de
    // 190 s no.
    signal: AbortSignal.timeout(240000),
  });
  const ms = Date.now() - arranque;
  const texto = await respuesta.text();
  return { ms, codigo: respuesta.status, texto };
}

async function medirBloque(modelo, bloque, mensajes) {
  let r;
  try {
    r = await pedir(modelo, mensajes);
  } catch (e) {
    return { ms: null, veredicto: `la llamada se interrumpió: ${e.message}` };
  }
  const segundos = (r.ms / 1000).toFixed(1);
  const dentro = r.ms <= TECHO_APPS_SCRIPT_MS ? 'entra' : 'SE PASA del techo de 60 s';

  if (r.codigo !== 200) {
    return { ms: r.ms, veredicto: `HTTP ${r.codigo} en ${segundos} s — ${r.texto.slice(0, 200)}` };
  }

  const cuerpo = JSON.parse(r.texto);
  const eleccion = cuerpo.choices && cuerpo.choices[0];
  const contenido = (eleccion && eleccion.message && eleccion.message.content) || '';
  // El razonamiento viaja aparte cuando el modelo lo tiene prendido. Que venga
  // lleno es la señal de que el interruptor de ese modelo no es el que le mandamos.
  const pensamiento = (eleccion && eleccion.message && eleccion.message.reasoning_content) || '';
  const datos = gs.jsonDeRespuesta(contenido);
  if (!datos) {
    return { ms: r.ms, veredicto: `${segundos} s (${dentro}) — no devolvió JSON interpretable`, pensamiento, contenido };
  }
  const revision = gs.validarBloque(bloque, datos, perfil);
  return {
    ms: r.ms,
    datos,
    pensamiento,
    veredicto: `${segundos} s (${dentro}) — ${revision.ok ? 'válido' : `RECHAZADO: ${revision.motivo}`}`,
  };
}

async function medir(modelo) {
  console.log(`\n═══ ${modelo}`);

  const descriptivo = await medirBloque(
    modelo, gs.SINTESIS_BLOQUE_DESCRIPTIVO,
    gs.mensajesBloqueDescriptivo('', perfil, modelo)
  );
  console.log(`  bloque 1 (descriptivo): ${descriptivo.veredicto}`);
  if (descriptivo.pensamiento) {
    console.log(`  ojo: devolvió ${descriptivo.pensamiento.length} caracteres de razonamiento.`
      + ' El interruptor que se le manda no es el que entiende este modelo.');
  }
  if (!descriptivo.datos) return;

  const analitico = await medirBloque(
    modelo, gs.SINTESIS_BLOQUE_ANALITICO,
    gs.mensajesBloqueAnalitico('', perfil, descriptivo.datos, modelo)
  );
  console.log(`  bloque 2 (analítico):   ${analitico.veredicto}`);

  // La prosa no la mide ninguna validación: se lee. Se muestran las dos piezas
  // donde se nota si el modelo escribe blando —el resumen y la primera inferencia,
  // que es lo que el PO pidió que tuviera valor real—.
  console.log('\n  resumen:');
  console.log(`    ${descriptivo.datos.resumenGeneral}`);
  if (analitico.datos && analitico.datos.inferencias) {
    console.log('  primera inferencia:');
    const i = analitico.datos.inferencias[0];
    console.log(`    ${i.titulo}: ${i.texto}`);
  }
}

(async () => {
  const modelos = process.argv.slice(2).length
    ? process.argv.slice(2)
    : gs.LLM_MODELOS_POR_DEFECTO;
  for (const modelo of modelos) {
    try {
      await medir(modelo);
    } catch (e) {
      console.log(`  no se pudo medir: ${e.message}`);
    }
  }
  console.log('\nEl bloque tiene que entrar en 60 s: es donde corta UrlFetchApp y no se configura.');
})();
