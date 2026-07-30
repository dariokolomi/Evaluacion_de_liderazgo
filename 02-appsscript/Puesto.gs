/**
 * Punto 6 — contraste del perfil evaluado contra el Perfil de Puesto.
 *
 * QUIÉN CALCULA QUÉ, que es la decisión que ordena todo este archivo:
 *
 *   - El LLM sólo LEE el documento del puesto y declara qué dimensiones de la
 *     batería exige y en qué nivel, CITANDO TEXTUALMENTE el documento. No emite
 *     ningún número, ningún porcentaje y ninguna conclusión sobre la persona
 *     evaluada: cuando se le pide el perfil de puesto, ni siquiera conoce sus
 *     resultados.
 *   - El índice de adecuación, el nivel de riesgo y las alertas los calcula el
 *     código, con los mismos cortes que usan las secciones 1 a 5.
 *
 * El porqué: un porcentaje inventado por el modelo no se puede verificar, cambia
 * entre corridas y puede contradecir los percentiles que el mismo informe imprime
 * tres páginas antes. Es exactamente la contradicción entre secciones que el PO
 * señaló en HU2, y acá entraría por la puerta grande —con un número, que es lo que
 * más se lee de un informe—.
 *
 * Lo que sí se le pide al modelo es lo único que un cálculo no puede hacer:
 * entender prosa de RRHH ("velar por el cumplimiento del framework", "eliminar
 * obstáculos e impedimentos") y decir a qué dimensión medida corresponde. Y aun
 * eso se verifica: la cita tiene que estar LITERALMENTE en el documento, o la
 * exigencia no entra al cálculo. Ver `verificarExigencias`.
 *
 * LA EXTRACCIÓN CORRE AL SUBIR EL ARCHIVO, NO AL GENERAR EL INFORME. La corrida
 * del informe ya tiene su presupuesto comprometido: `LLM_PLAZO_MS` (Sintesis.gs)
 * reserva cuatro minutos y medio de los seis que da Apps Script. La subida es una
 * ejecución aparte, con sus seis minutos enteros, y ahí leer el puesto no le
 * compite a nada.
 */

// ═══════════════════════════════════════════════════════════════════
// Qué se puede exigir
// ═══════════════════════════════════════════════════════════════════

/**
 * Dimensiones NEO que puede exigir un perfil de puesto.
 *
 * Se incluyen a propósito: los perfiles reales piden "Empatía", "Iniciativa",
 * "Responsabilidad" y "Capacidad de Adaptación" mucho más seguido que un estilo
 * de liderazgo con nombre técnico. Sin el NEO, la cobertura del índice se
 * desplomaría y el punto 6 diría poco sobre lo que el puesto efectivamente pide.
 *
 * El Neuroticismo va invertido: acá el nivel alto es lo indeseable, igual que el
 * Laissez-Faire en CELID-A.
 */
var PUESTO_NEO_INVERTIDAS = { N: true };

/**
 * El catálogo de lo exigible: una entrada por dimensión medida.
 *
 * Sale de `SINTESIS_ETIQUETAS` (Sintesis.gs) y de `NEO_NOMBRES` (Textos.gs), no
 * de una lista escrita a mano. Si mañana se agrega una dimensión al informe, el
 * punto 6 la puede exigir sin tocar este archivo; una lista propia se
 * desincronizaría en silencio.
 *
 * @return {Array<Object>} [{clave, instrumento, dimension, invertida, esNeo}]
 */
function catalogoDeExigibles() {
  var catalogo = [];

  ['celid', 'potenlid', 'camin', 'conlid'].forEach(function (instrumento) {
    var etiquetas = SINTESIS_ETIQUETAS[instrumento];
    for (var clave in etiquetas) {
      if (!Object.prototype.hasOwnProperty.call(etiquetas, clave)) continue;
      catalogo.push({
        clave: clave,
        instrumento: instrumento,
        dimension: etiquetas[clave],
        invertida: !!SINTESIS_INVERTIDAS[clave],
        esNeo: false
      });
    }
  });

  NEO_DIMENSIONES.forEach(function (clave) {
    catalogo.push({
      clave: clave,
      instrumento: 'neo',
      dimension: NEO_NOMBRES[clave],
      invertida: !!PUESTO_NEO_INVERTIDAS[clave],
      esNeo: true
    });
  });

  return catalogo;
}

/** Busca una dimensión del catálogo por su nombre, tolerando mayúsculas y tildes. */
function exigibleLlamado(nombre) {
  var buscado = textoComparable(nombre);
  if (!buscado) return null;
  var catalogo = catalogoDeExigibles();
  for (var i = 0; i < catalogo.length; i++) {
    if (textoComparable(catalogo[i].dimension) === buscado) return catalogo[i];
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// Comparación de textos — la que sostiene la verificación de las citas
// ═══════════════════════════════════════════════════════════════════

/**
 * Ligaduras tipográficas que traen los PDF.
 *
 * El PDF de ejemplo escribe "planiﬁcación" y "especiﬁcaciones" con la ligadura
 * ﬁ en un solo carácter. El modelo, que recibe ese mismo texto, a veces devuelve
 * la cita con la ligadura y a veces con las dos letras sueltas. Sin normalizarlas
 * la cita "no aparece en el documento" y se descarta una exigencia buena.
 */
var PUESTO_LIGADURAS = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl' };

/**
 * Deja un texto en la forma en que se comparan cita y documento: sin tildes, sin
 * mayúsculas, sin ligaduras, con un solo espacio entre palabras y sin guiones de
 * corte de línea.
 *
 * Es deliberadamente permisivo con la FORMA y estricto con las PALABRAS: lo que
 * se quiere impedir es que el modelo invente una exigencia, no que se le exija
 * copiar los saltos de línea de un PDF.
 */
function textoComparable(texto) {
  var salida = String(texto == null ? '' : texto);
  for (var ligadura in PUESTO_LIGADURAS) {
    if (!Object.prototype.hasOwnProperty.call(PUESTO_LIGADURAS, ligadura)) continue;
    salida = salida.split(ligadura).join(PUESTO_LIGADURAS[ligadura]);
  }
  return salida
    .toLowerCase()
    // Guion al final de renglón: "requeri-\nmientos" es una sola palabra.
    .replace(/-\s*\n\s*/g, '')
    // NFD separa la tilde de la letra y el rango de combinantes la borra: así
    // "planificación" y "planificacion" son la misma cita.
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim();
}

// ═══════════════════════════════════════════════════════════════════
// De archivo a texto
// ═══════════════════════════════════════════════════════════════════

var EXTENSIONES_DE_PERFIL = ['.pdf', '.docx', '.doc'];

/**
 * Cuánto puede pesar un perfil de puesto subido desde el navegador.
 * Los reales son de dos o tres páginas; el mismo tope que las planillas es
 * holgado y sigue entrando cómodo por `google.script.run`.
 */
var MAX_PERFIL_BYTES = 10 * 1024 * 1024;

function extensionDePerfil(nombre) {
  var minusculas = String(nombre).toLowerCase();
  for (var i = 0; i < EXTENSIONES_DE_PERFIL.length; i++) {
    var extension = EXTENSIONES_DE_PERFIL[i];
    if (minusculas.slice(-extension.length) === extension) return true;
  }
  return false;
}

/**
 * El texto del perfil de puesto.
 *
 * Mismo mecanismo que `abrirComoPlanilla` (Informe.gs): se copia el archivo
 * convertido al formato de Google —acá a Documento— y la copia se anota como
 * temporal para descartarla al terminar. Para PDF, esa conversión es la que hace
 * el OCR; se declara el idioma para que no adivine.
 *
 * @param {string} archivoId
 * @param {Array<string>} temporales se le agregan los ids a descartar
 * @return {string} el texto plano del documento
 */
function textoDelPerfilDePuesto(archivoId, temporales) {
  var archivo = DriveApp.getFileById(archivoId);
  if (archivo.getMimeType() === MimeType.GOOGLE_DOCS) {
    return DocumentApp.openById(archivoId).getBody().getText();
  }
  var copia = Drive.Files.copy(
    { name: archivo.getName() + ' (convertido)', mimeType: MimeType.GOOGLE_DOCS },
    archivoId,
    // supportsAllDrives por lo mismo que en Informe.gs: sin esto, el servicio
    // avanzado no ve los archivos de Unidades compartidas.
    { supportsAllDrives: true, ocrLanguage: 'es' }
  );
  temporales.push(copia.id);
  var texto = DocumentApp.openById(copia.id).getBody().getText();
  if (!textoComparable(texto)) {
    throw new Error(
      'No se pudo leer texto del perfil de puesto. Si es un PDF escaneado, '
      + 'probá con el archivo original o con una versión en Word.'
    );
  }
  return texto;
}

// ═══════════════════════════════════════════════════════════════════
// El pedido al modelo
// ═══════════════════════════════════════════════════════════════════

/**
 * Cuánto texto del puesto se le manda al modelo.
 *
 * Los perfiles reales entran enteros. El tope existe para que un documento de
 * cincuenta páginas no se coma el contexto y devuelva cualquier cosa: es mejor
 * leer las primeras páginas —donde está el puesto— que fallar.
 */
var PUESTO_MAX_CARACTERES = 12000;

var PUESTO_NIVELES = ['Alto', 'Medio', 'Bajo'];

function mensajesDeExtraccion(textoDelPuesto, modelo) {
  var exigibles = catalogoDeExigibles().map(function (d) {
    return '- ' + d.dimension
      + (d.invertida ? ' (OJO: acá el nivel ALTO es lo indeseable; un puesto que'
        + ' quiere que esto no pase exige nivel Bajo)' : '');
  }).join('\n');

  var instrucciones = [
    'Sos analista de RRHH. Tu única tarea es LEER un perfil de puesto y decir qué',
    'dimensiones de una batería de evaluación de liderazgo exige ese puesto.',
    '',
    'NO conocés a ninguna persona evaluada y no vas a recibir resultados de nadie.',
    'No emitas porcentajes, puntajes, conclusiones ni recomendaciones: sólo leés el',
    'documento y lo traducís a esta lista cerrada de dimensiones.',
    '',
    'DIMENSIONES QUE SE PUEDEN EXIGIR (usá el nombre EXACTO, tal cual está escrito):',
    exigibles,
    '',
    'REGLAS, y son la razón de ser de esta tarea:',
    '1. Cada exigencia tiene que apoyarse en una CITA LITERAL del documento:',
    '   copiada carácter por carácter, entre 15 y 300 caracteres, de una sola parte',
    '   del texto. No la resumas, no la parafrasees, no la unas con puntos',
    '   suspensivos. Una cita que no esté textual en el documento hace que la',
    '   exigencia se descarte.',
    '2. Si el documento no dice nada que corresponda a una dimensión, NO la',
    '   incluyas. Un perfil de puesto normal exige entre 4 y 10 dimensiones, no las',
    '   veinticuatro. No completes la lista.',
    '3. nivelRequerido es "Alto", "Medio" o "Bajo". Usá "Bajo" sólo cuando el puesto',
    '   pide expresamente que algo NO ocurra (típicamente en las dimensiones',
    '   marcadas arriba como indeseables).',
    '4. critica: true sólo si el documento la presenta como central del rol',
    '   (responsabilidad principal, competencia excluyente). Las demás, false.',
    '5. Una dimensión, una sola vez.',
    '6. En "noMedidos" listá los requisitos del puesto que esta batería NO puede',
    '   medir —título, años de experiencia, conocimientos técnicos, idiomas,',
    '   disponibilidad— cada uno con su cita literal. Sirven para declarar qué parte',
    '   del puesto queda fuera del análisis.',
    '',
    'Respondé SÓLO con este JSON, sin texto alrededor:',
    '{',
    '  "puesto": "<nombre del puesto tal como figura en el documento>",',
    '  "exigencias": [',
    '    {"dimension": "<nombre exacto de la lista>", "nivelRequerido": "Alto|Medio|Bajo",',
    '     "critica": true|false, "cita": "<texto literal del documento>"}',
    '  ],',
    '  "noMedidos": [{"requisito": "<qué pide>", "cita": "<texto literal>"}]',
    '}'
  ].join('\n');

  return [
    { role: 'system', content: apagarRazonamiento(modelo) },
    { role: 'user', content: instrucciones
      + '\n\nPERFIL DE PUESTO:\n"""\n'
      + String(textoDelPuesto).slice(0, PUESTO_MAX_CARACTERES)
      + '\n"""' }
  ];
}

/**
 * Deja sólo las exigencias que el documento sostiene.
 *
 * Es la validación que hace que el punto 6 sea verificable. Todo lo que no pasa
 * NO se calla: vuelve en `descartadas` y termina impreso en las alertas del
 * informe, porque una exigencia descartada cambia el índice y quien lee tiene que
 * poder saber que se descartó.
 *
 * Función pura: es lo que se verifica en los tests.
 *
 * @return {Object} {exigencias, descartadas, noMedidos, puesto}
 */
function verificarExigencias(datos, textoDelPuesto) {
  var documento = textoComparable(textoDelPuesto);
  var exigencias = [];
  var descartadas = [];
  var vistas = {};

  var declaradas = (datos && datos.exigencias) || [];
  declaradas.forEach(function (e) {
    var nombre = (e && e.dimension) || '';
    var exigible = exigibleLlamado(nombre);
    if (!exigible) {
      descartadas.push({ dimension: String(nombre) || '(sin nombre)',
        motivo: 'no es una dimensión que esta batería mida' });
      return;
    }
    var nivel = (e && e.nivelRequerido) || '';
    if (PUESTO_NIVELES.indexOf(nivel) < 0) {
      descartadas.push({ dimension: exigible.dimension,
        motivo: 'el nivel requerido no era Alto, Medio ni Bajo' });
      return;
    }
    var cita = textoComparable(e && e.cita);
    if (!cita || documento.indexOf(cita) < 0) {
      descartadas.push({ dimension: exigible.dimension,
        motivo: 'la cita no está textualmente en el perfil de puesto' });
      return;
    }

    var anterior = vistas[exigible.clave];
    if (anterior) {
      // Dos exigencias sobre la misma dimensión. Si dicen lo mismo, sobra una. Si
      // se contradicen, no hay forma de elegir cuál vale: se van las dos y queda
      // dicho, que es más honesto que quedarse con la primera que llegó.
      if (anterior.nivelRequerido !== nivel) {
        exigencias = exigencias.filter(function (x) { return x.clave !== exigible.clave; });
        descartadas.push({ dimension: exigible.dimension,
          motivo: 'el perfil de puesto la exige en dos niveles distintos ('
            + anterior.nivelRequerido + ' y ' + nivel + ')' });
        vistas[exigible.clave] = { nivelRequerido: nivel, anulada: true };
      }
      return;
    }

    var registro = {
      clave: exigible.clave,
      instrumento: exigible.instrumento,
      esNeo: exigible.esNeo,
      invertida: exigible.invertida,
      dimension: exigible.dimension,
      nivelRequerido: nivel,
      critica: !!(e && e.critica),
      cita: String(e.cita).trim()
    };
    vistas[exigible.clave] = registro;
    exigencias.push(registro);
  });

  var noMedidos = ((datos && datos.noMedidos) || []).filter(function (r) {
    var cita = textoComparable(r && r.cita);
    return cita && documento.indexOf(cita) >= 0;
  }).map(function (r) {
    return { requisito: String(r.requisito || '').trim(), cita: String(r.cita).trim() };
  });

  return {
    puesto: String((datos && datos.puesto) || '').trim(),
    exigencias: exigencias,
    descartadas: descartadas,
    noMedidos: noMedidos
  };
}

/**
 * Lee el perfil de puesto con el LLM y devuelve las exigencias verificadas.
 *
 * A diferencia del punto 5, acá NO hay salida determinista: sin exigencias no hay
 * nada que contrastar, y un punto 6 vacío es peor que no tenerlo. Por eso esto
 * lanza en vez de devolver null, y lo hace en el momento de subir el archivo,
 * donde el error se puede mostrar y corregir.
 *
 * @param {string} archivoId el perfil de puesto ya guardado en Drive
 * @return {Object} {puesto, exigencias, descartadas, noMedidos, modelo}
 */
function leerPerfilDePuesto(archivoId) {
  var propiedades = PropertiesService.getScriptProperties();
  var clave = propiedades.getProperty(PROP_LLM_API_KEY);
  if (!clave) {
    throw new Error('Para leer perfiles de puesto hace falta configurar '
      + PROP_LLM_API_KEY + ' en Propiedades del script.');
  }

  var temporales = [];
  var texto;
  try {
    texto = textoDelPerfilDePuesto(archivoId, temporales);
  } finally {
    descartarTemporales(temporales);
  }

  var modelos = modelosConfigurados(propiedades);
  var motivos = [];

  for (var i = 0; i < modelos.length; i++) {
    for (var intento = 1; intento <= LLM_INTENTOS; intento++) {
      try {
        var respuesta = respuestaDelModelo(
          mensajesDeExtraccion(texto, modelos[i]), clave, modelos[i]
        );
        if (!respuesta.datos) {
          motivos.push(modelos[i] + ' → ' + respuesta.motivo);
          continue;
        }
        var leido = verificarExigencias(respuesta.datos, texto);
        if (!leido.exigencias.length) {
          motivos.push(modelos[i] + ' → no quedó ninguna exigencia verificable');
          continue;
        }
        leido.modelo = modelos[i];
        return leido;
      } catch (e) {
        motivos.push(modelos[i] + ' → la llamada se interrumpió: ' + e.message);
      }
    }
  }

  console.warn('No se pudo leer el perfil de puesto (' + motivos.join(' | ') + ').');
  throw new Error('No se pudo leer el perfil de puesto: ' + motivos.join(' | '));
}

// ═══════════════════════════════════════════════════════════════════
// El índice de adecuación
// ═══════════════════════════════════════════════════════════════════

/**
 * Cuánto aporta la persona a cada exigencia, según el nivel que pide el puesto y
 * el nivel que tiene.
 *
 * ES SIMÉTRICA A PROPÓSITO: quedarse corto donde el puesto pide Alto vale lo
 * mismo que pasarse donde el puesto pide Bajo. La fila "Bajo" no es teórica: es
 * la que se usa cuando el puesto pide que el Laissez-Faire no aparezca, y ahí un
 * nivel medio ya es medio problema, no cero.
 *
 * El escalón de "Medio" es 60 y no 50 porque el corte de nivel de esta batería
 * (`nivelPorPercentil`) manda a Medio a todo el tramo P26–P75, que es la mitad de
 * la distribución: castigarlo como si fuera bajo dejaría a un perfil normal con
 * un índice que no describe nada.
 *
 * Donde el puesto pide Medio, superarlo no penaliza: un puesto que pide
 * consideración media no se cubre peor con alguien que la tiene alta.
 */
var PUESTO_PUNTAJE = {
  Alto:  { Alto: 100, Medio: 60,  Bajo: 20 },
  Medio: { Alto: 100, Medio: 100, Bajo: 50 },
  Bajo:  { Alto: 20,  Medio: 60,  Bajo: 100 }
};

/** Una exigencia crítica pesa el doble que una accesoria. */
var PUESTO_PESO_CRITICA = 2;

/**
 * El nivel del NEO llevado a las tres bandas del resto del informe.
 *
 * El NEO se rotula en cinco niveles y las dimensiones de liderazgo en tres. Para
 * compararlas contra una misma exigencia hay que hablar un solo idioma, y el que
 * manda es el de tres, que es el que usa el puesto.
 */
function nivelNeoEnTresBandas(nivel) {
  if (nivel === 'Muy Alto' || nivel === 'Alto') return 'Alto';
  if (nivel === 'Promedio') return 'Medio';
  return 'Bajo';
}

/**
 * El nivel real de la persona en una dimensión exigida.
 *
 * Sale de `nivelPorPercentil` (Correccion.gs), LA MISMA función con la que el
 * informe rotula sus tablas en las secciones 1 a 4. Un corte propio acá haría que
 * el punto 6 dijera "Bajo" donde la tabla dice "Medio" — la contradicción entre
 * secciones de HU2, otra vez.
 *
 * @return {Object|null} {nivel, percentil} o null si el instrumento no la trae
 */
function nivelRealDe(exigencia, resultados) {
  if (exigencia.esNeo) {
    var nivelNeo = resultados.neo.nivel[exigencia.clave];
    if (!nivelNeo) return null;
    return { nivel: nivelNeoEnTresBandas(nivelNeo), nivelDetallado: nivelNeo, percentil: null };
  }
  var bloque = resultados[exigencia.instrumento];
  var percentil = bloque && bloque.percentil[exigencia.clave];
  if (percentil === undefined || percentil === null) return null;
  return { nivel: nivelPorPercentil(percentil), nivelDetallado: nivelPorPercentil(percentil),
    percentil: percentil };
}

/**
 * El índice de adecuación y la tabla que lo sostiene.
 *
 * Función pura. Devuelve `porcentaje: null` cuando no hay ninguna exigencia
 * calculable, que no es lo mismo que 0 %: el informe lo dice con palabras en vez
 * de imprimir un cero que se leería como "no sirve para el puesto".
 *
 * @param {Array<Object>} exigencias las verificadas
 * @param {Object} resultados salida de corregir()
 * @return {Object} {porcentaje, filas, sumaPeso, sumaPuntos}
 */
function indiceDeAdecuacion(exigencias, resultados) {
  var filas = [];
  var sumaPuntos = 0;
  var sumaPeso = 0;

  exigencias.forEach(function (e) {
    var real = nivelRealDe(e, resultados);
    if (!real) return;
    var puntaje = PUESTO_PUNTAJE[e.nivelRequerido][real.nivel];
    var peso = e.critica ? PUESTO_PESO_CRITICA : 1;
    sumaPuntos += peso * puntaje;
    sumaPeso += peso * 100;
    filas.push({
      clave: e.clave,
      dimension: e.dimension,
      requerido: e.nivelRequerido,
      real: real.nivel,
      nivelDetallado: real.nivelDetallado,
      percentil: real.percentil,
      critica: e.critica,
      invertida: e.invertida,
      esNeo: e.esNeo,
      puntaje: puntaje,
      cita: e.cita
    });
  });

  return {
    porcentaje: sumaPeso ? Math.round((sumaPuntos / sumaPeso) * 100) : null,
    filas: filas,
    sumaPuntos: sumaPuntos,
    sumaPeso: sumaPeso
  };
}

// ═══════════════════════════════════════════════════════════════════
// Riesgo operativo
// ═══════════════════════════════════════════════════════════════════

/**
 * Cuántas exigencias críticas sin cubrir hacen falta para cada nivel de riesgo.
 *
 * ES UN CRITERIO RAZONABLE, NO UNA NORMA VALIDADA — igual que el margen del eje en
 * Perfil.gs. Está acá, en una constante con nombre, para que el PO lo pueda mover
 * en un solo lugar en vez de buscarlo adentro de un `if`.
 *
 * "Sin cubrir" es puntaje menor a 100 en una exigencia marcada como crítica: el
 * puesto la presenta como central del rol y la persona no llega al nivel pedido.
 */
var PUESTO_RIESGO_ALTO = 3;
var PUESTO_RIESGO_MEDIO = 1;

function nivelDeRiesgo(filas) {
  // Sin una sola exigencia calculable no se clasifica el riesgo. Decir "Bajo" ahí
  // sería el mismo error que imprimir 0 % de adecuación: leerlo como un resultado
  // cuando en realidad no se midió nada.
  if (!filas.length) return null;
  var criticasSinCubrir = filas.filter(function (f) {
    return f.critica && f.puntaje < 100;
  }).length;
  if (criticasSinCubrir >= PUESTO_RIESGO_ALTO) return 'Alto';
  if (criticasSinCubrir >= PUESTO_RIESGO_MEDIO) return 'Medio';
  return 'Bajo';
}

// ═══════════════════════════════════════════════════════════════════
// Las alertas sobre el índice
// ═══════════════════════════════════════════════════════════════════

/**
 * Qué empuja el porcentaje para arriba o para abajo.
 *
 * Un índice suelto se lee como un veredicto. Estas alertas existen para que se
 * lea como lo que es: una cuenta con supuestos, algunos de los cuales podrían
 * ser otros. Cada una se calcula RECALCULANDO el índice bajo el supuesto
 * alternativo, así el efecto es un número real —"baja 7 puntos porcentuales"— y
 * no una advertencia genérica que nadie sabe cuánto pesa.
 *
 * Función pura, con todo lo que necesita en los argumentos: es lo que permite
 * verificar cada alerta con valores escritos a mano.
 *
 * @param {Object} lectura {exigencias, descartadas, noMedidos}
 * @param {Object} indice salida de indiceDeAdecuacion
 * @param {Object} resultados salida de corregir()
 * @param {Object} perfil salida de clasificarPerfil()
 * @return {Array<Object>} [{alerta, direccion, puntos, queMirar}]
 */
function alertasDeAdecuacion(lectura, indice, resultados, perfil) {
  var alertas = [];
  if (indice.porcentaje === null) return alertas;

  // 1. Exigencias que el documento no sostuvo. Se recalcula el índice como si
  //    hubieran entrado, para decir cuánto está cambiando el descarte.
  if (lectura.descartadas.length) {
    var sinVerificar = lectura.descartadas.filter(function (d) {
      return exigibleLlamado(d.dimension);
    }).map(function (d) {
      var exigible = exigibleLlamado(d.dimension);
      return {
        clave: exigible.clave, instrumento: exigible.instrumento, esNeo: exigible.esNeo,
        invertida: exigible.invertida, dimension: exigible.dimension,
        // Sin nivel declarado válido, el supuesto que se prueba es el más
        // exigente: es el que muestra el peor caso, que es lo que interesa saber.
        nivelRequerido: 'Alto', critica: false, cita: ''
      };
    });
    var conDescartadas = indiceDeAdecuacion(lectura.exigencias.concat(sinVerificar), resultados);
    alertas.push({
      alerta: lectura.descartadas.length + ' exigencia(s) declaradas por la lectura del '
        + 'puesto quedaron fuera del cálculo porque el documento no las sostiene: '
        + lectura.descartadas.map(function (d) {
          return d.dimension + ' (' + d.motivo + ')';
        }).join('; ') + '.',
      direccion: direccionDe(conDescartadas.porcentaje, indice.porcentaje),
      puntos: puntosDe(conDescartadas.porcentaje, indice.porcentaje),
      queMirar: 'Si el puesto realmente las exige, conviene decirlo con todas las '
        + 'letras en el perfil de puesto y volver a subirlo.'
    });
  }

  // 2. Cobertura. No mueve el índice: le cambia el alcance, que es peor confundir.
  if (lectura.noMedidos.length) {
    var total = indice.filas.length + lectura.noMedidos.length;
    alertas.push({
      alerta: 'El índice cubre ' + indice.filas.length + ' de ' + total + ' requisitos '
        + 'del perfil. Los otros ' + lectura.noMedidos.length + ' —'
        + lectura.noMedidos.slice(0, 4).map(function (r) { return r.requisito; }).join(', ')
        + (lectura.noMedidos.length > 4 ? ', y otros' : '')
        + '— no los mide esta batería.',
      direccion: 'indefinida',
      puntos: 0,
      queMirar: 'El porcentaje NO es la adecuación al puesto entero: es la adecuación '
        + 'en lo que estos instrumentos miden. Los requisitos técnicos y de '
        + 'experiencia se evalúan por otra vía.'
    });
  }

  // 3. Críticas que puntúan 100 estando en brecha: el puesto pedía nivel medio y la
  //    persona lo tiene, pero el resto del informe la nombra como área a desarrollar.
  //    Sin esta alerta, el punto 6 parece contradecir al punto 5.
  var indulgentes = indice.filas.filter(function (f) {
    return f.critica && f.puntaje === 100 && f.requerido !== 'Alto'
      && !f.esNeo && !f.invertida && f.percentil !== null && esBrecha(f.percentil);
  });
  if (indulgentes.length) {
    var comoAltas = indice.filas.map(function (f) {
      return exigenciaDeFila(f, indulgentes.indexOf(f) >= 0 ? 'Alto' : f.requerido);
    });
    var exigente = indiceDeAdecuacion(comoAltas, resultados);
    alertas.push({
      alerta: indulgentes.map(function (f) { return f.dimension; }).join(', ')
        + ': el puesto la exige en nivel ' + indulgentes[0].requerido.toLowerCase()
        + ' y la persona lo alcanza, pero el informe la cuenta igual como área de '
        + 'desarrollo. Suma 100 al índice sin ser una fortaleza consolidada.',
      direccion: direccionDe(exigente.porcentaje, indice.porcentaje),
      puntos: puntosDe(exigente.porcentaje, indice.porcentaje),
      queMirar: 'Si el rol la necesitara en nivel alto, el índice sería '
        + exigente.porcentaje + ' %.'
    });
  }

  // 4. Las invertidas altas. Ya penalizan en el índice y además cuentan para el
  //    riesgo: se dice, para que no se lea como dos problemas distintos.
  var invertidasAltas = indice.filas.filter(function (f) {
    return f.invertida && f.real === 'Alto';
  });
  invertidasAltas.forEach(function (f) {
    alertas.push({
      alerta: f.dimension + ' está en nivel alto y en esta dimensión el nivel alto es '
        + 'lo indeseable: el puesto la pide en nivel ' + f.requerido.toLowerCase() + '.',
      direccion: 'baja',
      puntos: 0,
      queMirar: 'Ya está descontada del índice. Si además aparece en el nivel de '
        + 'riesgo, es el mismo hallazgo contado desde otro lado, no dos problemas.'
    });
  });

  // 5. Perfil sin estilo predominante: la lectura situacional del punto 6 se apoya
  //    en una aproximación, no en un estilo que el dato imponga.
  if (perfil && perfil.mixto) {
    alertas.push({
      alerta: 'El perfil no tiene un estilo de liderazgo predominante: hay un empate '
        + 'en el nivel más alto.',
      direccion: 'indefinida',
      puntos: 0,
      queMirar: 'La lectura del ajuste situacional se apoya en a qué estilo se '
        + 'aproxima el perfil, que es una inferencia sobre las dimensiones y no un '
        + 'estilo que el dato imponga.'
    });
  }

  // 6. Cuánto depende el número del peso de las críticas. Si al sacarles el doble
  //    peso el índice se mueve mucho, es que lo está sosteniendo esa decisión y no
  //    el perfil.
  var criticas = indice.filas.filter(function (f) { return f.critica; }).length;
  if (criticas) {
    var sinPeso = indiceDeAdecuacion(indice.filas.map(function (f) {
      var e = exigenciaDeFila(f, f.requerido);
      e.critica = false;
      return e;
    }), resultados);
    var mueve = Math.abs(sinPeso.porcentaje - indice.porcentaje);
    if (mueve >= PUESTO_SENSIBILIDAD_MINIMA) {
      alertas.push({
        alerta: 'El índice se apoya en que ' + criticas + ' exigencia(s) pesan el doble '
          + 'por ser críticas. Contándolas como las demás, el índice sería '
          + sinPeso.porcentaje + ' %.',
        direccion: direccionDe(sinPeso.porcentaje, indice.porcentaje),
        puntos: puntosDe(sinPeso.porcentaje, indice.porcentaje),
        queMirar: 'Qué exigencias son críticas lo declara la lectura del perfil de '
          + 'puesto. Vale revisar que coincida con lo que el rol necesita de verdad.'
      });
    }
  }

  return alertas;
}

/** Debajo de esto, la sensibilidad al peso es ruido y no vale una alerta. */
var PUESTO_SENSIBILIDAD_MINIMA = 3;

/** Una fila del índice de vuelta en forma de exigencia, para poder recalcular. */
function exigenciaDeFila(fila, nivelRequerido) {
  var exigible = exigibleLlamado(fila.dimension);
  return {
    clave: fila.clave,
    instrumento: exigible ? exigible.instrumento : null,
    esNeo: fila.esNeo,
    invertida: fila.invertida,
    dimension: fila.dimension,
    nivelRequerido: nivelRequerido,
    critica: fila.critica,
    cita: fila.cita
  };
}

function direccionDe(alternativo, actual) {
  if (alternativo > actual) return 'sube';
  if (alternativo < actual) return 'baja';
  return 'indefinida';
}

function puntosDe(alternativo, actual) {
  return Math.abs(Math.round(alternativo - actual));
}

// ═══════════════════════════════════════════════════════════════════
// Todo junto — lo que consume el documento
// ═══════════════════════════════════════════════════════════════════

/**
 * El punto 6 completo, listo para imprimir.
 *
 * Función pura: recibe la lectura del puesto (que ya se hizo al subir el archivo)
 * y los resultados de la persona, y no llama a nadie. Todo lo que devuelve se
 * puede verificar con valores escritos a mano.
 *
 * @param {Object} lectura salida de leerPerfilDePuesto()
 * @param {Object} resultados salida de corregir()
 * @return {Object} el material del punto 6
 */
function adecuacionAlPuesto(lectura, resultados) {
  var indice = indiceDeAdecuacion(lectura.exigencias, resultados);
  var perfil = clasificarPerfil(resultados);

  var fortalezas = indice.filas.filter(function (f) {
    // Fortaleza apalancable: el puesto la exige y la persona no sólo llega, la
    // tiene consolidada según el corte del punto 5 (Perfil.gs). En las invertidas
    // y en el NEO el percentil no aplica igual, así que alcanza con cubrir el
    // nivel pedido.
    if (f.puntaje < 100) return false;
    if (f.esNeo || f.invertida || f.percentil === null) return true;
    return esFortalezaConsolidada(f.percentil);
  });

  var brechas = indice.filas.filter(function (f) { return f.puntaje < 100; })
    .sort(function (a, b) {
      // Primero las críticas, y dentro de cada grupo las que más lejos están.
      return (b.critica - a.critica) || (a.puntaje - b.puntaje);
    });

  return {
    puesto: lectura.puesto,
    archivo: lectura.archivo || '',
    modelo: lectura.modelo || '',
    porcentaje: indice.porcentaje,
    filas: indice.filas,
    cobertura: {
      medidos: indice.filas.length,
      noMedidos: lectura.noMedidos.length,
      total: indice.filas.length + lectura.noMedidos.length,
      detalle: lectura.noMedidos
    },
    riesgo: nivelDeRiesgo(indice.filas),
    fortalezas: fortalezas,
    brechas: brechas,
    alertas: alertasDeAdecuacion(lectura, indice, resultados, perfil),
    descartadas: lectura.descartadas,
    perfil: perfil
  };
}

/**
 * La lectura del puesto que vuelve del navegador, reducida a lo que el cálculo
 * puede usar.
 *
 * La lectura se hace al subir el archivo y viaja al navegador para mostrarla;
 * cuando se genera el informe, vuelve. Entre ida y vuelta pasa por un cliente, y
 * lo que llega de un cliente no se usa tal cual aunque quien lo maneje sea de
 * confianza: cada exigencia se vuelve a resolver contra el catálogo, así una
 * dimensión que no existe o un nivel inventado no llegan nunca a la cuenta.
 *
 * Las citas no se pueden re-verificar acá sin volver a convertir el documento, y
 * no hace falta: ya se verificaron al leerlo, y lo que esta función impide es
 * justamente que entre algo que el catálogo no reconoce.
 *
 * @return {Object|null} la lectura saneada, o null si no queda nada utilizable
 */
function sanearLecturaDePuesto(crudo) {
  if (!crudo || !Array.isArray(crudo.exigencias)) return null;

  var exigencias = [];
  var vistas = {};
  crudo.exigencias.forEach(function (e) {
    var exigible = exigibleLlamado(e && e.dimension);
    if (!exigible || vistas[exigible.clave]) return;
    if (PUESTO_NIVELES.indexOf(e.nivelRequerido) < 0) return;
    vistas[exigible.clave] = true;
    exigencias.push({
      clave: exigible.clave,
      instrumento: exigible.instrumento,
      esNeo: exigible.esNeo,
      invertida: exigible.invertida,
      dimension: exigible.dimension,
      nivelRequerido: e.nivelRequerido,
      critica: !!e.critica,
      cita: String(e.cita || '')
    });
  });
  if (!exigencias.length) return null;

  return {
    id: String(crudo.id || ''),
    nombre: String(crudo.nombre || ''),
    puesto: String(crudo.puesto || ''),
    modelo: String(crudo.modelo || ''),
    exigencias: exigencias,
    descartadas: (crudo.descartadas || []).map(function (d) {
      return { dimension: String(d.dimension || ''), motivo: String(d.motivo || '') };
    }),
    noMedidos: (crudo.noMedidos || []).map(function (r) {
      return { requisito: String(r.requisito || ''), cita: String(r.cita || '') };
    })
  };
}

// ═══════════════════════════════════════════════════════════════════
// La prosa del punto 6
// ═══════════════════════════════════════════════════════════════════

/** Campos obligatorios de cada lista de la narrativa del punto 6. */
var PUESTO_LISTAS = {
  fortalezasApalancables: ['titulo', 'texto'],
  riesgos: ['titulo', 'texto']
};

/**
 * Los hechos del contraste, tal como los ve el modelo.
 *
 * Van los NIVELES y nunca los números, igual que en el punto 5: el porcentaje y
 * la tabla los imprime el documento, y un modelo que ve el número lo repite y lo
 * redondea mal. Lo que se le pide es que explique el ajuste, no que lo mida.
 */
function datosDelContraste(adecuacion) {
  var cubiertas = adecuacion.filas.filter(function (f) { return f.puntaje === 100; });
  var faltantes = adecuacion.filas.filter(function (f) { return f.puntaje < 100; });

  var linea = function (f) {
    return '- ' + f.dimension + ': el puesto la pide en nivel ' + f.requerido.toLowerCase()
      + ' y la persona está en nivel ' + f.real.toLowerCase()
      + (f.critica ? ' — el puesto la presenta como central del rol' : '')
      + (f.invertida ? ' — en esta dimensión el nivel alto es lo indeseable' : '');
  };

  return [
    'PUESTO: ' + (adecuacion.puesto || 'sin nombre en el documento'),
    '',
    'LO QUE EL PUESTO EXIGE Y LA PERSONA CUBRE:',
    cubiertas.length ? cubiertas.map(linea).join('\n') : '- (ninguna)',
    '',
    'LO QUE EL PUESTO EXIGE Y LA PERSONA NO CUBRE DEL TODO:',
    faltantes.length ? faltantes.map(linea).join('\n') : '- (ninguna)',
    '',
    'ESTILO DE LIDERAZGO DEL PERFIL: ' + adecuacion.perfil.etiqueta
      + (adecuacion.perfil.mixto ? ' (no hay un estilo predominante: hay empate arriba)' : ''),
    '',
    'PARTE DEL PUESTO QUE ESTA EVALUACIÓN NO MIDE: '
      + (adecuacion.cobertura.noMedidos
        ? adecuacion.cobertura.detalle.map(function (r) { return r.requisito; }).join('; ')
        : 'nada relevante')
  ].join('\n');
}

function mensajesDeNarrativa(adecuacion, modelo) {
  var instrucciones = [
    'Sos psicólogo/a laboral especializado/a en evaluación de liderazgo. Estás',
    'escribiendo el punto 6 de un informe: el contraste entre el perfil de la',
    'persona evaluada y lo que exige un puesto concreto. Lo lee el área de RRHH y',
    'queda archivado en el legajo.',
    '',
    'CÓMO ESCRIBIR:',
    '- Castellano rioplatense, profesional y directo. Nada de vocabulario técnico',
    '  de los instrumentos ni de jerga del sistema.',
    '- NO escribas ningún número: ni porcentajes, ni puntajes, ni percentiles. El',
    '  informe ya los imprime en su tabla; tu trabajo es explicar el ajuste.',
    '- No afirmes un nivel distinto del que figura abajo. Si algo está en nivel',
    '  medio, no lo llames alto.',
    '- No hables de contratar, descartar ni promover: el informe describe, no',
    '  decide.',
    '- Cuando necesites nombrar a la persona escribí exactamente '
      + SINTESIS_MARCADOR_NOMBRE + ', con los corchetes.',
    '',
    'Respondé SÓLO con este JSON:',
    '{',
    '  "lecturaGeneral": "<un párrafo: cómo se para este perfil frente a este puesto,',
    '    qué lo favorece y qué le va a costar>",',
    '  "fortalezasApalancables": [{"titulo": "<rasgo>", "texto": "<qué acelera en este',
    '    puesto concreto, no en abstracto>"}],',
    '  "riesgos": [{"titulo": "<riesgo o descarrilador>", "texto": "<en qué situación',
    '    del puesto aparecería y cómo se manifestaría bajo presión>"}]',
    '}',
    '',
    'Las fortalezas salen de lo que el puesto exige Y la persona cubre. Los riesgos,',
    'de lo que el puesto exige y la persona no cubre del todo. No inventes ninguna',
    'dimensión que no esté en la lista.'
  ].join('\n');

  return [
    { role: 'system', content: apagarRazonamiento(modelo) },
    { role: 'user', content: instrucciones + '\n\n' + datosDelContraste(adecuacion) }
  ];
}

/** Todo el texto de la narrativa, para revisarlo de una sola pasada. */
function textoDeNarrativa(datos) {
  var partes = [datos.lecturaGeneral];
  for (var lista in PUESTO_LISTAS) {
    if (!Object.prototype.hasOwnProperty.call(PUESTO_LISTAS, lista)) continue;
    (datos[lista] || []).forEach(function (item) {
      partes.push(item.titulo, item.texto);
    });
  }
  return partes.filter(function (p) { return typeof p === 'string'; }).join(' \n ');
}

/**
 * Revisa la narrativa del punto 6.
 *
 * Las dos validaciones de contenido son las MISMAS del punto 5
 * (`validarContenido` y `validarNivelesCoherentes`, Sintesis.gs): las dos
 * secciones se leen seguidas en el mismo documento, y una que puede citar un
 * número o atribuir un nivel equivocado donde la otra no puede sería una grieta
 * por donde entra justo lo que se está impidiendo tres párrafos antes.
 */
function validarNarrativa(datos, perfil) {
  if (!datos || typeof datos !== 'object') {
    return { ok: false, motivo: 'la respuesta no es un objeto' };
  }
  if (typeof datos.lecturaGeneral !== 'string' || !datos.lecturaGeneral.trim()) {
    return { ok: false, motivo: 'falta lecturaGeneral' };
  }
  for (var lista in PUESTO_LISTAS) {
    if (!Object.prototype.hasOwnProperty.call(PUESTO_LISTAS, lista)) continue;
    var items = datos[lista];
    if (!Array.isArray(items) || !items.length) {
      return { ok: false, motivo: 'falta la lista ' + lista + ' o vino vacía' };
    }
    for (var i = 0; i < items.length; i++) {
      var campos = PUESTO_LISTAS[lista];
      for (var j = 0; j < campos.length; j++) {
        if (typeof items[i][campos[j]] !== 'string' || !items[i][campos[j]].trim()) {
          return { ok: false, motivo: lista + '[' + i + '] no tiene ' + campos[j] };
        }
      }
    }
  }

  var texto = textoDeNarrativa(datos);
  var contenido = validarContenido(texto, perfil);
  if (!contenido.ok) return contenido;
  return validarNivelesCoherentes(texto, perfil);
}

/**
 * La prosa del punto 6, si hay tiempo y el modelo la escribe bien.
 *
 * DEVUELVE null SIN DRAMA. Las tablas, el índice, el riesgo y las alertas del
 * punto 6 son deterministas y ya están calculados cuando esto corre: si la
 * narrativa no sale, la sección se emite igual con el texto armado por reglas.
 * Es la misma decisión que en el punto 5, y por el mismo motivo: el informe no
 * puede depender de un servicio externo.
 *
 * Comparte el plazo con la síntesis, así que en la práctica esto sólo corre si el
 * punto 5 dejó tiempo. Que la sección que ya existe se lleve la prioridad es a
 * propósito.
 *
 * @return {Object} {narrativa: Object|null, motivo: string}
 */
function narrativaDelPuesto(adecuacion, resultados, vencimiento) {
  var propiedades = PropertiesService.getScriptProperties();
  var clave = propiedades.getProperty(PROP_LLM_API_KEY);
  if (!clave) return { narrativa: null, motivo: 'falta la propiedad ' + PROP_LLM_API_KEY };

  var perfil = perfilParaSintesis(resultados);
  var modelos = modelosConfigurados(propiedades);
  var plazo = vencimiento || (new Date().getTime() + LLM_PLAZO_MS);
  var motivos = [];

  for (var i = 0; i < modelos.length; i++) {
    for (var intento = 1; intento <= LLM_INTENTOS; intento++) {
      if (!hayTiempo(plazo)) {
        motivos.push('no quedaba tiempo para pedir la narrativa del punto 6');
        return { narrativa: null, motivo: motivos.join(' | ') };
      }
      try {
        var respuesta = respuestaDelModelo(
          mensajesDeNarrativa(adecuacion, modelos[i]), clave, modelos[i]
        );
        if (!respuesta.datos) {
          motivos.push(modelos[i] + ' → ' + respuesta.motivo);
          continue;
        }
        var revision = validarNarrativa(respuesta.datos, perfil);
        if (!revision.ok) {
          motivos.push(modelos[i] + ' → ' + revision.motivo);
          continue;
        }
        var narrativa = respuesta.datos;
        narrativa.modelo = modelos[i];
        return { narrativa: narrativa, motivo: '' };
      } catch (e) {
        motivos.push(modelos[i] + ' → la llamada se interrumpió: ' + e.message);
      }
    }
  }

  var motivo = motivos.join(' | ');
  console.warn('El punto 6 sale con la prosa determinista (' + motivo + ').');
  return { narrativa: null, motivo: motivo };
}

/**
 * Pone el nombre donde el modelo dejó el marcador.
 * Igual que `ponerNombre` (Sintesis.gs), sobre las listas de esta sección.
 */
function ponerNombreEnNarrativa(narrativa, nombre) {
  if (!narrativa) return narrativa;
  var reemplazar = function (texto) {
    return typeof texto === 'string' ? texto.split(SINTESIS_MARCADOR_NOMBRE).join(nombre) : texto;
  };
  narrativa.lecturaGeneral = reemplazar(narrativa.lecturaGeneral);
  for (var lista in PUESTO_LISTAS) {
    if (!Object.prototype.hasOwnProperty.call(PUESTO_LISTAS, lista)) continue;
    (narrativa[lista] || []).forEach(function (item) {
      PUESTO_LISTAS[lista].forEach(function (campo) {
        item[campo] = reemplazar(item[campo]);
      });
    });
  }
  return narrativa;
}

/**
 * Las competencias del plan de desarrollo que este puesto vuelve prioritarias.
 *
 * Reutiliza el catálogo de la sección 3 (`competenciasConClave`, Perfil.gs) en vez
 * de escribir otro: las acciones de desarrollo son las mismas, lo único que cambia
 * es cuáles se muestran primero. Un catálogo propio acá terminaría recomendando
 * cosas distintas que la sección 3 para la misma brecha.
 *
 * @return {Object} {prioritarias, otras} — filas [competencia, fundamento, acción]
 */
function planDeDesarrolloParaElPuesto(resultados, adecuacion) {
  var competencias = competenciasConClave(
    resultados.neo, resultados.celid.percentil, resultados.camin.percentil,
    resultados.conlid.percentil, adecuacion.perfil
  );

  var exigidas = {};
  adecuacion.filas.forEach(function (f) { exigidas[f.clave] = f.critica ? 2 : 1; });

  var prioritarias = [];
  var otras = [];
  competencias.forEach(function (c) {
    var pesa = 0;
    c.claves.forEach(function (clave) { pesa = Math.max(pesa, exigidas[clave] || 0); });
    if (pesa) prioritarias.push({ peso: pesa, fila: c.fila });
    else otras.push(c.fila);
  });

  prioritarias.sort(function (a, b) { return b.peso - a.peso; });
  return {
    prioritarias: prioritarias.map(function (p) { return p.fila; }),
    otras: otras
  };
}
