// Extractor mínimo de texto de PDFs, para leer en el navegador (sin subir nada al
// servidor y sin depender de pdf.js) los PDFs simples que genera el SIU Guaraní:
// texto en fuentes estándar (WinAnsi), streams comprimidos con FlateDecode y
// cada celda dibujada con su posición (`x y Td (texto) Tj`).
//
// Devuelve una lista de ítems { page, x, y, str } en coordenadas de la página
// (y crece hacia arriba, como en el PDF). Agruparlos en filas/columnas es tarea
// de quien lo usa (ver siuImport.js).
//
// No pretende ser un parser de PDF completo: no entiende fuentes con CMaps
// propios (Type0/Identity-H), cifrado ni streams de objetos para las páginas
// (en ese caso cae a leer los streams en el orden del archivo).

const latin1 = new TextDecoder('latin1');
const winAnsi = new TextDecoder('windows-1252');

// --- Lectura del archivo ---

function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new TypeError('Se esperaba el contenido del PDF como bytes');
}

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Objetos "N G obj ... endobj" con su diccionario y, si tiene, el stream crudo.
// Se trabaja sobre el PDF decodificado como latin1 (1 byte = 1 carácter), así
// los índices del string coinciden con los de los bytes.
function readObjects(bytes) {
  const text = latin1.decode(bytes);
  const objects = new Map();
  const order = [];
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(text))) {
    const num = Number(m[1]);
    const start = re.lastIndex;
    const streamIdx = text.indexOf('stream', start);
    const endObjIdx = text.indexOf('endobj', start);
    if (endObjIdx < 0) break;
    let dict = text.slice(start, endObjIdx);
    let stream = null;
    if (streamIdx >= 0 && streamIdx < endObjIdx) {
      dict = text.slice(start, streamIdx);
      let dataStart = streamIdx + 'stream'.length;
      if (text[dataStart] === '\r') dataStart++;
      if (text[dataStart] === '\n') dataStart++;
      const lengthMatch = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
      let dataEnd = lengthMatch ? dataStart + Number(lengthMatch[1]) : -1;
      if (dataEnd < 0 || text.slice(dataEnd, dataEnd + 20).trimStart().slice(0, 9) !== 'endstream') {
        dataEnd = text.indexOf('endstream', dataStart);
      }
      stream = bytes.subarray(dataStart, dataEnd);
      // el endobj que buscamos es el posterior al stream (el stream puede contener "endobj")
      const realEnd = text.indexOf('endobj', dataEnd);
      re.lastIndex = realEnd >= 0 ? realEnd : dataEnd;
    } else {
      re.lastIndex = endObjIdx;
    }
    objects.set(num, { num, dict, stream });
    order.push(num);
  }
  return { objects, order };
}

function refs(str) {
  const out = [];
  const re = /(\d+)\s+\d+\s+R/g;
  let m;
  while ((m = re.exec(str || ''))) out.push(Number(m[1]));
  return out;
}

function dictEntry(dict, key) {
  // valor de /Key: una referencia "N 0 R" o un array "[ ... ]"
  const re = new RegExp('/' + key + '\\s*(\\[[^\\]]*\\]|\\d+\\s+\\d+\\s+R)');
  const m = re.exec(dict || '');
  return m ? m[1] : null;
}

// Páginas en orden (recorriendo /Pages → /Kids) y los streams de contenido de cada una.
function pageContents(objects) {
  const catalog = [...objects.values()].find(o => /\/Type\s*\/Catalog\b/.test(o.dict));
  if (!catalog) return null;
  const rootRef = refs(dictEntry(catalog.dict, 'Pages'))[0];
  if (rootRef === undefined) return null;
  const pages = [];
  const seen = new Set();
  const walk = (num) => {
    if (seen.has(num)) return;
    seen.add(num);
    const obj = objects.get(num);
    if (!obj) return;
    if (/\/Type\s*\/Pages\b/.test(obj.dict)) {
      refs(dictEntry(obj.dict, 'Kids')).forEach(walk);
    } else if (/\/Type\s*\/Page\b/.test(obj.dict)) {
      pages.push(refs(dictEntry(obj.dict, 'Contents')));
    }
  };
  walk(rootRef);
  return pages.length ? pages : null;
}

async function decodeStream(obj) {
  if (!obj || !obj.stream) return null;
  if (/\/Subtype\s*\/Image\b/.test(obj.dict)) return null;
  const filter = /\/Filter\s*(\[[^\]]*\]|\/\w+)/.exec(obj.dict);
  if (!filter) return obj.stream;
  const filters = filter[1].match(/\/\w+/g) || [];
  if (filters.length === 1 && filters[0] === '/FlateDecode') {
    try { return await inflate(obj.stream); } catch (e) { return null; }
  }
  return null; // otros filtros (imágenes, etc.): no hay texto que leer
}

// --- Contenido de la página ---

function decodeLiteral(raw) {
  // raw: el contenido entre paréntesis, sin los paréntesis externos
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c !== 0x5c) { out.push(c); continue; }
    const n = raw[++i];
    if (n === undefined) break;
    const simple = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 }[n];
    if (simple !== undefined) { out.push(simple); continue; }
    if (n === '\r') { if (raw[i + 1] === '\n') i++; continue; }
    if (n === '\n') continue;
    if (/[0-7]/.test(n)) {
      let oct = n;
      while (oct.length < 3 && /[0-7]/.test(raw[i + 1] || '')) oct += raw[++i];
      out.push(parseInt(oct, 8) & 0xff);
      continue;
    }
    out.push(n.charCodeAt(0));
  }
  return winAnsi.decode(new Uint8Array(out));
}

function decodeHex(raw) {
  const hex = raw.replace(/[^0-9a-f]/gi, '');
  const out = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt((hex.slice(i, i + 2) + '0').slice(0, 2), 16));
  return winAnsi.decode(new Uint8Array(out));
}

// Tokenizador de operadores de contenido: números, nombres, strings, arrays y operadores.
function* tokens(src) {
  let i = 0;
  const len = src.length;
  while (i < len) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '%') { while (i < len && src[i] !== '\n' && src[i] !== '\r') i++; continue; }
    if (ch === '(') {
      let depth = 1;
      let j = i + 1;
      for (; j < len && depth > 0; j++) {
        if (src[j] === '\\') { j++; continue; }
        if (src[j] === '(') depth++;
        else if (src[j] === ')') depth--;
      }
      yield { type: 'string', value: decodeLiteral(src.slice(i + 1, j - 1)) };
      i = j;
      continue;
    }
    if (ch === '<' && src[i + 1] === '<') { yield { type: 'op', value: '<<' }; i += 2; continue; }
    if (ch === '>' && src[i + 1] === '>') { yield { type: 'op', value: '>>' }; i += 2; continue; }
    if (ch === '<') {
      const j = src.indexOf('>', i);
      yield { type: 'string', value: decodeHex(src.slice(i + 1, j < 0 ? len : j)) };
      i = j < 0 ? len : j + 1;
      continue;
    }
    if (ch === '[' || ch === ']') { yield { type: ch }; i++; continue; }
    if (ch === '/') {
      let j = i + 1;
      while (j < len && !/[\s/[\]()<>{}%]/.test(src[j])) j++;
      yield { type: 'name', value: src.slice(i + 1, j) };
      i = j;
      continue;
    }
    let j = i;
    while (j < len && !/[\s/[\]()<>{}%]/.test(src[j])) j++;
    if (j === i) { i++; continue; }
    const word = src.slice(i, j);
    const num = Number(word);
    yield Number.isNaN(num) ? { type: 'op', value: word } : { type: 'number', value: num };
    i = j;
  }
}

// Interpreta los operadores de texto y devuelve los strings con su posición.
// Considera Td/TD/Tm/T*/TL y la matriz cm básica (traslación y escala).
export function textItemsFromContent(content, page = 1) {
  const src = typeof content === 'string' ? content : latin1.decode(content);
  const items = [];
  let stack = [];
  let array = null;
  let lineX = 0, lineY = 0, leading = 0;
  let ctm = [1, 0, 0, 1, 0, 0];
  const ctmStack = [];
  const push = (str) => {
    if (!str) return;
    const x = ctm[0] * lineX + ctm[2] * lineY + ctm[4];
    const y = ctm[1] * lineX + ctm[3] * lineY + ctm[5];
    items.push({ page, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, str });
  };
  const nextLine = () => { lineY -= leading; };
  for (const tok of tokens(src)) {
    if (tok.type === '[') { array = []; continue; }
    if (tok.type === ']') { stack.push({ type: 'array', value: array || [] }); array = null; continue; }
    if (array) { array.push(tok); continue; }
    if (tok.type !== 'op') { stack.push(tok); continue; }
    const nums = stack.filter(t => t.type === 'number').map(t => t.value);
    const strs = stack.filter(t => t.type === 'string').map(t => t.value);
    switch (tok.value) {
      case 'q': ctmStack.push(ctm.slice()); break;
      case 'Q': ctm = ctmStack.pop() || [1, 0, 0, 1, 0, 0]; break;
      case 'cm': if (nums.length >= 6) {
        const [a, b, c, d, e, f] = nums.slice(-6);
        const [A, B, C, D, E, F] = ctm;
        ctm = [a * A + b * C, a * B + b * D, c * A + d * C, c * B + d * D, e * A + f * C + E, e * B + f * D + F];
      } break;
      case 'BT': lineX = 0; lineY = 0; break;
      case 'Td': if (nums.length >= 2) { lineX += nums[nums.length - 2]; lineY += nums[nums.length - 1]; } break;
      case 'TD': if (nums.length >= 2) { leading = -nums[nums.length - 1]; lineX += nums[nums.length - 2]; lineY += nums[nums.length - 1]; } break;
      case 'Tm': if (nums.length >= 6) { lineX = nums[nums.length - 2]; lineY = nums[nums.length - 1]; } break;
      case 'TL': if (nums.length) leading = nums[nums.length - 1]; break;
      case 'T*': nextLine(); break;
      case 'Tj': push(strs[strs.length - 1]); break;
      case "'": nextLine(); push(strs[strs.length - 1]); break;
      case '"': nextLine(); push(strs[strs.length - 1]); break;
      case 'TJ': {
        const arr = stack.filter(t => t.type === 'array').pop();
        if (arr) push(arr.value.filter(t => t.type === 'string').map(t => t.value).join(''));
        break;
      }
      default: break;
    }
    stack = [];
  }
  return items;
}

// Punto de entrada: bytes del PDF → ítems de texto de todas las páginas, en orden.
export async function extractPdfTextItems(input) {
  const bytes = toBytes(input);
  if (latin1.decode(bytes.subarray(0, 1024)).indexOf('%PDF-') < 0) {
    throw new Error('not_a_pdf');
  }
  const { objects, order } = readObjects(bytes);
  if (/\/Encrypt\b/.test(latin1.decode(bytes.subarray(Math.max(0, bytes.length - 4096))))) {
    throw new Error('encrypted_pdf');
  }
  const pages = pageContents(objects);
  const items = [];
  if (pages) {
    for (let p = 0; p < pages.length; p++) {
      for (const num of pages[p]) {
        const data = await decodeStream(objects.get(num));
        if (data) items.push(...textItemsFromContent(data, p + 1));
      }
    }
  } else {
    for (const num of order) {
      const data = await decodeStream(objects.get(num));
      if (data) items.push(...textItemsFromContent(data, 1));
    }
  }
  return items;
}
