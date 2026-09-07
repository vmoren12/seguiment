/**
 * stats.js - càlcul d'indicadors amb memorització.
 * Els resultats es guarden en memòria fins que canvia la revisió de l'estat,
 * de manera que canviar de període no torna a recórrer totes les entitats.
 */
import { getRevision } from '../core/store.js';
import {
  countBy, sum, pct, unique, sortBy,
} from '../core/util.js';
import {
  dateOf, inRange, monthsBetween, monthKey, durationMinutes, diffDays,
  daysSince, today,
} from '../core/dates.js';
import { allStudents, lastContactDate, chainOf } from './selectors.js';

const cache = new Map();
let cachedRevision = -1;

function cached(key, compute) {
  const revision = getRevision();
  if (revision !== cachedRevision) { cache.clear(); cachedRevision = revision; }
  if (cache.has(key)) return cache.get(key);
  const value = compute();
  cache.set(key, value);
  if (cache.size > 120) cache.delete(cache.keys().next().value);
  return value;
}

/** Buida la memòria de càlcul (útil en importar dades). */
export function invalidate() { cache.clear(); cachedRevision = -1; }

const inPeriod = (value, period) => inRange(value, period.from, period.to);

/* -------------------------------------------------------------------------
   Indicadors per alumne
   ------------------------------------------------------------------------- */

export function studentStats(state, studentId, period) {
  return cached(`st|${studentId}|${period.from}|${period.to}`, () => {
    const records = state.records.filter((r) => !r.annulled && r.studentIds?.includes(studentId) && inPeriod(r.at, period));
    const appointments = state.appointments.filter((a) => !a.annulled && a.studentIds?.includes(studentId) && inPeriod(a.start, period));
    const agreements = records.flatMap((r) => (r.agreements || []).map((a) => ({ ...a, recordAt: r.at })));
    const demands = state.demands.filter((d) => !d.annulled && d.studentId === studentId);
    const referrals = state.referrals.filter((r) => !r.annulled && r.studentId === studentId);
    const student = state.students.find((s) => s.id === studentId);

    const byType = countBy(records, (r) => r.type);
    const months = monthsBetween(period.from, period.to);
    const perMonth = months.map((m) => ({
      key: m,
      value: records.filter((r) => monthKey(dateOf(r.at)) === m).length,
    }));

    const serviceCounts = countBy(records.filter((r) => r.serviceId), (r) => r.serviceId);
    const done = appointments.filter((a) => a.state === 'feta').length;
    const noShow = appointments.filter((a) => a.state === 'noPresentada').length;
    const cancelled = appointments.filter((a) => a.state === 'anullada').length;
    const scheduled = appointments.length;

    const closedInTime = agreements.filter((a) => a.state === 'fet' && (!a.due || true)).length;
    const overdue = agreements.filter((a) => a.state !== 'fet' && a.due && a.due < today()).length;

    const firstDemand = sortBy(demands, (d) => d.receivedAt)[0];
    const firstAction = firstDemand?.firstActionAt;
    const firstMeasure = sortBy(student?.nese?.measures || [], (m) => m.date)[0];

    return {
      total: records.length,
      byType: [...byType.entries()].map(([key, value]) => ({ key, value })),
      perMonth,
      services: [...serviceCounts.entries()].map(([key, value]) => ({
        key,
        label: state.services.find((s) => s.id === key)?.name || key,
        value,
      })),
      appointments: { scheduled, done, noShow, cancelled },
      attendanceRate: pct(done, done + noShow),
      agreements: { total: agreements.length, done: closedInTime, overdue },
      agreementsRate: pct(closedInTime, agreements.length),
      times: {
        demandToAction: firstDemand && firstAction ? diffDays(firstDemand.receivedAt, firstAction) : null,
        actionToMeasure: firstAction && firstMeasure?.date ? diffDays(firstAction, firstMeasure.date) : null,
      },
      referrals: { total: referrals.length, resolved: referrals.filter((r) => r.resolvedAt).length },
      chainGaps: chainOf(state, studentId).filter((s) => s.status === 'buit' && s.expected).length,
    };
  });
}

/** Cronologia compacta del cas sencer (sense limitació de període). */
export function caseTimeline(state, studentId) {
  return cached(`tl|${studentId}`, () => {
    const items = [];
    state.demands.filter((d) => !d.annulled && d.studentId === studentId)
      .forEach((d) => items.push({ date: d.receivedAt, kind: 'demand', title: d.motive || 'Demanda', meta: d.origin }));
    state.consents.filter((c) => !c.annulled && c.studentId === studentId)
      .forEach((c) => items.push({ date: c.obtainedAt, kind: 'consent', title: c.type, meta: c.via }));
    state.referrals.filter((r) => !r.annulled && r.studentId === studentId)
      .forEach((r) => items.push({ date: r.requestedAt, kind: 'referral', title: r.serviceName || 'Derivació', meta: r.state }));
    state.records.filter((r) => !r.annulled && r.studentIds?.includes(studentId))
      .forEach((r) => items.push({ date: dateOf(r.at), kind: 'record', title: r.type, meta: r.author, id: r.id }));
    state.appointments.filter((a) => !a.annulled && a.studentIds?.includes(studentId))
      .forEach((a) => items.push({ date: dateOf(a.start), kind: 'appointment', title: a.type, meta: a.state, id: a.id }));
    return sortBy(items, (x) => x.date);
  });
}

/* -------------------------------------------------------------------------
   Indicadors per grup i nivell
   ------------------------------------------------------------------------- */

export function groupStats(state, period) {
  return cached(`gr|${period.from}|${period.to}`, () => {
    const students = allStudents(state);
    const records = state.records.filter((r) => !r.annulled && inPeriod(r.at, period));
    const recordsByStudent = new Map();
    records.forEach((r) => (r.studentIds || []).forEach((id) => {
      recordsByStudent.set(id, (recordsByStudent.get(id) || 0) + 1);
    }));

    const groupNames = unique(students.map((s) => s.group)).sort();
    const rows = groupNames.map((name) => {
      const inGroup = students.filter((s) => s.group === name);
      const open = inGroup.filter((s) => ['actiu', 'seguiment'].includes(s.status?.value));
      const volume = sum(inGroup, (s) => recordsByStudent.get(s.id) || 0);
      const level = inGroup[0]?.level || '';
      return {
        name,
        level,
        students: inGroup.length,
        open: open.length,
        coverage: pct(open.length, inGroup.length),
        volume,
        withPi: inGroup.filter((s) => s.nese?.pi?.has).length,
        piOverdue: inGroup.filter((s) => s.nese?.pi?.has && s.nese.pi.review && s.nese.pi.review < today()).length,
        referrals: state.referrals.filter((r) => !r.annulled && inGroup.some((s) => s.id === r.studentId) && inPeriod(r.requestedAt, period)).length,
        referralsResolved: state.referrals.filter((r) => !r.annulled && r.resolvedAt && inGroup.some((s) => s.id === r.studentId)).length,
      };
    });

    const byLevel = new Map();
    rows.forEach((row) => {
      const key = row.level || '—';
      const acc = byLevel.get(key) || { level: key, students: 0, open: 0, volume: 0, groups: 0 };
      acc.students += row.students; acc.open += row.open; acc.volume += row.volume; acc.groups += 1;
      byLevel.set(key, acc);
    });

    return {
      rows: sortBy(rows, (r) => r.name),
      byLevel: [...byLevel.values()],
      nese: [...countBy(students, (s) => s.nese?.category || 'cap').entries()].map(([key, value]) => ({ key, value })),
      measures: [...countBy(students.flatMap((s) => s.nese?.measures || []), (m) => m.type).entries()].map(([key, value]) => ({ key, value })),
      silent: rows.filter((r) => r.volume === 0).map((r) => r.name),
      top: sortBy(rows, (r) => r.volume, 'desc').slice(0, 8),
    };
  });
}

/* -------------------------------------------------------------------------
   Indicadors globals de centre
   ------------------------------------------------------------------------- */

export function centreStats(state, period) {
  return cached(`ce|${period.from}|${period.to}`, () => {
    const students = allStudents(state);
    const records = state.records.filter((r) => !r.annulled && inPeriod(r.at, period));
    const appointments = state.appointments.filter((a) => !a.annulled && inPeriod(a.start, period));
    const demands = state.demands.filter((d) => !d.annulled && inPeriod(d.receivedAt, period));
    const referrals = state.referrals.filter((r) => !r.annulled && inPeriod(r.requestedAt, period));

    const attended = unique(records.flatMap((r) => r.studentIds || []));
    const months = monthsBetween(period.from, period.to);
    const perMonth = months.map((m) => ({
      key: m,
      value: records.filter((r) => monthKey(dateOf(r.at)) === m).length,
    }));

    const responseTimes = demands
      .filter((d) => d.firstActionAt)
      .map((d) => diffDays(d.receivedAt, d.firstActionAt))
      .filter((n) => n !== null && n >= 0);

    const minutes = appointments.filter((a) => a.state !== 'anullada')
      .reduce((acc, a) => acc + durationMinutes(a.start, a.end), 0);
    const weeks = Math.max(1, Math.round((diffDays(period.from, period.to) || 7) / 7));

    const serviceCounts = countBy(
      state.serviceLinks.filter((l) => !l.annulled),
      (l) => l.serviceId,
    );

    const agreements = records.flatMap((r) => r.agreements || []);
    const doneAgreements = agreements.filter((a) => a.state === 'fet').length;

    return {
      totalStudents: students.length,
      attended: attended.length,
      openCases: students.filter((s) => ['actiu', 'seguiment'].includes(s.status?.value)).length,
      records: records.length,
      perMonth,
      byType: [...countBy(records, (r) => r.type).entries()].map(([key, value]) => ({ key, value })),
      nese: [...countBy(students, (s) => s.nese?.category || 'cap').entries()].map(([key, value]) => ({ key, value })),
      gender: [...countBy(students, (s) => s.gender || 'noConsta').entries()].map(([key, value]) => ({ key, value })),
      level: [...countBy(students, (s) => s.level || '—').entries()].map(([key, value]) => ({ key, value })),
      demandOrigin: [...countBy(demands, (d) => d.origin).entries()].map(([key, value]) => ({ key, value })),
      demands: demands.length,
      avgResponse: responseTimes.length ? Math.round((sum(responseTimes) / responseTimes.length) * 10) / 10 : null,
      hours: Math.round((minutes / 60) * 10) / 10,
      perWeek: Math.round((records.length / weeks) * 10) / 10,
      appointments: {
        total: appointments.length,
        done: appointments.filter((a) => a.state === 'feta').length,
        noShow: appointments.filter((a) => a.state === 'noPresentada').length,
        cancelled: appointments.filter((a) => a.state === 'anullada').length,
      },
      services: [...serviceCounts.entries()].map(([key, value]) => ({
        key, label: state.services.find((s) => s.id === key)?.name || key, value,
      })).sort((a, b) => b.value - a.value),
      agreements: { total: agreements.length, done: doneAgreements, rate: pct(doneAgreements, agreements.length) },
      referrals: {
        total: referrals.length,
        pending: referrals.filter((r) => !r.resolvedAt && r.state !== 'preparacio').length,
        resolved: referrals.filter((r) => r.resolvedAt).length,
      },
      piOverdue: students.filter((s) => s.nese?.pi?.has && s.nese.pi.review && s.nese.pi.review < today()).length,
      noContact: students.filter((s) => {
        if (!['actiu', 'seguiment'].includes(s.status?.value)) return false;
        const last = lastContactDate(state, s.id);
        const gap = last ? daysSince(last) : Infinity;
        return gap >= (state.settings.thresholds?.noContactDays ?? 45);
      }).length,
    };
  });
}
