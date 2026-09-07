/**
 * i18n.js - internacionalització (català i castellà) i formatadors locals.
 * Les claus absents en un idioma recauen en el català i, si tampoc hi són,
 * es retorna la clau perquè el buit sigui visible durant el desenvolupament.
 */
import ca from './lang/ca.js';
import es from './lang/es.js';
import { parse } from './dates.js';

const DICTS = { ca, es };
export const LANGS = [
  { code: 'ca', label: 'Català' },
  { code: 'es', label: 'Castellano' },
];

let current = 'ca';
const listeners = new Set();

/** Idioma actiu. */
export function getLang() { return current; }

/** Canvia l'idioma actiu i notifica els subscriptors. */
export function setLang(lang) {
  const next = DICTS[lang] ? lang : 'ca';
  if (next === current) return;
  current = next;
  document.documentElement.lang = next;
  listeners.forEach((fn) => fn(next));
}

/** Subscripció als canvis d'idioma. */
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Idioma preferit del navegador si el tenim disponible. */
export function detectLang() {
  const list = navigator.languages?.length ? navigator.languages : [navigator.language || 'ca'];
  for (const l of list) {
    const code = String(l).slice(0, 2).toLowerCase();
    if (DICTS[code]) return code;
  }
  return 'ca';
}

function lookup(dict, path) {
  return path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), dict);
}

/**
 * Tradueix una clau amb interpolació de paràmetres: t('x.y', { n: 3 }).
 */
export function t(path, params) {
  let value = lookup(DICTS[current], path);
  if (value === undefined && current !== 'ca') value = lookup(DICTS.ca, path);
  if (value === undefined) return path;
  if (typeof value !== 'string') return value;
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
}

/** Etiqueta d'un valor d'enumeració, amb el valor cru com a alternativa. */
export function tEnum(group, key) {
  if (key === undefined || key === null || key === '') return '';
  const value = lookup(DICTS[current], `enums.${group}.${key}`) ?? lookup(DICTS.ca, `enums.${group}.${key}`);
  return value ?? String(key);
}

/** Totes les entrades d'un grup d'enumeració com a [{ value, label }]. */
export function enumOptions(group) {
  const src = lookup(DICTS.ca, `enums.${group}`) || {};
  return Object.keys(src).map((value) => ({ value, label: tEnum(group, value) }));
}

/** Codi de localització per als formatadors del navegador. */
export function locale() { return DICTS[current].locale || 'ca-ES'; }

const fmtCache = new Map();
function dateFormatter(options) {
  const key = `${current}|${JSON.stringify(options)}`;
  if (!fmtCache.has(key)) fmtCache.set(key, new Intl.DateTimeFormat(locale(), options));
  return fmtCache.get(key);
}

/** Data curta: 12/03/2026. */
export function fmtDate(value) {
  const d = parse(value);
  return d ? dateFormatter({ day: '2-digit', month: '2-digit', year: 'numeric' }).format(d) : '';
}

/** Data llarga: 12 de març de 2026. */
export function fmtDateLong(value) {
  const d = parse(value);
  return d ? dateFormatter({ day: 'numeric', month: 'long', year: 'numeric' }).format(d) : '';
}

/** Data i hora: 12/03/2026, 09:30. */
export function fmtDateTime(value) {
  const d = parse(value);
  return d ? dateFormatter({ day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d) : '';
}

/** Hora: 09:30. */
export function fmtTime(value) {
  const d = parse(value);
  return d ? dateFormatter({ hour: '2-digit', minute: '2-digit' }).format(d) : '';
}

/** Dia i mes: dj. 12 de març. */
export function fmtDayMonth(value) {
  const d = parse(value);
  return d ? dateFormatter({ weekday: 'short', day: 'numeric', month: 'long' }).format(d) : '';
}

/** Mes i any: març de 2026. */
export function fmtMonthYear(value) {
  const d = parse(value);
  return d ? dateFormatter({ month: 'long', year: 'numeric' }).format(d) : '';
}

/** Etiqueta curta de mes per als gràfics: mar. 26. */
export function fmtMonthShort(monthKey) {
  const d = parse(`${monthKey}-01`);
  return d ? dateFormatter({ month: 'short', year: '2-digit' }).format(d) : monthKey;
}

/** Nombre amb separadors locals. */
export function fmtNum(value, decimals = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

/** Percentatge formatat. */
export function fmtPct(value, decimals = 0) {
  return `${fmtNum(value, decimals)} %`;
}

/** Noms dels dies de la setmana començant en dilluns. */
export function weekdayNames(short = true) {
  const group = short ? 'weekdayShort' : 'weekday';
  return [1, 2, 3, 4, 5, 6, 0].map((d) => tEnum(group, d));
}
