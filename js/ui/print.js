/**
 * print.js - generació de documents imprimibles.
 * El contingut es construeix a #print-root i només es mostra en imprimir
 * (@media print), de manera que la sortida no arrossega cap element d'interfície.
 */
import { html, toHTML } from './dom.js';
import { t, tEnum, fmtDate, fmtDateTime, fmtDateLong, fmtNum, fmtTime } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as sel from '../domain/selectors.js';
import { studentStats, centreStats, groupStats, caseTimeline } from '../domain/stats.js';
import { columnChart, dataTable } from './components/charts.js';
import { today, age, schoolYearRange } from '../core/dates.js';
import { chainDoc, chainWho, timelineTitle } from './labels.js';

const root = () => document.getElementById('print-root');

/** Portada comuna a tots els documents. */
function cover(state, { title, subtitle, extra = [] }) {
  const centre = state.settings.centre || {};
  return html`<header class="doc__cover">
    <p class="doc__kicker">${centre.name || t('app.name')}${centre.code ? ` · ${centre.code}` : ''}</p>
    <h1>${title}</h1>
    ${subtitle ? html`<p class="doc__meta"><b>${subtitle}</b></p>` : ''}
    <div class="doc__meta">
      ${centre.address ? html`<div>${centre.address}</div>` : ''}
      <div>${t('settings.schoolYear')}: ${centre.schoolYear || '—'}</div>
      <div>${t('settings.professionalName')}: ${centre.professional || '—'}</div>
      ${extra.map((line) => html`<div>${line}</div>`)}
      <div>${t('documents.generatedAt', { d: fmtDateLong(today()) })}</div>
    </div>
  </header>`;
}

function foot(state) {
  const centre = state.settings.centre || {};
  return html`<footer class="doc__foot">
    <p>${centre.name || ''} · ${t('documents.generatedAt', { d: fmtDateTime(new Date()) })}</p>
    <p>${t('app.privacy')} ${t('settings.legalText').slice(0, 180)}…</p>
  </footer>`;
}

function studentIdentity(state, s) {
  return html`<section class="doc__section doc__avoid">
    <h2>${t('students.tabs.summary')}</h2>
    <dl class="doc__dl">
      <dt>${t('common.name')}</dt><dd>${sel.fullName(s, false)}</dd>
      <dt>${t('students.fields.birth')}</dt><dd>${s.birth ? `${fmtDate(s.birth)} (${age(s.birth)} anys)` : '—'}</dd>
      <dt>${t('students.fields.level')} / ${t('students.fields.group')}</dt><dd>${[s.level, s.group].filter(Boolean).join(' · ') || '—'}</dd>
      <dt>${t('students.fields.tutors')}</dt><dd>${sel.tutorLabel(s) || '—'}</dd>
      <dt>${t('students.fields.tutorIndividual')}</dt><dd>${s.tutorIndividual || '—'}</dd>
      <dt>${t('students.fields.enrolled')}</dt><dd>${s.enrolled ? fmtDate(s.enrolled) : '—'}</dd>
      <dt>${t('students.fields.status')}</dt><dd>${tEnum('fileState', s.status?.value)}${s.status?.date ? ` (${fmtDate(s.status.date)})` : ''}</dd>
      <dt>${t('students.fields.neseCategory')}</dt><dd>${tEnum('nese', s.nese?.category)}</dd>
      <dt>${t('students.fields.report')}</dt><dd>${s.nese?.report?.has
    ? `${t('common.yes')} — ${fmtDate(s.nese.report.date)}${s.nese.report.ref ? ` · ${s.nese.report.ref}` : ''}`
    : t('common.no')}</dd>
      <dt>${t('students.fields.pi')}</dt><dd>${s.nese?.pi?.has
    ? `${t('common.yes')} — ${t('students.fields.piApproved')}: ${fmtDate(s.nese.pi.approved) || '—'} · ${t('students.fields.piReview')}: ${fmtDate(s.nese.pi.review) || '—'}`
    : t('common.no')}</dd>
    </dl>
  </section>`;
}

function measuresTable(state, s) {
  const measures = s.nese?.measures || [];
  if (!measures.length) return html`<p class="doc__note">${t('common.empty')}</p>`;
  const normative = (id) => (state.settings.normative || []).find((n) => n.id === id);
  return html`<table>
    <thead><tr><th>${t('students.measureText')}</th><th>${t('students.measureType')}</th><th>${t('common.date')}</th><th>${t('students.measureNorm')}</th></tr></thead>
    <tbody>${measures.map((m) => html`<tr>
      <td>${m.text}</td><td>${tEnum('measure', m.type)}</td><td>${m.date ? fmtDate(m.date) : '—'}</td>
      <td>${normative(m.normativeId) ? `${normative(m.normativeId).ref} — ${normative(m.normativeId).title}` : '—'}</td>
    </tr>`)}</tbody>
  </table>`;
}

function recordsTable(state, s, period) {
  const records = sel.recordsOf(state, s.id)
    .filter((r) => !period || (r.at >= period.from && r.at <= `${period.to}T23:59`))
    .reverse();
  if (!records.length) return html`<p class="doc__note">${t('records.empty')}</p>`;
  return html`<table>
    <thead><tr><th>${t('common.date')}</th><th>${t('common.type')}</th><th>${t('common.participants')}</th><th>${t('common.content')}</th></tr></thead>
    <tbody>${records.map((r) => html`<tr>
      <td>${fmtDate(r.at)}</td>
      <td>${tEnum('recordType', r.type)}</td>
      <td>${(r.participants || []).join(', ') || '—'}</td>
      <td>${r.confidentiality === 'restringit' ? `[${t('records.restricted')}]` : r.content}</td>
    </tr>`)}</tbody>
  </table>`;
}

function consentsTable(state, s) {
  const list = state.consents.filter((c) => !c.annulled && c.studentId === s.id);
  if (!list.length) return html`<p class="doc__note">${t('casework.emptyConsents')}</p>`;
  return html`<table>
    <thead><tr><th>${t('casework.consentType')}</th><th>${t('casework.obtainedAt')}</th><th>${t('casework.via')}</th><th>${t('common.document')}</th><th>${t('casework.scope')}</th></tr></thead>
    <tbody>${list.map((c) => html`<tr>
      <td>${tEnum('consentType', c.type)}</td><td>${fmtDate(c.obtainedAt)}</td>
      <td>${tEnum('consentVia', c.via)}</td><td>${c.document || '—'}</td><td>${c.scope || '—'}</td>
    </tr>`)}</tbody>
  </table>`;
}

function referralsTable(state, s) {
  const list = state.referrals.filter((r) => !r.annulled && r.studentId === s.id);
  if (!list.length) return html`<p class="doc__note">${t('casework.emptyReferrals')}</p>`;
  return html`<table>
    <thead><tr><th>${t('casework.destination')}</th><th>${t('casework.requestedAt')}</th><th>${t('common.state')}</th><th>${t('casework.response')}</th><th>${t('casework.resolvedAt')}</th></tr></thead>
    <tbody>${list.map((r) => html`<tr>
      <td>${r.serviceName || store.find('services', r.serviceId)?.name || '—'}</td>
      <td>${fmtDate(r.requestedAt)}</td><td>${tEnum('referralState', r.state)}</td>
      <td>${r.response || '—'}</td><td>${r.resolvedAt ? fmtDate(r.resolvedAt) : '—'}</td>
    </tr>`)}</tbody>
  </table>`;
}

function chainTable(state, s) {
  const chain = sel.chainOf(state, s.id);
  return html`<table>
    <thead><tr><th>${t('common.state')}</th><th>${t('chain.title')}</th><th>${t('common.date')}</th><th>${t('common.responsible')}</th><th>${t('common.document')}</th></tr></thead>
    <tbody>${chain.map((step) => html`<tr>
      <td>${step.status === 'fet' ? '✓' : step.expected ? '—' : ''}</td>
      <td>${t(`chain.steps.${step.key}`)}</td>
      <td>${step.date ? fmtDate(step.date) : (step.expected ? t('chain.missing') : '')}</td>
      <td>${chainWho(step)}</td>
      <td>${chainDoc(step)}</td>
    </tr>`)}</tbody>
  </table>`;
}

function timelineTable(state, s) {
  const items = caseTimeline(state, s.id);
  if (!items.length) return html`<p class="doc__note">${t('records.empty')}</p>`;
  const kindLabel = {
    demand: t('casework.demands'), consent: t('casework.consents'),
    referral: t('casework.referrals'), record: t('records.title'), appointment: t('agenda.title'),
  };
  return html`<table>
    <thead><tr><th>${t('common.date')}</th><th>${t('common.type')}</th><th>${t('common.description')}</th><th>${t('common.details')}</th></tr></thead>
    <tbody>${items.map((i) => html`<tr>
      <td>${fmtDate(i.date)}</td>
      <td>${kindLabel[i.kind]}</td>
      <td>${timelineTitle(i)}</td>
      <td>${i.meta || ''}</td>
    </tr>`)}</tbody>
  </table>`;
}

/* -------------------------------------------------------------------------
   Documents
   Cada document declara la portada i la llista d'apartats. Els apartats són
   triables des de la vista de documents: `renderDocument` només dibuixa els
   que rep a `options.sections`. Cada `render` es crida mandrosament, de
   manera que llistar els apartats no calcula res.
   ------------------------------------------------------------------------- */

const student = (studentId) => store.find('students', studentId);

const DOCS = {

  /** Informe de seguiment d'un alumne/a en un període. */
  followUp: {
    cover: (state, { studentId, period }) => ({
      title: t('documents.types.followUp'),
      subtitle: sel.fullName(student(studentId), false),
      extra: [`${t('common.period')}: ${fmtDate(period.from)} – ${fmtDate(period.to)}`],
    }),
    sections: [
      {
        key: 'identity',
        label: () => t('students.tabs.summary'),
        bare: true,
        render: (state, { studentId }) => studentIdentity(state, student(studentId)),
      },
      {
        key: 'measures',
        label: () => t('students.fields.measures'),
        render: (state, { studentId }) => measuresTable(state, student(studentId)),
      },
      {
        key: 'records',
        label: () => t('records.title'),
        render: (state, { studentId, period }) => recordsTable(state, student(studentId), period),
      },
      {
        key: 'stats',
        label: () => t('students.tabs.stats'),
        avoid: true,
        render: (state, { studentId, period }) => {
          const stats = studentStats(state, studentId, period);
          return html`
            <dl class="doc__dl">
              <dt>${t('stats.byType')}</dt><dd>${stats.total} ${t('records.title').toLowerCase()}</dd>
              <dt>${t('stats.attendanceRate')}</dt><dd>${fmtNum(stats.attendanceRate)} %</dd>
              <dt>${t('stats.agreementsRate')}</dt><dd>${fmtNum(stats.agreementsRate)} % (${stats.agreements.done}/${stats.agreements.total})</dd>
            </dl>
            ${columnChart(stats.perMonth.map((x) => ({ label: x.key.slice(5), value: x.value })))}`;
        },
      },
    ],
  },

  /** Full de derivació a un servei extern. */
  referral: {
    cover: (state, { studentId }) => ({
      title: t('documents.types.referral'),
      subtitle: sel.fullName(student(studentId), false),
    }),
    sections: [
      {
        key: 'identity',
        label: () => t('students.tabs.summary'),
        bare: true,
        render: (state, { studentId }) => studentIdentity(state, student(studentId)),
      },
      {
        key: 'referral',
        label: () => t('casework.referrals'),
        render: (state, { studentId, referralId }) => {
          const list = state.referrals.filter((x) => !x.annulled && x.studentId === studentId);
          const r = referralId ? store.find('referrals', referralId) : list[list.length - 1];
          const consent = r?.consentId ? store.find('consents', r.consentId) : null;
          if (!r) return html`<p class="doc__note">${t('casework.emptyReferrals')}</p>`;
          return html`<dl class="doc__dl">
            <dt>${t('casework.destination')}</dt><dd>${r.serviceName || store.find('services', r.serviceId)?.name || '—'}</dd>
            <dt>${t('casework.requestedAt')}</dt><dd>${fmtDate(r.requestedAt)}</dd>
            <dt>${t('common.reason')}</dt><dd>${r.motive || '—'}</dd>
            <dt>${t('casework.sentDocs')}</dt><dd>${r.sentDocs || '—'}</dd>
            <dt>${t('casework.consent')}</dt><dd>${consent
    ? `${tEnum('consentType', consent.type)} — ${fmtDate(consent.obtainedAt)} (${tEnum('consentVia', consent.via)})`
    : t('common.no')}</dd>
            <dt>${t('common.state')}</dt><dd>${tEnum('referralState', r.state)}</dd>
          </dl>`;
        },
      },
      {
        key: 'measures',
        label: () => t('students.fields.measures'),
        render: (state, { studentId }) => measuresTable(state, student(studentId)),
      },
      {
        key: 'records',
        label: () => t('records.title'),
        render: (state, { studentId }) => recordsTable(state, student(studentId)),
      },
    ],
  },

  /** Acta d'entrevista a partir d'un registre concret. */
  interview: {
    cover: (state, { recordId }) => {
      const r = store.find('records', recordId);
      const s = student(r?.studentIds?.[0]);
      return {
        title: t('documents.types.interview'),
        subtitle: s ? sel.fullName(s, false) : '',
        extra: [`${t('common.date')}: ${fmtDateTime(r?.at)}`],
      };
    },
    sections: [
      {
        key: 'content',
        label: () => t('common.content'),
        render: (state, { recordId }) => {
          const r = store.find('records', recordId);
          return html`
            <dl class="doc__dl">
              <dt>${t('common.type')}</dt><dd>${tEnum('recordType', r?.type)}</dd>
              <dt>${t('common.participants')}</dt><dd>${(r?.participants || []).join(', ') || '—'}</dd>
              <dt>${t('common.author')}</dt><dd>${r?.author || '—'}</dd>
            </dl>
            <p style="white-space:pre-wrap">${r?.content || ''}</p>`;
        },
      },
      {
        key: 'agreements',
        label: () => t('common.agreements'),
        render: (state, { recordId }) => {
          const r = store.find('records', recordId);
          if (!r?.agreements?.length) return html`<p class="doc__note">${t('common.empty')}</p>`;
          return html`<table>
            <thead><tr><th>${t('records.agreementText')}</th><th>${t('common.responsible')}</th><th>${t('common.deadline')}</th><th>${t('common.state')}</th></tr></thead>
            <tbody>${r.agreements.map((a) => html`<tr><td>${a.text}</td><td>${a.owner || '—'}</td><td>${a.due ? fmtDate(a.due) : '—'}</td><td>${tEnum('taskState', a.state)}</td></tr>`)}</tbody>
          </table>`;
        },
      },
    ],
  },

  /** Convocatòria d'una cita. */
  convocation: {
    cover: (state, { appointmentId }) => {
      const a = store.find('appointments', appointmentId);
      return {
        title: t('documents.types.convocation'),
        subtitle: (a?.studentIds || []).map((id) => sel.fullName(student(id), false)).join(', '),
      };
    },
    sections: [
      {
        key: 'letter',
        label: () => t('documents.sections.letter'),
        heading: false,
        render: (state, { appointmentId }) => {
          const a = store.find('appointments', appointmentId);
          return html`
            <p>Benvolguda família,</p>
            <p>Us convoquem a una entrevista amb el servei d’orientació educativa del centre en les condicions següents:</p>
            <dl class="doc__dl">
              <dt>${t('common.date')}</dt><dd>${fmtDateLong(a?.start)}</dd>
              <dt>${t('common.time')}</dt><dd>${fmtTime(a?.start)} – ${fmtTime(a?.end)}</dd>
              <dt>${t('common.modality')}</dt><dd>${tEnum('modality', a?.modality)}</dd>
              <dt>${t('common.location')}</dt><dd>${a?.location || '—'}</dd>
            </dl>
            <p>Si no us va bé aquesta data, poseu-vos en contacte amb el centre per reprogramar-la.</p>
            <p style="margin-top:24px">${state.settings.centre?.professional || ''}</p>`;
        },
      },
    ],
  },

  /** Resum de cas per a traspàs entre centres o professionals. */
  handover: {
    cover: (state, { studentId }) => ({
      title: t('documents.types.handover'),
      subtitle: sel.fullName(student(studentId), false),
    }),
    sections: [
      {
        key: 'identity',
        label: () => t('students.tabs.summary'),
        bare: true,
        render: (state, { studentId }) => studentIdentity(state, student(studentId)),
      },
      {
        key: 'guardians',
        label: () => t('students.guardians'),
        avoid: true,
        render: (state, { studentId }) => {
          const guardians = sel.guardiansOf(state, studentId);
          if (!guardians.length) return html`<p class="doc__note">${t('common.empty')}</p>`;
          return html`<table>
            <thead><tr><th>${t('common.name')}</th><th>${t('students.kinship')}</th><th>${t('common.phone')}</th><th>${t('common.email')}</th></tr></thead>
            <tbody>${guardians.map((g) => html`<tr><td>${g.name}</td><td>${tEnum('kinship', g.kinship)}</td><td>${g.phone || '—'}</td><td>${g.email || '—'}</td></tr>`)}</tbody>
          </table>`;
        },
      },
      {
        key: 'services',
        label: () => t('services.external'),
        avoid: true,
        render: (state, { studentId }) => {
          const services = sel.servicesOf(state, studentId);
          if (!services.length) return html`<p class="doc__note">${t('services.empty')}</p>`;
          return html`<table>
            <thead><tr><th>${t('services.entity')}</th><th>${t('services.kind')}</th><th>${t('services.contact')}</th><th>${t('services.linkedAt')}</th></tr></thead>
            <tbody>${services.map(({ link, service }) => html`<tr><td>${service.name}</td><td>${tEnum('serviceKind', service.kind)}</td><td>${service.contact || '—'}</td><td>${fmtDate(link.linkedAt)}</td></tr>`)}</tbody>
          </table>`;
        },
      },
      {
        key: 'measures',
        label: () => t('students.fields.measures'),
        render: (state, { studentId }) => measuresTable(state, student(studentId)),
      },
      {
        key: 'timeline',
        label: () => t('stats.timeline'),
        render: (state, { studentId }) => timelineTable(state, student(studentId)),
      },
    ],
  },

  /** Dossier complet d'inspecció per a un alumne/a. */
  inspection: {
    cover: (state, { studentId, period }) => ({
      title: t('documents.types.inspection'),
      subtitle: sel.fullName(student(studentId), false),
      extra: [`${t('common.period')}: ${fmtDate(period.from)} – ${fmtDate(period.to)}`],
    }),
    sections: [
      {
        key: 'index',
        label: () => t('documents.index'),
        avoid: true,
        render: (state, { sectionLabels }) => html`<ol class="doc__toc">${sectionLabels.map((x) => html`<li>${x}</li>`)}</ol>`,
      },
      {
        key: 'identity',
        label: () => t('students.tabs.summary'),
        bare: true,
        render: (state, { studentId }) => studentIdentity(state, student(studentId)),
      },
      {
        key: 'measures',
        label: () => t('students.fields.measures'),
        note: () => 'Mesures adoptades amb la referència normativa que les fonamenta.',
        render: (state, { studentId }) => measuresTable(state, student(studentId)),
      },
      {
        key: 'timeline',
        label: () => t('stats.timeline'),
        render: (state, { studentId }) => timelineTable(state, student(studentId)),
      },
      {
        key: 'consents',
        label: () => t('casework.consents'),
        render: (state, { studentId }) => consentsTable(state, student(studentId)),
      },
      {
        key: 'referrals',
        label: () => t('casework.referrals'),
        render: (state, { studentId }) => referralsTable(state, student(studentId)),
      },
      {
        key: 'chain',
        label: () => t('chain.title'),
        note: () => t('chain.intro'),
        render: (state, { studentId }) => chainTable(state, student(studentId)),
      },
      {
        key: 'stats',
        label: () => t('students.tabs.stats'),
        avoid: true,
        render: (state, { studentId, period }) => {
          const stats = studentStats(state, studentId, period);
          return html`
            <dl class="doc__dl">
              <dt>${t('records.title')}</dt><dd>${stats.total}</dd>
              <dt>${t('stats.attendanceRate')}</dt><dd>${fmtNum(stats.attendanceRate)} %</dd>
              <dt>${t('stats.agreementsRate')}</dt><dd>${fmtNum(stats.agreementsRate)} %</dd>
              <dt>${t('stats.demandToAction')}</dt><dd>${stats.times.demandToAction ?? '—'} ${t('common.days')}</dd>
              <dt>${t('chain.gaps', { n: stats.chainGaps })}</dt><dd>${stats.chainGaps}</dd>
            </dl>
            ${columnChart(stats.perMonth.map((x) => ({ label: x.key.slice(5), value: x.value })))}`;
        },
      },
    ],
  },

  /** Memòria estadística del centre. */
  statistics: {
    cover: (state, { period }) => ({
      title: t('documents.types.statistics'),
      subtitle: t('stats.scopes.centre'),
      extra: [`${t('common.period')}: ${fmtDate(period.from)} – ${fmtDate(period.to)}`],
    }),
    sections: [
      {
        key: 'summary',
        label: () => t('documents.sections.summary'),
        avoid: true,
        render: (state, { period }) => {
          const centre = centreStats(state, period);
          return html`<dl class="doc__dl">
            <dt>${t('common.students')}</dt><dd>${centre.totalStudents}</dd>
            <dt>${t('stats.openCases')}</dt><dd>${centre.openCases}</dd>
            <dt>${t('stats.totalStudents')}</dt><dd>${centre.attended}</dd>
            <dt>${t('records.title')}</dt><dd>${centre.records}</dd>
            <dt>${t('stats.hoursInAppointments')}</dt><dd>${fmtNum(centre.hours, 1)} h</dd>
            <dt>${t('stats.interventionsPerWeek')}</dt><dd>${fmtNum(centre.perWeek, 1)}</dd>
            <dt>${t('stats.avgResponse')}</dt><dd>${centre.avgResponse !== null ? `${fmtNum(centre.avgResponse, 1)} ${t('common.days')}` : '—'}</dd>
            <dt>${t('stats.agreementsDone')}</dt><dd>${centre.agreements.done}/${centre.agreements.total} (${centre.agreements.rate} %)</dd>
          </dl>`;
        },
      },
      {
        key: 'overTime',
        label: () => t('stats.overTime'),
        avoid: true,
        render: (state, { period }) => columnChart(centreStats(state, period).perMonth.map((x) => ({ label: x.key.slice(5), value: x.value }))),
      },
      {
        key: 'byType',
        label: () => t('stats.byType'),
        avoid: true,
        render: (state, { period }) => dataTable(centreStats(state, period).byType.map((x) => ({ label: tEnum('recordType', x.key), value: x.value }))),
      },
      {
        key: 'nese',
        label: () => t('stats.neseDistribution'),
        avoid: true,
        render: (state, { period }) => dataTable(centreStats(state, period).nese.map((x) => ({ label: tEnum('nese', x.key), value: x.value }))),
      },
      {
        key: 'byGroup',
        label: () => t('stats.volumeByGroup'),
        render: (state, { period }) => html`<table>
          <thead><tr><th>${t('common.group')}</th><th>${t('common.level')}</th><th>${t('common.students')}</th><th>${t('stats.openCases')}</th><th>${t('stats.coverage')}</th><th>${t('records.title')}</th><th>PI</th></tr></thead>
          <tbody>${groupStats(state, period).rows.map((r) => html`<tr>
            <td>${r.name}</td><td>${r.level}</td><td>${r.students}</td><td>${r.open}</td>
            <td>${r.coverage} %</td><td>${r.volume}</td><td>${r.withPi}</td>
          </tr>`)}</tbody>
        </table>`,
      },
      {
        key: 'services',
        label: () => t('stats.servicesMap'),
        avoid: true,
        render: (state, { period }) => dataTable(centreStats(state, period).services.map((x) => ({ label: x.label, value: x.value }))),
      },
      {
        key: 'compliance',
        label: () => t('compliance.title'),
        avoid: true,
        render: (state, { period }) => {
          const centre = centreStats(state, period);
          return html`<dl class="doc__dl">
            <dt>${t('stats.piOverdue')}</dt><dd>${centre.piOverdue}</dd>
            <dt>${t('stats.referralsPending')}</dt><dd>${centre.referrals.pending}</dd>
            <dt>${t('stats.noContactList', { n: state.settings.thresholds?.noContactDays ?? 45 })}</dt><dd>${centre.noContact}</dd>
          </dl>`;
        },
      },
    ],
  },

  /** Dossier d'inspecció del conjunt del centre. */
  centreInspection: {
    cover: (state, { period }) => ({
      title: t('documents.types.inspection'),
      subtitle: t('stats.scopes.centre'),
      extra: [
        `${t('common.period')}: ${fmtDate(period.from)} – ${fmtDate(period.to)}`,
        `${t('common.students')}: ${sel.allStudents(state).filter((s) => ['actiu', 'seguiment'].includes(s.status?.value)).length}`,
      ],
    }),
    sections: [
      {
        key: 'students',
        label: () => t('students.title'),
        render: (state) => {
          const students = sel.allStudents(state).filter((s) => ['actiu', 'seguiment'].includes(s.status?.value));
          return html`<table>
            <thead><tr><th>${t('common.name')}</th><th>${t('common.level')}</th><th>NESE</th><th>PI</th><th>${t('students.fields.piReview')}</th><th>${t('chain.title')}</th></tr></thead>
            <tbody>${students.map((s) => {
    const gaps = sel.chainOf(state, s.id).filter((x) => x.status === 'buit' && x.expected).length;
    return html`<tr>
                <td>${sel.listName(s, false)}</td><td>${[s.level, s.group].filter(Boolean).join(' ')}</td>
                <td>${tEnum('nese', s.nese?.category)}</td>
                <td>${s.nese?.pi?.has ? t('common.yes') : t('common.no')}</td>
                <td>${s.nese?.pi?.review ? fmtDate(s.nese.pi.review) : '—'}</td>
                <td>${gaps ? t('chain.gaps', { n: gaps }) : t('chain.complete')}</td>
              </tr>`;
  })}</tbody>
          </table>`;
        },
      },
    ],
  },
};

/** Llista de documents disponibles. */
export const DOCUMENT_KINDS = Object.keys(DOCS);

/** Apartats triables d'un document: `[{ key, label }]`. */
export function documentSections(kind) {
  const doc = DOCS[kind] || DOCS.followUp;
  return doc.sections.map((x) => ({ key: x.key, label: x.label() }));
}

/** Embolcalla un apartat amb el seu títol i la nota introductòria. */
function sectionBlock(item, state, context) {
  const body = item.render(state, context);
  if (item.bare) return body;
  return html`<section class="doc__section${item.avoid ? ' doc__avoid' : ''}">
    ${item.heading === false ? '' : html`<h2>${item.label()}</h2>`}
    ${item.note ? html`<p class="doc__note">${item.note()}</p>` : ''}
    ${body}
  </section>`;
}

/**
 * Construeix un document a l'àrea d'impressió.
 * @param {string} kind Clau del document.
 * @param {object} options Paràmetres (studentId, period, recordId…).
 * @param {string[]} [options.sections] Apartats a incloure; si no s'indica, tots.
 */
export function renderDocument(kind, options = {}) {
  const state = store.getState();
  const period = options.period || schoolYearRange(state.settings.centre?.schoolYear);
  const doc = DOCS[kind] || DOCS.followUp;

  const wanted = options.sections;
  const list = Array.isArray(wanted) ? doc.sections.filter((x) => wanted.includes(x.key)) : doc.sections;
  const context = {
    ...options,
    period,
    // L'índex d'un dossier només ha de llistar els apartats que s'imprimeixen.
    sectionLabels: list.filter((x) => x.key !== 'index').map((x) => x.label()),
  };

  const content = html`
    ${cover(state, doc.cover(state, context))}
    ${list.map((item) => sectionBlock(item, state, context))}
    ${foot(state)}`;

  root().innerHTML = toHTML(html`<article class="doc">${content}</article>`);
  return root();
}

/** Llança el diàleg d'impressió del navegador. */
export function printDocument() {
  window.requestAnimationFrame(() => window.print());
}

/** Retorna el document generat com a text pla, per copiar-lo. */
export function documentText() {
  return root().innerText;
}

