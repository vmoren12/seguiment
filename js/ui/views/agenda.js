/**
 * agenda.js - calendari: vistes de mes, setmana, dia i llista.
 * Punt d'entrada diari juntament amb l'escriptori.
 */
import { html, icon, raw } from '../dom.js';
import { t, tEnum, fmtTime, fmtDate, fmtMonthYear, fmtDayMonth, weekdayNames } from '../../core/i18n.js';
import * as sel from '../../domain/selectors.js';
import * as store from '../../core/store.js';
import * as act from '../../domain/actions.js';
import { current, setQuery } from '../router.js';
import { exportICS } from '../../core/export.js';
import { copyText, groupBy } from '../../core/util.js';
import {
  today, toISODate, addDays, addMonths, startOfWeek, startOfMonth, endOfMonth,
  minutesOfDay, minutesToTime, dateOf, durationMinutes, parse, rangeDates,
} from '../../core/dates.js';
import { editAppointment, closeAppointment, cancelAppointment, annulEntity } from '../editors.js';
import { scheduleRender } from '../shell.js';
import { openModal } from '../components/modal.js';
import { toast } from '../components/toast.js';

const HOUR_H = 44;

export function title() {
  return { title: t('agenda.title'), subtitle: '' };
}

/* ------------------------------------------------------------- Contextos */

function context() {
  const route = current();
  const view = route.query.v || 'week';
  const day = route.query.d || today();
  const filters = {
    type: route.query.type || '',
    studentId: route.query.student || '',
    group: route.query.group || '',
    serviceId: route.query.service || '',
    state: route.query.state || '',
  };
  return { view, day, filters };
}

function periodOf(view, day) {
  if (view === 'day') return { from: day, to: day };
  if (view === 'week') {
    const from = toISODate(startOfWeek(day));
    return { from, to: toISODate(addDays(from, 6)) };
  }
  if (view === 'list') return { from: day, to: toISODate(addDays(day, 30)) };
  const first = startOfMonth(day);
  const gridStart = toISODate(startOfWeek(first));
  return { from: gridStart, to: toISODate(addDays(gridStart, 41)), monthFrom: toISODate(first), monthTo: toISODate(endOfMonth(day)) };
}

function typeColor(state, type) {
  return (state.settings.appointmentTypes || []).find((x) => x.id === type)?.color || 'var(--accent)';
}

function studentNames(state, ids) {
  const p = state.settings.presentation;
  return (ids || []).map((id) => sel.listName(state.students.find((s) => s.id === id), p)).filter(Boolean).join(', ');
}

function label(state, a) {
  return studentNames(state, a.studentIds) || tEnum('appointmentType', a.type);
}

/* --------------------------------------------------------------- Barra */

function toolbar(state, view, day) {
  const period = periodOf(view, day);
  let heading;
  if (view === 'day') heading = fmtDayMonth(day);
  else if (view === 'week') heading = `${fmtDate(period.from)} – ${fmtDate(period.to)}`;
  else if (view === 'list') heading = `${fmtDate(period.from)} – ${fmtDate(period.to)}`;
  else heading = fmtMonthYear(day);

  const views = ['month', 'week', 'day', 'list'];
  const route = current();

  return html`<div class="cal__bar">
    <div class="btngroup">
      <button type="button" class="btn btn--sm" data-act="cal:prev" aria-label="${t('a11y.prev')}">${icon('chevronLeft')}</button>
      <button type="button" class="btn btn--sm" data-act="cal:today">${t('common.today')}</button>
      <button type="button" class="btn btn--sm" data-act="cal:next" aria-label="${t('a11y.next')}">${icon('chevronRight')}</button>
    </div>
    <span class="cal__label">${heading}</span>
    <span class="spacer"></span>
    <div class="btngroup">
      ${views.map((v) => html`<button type="button" class="btn btn--sm" data-act="cal:view" data-view="${v}"
        aria-pressed="${v === view}">${t(`agenda.views.${v}`)}</button>`)}
    </div>
    <button type="button" class="btn btn--sm" data-act="cal:filters" aria-label="${t('common.filters')}">${icon('filter')}
      ${Object.values(route.query).filter((v, i) => i > 1).length ? raw('<span class="chip chip--accent">·</span>') : ''}</button>
    <button type="button" class="btn btn--sm" data-act="cal:ics">${icon('download')}${t('agenda.exportIcs')}</button>
    <button type="button" class="btn btn--sm btn--primary" data-act="appointment:new">${icon('plus')}${t('agenda.newAppointment')}</button>
  </div>`;
}

/* ---------------------------------------------------------- Vista de mes */

function monthView(state, day, filters) {
  const period = periodOf('month', day);
  const byDay = sel.appointmentsByDay(state, period.from, period.to, filters);
  const days = rangeDates(period.from, period.to);
  const currentMonth = String(day).slice(0, 7);
  const now = today();

  return html`<div>
    <div class="calmonth" role="grid" aria-label="${fmtMonthYear(day)}">
      ${weekdayNames().map((d) => html`<div class="calmonth__dow" role="columnheader">${d}</div>`)}
    </div>
    <div class="calmonth" role="grid">
      ${days.map((d) => {
    const list = byDay.get(d) || [];
    const out = String(d).slice(0, 7) !== currentMonth;
    return html`<button type="button" class="calday" data-act="cal:day" data-date="${d}"
        data-out="${out}" data-today="${d === now}" data-sel="${d === day}"
        aria-label="${fmtDate(d)} · ${list.length}">
        <span class="calday__n">${Number(String(d).slice(8))}</span>
        ${list.slice(0, 2).map((a) => html`<span class="calday__ev" data-state="${a.state}" style="border-left-color:${typeColor(state, a.type)}">${fmtTime(a.start)} ${label(state, a)}</span>`)}
        ${list.length > 2 ? html`<span class="calday__more">+${list.length - 2}</span>` : ''}
      </button>`;
  })}
    </div>
  </div>`;
}

/* ------------------------------------------------- Vistes de setmana i dia */

/** Reparteix les cites solapades en columnes dins d'un mateix dia. */
function layoutDay(list) {
  const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
  const columns = [];
  const placed = [];
  sorted.forEach((a) => {
    let index = columns.findIndex((end) => end <= a.start);
    if (index === -1) { index = columns.length; columns.push(a.end); }
    else columns[index] = a.end;
    placed.push({ a, column: index });
  });
  const total = Math.max(1, columns.length);
  return placed.map((p) => ({ ...p, total }));
}

function timeGrid(state, days, filters) {
  const cal = state.settings.calendar || {};
  const start = toMinutes(cal.dayStart || '08:00');
  const end = toMinutes(cal.dayEnd || '18:00');
  const hours = [];
  for (let m = start; m <= end; m += 60) hours.push(m);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const availability = cal.availability || [];

  return html`<div class="calgrid__wrap">
    <div class="calgrid__head" style="--cols:${days.length}">
      <div></div>
      ${days.map((d) => html`<div class="calgrid__dayhead" data-today="${d === today()}">
        <span>${weekdayNames()[(parse(d).getDay() + 6) % 7]}</span>
        <b>${Number(String(d).slice(8))}</b>
      </div>`)}
    </div>
    <div class="calgrid" style="--cols:${days.length}" data-grid data-start="${start}" data-end="${end}">
      <div>${hours.map((m) => html`<div class="caltime">${minutesToTime(m)}</div>`)}</div>
      ${days.map((d) => {
    const list = sel.appointmentsInRange(state, d, d, filters);
    const placed = layoutDay(list);
    const dow = parse(d).getDay();
    return html`<div class="calcol" data-col data-date="${d}">
          ${hours.map(() => html`<div class="calhour"></div>`)}
          ${availability.filter((s) => Number(s.day) === dow).map((s) => {
      const from = Math.max(toMinutes(s.from), start);
      const to = Math.min(toMinutes(s.to), end);
      if (to <= from) return '';
      return html`<div class="calavail" style="top:${((from - start) / 60) * HOUR_H}px;height:${((to - from) / 60) * HOUR_H}px"></div>`;
    })}
          <button type="button" class="calslot" data-act="cal:slot" data-date="${d}" aria-label="${t('agenda.slotFree')} ${fmtDate(d)}"></button>
          ${d === today() && nowMinutes >= start && nowMinutes <= end
    ? html`<div class="calnow" style="top:${((nowMinutes - start) / 60) * HOUR_H}px"></div>` : ''}
          ${placed.map(({ a, column, total }) => {
      const from = Math.max(minutesOfDay(a.start), start);
      const to = Math.min(minutesOfDay(a.end), end);
      const top = ((from - start) / 60) * HOUR_H;
      const height = Math.max(20, ((to - from) / 60) * HOUR_H - 2);
      const width = 100 / total;
      return html`<button type="button" class="calev" data-act="cal:open" data-id="${a.id}" data-drag-item
              data-state="${a.state}"
              style="top:${top}px;height:${height}px;left:${column * width}%;width:calc(${width}% - 3px);border-left-color:${typeColor(state, a.type)}">
              <b>${fmtTime(a.start)}</b>${label(state, a)}
            </button>`;
    })}
        </div>`;
  })}
    </div>
  </div>`;
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/* ------------------------------------------------------- Vista de llista */

function listView(state, day, filters) {
  const period = periodOf('list', day);
  const list = sel.appointmentsInRange(state, period.from, period.to, filters);
  if (!list.length) return html`<div class="empty"><h3>${t('agenda.noAppointments')}</h3></div>`;
  const byDay = groupBy(list, (a) => dateOf(a.start));

  return html`<div class="stack" style="padding:12px">
    ${[...byDay.entries()].map(([d, items]) => html`<section>
      <h4 style="margin-bottom:4px">${fmtDayMonth(d)}</h4>
      <ul class="list">
        ${items.map((a) => html`<li class="listitem" data-state="${a.state}">
          <span class="listitem__time">${fmtTime(a.start)}</span>
          <span class="listitem__main">
            <button type="button" class="listitem__title" data-act="cal:open" data-id="${a.id}"
              style="background:none;border:0;padding:0;font:inherit;font-weight:500;text-align:left;cursor:pointer;color:inherit">${label(state, a)}</button>
            <span class="listitem__meta">
              <span>${tEnum('appointmentType', a.type)}</span>
              <span>${tEnum('modality', a.modality)}</span>
              ${a.location ? html`<span>${a.location}</span>` : ''}
              <span>${durationMinutes(a.start, a.end)} min</span>
            </span>
          </span>
          <span class="chip ${a.state === 'feta' ? 'chip--ok' : ['anullada', 'noPresentada'].includes(a.state) ? 'chip--danger' : ''}">${tEnum('appointmentState', a.state)}</span>
        </li>`)}
      </ul>
    </section>`)}
  </div>`;
}

/* -------------------------------------------------------------- Render */

export function render({ state }) {
  const { view, day, filters } = context();
  let body;
  if (view === 'month') body = monthView(state, day, filters);
  else if (view === 'list') body = listView(state, day, filters);
  else if (view === 'day') body = timeGrid(state, [day], filters);
  else body = timeGrid(state, rangeDates(toISODate(startOfWeek(day)), toISODate(addDays(startOfWeek(day), 6))), filters);

  const activeFilters = Object.entries(filters).filter(([, v]) => v);

  return html`
    ${activeFilters.length ? html`<div class="row" style="margin-bottom:8px">
      ${activeFilters.map(([k, v]) => html`<span class="tag">${filterLabel(state, k, v)}
        <button type="button" class="iconbtn iconbtn--sm" data-act="cal:clearfilter" data-key="${k}" aria-label="${t('common.remove')}">${icon('close')}</button></span>`)}
    </div>` : ''}
    <div class="cal">
      ${toolbar(state, view, day)}
      ${body}
    </div>
    ${view !== 'list' ? html`<p class="field__hint" style="margin-top:8px">${t('agenda.dragHint')}</p>` : ''}`;
}

function filterLabel(state, key, value) {
  if (key === 'type') return tEnum('appointmentType', value);
  if (key === 'state') return tEnum('appointmentState', value);
  if (key === 'studentId') return sel.listName(store.find('students', value), state.settings.presentation);
  if (key === 'serviceId') return store.find('services', value)?.name || value;
  return value;
}

/* ------------------------------------------------------------- Detall */

function openDetail(id) {
  const state = store.getState();
  const a = store.find('appointments', id);
  if (!a) return;
  const record = a.recordId ? store.find('records', a.recordId) : null;

  const api = openModal({
    title: label(state, a),
    showSubmit: false,
    closeLabel: t('common.close'),
    body: html`<dl class="deflist">
        <div><dt>${t('common.date')}</dt><dd>${fmtDate(a.start)} · ${fmtTime(a.start)}–${fmtTime(a.end)}</dd></div>
        <div><dt>${t('common.type')}</dt><dd>${tEnum('appointmentType', a.type)}</dd></div>
        <div><dt>${t('common.state')}</dt><dd>${tEnum('appointmentState', a.state)}</dd></div>
        <div><dt>${t('common.modality')}</dt><dd>${tEnum('modality', a.modality)}</dd></div>
        ${a.location ? html`<div><dt>${t('common.location')}</dt><dd>${a.location}</dd></div>` : ''}
        ${a.attendees?.length ? html`<div><dt>${t('common.attendees')}</dt><dd>${a.attendees.join(', ')}</dd></div>` : ''}
        ${a.cancelReason ? html`<div><dt>${t('agenda.cancelReason')}</dt><dd>${a.cancelReason}</dd></div>` : ''}
      </dl>
      ${a.notes ? html`<p class="pre-wrap" style="margin-top:12px">${a.notes}</p>` : ''}
      ${record ? html`<p class="notice notice--ok" style="margin-top:12px">${icon('check')}<span>${t('records.title')}: ${fmtDate(record.at)}</span></p>` : ''}`,
    footer: html`
      <button type="button" class="btn btn--danger" data-detail="annul">${t('common.delete')}</button>
      <span class="spacer"></span>
      <button type="button" class="btn" data-detail="convocation">${t('agenda.convocation')}</button>
      <button type="button" class="btn" data-detail="cancel">${t('agenda.cancelAppointment')}</button>
      <button type="button" class="btn" data-detail="noshow">${t('agenda.markNoShow')}</button>
      <button type="button" class="btn" data-detail="edit">${t('common.edit')}</button>
      <button type="button" class="btn btn--primary" data-detail="done">${t('agenda.markDone')}</button>`,
    onMount: (root) => {
      const run = {
        edit: () => { api.close(); editAppointment({ appointmentId: id, onSaved: scheduleRender }); },
        done: () => { api.close(); closeAppointment(id, { onSaved: scheduleRender }); },
        noshow: () => { api.close(); act.setAppointmentState(id, 'noPresentada'); scheduleRender(); },
        cancel: () => { api.close(); cancelAppointment(id, { onSaved: scheduleRender }); },
        annul: () => { api.close(); annulEntity('appointments', id, { onDone: scheduleRender }); },
        convocation: () => { api.close(); openConvocation(id); },
      };
      root.querySelectorAll('[data-detail]').forEach((button) => {
        button.addEventListener('click', () => run[button.dataset.detail]());
      });
    },
  });
}

/** Genera el text de convocatòria copiable o imprimible. */
function openConvocation(id) {
  const state = store.getState();
  const a = store.find('appointments', id);
  const centre = state.settings.centre || {};
  const text = [
    `${centre.name || ''}`,
    `${centre.address || ''}`,
    '',
    `Benvolguda família de ${studentNames(state, a.studentIds)},`,
    '',
    `Us convoquem a una entrevista amb el servei d’orientació educativa del centre:`,
    '',
    `Data: ${fmtDate(a.start)}`,
    `Hora: ${fmtTime(a.start)} – ${fmtTime(a.end)}`,
    `Modalitat: ${tEnum('modality', a.modality)}`,
    a.location ? `Lloc: ${a.location}` : '',
    '',
    'Si no us va bé aquesta data, poseu-vos en contacte amb el centre per reprogramar-la.',
    '',
    'Atentament,',
    centre.professional || '',
  ].filter((line) => line !== null).join('\n');

  openModal({
    title: t('agenda.convocation'),
    body: html`<textarea class="textarea textarea--tall" readonly>${text}</textarea>`,
    footer: html`
      <button type="button" class="btn" data-modal-close>${t('common.close')}</button>
      <button type="button" class="btn btn--primary" data-copy>${t('common.copy')}</button>`,
    onMount: (root) => {
      root.querySelector('[data-copy]').addEventListener('click', async () => {
        await copyText(text);
        toast(t('common.copied'));
      });
    },
  });
}

/* ------------------------------------------------------------- Filtres */

function openFilters() {
  const state = store.getState();
  const route = current();
  openModal({
    title: t('common.filters'),
    size: 'narrow',
    form: true,
    submitLabel: t('common.apply'),
    body: html`<div class="fields">
      <div class="field"><label for="f-type">${t('common.type')}</label>
        <select class="select" id="f-type" name="type">
          <option value="">${t('common.all')}</option>
          ${(state.settings.appointmentTypes || []).map((x) => html`<option value="${x.id}"${raw(route.query.type === x.id ? ' selected' : '')}>${tEnum('appointmentType', x.id)}</option>`)}
        </select></div>
      <div class="field"><label for="f-state">${t('common.state')}</label>
        <select class="select" id="f-state" name="state">
          <option value="">${t('common.all')}</option>
          ${['programada', 'confirmada', 'feta', 'noPresentada', 'anullada', 'reprogramada'].map((x) => html`<option value="${x}"${raw(route.query.state === x ? ' selected' : '')}>${tEnum('appointmentState', x)}</option>`)}
        </select></div>
      <div class="field"><label for="f-student">${t('common.student')}</label>
        <select class="select" id="f-student" name="student">
          <option value="">${t('common.all')}</option>
          ${sel.allStudents(state).map((s) => html`<option value="${s.id}"${raw(route.query.student === s.id ? ' selected' : '')}>${sel.listName(s, state.settings.presentation)}</option>`)}
        </select></div>
      <div class="field"><label for="f-group">${t('common.group')}</label>
        <select class="select" id="f-group" name="group">
          <option value="">${t('common.all')}</option>
          ${sel.groups(state).map((g) => html`<option value="${g}"${raw(route.query.group === g ? ' selected' : '')}>${g}</option>`)}
        </select></div>
      <div class="field"><label for="f-service">${t('common.service')}</label>
        <select class="select" id="f-service" name="service">
          <option value="">${t('common.all')}</option>
          ${store.live('services').map((s) => html`<option value="${s.id}"${raw(route.query.service === s.id ? ' selected' : '')}>${s.name}</option>`)}
        </select></div>
    </div>`,
    onSubmit: (event) => {
      const form = new FormData(event.target);
      setQuery({
        type: form.get('type'), state: form.get('state'), student: form.get('student'),
        group: form.get('group'), service: form.get('service'),
      });
      return true;
    },
  });
}

/* --------------------------------------------------------- Interaccions */

export function actions() {
  return {
    'cal:view': (el) => setQuery({ v: el.dataset.view }),
    'cal:today': () => setQuery({ d: today() }),
    'cal:prev': () => shift(-1),
    'cal:next': () => shift(1),
    'cal:day': (el) => setQuery({ d: el.dataset.date, v: 'day' }),
    'cal:open': (el) => openDetail(el.dataset.id),
    'cal:filters': () => openFilters(),
    'cal:clearfilter': (el) => {
      const map = { type: 'type', state: 'state', studentId: 'student', serviceId: 'service', group: 'group' };
      setQuery({ [map[el.dataset.key]]: '' });
    },
    'cal:ics': () => exportAgenda(),
    'cal:slot': (el, event) => {
      const column = el.parentElement;
      const rect = column.getBoundingClientRect();
      const grid = column.closest('[data-grid]');
      const startMin = Number(grid.dataset.start);
      const offset = (event.clientY - rect.top) / HOUR_H * 60;
      const minutes = Math.max(startMin, Math.round((startMin + offset) / 15) * 15);
      const slot = store.settings().calendar?.slotMinutes || 45;
      const date = el.dataset.date;
      editAppointment({
        start: `${date}T${minutesToTime(minutes)}`,
        end: `${date}T${minutesToTime(minutes + slot)}`,
        onSaved: scheduleRender,
      });
    },
  };
}

function shift(direction) {
  const { view, day } = context();
  if (view === 'month') setQuery({ d: toISODate(addMonths(day, direction)) });
  else if (view === 'week' || view === 'list') setQuery({ d: toISODate(addDays(day, 7 * direction)) });
  else setQuery({ d: toISODate(addDays(day, direction)) });
}

function exportAgenda() {
  const state = store.getState();
  const { view, day, filters } = context();
  const period = periodOf(view, day);
  const list = sel.appointmentsInRange(state, period.from, period.to, filters);
  if (!list.length) { toast(t('agenda.noAppointments')); return; }

  exportICS(list.map((a) => ({
    uid: a.id,
    start: a.start,
    end: a.end,
    title: `${tEnum('appointmentType', a.type)} — ${label(state, a)}`,
    description: [a.notes, a.attendees?.join(', ')].filter(Boolean).join('\n'),
    location: a.location,
    status: a.state === 'anullada' ? 'CANCELLED' : 'CONFIRMED',
    alarmMinutes: a.reminderMinutes || 0,
  })), 'agenda');

  toast(t('common.saved'));
}

/* ------------------------------------------- Reprogramació per arrossegament */

export function mount(root) {
  const grid = root.querySelector('[data-grid]');
  if (!grid || !window.matchMedia('(pointer: fine)').matches) return;

  let dragging = null;

  grid.addEventListener('pointerdown', (event) => {
    const item = event.target.closest('[data-drag-item]');
    if (!item || event.button !== 0) return;
    const rect = item.getBoundingClientRect();
    dragging = {
      id: item.dataset.id,
      element: item,
      offsetY: event.clientY - rect.top,
      moved: false,
    };
    item.setPointerCapture(event.pointerId);
  });

  grid.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    if (!dragging.moved && Math.abs(event.movementY) + Math.abs(event.movementX) < 3) return;
    dragging.moved = true;
    dragging.element.style.opacity = '0.55';
  });

  grid.addEventListener('pointerup', (event) => {
    if (!dragging) return;
    const item = dragging.element;
    item.style.opacity = '';
    if (!dragging.moved) { dragging = null; return; }

    const column = document.elementsFromPoint(event.clientX, event.clientY).find((el) => el.hasAttribute?.('data-col'));
    if (!column) { dragging = null; return; }

    const rect = column.getBoundingClientRect();
    const startMin = Number(grid.dataset.start);
    const offset = (event.clientY - rect.top - dragging.offsetY) / HOUR_H * 60;
    const minutes = Math.max(0, Math.round((startMin + offset) / 15) * 15);
    const id = dragging.id;
    const appointment = store.find('appointments', id);
    const previous = { start: appointment.start, end: appointment.end };
    const duration = durationMinutes(appointment.start, appointment.end) || 45;
    const date = column.dataset.date;

    act.rescheduleAppointment(id, `${date}T${minutesToTime(minutes)}`, `${date}T${minutesToTime(minutes + duration)}`);
    toast(t('agenda.reschedule'), {
      actionLabel: t('common.undo'),
      onAction: () => { act.rescheduleAppointment(id, previous.start, previous.end); scheduleRender(); },
    });
    dragging = null;
    scheduleRender();
  });

  grid.addEventListener('pointercancel', () => {
    if (dragging) dragging.element.style.opacity = '';
    dragging = null;
  });
}
