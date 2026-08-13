/**
 * Verificación del orquestador.
 *
 * El riesgo del orquestador no son las cuentas —eso ya está verificado pieza
 * por pieza— sino el orden de las operaciones, lo que crea en Drive y lo que
 * deja tirado cuando algo sale mal. Todo eso se prueba contra servicios de
 * Google simulados: cada uno registra lo que se le pidió.
 *
 * Uso:  python3 dump-celdas.py && node verificar-orquestador.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { DocumentApp, Body } = require('./stub-documentapp');

const RAIZ = path.resolve(__dirname, '..');
const CELDAS = path.join(__dirname, 'celdas-python.json');

const ARCHIVOS_GS = [
  'Correccion.gs', 'Lectura.gs', 'Textos.gs', 'Perfil.gs', 'Documento.gs',
  'Documento2.gs', 'Radar.gs', 'Configuracion.gs', 'Acceso.gs', 'Historial.gs',
  'Sintesis.gs', 'Sintesis2.gs', 'Puesto.gs', 'Progreso.gs', 'Informe.gs',
  'Informe2.gs',
];

const CARPETA_INFORMES = 'carpeta-informes-id';
const HISTORIAL = 'historial-sheet-id';
const GRUPO = 'informes-rrhh@kolektor.com.ar';
const USUARIO = 'ana.perez@kolektor.com.ar';

/** Arma el entorno simulado. `escenario` tuerce una cosa por vez. */
function crearEntorno(grillas, escenario) {
  const e = escenario || {};
  const registro = {
    creados: [], trashed: [], convertidos: 0, exportados: [],
    archivosEnCarpeta: [], historial: [], cuerpo: null, grupoConsultado: null,
    renombrados: [], propiedadesEscritas: {}, lock: { tomado: 0, suelto: 0 },
  };

  const propiedades = e.sinConfigurar ? {} : {
    CARPETA_INFORMES_ID: CARPETA_INFORMES,
    CARPETA_PLANILLAS_ID: 'carpeta-planillas-id',
    HISTORIAL_SHEET_ID: HISTORIAL,
    GRUPO_AUTORIZADO: GRUPO,
  };

  const hojaDeGrilla = (filas) => ({
    getDataRange: () => ({ getValues: () => filas }),
    getLastRow: () => filas.length,
    // Como una hoja de verdad: lo que se agrega queda EN la hoja. Sin esto,
    // getLastRow sigue devolviendo 0 y el encabezado se vuelve a escribir en cada
    // llamada, que es justo lo que este test tiene que poder detectar.
    appendRow: (fila) => { filas.push(fila); registro.historial.push(fila); },
    setFrozenRows: () => {},
    getMaxColumns: () => 26,
    insertColumnsAfter: () => {},
    getRange: () => ({ setValues: () => {}, getValues: () => [[]] }),
    newChart: () => constructorDeGrafico,
    insertChart: () => {},
    getCharts: () => [{ getAs: () => ({ setName: (n) => ({ nombre: n }) }) }],
  });

  const constructorDeGrafico = {
    setChartType() { return this; }, addRange() { return this; },
    setPosition() { return this; }, setOption() { return this; },
    build() { return {}; },
  };

  const libroPlanilla = {
    getSheetByName: (nombre) => (grillas[nombre] ? hojaDeGrilla(grillas[nombre]) : null),
    getSheets: () => [hojaDeGrilla([])],
    getId: () => 'libro-temporal-radar',
  };

  const hojaHistorial = hojaDeGrilla(e.historialVacio === false ? [['Fecha']] : []);

  const SpreadsheetApp = {
    openById: (id) => (id === HISTORIAL
      ? { getSheetByName: () => hojaHistorial, insertSheet: () => hojaHistorial }
      : libroPlanilla),
    create: (nombre) => {
      registro.creados.push({ tipo: 'planilla-radar', nombre });
      return { getId: () => 'libro-temporal-radar', getSheets: () => [hojaDeGrilla([])] };
    },
    flush: () => {},
  };

  const cuerpo = new Body(true); // un Doc nuevo trae un párrafo vacío
  registro.cuerpo = cuerpo;

  const DocumentAppStub = Object.assign({}, DocumentApp, {
    create: (nombre) => {
      registro.creados.push({ tipo: 'doc', nombre });
      return { getId: () => 'doc-temporal', getBody: () => cuerpo, saveAndClose: () => {} };
    },
  });

  const DriveApp = {
    getFileById: (id) => ({
      getMimeType: () => (e.entradaEsSheet ? 'application/vnd.google-apps.spreadsheet' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      // El perfil de puesto y la planilla son dos archivos distintos: el nombre
      // importa porque de ahí sale la extensión al renombrarlos.
      getName: () => (id === 'perfil-id' ? 'Perfil Scrum Master.pdf' : 'Planilla de Preguntas - Chavo.xlsx'),
      setTrashed: () => { registro.trashed.push(id); },
      // El renombrado de los insumos, que corre después de guardar el informe.
      setName: (nombre) => {
        if (e.renombradoFalla) throw new Error('sin permiso para renombrar');
        registro.renombrados.push({ id, nombre });
      },
    }),
    getFolderById: (id) => ({
      createFile: (blob) => {
        registro.archivosEnCarpeta.push({ carpeta: id, nombre: blob.nombre });
        return { getId: () => 'informe-docx-id', getUrl: () => 'https://drive.google.com/file/d/informe-docx-id' };
      },
    }),
  };

  const Drive = {
    Files: {
      copy: () => {
        registro.convertidos++;
        return { id: 'copia-convertida' };
      },
    },
  };

  const UrlFetchApp = {
    fetch: (url) => {
      registro.exportados.push(url);
      return {
        getResponseCode: () => (e.exportacionFalla ? 500 : 200),
        getBlob: () => ({ setName: (n) => ({ nombre: n }) }),
      };
    },
  };

  return {
    registro,
    globales: {
      // getProperty lo usa Sintesis.gs para leer la clave del LLM. Acá nunca está
      // definida, así que la síntesis devuelve null y el punto 5 sale con el
      // texto determinista, que es justamente lo que este test compara.
      PropertiesService: {
        getScriptProperties: () => ({
          getProperties: () => propiedades,
          getProperty: (clave) => propiedades[clave] || null,
          // El contador de códigos vive acá: `reservarCodigo` lo lee y lo escribe.
          setProperty: (clave, valor) => {
            propiedades[clave] = valor;
            registro.propiedadesEscritas[clave] = valor;
          },
        }),
      },
      LockService: {
        getScriptLock: () => ({
          waitLock: () => { registro.lock.tomado++; },
          releaseLock: () => { registro.lock.suelto++; },
        }),
      },
      Session: { getActiveUser: () => ({ getEmail: () => USUARIO }), getScriptTimeZone: () => 'America/Argentina/Buenos_Aires' },
      GroupsApp: {
        getGroupByEmail: (correo) => {
          registro.grupoConsultado = correo;
          if (e.grupoInexistente) throw new Error('grupo inexistente');
          return { hasUser: () => !e.usuarioSinAcceso };
        },
      },
      SpreadsheetApp,
      DocumentApp: DocumentAppStub,
      DriveApp,
      Drive,
      UrlFetchApp,
      ScriptApp: { getOAuthToken: () => 'token' },
      Charts: { ChartType: { RADAR: 'RADAR' } },
      MimeType: { GOOGLE_SHEETS: 'application/vnd.google-apps.spreadsheet' },
      Utilities: {
        formatDate: (fecha, zona, formato) => {
          if (formato === 'dd/MM/yyyy') return '23/07/2026';
          return formato === 'yyyyMMdd-HHmm' ? '20260723-1815' : '20260723_181500';
        },
      },
      console: { warn: () => {} },
    },
  };
}

function cargarGs(globales) {
  const fuente = ARCHIVOS_GS.map((a) => fs.readFileSync(path.join(RAIZ, a), 'utf8')).join('\n');
  const nombres = Object.keys(globales);
  return new Function(...nombres, `${fuente}\nreturn { generarInforme, generarInforme2 };`)(...nombres.map((n) => globales[n]));
}

/**
 * La misma planilla, con sus cinco hojas, pero sin ninguna respuesta cargada.
 *
 * ANTES ESTO SALÍA DE UN ARCHIVO: `Planilla de Preguntas (1).xlsx`, una copia en
 * blanco que se quitó del repositorio en «Quitar la copia duplicada de la
 * planilla de preguntas». El test siguió pasando meses porque `celdas-python.json`
 * es un volcado local que nadie regeneró; en cuanto se regenera, la planilla no
 * está y el test se cae de entrada, antes de la primera verificación. Derivarla
 * de la completa no depende de ningún archivo y dice en el código qué se prueba.
 *
 * Se conserva la primera columna —el enunciado, que es de donde sale el número de
 * ítem— y se vacía todo lo demás. Se vacían TODAS las otras columnas y no la de
 * respuesta de cada hoja porque la columna cambia según el instrumento (NEO la 2,
 * CELID-A la 4, las otras tres la 3): copiar ese mapa acá lo dejaría desactualizado
 * el día que cambie en `Lectura.gs`. Conservando los ítems, el motor falla con
 * "faltan los ítems…", que es el caso que interesa, y no con "hoja vacía".
 */
function sinRespuestas(grillas) {
  const vacias = {};
  for (const hoja of Object.keys(grillas)) {
    vacias[hoja] = grillas[hoja].map((fila) => fila.map((v, i) => (i === 0 ? v : '')));
  }
  return vacias;
}

function correr(grillas, escenario) {
  const e = escenario || {};
  const entorno = crearEntorno(grillas, escenario);
  const { generarInforme } = cargarGs(entorno.globales);
  let resultado = null;
  let error = null;
  try {
    resultado = generarInforme(Object.assign(
      { planillaId: 'planilla-id', nombreEvaluado: 'Ana Pérez' }, e.pedido || {}
    ));
  } catch (ex) {
    error = ex;
  }
  return { ...entorno, resultado, error };
}

/**
 * Lo mismo para el otro modelo de informe.
 *
 * Corre contra el MISMO Drive simulado: los dos flujos crean, exportan,
 * renombran y registran igual, y lo que este verificador mira es justamente eso.
 * La gerencia y el sector van en el pedido por defecto porque el Informe 2 los
 * exige; los escenarios que prueban que falten los pisan con vacío.
 */
function correr2(grillas, escenario) {
  const e = escenario || {};
  const entorno = crearEntorno(grillas, escenario);
  const { generarInforme2 } = cargarGs(entorno.globales);
  let resultado = null;
  let error = null;
  try {
    resultado = generarInforme2(Object.assign(
      {
        planillaId: 'planilla-id',
        nombreEvaluado: 'Ana Pérez',
        gerencia: 'Tecnología',
        sector: 'Infraestructura',
      }, e.pedido || {}
    ));
  } catch (ex) {
    error = ex;
  }
  return { ...entorno, resultado, error };
}

function main() {
  if (!fs.existsSync(CELDAS)) {
    console.error('Falta celdas-python.json. Correr primero: python3 dump-celdas.py');
    return 1;
  }
  const volcados = JSON.parse(fs.readFileSync(CELDAS, 'utf8'));
  const volcadoCompleto = volcados.find((v) => v.planilla.includes('Chavo.xlsx'));
  if (!volcadoCompleto) {
    console.error('celdas-python.json no trae la planilla de referencia. '
      + 'Regenerarlo: python3 dump-celdas.py');
    return 1;
  }
  const completa = volcadoCompleto.grillas;
  const enBlanco = sinRespuestas(completa);

  const revisiones = [];
  const revisar = (nombre, ok, detalle) => revisiones.push([nombre, ok, detalle]);

  // ── Camino feliz ──
  const feliz = correr(completa);
  revisar('genera el informe sin errores', !feliz.error, feliz.error && feliz.error.message);
  revisar('devuelve el .docx con su nombre y su URL',
    !!feliz.resultado && feliz.resultado.nombreArchivo === 'A01-INFORME Ana Pérez 20260723-1815.docx'
    && feliz.resultado.informeUrl.indexOf('drive.google.com') >= 0,
    feliz.resultado && JSON.stringify(feliz.resultado));
  revisar('deja el archivo en la carpeta configurada',
    feliz.registro.archivosEnCarpeta.length === 1
    && feliz.registro.archivosEnCarpeta[0].carpeta === CARPETA_INFORMES);
  revisar('convierte la planilla .xlsx a Sheet', feliz.registro.convertidos === 1);
  revisar('exporta el Doc a .docx',
    feliz.registro.exportados.length === 1 && feliz.registro.exportados[0].indexOf('exportFormat=docx') > 0);
  revisar('no deja nada en Drive: copia convertida, Doc intermedio y planilla del radar',
    ['copia-convertida', 'doc-temporal', 'libro-temporal-radar']
      .every((id) => feliz.registro.trashed.indexOf(id) >= 0),
    feliz.registro.trashed.join(', '));
  const primerBloque = feliz.registro.cuerpo.bloques[0];
  revisar('el informe arranca en el título, sin párrafo en blanco arriba',
    !!primerBloque.tramos && primerBloque.tramos.length > 0
    && primerBloque.tramos[0].texto === 'INFORME: ',
    JSON.stringify(primerBloque).slice(0, 80));
  // La hoja arranca vacía, así que el código escribe primero el encabezado.
  revisar('crea el encabezado del historial y registra la corrida',
    feliz.registro.historial.length === 2
    && feliz.registro.historial[0][0] === 'Fecha',
    JSON.stringify(feliz.registro.historial));
  const fila = feliz.registro.historial[1] || [];
  revisar('el historial guarda evaluado, planilla, informe y usuario',
    fila[1] === 'Ana Pérez' && fila[2] === 'A01-PLANILLA Ana Pérez.xlsx'
    && String(fila[3]).indexOf('drive.google.com') >= 0 && fila[4] === USUARIO,
    JSON.stringify(fila));
  revisar('deja la calificación vacía para quien revise', fila[6] === '' && fila[7] === '');

  // ── Con perfil de puesto: el punto 6 ──
  // La lectura del puesto ya viene hecha (se hace al subir el archivo), así que
  // acá se le pasa como la manda el navegador. Sin clave de LLM configurada, la
  // prosa del punto 6 sale determinista y los números salen igual: es justo lo que
  // tiene que poder verificarse.
  const conPuesto = correr(completa, { pedido: { puesto: {
    id: 'perfil-id',
    nombre: 'Perfil Scrum Master.pdf',
    puesto: 'Scrum Master',
    exigencias: [
      { dimension: 'Carisma / Influencia Idealizada', nivelRequerido: 'Alto', critica: true, cita: 'Guiar y motivar' },
      { dimension: 'Liderazgo Directivo', nivelRequerido: 'Alto', critica: true, cita: 'Establecer metas claras' },
      { dimension: 'Laissez-Faire', nivelRequerido: 'Bajo', critica: false, cita: 'Eliminar obstáculos' },
    ],
    descartadas: [],
    noMedidos: [{ requisito: 'Título universitario', cita: 'Título universitario' }],
  } } });

  revisar('con perfil de puesto, el informe se genera igual', !conPuesto.error,
    conPuesto.error && conPuesto.error.message);
  revisar('y lo declara con su índice de adecuación',
    !!conPuesto.resultado && conPuesto.resultado.conPuesto === true
    && typeof conPuesto.resultado.adecuacion === 'number'
    && conPuesto.resultado.adecuacion >= 0 && conPuesto.resultado.adecuacion <= 100,
    conPuesto.resultado && JSON.stringify(conPuesto.resultado.adecuacion));
  const textoDelInforme = conPuesto.registro.cuerpo.bloques
    .map((b) => (b.tramos || []).map((t) => t.texto).join(''))
    .join('\n');
  revisar('el documento trae el punto 6',
    textoDelInforme.indexOf('6. Contraste con el Perfil de Puesto') >= 0);
  revisar('con el índice, las alertas y el plan de desarrollo',
    textoDelInforme.indexOf('Índice de adecuación: ') >= 0
    && textoDelInforme.indexOf('6.2 Alertas sobre el índice') >= 0
    && textoDelInforme.indexOf('6.5 Plan Personalizado de Desarrollo') >= 0);
  // Los dos pies de autoría —punto 5 y punto 6— tienen que leerse como la misma
  // clase de nota. Cuando el del punto 6 tenía cuatro oraciones y el del 5 una, la
  // diferencia de largo se leía como si algo hubiera salido mal en el punto 6.
  const pies = textoDelInforme.split('\n')
    .filter((l) => / - Requiere revisión profesional antes de la devolución\.$/.test(l));
  revisar('los dos pies de autoría tienen la misma forma', pies.length === 2,
    pies.join(' || '));
  // El porcentaje es lo que más se lee del punto 6. Que la aclaración esté en la
  // MISMA línea es el punto: en el pie de la sección llegaba tarde.
  revisar('la aclaración de quién calcula el índice va pegada al porcentaje',
    /Índice de adecuación: \d+ %\s+lo calcula el sistema, no la IA/.test(textoDelInforme),
    (textoDelInforme.split('\n').find((l) => l.indexOf('Índice de adecuación') >= 0) || ''));
  revisar('el del punto 6 habla de la prosa y el del punto 5 de la síntesis',
    pies.length === 2 && /^Síntesis /.test(pies[0]) && /^Prosa /.test(pies[1]),
    pies.join(' || '));
  revisar('los tres archivos de la evaluación quedan con el mismo código',
    conPuesto.registro.renombrados.length === 2
    && conPuesto.registro.renombrados.some((r) => r.nombre === 'A01-PLANILLA Ana Pérez.xlsx')
    && conPuesto.registro.renombrados.some((r) => r.nombre === 'A01-PERFIL Scrum Master.pdf'),
    JSON.stringify(conPuesto.registro.renombrados));
  const filaPuesto = conPuesto.registro.historial.filter((f) => f[0] !== 'Fecha')[0] || [];
  revisar('y el historial guarda el código y el perfil de puesto usado',
    filaPuesto[8] === 'A01' && filaPuesto[9] === 'A01-PERFIL Scrum Master.pdf',
    JSON.stringify(filaPuesto));

  // Sin perfil de puesto no hay punto 6: no queda una sección vacía ni un "no aplica".
  const textoSinPuesto = feliz.registro.cuerpo.bloques
    .map((b) => (b.tramos || []).map((t) => t.texto).join(''))
    .join('\n');
  revisar('sin perfil de puesto el informe termina en el punto 5',
    textoSinPuesto.indexOf('6. Contraste con el Perfil de Puesto') === -1
    && feliz.resultado.conPuesto === false);

  // Una lectura del puesto que no trae nada usable no rompe: sale sin punto 6.
  const puestoVacio = correr(completa, { pedido: { puesto: { id: 'perfil-id', exigencias: [] } } });
  revisar('un perfil de puesto sin exigencias utilizables no rompe el informe',
    !puestoVacio.error && puestoVacio.resultado.conPuesto === false,
    puestoVacio.error && puestoVacio.error.message);

  // ── Entrada que ya es un Google Sheet ──
  const yaSheet = correr(completa, { entradaEsSheet: true });
  revisar('si la entrada ya es un Sheet, no la copia', !yaSheet.error && yaSheet.registro.convertidos === 0);
  revisar('y no hay copia convertida que descartar',
    yaSheet.registro.trashed.indexOf('copia-convertida') === -1
    && yaSheet.registro.trashed.indexOf('doc-temporal') >= 0,
    yaSheet.registro.trashed.join(', '));

  // ── Planilla incompleta ──
  const incompleta = correr(enBlanco);
  revisar('rechaza la planilla en blanco', !!incompleta.error);
  revisar('y explica qué le falta',
    !!incompleta.error && incompleta.error.message.indexOf('incompleta') >= 0,
    incompleta.error && incompleta.error.message.slice(0, 70));
  revisar('sin dejar archivos en la carpeta de informes', incompleta.registro.archivosEnCarpeta.length === 0);
  revisar('sin registrar la corrida', incompleta.registro.historial.length === 0);
  revisar('y sin gastar un código: la planilla ni siquiera se pudo corregir',
    Object.keys(incompleta.registro.propiedadesEscritas).length === 0);
  revisar('y descartando lo que había creado',
    incompleta.registro.trashed.indexOf('copia-convertida') >= 0);

  // ── Usuario sin acceso ──
  const sinAcceso = correr(completa, { usuarioSinAcceso: true });
  revisar('rechaza al usuario que no está en el grupo', !!sinAcceso.error);
  revisar('y le dice a qué grupo pedir acceso',
    !!sinAcceso.error && sinAcceso.error.message.indexOf(GRUPO) > 0);
  revisar('sin haber tocado Drive', sinAcceso.registro.creados.length === 0 && sinAcceso.registro.convertidos === 0);

  const grupoRoto = correr(completa, { grupoInexistente: true });
  revisar('si el grupo no se puede consultar, niega el acceso',
    !!grupoRoto.error && grupoRoto.registro.archivosEnCarpeta.length === 0);

  // ── Falta configuración ──
  const sinConfig = correr(completa, { sinConfigurar: true });
  revisar('avisa si el proyecto no está configurado', !!sinConfig.error);
  revisar('y nombra las propiedades que faltan',
    !!sinConfig.error && sinConfig.error.message.indexOf('CARPETA_INFORMES_ID') > 0
    && sinConfig.error.message.indexOf('GRUPO_AUTORIZADO') > 0);

  // ── Falla la exportación ──
  const exportRoto = correr(completa, { exportacionFalla: true });
  revisar('si falla la exportación, corta con el código de error',
    !!exportRoto.error && exportRoto.error.message.indexOf('500') > 0,
    exportRoto.error && exportRoto.error.message);
  // El código YA se reservó cuando falla la exportación: se pide antes de componer
  // el documento porque el nombre del archivo lo lleva. Ese número queda salteado,
  // que es la decisión tomada en `reservarCodigo`: un hueco es inofensivo, un
  // código repetido en dos informes archivados no se arregla nunca.
  revisar('sin registrar la corrida',
    exportRoto.registro.historial.filter((f) => f[0] !== 'Fecha').length === 0,
    JSON.stringify(exportRoto.registro.historial));
  revisar('el código reservado queda salteado, no se devuelve al contador',
    exportRoto.registro.propiedadesEscritas.ULTIMO_CODIGO === '1');
  revisar('y no se renombra ningún insumo: el informe no llegó a existir',
    exportRoto.registro.renombrados.length === 0);
  revisar('y descartando igual los temporales',
    exportRoto.registro.trashed.indexOf('doc-temporal') >= 0
    && exportRoto.registro.trashed.indexOf('copia-convertida') >= 0);

  // ── El otro modelo de informe ──
  // Comparte el Drive, el historial y el código de evaluación con el primero, y
  // no comparte nada más: otro documento, otra redacción y dos campos más.
  const dos = correr2(completa);
  revisar('el Informe 2 se genera sin errores', !dos.error, dos.error && dos.error.message);
  revisar('y su archivo se distingue del otro modelo por el nombre',
    !!dos.resultado && dos.resultado.nombreArchivo === 'A01-INFORME2 Ana Pérez 20260723-1815.docx',
    dos.resultado && dos.resultado.nombreArchivo);
  const textoDos = dos.registro.cuerpo.bloques
    .map((b) => (b.tipo === 'tabla'
      ? b.filas.map((f) => f.map((c) => c.texto).join(' ')).join(' ')
      : (b.tramos || []).map((t) => t.texto).join('')))
    .join('\n');
  revisar('el documento es el del modelo 2, no el del 1',
    textoDos.indexOf('Informe de Perfil de Liderazgo e Integración Organizacional') >= 0
    && textoDos.indexOf('1. DATOS CUANTITATIVOS.') === -1);
  revisar('con la gerencia y el sector en el encabezado',
    textoDos.indexOf('Gerencia: Tecnología') >= 0
    && textoDos.indexOf('Sector: Infraestructura') >= 0);
  // Sin clave del LLM configurada, la redacción sale por reglas. El informe se
  // genera igual y lo declara: es la misma regla del punto 5 del otro modelo.
  revisar('sin modelo disponible, el informe sale igual con el texto determinista',
    dos.resultado.sintesisAsistida === false
    && textoDos.indexOf('Informe generado con el texto determinista del sistema') >= 0);
  revisar('el Informe 2 no arma el gráfico de radar: su modelo no lo lleva',
    dos.registro.creados.every((c) => c.tipo !== 'planilla-radar'),
    JSON.stringify(dos.registro.creados));
  const filaDos = dos.registro.historial.filter((f) => f[0] !== 'Fecha')[0] || [];
  revisar('el historial anota con qué modelo se generó, y la gerencia y el sector',
    filaDos[10] === 'Informe 2' && filaDos[11] === 'Tecnología' && filaDos[12] === 'Infraestructura',
    JSON.stringify(filaDos));
  revisar('y sigue anotando el código, que es el mismo contador de los dos modelos',
    filaDos[8] === 'A01');
  revisar('los temporales se descartan igual que en el otro flujo',
    dos.registro.trashed.indexOf('doc-temporal') >= 0
    && dos.registro.trashed.indexOf('copia-convertida') >= 0,
    dos.registro.trashed.join(', '));
  revisar('y la planilla queda renombrada con el código de la evaluación',
    dos.registro.renombrados.some((r) => r.nombre === 'A01-PLANILLA Ana Pérez.xlsx'),
    JSON.stringify(dos.registro.renombrados));

  // Los dos campos nuevos son obligatorios, y se rechazan ANTES de tocar Drive:
  // una corrida que va a fallar no tiene por qué gastar un código ni dejar
  // archivos dando vueltas.
  [['gerencia', { gerencia: '' }], ['sector', { sector: '  ' }]].forEach(([campo, pedido]) => {
    const falta = correr2(completa, { pedido: pedido });
    revisar(`el Informe 2 no se genera sin ${campo}`,
      !!falta.error && falta.error.message.toLowerCase().indexOf(campo) >= 0,
      falta.error && falta.error.message);
    revisar(`y al faltar ${campo} no toca Drive ni gasta un código`,
      falta.registro.creados.length === 0
      && Object.keys(falta.registro.propiedadesEscritas).length === 0);
  });

  const dosConPuesto = correr2(completa, { pedido: { puesto: {
    id: 'perfil-id',
    nombre: 'Perfil Scrum Master.pdf',
    puesto: 'Scrum Master',
    exigencias: [
      { dimension: 'Liderazgo Participativo', nivelRequerido: 'Alto', critica: true, cita: 'facilita' },
      { dimension: 'Conductas Orientadas a la Tarea', nivelRequerido: 'Alto', critica: true, cita: 'sigue' },
    ],
    descartadas: [],
    noMedidos: [{ requisito: 'Título universitario', cita: 'Título universitario' }],
  } } });
  const textoDosConPuesto = dosConPuesto.registro.cuerpo.bloques
    .map((b) => (b.tipo === 'tabla'
      ? b.filas.map((f) => f.map((c) => c.texto).join(' ')).join(' ')
      : (b.tramos || []).map((t) => t.texto).join('')))
    .join('\n');
  revisar('con perfil de puesto, el Informe 2 trae el índice de adecuación',
    !dosConPuesto.error && dosConPuesto.resultado.conPuesto === true
    && textoDosConPuesto.indexOf('Índice de Adecuación al Puesto: '
      + dosConPuesto.resultado.adecuacion + ' %') >= 0,
    dosConPuesto.error && dosConPuesto.error.message);
  revisar('y los tres archivos de la evaluación quedan con el mismo código',
    dosConPuesto.registro.renombrados.length === 2
    && dosConPuesto.registro.renombrados.some((r) => r.nombre === 'A01-PERFIL Scrum Master.pdf'),
    JSON.stringify(dosConPuesto.registro.renombrados));
  revisar('sin perfil de puesto, el Informe 2 dice que no hay índice en vez de imprimir un cero',
    textoDos.indexOf('Índice de Adecuación al Puesto: no calculado') >= 0);

  let fallados = 0;
  for (const [nombre, ok, detalle] of revisiones) {
    console.log(`  ${ok ? '✓' : '✗'} ${nombre}`);
    if (!ok) {
      fallados++;
      if (detalle) console.log(`      ${detalle}`);
    }
  }
  console.log(fallados ? `\n${fallados} de ${revisiones.length} verificaciones fallaron` : `\nOrquestador verificado (${revisiones.length} verificaciones)`);
  return fallados ? 1 : 0;
}

process.exit(main());
