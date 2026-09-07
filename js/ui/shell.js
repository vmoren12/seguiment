/**
 * shell.js - estructura de l'aplicació: navegació, capçalera, dreceres de
 * teclat, cerca ràpida i cicle de renderitzat de les vistes.
 */
import { html, raw, paint, icon, toHTML, registerGlobalActions, setViewActions, installDelegation, $ } from './dom.js';
import { openModal } from './components/modal.js';
import { toast } from './components/toast.js';
import { t, setLang, getLang, fmtTime, fmtDate } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as persist from '../core/persist.js';
import * as sel from '../domain/selectors.js';
import * as router from './router.js';
import { editStudent, editRecord, editAppointment, editDemand, editTask } from './editors.js';
import { today, daysSince, toISOLocal, minutesOfDay } from '../core/dates.js';

import * as viewDashboard from './views/dashboard.js';
import * as viewAgenda from './views/agenda.js';
import * as viewStudents from './views/students.js';
import * as viewStudent from './views/student.js';
import * as viewTasks from './views/tasks.js';
import * as viewCompliance from './views/compliance.js';
import * as viewCasework from './views/casework.js';
import * as viewServices from './views/services.js';
import * as viewStats from './views/stats.js';
import * as viewAudit from './views/audit.js';
import * as viewDocuments from './views/documents.js';
import * as viewSettings from './views/settings.js';

/** Definició de la navegació principal. */
const NAV = [
  { route: 'inici', key: 'dashboard', icon: 'dashboard', primary: true },
  { route: 'agenda', key: 'agenda', icon: 'calendar', primary: true },
  { route: 'alumnat', key: 'students', icon: 'users', primary: true },
  { route: 'tasques', key: 'tasks', icon: 'checklist', primary: true, badge: (s) => sel.overdueTasks(s).length },
  { route: 'compliment', key: 'compliance', icon: 'shield', badge: (s) => sel.alertCount(s) },
  { separator: true },
  { route: 'demandes', key: 'casework', icon: 'inbox' },
  { route: 'serveis', key: 'services', icon: 'network' },
  { route: 'estadistiques', key: 'stats', icon: 'chart' },
  { route: 'documents', key: 'documents', icon: 'file' },
  { route: 'auditoria', key: 'audit', icon: 'history' },
  { separator: true },
  { route: 'configuracio', key: 'settings', icon: 'settings' },
];

const VIEWS = {
  inici: viewDashboard,
  agenda: viewAgenda,
  alumnat: viewStudents,
  tasques: viewTasks,
  compliment: viewCompliance,
  demandes: viewCasework,
  serveis: viewServices,
  estadistiques: viewStats,
  auditoria: viewAudit,
  documents: viewDocuments,
  configuracio: viewSettings,
};

let renderScheduled = false;

/* ------------------------------------------------------------ Navegació */

function navItems(state, route) {
  return NAV.map((item) => {
    if (item.separator) return html`<div class="navsep" role="presentation"></div>`;
    const count = item.badge ? item.badge(state) : 0;
    const active = route.name === item.route;
    return html`<a class="navitem" href="${router.href(item.route)}"
      ${raw(active ? 'aria-current="page"' : '')} ${raw(count ? 'data-alert="true"' : '')}>
      ${icon(item.icon)}
      <span class="truncate">${t(`nav.${item.key}`)}</span>
      ${count ? html`<span class="navitem__badge">${count}</span>` : ''}
    </a>`;
  });
}

function renderNav(state, route) {
  const centre = state.settings.centre?.name;
  paint($('#sidenav'), html`
    <div class="sidenav__brand">
      <b>${t('app.name')}</b>
      <span class="truncate">${centre || t('app.tagline')}</span>
    </div>
    ${navItems(state, route)}
    <div class="sidenav__foot">
      <p>${t('app.privacy')}</p>
    </div>
  `);

  const primary = NAV.filter((x) => x.primary);
  paint($('#tabbar'), html`
    ${primary.map((item) => {
    const count = item.badge ? item.badge(state) : 0;
    return html`<a class="tabitem" href="${router.href(item.route)}"
        ${raw(route.name === item.route ? 'aria-current="page"' : '')} ${raw(count ? 'data-alert="true"' : '')}>
        ${icon(item.icon)}<span>${t(`nav.${item.key}`)}</span>
      </a>`;
  })}
    <button class="tabitem" type="button" data-act="nav:toggle">
      ${icon('menu')}<span>${t('nav.more')}</span>
    </button>
  `);
}

function setNavOpen(open) {
  const nav = $('#sidenav');
  nav.dataset.open = open ? 'true' : 'false';
  $('.scrim').hidden = !open;
  $('.topbar__menu')?.setAttribute('aria-expanded', open ? 'true' : 'false');
}

/* ------------------------------------------------------- Cicle de pintat */

/** Torna a pintar la vista activa. */
export function render() {
  const state = store.getState();
  const route = router.current();
  const view = VIEWS[route.name] || VIEWS.inici;
  const module = route.name === 'alumnat' && route.id ? viewStudent : view;

  renderNav(state, route);

  const context = { state, route, settings: state.settings };
  const heading = module.title ? module.title(context) : t(`nav.${route.name}`);
  document.getElementById('view-title').textContent = heading.title || heading;
  document.getElementById('view-sub').textContent = heading.subtitle || '';
  document.title = `${heading.title || heading} · ${t('app.name')}`;

  setViewActions(module.actions ? module.actions(context) : {});
  const root = document.getElementById('view');
  paint(root, module.render(context));
  if (module.mount) module.mount(root, context);
  root.scrollTop = 0;
}

/** Demana un repintat agrupant crides successives. */
export function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => { renderScheduled = false; render(); });
}

/* --------------------------------------------------------- Cerca ràpida */

function openSearch() {
  openModal({
    title: t('quick.search'),
    size: 'narrow',
    showSubmit: false,
    closeLabel: t('common.close'),
    body: html`
      <div class="searchbox">
        ${icon('search')}
        <input class="input" type="search" id="q-input" placeholder="${t('quick.search')}" autocomplete="off" autofocus>
      </div>
      <div id="q-results" class="stack stack--sm" style="margin-top:12px"></div>
      <p class="field__hint" style="margin-top:12px">${t('quick.searchHint')}</p>`,
    onMount: (root, api) => {
      const input = root.querySelector('#q-input');
      const results = root.querySelector('#q-results');
      const run = () => {
        const items = sel.search(store.getState(), input.value, store.settings().presentation);
        if (!items.length) {
          results.innerHTML = toHTML(html`<p class="muted small">${input.value.length < 2 ? '' : t('common.empty')}</p>`);
          return;
        }
        results.innerHTML = toHTML(html`<ul class="list">${items.map((r) => html`
          <li><button type="button" class="listitem listitem--btn" data-kind="${r.kind}" data-id="${r.id}" data-student="${r.studentId || ''}">
            <span class="listitem__main">
              <span class="listitem__title">${r.title}</span>
              <span class="listitem__meta">${t(`nav.${r.kind === 'student' ? 'students' : r.kind === 'appointment' ? 'agenda' : 'documents'}`)} · ${r.meta}</span>
            </span>
          </button></li>`)}</ul>`);
      };
      input.addEventListener('input', run);
      results.addEventListener('click', (event) => {
        const button = event.target.closest('[data-kind]');
        if (!button) return;
        const { kind, id, student } = button.dataset;
        api.close();
        if (kind === 'student') router.navigate('alumnat', id);
        else if (kind === 'appointment') router.navigate('agenda', '', { sel: id });
        else router.navigate('alumnat', student, { t: 'records', r: id });
      });
    },
  });
}

function openQuickCreate() {
  const options = [
    { key: 'newRecord', run: () => editRecord({ onSaved: scheduleRender }) },
    { key: 'newAppointment', run: () => editAppointment({ onSaved: scheduleRender }) },
    { key: 'newStudent', run: () => editStudent('', { onSaved: scheduleRender }) },
    { key: 'newDemand', run: () => editDemand({ onSaved: scheduleRender }) },
  ];
  const api = openModal({
    title: t('quick.title'),
    size: 'narrow',
    showSubmit: false,
    closeLabel: t('common.close'),
    body: html`<div class="stack stack--sm">
      ${options.map((o, i) => html`<button type="button" class="btn btn--block btn--tall" data-quick="${i}">${t(`dashboard.${o.key}`)}</button>`)}
    </div>`,
    onMount: (root) => {
      root.querySelectorAll('[data-quick]').forEach((button) => {
        button.addEventListener('click', () => {
          api.close();
          options[Number(button.dataset.quick)].run();
        });
      });
    },
  });
}

/* ------------------------------------------------------- Estat del desat */

function bindSaveIndicator() {
  const element = $('#savestate');
  persist.onSaveState((state) => {
    if (state === 'saving') { element.dataset.state = 'saving'; element.textContent = t('common.saving'); return; }
    if (state === 'saved') {
      element.dataset.state = 'saved';
      element.textContent = `${t('common.saved')} ${fmtTime(new Date())}`;
      return;
    }
    if (state === 'error') {
      element.dataset.state = 'error';
      element.textContent = t('common.saveError');
      toast(t('common.saveError'), { type: 'danger', timeout: 8000 });
    }
  });
}

/* ------------------------------------------------------------ Recordatoris */

/** Comprova cites imminents i el recordatori de còpia de seguretat. */
export function checkReminders() {
  const state = store.getState();
  const now = toISOLocal(new Date());
  const nowMinutes = minutesOfDay(now);

  state.appointments.forEach((a) => {
    if (a.annulled || !a.reminderMinutes) return;
    if (a.state === 'anullada' || a.state === 'feta') return;
    if (String(a.start).slice(0, 10) !== today()) return;
    const diff = minutesOfDay(a.start) - nowMinutes;
    if (diff > 0 && diff <= a.reminderMinutes) {
      const label = `${fmtTime(a.start)} · ${(a.studentIds || []).map((id) => sel.listName(store.find('students', id), state.settings.presentation)).join(', ')}`;
      toast(t('agenda.dueNow', { t: label }), { timeout: 9000 });
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification(t('app.name'), { body: label, tag: a.id }); } catch { /* sense notificació */ }
      }
    }
  });

  const last = state.settings.lastBackupAt;
  const gap = last ? daysSince(last) : null;
  const limit = state.settings.thresholds?.backupDays ?? 14;
  if ((gap === null && state.students.length > 3) || (gap !== null && gap >= limit)) {
    toast(gap === null ? t('settings.backupNever') : t('settings.backupReminder', { n: gap }), {
      actionLabel: t('common.export'),
      onAction: () => router.navigate('configuracio', '', { s: 'data' }),
      timeout: 10000,
    });
  }
}

/* ---------------------------------------------------------------- Arrencada */

/** Aplica el tema segons la configuració. */
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme || 'auto';
}

/** Instal·la la capa d'interfície. */
export function initShell() {
  installDelegation();
  bindSaveIndicator();

  registerGlobalActions({
    'nav:toggle': () => setNavOpen($('#sidenav').dataset.open !== 'true'),
    'nav:close': () => setNavOpen(false),
    'search:open': () => openSearch(),
    'quick:new': () => openQuickCreate(),
    'go:student': (el) => router.navigate('alumnat', el.dataset.id, el.dataset.tab ? { t: el.dataset.tab } : {}),
    'go:route': (el) => router.navigate(el.dataset.route, el.dataset.id || '', el.dataset.query ? JSON.parse(el.dataset.query) : {}),
    'record:new': (el) => editRecord({ studentId: el.dataset.student || '', onSaved: scheduleRender }),
    'appointment:new': (el) => editAppointment({ studentId: el.dataset.student || '', onSaved: scheduleRender }),
    'student:new': () => editStudent('', { onSaved: scheduleRender }),
    'task:new': (el) => editTask({ studentId: el.dataset.student || '', onSaved: scheduleRender }),
    'demand:new': (el) => editDemand({ studentId: el.dataset.student || '', onSaved: scheduleRender }),
  });

  document.addEventListener('keydown', (event) => {
    const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'm') { event.preventDefault(); openQuickCreate(); return; }
    if (event.key === 'Escape' && !inField) setNavOpen(false);
  });

  router.onRouteChange(() => { setNavOpen(false); render(); });
  store.subscribe(() => scheduleRender());

  window.addEventListener('beforeunload', () => { store.flush(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) store.flush(); });
}

/** Canvia l'idioma i repinta tota la interfície. */
export function changeLanguage(lang) {
  setLang(lang);
  document.documentElement.lang = getLang();
  render();
}

export { fmtDate };
