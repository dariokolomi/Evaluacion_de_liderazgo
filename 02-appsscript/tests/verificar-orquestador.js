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
  'Correccion.gs', 'Lectura.gs', 'Textos.gs', 'Documento.gs',
  'Radar.gs', 'Configuracion.gs', 'Acceso.gs', 'Historial.gs', 'Informe.gs',
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
    appendRow: (fila) => { registro.historial.push(fila); },
    setFrozenRows: () => {},
    getRange: () => ({ setValues: () => {} }),
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
      getName: () => 'Planilla de Preguntas - Chavo.xlsx',
      setTrashed: () => { registro.trashed.push(id); },
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
      PropertiesService: { getScriptProperties: () => ({ getProperties: () => propiedades }) },
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
        formatDate: (fecha, zona, formato) => (formato === 'dd/MM/yyyy' ? '23/07/2026' : '20260723_181500'),
      },
      console: { warn: () => {} },
    },
  };
}

function cargarGs(globales) {
  const fuente = ARCHIVOS_GS.map((a) => fs.readFileSync(path.join(RAIZ, a), 'utf8')).join('\n');
  const nombres = Object.keys(globales);
  return new Function(...nombres, `${fuente}\nreturn { generarInforme };`)(...nombres.map((n) => globales[n]));
}

function correr(grillas, escenario) {
  const entorno = crearEntorno(grillas, escenario);
  const { generarInforme } = cargarGs(entorno.globales);
  let resultado = null;
  let error = null;
  try {
    resultado = generarInforme({ planillaId: 'planilla-id', nombreEvaluado: 'Ana Pérez' });
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
  const completa = volcados.find((v) => v.planilla.includes('Chavo.xlsx')).grillas;
  const enBlanco = volcados.find((v) => v.planilla.includes('(1)')).grillas;

  const revisiones = [];
  const revisar = (nombre, ok, detalle) => revisiones.push([nombre, ok, detalle]);

  // ── Camino feliz ──
  const feliz = correr(completa);
  revisar('genera el informe sin errores', !feliz.error, feliz.error && feliz.error.message);
  revisar('devuelve el .docx con su nombre y su URL',
    !!feliz.resultado && feliz.resultado.nombreArchivo === 'INFORME_Ana Pérez_20260723_181500.docx'
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
    fila[1] === 'Ana Pérez' && fila[2] === 'Planilla de Preguntas - Chavo.xlsx'
    && String(fila[3]).indexOf('drive.google.com') >= 0 && fila[4] === USUARIO,
    JSON.stringify(fila));
  revisar('deja la calificación vacía para quien revise', fila[6] === '' && fila[7] === '');

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
  revisar('sin registrar la corrida', exportRoto.registro.historial.length === 0);
  revisar('y descartando igual los temporales',
    exportRoto.registro.trashed.indexOf('doc-temporal') >= 0
    && exportRoto.registro.trashed.indexOf('copia-convertida') >= 0);

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
