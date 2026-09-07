/**
 * audit.js - consulta del registre d'auditoria. Només lectura: el registre
 * és append-only i no s'ofereix cap acció de modificació ni d'esborrat.
 */
import { html, icon, raw } from '../dom.js';
import { t, fmtDateTime, fmtDate } from '../../core/i18n.js';
import * as sel from '../../domain/selectors.js';
import * as store from '../../core/store.js';
import * as act from '../../domain/actions.js';
import { filterAudit, ACTIONS, ENTITIES } from '../../core/audit.js';
import { current, setQuery, href } from '../router.js';
import { exportCSV } from '../../core/export.js';

const PAGE = 200;

export function title({ state }) {
  return { title: t('audit.title'), subtitle: t('audit.entries', { n: state.audit.length }) };
}

function filters() {
  const q = current().query;
  return {
    studentId: q.student || '',
    action: q.action || '',
    entity: q.entity || '',
    from: q.from || '',
    to: q.to || '',
    query: q.q || '',
  };
}

export function render({ state }) {
  const f = filters();
  const list = filterAudit(state.audit, f).slice().reverse();
  const page = Number(current().query.page || 1);
  const shown = list.slice(0, page * PAGE);

  return html`
    <div class="page-head">
      <div>
        <h2>${t('audit.title')}</h2>
        <p class="muted small">${t('audit.intro')}</p>
      </div>
      <div class="row">
        <button type="button" class="btn btn--sm" data-act="au:csv">${icon('download')}CSV</button>
      </div>
    </div>

    <div class="filters">
      <div class="searchbox">
        ${icon('search')}
        <label class="sr-only" for="au-q">${t('common.search')}</label>
        <input class="input input--sm" type="search" id="au-q" value="${f.query}" data-act-input="au:q" placeholder="${t('common.search')}" autocomplete="off">
      </div>
      <div class="field">
        <label class="sr-only" for="au-student">${t('audit.filterStudent')}</label>
        <select class="select input--sm" id="au-student" data-act-change="au:student">
          <option value="">${t('audit.filterStudent')}</option>
          ${sel.allStudents(state).map((s) => html`<option value="${s.id}"${raw(f.studentId === s.id ? ' selected' : '')}>${sel.listName(s, state.settings.presentation)}</option>`)}
        </select>
      </div>
      <div class="field">
        <label class="sr-only" for="au-action">${t('audit.filterAction')}</label>
        <select class="select input--sm" id="au-action" data-act-change="au:action">
          <option value="">${t('audit.filterAction')}</option>
          ${ACTIONS.map((a) => html`<option value="${a}"${raw(f.action === a ? ' selected' : '')}>${t(`audit.actions.${a}`)}</option>`)}
        </select>
      </div>
      <div class="field">
        <label class="sr-only" for="au-entity">${t('common.type')}</label>
        <select class="select input--sm" id="au-entity" data-act-change="au:entity">
          <option value="">${t('common.type')}</option>
          ${ENTITIES.map((e) => html`<option value="${e}"${raw(f.entity === e ? ' selected' : '')}>${t(`audit.entities.${e}`)}</option>`)}
        </select>
      </div>
      <input class="input input--sm" type="date" value="${f.from}" data-act-change="au:from" aria-label="${t('common.from')}">
      <input class="input input--sm" type="date" value="${f.to}" data-act-change="au:to" aria-label="${t('common.to')}">
      ${Object.values(f).some(Boolean) ? html`<button type="button" class="btn btn--sm btn--ghost" data-act="au:clear">${t('common.reset')}</button>` : ''}
    </div>

    <p class="muted small" style="margin-bottom:8px">${t('audit.entries', { n: list.length })}</p>

    ${shown.length ? html`<div class="card card--pad0"><div class="tablewrap">
      <table class="table table--cards">
        <thead><tr>
          <th>${t('common.date')}</th><th>${t('common.actions')}</th><th>${t('common.type')}</th>
          <th>${t('common.author')}</th><th>${t('common.summary')}</th><th>${t('common.details')}</th>
        </tr></thead>
        <tbody>${shown.map((e) => html`<tr>
          <td data-th="${t('common.date')}" class="nowrap">${fmtDateTime(e.at)}</td>
          <td data-th="${t('common.actions')}"><span class="chip ${e.action === 'delete' || e.action === 'wipe' ? 'chip--danger' : e.action === 'seal' ? 'chip--warn' : ''}">${t(`audit.actions.${e.action}`)}</span></td>
          <td data-th="${t('common.type')}">${t(`audit.entities.${e.entity}`) || e.entity}</td>
          <td data-th="${t('common.author')}">${e.author || '—'}</td>
          <td data-th="${t('common.summary')}">
            ${e.studentId
    ? html`<a href="${href('alumnat', e.studentId)}">${e.summary}</a>`
    : e.summary}
          </td>
          <td data-th="${t('common.details')}">
            ${e.changes ? html`<details><summary class="tiny muted">${Object.keys(e.changes).length} camps</summary>
              <dl class="deflist tiny" style="margin-top:4px">
                ${Object.entries(e.changes).map(([k, v]) => html`<div>
                  <dt>${k}</dt><dd>${v[0]} → ${v[1]}</dd>
                </div>`)}
              </dl></details>` : ''}
          </td>
        </tr>`)}</tbody>
      </table>
    </div></div>` : html`<div class="empty"><h3>${t('audit.empty')}</h3></div>`}

    ${list.length > shown.length ? html`<p class="center" style="margin-top:16px">
      <button type="button" class="btn" data-act="au:more">${t('common.more')} (${list.length - shown.length})</button>
    </p>` : ''}`;
}

export function actions({ state }) {
  return {
    'au:q': (el) => setQuery({ q: el.value, page: '' }),
    'au:student': (el) => setQuery({ student: el.value, page: '' }),
    'au:action': (el) => setQuery({ action: el.value, page: '' }),
    'au:entity': (el) => setQuery({ entity: el.value, page: '' }),
    'au:from': (el) => setQuery({ from: el.value, page: '' }),
    'au:to': (el) => setQuery({ to: el.value, page: '' }),
    'au:clear': () => setQuery({ q: '', student: '', action: '', entity: '', from: '', to: '', page: '' }),
    'au:more': () => setQuery({ page: String(Number(current().query.page || 1) + 1) }),
    'au:csv': () => {
      const list = filterAudit(state.audit, filters());
      exportCSV(
        ['Data i hora', 'Acció', 'Entitat', 'Identificador', 'Alumne/a', 'Professional', 'Resum'],
        list.map((e) => [
          e.at, t(`audit.actions.${e.action}`), t(`audit.entities.${e.entity}`), e.entityId,
          e.studentId ? sel.listName(store.find('students', e.studentId), false) : '',
          e.author, e.summary,
        ]),
        'auditoria',
      );
      act.logExport('CSV', `Auditoria (${list.length} entrades) — ${fmtDate(new Date())}`);
    },
  };
}

export function mount(root) {
  const search = root.querySelector('#au-q');
  if (search && search.value && document.activeElement !== search) {
    search.focus();
    search.setSelectionRange(search.value.length, search.value.length);
  }
}
