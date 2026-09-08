/**
 * documents.js - generació de documents imprimibles amb selecció de
 * l'alumne/a, el període i, si escau, el registre concret.
 */
import { html, icon, raw } from '../dom.js';
import { t, tEnum, fmtDate, fmtDateTime } from '../../core/i18n.js';
import * as sel from '../../domain/selectors.js';
import { current, setQuery } from '../router.js';
import { schoolYearRange, termRange } from '../../core/dates.js';
import { renderDocument, printDocument, documentText } from '../print.js';
import { copyText } from '../../core/util.js';
import { toast } from '../components/toast.js';

const DOCS = [
  { key: 'followUp', doc: 'followUp', needs: ['student', 'period'] },
  { key: 'referral', doc: 'referral', needs: ['student'] },
  { key: 'interview', doc: 'interview', needs: ['record'] },
  { key: 'convocation', doc: 'convocation', needs: ['appointment'] },
  { key: 'handover', doc: 'handover', needs: ['student'] },
  { key: 'inspection', doc: 'inspection', needs: ['student', 'period'] },
  { key: 'statistics', doc: 'statistics', needs: ['period'] },
];

const PERIODS = ['term1', 'term2', 'term3', 'year'];

export function title() { return { title: t('documents.title'), subtitle: '' }; }

function selected() {
  const q = current().query;
  const found = DOCS.find((d) => d.doc === q.d);
  return found || DOCS[0];
}

function periodOf(state) {
  const q = current().query;
  const year = state.settings.centre?.schoolYear;
  const key = PERIODS.includes(q.p) ? q.p : 'year';
  return key === 'year' ? { key, ...schoolYearRange(year) } : { key, ...termRange(year, Number(key.slice(-1))) };
}

export function render({ state }) {
  const doc = selected();
  const q = current().query;
  const p = periodOf(state);
  const students = sel.allStudents(state);
  const records = q.student ? sel.recordsOf(state, q.student) : [];
  const appointments = q.student ? sel.appointmentsOf(state, q.student) : [];
  const ready = doc.needs.every((n) => (n === 'period' ? true : q[n]));

  return html`
    <div class="page-head">
      <div>
        <h2>${t('documents.title')}</h2>
        <p class="muted small">${t('documents.intro')}</p>
      </div>
    </div>

    <div class="grid grid--2">
      <section class="card">
        <div class="card__head"><h3>${t('common.type')}</h3></div>
        <div class="stack stack--sm">
          ${DOCS.map((d) => html`<button type="button" class="btn btn--block btn--tall" data-act="doc:pick" data-d="${d.doc}"
            aria-pressed="${d.doc === doc.doc}" ${raw(d.doc === doc.doc ? 'style="border-color:var(--accent);background:var(--accent-weak)"' : '')}>
            ${icon('file')}${t(`documents.types.${d.key}`)}
          </button>`)}
        </div>
        ${doc.doc === 'inspection' ? html`<p class="notice" style="margin-top:12px">${icon('info')}<span>${t('documents.inspectionIntro')}</span></p>` : ''}
      </section>

      <section class="card">
        <div class="card__head"><h3>${t('common.options')}</h3></div>
        <div class="fields">
          ${doc.needs.includes('student') || doc.needs.includes('record') || doc.needs.includes('appointment') ? html`
            <div class="field">
              <label for="doc-student">${t('documents.pickStudent')}</label>
              <select class="select" id="doc-student" data-act-change="doc:student">
                <option value="">${t('documents.noStudent')}</option>
                ${students.map((s) => html`<option value="${s.id}"${raw(q.student === s.id ? ' selected' : '')}>${sel.listName(s, state.settings.presentation)}</option>`)}
              </select>
            </div>` : ''}

          ${doc.needs.includes('record') ? html`
            <div class="field">
              <label for="doc-record">${t('documents.pickRecord')}</label>
              <select class="select" id="doc-record" data-act-change="doc:record">
                <option value="">—</option>
                ${records.map((r) => html`<option value="${r.id}"${raw(q.record === r.id ? ' selected' : '')}>${fmtDateTime(r.at)} · ${tEnum('recordType', r.type)}</option>`)}
              </select>
            </div>` : ''}

          ${doc.needs.includes('appointment') ? html`
            <div class="field">
              <label for="doc-appointment">${t('agenda.title')}</label>
              <select class="select" id="doc-appointment" data-act-change="doc:appointment">
                <option value="">—</option>
                ${appointments.map((a) => html`<option value="${a.id}"${raw(q.appointment === a.id ? ' selected' : '')}>${fmtDateTime(a.start)} · ${tEnum('appointmentType', a.type)}</option>`)}
              </select>
            </div>` : ''}

          ${doc.needs.includes('period') ? html`
            <div class="field">
              <label for="doc-period">${t('documents.pickPeriod')}</label>
              <select class="select" id="doc-period" data-act-change="doc:period">
                ${PERIODS.map((k) => html`<option value="${k}"${raw(k === p.key ? ' selected' : '')}>${t(`stats.periods.${k}`)}</option>`)}
              </select>
              <p class="field__hint">${fmtDate(p.from)} – ${fmtDate(p.to)}</p>
            </div>` : ''}
        </div>

        <div class="card__foot">
          <div class="row">
            <button type="button" class="btn btn--primary" data-act="doc:print" ${raw(ready ? '' : 'disabled')}>${icon('print')}${t('documents.printNow')}</button>
            <button type="button" class="btn" data-act="doc:copy" ${raw(ready ? '' : 'disabled')}>${icon('copy')}${t('documents.copyText')}</button>
          </div>
          ${!ready ? html`<p class="field__hint" style="margin-top:8px">${t('documents.noStudent')}</p>` : ''}
        </div>
      </section>
    </div>

    <section class="card" style="margin-top:16px">
      <div class="card__head"><h3>${t('common.preview')}</h3></div>
      <div id="doc-preview" class="doc" style="font-size:13px"></div>
    </section>`;
}

function buildOptions(state) {
  const q = current().query;
  return {
    studentId: q.student || '',
    recordId: q.record || '',
    appointmentId: q.appointment || '',
    period: periodOf(state),
  };
}

export function actions({ state }) {
  return {
    'doc:pick': (el) => setQuery({ d: el.dataset.d }),
    'doc:student': (el) => setQuery({ student: el.value, record: '', appointment: '' }),
    'doc:record': (el) => setQuery({ record: el.value }),
    'doc:appointment': (el) => setQuery({ appointment: el.value }),
    'doc:period': (el) => setQuery({ p: el.value }),
    'doc:print': () => { renderDocument(selected().doc, buildOptions(state)); printDocument(); },
    'doc:copy': async () => {
      renderDocument(selected().doc, buildOptions(state));
      await copyText(documentText());
      toast(t('common.copied'));
    },
  };
}

/** Genera una previsualització dins de la vista. */
export function mount(root, { state }) {
  const doc = selected();
  const q = current().query;
  const ready = doc.needs.every((n) => (n === 'period' ? true : q[n]));
  const preview = root.querySelector('#doc-preview');
  if (!preview) return;
  if (!ready) {
    preview.innerHTML = `<p class="muted small">${t('documents.noStudent')}</p>`;
    return;
  }
  const area = renderDocument(doc.doc, buildOptions(state));
  preview.innerHTML = area.innerHTML;
}
