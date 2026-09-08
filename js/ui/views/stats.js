/**
 * stats.js - mòdul d'estadístiques amb tres nivells d'anàlisi
 * (alumne, grup i nivell, global de centre) i selector de període.
 */
import { html, icon, raw } from '../dom.js';
import { t, tEnum, fmtDate, fmtNum } from '../../core/i18n.js';
import * as sel from '../../domain/selectors.js';
import * as store from '../../core/store.js';
import { studentStats, groupStats, centreStats } from '../../domain/stats.js';
import { current, setQuery, href } from '../router.js';
import { schoolYearRange, termRange } from '../../core/dates.js';
import { barList, columnChart, chartBox, dataTable, gauge, stackedBar } from '../components/charts.js';
import { exportCSV } from '../../core/export.js';
import { renderDocument, printDocument } from '../print.js';

const SCOPES = ['centre', 'group', 'student'];
const PERIODS = ['term1', 'term2', 'term3', 'year', 'custom'];

export function title() { return { title: t('stats.title'), subtitle: '' }; }

function scope() { return SCOPES.includes(current().query.s) ? current().query.s : 'centre'; }

function period(state) {
  const q = current().query;
  const year = state.settings.centre?.schoolYear;
  const key = PERIODS.includes(q.p) ? q.p : 'year';
  if (key === 'custom') {
    const full = schoolYearRange(year);
    return { key, from: q.from || full.from, to: q.to || full.to };
  }
  if (key === 'year') return { key, ...schoolYearRange(year) };
  return { key, ...termRange(year, Number(key.slice(-1))) };
}

function toolbar(state, p) {
  return html`<div class="filters">
    <div class="btngroup">
      ${SCOPES.map((s) => html`<button type="button" class="btn btn--sm" data-act="stx:scope" data-s="${s}"
        aria-pressed="${scope() === s}">${t(`stats.scopes.${s}`)}</button>`)}
    </div>
    <div class="field">
      <label class="sr-only" for="stx-p">${t('common.period')}</label>
      <select class="select input--sm" id="stx-p" data-act-change="stx:period">
        ${PERIODS.map((k) => html`<option value="${k}"${raw(k === p.key ? ' selected' : '')}>${t(`stats.periods.${k}`)}</option>`)}
      </select>
    </div>
    ${p.key === 'custom' ? html`
      <input class="input input--sm" type="date" value="${p.from}" data-act-change="stx:from" aria-label="${t('common.from')}">
      <input class="input input--sm" type="date" value="${p.to}" data-act-change="stx:to" aria-label="${t('common.to')}">` : ''}
    ${scope() === 'student' ? html`
      <div class="field">
        <label class="sr-only" for="stx-st">${t('common.student')}</label>
        <select class="select input--sm" id="stx-st" data-act-change="stx:student">
          <option value="">${t('stats.selectStudent')}</option>
          ${sel.allStudents(state).map((s) => html`<option value="${s.id}"${raw(current().query.id === s.id ? ' selected' : '')}>${sel.listName(s, state.settings.presentation)}</option>`)}
        </select>
      </div>` : ''}
    <span class="spacer"></span>
    <span class="muted tiny">${fmtDate(p.from)} – ${fmtDate(p.to)}</span>
    <button type="button" class="btn btn--sm" data-act="stx:csv">${icon('download')}${t('stats.exportCsv')}</button>
    <button type="button" class="btn btn--sm btn--primary" data-act="stx:report">${icon('print')}${t('stats.report')}</button>
  </div>`;
}

/* ------------------------------------------------------- Global de centre */

function centreView(state, p) {
  const c = centreStats(state, p);
  const byType = c.byType.map((x) => ({ label: tEnum('recordType', x.key), value: x.value }));
  const nese = c.nese.map((x) => ({ label: tEnum('nese', x.key), value: x.value }));
  const gender = c.gender.map((x) => ({ label: tEnum('gender', x.key), value: x.value }));
  const level = c.level.map((x) => ({ label: x.key, value: x.value }));
  const origin = c.demandOrigin.map((x) => ({ label: tEnum('demandOrigin', x.key), value: x.value }));
  const months = c.perMonth.map((x) => ({ label: x.key.slice(5), value: x.value }));

  return html`
    <section class="grid grid--auto" style="margin-bottom:16px">
      ${[
    { label: t('stats.totalStudents'), value: c.attended, hint: `${t('common.total')}: ${c.totalStudents}` },
    { label: t('stats.openCases'), value: c.openCases, hint: '' },
    { label: t('records.title'), value: c.records, hint: `${fmtNum(c.perWeek, 1)} / ${t('common.week').toLowerCase()}` },
    { label: t('stats.hoursInAppointments'), value: `${fmtNum(c.hours, 1)} h`, hint: `${c.appointments.total} ${t('agenda.title').toLowerCase()}` },
    { label: t('stats.avgResponse'), value: c.avgResponse !== null ? `${fmtNum(c.avgResponse, 1)} d` : '—', hint: `${c.demands} ${t('casework.demands').toLowerCase()}` },
    { label: t('stats.agreementsDone'), value: `${c.agreements.rate} %`, hint: `${c.agreements.done}/${c.agreements.total}` },
  ].map((k) => html`<div class="card kpi">
        <span class="kpi__label">${k.label}</span>
        <span class="kpi__value">${k.value}</span>
        ${k.hint ? html`<span class="kpi__hint">${k.hint}</span>` : ''}
      </div>`)}
    </section>

    <div class="grid grid--2">
      <section class="card"><div class="card__head"><h3>${t('stats.overTime')}</h3></div>
        ${chartBox('', columnChart(months, { title: t('stats.overTime') }), dataTable(months))}</section>
      <section class="card"><div class="card__head"><h3>${t('stats.byType')}</h3></div>
        ${chartBox('', barList(byType), dataTable(byType))}</section>
      <section class="card"><div class="card__head"><h3>${t('stats.neseDistribution')}</h3></div>
        ${chartBox('', barList(nese), dataTable(nese))}</section>
      <section class="card"><div class="card__head"><h3>${t('stats.byLevel')}</h3></div>
        ${chartBox('', barList(level), dataTable(level))}</section>
      <section class="card"><div class="card__head"><h3>${t('stats.byGender')}</h3></div>
        ${chartBox('', barList(gender), dataTable(gender))}</section>
      <section class="card"><div class="card__head"><h3>${t('stats.demandOrigin')}</h3></div>
        ${chartBox('', barList(origin), dataTable(origin))}</section>
      <section class="card"><div class="card__head"><h3>${t('stats.servicesMap')}</h3></div>
        ${chartBox('', barList(c.services.map((x) => ({ label: x.label, value: x.value }))), dataTable(c.services.map((x) => ({ label: x.label, value: x.value }))))}</section>
      <section class="card"><div class="card__head"><h3>${t('stats.appointmentsSummary')}</h3></div>
        ${stackedBar([
    { label: tEnum('appointmentState', 'feta'), value: c.appointments.done, color: 'var(--accent)' },
    { label: tEnum('appointmentState', 'noPresentada'), value: c.appointments.noShow, color: 'var(--warn)' },
    { label: tEnum('appointmentState', 'anullada'), value: c.appointments.cancelled, color: 'var(--surface-3)' },
  ])}
        <dl class="deflist" style="margin-top:12px">
          <div><dt>${t('common.total')}</dt><dd>${c.appointments.total}</dd></div>
          <div><dt>${tEnum('appointmentState', 'feta')}</dt><dd>${c.appointments.done}</dd></div>
          <div><dt>${tEnum('appointmentState', 'noPresentada')}</dt><dd>${c.appointments.noShow}</dd></div>
          <div><dt>${tEnum('appointmentState', 'anullada')}</dt><dd>${c.appointments.cancelled}</dd></div>
        </dl>
      </section>
      <section class="card" style="grid-column:1/-1"><div class="card__head"><h3>${t('compliance.title')}</h3></div>
        <div class="grid grid--3">
          <div class="kpi ${c.piOverdue ? 'kpi--alert' : ''}"><span class="kpi__label">${t('stats.piOverdue')}</span><span class="kpi__value">${c.piOverdue}</span></div>
          <div class="kpi ${c.referrals.pending ? 'kpi--warn' : ''}"><span class="kpi__label">${t('stats.referralsPending')}</span><span class="kpi__value">${c.referrals.pending}</span></div>
          <div class="kpi"><span class="kpi__label">${t('stats.noContactList', { n: state.settings.thresholds?.noContactDays ?? 45 })}</span><span class="kpi__value">${c.noContact}</span></div>
        </div>
      </section>
    </div>`;
}

/* ---------------------------------------------------- Per grup i per nivell */

function groupView(state, p) {
  const g = groupStats(state, p);
  if (!g.rows.length) return html`<div class="empty"><h3>${t('stats.noData')}</h3></div>`;
  const measures = g.measures.map((x) => ({ label: tEnum('measure', x.key), value: x.value }));

  return html`<div class="stack">
    <section class="card card--pad0">
      <div class="card__head" style="padding:16px 16px 8px"><h3>${t('stats.volumeByGroup')}</h3></div>
      <div class="tablewrap"><table class="table table--cards">
        <thead><tr>
          <th>${t('common.group')}</th><th>${t('common.level')}</th><th class="num">${t('common.students')}</th>
          <th class="num">${t('stats.colOpen')}</th><th class="num">${t('stats.colCoverage')}</th>
          <th class="num">${t('stats.colVolume')}</th><th class="num">PI</th><th class="num">${t('stats.colPiOverdue')}</th>
          <th class="num">${t('stats.colReferrals')}</th>
        </tr></thead>
        <tbody>${g.rows.map((r) => html`<tr>
          <td data-th="${t('common.group')}" class="nowrap"><a href="${href('alumnat', '', { group: r.name })}">${r.name}</a></td>
          <td data-th="${t('common.level')}" class="nowrap">${r.level}</td>
          <td data-th="${t('common.students')}" class="num">${r.students}</td>
          <td data-th="${t('stats.colOpen')}" class="num">${r.open}</td>
          <td data-th="${t('stats.colCoverage')}" class="num">${r.coverage} %</td>
          <td data-th="${t('stats.colVolume')}" class="num">${r.volume}</td>
          <td data-th="PI" class="num">${r.withPi}</td>
          <td data-th="${t('stats.colPiOverdue')}" class="num">${r.piOverdue ? html`<span class="chip chip--danger">${r.piOverdue}</span>` : '0'}</td>
          <td data-th="${t('stats.colReferrals')}" class="num">${r.referralsResolved}/${r.referrals}</td>
        </tr>`)}</tbody>
      </table></div>
    </section>

    <div class="grid grid--2">
      <section class="card"><div class="card__head"><h3>${t('stats.topGroups')}</h3></div>
        ${barList(g.top.map((r) => ({ label: r.name, value: r.volume })))}</section>
      <section class="card"><div class="card__head"><h3>${t('stats.measuresDistribution')}</h3></div>
        ${chartBox('', barList(measures), dataTable(measures))}</section>
      <section class="card"><div class="card__head"><h3>${t('stats.byLevel')}</h3></div>
        ${barList(g.byLevel.map((l) => ({ label: l.level, value: l.volume })))}</section>
      <section class="card"><div class="card__head"><h3>${t('stats.silentGroups')}</h3></div>
        ${g.silent.length
    ? html`<p class="row row--tight">${g.silent.map((x) => html`<span class="chip chip--warn">${x}</span>`)}</p>`
    : html`<p class="muted small">${t('common.empty')}</p>`}</section>
    </div>
  </div>`;
}

/* -------------------------------------------------------------- Per alumne */

function studentView(state, p) {
  const id = current().query.id;
  const s = id ? store.find('students', id) : null;
  if (!s) return html`<div class="empty"><h3>${t('stats.selectStudent')}</h3></div>`;

  const d = studentStats(state, id, p);
  const byType = d.byType.map((x) => ({ label: tEnum('recordType', x.key), value: x.value }));
  const months = d.perMonth.map((x) => ({ label: x.key.slice(5), value: x.value }));

  return html`<div class="grid grid--2">
    <section class="card" style="grid-column:1/-1">
      <div class="card__head">
        <h3>${sel.fullName(s, state.settings.presentation)}</h3>
        <a class="btn btn--sm" href="${href('alumnat', s.id, { t: 'stats' })}">${t('common.view')}</a>
      </div>
      <div class="grid grid--3">
        <div class="kpi"><span class="kpi__label">${t('records.title')}</span><span class="kpi__value">${d.total}</span></div>
        <div class="kpi"><span class="kpi__label">${t('stats.attendanceRate')}</span><span class="kpi__value">${d.attendanceRate} %</span></div>
        <div class="kpi"><span class="kpi__label">${t('stats.agreementsRate')}</span><span class="kpi__value">${d.agreementsRate} %</span></div>
      </div>
    </section>
    <section class="card"><div class="card__head"><h3>${t('stats.byType')}</h3></div>
      ${chartBox('', barList(byType), dataTable(byType))}</section>
    <section class="card"><div class="card__head"><h3>${t('stats.overTime')}</h3></div>
      ${chartBox('', columnChart(months), dataTable(months))}</section>
    <section class="card"><div class="card__head"><h3>${t('stats.servicesInvolved')}</h3></div>
      ${barList(d.services.map((x) => ({ label: x.label, value: x.value })))}</section>
    <section class="card"><div class="card__head"><h3>${t('stats.caseTimes')}</h3></div>
      <div class="row" style="gap:24px;align-items:center">
        ${gauge(d.agreementsRate, { label: t('stats.agreementsRate') })}
        <dl class="deflist" style="flex:1">
          <div><dt>${t('stats.demandToAction')}</dt><dd>${d.times.demandToAction ?? '—'} ${t('common.days')}</dd></div>
          <div><dt>${t('stats.actionToMeasure')}</dt><dd>${d.times.actionToMeasure ?? '—'} ${t('common.days')}</dd></div>
          <div><dt>${t('casework.referrals')}</dt><dd>${d.referrals.resolved}/${d.referrals.total}</dd></div>
        </dl>
      </div>
    </section>
  </div>`;
}

/* ---------------------------------------------------------------- Render */

export function render({ state }) {
  const p = period(state);
  const s = scope();
  return html`
    <div class="page-head"><div><h2>${t('stats.title')}</h2></div></div>
    ${toolbar(state, p)}
    ${s === 'centre' ? centreView(state, p) : s === 'group' ? groupView(state, p) : studentView(state, p)}`;
}

export function actions({ state }) {
  const p = () => period(state);
  return {
    'stx:scope': (el) => setQuery({ s: el.dataset.s }),
    'stx:period': (el) => setQuery({ p: el.value }),
    'stx:from': (el) => setQuery({ from: el.value }),
    'stx:to': (el) => setQuery({ to: el.value }),
    'stx:student': (el) => setQuery({ id: el.value }),
    'stx:report': () => {
      const opts = { period: p() };
      if (scope() === 'student' && current().query.id) {
        renderDocument('followUp', { ...opts, studentId: current().query.id });
      } else {
        renderDocument('statistics', opts);
      }
      printDocument();
    },
    'stx:csv': () => {
      const per = p();
      if (scope() === 'group') {
        const g = groupStats(state, per);
        exportCSV(
          ['Grup', 'Nivell', 'Alumnes', 'Seguiment obert', 'Cobertura %', 'Intervencions', 'Amb PI', 'PI vençuts', 'Derivacions'],
          g.rows.map((r) => [r.name, r.level, r.students, r.open, r.coverage, r.volume, r.withPi, r.piOverdue, r.referrals]),
          'indicadors-grups',
        );
      } else if (scope() === 'student' && current().query.id) {
        const d = studentStats(state, current().query.id, per);
        exportCSV(['Indicador', 'Valor'], [
          ['Intervencions', d.total],
          ['Taxa assistència', `${d.attendanceRate} %`],
          ['Acords complerts', `${d.agreementsRate} %`],
          ['Cites programades', d.appointments.scheduled],
          ['No presentades', d.appointments.noShow],
          ['Derivacions resoltes', `${d.referrals.resolved}/${d.referrals.total}`],
          ['Buits a la cadena documental', d.chainGaps],
        ], 'indicadors-alumne');
      } else {
        const c = centreStats(state, per);
        exportCSV(['Indicador', 'Valor'], [
          ['Alumnat total', c.totalStudents],
          ['Alumnat atès', c.attended],
          ['Expedients oberts', c.openCases],
          ['Intervencions', c.records],
          ['Intervencions per setmana', c.perWeek],
          ['Hores en cites', c.hours],
          ['Temps mitjà de resposta (dies)', c.avgResponse ?? ''],
          ['Acords complerts %', c.agreements.rate],
          ['Derivacions pendents', c.referrals.pending],
          ['Revisions de PI vençudes', c.piOverdue],
          ['Alumnat sense contacte', c.noContact],
        ], 'indicadors-centre');
      }
    },
  };
}
