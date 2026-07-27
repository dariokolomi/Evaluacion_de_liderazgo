/**
 * Clasificación del perfil: qué estilo predomina y sobre qué eje.
 *
 * Existe porque el informe lo afirmaba sin mirar el dato. Decía "perfil de
 * liderazgo Transformacional predominante" y "configura un perfil de Líder
 * Relacional-Transformacional" en todos los informes, cualquiera fuera el
 * resultado, y "El estilo Directivo es el menos desarrollado" aunque no lo fuera.
 * Es el primer punto de HU1: prosa con números interpolados que parece derivada
 * del dato y no lo es.
 *
 * La clasificación se calcula y la narración se escribe alrededor. Separar las dos
 * cosas es lo que la hace verificable: una etiqueta es una regla de decisión sobre
 * tres números, que el PO puede revisar y firmar una vez, mientras que una frase
 * redactada no se puede comprobar.
 *
 * DOS DECISIONES QUE EL PO TIENE QUE CONFIRMAR, y por eso están acá arriba y no
 * enterradas en el código:
 *
 *   1. La predominancia se decide comparando las MEDIAS (escala 1 a 5), no los
 *      percentiles. "Predominante" es una lectura del propio perfil —cuál de los
 *      tres estilos ejerce más— y para eso sirve la media. El percentil contesta
 *      otra pregunta: en cuál se destaca más respecto de la población. El informe
 *      viejo imprimía los dos valores y afirmaba con el primero.
 *   2. Los márgenes de abajo son el mínimo para hablar de predominio. Sin margen,
 *      una diferencia de 0,02 se informaría como "predominante", que es precisión
 *      falsa. Los valores son un criterio razonable, NO una norma validada.
 */

// Diferencia mínima entre medias (escala 1-5) para llamar a un estilo predominante.
var MARGEN_PREDOMINANCIA = 0.30;

// Diferencia mínima en puntos de percentil para decir que un eje pesa más que otro.
var MARGEN_EJE = 15;

var ESTILOS_CELID = [
  { clave: 'TransfTot', nombre: 'Transformacional' },
  { clave: 'TransTot', nombre: 'Transaccional' },
  { clave: 'Laissez', nombre: 'Laissez-Faire' }
];

var ESTILOS_CAMIN = [
  { clave: 'Dir', nombre: 'Directivo' },
  { clave: 'Cons', nombre: 'Considerado' },
  { clave: 'Part', nombre: 'Participativo' },
  { clave: 'Or', nombre: 'Orientado a Metas' }
];

/**
 * @param {Object} resultados salida de corregir()
 * @return {Object} {estilos, predominante, mixto, eje, etiqueta, menosDesarrollado}
 *   - estilos: los tres de CELID ordenados de mayor a menor media
 *   - predominante: el primero, o null si ninguno saca ventaja suficiente
 *   - mixto: true cuando los dos primeros están dentro del margen
 *   - eje: 'Relacional' | 'Orientado a la Tarea' | 'Equilibrado'
 *   - etiqueta: cómo nombrar el perfil en el informe
 *   - menosDesarrollado: el estilo de CAMIN-A con el percentil más bajo
 */
function clasificarPerfil(resultados) {
  var medias = resultados.celid.valor;
  var pctCelid = resultados.celid.percentil;

  var estilos = ESTILOS_CELID.map(function (e) {
    return { nombre: e.nombre, media: medias[e.clave], percentil: pctCelid[e.clave] };
  }).sort(function (a, b) { return b.media - a.media; });

  // La diferencia se redondea antes de comparar: en punto flotante 4.8 - 4.5 da
  // 0.2999999999999998 y 4.5 - 4.2 da 0.30000000000000027, así que el mismo margen
  // caería de un lado o del otro según los valores. Redondeado, la regla es
  // determinista y se puede explicar.
  var ventaja = Math.round((estilos[0].media - estilos[1].media) * 100) / 100;
  var mixto = ventaja < MARGEN_PREDOMINANCIA;

  // El eje se decide con percentiles: son de instrumentos distintos y sólo la
  // referencia normativa los hace comparables entre sí.
  var cam = resultados.camin.percentil;
  var con = resultados.conlid.percentil;
  var relacional = promedio([cam.Cons, cam.Part, con.Rel]);
  var tarea = promedio([cam.Dir, con.Tar]);
  var eje = 'Equilibrado';
  if (relacional - tarea >= MARGEN_EJE) eje = 'Relacional';
  else if (tarea - relacional >= MARGEN_EJE) eje = 'Orientado a la Tarea';

  var menos = ESTILOS_CAMIN.map(function (e) {
    return { nombre: e.nombre, percentil: cam[e.clave] };
  }).sort(function (a, b) { return a.percentil - b.percentil; })[0];

  return {
    estilos: estilos,
    predominante: mixto ? null : estilos[0],
    mixto: mixto,
    eje: eje,
    etiqueta: etiquetaDePerfil(eje, mixto ? null : estilos[0]),
    menosDesarrollado: menos,
    ejeRelacional: relacional,
    ejeTarea: tarea
  };
}

/**
 * Cómo se nombra el perfil en el informe.
 * Sin estilo predominante no se inventa uno: se dice que es mixto, que es la
 * lectura honesta cuando los tres valores están cerca.
 */
function etiquetaDePerfil(eje, predominante) {
  if (!predominante) return 'Líder ' + eje + ', sin un estilo claramente predominante';
  if (eje === 'Equilibrado') return 'Líder ' + predominante.nombre;
  return 'Líder ' + eje + '-' + predominante.nombre;
}

function promedio(valores) {
  var suma = 0;
  for (var i = 0; i < valores.length; i++) suma += valores[i];
  return suma / valores.length;
}

/**
 * La primera frase de 2.2: qué estilo predomina y en qué orden quedan los tres.
 * Reemplaza a la que afirmaba "Transformacional predominante" siempre.
 */
function frasePerfilCelid(perfil) {
  var conValores = function (e) {
    return e.nombre + ' (' + e.media.toFixed(2) + ' / P' + e.percentil + ')';
  };
  if (perfil.mixto) {
    return 'La persona evaluada no muestra un estilo de liderazgo claramente '
      + 'predominante: ' + conValores(perfil.estilos[0]) + ', '
      + conValores(perfil.estilos[1]) + ' y ' + conValores(perfil.estilos[2])
      + ' quedan en valores cercanos entre sí.';
  }
  return 'La persona evaluada muestra un perfil de liderazgo '
    + perfil.estilos[0].nombre + ' predominante ('
    + perfil.estilos[0].media.toFixed(2) + ' / P' + perfil.estilos[0].percentil
    + '), seguido por ' + conValores(perfil.estilos[1])
    + ' y ' + conValores(perfil.estilos[2]) + '.';
}

/**
 * La frase del modelo situacional en la sección 3.
 * La versión anterior daba por sentado que el Considerado y el Participativo
 * estaban altos, que las Metas eran una buena disposición y que el Directivo era
 * el menos desarrollado. Ahora las tres cosas salen del dato.
 */
function fraseSituacional(perfil, cam) {
  var solventes = ESTILOS_CAMIN.filter(function (e) {
    return nivelPorPercentil(cam[e.clave]) === 'Alto';
  }).map(function (e) { return e.nombre; });

  var texto = 'En términos del modelo Situacional (Hersey & Blanchard) y Camino-Meta (House), ';
  texto += solventes.length
    ? 'maneja con solvencia ' + (solventes.length === 1 ? 'el estilo ' : 'los estilos ')
      + enumerar(solventes) + '. '
    : 'no muestra un estilo que domine con claridad por encima de la media. ';
  texto += 'El estilo ' + perfil.menosDesarrollado.nombre + ' (P'
    + perfil.menosDesarrollado.percentil + ') es el menos desarrollado y el área de '
    + 'mayor crecimiento potencial.';
  return texto;
}

/** "a", "a y b", "a, b y c" */
function enumerar(items) {
  if (items.length <= 1) return items[0] || '';
  return items.slice(0, -1).join(', ') + ' y ' + items[items.length - 1];
}
