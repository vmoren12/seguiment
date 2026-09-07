/**
 * casework.js - demandes, derivacions i consentiments del conjunt del centre.
 */
import { html, icon } from '../dom.js';
import { t, tEnum, fmtDate } from '../../core/i18n.js';
import * as sel from '../../domain/selectors.js';
import * as store from '../../core/store.js';
import * as act from '../../domain/actions.js';
import { current, setQuery, href } from '../router.js';
import { diffDays } from '../../core/dates.js';
import { exportCSV } from '../../core/export.js';
import { editDemand, editReferral, editConsent, annulEntity } from '../editors.js';
import { scheduleRender } from '../shell.js';
import { sortBy } from '../../core/util.js';

const TABS = ['demands', 'referrals', 'consents'];

export function title() { return { title: t('casework.title'), subtitle: '' }; }

function tab() { return TABS.includes(current().query.tab) ? current().query.tab : 'demands'; }

function studentLink(state, id) {
  const s = store.find('students', id);
  if (!s) return html`<span class="muted-2">—</span>`;
  return html`<a href="${href('alumnat', s.id)}">${sel.listName(s, state.settings.presentation)}</a>`;
}

function demandsTable(state) {
  const list = sortBy(state.demands.filter((d) => !d.annulled), (d) => d.receivedAt, 'desc');
  if (!list.length) return html`<div class="empty"><h3>${t('casework.emptyDemands')}</h3></div>`;
  return html`<div class="tablewrap"><table class="table table--cards">
    <thead><tr>
      <th>${t('common.student')}</th><th>${t('casework.demandOrigin')}</th><th>${t('casework.receivedAt')}</th>
      <th>${t('casework.urgency')}</th><th>${t('casework.firstActionAt')}</th><th>${t('casework.responseTime')}</th>
      <th>${t('common.state')}</th><th></th>
    </tr></thead>
    <tbody>${list.map((d) => {
    const days = d.firstActionAt ? diffDays(d.receivedAt, d.firstActionAt) : null;
    return html`<tr>
        <td data-th="${t('common.student')}">${studentLink(state, d.studentId)}</td>
        <td data-th="${t('casework.demandOrigin')}">${tEnum('demandOrigin', d.origin)}</td>
        <td data-th="${t('casework.receivedAt')}">${fmtDate(d.receivedAt)}</td>
        <td data-th="${t('casework.urgency')}"><span class="chip ${d.urgency === 'alta' ? 'chip--danger' : d.urgency === 'mitjana' ? 'chip--warn' : ''}">${tEnum('urgency', d.urgency)}</span></td>
        <td data-th="${t('casework.firstActionAt')}">${d.firstActionAt ? fmtDate(d.firstActionAt) : html`<span class="chip chip--warn">${t('casework.noFirstAction')}</span>`}</td>
        <td data-th="${t('casework.responseTime')}" class="num">${days !== null ? t('casework.responseTimeDays', { n: days }) : '—'}</td>
        <td data-th="${t('common.state')}">${tEnum('demandState', d.state)}</td>
        <td class="right">
          <button type="button" class="iconbtn iconbtn--sm" data-act="cw:demand:edit" data-id="${d.id}" aria-label="${t('common.edit')}">${icon('edit')}</button>
          <button type="button" class="iconbtn iconbtn--sm" data-act="cw:demand:del" data-id="${d.id}" aria-label="${t('common.delete')}">${icon('trash')}</button>
        </td>
      </tr>`;
  })}</tbody>
  </table></div>`;
}

function referralsTable(state) {
  const list = sortBy(state.referrals.filter((r) => !r.annulled), (r) => r.requestedAt, 'desc');
  if (!list.length) return html`<div class="empty"><h3>${t('casework.emptyReferrals')}</h3></div>`;
  return html`<div class="tablewrap"><table class="table table--cards">
    <thead><tr>
      <th>${t('common.student')}</th><th>${t('casework.destination')}</th><th>${t('casework.requestedAt')}</th>
      <th>${t('casework.consent')}</th><th>${t('common.state')}</th><th>${t('casework.resolvedAt')}</th><th></th>
    </tr></thead>
    <tbody>${list.map((r) => html`<tr>
      <td data-th="${t('common.student')}">${studentLink(state, r.studentId)}</td>
      <td data-th="${t('casework.destination')}">${r.serviceName || store.find('services', r.serviceId)?.name || '—'}</td>
      <td data-th="${t('casework.requestedAt')}">${fmtDate(r.requestedAt)}</td>
      <td data-th="${t('casework.consent')}">${r.consentId
    ? html`<span class="chip chip--ok">${t('common.yes')}</span>`
    : html`<span class="chip chip--warn">${t('common.no')}</span>`}</td>
      <td data-th="${t('common.state')}"><span class="chip ${r.resolvedAt ? 'chip--ok' : 'chip--info'}">${tEnum('referralState', r.state)}</span></td>
      <td data-th="${t('casework.resolvedAt')}">${r.resolvedAt ? fmtDate(r.resolvedAt) : '—'}</td>
      <td class="right">
        <button type="button" class="iconbtn iconbtn--sm" data-act="cw:referral:edit" data-id="${r.id}" aria-label="${t('common.edit')}">${icon('edit')}</button>
        <button type="button" class="iconbtn iconbtn--sm" data-act="cw:referral:del" data-id="${r.id}" aria-label="${t('common.delete')}">${icon('trash')}</button>
      </td>
    </tr>`)}</tbody>
  </table></div>`;
}

function consentsTable(state) {
  const list = sortBy(state.consents.filter((c) => !c.annulled), (c) => c.obtainedAt, 'desc');
  if (!list.length) return html`<div class="empty"><h3>${t('casework.emptyConsents')}</h3></div>`;
  return html`<div class="tablewrap"><table class="table table--cards">
    <thead><tr>
      <th>${t('common.student')}</th><th>${t('casework.consentType')}</th><th>${t('casework.obtainedAt')}</th>
      <th>${t('casework.via')}</th><th>${t('casework.validUntil')}</th><th>${t('common.document')}</th><th></th>
    </tr></thead>
    <tbody>${list.map((c) => html`<tr>
      <td data-th="${t('common.student')}">${studentLink(state, c.studentId)}</td>
      <td data-th="${t('casework.consentType')}">${tEnum('consentType', c.type)}</td>
      <td data-th="${t('casework.obtainedAt')}">${fmtDate(c.obtainedAt)}</td>
      <td data-th="${t('casework.via')}">${tEnum('consentVia', c.via)}</td>
      <td data-th="${t('casework.validUntil')}">${c.validUntil ? fmtDate(c.validUntil) : '—'}</td>
      <td data-th="${t('common.document')}">${c.document || '—'}</td>
      <td class="right">
        ${c.revoked ? html`<span class="chip chip--danger">${t('casework.revoked')}</span>` : ''}
        <button type="button" class="iconbtn iconbtn--sm" data-act="cw:consent:edit" data-id="${c.id}" aria-label="${t('common.edit')}">${icon('edit')}</button>
        <button type="button" class="iconbtn iconbtn--sm" data-act="cw:consent:del" data-id="${c.id}" aria-label="${t('common.delete')}">${icon('trash')}</button>
      </td>
    </tr>`)}</tbody>
  </table></div>`;
}

export function render({ state }) {
  const active = tab();
  const newAction = { demands: 'cw:demand:new', referrals: 'cw:referral:new', consents: 'cw:consent:new' }[active];
  const newLabel = { demands: t('casework.newDemand'), referrals: t('casework.newReferral'), consents: t('casework.newConsent') }[active];

  return html`
    <div class="page-head">
      <div><h2>${t('casework.title')}</h2></div>
      <div class="row">
        <button type="button" class="btn btn--sm" data-act="cw:csv">${icon('download')}CSV</button>
        <button type="button" class="btn btn--primary" data-act="${newAction}">${icon('plus')}${newLabel}</button>
      </div>
    </div>

    <nav class="tabs" role="tablist">
      ${TABS.map((k) => html`<button type="button" class="tab" role="tab" aria-selected="${k === active}"
        data-act="cw:tab" data-tab="${k}">${t(`casework.${k}`)}</button>`)}
    </nav>

    <div class="card card--pad0" role="tabpanel">
      ${active === 'demands' ? demandsTable(state) : active === 'referrals' ? referralsTable(state) : consentsTable(state)}
    </div>`;
}

export function actions({ state }) {
  const refresh = () => scheduleRender();
  return {
    'cw:tab': (el) => setQuery({ tab: el.dataset.tab }),
    'cw:demand:new': () => editDemand({ onSaved: refresh }),
    'cw:demand:edit': (el) => editDemand({ demandId: el.dataset.id, onSaved: refresh }),
    'cw:demand:del': (el) => annulEntity('demands', el.dataset.id, { onDone: refresh }),
    'cw:referral:new': () => editReferral({ onSaved: refresh }),
    'cw:referral:edit': (el) => editReferral({ referralId: el.dataset.id, onSaved: refresh }),
    'cw:referral:del': (el) => annulEntity('referrals', el.dataset.id, { onDone: refresh }),
    'cw:consent:new': () => editConsent({ onSaved: refresh }),
    'cw:consent:edit': (el) => editConsent({ consentId: el.dataset.id, onSaved: refresh }),
    'cw:consent:del': (el) => annulEntity('consents', el.dataset.id, { onDone: refresh }),
    'cw:csv': () => {
      const active = tab();
      const name = (id) => sel.listName(store.find('students', id), false);
      if (active === 'demands') {
        exportCSV(['Alumne/a', 'Origen', 'Recepció', 'Urgència', 'Primera actuació', 'Dies', 'Estat', 'Motiu'],
          state.demands.filter((d) => !d.annulled).map((d) => [
            name(d.studentId), tEnum('demandOrigin', d.origin), d.receivedAt, tEnum('urgency', d.urgency),
            d.firstActionAt, d.firstActionAt ? diffDays(d.receivedAt, d.firstActionAt) : '', tEnum('demandState', d.state), d.motive,
          ]), 'demandes');
      } else if (active === 'referrals') {
        exportCSV(['Alumne/a', 'Servei', 'Sol·licitud', 'Consentiment', 'Estat', 'Resolució', 'Motiu'],
          state.referrals.filter((r) => !r.annulled).map((r) => [
            name(r.studentId), r.serviceName || '', r.requestedAt, r.consentId ? 'Sí' : 'No',
            tEnum('referralState', r.state), r.resolvedAt, r.motive,
          ]), 'derivacions');
      } else {
        exportCSV(['Alumne/a', 'Tipus', 'Obtenció', 'Via', 'Vigència', 'Document', 'Abast'],
          state.consents.filter((c) => !c.annulled).map((c) => [
            name(c.studentId), tEnum('consentType', c.type), c.obtainedAt, tEnum('consentVia', c.via),
            c.validUntil, c.document, c.scope,
          ]), 'consentiments');
      }
      act.logExport('CSV', t(`casework.${active}`));
    },
  };
}
