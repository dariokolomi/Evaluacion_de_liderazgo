/**
 * Verificación de la interfaz (Interfaz.html).
 *
 * El HTML no tenía ninguna verificación, y es donde más barato sale romper algo
 * sin enterarse: `document.getElementById('kpi-periodo-actual')` devuelve null si
 * nadie escribió ese id en el marcado, y null no lanza hasta que se le pide una
 * propiedad. Un tablero puede quedar a medio dibujar sin un solo error en la
 * consola.
 *
 * Acá no se simula un navegador: se lee el archivo y se comprueban las
 * correspondencias que el navegador daría por sentadas.
 *
 * Uso:  node verificar-interfaz.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');

function main() {
  const html = fs.readFileSync(path.join(RAIZ, 'Interfaz.html'), 'utf8');
  const revisiones = [];
  const revisar = (nombre, ok, detalle) => revisiones.push([nombre, ok, detalle]);

  const partes = html.split('<script>');
  const marcado = partes[0];
  const js = partes[1].split('</script>')[0];

  // ── Cada $('id') tiene su id en el marcado ──
  const ids = new Set([...marcado.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  // El panel de generación busca sus elementos con $$('base'), que resuelve a
  // 'base' + el sufijo del panel. Los dos usos se separan acá: un $ se resuelve
  // tal cual, un $$ hay que resolverlo con cada sufijo.
  const usados = [...new Set([...js.matchAll(/(?<!\$)\$\('([^']+)'\)/g)].map((m) => m[1]))];
  const huerfanos = usados.filter((u) => !ids.has(u));
  revisar('todos los elementos que busca el script existen en el marcado',
    huerfanos.length === 0, huerfanos.join(', '));

  // El cuerpo de crearPanel corre para los dos paneles, así que cada elemento
  // que busca tiene que existir en los dos. Es lo que se rompe al agregarle un
  // campo a uno solo: el panel al que le falta devuelve null y nadie se entera
  // hasta que alguien lo toca.
  const cuerpoDelPanel = js.slice(js.indexOf('function crearPanel(config)'),
    js.indexOf('/** 72.4 →'));
  const enElCuerpo = [...new Set([...cuerpoDelPanel.matchAll(/\$\$\('([^']+)'\)/g)]
    .map((m) => m[1]))];
  const sinPareja = enElCuerpo.filter((u) => !ids.has(u) || !ids.has(u + '2'));
  revisar('cada elemento que busca crearPanel existe en los dos paneles',
    sinPareja.length === 0, sinPareja.join(', '));

  // Y lo que cada panel busca en SU configuración —los campos propios de ese
  // modelo, como la gerencia y el sector del Informe 2— existe con su sufijo.
  const configuraciones = js.split('crearPanel({').slice(1);
  const propiosHuerfanos = [];
  configuraciones.forEach((bloque) => {
    const sufijo = (bloque.match(/sufijo: '([^']*)'/) || [null, ''])[1];
    [...bloque.matchAll(/\$\$\('([^']+)'\)/g)].forEach((m) => {
      if (!ids.has(m[1] + sufijo)) propiosHuerfanos.push(m[1] + sufijo);
    });
  });
  revisar('y los campos propios de cada modelo existen en su panel',
    propiosHuerfanos.length === 0, propiosHuerfanos.join(', '));

  // Los que se arman concatenando —$('periodo-' + g), $('vista-' + v)— no los ve
  // la búsqueda de arriba, así que van escritos acá uno por uno.
  ['periodo-dia', 'periodo-semana', 'periodo-mes'].forEach((id) => {
    revisar(`el botón ${id} existe`, ids.has(id));
  });
  ['informes', 'informes2', 'metricas'].forEach((vista) => {
    revisar(`la solapa ${vista} tiene su botón y su panel`,
      ids.has('tab-' + vista) && ids.has('vista-' + vista));
  });

  // ── Subida de planillas ──
  revisar('hay un botón para subir una planilla', ids.has('subir'));
  revisar('y el input de archivo que dispara', ids.has('archivo'));
  revisar('el input de archivo va escondido: lo abre el botón',
    /id="archivo"[^>]*class="oculto"/.test(marcado));
  revisar('y limita la elección a planillas',
    /id="archivo"[^>]*accept="\.xlsx,\.xls"/.test(marcado));
  revisar('el botón de subir es secundario: la acción principal sigue siendo generar',
    /id="subir"[^>]*class="secundario chico"/.test(marcado));
  revisar('generar es el único botón principal del panel',
    (marcado.match(/<button id="generar"(?![^>]*class=)/) || []).length === 1);
  revisar('el input se limpia después de elegir, para poder subir dos veces el mismo archivo',
    /evento\.target\.value = ''/.test(js));
  revisar('mientras sube, generar queda bloqueado',
    /function subiendo\(activo\)[\s\S]{0,400}\$\('generar'\)\.disabled = activo/.test(js));
  revisar('al servidor va el base64 sin el prefijo data:',
    /String\(lector\.result\)\.split\(','\)\[1\]/.test(js));

  // ── Subida del perfil de puesto ──
  revisar('hay un botón para subir el perfil de puesto', ids.has('subir-puesto'));
  revisar('y su propio input de archivo', ids.has('archivo-puesto'));
  revisar('el input del perfil también va escondido detrás de su botón',
    /id="archivo-puesto"[^>]*class="oculto"/.test(marcado));
  revisar('y limita la elección a documentos, no a planillas',
    /id="archivo-puesto"[^>]*accept="\.pdf,\.docx,\.doc"/.test(marcado));
  revisar('el perfil de puesto se anuncia como opcional: sin él el informe sale igual',
    /Perfil de puesto[\s\S]{0,120}\(opcional\)/.test(marcado));
  revisar('mientras se lee el perfil, generar queda bloqueado',
    /function subiendoPuesto\(activo\)[\s\S]{0,400}\$\('generar'\)\.disabled = activo/.test(js));
  revisar('lo que el sistema entendió del puesto se muestra antes de generar',
    ids.has('puesto-elegido')
    && /exigencia\(s\) reconocidas/.test(js));
  revisar('y también lo que descartó, que es lo que después sale como alerta',
    /Sin usar, porque el documento no las sostiene/.test(js));
  revisar('la lectura del puesto viaja en el pedido de generación',
    /const pedido = Object\.assign\(\{[\s\S]{0,500}puesto: puestoElegido/.test(js));
  revisar('y se limpia al terminar: es de esta evaluación, no de la próxima',
    /puestoElegido = null;[\s\S]{0,80}mostrarPuestoElegido\(\);[\s\S]{0,60}cargarHistorial\(\)/.test(js));
  revisar('el historial muestra el código de cada evaluación',
    /<th>Código<\/th>/.test(marcado) && /corrida\.codigo/.test(js));
  // El dato viajaba hasta el Sheet y se perdía en el borde del servidor: una
  // corrida contra un perfil de puesto y una sin perfil se veían iguales.
  revisar('y con qué perfil de puesto se contrastó, si hubo alguno',
    /<th>Perfil de puesto<\/th>/.test(marcado) && /corrida\.perfilPuesto/.test(js));
  revisar('el nombre completo del perfil queda en el title, que es lo que se recorta',
    /tdPerfil\.title = corrida\.perfilPuesto/.test(js));
  // Un colspan corto deja la fila de "no hay nada" sin cubrir la última columna.
  const columnasHistorial = (marcado.split('<tbody id="historial"')[0]
    .split('<table>').pop().match(/<th>/g) || []).length;
  revisar('las filas de aviso del historial cubren las ocho columnas',
    columnasHistorial === 8
    && (js.match(/fila\(\[[^\]]*\], 'vacio', 8\)/g) || []).length === 2
    && !/'vacio', 7\)/.test(js));

  // ── Las dos solapas de generación ──
  revisar('la solapa del Informe 2 se llama por su modelo, no "informes"',
    /id="tab-informes2"[^>]*>Informe 2</.test(marcado)
    && /id="tab-informes"[^>]*>Informe 1</.test(marcado));
  revisar('cada solapa dice qué informe genera antes de que haya que elegir',
    (marcado.match(/class="ayuda descripcion-modelo"/g) || []).length === 2);
  revisar('el Informe 2 pide la gerencia y el sector',
    ids.has('gerencia2') && ids.has('sector2'));
  revisar('y no deja generar sin ellos: se avisa antes de arrancar la corrida',
    /if \(!gerencia\) return \{ error: /.test(js) && /if \(!sector\) return \{ error: /.test(js));
  revisar('los dos campos viajan en el pedido',
    /valores: \{ gerencia: gerencia, sector: sector \}/.test(js));
  revisar('y se limpian al terminar, como el nombre',
    /limpiarExtra: \(\$\$\) => \{[\s\S]{0,120}\$\$\('gerencia'\)\.value = ''/.test(js));
  revisar('cada panel le habla a su propia función del servidor',
    /metodo: 'generarDesdeInterfaz'/.test(js)
    && /metodo: 'generarInforme2DesdeInterfaz'/.test(js));
  revisar('y usa su propia lista de etapas, que viene del servidor',
    /etapas: <\?!= etapasJson \?>/.test(js) && /etapas: <\?!= etapas2Json \?>/.test(js));
  revisar('el panel de generación está escrito una sola vez y se instancia dos',
    (js.match(/crearPanel\(\{/g) || []).length === 2
    && (js.match(/function crearPanel\(config\)/g) || []).length === 1);
  revisar('el historial se ve desde las dos solapas de generación',
    ids.has('vista-historial')
    && /\$\('vista-historial'\)\.classList\.toggle\('oculto', cual === 'metricas'\)/.test(js));
  revisar('el historial dice con qué modelo se generó cada informe',
    /<th>Modelo<\/th>/.test(marcado) && /corrida\.modelo/.test(js));
  revisar('generar sigue siendo el único botón principal del panel del Informe 2',
    (marcado.match(/<button id="generar2"(?![^>]*class=)/) || []).length === 1);
  // La subida es la única fuente de planilla: no hay desplegable ni se le pide
  // al servidor la lista de la carpeta.
  revisar('no hay un desplegable para elegir entre las planillas de la carpeta',
    !/<select id="planilla"/.test(marcado) && !/listarPlanillas/.test(js));
  revisar('el nombre de la planilla cargada queda a la vista',
    ids.has('planilla-elegida'));
  revisar('generar arranca bloqueado y sólo se abre con una planilla cargada',
    /<button id="generar" disabled>/.test(marcado)
    && /\$\('generar'\)\.disabled = activo \|\| !planillaElegida/.test(js));
  revisar('el informe se genera con la planilla subida',
    /const planillaId = planillaElegida \? planillaElegida\.id : ''/.test(js));

  // ── Período del tablero ──
  revisar('el tablero arranca en la semana',
    /let granularidad = 'semana'/.test(js));
  revisar('y el botón de semana es el que figura elegido',
    /id="periodo-semana" aria-pressed="true"/.test(marcado));
  revisar('los otros dos arrancan sin elegir',
    /id="periodo-dia" aria-pressed="false"/.test(marcado)
    && /id="periodo-mes" aria-pressed="false"/.test(marcado));
  revisar('cambiar de período no vuelve a pedirle datos al servidor',
    /function elegirPeriodo[\s\S]{0,260}dibujarPeriodo\(\)/.test(js)
    && !/function elegirPeriodo[\s\S]{0,260}google\.script\.run/.test(js));
  revisar('el selector de período está agrupado y rotulado para el lector de pantalla',
    /role="group" aria-label="Período"/.test(marcado));

  // ── Uso por persona ──
  revisar('la tabla de uso por persona existe', ids.has('por-usuario'));
  revisar('y tiene las seis columnas que dibuja el script',
    (marcado.split('<tbody id="por-usuario"')[0].split('<table>').pop().match(/<th>/g) || []).length === 6);

  let fallados = 0;
  for (const [nombre, ok, detalle] of revisiones) {
    console.log(`  ${ok ? '✓' : '✗'} ${nombre}`);
    if (!ok) {
      fallados++;
      if (detalle) console.log(`      obtenido: ${detalle}`);
    }
  }
  console.log(fallados
    ? `\n${fallados} de ${revisiones.length} verificaciones fallaron`
    : `\nInterfaz verificada (${revisiones.length} verificaciones)`);
  return fallados ? 1 : 0;
}

process.exit(main());
