/**
 * Corrección de los 5 instrumentos — port 1:1 de run_engine.py:16-193.
 *
 * Claves y baremos son datos psicométricos validados: se copian literalmente
 * del motor Python. No se reinterpretan, no se "mejoran", no se redondean.
 * Cualquier cambio acá invalida los informes ya emitidos.
 *
 * Este archivo es puro: no toca SpreadsheetApp, DriveApp ni DocumentApp.
 * Recibe las respuestas ya leídas y devuelve los resultados. Eso lo hace
 * verificable contra Python sin Apps Script de por medio
 * (ver tests/verificar-port.js).
 */

// ═══════════════════════════════════════════════════════════════════
// NEO-FFI — 60 ítems, 5 factores, puntaje directo → T-score
// ═══════════════════════════════════════════════════════════════════

var NEO_LETRA = { A: 0, B: 1, C: 2, D: 3, E: 4 };

var NEO_CLAVE = {
  N: [['+',1],['-',6],['+',11],['+',16],['+',21],['+',26],['+',31],['+',36],['-',41],['-',46],['+',51],['-',56]],
  E: [['+',2],['+',7],['+',12],['-',17],['+',22],['-',27],['+',32],['-',37],['-',42],['+',47],['+',52],['-',57]],
  O: [['+',3],['-',8],['+',13],['+',18],['-',23],['+',28],['+',33],['-',38],['-',43],['+',48],['+',53],['-',58]],
  A: [['+',4],['-',9],['-',14],['-',19],['+',24],['+',29],['-',34],['+',39],['+',44],['+',49],['-',54],['-',59]],
  C: [['-',5],['+',10],['+',15],['+',20],['+',25],['+',30],['+',35],['+',40],['+',45],['-',50],['-',55],['-',60]]
};

var NEO_BAREMO = {
  N: {0:25,1:30,2:32,3:34,4:35,5:36,6:38,7:39,8:41,9:42,10:44,11:46,12:47,13:49,14:50,15:51,16:53,17:54,18:55,19:56,20:58,21:59,22:60,23:61,24:62,25:63,26:64,27:65,28:66,29:67,30:68,31:69,32:70,33:71,34:72,35:73,36:75,37:75,38:75,39:75,40:75,41:75,42:75,43:75,44:75,45:75,46:75,47:75,48:75},
  E: {13:25,14:25,15:26,16:27,17:29,18:30,19:31,20:32,21:33,22:35,23:37,24:38,25:39,26:41,27:42,28:44,29:45,30:47,31:48,32:50,33:51,34:53,35:54,36:56,37:55,38:56,39:61,40:63,41:64,42:66,43:68,44:70,45:72,46:75,47:75,48:75},
  O: {11:25,12:28,13:29,14:30,15:31,16:33,17:34,18:36,19:37,20:38,21:39,22:41,23:42,24:44,25:45,26:47,27:48,28:50,29:51,30:53,31:54,32:56,33:57,34:59,35:61,36:62,37:64,38:65,39:67,40:69,41:71,42:72,43:73,44:75},
  A: {16:25,17:26,18:27,19:29,20:30,21:32,22:33,23:36,24:37,25:38,26:39,27:40,28:42,29:44,30:46,31:48,32:50,33:53,34:55,35:58,36:57,37:59,38:61,39:62,40:64,41:65,42:67,43:68,44:70,45:72,46:74,47:75,48:75},
  C: {16:25,17:26,18:26,19:27,20:28,21:29,22:30,23:32,24:33,25:34,26:35,27:37,28:38,29:39,30:40,31:42,32:44,33:46,34:47,35:50,36:51,37:53,38:54,39:56,40:57,41:59,42:61,43:62,44:65,45:67,46:69,47:72,48:75}
};

var NEO_DIMENSIONES = ['N', 'E', 'O', 'A', 'C'];

/**
 * @param {Object} respuestas mapa ítem (1-60) → letra 'A'..'E'
 * @param {string} dim una de N, E, O, A, C
 * @return {number} puntaje directo
 */
function puntajeNeo(respuestas, dim) {
  var total = 0;
  var clave = NEO_CLAVE[dim];
  for (var i = 0; i < clave.length; i++) {
    var signo = clave[i][0];
    var item = clave[i][1];
    var val = NEO_LETRA[respuestas[item]];
    if (signo === '-') val = 4 - val;
    total += val;
  }
  return total;
}

function nivelPorT(t) {
  if (t >= 66) return 'Muy Alto';
  if (t >= 56) return 'Alto';
  if (t >= 45) return 'Promedio';
  if (t >= 35) return 'Bajo';
  return 'Muy Bajo';
}

// ═══════════════════════════════════════════════════════════════════
// Percentiles — común a CELID-A, POTENLID, CAMIN-A y CONLID-A
// ═══════════════════════════════════════════════════════════════════

/**
 * Devuelve el percentil de la primera fila cuyo corte el valor alcanza.
 * Las tablas están ordenadas de mayor a menor percentil; si el valor no
 * llega al corte más bajo, cae en P1 (mismo criterio que Python).
 */
function percentil(valor, tabla) {
  for (var i = 0; i < tabla.length; i++) {
    if (valor >= tabla[i][1]) return tabla[i][0];
  }
  return 1;
}

/**
 * Alto por encima de P75; Bajo hasta P25 inclusive; Medio, la banda del medio.
 *
 * Los dos cortes los fijó el PO el 2026-07-27, en dos respuestas:
 *   - "medio = > P25 y bajo <= P25"
 *   - "> P75 fortaleza consolidada", "> P25 y <= P75 es Brecha"
 *
 * Las dos describen las mismas bandas: arrancan las dos en > P25. Por eso el
 * nivel quedó alineado con el punto 5 y el corte de Alto pasó de >= 75 a > 75:
 *
 *     Bajo   = Alto? no        <= P25
 *     Medio  ≡ Brecha          > P25 y <= P75
 *     Alto   ≡ Fortaleza       > P75
 *
 * Sin alinearlo, una dimensión en P75 salía rotulada "Alto" en la tabla de la
 * sección 1 y listada como área de desarrollo en el punto 5, en el mismo informe
 * —le pasaba al Liderazgo Directivo de Quico—. Es exactamente la contradicción entre
 * secciones que describe HU2, así que no se podía dejar.
 *
 * Esta función es la única fuente del rótulo —las tablas de las secciones 1 a 4,
 * el reparto de subescalas del 2.2 y la síntesis leen todas de acá—, así que
 * mover el corte no puede dejar dos secciones diciendo cosas distintas del mismo
 * valor. Los cortes del punto 5 viven en `Perfil.gs` (`esFortalezaConsolidada`,
 * `esBrecha`) y ahora coinciden con éstos.
 */
function nivelPorPercentil(p) {
  if (p > 75) return 'Alto';
  if (p > 25) return 'Medio';
  return 'Bajo';
}

// ═══════════════════════════════════════════════════════════════════
// CELID-A — estilos de liderazgo, media por dimensión
// ═══════════════════════════════════════════════════════════════════

var CELID_ITEMS = {
  Carisma:  [3, 21, 33, 34],
  EstimInt: [4, 15, 23, 25, 28, 29, 30],
  Inspir:   [19, 22, 24],
  ConsInd:  [13, 14, 17],
  RecCont:  [8, 10, 11, 12, 16],
  DirExc:   [2, 5, 7, 9, 18, 26],
  Laissez:  [1, 6, 20, 27, 31, 32]
};

// Los totales promedian sobre todos los ítems de las subescalas, no sobre las medias.
var CELID_TRANSFORMACIONAL = [3, 21, 33, 34, 4, 15, 23, 25, 28, 29, 30, 19, 22, 24, 13, 14, 17];
var CELID_TRANSACCIONAL = [8, 10, 11, 12, 16, 2, 5, 7, 9, 18, 26];

var CELID_BAREMO = {
  Carisma:  [[99,5.00],[95,4.75],[90,4.75],[75,4.25],[50,4.00],[25,3.75],[10,3.23],[5,3.00]],
  EstimInt: [[99,5.00],[95,4.86],[90,4.71],[75,4.43],[50,4.00],[25,3.43],[10,3.14],[5,2.94]],
  Inspir:   [[99,5.00],[95,5.00],[90,4.67],[75,4.33],[50,3.67],[25,3.33],[10,3.00],[5,2.67]],
  ConsInd:  [[99,5.00],[95,5.00],[90,5.00],[75,4.67],[50,4.00],[25,3.67],[10,3.33],[5,3.00]],
  TransfTot:[[99,4.94],[95,4.70],[90,4.48],[75,4.20],[50,3.96],[25,3.65],[10,3.28],[5,3.20]],
  RecCont:  [[99,4.80],[95,4.60],[90,4.40],[75,3.80],[50,3.40],[25,2.80],[10,2.40],[5,2.00]],
  DirExc:   [[99,4.83],[95,4.50],[90,4.30],[75,3.83],[50,3.33],[25,3.00],[10,2.50],[5,2.33]],
  TransTot: [[99,4.38],[95,4.25],[90,4.07],[75,3.72],[50,3.33],[25,3.00],[10,2.66],[5,2.34]],
  Laissez:  [[99,4.20],[95,3.83],[90,3.33],[75,2.83],[50,2.33],[25,1.83],[10,1.67],[5,1.33]]
};

function mediaDeItems(respuestas, items) {
  var total = 0;
  for (var i = 0; i < items.length; i++) total += respuestas[items[i]];
  return total / items.length;
}

function sumaDeItems(respuestas, items) {
  var total = 0;
  for (var i = 0; i < items.length; i++) total += respuestas[items[i]];
  return total;
}

// ═══════════════════════════════════════════════════════════════════
// POTENLID / CAMIN-A / CONLID-A — suma por dimensión
// ═══════════════════════════════════════════════════════════════════

var POTENLID_ITEMS = { Intr: [1, 6, 8], Extr: [2, 4, 7], Soc: [3, 5, 9] };

var POTENLID_BAREMO = {
  Intr: [[99,15],[95,15],[90,15],[75,13],[50,11],[25,9],[10,6],[5,5]],
  Extr: [[99,15],[95,13],[90,11],[75,9],[50,6],[25,3],[10,3],[5,3]],
  Soc:  [[99,15],[95,13],[90,12],[75,10],[50,8],[25,6],[10,5],[5,3]]
};

var CAMIN_ITEMS = {
  Dir:  [1, 5, 9],
  Cons: [2, 6, 10],
  Part: [3, 7, 11],
  Or:   [4, 8, 12]
};

var CAMIN_BAREMO = {
  Dir:  [[99,21],[95,21],[90,21],[75,19],[50,18],[25,15],[10,12],[5,11]],
  Cons: [[99,21],[95,21],[90,20],[75,19],[50,17],[25,15],[10,13],[5,12]],
  Part: [[99,21],[95,21],[90,20],[75,18],[50,16],[25,13],[10,10],[5,9]],
  Or:   [[99,21],[95,21],[90,19],[75,17],[50,15],[25,12],[10,10],[5,8]]
};

var CONLID_ITEMS = {
  Tar:  [2, 5, 8, 11, 14, 17],
  Rel:  [1, 4, 7, 10, 13, 16],
  Camb: [3, 6, 9, 12, 15, 18]
};

var CONLID_BAREMO = {
  Tar:  [[99,30],[95,30],[90,29],[75,27],[50,24],[25,22],[10,19],[5,17]],
  Rel:  [[99,30],[95,30],[90,29],[75,28],[50,26],[25,24],[10,21],[5,19]],
  Camb: [[99,30],[95,28],[90,26],[75,24],[50,21],[25,18],[10,16],[5,14]]
};

// ═══════════════════════════════════════════════════════════════════
// Mapa de competencias — insumo del gráfico radar
// ═══════════════════════════════════════════════════════════════════

var RADAR_ETIQUETAS = [
  'Carisma', 'Estim. Intelectual', 'Inspiración', 'Consid. Indiv.',
  'Laissez (inv.)', 'Rec. Contingente', 'Dir. por Excepción',
  'Lid. Directivo', 'Lid. Considerado', 'Lid. Participativo',
  'Lid. a Metas', 'Tarea', 'Relaciones', 'Cambio'
];

var RADAR_PERFIL_IDEAL = [90, 85, 90, 90, 85, 75, 70, 75, 80, 90, 85, 75, 85, 85];

// ═══════════════════════════════════════════════════════════════════
// Entrada única
// ═══════════════════════════════════════════════════════════════════

/**
 * Corrige los 5 instrumentos.
 *
 * @param {Object} respuestas {neo, celid, potenlid, camin, conlid}, cada uno
 *   un mapa ítem → respuesta (letra en NEO, entero en el resto).
 * @return {Object} resultados con puntajes, percentiles, niveles y el vector
 *   del radar, con los mismos nombres de campo que usa el motor Python.
 */
function corregir(respuestas) {
  // ── NEO-FFI ──
  var neoRaw = {}, neoT = {}, neoNivel = {};
  for (var i = 0; i < NEO_DIMENSIONES.length; i++) {
    var dim = NEO_DIMENSIONES[i];
    neoRaw[dim] = puntajeNeo(respuestas.neo, dim);
    var t = NEO_BAREMO[dim][neoRaw[dim]];
    neoT[dim] = (t === undefined) ? 50 : t;
    neoNivel[dim] = nivelPorT(neoT[dim]);
  }

  // ── CELID-A ──
  var celid = respuestas.celid;
  var celidValor = {
    Carisma:   mediaDeItems(celid, CELID_ITEMS.Carisma),
    EstimInt:  mediaDeItems(celid, CELID_ITEMS.EstimInt),
    Inspir:    mediaDeItems(celid, CELID_ITEMS.Inspir),
    ConsInd:   mediaDeItems(celid, CELID_ITEMS.ConsInd),
    TransfTot: sumaDeItems(celid, CELID_TRANSFORMACIONAL) / 17,
    RecCont:   mediaDeItems(celid, CELID_ITEMS.RecCont),
    DirExc:    mediaDeItems(celid, CELID_ITEMS.DirExc),
    TransTot:  sumaDeItems(celid, CELID_TRANSACCIONAL) / 11,
    Laissez:   mediaDeItems(celid, CELID_ITEMS.Laissez)
  };
  var celidPct = percentilesDe(celidValor, CELID_BAREMO);

  // ── POTENLID ──
  var potenValor = {
    Intr: sumaDeItems(respuestas.potenlid, POTENLID_ITEMS.Intr),
    Extr: sumaDeItems(respuestas.potenlid, POTENLID_ITEMS.Extr),
    Soc:  sumaDeItems(respuestas.potenlid, POTENLID_ITEMS.Soc)
  };
  var potenPct = percentilesDe(potenValor, POTENLID_BAREMO);

  // ── CAMIN-A ──
  var caminValor = {
    Dir:  sumaDeItems(respuestas.camin, CAMIN_ITEMS.Dir),
    Cons: sumaDeItems(respuestas.camin, CAMIN_ITEMS.Cons),
    Part: sumaDeItems(respuestas.camin, CAMIN_ITEMS.Part),
    Or:   sumaDeItems(respuestas.camin, CAMIN_ITEMS.Or)
  };
  var caminPct = percentilesDe(caminValor, CAMIN_BAREMO);

  // ── CONLID-A ──
  var conlidValor = {
    Tar:  sumaDeItems(respuestas.conlid, CONLID_ITEMS.Tar),
    Rel:  sumaDeItems(respuestas.conlid, CONLID_ITEMS.Rel),
    Camb: sumaDeItems(respuestas.conlid, CONLID_ITEMS.Camb)
  };
  var conlidPct = percentilesDe(conlidValor, CONLID_BAREMO);

  return {
    neo:      { raw: neoRaw, t: neoT, nivel: neoNivel },
    celid:    { valor: celidValor, percentil: celidPct, nivel: nivelesDe(celidPct) },
    potenlid: { valor: potenValor, percentil: potenPct, nivel: nivelesDe(potenPct) },
    camin:    { valor: caminValor, percentil: caminPct, nivel: nivelesDe(caminPct) },
    conlid:   { valor: conlidValor, percentil: conlidPct, nivel: nivelesDe(conlidPct) },
    radar:    vectorRadar(celidPct, caminPct, conlidPct)
  };
}

function percentilesDe(valores, baremo) {
  var pct = {};
  for (var clave in valores) {
    if (Object.prototype.hasOwnProperty.call(valores, clave)) {
      pct[clave] = percentil(valores[clave], baremo[clave]);
    }
  }
  return pct;
}

function nivelesDe(percentiles) {
  var niveles = {};
  for (var clave in percentiles) {
    if (Object.prototype.hasOwnProperty.call(percentiles, clave)) {
      niveles[clave] = nivelPorPercentil(percentiles[clave]);
    }
  }
  return niveles;
}

/**
 * Laissez-Faire entra invertido: en el radar, más lejos del centro es mejor,
 * y en Laissez-Faire un percentil alto es lo indeseable.
 */
function vectorRadar(celidPct, caminPct, conlidPct) {
  return {
    etiquetas: RADAR_ETIQUETAS,
    ideal: RADAR_PERFIL_IDEAL,
    evaluado: [
      celidPct.Carisma, celidPct.EstimInt, celidPct.Inspir, celidPct.ConsInd,
      Math.max(1, 100 - celidPct.Laissez), celidPct.RecCont, celidPct.DirExc,
      caminPct.Dir, caminPct.Cons, caminPct.Part, caminPct.Or,
      conlidPct.Tar, conlidPct.Rel, conlidPct.Camb
    ]
  };
}
