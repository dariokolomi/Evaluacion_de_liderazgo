/**
 * Verificación diferencial del armado del informe.
 *
 * Corre Documento.gs contra un DocumentApp simulado y compara la estructura
 * resultante, bloque por bloque, con la del .docx que genera el motor Python:
 * mismo orden de párrafos y tablas, mismo texto en cada tramo, mismo formato,
 * mismo sombreado de celdas.
 *
 * Uso:  python3 dump-docx.py && node verificar-documento.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { DocumentApp, Body, normalizar } = require('./stub-documentapp');

const RAIZ = path.resolve(__dirname, '..');
const DOCUMENTO = path.join(__dirname, 'documento-python.json');

const MAX_DIFERENCIAS = 12;

function cargarGs() {
  const fuente = ['Correccion.gs', 'Textos.gs', 'Documento.gs']
    .map((a) => fs.readFileSync(path.join(RAIZ, a), 'utf8'))
    .join('\n');
  return new Function('DocumentApp', `${fuente}\nreturn { corregir, construirInforme };`)(DocumentApp);
}

/** La fecha y el tamaño natural del radar salen del informe de Python:
 *  compararlos contra sí mismos no probaría nada, pero fijarlos evita
 *  diferencias espurias por la fecha del día o por el tamaño del PNG. */
function contextoDe(bloques) {
  const portada = bloques.find((b) => b.tipo === 'tabla');
  const imagen = bloques.find((b) => b.tipo === 'imagen');
  return {
    fecha: portada.filas[0][1].texto,
    radar: { ancho: imagen.ancho, alto: imagen.alto },
  };
}

function comparar(ruta, esperado, obtenido, diferencias) {
  if (diferencias.length >= MAX_DIFERENCIAS) return;
  const tipoE = Array.isArray(esperado) ? 'array' : typeof esperado;
  const tipoO = Array.isArray(obtenido) ? 'array' : typeof obtenido;

  if (tipoE === 'array' || tipoO === 'array') {
    if (tipoE !== tipoO) {
      diferencias.push(`${ruta}: python=${JSON.stringify(esperado)} js=${JSON.stringify(obtenido)}`);
      return;
    }
    if (esperado.length !== obtenido.length) {
      diferencias.push(`${ruta}: python tiene ${esperado.length} elemento(s), js tiene ${obtenido.length}`);
    }
    for (let i = 0; i < Math.max(esperado.length, obtenido.length); i++) {
      comparar(`${ruta}[${i}]`, esperado[i], obtenido[i], diferencias);
    }
    return;
  }
  if (esperado && obtenido && tipoE === 'object' && tipoO === 'object') {
    const claves = new Set([...Object.keys(esperado), ...Object.keys(obtenido)]);
    for (const clave of claves) comparar(`${ruta}.${clave}`, esperado[clave], obtenido[clave], diferencias);
    return;
  }
  if (typeof esperado === 'number' && typeof obtenido === 'number') {
    if (Math.abs(esperado - obtenido) > 0.51) {
      diferencias.push(`${ruta}: python=${esperado} js=${obtenido}`);
    }
    return;
  }
  if (esperado !== obtenido) {
    diferencias.push(`${ruta}: python=${JSON.stringify(esperado)} js=${JSON.stringify(obtenido)}`);
  }
}

/** Describe un bloque en una línea, para que el diff se pueda ubicar. */
function resumir(bloque) {
  if (!bloque) return '(no existe)';
  if (bloque.tipo === 'salto') return 'salto de página';
  if (bloque.tipo === 'imagen') return `imagen ${bloque.ancho}×${bloque.alto}`;
  if (bloque.tipo === 'tabla') return `tabla de ${bloque.filas.length} filas: "${bloque.filas[0][0].texto}"`;
  const texto = bloque.tramos.map((t) => t.texto).join('');
  return texto ? `párrafo: "${texto.slice(0, 60)}${texto.length > 60 ? '…' : ''}"` : 'párrafo vacío';
}

function main() {
  if (!fs.existsSync(DOCUMENTO)) {
    console.error(`Falta ${path.basename(DOCUMENTO)}. Correr primero: python3 dump-docx.py`);
    return 1;
  }

  const { corregir, construirInforme } = cargarGs();
  const informes = JSON.parse(fs.readFileSync(DOCUMENTO, 'utf8'));

  let fallados = 0;
  for (const informe of informes) {
    const respuestas = informe.respuestas;
    const { fecha, radar } = contextoDe(informe.bloques);
    const body = new Body();
    construirInforme(body, {
      nombre: informe.nombre,
      fecha,
      resultados: corregir(respuestas),
      imagenRadar: radar,
    });
    const obtenido = normalizar(body.bloques);
    const esperado = informe.bloques;

    const diferencias = [];
    if (esperado.length !== obtenido.length) {
      diferencias.push(`cantidad de bloques: python=${esperado.length} js=${obtenido.length}`);
    }
    for (let i = 0; i < Math.min(esperado.length, obtenido.length); i++) {
      const antes = diferencias.length;
      // El radar ahora ocupa el ancho útil de la página, así que sus dimensiones
      // ya no coinciden con el PNG de Python a propósito: se verifica que haya
      // una imagen, no su tamaño.
      if (esperado[i] && esperado[i].tipo === 'imagen') {
        if (!obtenido[i] || obtenido[i].tipo !== 'imagen') {
          diferencias.push(`bloque[${i}]: se esperaba una imagen, js=${resumir(obtenido[i])}`);
        }
        continue;
      }
      comparar(`bloque[${i}]`, esperado[i], obtenido[i], diferencias);
      if (diferencias.length > antes) {
        diferencias.splice(antes, 0, `  ↳ ${resumir(esperado[i])}`);
      }
      if (diferencias.length >= MAX_DIFERENCIAS) {
        diferencias.push('… (se corta acá)');
        break;
      }
    }

    if (diferencias.length) {
      fallados++;
      console.log(`✗ ${informe.nombre} (${esperado.length} bloques)`);
      diferencias.forEach((d) => console.log(`    ${d}`));
    } else {
      const tablas = esperado.filter((b) => b.tipo === 'tabla').length;
      console.log(`✓ ${informe.nombre}: ${esperado.length} bloques idénticos (${tablas} tablas)`);
    }
  }

  console.log(`\n${informes.length - fallados}/${informes.length} informes coinciden`);
  return fallados ? 1 : 0;
}

process.exit(main());
