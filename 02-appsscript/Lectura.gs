/**
 * Lectura de la planilla de respuestas — port de run_engine.py:21-178
 * (el equivalente de openpyxl, del lado de Google Sheets).
 *
 * Separado en dos capas a propósito:
 *   - extraerRespuestas(grillas)  → pura, opera sobre matrices de celdas.
 *   - leerPlanilla(spreadsheet)   → adaptador mínimo contra SpreadsheetApp.
 * La capa pura es la que concentra la lógica y se verifica contra Python
 * sin Apps Script de por medio (ver tests/verificar-lectura.js).
 */

/**
 * Dónde vive cada instrumento dentro del libro.
 * filaInicial y las columnas son 1-based, como se ven en la planilla.
 */
var DISPOSICION = {
  neo:      { hoja: 'NEO',       filaInicial: 6, colItem: 1, colRespuesta: 2, items: 60, tipo: 'letra' },
  celid:    { hoja: 'CELID-A',   filaInicial: 4, colItem: 1, colRespuesta: 4, items: 34, tipo: 'numero' },
  potenlid: { hoja: 'POTENLID',  filaInicial: 3, colItem: 1, colRespuesta: 3, items: 9,  tipo: 'numero' },
  camin:    { hoja: 'CAMIN-A',   filaInicial: 3, colItem: 1, colRespuesta: 3, items: 12, tipo: 'numero' },
  conlid:   { hoja: 'CONLID-A',  filaInicial: 3, colItem: 1, colRespuesta: 3, items: 18, tipo: 'numero' }
};

var INSTRUMENTOS = ['neo', 'celid', 'potenlid', 'camin', 'conlid'];

function esVacia(valor) {
  // openpyxl entrega None; Sheets entrega '' — acá los dos son "sin respuesta".
  return valor === null || valor === undefined || valor === '';
}

/**
 * Número de ítem de una fila.
 * En NEO viene dentro del texto del ítem ("12. Me siento..."); en el resto es
 * el número solo. Devuelve null si la fila no corresponde a un ítem.
 */
function numeroDeItem(valor, tipo) {
  if (esVacia(valor)) return null;
  if (tipo === 'letra') {
    var m = /^(\d+)\./.exec(String(valor).trim());
    return m ? Number(m[1]) : null;
  }
  if (typeof valor !== 'number' || valor !== Math.floor(valor)) return null;
  return valor;
}

/**
 * La respuesta cruda tal como la interpreta el motor Python, con una salvedad:
 * en NEO sólo se aceptan las letras A–E. Cualquier otra cosa cuenta como ítem
 * sin responder, porque un valor fuera de la escala no produciría un puntaje
 * distinto sino un puntaje sin sentido.
 */
function valorDeRespuesta(valor, tipo) {
  if (esVacia(valor)) return null;
  if (tipo === 'letra') {
    var letra = String(valor).trim().charAt(0).toUpperCase();
    return 'ABCDE'.indexOf(letra) >= 0 ? letra : null;
  }
  return typeof valor === 'number' ? valor : null;
}

/**
 * @param {Object} grillas mapa clave de instrumento → matriz de celdas de su
 *   hoja, fila 1 en el índice 0.
 * @return {Object} mapa clave → { ítem: respuesta }
 */
function extraerRespuestas(grillas) {
  var respuestas = {};
  for (var i = 0; i < INSTRUMENTOS.length; i++) {
    var clave = INSTRUMENTOS[i];
    var d = DISPOSICION[clave];
    var filas = grillas[clave] || [];
    var delInstrumento = {};

    for (var f = d.filaInicial - 1; f < filas.length; f++) {
      var fila = filas[f] || [];
      var item = numeroDeItem(fila[d.colItem - 1], d.tipo);
      if (item === null) continue;
      var respuesta = valorDeRespuesta(fila[d.colRespuesta - 1], d.tipo);
      if (respuesta === null) continue;
      delInstrumento[item] = respuesta;
    }
    respuestas[clave] = delInstrumento;
  }
  return respuestas;
}

/**
 * Ítems que faltan para poder corregir, por instrumento.
 * El motor Python no valida nada y explota con un KeyError opaco cuando la
 * planilla está incompleta (le pasa, por ejemplo, con el formulario en blanco).
 * Acá el problema se nombra antes de llegar a la corrección.
 */
function itemsFaltantes(respuestas) {
  var faltantes = {};
  for (var i = 0; i < INSTRUMENTOS.length; i++) {
    var clave = INSTRUMENTOS[i];
    var delInstrumento = respuestas[clave] || {};
    var sinResponder = [];
    for (var item = 1; item <= DISPOSICION[clave].items; item++) {
      if (!Object.prototype.hasOwnProperty.call(delInstrumento, item)) sinResponder.push(item);
    }
    if (sinResponder.length) faltantes[clave] = sinResponder;
  }
  return faltantes;
}

function mensajeDeFaltantes(faltantes) {
  var partes = [];
  for (var clave in faltantes) {
    if (!Object.prototype.hasOwnProperty.call(faltantes, clave)) continue;
    var items = faltantes[clave];
    var hoja = DISPOSICION[clave].hoja;
    var total = DISPOSICION[clave].items;
    var detalle = items.length === total
      ? 'sin ninguna respuesta cargada'
      : 'faltan los ítems ' + items.join(', ');
    partes.push(hoja + ': ' + detalle);
  }
  return 'La planilla está incompleta. ' + partes.join(' · ');
}

/**
 * Lee un libro de Google Sheets y devuelve las respuestas de los 5 instrumentos.
 * @param {Spreadsheet} spreadsheet libro ya abierto (SpreadsheetApp.openById(...)).
 * @throws {Error} si falta una hoja o si la planilla está incompleta.
 */
function leerPlanilla(spreadsheet) {
  var grillas = {};
  for (var i = 0; i < INSTRUMENTOS.length; i++) {
    var clave = INSTRUMENTOS[i];
    var nombre = DISPOSICION[clave].hoja;
    var hoja = spreadsheet.getSheetByName(nombre);
    if (!hoja) {
      throw new Error('La planilla no tiene la hoja "' + nombre + '".');
    }
    grillas[clave] = hoja.getDataRange().getValues();
  }

  var respuestas = extraerRespuestas(grillas);
  var faltantes = itemsFaltantes(respuestas);
  for (var clave2 in faltantes) {
    if (Object.prototype.hasOwnProperty.call(faltantes, clave2)) {
      throw new Error(mensajeDeFaltantes(faltantes));
    }
  }
  return respuestas;
}
