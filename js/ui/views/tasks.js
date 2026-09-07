/**
 * tasks.js - tasques i alertes: acords no tancats, revisions preceptives
 * i tasques manuals, agrupades per venciment.
 */
import { html, icon } from '../dom.js';
import { t, tEnum, fmtDate } from '../../core/i18n.js';
import * as sel from '../../domain/selectors.js';
import * as store from '../../core/store.js';
import * as act from '../../domain/actions.js';
import { current, setQuery, href } from '../router.js';
import { today } from '../../core/dates.js';
import { pct } from '../../core/util.js';
import { editTask, annulEntity } from '../editors.js';
import { scheduleRender } from '../shell.js';
import { exportCSV } from '../../core/export.js';

export function title({ state }) {
  return { title: t('tasks.title'), subtitle: `${sel.overdueTasks(state).length} ${t('tasks.overdue').toLowerCase()}` };
}

function buckets(state, filter) {
  const now = today();
  const all = sel.tasksOf(state).filter((k) => (filter === 'done' ? k.state === 'fet' : k.state !== 'fet'));
  return {
    overdue: all.filter((k) => k.due && k.due < now && k.state !== 'fet'),
    dueToday: all.filter((k) => k.due === now && k.state !== 'fet'),
    upcoming: all.filter((k) => k.due && k.due > now && k.state !== 'fet'),
    noDue: all.filter((k) => !k.due && k.state !== 'fet'),
    done: filter === 'done' ? all : [],
  };
}

function taskItem(state, k) {
  const student = k.studentId ? store.find('students', k.studentId) : null;
  const overdue = k.due && k.due < today() && k.state !== 'fet';
  return html`<li class="listitem">
    <span class="listitem__main">
      <span class="listitem__title">${k.title}</span>
      <span class="listitem__meta">
        ${student ? html`<a href="${href('alumnat', student.id)}">${sel.listName(student, state.settings.presentation)}</a>` : ''}
        ${k.owner ? html`<span>${k.owner}</span>` : ''}
        <span>${k.due ? fmtDate(k.due) : t('tasks.noDue')}</span>
        <span>${k.origin?.kind === 'acord' ? t('tasks.originAcord') : k.origin?.kind === 'revisio' ? t('tasks.originRevisio') : t('tasks.originManual')}</span>
      </span>
    </span>
    <span class="row row--tight">
      <span class="chip ${k.state === 'fet' ? 'chip--ok' : overdue ? 'chip--danger' : 'chip--warn'}">${tEnum('taskState', k.state)}</span>
      ${k.state !== 'fet'
    ? html`<button type="button" class="iconbtn iconbtn--sm" data-act="tk:done" data-id="${k.id}" aria-label="${t('tasks.markDone')}">${icon('check')}</button>`
    : html`<button type="button" class="iconbtn iconbtn--sm" data-act="tk:reopen" data-id="${k.id}" aria-label="${t('common.undo')}">${icon('history')}</button>`}
      <button type="button" class="iconbtn iconbtn--sm" data-act="tk:edit" data-id="${k.id}" aria-label="${t('common.edit')}">${icon('edit')}</button>
      <button type="button" class="iconbtn iconbtn--sm" data-act="tk:del" data-id="${k.id}" aria-label="${t('common.delete')}">${icon('trash')}</button>
    </span>
  </li>`;
}

function group(state, label, list, tone = '') {
  if (!list.length) return '';
  return html`<section class="card">
    <div class="card__head"><h3>${label}</h3><span class="chip ${tone}">${list.length}</span></div>
    <ul class="list">${list.map((k) => taskItem(state, k))}</ul>
  </section>`;
}

export function render({ state }) {
  const filter = current().query.f || 'open';
  const b = buckets(state, filter);
  const allTasks = sel.tasksOf(state);
  const done = allTasks.filter((k) => k.state === 'fet').length;
  const inTime = allTasks.filter((k) => k.state === 'fet' && (!k.due || !k.doneAt || k.doneAt <= k.due)).length;
  const empty = !b.overdue.length && !b.dueToday.length && !b.upcoming.length && !b.noDue.length && !b.done.length;

  return html`
    <div class="page-head">
      <div>
        <h2>${t('tasks.title')}</h2>
        <p class="muted small">${t('tasks.completionHint', { done: inTime, total: allTasks.length })}</p>
      </div>
      <div class="row">
        <div class="btngroup">
          ${[['open', t('common.pending')], ['overdue', t('tasks.overdue')], ['done', t('common.done')]].map(([k, l]) => html`
            <button type="button" class="btn btn--sm" data-act="tk:filter" data-f="${k}" aria-pressed="${filter === k}">${l}</button>`)}
        </div>
        <button type="button" class="btn btn--sm" data-act="tk:csv">${icon('download')}CSV</button>
        <button type="button" class="btn btn--primary" data-act="task:new">${icon('plus')}${t('tasks.new')}</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="row row--between">
        <span class="field__label">${t('tasks.completion')}</span>
        <span class="mono">${pct(inTime, allTasks.length)} %</span>
      </div>
      <div class="progress" style="margin-top:8px"><div class="progress__fill" style="width:${pct(done, allTasks.length)}%"></div></div>
    </div>

    ${empty ? html`<div class="empty"><h3>${t('tasks.empty')}</h3></div>` : html`<div class="stack">
      ${filter === 'done'
    ? group(state, t('common.done'), b.done, 'chip--ok')
    : html`
        ${group(state, t('tasks.overdue'), b.overdue, 'chip--danger')}
        ${filter !== 'overdue' ? html`
          ${group(state, t('tasks.dueToday'), b.dueToday, 'chip--warn')}
          ${group(state, t('tasks.upcoming'), b.upcoming)}
          ${group(state, t('tasks.noDue'), b.noDue)}` : ''}`}
    </div>`}`;
}

export function actions({ state }) {
  return {
    'tk:filter': (el) => setQuery({ f: el.dataset.f }),
    'tk:done': (el) => { act.setTaskState(el.dataset.id, 'fet'); scheduleRender(); },
    'tk:reopen': (el) => { act.setTaskState(el.dataset.id, 'pendent'); scheduleRender(); },
    'tk:edit': (el) => editTask({ taskId: el.dataset.id, onSaved: scheduleRender }),
    'tk:del': (el) => annulEntity('tasks', el.dataset.id, { onDone: scheduleRender }),
    'tk:csv': () => {
      const list = sel.tasksOf(state);
      exportCSV(
        ['Tasca', 'Alumne/a', 'Responsable', 'Data límit', 'Estat', 'Origen'],
        list.map((k) => [
          k.title,
          k.studentId ? sel.listName(store.find('students', k.studentId), false) : '',
          k.owner, k.due, tEnum('taskState', k.state), k.origin?.kind || 'manual',
        ]),
        'tasques',
      );
      act.logExport('CSV', `${list.length} tasques`);
    },
  };
}
