/**
 * DocumentApp simulado, del tamaño justo para correr Documento.gs en Node.
 *
 * No dibuja nada: registra la estructura que se le va pidiendo (párrafos con
 * sus tramos de texto y formato, tablas con sombreado, saltos e imágenes) en
 * el mismo formato en que dump-docx.py describe el informe que genera Python.
 * Así las dos versiones se pueden comparar bloque a bloque.
 *
 * Sólo implementa lo que Documento.gs usa. Si el port empieza a usar algo más,
 * acá va a fallar con "no es una función", que es exactamente lo que se busca:
 * enterarse antes de subirlo.
 */
'use strict';

class Texto {
  /** `heredado` es el formato del tramo anterior del párrafo. Ver appendText. */
  constructor(texto, heredado) {
    const h = heredado || {};
    this.texto = texto;
    // Se hereda la negrita y la cursiva, que son las que se ven. El tamaño y el
    // color también se heredan en Docs, pero no se modelan: el único lugar donde
    // pasa es un rótulo de 11 pt seguido de texto normal, y 11 pt es el default
    // del documento, así que en la página no hay diferencia y modelarlo sólo haría
    // que la comparación contra Python marque algo que no existe. Si algún día un
    // rótulo de otro tamaño arrastra al texto que le sigue, se extiende acá.
    this.negrita = h.negrita !== undefined ? h.negrita : null;
    this.cursiva = h.cursiva !== undefined ? h.cursiva : null;
    this.tamano = null;
    this.color = null;
  }
  setBold(v) { this.negrita = v; return this; }
  setItalic(v) { this.cursiva = v; return this; }
  setFontSize(v) { this.tamano = v; return this; }
  setForegroundColor(v) { this.color = v; return this; }
}

class Parrafo {
  constructor() {
    this.tipo = 'parrafo';
    this.centrado = false;
    this.sangria = null;
    this.tramos = [];
  }
  /**
   * En Docs, un tramo nuevo NACE con el formato del anterior del mismo párrafo:
   * appendText no arranca limpio. Se modela acá porque el stub que no lo modelaba
   * dejó pasar un bug que se veía en todos los informes —después de un tramo en
   * negrita, el resto del párrafo salía en negrita— y la comparación contra Python
   * no lo detectaba. Un stub más permisivo que la API real vuelve verde un test que
   * debería estar rojo.
   */
  appendText(texto) {
    const anterior = this.tramos[this.tramos.length - 1];
    const t = new Texto(texto, anterior);
    this.tramos.push(t);
    return t;
  }
  setAlignment(alineacion) {
    this.centrado = alineacion === 'CENTER';
    return this;
  }
  setIndentStart(puntos) { this.sangria = puntos; return this; }
}

class Celda {
  constructor(texto) {
    this.texto = texto;
    this.negrita = null;
    this.tamano = null;
    this.color = null;
    this.fondo = null;
  }
  setBackgroundColor(color) { this.fondo = color; return this; }
  /** En Docs esto devuelve el texto entero de la celda como un solo tramo. */
  editAsText() {
    const celda = this;
    return {
      setBold(v) { celda.negrita = v; return this; },
      setFontSize(v) { celda.tamano = v; return this; },
      setForegroundColor(v) { celda.color = v; return this; },
    };
  }
  /** La celda es un solo párrafo; alcanza para que centrarCelda() funcione. */
  getNumChildren() { return 1; }
  getChild() {
    const celda = this;
    return {
      getType: () => 'PARAGRAPH',
      asParagraph: () => ({
        setAlignment(alineacion) { celda.centrado = alineacion === 'CENTER'; return this; },
      }),
    };
  }
}

class Tabla {
  constructor(matriz) {
    this.tipo = 'tabla';
    this.filas = matriz.map((fila) => fila.map((texto) => new Celda(texto)));
  }
  getCell(fila, columna) {
    if (!this.filas[fila] || !this.filas[fila][columna]) {
      throw new Error(`La tabla no tiene celda (${fila}, ${columna})`);
    }
    return this.filas[fila][columna];
  }
}

class Imagen {
  constructor(dimensiones) {
    this.tipo = 'imagen';
    this.ancho = dimensiones.ancho;
    this.alto = dimensiones.alto;
  }
  getWidth() { return this.ancho; }
  getHeight() { return this.alto; }
  setWidth(v) { this.ancho = v; return this; }
  setHeight(v) { this.alto = v; return this; }
}

class Body {
  constructor(conParrafoInicial) {
    this.bloques = [];
    if (conParrafoInicial) this.appendParagraph('');
  }
  /** Como en Docs: vaciar el cuerpo deja un párrafo vacío, no cero elementos. */
  clear() {
    this.bloques = [new Parrafo()];
    return this;
  }
  // Como un Doc nuevo: Carta (612 pt) con márgenes de 72 pt → 468 pt útiles.
  getPageWidth() { return 612; }
  getMarginLeft() { return 72; }
  getMarginRight() { return 72; }
  getNumChildren() { return this.bloques.length; }
  getChild(indice) {
    const bloque = this.bloques[indice];
    const body = this;
    const quitar = () => { body.bloques.splice(body.bloques.indexOf(bloque), 1); };
    return {
      getType: () => (bloque.tipo === 'parrafo' ? 'PARAGRAPH' : bloque.tipo.toUpperCase()),
      removeFromParent: quitar,
      asParagraph: () => ({
        getText: () => (bloque.tramos || []).map((t) => t.texto).join(''),
        removeFromParent: quitar,
      }),
    };
  }
  appendParagraph() {
    const p = new Parrafo();
    this.bloques.push(p);
    return p;
  }
  appendTable(matriz) {
    const t = new Tabla(matriz);
    this.bloques.push(t);
    return t;
  }
  appendPageBreak() {
    const salto = { tipo: 'salto' };
    this.bloques.push(salto);
    return salto;
  }
  /** El "blob" acá es sólo el tamaño natural de la imagen. */
  appendImage(blob) {
    const img = new Imagen(blob);
    this.bloques.push(img);
    return img;
  }
}

const DocumentApp = {
  HorizontalAlignment: { CENTER: 'CENTER', LEFT: 'LEFT', RIGHT: 'RIGHT', JUSTIFY: 'JUSTIFY' },
  ElementType: { PARAGRAPH: 'PARAGRAPH', TABLE: 'TABLE', INLINE_IMAGE: 'INLINE_IMAGE' },
};

/** Deja la estructura en el mismo formato que produce dump-docx.py. */
function normalizar(bloques) {
  return bloques.map((b) => {
    if (b.tipo === 'salto') return { tipo: 'salto' };
    if (b.tipo === 'imagen') return { tipo: 'imagen', ancho: b.ancho, alto: b.alto };
    if (b.tipo === 'tabla') {
      return {
        tipo: 'tabla',
        filas: b.filas.map((fila) => fila.map((c) => ({
          texto: c.texto,
          negrita: !!c.negrita,
          tamano: c.tamano === null ? null : c.tamano,
          color: c.color,
          fondo: c.fondo,
        }))),
      };
    }
    return {
      tipo: 'parrafo',
      centrado: !!b.centrado,
      sangria: b.sangria === null ? null : Math.round(b.sangria * 100) / 100,
      tramos: b.tramos.map((t) => ({
        texto: t.texto,
        negrita: !!t.negrita,
        cursiva: !!t.cursiva,
        tamano: t.tamano === null ? null : t.tamano,
        color: t.color,
      })),
    };
  });
}

module.exports = { DocumentApp, Body, normalizar };
