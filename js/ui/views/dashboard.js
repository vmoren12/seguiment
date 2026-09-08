/**
 * dashboard.js - escriptori inicial: cites d'avui i de la setmana, acords
 * vençuts, contactes pendents, revisions de PI i alertes de compliment.
 */
import { html, icon } from '../dom.js';
import { t, tEnum, fmtTime, fmtDate, fmtDayMonth } from '../../core/i18n.js';
import * as sel from '../../domain/selectors.js';
import { href } from '../router.js';
import { today } from '../../core/dates.js';
import { loadDemoData } from '../../domain/demo.js';
import { scheduleRender } from '../shell.js';
import { closeAppointment } from '../editors.js';
import { confirmModal } from '../components/modal.js';

export function title() {
  return { title: t('dashboard.title'), subtitle: fmtDate(today()) };
}

function names(state, ids) {
  const p = state.settings.presentation;
  return (ids || []).map((id) => sel.listName(state.students.find((s) => s.id === id), p)).filter(Boolean).join(', ');
}

function appointmentRow(state, a, { withDay = false } = {}) {
  return html`<li class="listitem" data-state="${a.state}">
    <span class="listitem__time">${withDay ? fmtDayMonth(a.start).split(',')[0] : fmtTime(a.start)}</span>
    <span class="listitem__main">
      <span class="listitem__title">${names(state, a.studentIds) || tEnum('appointmentType', a.type)}</span>
      <span class="listitem__meta">
        <span>${tEnum('appointmentType', a.type)}</span>
        <span>${tEnum('modality', a.modality)}</span>
        ${a.location ? html`<span>${a.location}</span>` : ''}
        ${withDay ? html`<span>${fmtTime(a.start)}</span>` : ''}
      </span>
    </span>
    <span class="row row--tight">
      <span class="chip ${a.state === 'feta' ? 'chip--ok' : a.state === 'noPresentada' || a.state === 'anullada' ? 'chip--danger' : ''}">${tEnum('appointmentState', a.state)}</span>
      ${a.state !== 'feta' && a.state !== 'anullada'
    ? html`<button type="button" class="iconbtn iconbtn--sm" data-act="dash:close" data-id="${a.id}" title="${t('agenda.markDone')}" aria-label="${t('agenda.markDone')}">${icon('check')}</button>`
    : ''}
    </span>
  </li>`;
}

export function render({ state }) {
  const data = sel.dashboard(state);
  const c = data.compliance;
  const noContactDays = state.settings.thresholds?.noContactDays ?? 45;
  const piWarnDays = state.settings.thresholds?.piWarnDays ?? 30;
  const empty = state.students.length === 0;

  const alerts = [
    { n: c.agreementsOverdue.length, label: t('compliance.agreementsOverdue'), route: 'tasques', query: { f: 'overdue' } },
    { n: c.piOverdue.length, label: t('compliance.piOverdue'), route: 'compliment' },
    { n: c.referralsPending.length, label: t('compliance.referralsPending'), route: 'demandes', query: { tab: 'referrals' } },
    { n: c.demandsUnanswered.length, label: t('compliance.demandsUnanswered'), route: 'demandes' },
    { n: c.contactGap.length, label: t('compliance.contactGap', { n: noContactDays }), route: 'compliment' },
    { n: c.consentsMissing.length, label: t('compliance.consentsMissing'), route: 'compliment' },
  ].filter((a) => a.n > 0);

  return html`
    ${empty ? html`<div class="card" style="margin-bottom:16px">
      <div class="row row--between">
        <div>
          <h3>${t('app.name')}</h3>
          <p class="muted small">${t('dashboard.firstRun')}</p>
        </div>
        <div class="row row--tight">
          <button type="button" class="btn" data-act="dash:demo">${t('dashboard.demo')}</button>
          <a class="btn btn--primary" href="${href('configuracio')}">${t('settings.title')}</a>
        </div>
      </div>
    </div>` : ''}

    <section class="grid grid--auto" aria-label="${t('dashboard.title')}" style="margin-bottom:16px">
      <div class="card kpi">
        <span class="kpi__label">${t('dashboard.todayAppointments')}</span>
        <span class="kpi__value">${data.todayAppointments.length}</span>
        <span class="kpi__hint">${t('dashboard.weekAppointments')}: ${data.weekAppointments.length}</span>
      </div>
      <div class="card kpi">
        <span class="kpi__label">${t('dashboard.openCases')}</span>
        <span class="kpi__value">${data.openCases}</span>
        <span class="kpi__hint">${t('students.count', { n: sel.allStudents(state).length })}</span>
      </div>
      <div class="card kpi ${c.agreementsOverdue.length ? 'kpi--alert' : ''}">
        <span class="kpi__label">${t('dashboard.overdueAgreements')}</span>
        <span class="kpi__value">${c.agreementsOverdue.length}</span>
        <span class="kpi__hint">${t('tasks.upcoming')}: ${sel.tasksOf(state).filter((x) => x.state !== 'fet' && x.due >= today()).length}</span>
      </div>
      <div class="card kpi">
        <span class="kpi__label">${t('dashboard.weekLoad')}</span>
        <span class="kpi__value">${data.weekHours} h</span>
        <span class="kpi__hint">${t('dashboard.weekLoadHint', { h: data.weekHours, n: data.weekRecords.length })}</span>
      </div>
    </section>

    <div class="grid grid--2">
      <section class="card">
        <div class="card__head">
          <h3>${t('dashboard.todayAppointments')}</h3>
          <a class="btn btn--sm" href="${href('agenda', '', { v: 'day' })}">${t('common.view')}</a>
          <button type="button" class="btn btn--sm btn--primary" data-act="appointment:new">${icon('plus')}${t('common.new')}</button>
        </div>
        ${data.todayAppointments.length
    ? html`<ul class="list">${data.todayAppointments.map((a) => appointmentRow(state, a))}</ul>`
    : html`<p class="muted small">${t('agenda.noAppointments')}</p>`}
      </section>

      <section class="card">
        <div class="card__head">
          <h3>${t('dashboard.alerts')}</h3>
          <a class="btn btn--sm" href="${href('compliment')}">${t('compliance.title')}</a>
        </div>
        ${alerts.length
    ? html`<ul class="list">${alerts.map((a) => html`<li class="listitem">
        <span class="listitem__main">
          <a class="listitem__title" href="${href(a.route, '', a.query || {})}">${a.label}</a>
        </span>
        <span class="chip chip--danger">${a.n}</span>
      </li>`)}</ul>`
    : html`<p class="notice notice--ok">${icon('check')}<span>${t('dashboard.noAlerts')}</span></p>`}
      </section>

      <section class="card">
        <div class="card__head">
          <h3>${t('dashboard.piReviews')}</h3>
          <span class="muted tiny">${t('compliance.piSoon', { n: piWarnDays })}</span>
        </div>
        ${c.piOverdue.length || c.piSoon.length
    ? html`<ul class="list">${[...c.piOverdue, ...c.piSoon].slice(0, 8).map((x) => html`<li class="listitem">
        <span class="listitem__main">
          <a class="listitem__title" href="${href('alumnat', x.student.id)}">${sel.listName(x.student, state.settings.presentation)}</a>
          <span class="listitem__meta"><span>${fmtDate(x.date)}</span><span>${x.student.level} ${x.student.group}</span></span>
        </span>
        <span class="chip ${x.overdue ? 'chip--danger' : 'chip--warn'}">${x.overdue ? `${Math.abs(x.days)} ${t('common.days')}` : `${x.days} ${t('common.days')}`}</span>
      </li>`)}</ul>`
    : html`<p class="muted small">${t('common.empty')}</p>`}
      </section>

      <section class="card">
        <div class="card__head">
          <h3>${t('dashboard.noContact')}</h3>
          <span class="muted tiny">${t('dashboard.noContactHint', { n: noContactDays })}</span>
        </div>
        ${c.contactGap.length
    ? html`<ul class="list">${c.contactGap.slice(0, 8).map((x) => html`<li class="listitem">
        <span class="listitem__main">
          <a class="listitem__title" href="${href('alumnat', x.student.id)}">${sel.listName(x.student, state.settings.presentation)}</a>
          <span class="listitem__meta"><span>${x.student.level} ${x.student.group}</span><span>${x.last ? fmtDate(x.last) : t('students.noRecords')}</span></span>
        </span>
        <span class="chip chip--warn">${x.days === null ? '—' : `${x.days} ${t('common.days')}`}</span>
      </li>`)}</ul>`
    : html`<p class="muted small">${t('common.empty')}</p>`}
      </section>

      <section class="card" style="grid-column:1/-1">
        <div class="card__head">
          <h3>${t('dashboard.weekAppointments')}</h3>
          <a class="btn btn--sm" href="${href('agenda', '', { v: 'week' })}">${t('agenda.views.week')}</a>
        </div>
        ${data.weekAppointments.length
    ? html`<ul class="list">${data.weekAppointments.slice(0, 12).map((a) => appointmentRow(state, a, { withDay: true }))}</ul>`
    : html`<p class="muted small">${t('agenda.noAppointments')}</p>`}
      </section>
    </div>`;
}

export function actions() {
  return {
    'dash:close': (el) => closeAppointment(el.dataset.id, { onSaved: scheduleRender }),
    'dash:demo': async () => {
      const ok = await confirmModal({
        title: t('dashboard.demo'),
        message: 'S’afegiran alumnes, cites i registres d’exemple per provar l’aplicació. Podeu esborrar-ho tot des de la configuració.',
      });
      if (!ok) return;
      loadDemoData();
      scheduleRender();
    },
  };
}
