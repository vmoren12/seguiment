/**
 * actions.js - lògica de negoci. Tota escriptura de dades passa per aquí
 * per garantir que la integritat referencial es mantingui en anul·lar o
 * eliminar entitats.
 */
import * as store from '../core/store.js';
import { clone, uid } from '../core/util.js';
import { nowStamp, today, daysSince, addDays, toISODate, addMonths, dateOf } from '../core/dates.js';
import {
  newStudent, newRecord, newAppointment, newTask, newGuardian, newService,
  newServiceLink, newDemand, newReferral, newConsent, newStaff,
  COLLECTIONS, SCHEMA_VERSION, APP_VERSION, validateImport, migrate,
} from './schema.js';

/** Professional que signa les accions (configuració del centre). */
export function currentAuthor() {
  return store.settings().centre?.professional || '';
}

const FACTORIES = {
  students: newStudent, records: newRecord, appointments: newAppointment,
  tasks: newTask, guardians: newGuardian, services: newService,
  serviceLinks: newServiceLink, demands: newDemand, referrals: newReferral,
  consents: newConsent, staff: newStaff,
};

/* -------------------------------------------------------------------------
   Operacions genèriques
   ------------------------------------------------------------------------- */

/**
 * Neteja les claus sense valor abans de passar-les a una fàbrica: un `id`
 * indefinit sobreescriuria l'identificador acabat de generar i deixaria
 * l'entitat sense identificador utilitzable.
 */
function cleanPatch(data) {
  const out = { ...data };
  if (out.id === undefined || out.id === null || out.id === '') delete out.id;
  return out;
}

/**
 * Desa una entitat: la crea si no existeix o l'actualitza si ja hi és.
 * Retorna l'entitat resultant.
 */
export function save(collection, data) {
  const patch = cleanPatch(data);
  const existing = patch.id ? store.find(collection, patch.id) : null;
  const factory = FACTORIES[collection] || ((x) => ({ ...x }));
  const record = existing ? { ...existing, ...patch } : factory(patch);
  record.updatedAt = nowStamp();

  store.mutate((draft) => {
    const index = existing ? draft[collection].findIndex((x) => x.id === record.id) : -1;
    if (index >= 0) draft[collection][index] = record;
    else draft[collection].push(record);
  });

  return record;
}

/** Anul·lació lògica: l'entitat es marca com a anul·lada, mai s'esborra. */
export function annul(collection, id, reason = '') {
  const item = store.find(collection, id);
  if (!item) return null;
  const annulled = { at: nowStamp(), by: currentAuthor(), reason };

  store.mutate((draft) => {
    const target = draft[collection].find((x) => x.id === id);
    if (target) { target.annulled = annulled; target.updatedAt = nowStamp(); }
    if (collection === 'records') {
      // Les tasques generades pels acords del registre queden anul·lades també.
      draft.tasks.forEach((task) => {
        if (task.origin?.kind === 'acord' && task.origin.recordId === id && !task.annulled) {
          task.annulled = { ...annulled, reason: 'Registre anul·lat' };
        }
      });
    }
    if (collection === 'students') {
      // L'expedient es tanca però els registres es conserven.
      const target2 = draft.students.find((x) => x.id === id);
      if (target2) target2.status = { value: 'tancat', date: today(), reason: reason || target2.status?.reason || '' };
    }
  });

  return item;
}

/** Col·leccions que pengen d'un alumne/a, amb el camp que hi apunta. */
const STUDENT_LINKS = [
  ['guardians', 'studentId'], ['serviceLinks', 'studentId'], ['tasks', 'studentId'],
  ['demands', 'studentId'], ['referrals', 'studentId'], ['consents', 'studentId'],
  ['records', 'studentIds'], ['appointments', 'studentIds'],
];

/** Compta els elements vinculats a un alumne/a (els que s'esborrarien amb ell). */
export function relatedCount(studentId) {
  const state = store.getState();
  return STUDENT_LINKS.reduce((acc, [collection, key]) => acc + state[collection].filter(
    (x) => (key === 'studentIds' ? (x.studentIds || []).includes(studentId) : x[key] === studentId),
  ).length, 0);
}

/**
 * Esborrat definitiu. A diferència de `annul`, l'entitat desapareix del
 * magatzem; en el cas d'un alumne/a també tot allò que hi estava vinculat,
 * perquè no en quedin referències òrfenes.
 */
export function remove(collection, id) {
  const item = store.find(collection, id);
  if (!item) return null;

  store.mutate((draft) => {
    draft[collection] = draft[collection].filter((x) => x.id !== id);

    if (collection === 'students') {
      STUDENT_LINKS.forEach(([target, key]) => {
        draft[target] = draft[target].filter((x) => (key === 'studentIds'
          ? !(x.studentIds || []).includes(id)
          : x[key] !== id));
      });
    }
    if (collection === 'records') {
      draft.tasks = draft.tasks.filter((task) => !(task.origin?.kind === 'acord' && task.origin.recordId === id));
    }
  });

  return item;
}

/** Restaura una entitat anul·lada. */
export function restore(collection, id) {
  const item = store.find(collection, id);
  if (!item) return null;
  store.mutate((draft) => {
    const target = draft[collection].find((x) => x.id === id);
    if (target) { target.annulled = null; target.updatedAt = nowStamp(); }
  });
  return item;
}

/* -------------------------------------------------------------------------
   Registres de seguiment: versionat, consolidació i acords
   ------------------------------------------------------------------------- */

/** Un registre és consolidat si s'ha marcat o si ha superat el llindar de dies. */
export function isSealed(record) {
  if (!record) return false;
  if (record.sealed) return true;
  const days = store.settings().thresholds?.sealDays ?? 30;
  const elapsed = daysSince(dateOf(record.createdAt));
  return elapsed !== null && elapsed >= days;
}

/**
 * Desa un registre de seguiment. Editar no substitueix: afegeix una versió
 * nova amb data i motiu, i les anteriors queden consultables.
 */
export function saveRecord(data, { reason = '' } = {}) {
  const patch = cleanPatch(data);
  const existing = patch.id ? store.find('records', patch.id) : null;
  const author = currentAuthor();

  if (!existing) {
    const record = save('records', { ...patch, author: patch.author || author });
    syncAgreementTasks(record);
    return record;
  }

  const before = clone(existing);
  const version = {
    at: nowStamp(),
    author,
    reason: reason || '',
    sealed: isSealed(existing),
    snapshot: {
      at: before.at, type: before.type, content: before.content,
      agreements: before.agreements, participants: before.participants,
      confidentiality: before.confidentiality,
    },
  };

  const record = { ...existing, ...patch, updatedAt: nowStamp() };
  record.versions = [...(existing.versions || []), version];

  store.mutate((draft) => {
    const index = draft.records.findIndex((x) => x.id === record.id);
    if (index >= 0) draft.records[index] = record;
  });

  syncAgreementTasks(record);
  return record;
}

/**
 * Manté sincronitzades les tasques generades pels acords d'un registre:
 * crea les noves, actualitza les existents i anul·la les que ja no hi són.
 */
export function syncAgreementTasks(record) {
  const author = currentAuthor();
  const valid = (record.agreements || []).filter((a) => a.text && (a.owner || a.due));
  const validIds = new Set(valid.map((a) => a.id));

  store.mutate((draft) => {
    // Anul·la les tasques d'acords eliminats.
    draft.tasks.forEach((task) => {
      if (task.origin?.kind === 'acord' && task.origin.recordId === record.id
        && !validIds.has(task.origin.refId) && !task.annulled) {
        task.annulled = { at: nowStamp(), by: author, reason: 'Acord eliminat del registre' };
      }
    });

    valid.forEach((agreement) => {
      const existing = draft.tasks.find((t) => t.origin?.kind === 'acord' && t.origin.refId === agreement.id);
      if (existing) {
        existing.title = agreement.text;
        existing.owner = agreement.owner;
        existing.due = agreement.due;
        existing.state = agreement.state || existing.state;
        existing.annulled = null;
        existing.updatedAt = nowStamp();
      } else {
        draft.tasks.push(newTask({
          title: agreement.text,
          studentId: record.studentIds?.[0] || '',
          owner: agreement.owner,
          due: agreement.due,
          state: agreement.state || 'pendent',
          origin: { kind: 'acord', refId: agreement.id, recordId: record.id },
        }));
      }
    });
  });
}

/** Marca una tasca com a feta i sincronitza l'acord d'origen. */
export function setTaskState(id, state) {
  const task = store.find('tasks', id);
  if (!task) return null;

  store.mutate((draft) => {
    const target = draft.tasks.find((x) => x.id === id);
    target.state = state;
    target.doneAt = state === 'fet' ? today() : '';
    target.updatedAt = nowStamp();

    if (target.origin?.kind === 'acord' && target.origin.recordId) {
      const record = draft.records.find((r) => r.id === target.origin.recordId);
      const agreement = record?.agreements?.find((a) => a.id === target.origin.refId);
      if (agreement) agreement.state = state;
    }
  });

  return store.find('tasks', id);
}

/* -------------------------------------------------------------------------
   Cites
   ------------------------------------------------------------------------- */

/** Desa una cita i, si escau, genera la sèrie de repeticions. */
export function saveAppointment(data, { applyToSeries = false } = {}) {
  const existing = data.id ? store.find('appointments', data.id) : null;
  const appointment = save('appointments', data);

  if (!existing && data.seriesRule && data.seriesRule !== 'none' && data.seriesUntil) {
    createSeries(appointment, data.seriesRule, data.seriesUntil);
  }

  if (existing && applyToSeries && existing.seriesId) {
    const deltaStart = new Date(appointment.start) - new Date(existing.start);
    store.mutate((draft) => {
      draft.appointments.forEach((a) => {
        if (a.seriesId === existing.seriesId && a.id !== appointment.id && !a.annulled) {
          a.start = shiftIso(a.start, deltaStart);
          a.end = shiftIso(a.end, deltaStart);
          a.type = appointment.type;
          a.modality = appointment.modality;
          a.location = appointment.location;
          a.updatedAt = nowStamp();
        }
      });
    });
  }

  return appointment;
}

function shiftIso(iso, deltaMs) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const shifted = new Date(d.getTime() + deltaMs);
  const p = (n) => String(n).padStart(2, '0');
  return `${shifted.getFullYear()}-${p(shifted.getMonth() + 1)}-${p(shifted.getDate())}T${p(shifted.getHours())}:${p(shifted.getMinutes())}`;
}

/** Genera les repeticions d'una cita fins a la data indicada. */
export function createSeries(appointment, rule, until) {
  const seriesId = appointment.seriesId || uid('se');
  const stepDays = rule === 'weekly' ? 7 : rule === 'biweekly' ? 14 : 0;
  const created = [];
  let cursor = appointment;
  let guard = 0;

  while (guard++ < 60) {
    const nextStart = rule === 'monthly'
      ? toISODate(addMonths(dateOf(cursor.start), 1))
      : toISODate(addDays(dateOf(cursor.start), stepDays));
    if (nextStart > dateOf(until)) break;
    const next = newAppointment({
      ...clone(appointment),
      id: undefined,
      start: `${nextStart}T${String(appointment.start).slice(11, 16)}`,
      end: `${nextStart}T${String(appointment.end).slice(11, 16)}`,
      state: 'programada',
      recordId: '',
      seriesId,
      seriesRule: rule,
    });
    next.id = uid('ct');
    created.push(next);
    cursor = next;
  }

  store.mutate((draft) => {
    const first = draft.appointments.find((a) => a.id === appointment.id);
    if (first) { first.seriesId = seriesId; first.seriesRule = rule; }
    draft.appointments.push(...created);
  });

  return created;
}

/** Canvia l'estat d'una cita deixant-ne constància. */
export function setAppointmentState(id, state, reason = '') {
  const appointment = store.find('appointments', id);
  if (!appointment) return null;

  store.mutate((draft) => {
    const target = draft.appointments.find((x) => x.id === id);
    target.state = state;
    if (state === 'anullada') target.cancelReason = reason;
    target.updatedAt = nowStamp();
  });

  return store.find('appointments', id);
}

/** Reprograma una cita. */
export function rescheduleAppointment(id, start, end) {
  const appointment = store.find('appointments', id);
  if (!appointment) return null;

  store.mutate((draft) => {
    const target = draft.appointments.find((x) => x.id === id);
    target.start = start;
    target.end = end;
    if (target.state === 'programada' || target.state === 'confirmada') target.state = 'reprogramada';
    target.updatedAt = nowStamp();
  });

  return store.find('appointments', id);
}

/** Crea un registre de seguiment heretant el context d'una cita feta. */
export function recordFromAppointment(appointment, patch = {}) {
  const record = saveRecord({
    studentIds: [...(appointment.studentIds || [])],
    at: appointment.start,
    type: mapAppointmentTypeToRecordType(appointment.type),
    participants: [...(appointment.attendees || [])],
    serviceId: appointment.serviceId || '',
    appointmentId: appointment.id,
    content: '',
    author: currentAuthor(),
    ...patch,
  });

  store.mutate((draft) => {
    const target = draft.appointments.find((x) => x.id === appointment.id);
    if (target) target.recordId = record.id;
  });

  return record;
}

/** Correspondència entre tipus de cita i tipus de registre. */
export function mapAppointmentTypeToRecordType(type) {
  const map = {
    entrevistaFamilia: 'entrevistaFamilia',
    entrevistaAlumne: 'entrevistaAlumne',
    coordinacioDocent: 'coordinacioDocent',
    coordinacioExtern: 'coordinacioExtern',
    observacioAula: 'observacioAula',
    avaluacio: 'provaInstrument',
    cad: 'cad',
  };
  return map[type] || 'altres';
}

/* -------------------------------------------------------------------------
   Configuració, importació i exportació
   ------------------------------------------------------------------------- */

/**
 * Modifica la configuració.
 * @param {object} patch Claus de configuració a fusionar.
 * @param {object} [options] `silent: true` desa sense provocar cap repintat.
 */
export function updateSettings(patch, options = {}) {
  store.patchSettings(patch, options);
}

/** Construeix el paquet d'exportació completa. */
export function buildExport({ studentId = '' } = {}) {
  const state = store.getState();
  const payload = {
    format: 'seguiment-export',
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: nowStamp(),
    partial: Boolean(studentId),
    settings: clone(state.settings),
  };

  if (!studentId) {
    COLLECTIONS.forEach((c) => { payload[c] = clone(state[c]); });
  } else {
    const keepRecords = state.records.filter((r) => r.studentIds?.includes(studentId));
    const keepAppointments = state.appointments.filter((a) => a.studentIds?.includes(studentId));
    const serviceIds = new Set(state.serviceLinks.filter((l) => l.studentId === studentId).map((l) => l.serviceId));
    payload.students = clone(state.students.filter((s) => s.id === studentId));
    payload.guardians = clone(state.guardians.filter((g) => g.studentId === studentId));
    payload.staff = clone(state.staff);
    payload.services = clone(state.services.filter((s) => serviceIds.has(s.id)));
    payload.serviceLinks = clone(state.serviceLinks.filter((l) => l.studentId === studentId));
    payload.records = clone(keepRecords);
    payload.appointments = clone(keepAppointments);
    payload.tasks = clone(state.tasks.filter((t) => t.studentId === studentId));
    payload.demands = clone(state.demands.filter((d) => d.studentId === studentId));
    payload.referrals = clone(state.referrals.filter((r) => r.studentId === studentId));
    payload.consents = clone(state.consents.filter((c) => c.studentId === studentId));
  }

  return payload;
}

/**
 * Calcula les diferències d'una importació sense aplicar-les.
 * Retorna { detail, add, update } per col·lecció i en total.
 */
export function previewImport(data) {
  validateImport(data);
  const state = store.getState();
  const detail = {};
  let add = 0; let update = 0;

  COLLECTIONS.forEach((collection) => {
    const incoming = Array.isArray(data[collection]) ? data[collection] : [];
    const ids = new Set(state[collection].map((x) => x.id));
    const a = incoming.filter((x) => !ids.has(x.id)).length;
    const u = incoming.length - a;
    detail[collection] = { add: a, update: u, total: incoming.length };
    add += a; update += u;
  });

  return { detail, add, update };
}

/**
 * Aplica una importació.
 * @param {object} data Contingut del fitxer.
 * @param {'replace'|'merge'} mode Substitueix-ho tot o fusiona els nous.
 */
export function applyImport(data, mode = 'merge') {
  validateImport(data);

  if (mode === 'replace') {
    const next = migrate({ ...data });
    store.setState(next);
    return next;
  }

  store.mutate((draft) => {
    COLLECTIONS.forEach((collection) => {
      const incoming = Array.isArray(data[collection]) ? data[collection] : [];
      const byId = new Map(draft[collection].map((x) => [x.id, x]));
      incoming.forEach((item) => {
        if (item?.id && !byId.has(item.id)) draft[collection].push(item);
      });
    });
  });

  return store.getState();
}
