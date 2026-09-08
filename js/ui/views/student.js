/**
 * student.js - fitxa de l'alumne/a amb pestanyes: resum, família, serveis,
 * seguiment cronològic, cites, derivacions, tasques, indicadors, cadena
 * documental i documents.
 */
import { html, icon, raw } from '../dom.js';
import { t, tEnum, fmtDate, fmtDateTime, fmtTime, fmtNum } from '../../core/i18n.js';
import * as sel from '../../domain/selectors.js';
import * as store from '../../core/store.js';
import * as act from '../../domain/actions.js';
import { studentStats, caseTimeline } from '../../domain/stats.js';
import { current, setQuery, href, navigate } from '../router.js';
import { age, daysSince, today, schoolYearRange } from '../../core/dates.js';
import { barList, columnChart, chartBox, dataTable, gauge } from '../components/charts.js';
import { openModal, confirmModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import {
  editStudent, editGuardian, editRecord, editAppointment, editDemand, editReferral,
  editConsent, editServiceLink, annulEntity, closeAppointment, deleteStudent,
} from '../editors.js';
import { scheduleRender } from '../shell.js';
import { renderDocument, printDocument } from '../print.js';
import { chainDoc, chainWho, timelineTitle } from '../labels.js';

const TABS = ['summary', 'family', 'services', 'records', 'appointments', 'referrals', 'tasks', 'stats', 'chain', 'documents'];

export function title({ state, route }) {
  const s = store.find('students', route.id);
  if (!s) return { title: t('students.title'), subtitle: '' };
  return {
    title: sel.fullName(s, state.settings.presentation),
    subtitle: [s.level, s.group, sel.tutorLabel(s)].filter(Boolean).join(' · '),
  };
}

function tab() { return current().query.t && TABS.includes(current().query.t) ? current().query.t : 'summary'; }

function period(state) {
  const year = state.settings.centre?.schoolYear;
  return schoolYearRange(year);
}

/* -------------------------------------------------------------- Capçalera */

function header(state, s) {
  const p = state.settings.presentation;
  const years = age(s.birth);
  const last = sel.lastContactDate(state, s.id);
  const gap = last ? daysSince(last) : null;
  const noShows = sel.noShowCount(state, s.id);

  return html`
    <div class="page-head">
      <div style="min-width:0">
        <div class="row row--tight">
          <a class="btn btn--sm btn--ghost" href="${href('alumnat')}">${icon('chevronLeft')}${t('common.back')}</a>
        </div>
        <h2 style="margin-top:6px">${sel.fullName(s, p)}</h2>
        <p class="row row--tight" style="margin-top:4px">
          ${s.level ? html`<span class="tag">${s.level}</span>` : ''}
          ${s.group ? html`<span class="tag">${s.group}</span>` : ''}
          ${years !== null ? html`<span class="tag">${years} anys</span>` : ''}
          ${s.nese?.category && s.nese.category !== 'cap' ? html`<span class="chip chip--accent">${tEnum('nese', s.nese.category)}</span>` : ''}
          ${s.nese?.pi?.has ? html`<span class="chip chip--outline">PI</span>` : ''}
          <span class="chip ${s.status?.value === 'actiu' ? 'chip--ok' : 'chip--info'}">${tEnum('fileState', s.status?.value)}</span>
          ${s.annulled ? html`<span class="chip chip--danger">${t('records.annulled')}</span>` : ''}
        </p>
      </div>
      <div class="row">
        <button type="button" class="btn btn--sm" data-act="record:new" data-student="${s.id}">${icon('plus')}${t('records.new')}</button>
        <button type="button" class="btn btn--sm" data-act="appointment:new" data-student="${s.id}">${icon('calendar')}${t('agenda.newAppointment')}</button>
        <button type="button" class="btn btn--sm" data-act="st:edit">${icon('edit')}${t('common.edit')}</button>
        <button type="button" class="btn btn--sm btn--danger" data-act="st:del">${icon('trash')}${t('common.delete')}</button>
      </div>
    </div>

    ${gap !== null && gap >= (state.settings.thresholds?.noContactDays ?? 45)
    ? html`<p class="notice notice--warn">${icon('alert')}<span>${t('dashboard.noContactHint', { n: gap })} — ${t('students.lastContact')}: ${fmtDate(last)}</span></p>`
    : ''}
    ${noShows >= 2 ? html`<p class="notice notice--warn">${icon('alert')}<span>${t('agenda.noShowAlert', { n: noShows })}</span></p>` : ''}

    <nav class="tabs" role="tablist" aria-label="${t('students.title')}" style="margin-top:12px">
      ${TABS.map((k) => html`<button type="button" class="tab" role="tab" aria-selected="${k === tab()}"
        data-act="st:tab" data-tab="${k}">${t(`students.tabs.${k}`)}</button>`)}
    </nav>`;
}

/* ----------------------------------------------------------------- Resum */

function summaryTab(state, s) {
  const measures = s.nese?.measures || [];
  const diagnoses = s.health?.diagnoses || [];
  const normative = (id) => (state.settings.normative || []).find((n) => n.id === id);

  return html`<div class="grid grid--2">
    <section class="card">
      <div class="card__head"><h3>${t('common.details')}</h3></div>
      <dl class="deflist">
        <div><dt>${t('students.fields.birth')}</dt><dd>${s.birth ? `${fmtDate(s.birth)} (${age(s.birth)} anys)` : '—'}</dd></div>
        <div><dt>${t('students.fields.gender')}</dt><dd>${tEnum('gender', s.gender)}</dd></div>
        <div><dt>${t('students.fields.tutors')}</dt><dd>${sel.tutorLabel(s) || '—'}</dd></div>
        <div><dt>${t('students.fields.tutorIndividual')}</dt><dd>${s.tutorIndividual || '—'}</dd></div>
        <div><dt>${t('students.fields.enrolled')}</dt><dd>${s.enrolled ? fmtDate(s.enrolled) : '—'}</dd></div>
        <div><dt>${t('students.fields.originCentre')}</dt><dd>${s.originCentre || '—'}</dd></div>
        <div><dt>${t('students.fields.repeats')}</dt><dd>${s.academic?.repeats ?? 0}</dd></div>
        <div><dt>${t('students.fields.attendance')}</dt><dd>${s.academic?.attendance ? `${s.academic.attendance} %` : '—'}</dd></div>
        <div><dt>${t('students.fields.pendingSubjects')}</dt><dd>${s.academic?.pendingSubjects || '—'}</dd></div>
        <div><dt>${t('students.fields.status')}</dt><dd>${tEnum('fileState', s.status?.value)} · ${s.status?.date ? fmtDate(s.status.date) : ''}</dd></div>
      </dl>
      ${s.tags?.length ? html`<p class="row row--tight" style="margin-top:12px">${s.tags.map((x) => html`<span class="tag">${x}</span>`)}</p>` : ''}
    </section>

    <section class="card">
      <div class="card__head"><h3>NESE ${raw('&amp;')} ${t('students.fields.measures')}</h3></div>
      <dl class="deflist">
        <div><dt>${t('students.fields.neseCategory')}</dt><dd>${tEnum('nese', s.nese?.category)}</dd></div>
        <div><dt>${t('students.fields.report')}</dt><dd>${s.nese?.report?.has ? `${t('common.yes')} · ${fmtDate(s.nese.report.date)} ${s.nese.report.ref ? `(${s.nese.report.ref})` : ''}` : t('common.no')}</dd></div>
        <div><dt>${t('students.fields.pi')}</dt><dd>${s.nese?.pi?.has
    ? `${t('common.yes')} · ${t('students.fields.piApproved')}: ${fmtDate(s.nese.pi.approved) || '—'}`
    : t('common.no')}</dd></div>
        <div><dt>${t('students.fields.piReview')}</dt><dd>${s.nese?.pi?.review
    ? html`<span class="chip ${s.nese.pi.review < today() ? 'chip--danger' : 'chip--outline'}">${fmtDate(s.nese.pi.review)}</span>` : '—'}</dd></div>
        <div><dt>SIEI / SIAL</dt><dd>${[s.nese?.siei ? 'SIEI' : '', s.nese?.sial ? 'SIAL' : ''].filter(Boolean).join(' · ') || '—'}</dd></div>
      </dl>
      ${measures.length ? html`<ul class="list" style="margin-top:8px">
        ${measures.map((m) => html`<li class="listitem">
          <span class="listitem__main">
            <span class="listitem__title">${m.text}</span>
            <span class="listitem__meta">
              <span>${m.date ? fmtDate(m.date) : ''}</span>
              ${m.normativeId ? html`<span>${normative(m.normativeId)?.ref || ''}</span>` : ''}
            </span>
          </span>
          <span class="chip chip--outline">${tEnum('measure', m.type)}</span>
        </li>`)}
      </ul>` : html`<p class="muted small" style="margin-top:8px">${t('common.empty')}</p>`}
    </section>

    <section class="card">
      <div class="card__head"><h3>${t('students.fields.healthNotes')}</h3></div>
      ${diagnoses.length ? html`<ul class="list">
        ${diagnoses.map((d) => html`<li class="listitem">
          <span class="listitem__main">
            <span class="listitem__title">${d.text}</span>
            <span class="listitem__meta"><span>${d.pro || ''}</span><span>${d.date ? fmtDate(d.date) : ''}</span></span>
          </span>
        </li>`)}
      </ul>` : html`<p class="muted small">${t('common.empty')}</p>`}
      <dl class="deflist" style="margin-top:12px">
        <div><dt>${t('students.fields.medication')}</dt><dd>${s.health?.medication || '—'}</dd></div>
        <div><dt>${t('students.fields.allergies')}</dt><dd>${s.health?.allergies || '—'}</dd></div>
      </dl>
      ${s.health?.notes ? html`<p class="pre-wrap small" style="margin-top:8px">${s.health.notes}</p>` : ''}
    </section>

    <section class="card">
      <div class="card__head"><h3>${t('stats.timeline')}</h3>
        <a class="btn btn--sm" href="${href('alumnat', s.id, { t: 'records' })}">${t('common.view')}</a></div>
      ${timelineList(state, s, 8)}
    </section>
  </div>`;
}

function timelineList(state, s, limit) {
  const items = caseTimeline(state, s.id).slice(-limit).reverse();
  if (!items.length) return html`<p class="muted small">${t('records.empty')}</p>`;
  return html`<ol class="timeline">
    ${items.map((i) => html`<li class="tlitem" data-status="fet">
      <span class="tlitem__date">${fmtDate(i.date)}</span>
      <span class="tlitem__title">${timelineTitle(i)}</span>
      ${i.meta ? html`<span class="listitem__meta"><span>${i.meta}</span></span>` : ''}
    </li>`)}
  </ol>`;
}

/* --------------------------------------------------------------- Família */

function familyTab(state, s) {
  const guardians = sel.guardiansOf(state, s.id);
  return html`<div class="stack">
    <section class="card">
      <div class="card__head">
        <h3>${t('students.guardians')}</h3>
        <button type="button" class="btn btn--sm btn--primary" data-act="st:guardian:new">${icon('plus')}${t('students.addGuardian')}</button>
      </div>
      ${guardians.length ? html`<ul class="list">
        ${guardians.map((g) => html`<li class="listitem">
          <span class="listitem__main">
            <span class="listitem__title">${state.settings.presentation ? tEnum('kinship', g.kinship) : g.name}</span>
            <span class="listitem__meta">
              <span>${tEnum('kinship', g.kinship)}</span>
              ${g.phone ? html`<span><a href="tel:${g.phone}">${g.phone}</a></span>` : ''}
              ${g.email ? html`<span><a href="mailto:${g.email}">${g.email}</a></span>` : ''}
              ${g.language ? html`<span>${g.language}</span>` : ''}
              ${g.availability ? html`<span>${g.availability}</span>` : ''}
            </span>
            ${g.custody ? html`<span class="small muted pre-wrap">${g.custody}</span>` : ''}
          </span>
          <span class="row row--tight">
            <button type="button" class="iconbtn iconbtn--sm" data-act="st:guardian:edit" data-id="${g.id}" aria-label="${t('common.edit')}">${icon('edit')}</button>
            <button type="button" class="iconbtn iconbtn--sm" data-act="st:guardian:del" data-id="${g.id}" aria-label="${t('common.delete')}">${icon('trash')}</button>
          </span>
        </li>`)}
      </ul>` : html`<p class="muted small">${t('common.empty')}</p>`}
    </section>

    <section class="card">
      <div class="card__head"><h3>${t('students.tabs.family')}</h3></div>
      <dl class="deflist">
        <div><dt>${t('students.fields.familyStructure')}</dt><dd>${tEnum('familyStructure', s.family?.structure) || '—'}</dd></div>
        <div><dt>${t('students.fields.siblings')}</dt><dd>${s.family?.siblings || '—'}</dd></div>
        <div><dt>${t('students.fields.homeLanguage')}</dt><dd>${s.family?.homeLanguage || '—'}</dd></div>
        <div><dt>${t('students.fields.socialServices')}</dt><dd>${s.family?.socialServices ? t('common.yes') : t('common.no')}</dd></div>
      </dl>
    </section>
  </div>`;
}

/* --------------------------------------------------------------- Serveis */

function servicesTab(state, s) {
  const links = sel.servicesOf(state, s.id);
  return html`<section class="card">
    <div class="card__head">
      <h3>${t('services.external')}</h3>
      <button type="button" class="btn btn--sm btn--primary" data-act="st:link:new">${icon('plus')}${t('common.add')}</button>
    </div>
    ${links.length ? html`<ul class="list">
      ${links.map(({ link, service }) => html`<li class="listitem">
        <span class="listitem__main">
          <span class="listitem__title">${service.name}</span>
          <span class="listitem__meta">
            <span>${tEnum('serviceKind', service.kind)}</span>
            ${service.contact ? html`<span>${service.contact}</span>` : ''}
            ${service.phone ? html`<span>${service.phone}</span>` : ''}
            ${link.role ? html`<span>${link.role}</span>` : ''}
            <span>${t('services.linkedAt')}: ${fmtDate(link.linkedAt)}</span>
          </span>
        </span>
        <span class="row row--tight">
          <button type="button" class="iconbtn iconbtn--sm" data-act="st:link:edit" data-id="${link.id}" aria-label="${t('common.edit')}">${icon('edit')}</button>
          <button type="button" class="iconbtn iconbtn--sm" data-act="st:link:del" data-id="${link.id}" aria-label="${t('common.delete')}">${icon('trash')}</button>
        </span>
      </li>`)}
    </ul>` : html`<p class="muted small">${t('services.empty')}</p>`}
  </section>`;
}

/* ------------------------------------------------------------- Seguiment */

function recordsTab(state, s) {
  const records = sel.recordsOf(state, s.id);
  const focus = current().query.r;

  return html`<section class="card card--pad0">
    <div class="card__head" style="padding:16px 16px 8px">
      <h3>${t('records.title')} · ${records.length}</h3>
      <button type="button" class="btn btn--sm btn--primary" data-act="record:new" data-student="${s.id}">${icon('plus')}${t('records.new')}</button>
    </div>
    ${records.length ? html`<ul class="list" style="padding:0 16px 8px">
      ${records.map((r) => html`<li class="listitem" ${raw(r.id === focus ? 'style="background:var(--accent-weak);border-radius:6px"' : '')}>
        <span class="listitem__main">
          <span class="row row--tight">
            <span class="listitem__title">${tEnum('recordType', r.type)}</span>
            ${r.confidentiality === 'restringit' ? html`<span class="chip chip--warn">${t('records.restricted')}</span>` : ''}
            ${act.isSealed(r) ? html`<span class="chip chip--outline">${t('records.sealed')}</span>` : ''}
            ${r.versions?.length ? html`<span class="chip">${t('records.versionsCount', { n: r.versions.length + 1 })}</span>` : ''}
          </span>
          <span class="listitem__meta">
            <span>${fmtDateTime(r.at)}</span>
            ${r.author ? html`<span>${r.author}</span>` : ''}
            ${r.participants?.length ? html`<span>${r.participants.join(', ')}</span>` : ''}
          </span>
          <p class="pre-wrap small" style="margin-top:6px">${r.content.length > 400 ? `${r.content.slice(0, 400)}…` : r.content}</p>
          ${r.agreements?.length ? html`<ul class="list" style="margin-top:6px">
            ${r.agreements.map((a) => html`<li class="listitem" style="padding:4px 0;border:0">
              <span class="listitem__main">
                <span class="small">${a.text}</span>
                <span class="listitem__meta">
                  ${a.owner ? html`<span>${a.owner}</span>` : ''}
                  ${a.due ? html`<span>${fmtDate(a.due)}</span>` : ''}
                </span>
              </span>
              <span class="chip ${a.state === 'fet' ? 'chip--ok' : a.due && a.due < today() ? 'chip--danger' : 'chip--warn'}">${tEnum('taskState', a.state)}</span>
            </li>`)}
          </ul>` : ''}
        </span>
        <span class="row row--tight">
          <button type="button" class="iconbtn iconbtn--sm" data-act="st:record:edit" data-id="${r.id}" aria-label="${t('common.edit')}">${icon('edit')}</button>
          ${r.versions?.length ? html`<button type="button" class="iconbtn iconbtn--sm" data-act="st:record:versions" data-id="${r.id}" aria-label="${t('records.versions')}">${icon('history')}</button>` : ''}
          <button type="button" class="iconbtn iconbtn--sm" data-act="st:record:del" data-id="${r.id}" aria-label="${t('records.annul')}">${icon('trash')}</button>
        </span>
      </li>`)}
    </ul>` : html`<div class="empty"><h3>${t('records.empty')}</h3></div>`}
  </section>`;
}

/* ----------------------------------------------------------------- Cites */

function appointmentsTab(state, s) {
  const list = sel.appointmentsOf(state, s.id);
  return html`<section class="card card--pad0">
    <div class="card__head" style="padding:16px 16px 8px">
      <h3>${t('students.tabs.appointments')} · ${list.length}</h3>
      <button type="button" class="btn btn--sm btn--primary" data-act="appointment:new" data-student="${s.id}">${icon('plus')}${t('agenda.newAppointment')}</button>
    </div>
    ${list.length ? html`<div class="tablewrap"><table class="table table--cards">
      <thead><tr>
        <th>${t('common.date')}</th><th>${t('common.type')}</th><th>${t('common.modality')}</th>
        <th>${t('common.attendees')}</th><th>${t('common.state')}</th><th></th>
      </tr></thead>
      <tbody>
        ${list.map((a) => html`<tr>
          <td data-th="${t('common.date')}">${fmtDate(a.start)} ${fmtTime(a.start)}</td>
          <td data-th="${t('common.type')}">${tEnum('appointmentType', a.type)}</td>
          <td data-th="${t('common.modality')}">${tEnum('modality', a.modality)}</td>
          <td data-th="${t('common.attendees')}">${(a.attendees || []).join(', ')}</td>
          <td data-th="${t('common.state')}"><span class="chip ${a.state === 'feta' ? 'chip--ok' : ['anullada', 'noPresentada'].includes(a.state) ? 'chip--danger' : ''}">${tEnum('appointmentState', a.state)}</span></td>
          <td class="right">
            ${a.state !== 'feta' && a.state !== 'anullada'
    ? html`<button type="button" class="iconbtn iconbtn--sm" data-act="st:appt:done" data-id="${a.id}" aria-label="${t('agenda.markDone')}">${icon('check')}</button>` : ''}
            <button type="button" class="iconbtn iconbtn--sm" data-act="st:appt:edit" data-id="${a.id}" aria-label="${t('common.edit')}">${icon('edit')}</button>
          </td>
        </tr>`)}
      </tbody>
    </table></div>` : html`<div class="empty"><h3>${t('agenda.noAppointments')}</h3></div>`}
  </section>`;
}

/* ----------------------------------------------- Derivacions i demandes */

function referralsTab(state, s) {
  const demands = state.demands.filter((d) => !d.annulled && d.studentId === s.id);
  const referrals = state.referrals.filter((r) => !r.annulled && r.studentId === s.id);
  const consents = state.consents.filter((c) => !c.annulled && c.studentId === s.id);

  return html`<div class="stack">
    <section class="card">
      <div class="card__head"><h3>${t('casework.demands')}</h3>
        <button type="button" class="btn btn--sm" data-act="st:demand:new">${icon('plus')}${t('casework.newDemand')}</button></div>
      ${demands.length ? html`<ul class="list">${demands.map((d) => html`<li class="listitem">
        <span class="listitem__main">
          <span class="listitem__title">${d.motive}</span>
          <span class="listitem__meta">
            <span>${tEnum('demandOrigin', d.origin)}</span>
            <span>${fmtDate(d.receivedAt)}</span>
            <span>${d.firstActionAt ? `${t('casework.responseTime')}: ${Math.max(0, (new Date(d.firstActionAt) - new Date(d.receivedAt)) / 86400000)} ${t('common.days')}` : t('casework.noFirstAction')}</span>
          </span>
        </span>
        <span class="row row--tight">
          <span class="chip ${d.urgency === 'alta' ? 'chip--danger' : d.urgency === 'mitjana' ? 'chip--warn' : ''}">${tEnum('urgency', d.urgency)}</span>
          <button type="button" class="iconbtn iconbtn--sm" data-act="st:demand:edit" data-id="${d.id}" aria-label="${t('common.edit')}">${icon('edit')}</button>
        </span>
      </li>`)}</ul>` : html`<p class="muted small">${t('casework.emptyDemands')}</p>`}
    </section>

    <section class="card">
      <div class="card__head"><h3>${t('casework.referrals')}</h3>
        <button type="button" class="btn btn--sm" data-act="st:referral:new">${icon('plus')}${t('casework.newReferral')}</button></div>
      ${referrals.length ? html`<ul class="list">${referrals.map((r) => html`<li class="listitem">
        <span class="listitem__main">
          <span class="listitem__title">${r.serviceName || store.find('services', r.serviceId)?.name || '—'}</span>
          <span class="listitem__meta">
            <span>${fmtDate(r.requestedAt)}</span>
            ${r.consentId ? html`<span>${t('casework.consent')}: ${t('common.yes')}</span>` : html`<span class="chip chip--warn">${t('casework.consent')}: ${t('common.no')}</span>`}
            ${r.resolvedAt ? html`<span>${t('casework.resolvedAt')}: ${fmtDate(r.resolvedAt)}</span>` : ''}
          </span>
          ${r.motive ? html`<span class="small muted">${r.motive}</span>` : ''}
        </span>
        <span class="row row--tight">
          <span class="chip ${r.resolvedAt ? 'chip--ok' : 'chip--info'}">${tEnum('referralState', r.state)}</span>
          <button type="button" class="iconbtn iconbtn--sm" data-act="st:referral:edit" data-id="${r.id}" aria-label="${t('common.edit')}">${icon('edit')}</button>
        </span>
      </li>`)}</ul>` : html`<p class="muted small">${t('casework.emptyReferrals')}</p>`}
    </section>

    <section class="card">
      <div class="card__head"><h3>${t('casework.consents')}</h3>
        <button type="button" class="btn btn--sm" data-act="st:consent:new">${icon('plus')}${t('casework.newConsent')}</button></div>
      ${consents.length ? html`<ul class="list">${consents.map((c) => html`<li class="listitem">
        <span class="listitem__main">
          <span class="listitem__title">${tEnum('consentType', c.type)}</span>
          <span class="listitem__meta">
            <span>${fmtDate(c.obtainedAt)}</span>
            <span>${tEnum('consentVia', c.via)}</span>
            ${c.document ? html`<span>${c.document}</span>` : ''}
            ${c.validUntil ? html`<span>${t('casework.validUntil')}: ${fmtDate(c.validUntil)}</span>` : ''}
          </span>
        </span>
        <span class="row row--tight">
          ${c.revoked ? html`<span class="chip chip--danger">${t('casework.revoked')}</span>` : html`<span class="chip chip--ok">${t('common.ok')}</span>`}
          <button type="button" class="iconbtn iconbtn--sm" data-act="st:consent:edit" data-id="${c.id}" aria-label="${t('common.edit')}">${icon('edit')}</button>
        </span>
      </li>`)}</ul>` : html`<p class="muted small">${t('casework.emptyConsents')}</p>`}
    </section>
  </div>`;
}

/* -------------------------------------------------------------- Tasques */

function tasksTab(state, s) {
  const list = sel.tasksOf(state, s.id);
  return html`<section class="card">
    <div class="card__head"><h3>${t('tasks.title')}</h3>
      <button type="button" class="btn btn--sm btn--primary" data-act="task:new" data-student="${s.id}">${icon('plus')}${t('tasks.new')}</button></div>
    ${list.length ? html`<ul class="list">${list.map((k) => html`<li class="listitem">
      <span class="listitem__main">
        <span class="listitem__title">${k.title}</span>
        <span class="listitem__meta">
          ${k.owner ? html`<span>${k.owner}</span>` : ''}
          <span>${k.due ? fmtDate(k.due) : t('tasks.noDue')}</span>
          <span>${k.origin?.kind === 'acord' ? t('tasks.originAcord') : t('tasks.originManual')}</span>
        </span>
      </span>
      <span class="row row--tight">
        <span class="chip ${k.state === 'fet' ? 'chip--ok' : k.due && k.due < today() ? 'chip--danger' : 'chip--warn'}">${tEnum('taskState', k.state)}</span>
        ${k.state !== 'fet' ? html`<button type="button" class="iconbtn iconbtn--sm" data-act="st:task:done" data-id="${k.id}" aria-label="${t('tasks.markDone')}">${icon('check')}</button>` : ''}
      </span>
    </li>`)}</ul>` : html`<p class="muted small">${t('tasks.empty')}</p>`}
  </section>`;
}

/* ------------------------------------------------------------ Indicadors */

function statsTab(state, s) {
  const p = period(state);
  const data = studentStats(state, s.id, p);
  const byType = data.byType.map((x) => ({ label: tEnum('recordType', x.key), value: x.value }));
  const months = data.perMonth.map((x) => ({ label: x.key.slice(5), value: x.value }));

  return html`<div class="grid grid--2">
    <section class="card">
      <div class="card__head"><h3>${t('stats.byType')}</h3><span class="muted tiny">${fmtDate(p.from)} – ${fmtDate(p.to)}</span></div>
      ${chartBox('', barList(byType), dataTable(byType))}
    </section>
    <section class="card">
      <div class="card__head"><h3>${t('stats.overTime')}</h3></div>
      ${chartBox('', columnChart(months, { title: t('stats.overTime') }), dataTable(months))}
    </section>
    <section class="card">
      <div class="card__head"><h3>${t('stats.appointmentsSummary')}</h3></div>
      <div class="row" style="gap:24px;align-items:center">
        ${gauge(data.attendanceRate, { label: t('stats.attendanceRate') })}
        <dl class="deflist" style="flex:1">
          <div><dt>${t('common.total')}</dt><dd>${data.appointments.scheduled}</dd></div>
          <div><dt>${tEnum('appointmentState', 'feta')}</dt><dd>${data.appointments.done}</dd></div>
          <div><dt>${tEnum('appointmentState', 'noPresentada')}</dt><dd>${data.appointments.noShow}</dd></div>
          <div><dt>${tEnum('appointmentState', 'anullada')}</dt><dd>${data.appointments.cancelled}</dd></div>
        </dl>
      </div>
    </section>
    <section class="card">
      <div class="card__head"><h3>${t('stats.agreementsRate')}</h3></div>
      <div class="row" style="gap:24px;align-items:center">
        ${gauge(data.agreementsRate, { label: t('stats.agreementsRate') })}
        <dl class="deflist" style="flex:1">
          <div><dt>${t('common.total')}</dt><dd>${data.agreements.total}</dd></div>
          <div><dt>${t('common.done')}</dt><dd>${data.agreements.done}</dd></div>
          <div><dt>${t('common.overdue')}</dt><dd>${data.agreements.overdue}</dd></div>
        </dl>
      </div>
    </section>
    <section class="card">
      <div class="card__head"><h3>${t('stats.servicesInvolved')}</h3></div>
      ${barList(data.services.map((x) => ({ label: x.label, value: x.value })))}
    </section>
    <section class="card">
      <div class="card__head"><h3>${t('stats.caseTimes')}</h3></div>
      <dl class="deflist">
        <div><dt>${t('stats.demandToAction')}</dt><dd>${data.times.demandToAction !== null ? `${fmtNum(data.times.demandToAction)} ${t('common.days')}` : '—'}</dd></div>
        <div><dt>${t('stats.actionToMeasure')}</dt><dd>${data.times.actionToMeasure !== null ? `${fmtNum(data.times.actionToMeasure)} ${t('common.days')}` : '—'}</dd></div>
        <div><dt>${t('casework.referrals')}</dt><dd>${data.referrals.resolved} / ${data.referrals.total}</dd></div>
        <div><dt>${t('chain.gaps', { n: data.chainGaps })}</dt><dd>${data.chainGaps}</dd></div>
      </dl>
    </section>
    <section class="card" style="grid-column:1/-1">
      <div class="card__head"><h3>${t('stats.timeline')}</h3></div>
      ${timelineList(state, s, 100)}
    </section>
  </div>`;
}

/* ----------------------------------------------------- Cadena documental */

function chainTab(state, s) {
  const chain = sel.chainOf(state, s.id);
  const gaps = chain.filter((x) => x.status === 'buit' && x.expected).length;

  return html`<section class="card">
    <div class="card__head">
      <h3>${t('chain.title')}</h3>
      <span class="chip ${gaps ? 'chip--warn' : 'chip--ok'}">${gaps ? t('chain.gaps', { n: gaps }) : t('chain.complete')}</span>
    </div>
    <p class="muted small" style="margin-bottom:16px">${t('chain.intro')}</p>
    <ol class="timeline">
      ${chain.map((step) => html`<li class="tlitem" data-status="${step.status === 'buit' && step.expected ? 'buit' : step.status}">
        <span class="tlitem__date">${step.date ? fmtDate(step.date) : (step.expected ? t('chain.missing') : t('chain.optional'))}</span>
        <span class="tlitem__title">${t(`chain.steps.${step.key}`)}</span>
        <span class="listitem__meta">
          ${chainWho(step) ? html`<span>${chainWho(step)}</span>` : ''}
          ${chainDoc(step) ? html`<span>${chainDoc(step)}</span>` : ''}
        </span>
        ${step.extra ? html`<p class="small muted pre-wrap">${step.extra}</p>` : ''}
        ${step.status === 'buit' && step.expected ? html`<p class="small" style="color:var(--danger)">${t('chain.resolveHint')}</p>` : ''}
      </li>`)}
    </ol>
  </section>`;
}

/* ------------------------------------------------------------- Documents */

function documentsTab(state, s) {
  const kinds = [
    { key: 'followUp', doc: 'followUp' },
    { key: 'handover', doc: 'handover' },
    { key: 'inspection', doc: 'inspection' },
    { key: 'referral', doc: 'referral' },
  ];
  return html`<section class="card">
    <div class="card__head"><h3>${t('documents.title')}</h3></div>
    <p class="muted small" style="margin-bottom:16px">${t('documents.intro')}</p>
    <div class="grid grid--2">
      ${kinds.map((k) => html`<button type="button" class="btn btn--tall btn--block" data-act="st:doc" data-doc="${k.doc}">
        ${icon('file')}${t(`documents.types.${k.key}`)}
      </button>`)}
    </div>
    <div class="card__foot">
      <button type="button" class="btn btn--sm" data-act="st:export">${icon('download')}${t('settings.exportStudent')}</button>
    </div>
  </section>`;
}

/* ---------------------------------------------------------------- Render */

export function render({ state, route }) {
  const s = store.find('students', route.id);
  if (!s) {
    return html`<div class="empty"><h3>${t('common.empty')}</h3>
      <p><a class="btn" href="${href('alumnat')}">${t('common.back')}</a></p></div>`;
  }

  const active = tab();
  const panels = {
    summary: summaryTab, family: familyTab, services: servicesTab,
    records: recordsTab, appointments: appointmentsTab, referrals: referralsTab,
    tasks: tasksTab, stats: statsTab, chain: chainTab, documents: documentsTab,
  };

  return html`${header(state, s)}<div role="tabpanel">${panels[active](state, s)}</div>`;
}

/* --------------------------------------------------------------- Accions */

function versionsModal(recordId) {
  const r = store.find('records', recordId);
  openModal({
    title: t('records.versions'),
    size: 'wide',
    showSubmit: false,
    closeLabel: t('common.close'),
    body: html`<div class="stack">
      <section class="card">
        <div class="card__head"><h3>${t('common.version')} ${r.versions.length + 1} · ${t('common.updatedAt')}</h3>
          <span class="muted tiny">${fmtDateTime(r.updatedAt)}</span></div>
        <p class="pre-wrap small">${r.content}</p>
      </section>
      ${[...r.versions].reverse().map((v, i) => html`<section class="card">
        <div class="card__head">
          <h3>${t('records.versionAt', { d: fmtDateTime(v.at) })}</h3>
          ${v.sealed ? html`<span class="chip chip--warn">${t('records.sealed')}</span>` : ''}
        </div>
        ${v.reason ? html`<p class="small"><b>${t('records.editReason')}:</b> ${v.reason}</p>` : ''}
        <p class="muted tiny">${v.author}</p>
        <p class="pre-wrap small" style="margin-top:8px">${v.snapshot?.content || ''}</p>
      </section>`)}
    </div>`,
  });
}

export function actions({ state, route }) {
  const id = route.id;
  const s = store.find('students', id);
  const refresh = () => scheduleRender();

  return {
    'st:tab': (el) => setQuery({ t: el.dataset.tab, r: '' }),
    'st:edit': () => editStudent(id, { onSaved: refresh }),
    'st:del': () => deleteStudent(id, { onDone: () => navigate('alumnat') }),
    'st:guardian:new': () => editGuardian(id, '', { onSaved: refresh }),
    'st:guardian:edit': (el) => editGuardian(id, el.dataset.id, { onSaved: refresh }),
    'st:guardian:del': (el) => annulEntity('guardians', el.dataset.id, { onDone: refresh }),
    'st:link:new': () => editServiceLink({ studentId: id, onSaved: refresh }),
    'st:link:edit': (el) => editServiceLink({ linkId: el.dataset.id, studentId: id, onSaved: refresh }),
    'st:link:del': (el) => annulEntity('serviceLinks', el.dataset.id, { onDone: refresh }),
    'st:record:edit': (el) => editRecord({ recordId: el.dataset.id, onSaved: refresh }),
    'st:record:del': (el) => annulEntity('records', el.dataset.id, { onDone: refresh, label: t('records.annul') }),
    'st:record:versions': (el) => versionsModal(el.dataset.id),
    'st:appt:edit': (el) => editAppointment({ appointmentId: el.dataset.id, onSaved: refresh }),
    'st:appt:done': (el) => closeAppointment(el.dataset.id, { onSaved: refresh }),
    'st:task:done': (el) => { act.setTaskState(el.dataset.id, 'fet'); refresh(); },
    'st:demand:new': () => editDemand({ studentId: id, onSaved: refresh }),
    'st:demand:edit': (el) => editDemand({ demandId: el.dataset.id, studentId: id, onSaved: refresh }),
    'st:referral:new': () => editReferral({ studentId: id, onSaved: refresh }),
    'st:referral:edit': (el) => editReferral({ referralId: el.dataset.id, studentId: id, onSaved: refresh }),
    'st:consent:new': () => editConsent({ studentId: id, onSaved: refresh }),
    'st:consent:edit': (el) => editConsent({ consentId: el.dataset.id, studentId: id, onSaved: refresh }),
    'st:doc': (el) => { renderDocument(el.dataset.doc, { studentId: id, period: period(state) }); printDocument(); },
    'st:export': async () => {
      const ok = await confirmModal({
        title: t('settings.exportStudent'),
        message: `${sel.fullName(s, false)} — ${t('settings.legalText').slice(0, 120)}…`,
      });
      if (!ok) return;
      const { exportJSON } = await import('../../core/export.js');
      const payload = act.buildExport({ studentId: id });
      exportJSON(payload, `traspas-${sel.listName(s, false)}`);
      toast(t('common.saved'));
    },
  };
}

