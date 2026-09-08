/**
 * selectors.js - consultes derivades de l'estat. Funcions pures: reben
 * l'estat i retornen dades ja preparades per al renderitzat.
 */
import {
  matches, sortBy, unique, countBy, mode, initials, groupBy,
} from '../core/util.js';
import {
  today, dateOf, daysSince, daysUntil, inRange, minutesOfDay,
  durationMinutes, toISODate, startOfWeek, addDays, age,
} from '../core/dates.js';
import { CHAIN_STEPS, LEVEL_AGES } from './schema.js';
import { getRevision } from '../core/store.js';

/* -------------------------------------------------------------------------
   Memòria de càlcul
   Les consultes cares (ordenació de l'alumnat, últim contacte, panell de
   compliment) es repeteixen a cada repintat. Es guarden fins que l'estat
   canvia: el comptador de revisions del magatzem fa d'invalidador.
   ------------------------------------------------------------------------- */

const cache = new Map();

function cached(key, compute) {
  const revision = getRevision();
  const hit = cache.get(key);
  if (hit && hit.revision === revision) return hit.value;
  const value = compute();
  cache.set(key, { revision, value });
  return value;
}

/* -------------------------------------------------------------------------
   Alumnat
   ------------------------------------------------------------------------- */

/** Nom complet, respectant el mode de presentació. */
export function fullName(student, presentation = false) {
  if (!student) return '';
  const full = `${student.name || ''} ${student.surname || ''}`.trim();
  return presentation ? initials(full) : full;
}

/** Nom en format llistat: «Cognoms, Nom». */
export function listName(student, presentation = false) {
  if (!student) return '';
  if (presentation) return initials(`${student.name || ''} ${student.surname || ''}`);
  return `${student.surname || ''}, ${student.name || ''}`.replace(/^, |, $/g, '');
}

/** Alumnat viu, ordenat per cognoms. */
export function allStudents(state) {
  return cached('allStudents', () => sortBy(
    state.students.filter((s) => !s.annulled),
    (s) => `${s.surname} ${s.name}`.toLowerCase(),
  ));
}

/** Filtra l'alumnat amb criteris combinables. */
export function filterStudents(state, filters = {}) {
  const { query, level, group, nese, status, tutor, serviceId, contactGap } = filters;
  const linkedByService = serviceId
    ? new Set(state.serviceLinks.filter((l) => l.serviceId === serviceId && !l.annulled).map((l) => l.studentId))
    : null;

  return allStudents(state).filter((s) => {
    if (level && s.level !== level) return false;
    if (group && s.group !== group) return false;
    if (nese && s.nese?.category !== nese) return false;
    if (status && s.status?.value !== status) return false;
    if (tutor && s.tutorName !== tutor) return false;
    if (linkedByService && !linkedByService.has(s.id)) return false;
    if (contactGap) {
      const last = lastContactDate(state, s.id);
      const gap = last ? daysSince(last) : Infinity;
      if (gap < Number(contactGap)) return false;
    }
    if (query) {
      const hay = `${s.name} ${s.surname} ${s.level} ${s.group} ${s.tutorName} ${(s.tags || []).join(' ')}`;
      if (!matches(hay, query)) return false;
    }
    return true;
  });
}

/** Nivells presents, combinant configuració i dades reals. */
export function levels(state) {
  return unique([...(state.settings.levels || []), ...state.students.map((s) => s.level)]);
}

/** Grups presents, amb el nivell associat. */
export function groups(state) {
  const fromSettings = (state.settings.groups || []).map((g) => g.name);
  const fromStudents = state.students.filter((s) => !s.annulled).map((s) => s.group);
  return unique([...fromSettings, ...fromStudents]);
}

/** Tutors coneguts. */
export function tutors(state) {
  return unique([
    ...state.staff.filter((p) => !p.annulled).map((p) => p.name),
    ...state.students.map((s) => s.tutorName),
  ]);
}

/** Nivell previst segons l'edat de l'alumne/a. */
export function expectedLevel(birth) {
  const years = age(birth);
  if (years === null) return '';
  const found = Object.entries(LEVEL_AGES).find(([, a]) => a === years);
  return found ? found[0] : '';
}

/* -------------------------------------------------------------------------
   Registres, cites i contactes
   ------------------------------------------------------------------------- */

/** Registres vius d'un alumne/a, del més recent al més antic. */
export function recordsOf(state, studentId) {
  return sortBy(
    state.records.filter((r) => !r.annulled && r.studentIds?.includes(studentId)),
    (r) => r.at, 'desc',
  );
}

/** Tots els registres vius del període indicat. */
export function recordsInRange(state, from, to) {
  return state.records.filter((r) => !r.annulled && inRange(r.at, from, to));
}

/** Cites vives d'un alumne/a. */
export function appointmentsOf(state, studentId) {
  return sortBy(
    state.appointments.filter((a) => !a.annulled && a.studentIds?.includes(studentId)),
    (a) => a.start, 'desc',
  );
}

/** Cites d'un rang de dates, ordenades cronològicament. */
export function appointmentsInRange(state, from, to, filters = {}) {
  const { type, studentId, group, serviceId, state: apptState } = filters;
  const groupStudents = group
    ? new Set(state.students.filter((s) => s.group === group).map((s) => s.id))
    : null;

  return sortBy(state.appointments.filter((a) => {
    if (a.annulled) return false;
    if (!inRange(a.start, from, to)) return false;
    if (type && a.type !== type) return false;
    if (apptState && a.state !== apptState) return false;
    if (serviceId && a.serviceId !== serviceId) return false;
    if (studentId && !a.studentIds?.includes(studentId)) return false;
    if (groupStudents && !(a.studentIds || []).some((id) => groupStudents.has(id))) return false;
    return true;
  }), (a) => a.start);
}

/** Data de l'últim contacte registrat amb un alumne/a. */
export function lastContactDate(state, studentId) {
  // Es recorren els registres un sol cop per a tot l'alumnat: fer-ho per
  // alumne/a costava registres × alumnes a cada repintat de la llista.
  const map = cached('lastContact', () => {
    const byStudent = new Map();
    for (const r of state.records) {
      if (r.annulled) continue;
      const d = dateOf(r.at);
      for (const id of r.studentIds || []) {
        const current = byStudent.get(id);
        if (current === undefined || d > current) byStudent.set(id, d);
      }
    }
    return byStudent;
  });
  return map.get(studentId) || '';
}

/** Cites que se solapen amb un interval donat. */
export function overlapping(state, start, end, ignoreId = '') {
  return state.appointments.filter((a) => {
    if (a.annulled || a.id === ignoreId) return false;
    if (a.state === 'anullada') return false;
    return a.start < end && a.end > start;
  });
}

/** Comprova si un interval cau dins de les franges de disponibilitat. */
export function withinAvailability(state, start, end) {
  const slots = state.settings.calendar?.availability || [];
  if (!slots.length) return true;
  const d = new Date(start);
  const day = d.getDay();
  const from = minutesOfDay(start);
  const to = minutesOfDay(end);
  return slots.some((s) => {
    if (Number(s.day) !== day) return false;
    const [fh, fm] = s.from.split(':').map(Number);
    const [th, tm] = s.to.split(':').map(Number);
    return from >= fh * 60 + fm && to <= th * 60 + tm;
  });
}

/** Nombre de no presentacions d'un alumne/a. */
export function noShowCount(state, studentId) {
  return state.appointments.filter((a) => !a.annulled && a.state === 'noPresentada' && a.studentIds?.includes(studentId)).length;
}

/* -------------------------------------------------------------------------
   Suggeriments per a l'emplenament automàtic
   ------------------------------------------------------------------------- */

/** Tipus de registre més recent o més freqüent per a un alumne/a. */
export function suggestRecordType(state, studentId) {
  const list = recordsOf(state, studentId);
  if (!list.length) return 'entrevistaFamilia';
  return list[0].type || mode(list.map((r) => r.type)) || 'entrevistaFamilia';
}

/** Participants més habituals en els registres d'un alumne/a. */
export function suggestParticipants(state, studentId) {
  const list = recordsOf(state, studentId);
  if (!list.length) return [];
  return list[0].participants || [];
}

/** Servei extern més utilitzat per a un alumne/a. */
export function suggestService(state, studentId) {
  const list = recordsOf(state, studentId).map((r) => r.serviceId).filter(Boolean);
  if (list.length) return mode(list);
  const link = state.serviceLinks.find((l) => l.studentId === studentId && !l.annulled);
  return link ? link.serviceId : '';
}

/** Conjunt de valors ja existents per a l'autocompletat. */
export function pool(state, kind) {
  switch (kind) {
    case 'participants':
      return unique([
        ...state.records.flatMap((r) => r.participants || []),
        ...state.appointments.flatMap((a) => a.attendees || []),
        ...state.staff.filter((p) => !p.annulled).map((p) => p.name),
        ...state.students.map((s) => s.tutorName),
      ]);
    case 'diagnoses':
      return unique(state.students.flatMap((s) => (s.health?.diagnoses || []).map((d) => d.text)));
    case 'measures':
      return unique(state.students.flatMap((s) => (s.nese?.measures || []).map((m) => m.text)));
    case 'professionals':
      return unique([
        ...state.services.map((s) => s.contact),
        ...state.staff.map((p) => p.name),
        ...state.students.flatMap((s) => (s.health?.diagnoses || []).map((d) => d.pro)),
      ]);
    case 'services':
      return unique(state.services.filter((s) => !s.annulled).map((s) => s.name));
    case 'locations':
      return unique(state.appointments.map((a) => a.location));
    case 'tags':
      return unique(state.students.flatMap((s) => s.tags || []));
    case 'tutors':
      return tutors(state);
    case 'levels':
      return levels(state);
    case 'groups':
      return groups(state);
    default:
      return [];
  }
}

/* -------------------------------------------------------------------------
   Tasques, alertes i compliment
   ------------------------------------------------------------------------- */

/** Tasques vives, opcionalment d'un alumne/a. */
export function tasksOf(state, studentId = '') {
  return sortBy(
    state.tasks.filter((t) => !t.annulled && (!studentId || t.studentId === studentId)),
    (t) => t.due || '9999-12-31',
  );
}

/** Tasques pendents vençudes. */
export function overdueTasks(state) {
  const now = today();
  return tasksOf(state).filter((t) => t.state !== 'fet' && t.state !== 'anullat' && t.due && t.due < now);
}

/** Revisions de PI vençudes o properes. */
export function piReviews(state, warnDays = 30) {
  const out = [];
  for (const s of state.students) {
    if (s.annulled || !s.nese?.pi?.has || !s.nese.pi.review) continue;
    const left = daysUntil(s.nese.pi.review);
    if (left === null) continue;
    if (left < 0) out.push({ student: s, date: s.nese.pi.review, days: left, overdue: true });
    else if (left <= warnDays) out.push({ student: s, date: s.nese.pi.review, days: left, overdue: false });
  }
  return sortBy(out, (x) => x.date);
}

/** Derivacions enviades sense resposta registrada. */
export function pendingReferrals(state) {
  return sortBy(
    state.referrals.filter((r) => !r.annulled && ['enviada', 'enEspera', 'acceptada'].includes(r.state) && !r.resolvedAt),
    (r) => r.requestedAt,
  );
}

/** Derivacions sense consentiment familiar registrat. */
export function referralsWithoutConsent(state) {
  return state.referrals.filter((r) => {
    if (r.annulled || r.state === 'preparacio') return false;
    if (r.consentId && state.consents.some((c) => c.id === r.consentId && !c.annulled && !c.revoked)) return false;
    return !state.consents.some((c) => c.studentId === r.studentId && !c.annulled && !c.revoked
      && ['derivacio', 'comunicacioServeis'].includes(c.type));
  });
}

/** Demandes sense primera actuació registrada. */
export function demandsWithoutAction(state) {
  return sortBy(
    state.demands.filter((d) => !d.annulled && !d.firstActionAt && d.state !== 'desestimada'),
    (d) => d.receivedAt,
  );
}

/** Alumnat sense contacte des de fa més de N dies. */
export function noContactStudents(state, days) {
  const threshold = Number(days) || state.settings.thresholds?.noContactDays || 45;
  return allStudents(state)
    .filter((s) => ['actiu', 'seguiment'].includes(s.status?.value))
    .map((s) => {
      const last = lastContactDate(state, s.id);
      return { student: s, last, days: last ? daysSince(last) : null };
    })
    .filter((x) => x.days === null || x.days >= threshold)
    .sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999));
}

/** Resum del panell de compliment. */
export function compliance(state) {
  return cached('compliance', () => {
    const th = state.settings.thresholds || {};
    const pi = piReviews(state, th.piWarnDays ?? 30);
    return {
      piOverdue: pi.filter((x) => x.overdue),
      piSoon: pi.filter((x) => !x.overdue),
      agreementsOverdue: overdueTasks(state),
      referralsPending: pendingReferrals(state),
      consentsMissing: referralsWithoutConsent(state),
      contactGap: noContactStudents(state, th.noContactDays ?? 45),
      demandsUnanswered: demandsWithoutAction(state),
      chainGaps: allStudents(state)
        .filter((s) => ['actiu', 'seguiment'].includes(s.status?.value))
        .map((s) => ({ student: s, chain: chainOf(state, s.id) }))
        .filter((x) => x.chain.some((step) => step.status === 'buit' && step.expected)),
    };
  });
}

/**
 * Nombre total d'elements pendents, per al distintiu de navegació.
 * Es calcula amb les llistes barates: el distintiu es repinta a cada canvi
 * i no val la pena recórrer la cadena documental de tot l'alumnat.
 */
export function alertCount(state) {
  return cached('alertCount', () => piReviews(state, state.settings.thresholds?.piWarnDays ?? 30).filter((x) => x.overdue).length
    + overdueTasks(state).length
    + pendingReferrals(state).length
    + demandsWithoutAction(state).length);
}

/* -------------------------------------------------------------------------
   Cadena documental del cas
   ------------------------------------------------------------------------- */

/**
 * Reconstrueix la seqüència preceptiva d'un cas. Cada baula indica data,
 * responsable, document associat i estat. Els buits es marquen per resoldre'ls
 * abans d'una revisió externa.
 */
export function chainOf(state, studentId) {
  const student = state.students.find((s) => s.id === studentId);
  const records = recordsOf(state, studentId).slice().reverse();
  const demands = state.demands.filter((d) => !d.annulled && d.studentId === studentId);
  const consents = state.consents.filter((c) => !c.annulled && c.studentId === studentId);
  const referrals = state.referrals.filter((r) => !r.annulled && r.studentId === studentId);
  const byType = (types) => records.filter((r) => types.includes(r.type));

  const first = (list, dateFn) => {
    const sorted = sortBy(list, dateFn);
    return sorted[0] || null;
  };

  const steps = [];
  /**
   * Afegeix una baula. `docEnum` i `whoEnum` indiquen el grup d'enumeració
   * amb què la capa de presentació ha de traduir els valors.
   */
  const push = (key, item, {
    date, who, doc, expected = true, extra = '', docEnum = '', whoEnum = '',
  }) => {
    steps.push({
      key,
      status: item ? 'fet' : 'buit',
      date: item ? date : '',
      who: item ? who : '',
      doc: item ? doc : '',
      docEnum,
      whoEnum,
      extra,
      expected,
      refId: item?.id || '',
    });
  };

  const demand = first(demands, (d) => d.receivedAt);
  push('demanda', demand, {
    date: demand?.receivedAt, who: demand?.assignedTo, doc: demand?.origin, docEnum: 'demandOrigin',
  });

  const info = byType(['coordinacioDocent', 'observacioAula', 'entrevistaFamilia'])[0];
  push('informacio', info, { date: dateOf(info?.at), who: info?.author, doc: info?.type, docEnum: 'recordType' });

  const consent = first(consents, (c) => c.obtainedAt);
  push('consentiment', consent, {
    date: consent?.obtainedAt, who: consent?.via, whoEnum: 'consentVia',
    doc: consent?.type, docEnum: 'consentType',
  });

  const assess = byType(['provaInstrument'])[0];
  push('valoracio', assess, { date: dateOf(assess?.at), who: assess?.author, doc: assess?.content?.slice(0, 60) });

  const measures = student?.nese?.measures || [];
  const measure = measures.length ? { id: 'measures' } : null;
  push('decisio', measure, {
    date: measures[0]?.date, who: '', doc: `${measures.length}`,
    extra: measures.map((m) => m.text).filter(Boolean).join('; '),
  });

  const comm = byType(['entrevistaFamilia', 'coordinacioDocent']).find((r) => (r.agreements || []).length);
  push('comunicacio', comm, { date: dateOf(comm?.at), who: comm?.author, doc: comm?.type, docEnum: 'recordType' });

  const referral = first(referrals, (r) => r.requestedAt);
  const referralExpected = referrals.length > 0 || byType(['derivacio']).length > 0;
  push('derivacio', referral, {
    date: referral?.requestedAt, who: referral?.serviceName,
    doc: referral?.state, docEnum: 'referralState', expected: referralExpected,
  });

  const followUps = byType(['entrevistaFamilia', 'entrevistaAlumne', 'coordinacioDocent', 'coordinacioExtern', 'tutoriaIndividual']);
  const follow = followUps.length >= 2 ? followUps[followUps.length - 1] : null;
  push('seguiment', follow, { date: dateOf(follow?.at), who: follow?.author, doc: `${followUps.length}` });

  const pi = student?.nese?.pi;
  const review = pi?.has && pi.review ? { id: 'pi' } : null;
  push('revisio', review, { date: pi?.review, who: '', doc: '', expected: Boolean(pi?.has) });

  const closed = ['tancat', 'traspassat'].includes(student?.status?.value) ? { id: 'status' } : null;
  push('tancament', closed, {
    date: student?.status?.date, who: '', doc: student?.status?.reason,
    expected: ['tancat', 'traspassat'].includes(student?.status?.value),
  });

  return steps.sort((a, b) => CHAIN_STEPS.indexOf(a.key) - CHAIN_STEPS.indexOf(b.key));
}

/* -------------------------------------------------------------------------
   Serveis
   ------------------------------------------------------------------------- */

/** Serveis vinculats a un alumne/a amb la informació de la vinculació. */
export function servicesOf(state, studentId) {
  return state.serviceLinks
    .filter((l) => !l.annulled && l.studentId === studentId)
    .map((l) => ({ link: l, service: state.services.find((s) => s.id === l.serviceId) }))
    .filter((x) => x.service && !x.service.annulled);
}

/** Alumnat vinculat a un servei. */
export function studentsOfService(state, serviceId) {
  return state.serviceLinks
    .filter((l) => !l.annulled && l.serviceId === serviceId)
    .map((l) => ({ link: l, student: state.students.find((s) => s.id === l.studentId) }))
    .filter((x) => x.student && !x.student.annulled);
}

/** Referents familiars d'un alumne/a. */
export function guardiansOf(state, studentId) {
  return state.guardians.filter((g) => !g.annulled && g.studentId === studentId);
}

/* -------------------------------------------------------------------------
   Cerca global
   ------------------------------------------------------------------------- */

/** Cerca transversal per a la paleta ràpida. */
export function search(state, query, presentation = false) {
  if (!query || query.length < 2) return [];
  const out = [];

  for (const s of allStudents(state)) {
    if (matches(`${s.name} ${s.surname} ${s.group} ${s.tutorName}`, query)) {
      out.push({ kind: 'student', id: s.id, title: listName(s, presentation), meta: [s.level, s.group].filter(Boolean).join(' · ') });
    }
    if (out.length > 40) break;
  }

  for (const a of state.appointments) {
    if (a.annulled) continue;
    const names = (a.studentIds || []).map((id) => listName(state.students.find((s) => s.id === id), presentation)).join(' ');
    if (matches(`${names} ${a.location} ${a.notes}`, query)) {
      out.push({ kind: 'appointment', id: a.id, title: names || a.type, meta: `${dateOf(a.start)} ${String(a.start).slice(11, 16)}` });
    }
    if (out.length > 60) break;
  }

  for (const r of state.records) {
    if (r.annulled) continue;
    if (matches(r.content, query)) {
      const names = (r.studentIds || []).map((id) => listName(state.students.find((s) => s.id === id), presentation)).join(' ');
      out.push({ kind: 'record', id: r.id, title: names || 'Registre', meta: dateOf(r.at), studentId: r.studentIds?.[0] });
    }
    if (out.length > 80) break;
  }

  return out.slice(0, 30);
}

/* -------------------------------------------------------------------------
   Escriptori
   ------------------------------------------------------------------------- */

/** Dades del panell inicial. */
export function dashboard(state) {
  const now = today();
  const weekStart = toISODate(startOfWeek(now));
  const weekEnd = toISODate(addDays(weekStart, 6));
  const todayAppointments = appointmentsInRange(state, now, now);
  const weekAppointments = appointmentsInRange(state, weekStart, weekEnd);
  const weekRecords = recordsInRange(state, weekStart, weekEnd);
  const minutes = weekAppointments
    .filter((a) => a.state !== 'anullada')
    .reduce((acc, a) => acc + durationMinutes(a.start, a.end), 0);

  return {
    todayAppointments,
    weekAppointments,
    weekRecords,
    weekHours: Math.round((minutes / 60) * 10) / 10,
    openCases: allStudents(state).filter((s) => ['actiu', 'seguiment'].includes(s.status?.value)).length,
    compliance: compliance(state),
  };
}

/** Distribució de cites per dia, per a la densitat de la vista de mes. */
export function appointmentsByDay(state, from, to, filters) {
  return groupBy(appointmentsInRange(state, from, to, filters), (a) => dateOf(a.start));
}

/** Recompte d'intervencions per tipus dins d'un període. */
export function recordTypeCounts(state, from, to) {
  return countBy(recordsInRange(state, from, to), (r) => r.type);
}
