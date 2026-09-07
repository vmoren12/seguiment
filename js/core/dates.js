/**
 * dates.js - utilitats de data i hora.
 * Convencions internes:
 *   - Dates simples: 'AAAA-MM-DD'
 *   - Instants:      ISO 8601 local sense zona ('AAAA-MM-DDTHH:MM')
 * La setmana comenca en dilluns (convencio europea).
 */

export const MS_DAY = 86400000;

/** Data d'avui en format AAAA-MM-DD. */
export function today() { return toISODate(new Date()); }

/** Instant actual retallat a minuts. */
export function nowStamp() { return new Date().toISOString(); }

/** Converteix un Date a 'AAAA-MM-DD' en hora local. */
export function toISODate(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Converteix un Date a 'AAAA-MM-DDTHH:MM' en hora local. */
export function toISOLocal(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${toISODate(date)}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

/** Interpreta 'AAAA-MM-DD' o ISO com a Date local. */
export function parse(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const s = String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0, 0, 0);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Nomes la part de data d'un instant. */
export function dateOf(value) { return String(value || '').slice(0, 10); }

/** Nomes la part d'hora 'HH:MM' d'un instant. */
export function timeOf(value) { return String(value || '').slice(11, 16); }

/** Suma dies a una data (accepta string o Date) i retorna Date. */
export function addDays(value, days) {
  const d = parse(value) || new Date();
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/** Suma minuts a un instant i retorna 'AAAA-MM-DDTHH:MM'. */
export function addMinutes(value, minutes) {
  const d = parse(value) || new Date();
  return toISOLocal(new Date(d.getTime() + minutes * 60000));
}

/** Suma mesos conservant el dia quan es possible. */
export function addMonths(value, months) {
  const d = parse(value) || new Date();
  const r = new Date(d);
  const day = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + months);
  r.setDate(Math.min(day, daysInMonth(r.getFullYear(), r.getMonth())));
  return r;
}

/** Nombre de dies del mes indicat (mes 0-11). */
export function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }

/** Diferencia en dies entre dues dates (b - a), ignorant hores. */
export function diffDays(a, b) {
  const da = parse(a); const db = parse(b);
  if (!da || !db) return null;
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / MS_DAY);
}

/** Dies transcorreguts des d'una data fins avui (positiu si es passat). */
export function daysSince(value) {
  const d = diffDays(value, today());
  return d === null ? null : d;
}

/** Dies que falten fins a una data (negatiu si ja ha passat). */
export function daysUntil(value) {
  const d = diffDays(today(), value);
  return d === null ? null : d;
}

/** Dilluns de la setmana d'una data. */
export function startOfWeek(value) {
  const d = parse(value) || new Date();
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (r.getDay() + 6) % 7; // 0 = dilluns
  r.setDate(r.getDate() - dow);
  return r;
}

/** Primer dia del mes. */
export function startOfMonth(value) {
  const d = parse(value) || new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Ultim dia del mes. */
export function endOfMonth(value) {
  const d = parse(value) || new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Genera un rang de dates consecutives [inici, fi] com a strings. */
export function rangeDates(from, to) {
  const out = [];
  let cur = parse(from);
  const end = parse(to);
  if (!cur || !end) return out;
  let guard = 0;
  while (cur <= end && guard++ < 2000) {
    out.push(toISODate(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

/** Comprova si una data cau dins d'un rang inclusiu (accepta limits buits). */
export function inRange(value, from, to) {
  const v = dateOf(value);
  if (!v) return false;
  if (from && v < dateOf(from)) return false;
  if (to && v > dateOf(to)) return false;
  return true;
}

/** Edat en anys a partir de la data de naixement. */
export function age(birth, at = today()) {
  const b = parse(birth); const a = parse(at);
  if (!b || !a) return null;
  let years = a.getFullYear() - b.getFullYear();
  const m = a.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && a.getDate() < b.getDate())) years -= 1;
  return years >= 0 && years < 130 ? years : null;
}

/** Minuts des de mitjanit d'un instant. */
export function minutesOfDay(value) {
  const t = timeOf(value);
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Converteix minuts des de mitjanit a 'HH:MM'. */
export function minutesToTime(minutes) {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Durada en minuts entre dos instants. */
export function durationMinutes(start, end) {
  const a = parse(start); const b = parse(end);
  if (!a || !b) return 0;
  return Math.max(0, Math.round((b - a) / 60000));
}

/** Identificador del curs escolar d'una data (p. ex. '2025-2026'). */
export function schoolYear(value = today(), startMonth = 8) {
  const d = parse(value) || new Date();
  const y = d.getFullYear();
  return d.getMonth() >= startMonth ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/** Rang de dates [inici, fi] d'un curs escolar 'AAAA-AAAA'. */
export function schoolYearRange(year, startMonth = 8) {
  const [a, b] = String(year).split('-').map(Number);
  if (!a || !b) return { from: '', to: '' };
  const p = (n) => String(n).padStart(2, '0');
  return { from: `${a}-${p(startMonth + 1)}-01`, to: `${b}-${p(startMonth)}-31` };
}

/** Rang del trimestre indicat (1, 2 o 3) dins d'un curs escolar. */
export function termRange(year, term) {
  const [a, b] = String(year).split('-').map(Number);
  if (!a || !b) return { from: '', to: '' };
  if (term === 1) return { from: `${a}-09-01`, to: `${a}-12-22` };
  if (term === 2) return { from: `${a}-12-23`, to: `${b}-03-31` };
  return { from: `${b}-04-01`, to: `${b}-08-31` };
}

/** Clau de mes 'AAAA-MM'. */
export function monthKey(value) { return String(value || '').slice(0, 7); }

/** Llista de claus de mes entre dues dates. */
export function monthsBetween(from, to) {
  const out = [];
  let cur = startOfMonth(from);
  const end = startOfMonth(to);
  let guard = 0;
  while (cur <= end && guard++ < 120) {
    out.push(monthKey(toISODate(cur)));
    cur = addMonths(cur, 1);
  }
  return out;
}

/** Arrodoneix un instant al bloc de minuts mes proper. */
export function roundToSlot(value, slot = 15) {
  const d = parse(value) || new Date();
  const ms = slot * 60000;
  return toISOLocal(new Date(Math.round(d.getTime() / ms) * ms));
}
