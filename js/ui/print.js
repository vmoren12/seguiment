/**
 * print.js - generació de documents imprimibles.
 * El contingut es construeix a #print-root i només es mostra en imprimir
 * (@media print), de manera que la sortida no arrossega cap element d'interfície.
 */
import { html, toHTML } from './dom.js';
import { t, tEnum, fmtDate, fmtDateTime, fmtDateLong, fmtNum, fmtTime } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as sel from '../domain/selectors.js';
import * as act from '../domain/actions.js';
import { studentStats, centreStats, groupStats, caseTimeline } from '../domain/stats.js';
import { columnChart, dataTable } from './components/charts.js';
import { today, age, schoolYearRange } from '../core/dates.js';
import { filterAudit } from '../core/audit.js';
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
      <dt>${t('students.fields.tutor')}</dt><dd>${s.tutorName || '—'}</dd>
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

function auditTable(state, { studentId = '', from = '', to = '', limit = 400 } = {}) {
  const list = filterAudit(state.audit, { studentId, from, to }).slice(-limit).reverse();
  if (!list.length) return html`<p class="doc__note">${t('audit.empty')}</p>`;
  return html`<table>
    <thead><tr><th>${t('common.date')}</th><th>${t('common.actions')}</th><th>${t('common.type')}</th><th>${t('common.author')}</th><th>${t('common.summary')}</th></tr></thead>
    <tbody>${list.map((e) => html`<tr>
      <td>${fmtDateTime(e.at)}</td>
      <td>${t(`audit.actions.${e.action}`)}</td>
      <td>${t(`audit.entities.${e.entity}`)}</td>
      <td>${e.author || '—'}</td>
      <td>${e.summary}</td>
    </tr>`)}</tbody>
  </table>`;
}

/* ---------------------------------------------------------- Documents */

const DOCS = {

  /** Informe de seguiment d'un alumne/a en un període. */
  followUp(state, { studentId, period }) {
    const s = store.find('students', studentId);
    const stats = studentStats(state, studentId, period);
    return html`
      ${cover(state, {
    title: t('documents.types.followUp'),
    subtitle: sel.fullName(s, false),
    extra: [`${t('common.period')}: ${fmtDate(period.from)} – ${fmtDate(period.to)}`],
  })}
      ${studentIdentity(state, s)}
      <section class="doc__section"><h2>${t('students.fields.measures')}</h2>${measuresTable(state, s)}</section>
      <section class="doc__section"><h2>${t('records.title')}</h2>${recordsTable(state, s, period)}</section>
      <section class="doc__section doc__avoid"><h2>${t('students.tabs.stats')}</h2>
        <dl class="doc__dl">
          <dt>${t('stats.byType')}</dt><dd>${stats.total} ${t('records.title').toLowerCase()}</dd>
          <dt>${t('stats.attendanceRate')}</dt><dd>${fmtNum(stats.attendanceRate)} %</dd>
          <dt>${t('stats.agreementsRate')}</dt><dd>${fmtNum(stats.agreementsRate)} % (${stats.agreements.done}/${stats.agreements.total})</dd>
        </dl>
        ${columnChart(stats.perMonth.map((x) => ({ label: x.key.slice(5), value: x.value })))}
      </section>
      ${foot(state)}`;
  },

  /** Full de derivació a un servei extern. */
  referral(state, { studentId, referralId }) {
    const s = store.find('students', studentId);
    const list = state.referrals.filter((r) => !r.annulled && r.studentId === studentId);
    const r = referralId ? store.find('referrals', referralId) : list[list.length - 1];
    const consent = r?.consentId ? store.find('consents', r.consentId) : null;
    return html`
      ${cover(state, { title: t('documents.types.referral'), subtitle: sel.fullName(s, false) })}
      ${studentIdentity(state, s)}
      <section class="doc__section"><h2>${t('casework.referrals')}</h2>
        ${r ? html`<dl class="doc__dl">
          <dt>${t('casework.destination')}</dt><dd>${r.serviceName || store.find('services', r.serviceId)?.name || '—'}</dd>
          <dt>${t('casework.requestedAt')}</dt><dd>${fmtDate(r.requestedAt)}</dd>
          <dt>${t('common.reason')}</dt><dd>${r.motive || '—'}</dd>
          <dt>${t('casework.sentDocs')}</dt><dd>${r.sentDocs || '—'}</dd>
          <dt>${t('casework.consent')}</dt><dd>${consent
    ? `${tEnum('consentType', consent.type)} — ${fmtDate(consent.obtainedAt)} (${tEnum('consentVia', consent.via)})`
    : t('common.no')}</dd>
          <dt>${t('common.state')}</dt><dd>${tEnum('referralState', r.state)}</dd>
        </dl>` : html`<p class="doc__note">${t('casework.emptyReferrals')}</p>`}
      </section>
      <section class="doc__section"><h2>${t('students.fields.measures')}</h2>${measuresTable(state, s)}</section>
      <section class="doc__section"><h2>${t('records.title')}</h2>${recordsTable(state, s)}</section>
      ${foot(state)}`;
  },

  /** Acta d'entrevista a partir d'un registre concret. */
  interview(state, { recordId }) {
    const r = store.find('records', recordId);
    const s = store.find('students', r?.studentIds?.[0]);
    return html`
      ${cover(state, {
    title: t('documents.types.interview'),
    subtitle: s ? sel.fullName(s, false) : '',
    extra: [`${t('common.date')}: ${fmtDateTime(r?.at)}`],
  })}
      <section class="doc__section">
        <h2>${tEnum('recordType', r?.type)}</h2>
        <dl class="doc__dl">
          <dt>${t('common.participants')}</dt><dd>${(r?.participants || []).join(', ') || '—'}</dd>
          <dt>${t('common.author')}</dt><dd>${r?.author || '—'}</dd>
        </dl>
        <p style="white-space:pre-wrap">${r?.content || ''}</p>
      </section>
      ${r?.agreements?.length ? html`<section class="doc__section"><h2>${t('common.agreements')}</h2>
        <table><thead><tr><th>${t('records.agreementText')}</th><th>${t('common.responsible')}</th><th>${t('common.deadline')}</th><th>${t('common.state')}</th></tr></thead>
        <tbody>${r.agreements.map((a) => html`<tr><td>${a.text}</td><td>${a.owner || '—'}</td><td>${a.due ? fmtDate(a.due) : '—'}</td><td>${tEnum('taskState', a.state)}</td></tr>`)}</tbody></table>
      </section>` : ''}
      ${foot(state)}`;
  },

  /** Convocatòria d'una cita. */
  convocation(state, { appointmentId }) {
    const a = store.find('appointments', appointmentId);
    const names = (a?.studentIds || []).map((id) => sel.fullName(store.find('students', id), false)).join(', ');
    return html`
      ${cover(state, { title: t('documents.types.convocation'), subtitle: names })}
      <section class="doc__section">
        <p>Benvolguda família,</p>
        <p>Us convoquem a una entrevista amb el servei d’orientació educativa del centre en les condicions següents:</p>
        <dl class="doc__dl">
          <dt>${t('common.date')}</dt><dd>${fmtDateLong(a?.start)}</dd>
          <dt>${t('common.time')}</dt><dd>${fmtTime(a?.start)} – ${fmtTime(a?.end)}</dd>
          <dt>${t('common.modality')}</dt><dd>${tEnum('modality', a?.modality)}</dd>
          <dt>${t('common.location')}</dt><dd>${a?.location || '—'}</dd>
        </dl>
        <p>Si no us va bé aquesta data, poseu-vos en contacte amb el centre per reprogramar-la.</p>
        <p style="margin-top:24px">${state.settings.centre?.professional || ''}</p>
      </section>
      ${foot(state)}`;
  },

  /** Resum de cas per a traspàs entre centres o professionals. */
  handover(state, { studentId }) {
    const s = store.find('students', studentId);
    const services = sel.servicesOf(state, studentId);
    const guardians = sel.guardiansOf(state, studentId);
    return html`
      ${cover(state, { title: t('documents.types.handover'), subtitle: sel.fullName(s, false) })}
      ${studentIdentity(state, s)}
      <section class="doc__section doc__avoid"><h2>${t('students.guardians')}</h2>
        ${guardians.length ? html`<table>
          <thead><tr><th>${t('common.name')}</th><th>${t('students.kinship')}</th><th>${t('common.phone')}</th><th>${t('common.email')}</th></tr></thead>
          <tbody>${guardians.map((g) => html`<tr><td>${g.name}</td><td>${tEnum('kinship', g.kinship)}</td><td>${g.phone || '—'}</td><td>${g.email || '—'}</td></tr>`)}</tbody>
        </table>` : html`<p class="doc__note">${t('common.empty')}</p>`}
      </section>
      <section class="doc__section doc__avoid"><h2>${t('services.external')}</h2>
        ${services.length ? html`<table>
          <thead><tr><th>${t('services.entity')}</th><th>${t('services.kind')}</th><th>${t('services.contact')}</th><th>${t('services.linkedAt')}</th></tr></thead>
          <tbody>${services.map(({ link, service }) => html`<tr><td>${service.name}</td><td>${tEnum('serviceKind', service.kind)}</td><td>${service.contact || '—'}</td><td>${fmtDate(link.linkedAt)}</td></tr>`)}</tbody>
        </table>` : html`<p class="doc__note">${t('services.empty')}</p>`}
      </section>
      <section class="doc__section"><h2>${t('students.fields.measures')}</h2>${measuresTable(state, s)}</section>
      <section class="doc__section"><h2>${t('stats.timeline')}</h2>${timelineTable(state, s)}</section>
      ${foot(state)}`;
  },

  /** Dossier complet d'inspecció per a un alumne/a. */
  inspection(state, { studentId, period }) {
    const s = store.find('students', studentId);
    const stats = studentStats(state, studentId, period);
    const sections = [
      t('students.tabs.summary'), t('students.fields.measures'), t('stats.timeline'),
      t('casework.consents'), t('casework.referrals'), t('chain.title'),
      t('students.tabs.stats'), t('audit.title'),
    ];
    return html`
      ${cover(state, {
    title: t('documents.types.inspection'),
    subtitle: sel.fullName(s, false),
    extra: [`${t('common.period')}: ${fmtDate(period.from)} – ${fmtDate(period.to)}`],
  })}
      <nav class="doc__section doc__avoid"><h2>${t('documents.index')}</h2>
        <ol class="doc__toc">${sections.map((x) => html`<li>${x}</li>`)}</ol>
      </nav>
      ${studentIdentity(state, s)}
      <section class="doc__section"><h2>${t('students.fields.measures')}</h2>
        <p class="doc__note">Mesures adoptades amb la referència normativa que les fonamenta.</p>
        ${measuresTable(state, s)}
      </section>
      <section class="doc__section"><h2>${t('stats.timeline')}</h2>${timelineTable(state, s)}</section>
      <section class="doc__section"><h2>${t('casework.consents')}</h2>${consentsTable(state, s)}</section>
      <section class="doc__section"><h2>${t('casework.referrals')}</h2>${referralsTable(state, s)}</section>
      <section class="doc__section"><h2>${t('chain.title')}</h2>
        <p class="doc__note">${t('chain.intro')}</p>
        ${chainTable(state, s)}
      </section>
      <section class="doc__section doc__avoid"><h2>${t('students.tabs.stats')}</h2>
        <dl class="doc__dl">
          <dt>${t('records.title')}</dt><dd>${stats.total}</dd>
          <dt>${t('stats.attendanceRate')}</dt><dd>${fmtNum(stats.attendanceRate)} %</dd>
          <dt>${t('stats.agreementsRate')}</dt><dd>${fmtNum(stats.agreementsRate)} %</dd>
          <dt>${t('stats.demandToAction')}</dt><dd>${stats.times.demandToAction ?? '—'} ${t('common.days')}</dd>
          <dt>${t('chain.gaps', { n: stats.chainGaps })}</dt><dd>${stats.chainGaps}</dd>
        </dl>
        ${columnChart(stats.perMonth.map((x) => ({ label: x.key.slice(5), value: x.value })))}
      </section>
      <section class="doc__section"><h2>${t('audit.title')}</h2>
        <p class="doc__note">${t('audit.intro')}</p>
        ${auditTable(state, { studentId, from: period.from, to: period.to })}
      </section>
      ${foot(state)}`;
  },

  /** Memòria estadística del centre. */
  statistics(state, { period }) {
    const centre = centreStats(state, period);
    const groups = groupStats(state, period);
    const byType = centre.byType.map((x) => ({ label: tEnum('recordType', x.key), value: x.value }));
    const nese = centre.nese.map((x) => ({ label: tEnum('nese', x.key), value: x.value }));
    const months = centre.perMonth.map((x) => ({ label: x.key.slice(5), value: x.value }));

    return html`
      ${cover(state, {
    title: t('documents.types.statistics'),
    subtitle: t('stats.scopes.centre'),
    extra: [`${t('common.period')}: ${fmtDate(period.from)} – ${fmtDate(period.to)}`],
  })}
      <section class="doc__section doc__avoid"><h2>${t('stats.totalStudents')}</h2>
        <dl class="doc__dl">
          <dt>${t('common.students')}</dt><dd>${centre.totalStudents}</dd>
          <dt>${t('stats.openCases')}</dt><dd>${centre.openCases}</dd>
          <dt>${t('stats.totalStudents')}</dt><dd>${centre.attended}</dd>
          <dt>${t('records.title')}</dt><dd>${centre.records}</dd>
          <dt>${t('stats.hoursInAppointments')}</dt><dd>${fmtNum(centre.hours, 1)} h</dd>
          <dt>${t('stats.interventionsPerWeek')}</dt><dd>${fmtNum(centre.perWeek, 1)}</dd>
          <dt>${t('stats.avgResponse')}</dt><dd>${centre.avgResponse !== null ? `${fmtNum(centre.avgResponse, 1)} ${t('common.days')}` : '—'}</dd>
          <dt>${t('stats.agreementsDone')}</dt><dd>${centre.agreements.done}/${centre.agreements.total} (${centre.agreements.rate} %)</dd>
        </dl>
      </section>
      <section class="doc__section doc__avoid"><h2>${t('stats.overTime')}</h2>${columnChart(months)}</section>
      <section class="doc__section doc__avoid"><h2>${t('stats.byType')}</h2>${dataTable(byType)}</section>
      <section class="doc__section doc__avoid"><h2>${t('stats.neseDistribution')}</h2>${dataTable(nese)}</section>
      <section class="doc__section"><h2>${t('stats.volumeByGroup')}</h2>
        <table>
          <thead><tr><th>${t('common.group')}</th><th>${t('common.level')}</th><th>${t('common.students')}</th><th>${t('stats.openCases')}</th><th>${t('stats.coverage')}</th><th>${t('records.title')}</th><th>PI</th></tr></thead>
          <tbody>${groups.rows.map((r) => html`<tr>
            <td>${r.name}</td><td>${r.level}</td><td>${r.students}</td><td>${r.open}</td>
            <td>${r.coverage} %</td><td>${r.volume}</td><td>${r.withPi}</td>
          </tr>`)}</tbody>
        </table>
      </section>
      <section class="doc__section doc__avoid"><h2>${t('stats.servicesMap')}</h2>
        ${dataTable(centre.services.map((x) => ({ label: x.label, value: x.value })))}
      </section>
      <section class="doc__section doc__avoid"><h2>${t('compliance.title')}</h2>
        <dl class="doc__dl">
          <dt>${t('stats.piOverdue')}</dt><dd>${centre.piOverdue}</dd>
          <dt>${t('stats.referralsPending')}</dt><dd>${centre.referrals.pending}</dd>
          <dt>${t('stats.noContactList', { n: state.settings.thresholds?.noContactDays ?? 45 })}</dt><dd>${centre.noContact}</dd>
        </dl>
      </section>
      ${foot(state)}`;
  },

  /** Dossier d'inspecció del conjunt del centre. */
  centreInspection(state, { period }) {
    const students = sel.allStudents(state).filter((s) => ['actiu', 'seguiment'].includes(s.status?.value));
    return html`
      ${cover(state, {
    title: t('documents.types.inspection'),
    subtitle: t('stats.scopes.centre'),
    extra: [`${t('common.period')}: ${fmtDate(period.from)} – ${fmtDate(period.to)}`, `${t('common.students')}: ${students.length}`],
  })}
      <section class="doc__section"><h2>${t('students.title')}</h2>
        <table>
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
        </table>
      </section>
      <section class="doc__section"><h2>${t('audit.title')}</h2>${auditTable(state, { from: period.from, to: period.to, limit: 600 })}</section>
      ${foot(state)}`;
  },
};

/** Llista de documents disponibles. */
export const DOCUMENT_KINDS = Object.keys(DOCS);

/**
 * Construeix un document a l'àrea d'impressió.
 * @param {string} kind Clau del document.
 * @param {object} options Paràmetres (studentId, period, recordId…).
 */
export function renderDocument(kind, options = {}, { log = true } = {}) {
  const state = store.getState();
  const period = options.period || schoolYearRange(state.settings.centre?.schoolYear);
  const builder = DOCS[kind] || DOCS.followUp;
  const content = builder(state, { ...options, period });
  root().innerHTML = toHTML(html`<article class="doc">${content}</article>`);
  if (log) act.logExport('Document', t(`documents.types.${kind}`) || kind);
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

