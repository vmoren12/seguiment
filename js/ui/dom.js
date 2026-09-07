/**
 * dom.js - construcció d'HTML segura i delegació d'esdeveniments.
 * El renderitzat és previsible: cada vista genera una cadena d'HTML i el
 * contenidor es reemplaça d'un sol cop. No hi ha manipulació dispersa del DOM.
 */
import { esc } from '../core/util.js';

/** Marca un fragment com a HTML ja segur perquè no s'escapi. */
export function raw(value) {
  return { __raw: value === null || value === undefined ? '' : String(value) };
}

function render(value) {
  if (value === null || value === undefined || value === false) return '';
  if (Array.isArray(value)) return value.map(render).join('');
  if (typeof value === 'object' && '__raw' in value) return value.__raw;
  return esc(value);
}

/** Plantilla etiquetada que escapa tota interpolació per defecte. */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) out += render(values[i]) + strings[i + 1];
  return raw(out);
}

/** Converteix el resultat de `html` en text per assignar-lo a innerHTML. */
export function toHTML(value) { return render(value); }

/* --------------------------- Icones en línia ---------------------------- */

const ICONS = {
  dashboard: '<path d="M4 13h7V4H4zM13 20h7v-9h-7zM4 20h7v-4H4zM13 8h7V4h-7z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  users: '<path d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1"/><circle cx="9.5" cy="7" r="3.5"/><path d="M21 20v-1a4 4 0 0 0-3-3.8"/><path d="M16 3.2a3.5 3.5 0 0 1 0 6.6"/>',
  check: '<path d="M4 12.5 9 17.5 20 6.5"/>',
  checklist: '<path d="M4 6.5 6 8.5 9.5 5"/><path d="M4 16.5 6 18.5 9.5 15"/><path d="M13 7h7M13 17h7"/>',
  shield: '<path d="M12 3 5 6v6c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  inbox: '<path d="M4 13h4l1.5 3h5L16 13h4"/><path d="M4 13 6 5h12l2 8v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>',
  network: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v4M12 11.5 6.5 17M12 11.5 17.5 17"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7" y="12" width="3" height="5"/><rect x="12" y="8" width="3" height="9"/><rect x="17" y="5" width="3" height="12"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/><path d="M12 8v4.5l3 1.8"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  edit: '<path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M7 14h10v7H7z"/>',
  download: '<path d="M12 4v11M7.5 11 12 15.5 16.5 11"/><path d="M4 19h16"/>',
  upload: '<path d="M12 20V9M7.5 13 12 8.5 16.5 13"/><path d="M4 4h16"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
  link: '<path d="M10 13a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11 6.4"/><path d="M14 11a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7L13 17.6"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
  dots: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
};

/** SVG en línia, traç fi i monocrom. */
export function icon(name, extra = '') {
  const body = ICONS[name] || ICONS.info;
  return raw(`<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${body}</svg>`);
}

/* ------------------------ Delegació d'esdeveniments --------------------- */

const globalActions = new Map();
let viewActions = new Map();

/** Registra accions permanents (disponibles a totes les vistes). */
export function registerGlobalActions(map) {
  Object.entries(map).forEach(([key, fn]) => globalActions.set(key, fn));
}

/** Substitueix les accions de la vista activa. */
export function setViewActions(map) {
  viewActions = new Map(Object.entries(map || {}));
}

function resolve(name) {
  return viewActions.get(name) || globalActions.get(name) || null;
}

function handle(event, type) {
  const target = event.target.closest(`[data-act${type === 'click' ? '' : `-${type}`}]`);
  if (!target) return;
  const name = target.getAttribute(type === 'click' ? 'data-act' : `data-act-${type}`);
  const fn = resolve(name);
  if (!fn) return;
  if (type === 'click' && target.tagName === 'A' && !target.getAttribute('href')) event.preventDefault();
  fn(target, event);
}

/** Instal·la els escoltadors delegats una sola vegada. */
export function installDelegation(root = document) {
  root.addEventListener('click', (e) => handle(e, 'click'));
  root.addEventListener('input', (e) => handle(e, 'input'));
  root.addEventListener('change', (e) => handle(e, 'change'));
  root.addEventListener('submit', (e) => handle(e, 'submit'));
  root.addEventListener('keydown', (e) => handle(e, 'keydown'));
}

/* ------------------------------ Utilitats ------------------------------- */

/** Assigna HTML a un contenidor. */
export function paint(element, content) {
  if (!element) return;
  element.innerHTML = toHTML(content);
}

/** Selector curt. */
export const $ = (selector, scope = document) => scope.querySelector(selector);
/** Selector múltiple com a array. */
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/** Llegeix els valors d'un formulari com a objecte pla. */
export function formValues(form) {
  const data = {};
  new FormData(form).forEach((value, key) => {
    if (key in data) {
      if (!Array.isArray(data[key])) data[key] = [data[key]];
      data[key].push(value);
    } else {
      data[key] = value;
    }
  });
  form.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    if (input.name && !input.dataset.multi) data[input.name] = input.checked;
  });
  return data;
}

/** Insereix text a la posició del cursor d'un camp de text. */
export function insertAtCursor(field, text) {
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? field.value.length;
  field.value = `${field.value.slice(0, start)}${text}${field.value.slice(end)}`;
  const caret = start + text.length;
  field.setSelectionRange(caret, caret);
  field.focus();
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Desplaça la vista fins a un element amb un marge superior. */
export function scrollIntoViewSoft(element) {
  if (!element) return;
  element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
