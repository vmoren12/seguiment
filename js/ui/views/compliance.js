/**
 * compliance.js - panell de compliment: tot allò fora de termini o pendent
 * de resolució, preparat per resoldre'ho abans d'una revisió externa.
 */
import { html, icon } from '../dom.js';
import { t, tEnum, fmtDate } from '../../core/i18n.js';
import * as sel from '../../domain/selectors.js';
import * as store from '../../core/store.js';
import * as act from '../../domain/actions.js';
import { href } from '../router.js';
import { today } from '../../core/dates.js';
import { exportCSV } from '../../core/export.js';
import { editReferral, editDemand, editConsent } from '../editors.js';
import { scheduleRender } from '../shell.js';

export function title({ state }) {
  return { title: t('compliance.title'), subtitle: `${sel.alertCount(state)} ${t('common.pending').toLowerCase()}` };
}

function link(state, student) {
  return html`<a href="${href('alumnat', student.id)}">${sel.listName(student, state.settings.presentation)}</a>`;
}

function block(label, count, tone, body) {
  return html`<section class="card">
    <div class="card__head">
      <h3>${label}</h3>
      <span class="chip ${count ? tone : 'chip--ok'}">${count}</span>
    </div>
    ${count ? body : html`<p class="muted small">${t('compliance.allClear')}</p>`}
  </section>`;
}

export function render({ state }) {
  const c = sel.compliance(state);
  const th = state.settings.thresholds || {};
  const total = sel.alertCount(state) + c.contactGap.length + c.consentsMissing.length + c.chainGaps.length;

  return html`
    <div class="page-head">
      <div>
        <h2>${t('compliance.title')}</h2>
        <p class="muted small">${t('compliance.intro')}</p>
      </div>
      <div class="row">
        <button type="button" class="btn btn--sm" data-act="cp:csv">${icon('download')}CSV</button>
        <a class="btn btn--sm" href="${href('documents', '', { d: 'centreInspection' })}">${icon('file')}${t('documents.types.inspection')}</a>
      </div>
    </div>

    ${total === 0 ? html`<p class="notice notice--ok">${icon('check')}<span>${t('compliance.allClear')}</span></p>` : ''}

    <div class="grid grid--2">
      ${block(t('compliance.piOverdue'), c.piOverdue.length, 'chip--danger', html`<ul class="list">
        ${c.piOverdue.map((x) => html`<li class="listitem">
          <span class="listitem__main">
            <span class="listitem__title">${link(state, x.student)}</span>
            <span class="listitem__meta"><span>${x.student.level} ${x.student.group}</span><span>${fmtDate(x.date)}</span></span>
          </span>
          <span class="chip chip--danger">${Math.abs(x.days)} ${t('common.days')}</span>
        </li>`)}
      </ul>`)}

      ${block(t('compliance.piSoon', { n: th.piWarnDays ?? 30 }), c.piSoon.length, 'chip--warn', html`<ul class="list">
        ${c.piSoon.map((x) => html`<li class="listitem">
          <span class="listitem__main">
            <span class="listitem__title">${link(state, x.student)}</span>
            <span class="listitem__meta"><span>${fmtDate(x.date)}</span></span>
          </span>
          <span class="chip chip--warn">${x.days} ${t('common.days')}</span>
        </li>`)}
      </ul>`)}

      ${block(t('compliance.agreementsOverdue'), c.agreementsOverdue.length, 'chip--danger', html`<ul class="list">
        ${c.agreementsOverdue.slice(0, 20).map((k) => html`<li class="listitem">
          <span class="listitem__main">
            <span class="listitem__title">${k.title}</span>
            <span class="listitem__meta">
              ${k.studentId ? link(state, store.find('students', k.studentId)) : ''}
              ${k.owner ? html`<span>${k.owner}</span>` : ''}
              <span>${fmtDate(k.due)}</span>
            </span>
          </span>
          <button type="button" class="iconbtn iconbtn--sm" data-act="cp:task" data-id="${k.id}" aria-label="${t('tasks.markDone')}">${icon('check')}</button>
        </li>`)}
      </ul>`)}

      ${block(t('compliance.referralsPending'), c.referralsPending.length, 'chip--warn', html`<ul class="list">
        ${c.referralsPending.map((r) => html`<li class="listitem">
          <span class="listitem__main">
            <span class="listitem__title">${r.serviceName || store.find('services', r.serviceId)?.name || '—'}</span>
            <span class="listitem__meta">
              ${link(state, store.find('students', r.studentId) || {})}
              <span>${fmtDate(r.requestedAt)}</span>
              <span>${tEnum('referralState', r.state)}</span>
            </span>
          </span>
          <button type="button" class="iconbtn iconbtn--sm" data-act="cp:referral" data-id="${r.id}" aria-label="${t('common.edit')}">${icon('edit')}</button>
        </li>`)}
      </ul>`)}

      ${block(t('compliance.consentsMissing'), c.consentsMissing.length, 'chip--danger', html`<ul class="list">
        ${c.consentsMissing.map((r) => html`<li class="listitem">
          <span class="listitem__main">
            <span class="listitem__title">${r.serviceName || '—'}</span>
            <span class="listitem__meta">${link(state, store.find('students', r.studentId) || {})}<span>${fmtDate(r.requestedAt)}</span></span>
          </span>
          <button type="button" class="btn btn--sm" data-act="cp:consent" data-student="${r.studentId}">${t('casework.newConsent')}</button>
        </li>`)}
      </ul>`)}

      ${block(t('compliance.demandsUnanswered'), c.demandsUnanswered.length, 'chip--warn', html`<ul class="list">
        ${c.demandsUnanswered.map((d) => html`<li class="listitem">
          <span class="listitem__main">
            <span class="listitem__title">${d.motive}</span>
            <span class="listitem__meta">
              ${link(state, store.find('students', d.studentId) || {})}
              <span>${fmtDate(d.receivedAt)}</span>
              <span>${tEnum('urgency', d.urgency)}</span>
            </span>
          </span>
          <button type="button" class="iconbtn iconbtn--sm" data-act="cp:demand" data-id="${d.id}" aria-label="${t('common.edit')}">${icon('edit')}</button>
        </li>`)}
      </ul>`)}

      ${block(t('compliance.contactGap', { n: th.noContactDays ?? 45 }), c.contactGap.length, 'chip--warn', html`<ul class="list">
        ${c.contactGap.slice(0, 25).map((x) => html`<li class="listitem">
          <span class="listitem__main">
            <span class="listitem__title">${link(state, x.student)}</span>
            <span class="listitem__meta"><span>${x.student.level} ${x.student.group}</span><span>${x.last ? fmtDate(x.last) : t('students.noRecords')}</span></span>
          </span>
          <button type="button" class="btn btn--sm" data-act="record:new" data-student="${x.student.id}">${t('records.new')}</button>
        </li>`)}
      </ul>`)}

      ${block(t('compliance.chainGaps'), c.chainGaps.length, 'chip--warn', html`<ul class="list">
        ${c.chainGaps.slice(0, 25).map((x) => html`<li class="listitem">
          <span class="listitem__main">
            <span class="listitem__title"><a href="${href('alumnat', x.student.id, { t: 'chain' })}">${sel.listName(x.student, state.settings.presentation)}</a></span>
            <span class="listitem__meta">${x.chain.filter((s) => s.status === 'buit' && s.expected).map((s) => html`<span>${t(`chain.steps.${s.key}`)}</span>`)}</span>
          </span>
          <span class="chip chip--warn">${x.chain.filter((s) => s.status === 'buit' && s.expected).length}</span>
        </li>`)}
      </ul>`)}
    </div>`;
}

export function actions({ state }) {
  return {
    'cp:task': (el) => { act.setTaskState(el.dataset.id, 'fet'); scheduleRender(); },
    'cp:referral': (el) => editReferral({ referralId: el.dataset.id, onSaved: scheduleRender }),
    'cp:demand': (el) => editDemand({ demandId: el.dataset.id, onSaved: scheduleRender }),
    'cp:consent': (el) => editConsent({ studentId: el.dataset.student, onSaved: scheduleRender }),
    'cp:csv': () => {
      const c = sel.compliance(state);
      const rows = [];
      c.piOverdue.forEach((x) => rows.push([t('compliance.piOverdue'), sel.listName(x.student, false), x.date, `${Math.abs(x.days)} dies`]));
      c.agreementsOverdue.forEach((k) => rows.push([t('compliance.agreementsOverdue'), k.title, k.due, k.owner || '']));
      c.referralsPending.forEach((r) => rows.push([t('compliance.referralsPending'), r.serviceName || '', r.requestedAt, tEnum('referralState', r.state)]));
      c.demandsUnanswered.forEach((d) => rows.push([t('compliance.demandsUnanswered'), d.motive, d.receivedAt, tEnum('urgency', d.urgency)]));
      c.contactGap.forEach((x) => rows.push([t('compliance.contactGap', { n: '' }), sel.listName(x.student, false), x.last || '', String(x.days ?? '')]));
      exportCSV(['Alerta', 'Element', 'Data', 'Detall'], rows, 'compliment');
      act.logExport('CSV', `Compliment (${rows.length} alertes) — ${today()}`);
    },
  };
}
