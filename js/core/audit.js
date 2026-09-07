/**
 * audit.js - registre d'auditoria append-only.
 * Les entrades es construeixen aquí i el magatzem central les afegeix.
 * Cap funció d'aquest mòdul permet modificar ni eliminar entrades existents.
 */
import { uid } from './util.js';
import { nowStamp } from './dates.js';

/** Accions registrables. */
export const ACTIONS = [
  'create', 'update', 'delete', 'restore', 'state', 'reschedule',
  'export', 'import', 'wipe', 'seal', 'config',
];

/** Entitats registrables. */
export const ENTITIES = [
  'student', 'record', 'appointment', 'task', 'demand', 'referral',
  'consent', 'service', 'guardian', 'staff', 'settings', 'data',
];

/**
 * Crea una entrada d'auditoria.
 * @param {object} info
 * @param {string} info.action    Acció realitzada.
 * @param {string} info.entity    Tipus d'entitat afectada.
 * @param {string} [info.entityId] Identificador de l'entitat.
 * @param {string} [info.studentId] Alumne/a relacionat, per filtrar.
 * @param {string} [info.summary] Resum llegible del canvi.
 * @param {object} [info.changes] Camps rellevants { camp: [abans, després] }.
 * @param {string} [info.author]  Professional que fa l'acció.
 */
export function entry(info) {
  return {
    id: uid('au'),
    at: nowStamp(),
    author: info.author || '',
    action: info.action,
    entity: info.entity,
    entityId: info.entityId || '',
    studentId: info.studentId || '',
    summary: info.summary || '',
    changes: info.changes || null,
  };
}

/** Valor llegible per a la comparació de camps. */
function readable(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? `${value.length} elements` : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'sí' : 'no';
  return String(value);
}

/**
 * Compara dos objectes i retorna només els camps rellevants que han canviat.
 * `fields` limita la comparació als camps que cal deixar constància.
 */
export function diff(before, after, fields) {
  const keys = fields && fields.length ? fields : [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
  const changes = {};
  for (const key of keys) {
    if (key === 'updatedAt' || key === 'versions') continue;
    const a = before ? before[key] : undefined;
    const b = after ? after[key] : undefined;
    const sa = JSON.stringify(a ?? null);
    const sb = JSON.stringify(b ?? null);
    if (sa !== sb) changes[key] = [readable(a), readable(b)];
  }
  return Object.keys(changes).length ? changes : null;
}

/** Filtra el registre per alumne, acció i rang de dates. */
export function filterAudit(audit, { studentId, action, entity, from, to, query } = {}) {
  const q = query ? String(query).toLowerCase() : '';
  return audit.filter((e) => {
    if (studentId && e.studentId !== studentId) return false;
    if (action && e.action !== action) return false;
    if (entity && e.entity !== entity) return false;
    const day = String(e.at).slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (q && !`${e.summary} ${e.author} ${e.entityId}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
