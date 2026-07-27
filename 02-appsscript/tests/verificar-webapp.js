/**
 * Verificación de la aplicación web.
 *
 * Lo que se prueba acá es lo que el navegador puede pedirle al servidor:
 * que cada función verifique el acceso por su cuenta (google.script.run llega
 * directo a la función, sin pasar por doGet), que la calificación no pueda
 * escribir en cualquier fila, y que la página de error no devuelva texto sin
 * escapar.
 *
 * Uso:  node verificar-webapp.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const ARCHIVOS_GS = ['Acceso.gs', 'Configuracion.gs', 'Historial.gs', 'Metricas.gs', 'Progreso.gs', 'Informe.gs', 'WebApp.gs'];

const GRUPO = 'informes-rrhh@kolektor.com.ar';
const USUARIO = 'ana.perez@kolektor.com.ar';
const CARPETA_PLANILLAS = 'carpeta-planillas-id';

const ENCABEZADO = ['Fecha', 'Evaluado', 'Planilla', 'Informe', 'Generado por', 'Segundos', 'Calificación', 'Comentario'];

function hojaFalsa(filas) {
  const datos = filas.map((f) => f.slice());
  return {
    datos,
    getLastRow: () => datos.length,
    appendRow: (fila) => { datos.push(fila.slice()); },
    setFrozenRows: () => {},
    getRange: (fila, columna, cantidadFilas, cantidadColumnas) => ({
      getValues: () => datos.slice(fila - 1, fila - 1 + (cantidadFilas || 1))
        .map((f) => f.slice(columna - 1, columna - 1 + (cantidadColumnas || 1))),
      setValue: (valor) => { datos[fila - 1][columna - 1] = valor; },
      // La calificación escribe sus dos celdas de una sola vez, para que no exista
      // el estado intermedio con el puntaje guardado y el comentario todavía no.
      setValues: (valores) => {
        valores.forEach((f, i) => {
          f.forEach((valor, j) => { datos[fila - 1 + i][columna - 1 + j] = valor; });
        });
      },
    }),
  };
}

/** Lock simulado que anota de qué tipo es y si se tomó y se soltó. */
function bloqueoFalso(registro, tipo, ocupado) {
  registro.lock.tipo = tipo;
  return {
    waitLock: () => {
      if (ocupado) throw new Error('Could not obtain lock after 10000ms.');
      registro.lock.tomado++;
    },
    releaseLock: () => { registro.lock.suelto++; },
  };
}

function crearEntorno(escenario) {
  const e = escenario || {};
  const registro = {
    plantilla: null, titulo: null, htmlCrudo: null, grupo: null, cache: {},
    // Qué lock pidió la calificación y si lo soltó. El tipo importa: el de usuario
    // no serializa a dos personas distintas, que es lo único que hay que evitar.
    lock: { tipo: null, tomado: 0, suelto: 0 },
  };

  const hoja = hojaFalsa(e.filas || [ENCABEZADO]);
  const archivos = e.archivos || [
    { id: 'a', nombre: 'Planilla vieja.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', actualizado: 1000 },
    { id: 'b', nombre: 'Notas sueltas.pdf', mime: 'application/pdf', actualizado: 3000 },
    { id: 'c', nombre: 'Planilla nueva', mime: 'application/vnd.google-apps.spreadsheet', actualizado: 2000 },
  ];

  const propiedades = e.sinConfigurar ? {} : {
    CARPETA_INFORMES_ID: 'carpeta-informes-id',
    CARPETA_PLANILLAS_ID: CARPETA_PLANILLAS,
    HISTORIAL_SHEET_ID: 'historial-id',
    GRUPO_AUTORIZADO: e.grupo || GRUPO,
  };

  let indice = 0;
  const iterador = {
    hasNext: () => indice < archivos.length,
    next: () => {
      const a = archivos[indice++];
      return {
        getId: () => a.id,
        getName: () => a.nombre,
        getMimeType: () => a.mime,
        getLastUpdated: () => new Date(a.actualizado),
      };
    },
  };

  return {
    registro,
    hoja,
    globales: {
      PropertiesService: { getScriptProperties: () => ({ getProperties: () => propiedades }) },
      Session: {
        getActiveUser: () => ({ getEmail: () => USUARIO }),
        getScriptTimeZone: () => 'America/Argentina/Buenos_Aires',
      },
      GroupsApp: {
        getGroupByEmail: (correo) => {
          registro.grupo = correo;
          return { hasUser: () => !e.usuarioSinAcceso };
        },
      },
      DriveApp: { getFolderById: () => ({ getFiles: () => iterador }) },
      SpreadsheetApp: {
        openById: () => ({ getSheetByName: () => hoja, insertSheet: () => hoja }),
      },
      HtmlService: {
        createHtmlOutput: (html) => { registro.htmlCrudo = html; return { html: html }; },
        createTemplateFromFile: (nombre) => {
          registro.plantilla = nombre;
          const plantilla = {
            evaluate: () => ({
              setTitle(t) { registro.titulo = t; return this; },
              addMetaTag() { return this; },
            }),
          };
          // Se guarda para poder revisar lo que doGet le inyecta a la interfaz.
          registro.plantillaObj = plantilla;
          return plantilla;
        },
      },
      // Lock simulado. `lockOcupado` reproduce el caso de dos personas calificando
      // a la vez: waitLock lanza y la calificación no tiene que escribir nada.
      LockService: {
        getScriptLock: () => bloqueoFalso(registro, 'script', e.lockOcupado),
        getUserLock: () => bloqueoFalso(registro, 'usuario', e.lockOcupado),
      },
      // Cache simulado, para el progreso por etapas (Progreso.gs).
      CacheService: {
        getScriptCache: () => ({
          put: (k, v) => { registro.cache[k] = v; },
          get: (k) => (k in registro.cache ? registro.cache[k] : null),
          remove: (k) => { delete registro.cache[k]; },
        }),
      },
      Utilities: { formatDate: () => '23/07/2026 18:15' },
      DocumentApp: {}, MimeType: {}, UrlFetchApp: {}, ScriptApp: {}, Drive: {}, Charts: {},
      console: { warn: () => {} },
    },
  };
}

function cargarGs(globales) {
  const fuente = ARCHIVOS_GS.map((a) => fs.readFileSync(path.join(RAIZ, a), 'utf8')).join('\n');
  const nombres = Object.keys(globales);
  return new Function(
    ...nombres,
    `${fuente}\nreturn { doGet, listarPlanillas, listarHistorial, calificarInforme, obtenerMetricas, escaparHtml,
       progresoDeInforme, marcarEtapa, limpiarProgreso, ETAPAS_INFORME, VERSION_APP };`
  )(...nombres.map((n) => globales[n]));
}

function intentar(fn) {
  try {
    return { valor: fn(), error: null };
  } catch (e) {
    return { valor: null, error: e };
  }
}

function main() {
  const revisiones = [];
  const revisar = (nombre, ok, detalle) => revisiones.push([nombre, ok, detalle]);

  // ── doGet ──
  const normal = crearEntorno();
  const gs = cargarGs(normal.globales);
  const pagina = intentar(() => gs.doGet());
  revisar('doGet muestra la interfaz al usuario autorizado',
    !pagina.error && normal.registro.plantilla === 'Interfaz' && normal.registro.titulo.indexOf('Informes') >= 0);

  const sinAcceso = crearEntorno({ usuarioSinAcceso: true });
  const gsSinAcceso = cargarGs(sinAcceso.globales);
  const paginaSinAcceso = intentar(() => gsSinAcceso.doGet());
  revisar('doGet no arma la interfaz para quien no está en el grupo',
    !paginaSinAcceso.error && sinAcceso.registro.plantilla === null);
  revisar('y le dice a qué grupo pedir acceso',
    (sinAcceso.registro.htmlCrudo || '').indexOf(GRUPO) > 0);

  const sinConfig = crearEntorno({ sinConfigurar: true });
  const gsSinConfig = cargarGs(sinConfig.globales);
  const paginaSinConfig = intentar(() => gsSinConfig.doGet());
  revisar('doGet avisa si el proyecto no está configurado, en vez de romper',
    !paginaSinConfig.error && (sinConfig.registro.htmlCrudo || '').indexOf('CARPETA_PLANILLAS_ID') > 0,
    paginaSinConfig.error && paginaSinConfig.error.message);

  const conInyeccion = crearEntorno({ usuarioSinAcceso: true, grupo: '<script>alert(1)</script>@x.com' });
  const gsInyeccion = cargarGs(conInyeccion.globales);
  intentar(() => gsInyeccion.doGet());
  revisar('la página de error escapa el HTML que le llega',
    (conInyeccion.registro.htmlCrudo || '').indexOf('<script>alert') < 0
    && conInyeccion.registro.htmlCrudo.indexOf('&lt;script&gt;') > 0);

  // ── listarPlanillas ──
  const planillas = intentar(() => gs.listarPlanillas());
  revisar('lista sólo planillas, descartando otros archivos',
    !planillas.error && planillas.valor.length === 2
    && planillas.valor.every((p) => p.nombre.indexOf('.pdf') < 0),
    planillas.valor && planillas.valor.map((p) => p.nombre).join(', '));
  revisar('ordena por fecha, la más nueva primero',
    !planillas.error && planillas.valor[0].nombre === 'Planilla nueva');
  revisar('listarPlanillas exige acceso por su cuenta',
    !!intentar(() => gsSinAcceso.listarPlanillas()).error);

  // ── listarHistorial ──
  const conCorridas = crearEntorno({
    filas: [
      ENCABEZADO,
      [new Date(2026, 6, 20), 'Primero', 'p1.xlsx', 'https://drive/1', USUARIO, 4.1, '', ''],
      [new Date(2026, 6, 22), 'Segundo', 'p2.xlsx', 'https://drive/2', USUARIO, 3.9, 5, 'muy bueno'],
    ],
  });
  const gsCorridas = cargarGs(conCorridas.globales);
  const historial = intentar(() => gsCorridas.listarHistorial(25));
  revisar('el historial devuelve la corrida más reciente primero',
    !historial.error && historial.valor.length === 2 && historial.valor[0].evaluado === 'Segundo',
    historial.valor && historial.valor.map((c) => c.evaluado).join(', '));
  revisar('y devuelve el número de fila para poder calificar',
    !historial.error && historial.valor[0].fila === 3 && historial.valor[1].fila === 2);
  revisar('listarHistorial exige acceso por su cuenta',
    !!intentar(() => gsSinAcceso.listarHistorial()).error);

  // ── obtenerMetricas ──
  const metricas = intentar(() => gsCorridas.obtenerMetricas());
  revisar('las métricas salen del historial completo',
    !metricas.error && metricas.valor.total === 2 && metricas.valor.calificados === 1,
    metricas.error ? metricas.error.message : JSON.stringify(metricas.valor).slice(0, 80));
  revisar('obtenerMetricas exige acceso por su cuenta',
    !!intentar(() => gsSinAcceso.obtenerMetricas()).error);

  // ── calificarInforme ──
  const calificar = intentar(() => gsCorridas.calificarInforme(2, 4, 'correcto'));
  revisar('la calificación se guarda en la fila indicada',
    !calificar.error && conCorridas.hoja.datos[1][6] === 4 && conCorridas.hoja.datos[1][7] === 'correcto',
    calificar.error && calificar.error.message);
  revisar('no se puede calificar el encabezado', !!intentar(() => gsCorridas.calificarInforme(1, 4, '')).error);
  revisar('no se puede calificar una fila inexistente', !!intentar(() => gsCorridas.calificarInforme(99, 4, '')).error);
  revisar('no se puede calificar una fila negativa', !!intentar(() => gsCorridas.calificarInforme(-1, 4, '')).error);
  revisar('el puntaje tiene que estar entre 1 y 5',
    !!intentar(() => gsCorridas.calificarInforme(2, 0, '')).error
    && !!intentar(() => gsCorridas.calificarInforme(2, 6, '')).error
    && !!intentar(() => gsCorridas.calificarInforme(2, 'muchas', '')).error);
  gsCorridas.calificarInforme(2, 3, 'x'.repeat(900));
  revisar('el comentario se recorta a 500 caracteres', conCorridas.hoja.datos[1][7].length === 500);
  revisar('calificarInforme exige acceso por su cuenta',
    !!intentar(() => gsSinAcceso.calificarInforme(2, 4, '')).error);

  // ── El lock de la calificación ──
  // Registrar una corrida es un append y el Sheet lo serializa solo. Calificar es
  // leer el tamaño de la hoja, validar contra él y después escribir: eso no es
  // atómico, y con dos personas usando la app dejó de ser un caso imposible.
  revisar('la calificación toma el lock DE SCRIPT',
    conCorridas.registro.lock.tipo === 'script',
    `pidió el lock de ${conCorridas.registro.lock.tipo}: el de usuario no serializa`
    + ' a dos personas distintas, que es lo único que hay que evitar');
  revisar('y lo suelta al terminar',
    conCorridas.registro.lock.tomado > 0
    && conCorridas.registro.lock.suelto === conCorridas.registro.lock.tomado,
    JSON.stringify(conCorridas.registro.lock));

  // Un lock que queda tomado por un error de validación bloquea a todos los demás
  // hasta que expire, así que el release tiene que estar en un finally.
  const conFilaMala = crearEntorno({ filas: [ENCABEZADO, [new Date(), 'A', 'p', 'u', USUARIO, 1, '', '']] });
  const gsFilaMala = cargarGs(conFilaMala.globales);
  intentar(() => gsFilaMala.calificarInforme(99, 4, ''));
  revisar('el lock se suelta también cuando la fila es inválida',
    conFilaMala.registro.lock.tomado === 1 && conFilaMala.registro.lock.suelto === 1,
    JSON.stringify(conFilaMala.registro.lock));

  // Un puntaje inválido se rechaza sin llegar a pedir el lock: no tiene sentido
  // hacer esperar a nadie por un dato que ya sabemos que está mal.
  const conPuntajeMalo = crearEntorno({ filas: [ENCABEZADO, [new Date(), 'A', 'p', 'u', USUARIO, 1, '', '']] });
  const gsPuntajeMalo = cargarGs(conPuntajeMalo.globales);
  intentar(() => gsPuntajeMalo.calificarInforme(2, 9, ''));
  revisar('un puntaje inválido se rechaza antes de pedir el lock',
    conPuntajeMalo.registro.lock.tomado === 0, JSON.stringify(conPuntajeMalo.registro.lock));

  // Si otra persona lo está usando, se avisa en castellano y no se escribe nada.
  const conLockOcupado = crearEntorno({
    lockOcupado: true,
    filas: [ENCABEZADO, [new Date(), 'A', 'p', 'u', USUARIO, 1, '', '']],
  });
  const gsLockOcupado = cargarGs(conLockOcupado.globales);
  const ocupado = intentar(() => gsLockOcupado.calificarInforme(2, 4, 'no debería entrar'));
  revisar('si el lock está ocupado, se avisa con un mensaje entendible',
    !!ocupado.error && /Otra persona está calificando/.test(ocupado.error.message),
    ocupado.error && ocupado.error.message);
  revisar('y no se escribe nada',
    conLockOcupado.hoja.datos[1][6] === '' && conLockOcupado.hoja.datos[1][7] === '',
    JSON.stringify(conLockOcupado.hoja.datos[1]));

  // ── Progreso por etapas ──────────────────────────────────────────
  const prog = crearEntorno();
  const gsProg = cargarGs(prog.globales);

  revisar('hay entre 5 y 7 etapas, como pidió el PO',
    gsProg.ETAPAS_INFORME.length >= 5 && gsProg.ETAPAS_INFORME.length <= 7,
    `son ${gsProg.ETAPAS_INFORME.length}`);
  revisar('los nombres de las etapas son cortos',
    gsProg.ETAPAS_INFORME.every((e) => e.length <= 32),
    gsProg.ETAPAS_INFORME.filter((e) => e.length > 32).join(' | '));

  revisar('sin haber empezado, no hay progreso que informar',
    gsProg.progresoDeInforme('tok-1') === null);

  gsProg.marcarEtapa('tok-1', 0);
  const p0 = gsProg.progresoDeInforme('tok-1');
  revisar('la primera etapa se informa con su nombre y el total',
    !!p0 && p0.etapa === 0 && p0.total === gsProg.ETAPAS_INFORME.length
      && p0.nombre === gsProg.ETAPAS_INFORME[0],
    JSON.stringify(p0));

  gsProg.marcarEtapa('tok-1', 3);
  const p3 = gsProg.progresoDeInforme('tok-1');
  revisar('la etapa avanza al marcarse otra', !!p3 && p3.etapa === 3);

  // Dos corridas simultáneas no se pisan: cada una tiene su propia clave.
  gsProg.marcarEtapa('tok-2', 1);
  revisar('dos corridas en paralelo no se mezclan',
    gsProg.progresoDeInforme('tok-1').etapa === 3
      && gsProg.progresoDeInforme('tok-2').etapa === 1);

  gsProg.limpiarProgreso('tok-1');
  revisar('al terminar, el progreso se borra', gsProg.progresoDeInforme('tok-1') === null);
  revisar('y no se lleva el de la otra corrida', gsProg.progresoDeInforme('tok-2').etapa === 1);

  revisar('sin token no se registra nada y no rompe',
    !intentar(() => gsProg.marcarEtapa('', 2)).error
      && gsProg.progresoDeInforme('') === null);

  revisar('progresoDeInforme exige acceso por su cuenta',
    !!intentar(() => gsSinAcceso.progresoDeInforme('tok-2')).error);

  // Si el Cache falla, el informe tiene que seguir: perder el progreso es una
  // molestia, perder el informe no.
  const cacheRoto = crearEntorno();
  cacheRoto.globales.CacheService = {
    getScriptCache: () => ({
      put: () => { throw new Error('cache caído'); },
      get: () => { throw new Error('cache caído'); },
      remove: () => { throw new Error('cache caído'); },
    }),
  };
  const gsRoto = cargarGs(cacheRoto.globales);
  revisar('si el Cache falla, marcarEtapa no lanza',
    !intentar(() => gsRoto.marcarEtapa('tok', 1)).error);
  revisar('si el Cache falla, limpiarProgreso no lanza',
    !intentar(() => gsRoto.limpiarProgreso('tok')).error);
  revisar('si el Cache falla, el progreso se informa como desconocido',
    intentar(() => gsRoto.progresoDeInforme('tok')).valor === null);

  // ── Versión visible ──────────────────────────────────────────────
  // Se muestra para poder distinguir "el código nuevo falla" de "el navegador
  // está sirviendo un deployment viejo", que es lo que costó diagnosticar una vez.
  revisar('la versión sigue el esquema vN.M, con M entre 1 y 99',
    /^v[1-9]\d*\.([1-9]|[1-9]\d)$/.test(gsProg.VERSION_APP), gsProg.VERSION_APP);

  const conVersion = crearEntorno();
  const gsVersion = cargarGs(conVersion.globales);
  gsVersion.doGet();
  revisar('doGet le pasa la versión a la interfaz',
    conVersion.registro.plantillaObj
      && conVersion.registro.plantillaObj.version === gsVersion.VERSION_APP,
    String(conVersion.registro.plantillaObj && conVersion.registro.plantillaObj.version));
  revisar('la versión va también en el título de la pestaña',
    (conVersion.registro.titulo || '').indexOf(gsVersion.VERSION_APP) > 0,
    conVersion.registro.titulo);

  // La interfaz recibe los nombres de las etapas del servidor: una sola lista.
  gsProg.doGet();
  const inyectado = prog.registro.plantillaObj && prog.registro.plantillaObj.etapasJson;
  revisar('doGet le pasa a la interfaz los nombres de las etapas',
    !!inyectado && JSON.parse(inyectado).length === gsProg.ETAPAS_INFORME.length,
    String(inyectado));

  let fallados = 0;
  for (const [nombre, ok, detalle] of revisiones) {
    console.log(`  ${ok ? '✓' : '✗'} ${nombre}`);
    if (!ok) {
      fallados++;
      if (detalle) console.log(`      ${detalle}`);
    }
  }
  console.log(fallados
    ? `\n${fallados} de ${revisiones.length} verificaciones fallaron`
    : `\nAplicación web verificada (${revisiones.length} verificaciones)`);
  return fallados ? 1 : 0;
}

process.exit(main());
