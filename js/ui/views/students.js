/**
 * students.js - llistat d'alumnat amb cerca instantània i filtres combinables.
 */
import { html, icon, raw } from '../dom.js';
import { t, tEnum, fmtDate, enumOptions } from '../../core/i18n.js';
import * as sel from '../../domain/selectors.js';
import * as store from '../../core/store.js';
import { current, setQuery, href } from '../router.js';
import { age, daysSince } from '../../core/dates.js';
import { exportCSV } from '../../core/export.js';
import { logExport } from '../../domain/actions.js';

export function title({ state }) {
  return { title: t('students.title'), subtitle: t('students.count', { n: sel.allStudents(state).length }) };
}

function filtersOf(route) {
  return {
    query: route.query.q || '',
    level: route.query.level || '',
    group: route.query.group || '',
    nese: route.query.nese || '',
    status: route.query.status || '',
    tutor: route.query.tutor || '',
    serviceId: route.query.service || '',
    contactGap: route.query.gap || '',
  };
}

function select(name, label, value, options) {
  return html`<div class="field">
    <label class="sr-only" for="fs-${name}">${label}</label>
    <select class="select input--sm" id="fs-${name}" data-act-change="students:filter" data-key="${name}" aria-label="${label}">
      <option value="">${label}</option>
      ${options.map((o) => html`<option value="${o.value}"${raw(String(o.value) === String(value) ? ' selected' : '')}>${o.label}</option>`)}
    </select>
  </div>`;
}

export function render({ state }) {
  const route = current();
  const filters = filtersOf(route);
  const list = sel.filterStudents(state, filters);
  const p = state.settings.presentation;
  const gapThreshold = state.settings.thresholds?.noContactDays ?? 45;

  return html`
    <div class="page-head">
      <div>
        <h2>${t('students.title')}</h2>
        <p class="muted small">${t('students.count', { n: list.length })}${p ? ` · ${t('students.presentationOn')}` : ''}</p>
      </div>
      <div class="row">
        <button type="button" class="btn btn--sm" data-act="students:csv">${icon('download')}${t('stats.exportCsv')}</button>
        <button type="button" class="btn btn--primary" data-act="student:new">${icon('plus')}${t('students.new')}</button>
      </div>
    </div>

    <div class="filters">
      <div class="searchbox">
        ${icon('search')}
        <label class="sr-only" for="students-q">${t('students.search')}</label>
        <input class="input input--sm" type="search" id="students-q" value="${filters.query}"
          placeholder="${t('students.search')}" data-act-input="students:search" autocomplete="off">
      </div>
      ${select('level', t('common.level'), filters.level, sel.levels(state).map((v) => ({ value: v, label: v })))}
      ${select('group', t('common.group'), filters.group, sel.groups(state).map((v) => ({ value: v, label: v })))}
      ${select('nese', 'NESE', filters.nese, enumOptions('nese'))}
      ${select('status', t('common.state'), filters.status, enumOptions('fileState'))}
      ${select('tutor', t('common.tutor'), filters.tutor, sel.tutors(state).map((v) => ({ value: v, label: v })))}
      ${select('service', t('common.service'), filters.serviceId, store.live('services').map((s) => ({ value: s.id, label: s.name })))}
      ${select('gap', t('students.lastContact'), filters.contactGap, [
    { value: '15', label: `> 15 ${t('common.days')}` },
    { value: String(gapThreshold), label: `> ${gapThreshold} ${t('common.days')}` },
    { value: '90', label: `> 90 ${t('common.days')}` },
  ])}
      ${Object.values(filters).some(Boolean) ? html`<button type="button" class="btn btn--sm btn--ghost" data-act="students:clear">${t('common.reset')}</button>` : ''}
    </div>

    ${list.length ? html`<div class="card card--pad0">
      <div class="tablewrap">
        <table class="table table--cards table--clickable">
          <thead><tr>
            <th>${t('common.name')}</th>
            <th>${t('common.level')}</th>
            <th>${t('common.group')}</th>
            <th>${t('common.tutor')}</th>
            <th>NESE</th>
            <th>PI</th>
            <th>${t('students.lastContact')}</th>
            <th>${t('common.state')}</th>
          </tr></thead>
          <tbody>
            ${list.map((s) => {
    const last = sel.lastContactDate(state, s.id);
    const gap = last ? daysSince(last) : null;
    const years = age(s.birth);
    return html`<tr data-act="students:open" data-id="${s.id}" tabindex="0" data-act-keydown="students:key">
              <td data-th="${t('common.name')}">
                <b>${sel.listName(s, p)}</b>
                ${years !== null ? html`<span class="muted tiny" style="display:block">${years} anys</span>` : ''}
              </td>
              <td data-th="${t('common.level')}">${s.level}</td>
              <td data-th="${t('common.group')}">${s.group}</td>
              <td data-th="${t('common.tutor')}">${s.tutorName}</td>
              <td data-th="NESE">${s.nese?.category && s.nese.category !== 'cap'
    ? html`<span class="chip chip--accent">${tEnum('nese', s.nese.category)}</span>` : ''}</td>
              <td data-th="PI">${s.nese?.pi?.has
    ? html`<span class="chip ${s.nese.pi.review && s.nese.pi.review < new Date().toISOString().slice(0, 10) ? 'chip--danger' : 'chip--outline'}">${s.nese.pi.review ? fmtDate(s.nese.pi.review) : t('common.yes')}</span>` : ''}</td>
              <td data-th="${t('students.lastContact')}" class="num">${last
    ? html`<span class="${gap >= gapThreshold ? 'chip chip--warn' : ''}">${fmtDate(last)}</span>`
    : html`<span class="muted-2">${t('students.noRecords')}</span>`}</td>
              <td data-th="${t('common.state')}"><span class="chip ${s.status?.value === 'actiu' ? 'chip--ok' : s.status?.value === 'tancat' ? '' : 'chip--info'}">${tEnum('fileState', s.status?.value)}</span></td>
            </tr>`;
  })}
          </tbody>
        </table>
      </div>
    </div>` : html`<div class="empty">
      <h3>${state.students.length ? t('common.empty') : t('students.noStudents')}</h3>
      <p><button type="button" class="btn btn--primary" data-act="student:new" style="margin-top:12px">${t('students.new')}</button></p>
    </div>`}`;
}

export function actions({ state }) {
  return {
    'students:search': (el) => setQuery({ q: el.value }),
    'students:filter': (el) => setQuery({ [el.dataset.key]: el.value }),
    'students:clear': () => setQuery({ q: '', level: '', group: '', nese: '', status: '', tutor: '', service: '', gap: '' }),
    'students:open': (el) => { window.location.hash = href('alumnat', el.dataset.id); },
    'students:key': (el, event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.location.hash = href('alumnat', el.dataset.id);
      }
    },
    'students:csv': () => {
      const list = sel.filterStudents(state, filtersOf(current()));
      exportCSV(
        ['Cognoms', 'Nom', 'Data naixement', 'Edat', 'Nivell', 'Grup', 'Tutor/a', 'NESE', 'PI', 'Revisió PI', 'Estat', 'Últim contacte'],
        list.map((s) => [
          s.surname, s.name, s.birth, age(s.birth) ?? '', s.level, s.group, s.tutorName,
          tEnum('nese', s.nese?.category), s.nese?.pi?.has ? 'Sí' : 'No', s.nese?.pi?.review || '',
          tEnum('fileState', s.status?.value), sel.lastContactDate(state, s.id) || '',
        ]),
        'alumnat',
      );
      logExport('CSV', `${list.length} alumnes`);
    },
  };
}

export function mount(root) {
  const search = root.querySelector('#students-q');
  if (search && document.activeElement !== search && search.value) {
    search.focus();
    search.setSelectionRange(search.value.length, search.value.length);
  }
}

