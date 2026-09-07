/**
 * util.js - utilitats generals sense dependencies.
 */

/** Genera un identificador unic i ordenable per temps. */
export function uid(prefix = 'e') {
  const t = Date.now().toString(36);
  const r = (crypto.getRandomValues(new Uint32Array(2)));
  return `${prefix}_${t}${r[0].toString(36)}${r[1].toString(36)}`.slice(0, 28);
}

/** Escapa text per a insercio segura a HTML. */
export function esc(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

/** Escapa per a us dins d'un atribut. */
export const attr = esc;

/** Clona en profunditat estructures serialitzables. */
export function clone(value) {
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch { /* continua amb JSON */ }
  }
  return JSON.parse(JSON.stringify(value));
}

/** Retarda l'execucio agrupant crides successives. */
export function debounce(fn, wait = 300) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn(...args); }, wait);
  };
  wrapped.cancel = () => { clearTimeout(timer); timer = null; };
  wrapped.flush = (...args) => { if (timer) { clearTimeout(timer); timer = null; fn(...args); } };
  wrapped.pending = () => timer !== null;
  return wrapped;
}

/** Memoritza una funcio pura amb clau derivada dels arguments. */
export function memo(fn, keyFn = (...a) => JSON.stringify(a), limit = 60) {
  const cache = new Map();
  return (...args) => {
    const key = keyFn(...args);
    if (cache.has(key)) return cache.get(key);
    const value = fn(...args);
    cache.set(key, value);
    if (cache.size > limit) cache.delete(cache.keys().next().value);
    return value;
  };
}

/** Normalitza text per a cerques: minuscules i sense accents. */
export function norm(text) {
  return String(text ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Comprova si totes les paraules de la consulta apareixen al text. */
export function matches(haystack, query) {
  if (!query) return true;
  const h = norm(haystack);
  return norm(query).split(/\s+/).filter(Boolean).every((w) => h.includes(w));
}

/** Agrupa una llista per clau. */
export function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

/** Compta ocurrencies per clau i retorna un mapa ordenat descendentment. */
export function countBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const k = keyFn(item);
    if (k === undefined || k === null || k === '') continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return new Map([...map.entries()].sort((a, b) => b[1] - a[1]));
}

/** Suma numerica segura. */
export function sum(list, valueFn = (x) => x) {
  return list.reduce((acc, item) => acc + (Number(valueFn(item)) || 0), 0);
}

/** Percentatge arrodonit; 0 si el total es zero. */
export function pct(part, total, decimals = 0) {
  if (!total) return 0;
  const v = (part / total) * 100;
  return decimals ? Number(v.toFixed(decimals)) : Math.round(v);
}

/** Ordena una copia de la llista per una clau. */
export function sortBy(list, keyFn, dir = 'asc') {
  const factor = dir === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => {
    const ka = keyFn(a); const kb = keyFn(b);
    if (ka === kb) return 0;
    if (ka === undefined || ka === null || ka === '') return 1;
    if (kb === undefined || kb === null || kb === '') return -1;
    return (ka < kb ? -1 : 1) * factor;
  });
}

/** Valor mes frequent d'una llista. */
export function mode(list) {
  const counts = countBy(list, (x) => x);
  return counts.size ? counts.keys().next().value : undefined;
}

/** Retorna nomes els valors unics, mantenint l'ordre. */
export function unique(list) {
  return [...new Set(list.filter((v) => v !== undefined && v !== null && v !== ''))];
}

/** Descarrega un fitxer generat al navegador. */
export function download(filename, content, mime = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Copia text al porta-retalls amb alternativa per a navegadors antics. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

/** Converteix un nom complet en inicials (mode de presentacio). */
export function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w[0].toUpperCase()}.`)
    .join(' ');
}

/** Neteja un text per a us com a nom de fitxer. */
export function slug(text, max = 60) {
  return norm(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max) || 'sense-nom';
}

/** Llegeix un fitxer de text seleccionat per l'usuari. */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No s’ha pogut llegir el fitxer'));
    reader.readAsText(file, 'utf-8');
  });
}

/** Obre el selector de fitxers i retorna el fitxer triat. */
export function pickFile(accept = '.json,application/json') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.addEventListener('change', () => { resolve(input.files?.[0] || null); input.remove(); }, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}
