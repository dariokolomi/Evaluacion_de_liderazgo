/**
 * Orquestador del Informe 2: de la planilla de respuestas al informe en Drive.
 *
 * Es el gemelo de `generarInforme` (Informe.gs) para el otro modelo de informe.
 * Están separados a propósito y no unificados detrás de un parámetro: los dos
 * flujos difieren en qué se calcula, en qué se le pide al modelo, en qué etapas
 * se anuncian y en qué se guarda. Un solo orquestador con `if (modelo === 2)`
 * adentro terminaría siendo dos funciones entreveradas, y tocar una rompería la
 * otra — que es exactamente lo que hay que poder evitar mientras los dos modelos
 * conviven.
 *
 * Lo que SÍ se comparte, porque es lo mismo y tiene que seguir siéndolo:
 * abrir la planilla (`abrirComoPlanilla`), corregirla (`corregir`), reservar el
 * código de la evaluación, exportar a .docx (`guardarComoDocx`), renombrar los
 * insumos y registrar la corrida.
 *
 * QUÉ NO HACE ESTE FLUJO Y EL OTRO SÍ: el gráfico de radar. El modelo 2 no lo
 * tiene, así que no se arma. Son unos segundos menos y, sobre todo, una llamada
 * menos a los servicios de Google adentro de los seis minutos.
 */

/**
 * Genera el Informe 2 de una persona evaluada.
 *
 * @param {Object} pedido {planillaId, nombreEvaluado, gerencia, sector, token, puesto}
 *   `gerencia` y `sector` los escribe quien genera el informe y salen impresos
 *   en el encabezado; `puesto` es lo que devolvió `subirPerfilDePuesto` y es
 *   OPCIONAL, aunque sin él no hay índice de adecuación ni matriz de ajuste.
 * @return {Object} {informeId, informeUrl, nombreArchivo, codigo, evaluado, segundos}
 */
function generarInforme2(pedido) {
  var inicio = new Date();
  var config = configuracion();
  exigirAcceso(config.grupoAutorizado);

  var nombre = ((pedido && pedido.nombreEvaluado) || '').trim();
  if (!pedido || !pedido.planillaId) {
    throw new Error('Falta indicar la planilla de respuestas.');
  }
  if (!nombre) {
    throw new Error('Falta el nombre de la persona evaluada.');
  }

  var gerencia = ((pedido && pedido.gerencia) || '').trim();
  var sector = ((pedido && pedido.sector) || '').trim();
  if (!gerencia) throw new Error('Falta la gerencia.');
  if (!sector) throw new Error('Falta el sector.');

  var token = (pedido && pedido.token) || '';
  var lecturaDePuesto = sanearLecturaDePuesto(pedido && pedido.puesto);

  var temporales = [];
  try {
    marcarEtapa2(token, 0);
    var planilla = abrirComoPlanilla(pedido.planillaId, temporales);

    marcarEtapa2(token, 1);
    var resultados = corregir(leerPlanilla(planilla.libro));

    // El contraste con el puesto va ANTES de la redacción, al revés que en el
    // Informe 1: acá el índice, la cobertura y el riesgo son parte de lo que se
    // le pasa al modelo para que escriba el diagnóstico, no una sección que se
    // agrega al final.
    marcarEtapa2(token, 2);
    var adecuacion = lecturaDePuesto
      ? adecuacionAlPuesto(lecturaDePuesto, resultados)
      : null;

    var contexto = {
      puesto: (adecuacion && adecuacion.puesto) || '',
      gerencia: gerencia,
      sector: sector
    };

    // El plazo del LLM se abre acá. A diferencia del Informe 1, no hay que
    // repartirlo con la narrativa del punto 6: los cuatro bloques del Informe 2
    // son lo único que llama al modelo en esta corrida.
    var vencimiento = new Date().getTime() + LLM_PLAZO_MS;

    marcarEtapa2(token, 3);
    var intento = sintesisDelInforme2(nombre, resultados, adecuacion, contexto,
      null, vencimiento);
    // Si el modelo no pudo, el informe sale igual con el texto armado por reglas.
    // Las dos síntesis tienen la misma forma, así que el armado no cambia.
    var sintesis = intento.sintesis
      || sintesis2Determinista(resultados, adecuacion, contexto);

    marcarEtapa2(token, 4);
    var codigo = reservarCodigo(config.historialId);
    var nombreArchivo = nombreDeInforme2(codigo, nombre, inicio);
    var doc = DocumentApp.create(nombreArchivo);
    temporales.push(doc.getId());

    var cuerpo = doc.getBody();
    cuerpo.clear();
    construirInforme2(cuerpo, {
      nombre: nombre,
      fecha: Utilities.formatDate(inicio, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
      puesto: contexto.puesto,
      gerencia: gerencia,
      sector: sector,
      resultados: resultados,
      sintesis: sintesis,
      adecuacion: adecuacion
    });
    quitarParrafoInicialVacio(cuerpo);
    doc.saveAndClose();

    marcarEtapa2(token, 5);
    var archivo = guardarComoDocx(doc.getId(), nombreArchivo, config.carpetaInformesId);

    var nombrePlanilla = renombrarInsumo(pedido.planillaId, codigo, 'PLANILLA', nombre);
    var nombrePerfil = lecturaDePuesto
      ? renombrarInsumo(lecturaDePuesto.id, codigo, 'PERFIL',
          lecturaDePuesto.puesto || lecturaDePuesto.nombre)
      : '';

    var segundos = Math.round((new Date().getTime() - inicio.getTime()) / 100) / 10;

    registrarCorrida(config.historialId, {
      fecha: inicio,
      evaluado: nombre,
      planilla: nombrePlanilla || planilla.nombre,
      informeUrl: archivo.getUrl(),
      usuario: usuarioActual(),
      segundos: segundos,
      codigo: codigo,
      perfilPuesto: nombrePerfil,
      // Sin esto, una corrida del Informe 1 y una del Informe 2 se ven idénticas
      // en el historial y no hay forma de saber cuál generó cada archivo.
      modelo: MODELO_INFORME_2,
      gerencia: gerencia,
      sector: sector
    });

    return {
      informeId: archivo.getId(),
      informeUrl: archivo.getUrl(),
      nombreArchivo: nombreArchivo + '.docx',
      codigo: codigo,
      evaluado: nombre,
      segundos: segundos,
      sintesisAsistida: !!intento.sintesis,
      sintesisMotivo: intento.motivo,
      conPuesto: !!adecuacion,
      adecuacion: adecuacion ? adecuacion.porcentaje : null
    };
  } finally {
    descartarTemporales(temporales);
    limpiarProgreso(token);
  }
}

/**
 * A01-INFORME2 Ana Pérez 20260812-1815
 *
 * Mismo formato que el del Informe 1 con el modelo pegado a la palabra INFORME:
 * los archivos de una evaluación se siguen agrupando por el código al ordenar la
 * carpeta por nombre, y de un vistazo se ve cuál de los dos modelos es.
 */
function nombreDeInforme2(codigo, nombre, momento) {
  var sello = Utilities.formatDate(momento, Session.getScriptTimeZone(), 'yyyyMMdd-HHmm');
  return codigo + '-INFORME2 ' + nombre + ' ' + sello;
}
