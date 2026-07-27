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
  const usados = [...new Set([...js.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]))];
  const huerfanos = usados.filter((u) => !ids.has(u));
  revisar('todos los elementos que busca el script existen en el marcado',
    huerfanos.length === 0, huerfanos.join(', '));

  // Los que se arman concatenando —$('periodo-' + g)— no los ve la búsqueda de
  // arriba, así que van escritos acá uno por uno.
  ['periodo-dia', 'periodo-semana', 'periodo-mes'].forEach((id) => {
    revisar(`el botón ${id} existe`, ids.has(id));
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
