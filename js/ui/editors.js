/**
 * editors.js - formularis modals de totes les entitats.
 * Concentra l'emplenament automàtic: herència de context, últim valor
 * utilitzat, plantilles per tipus, banc de frases i expansió de snippets.
 * Cap camp autoemplenat queda bloquejat; es marquen com a suggerits.
 */
import { html, raw, toHTML, formValues, insertAtCursor, icon } from './dom.js';
import { field, fields, fieldset, datalist, optionsFrom, validate, parseMulti, multiField } from './components/form.js';
import { openModal, confirmModal, promptModal } from './components/modal.js';
import { toast } from './components/toast.js';
import { t, tEnum, enumOptions, fmtDate } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as sel from '../domain/selectors.js';
import * as act from '../domain/actions.js';
import { uid } from '../core/util.js';
import {
  today, toISOLocal, roundToSlot, addMinutes, dateOf, addDays, toISODate,
} from '../core/dates.js';
import { newAgreement } from '../domain/schema.js';

/* ------------------------------------------------------------------ Utils */

const state = () => store.getState();
const settings = () => store.settings();
const presentation = () => settings().presentation;

/** Opcions d'alumnat per als selectors. */
function studentOptions(empty = '—') {
  return optionsFrom(
    sel.allStudents(state()).map((s) => ({ value: s.id, label: `${sel.listName(s, presentation())}${s.group ? ` · ${s.group}` : ''}` })),
    { empty },
  );
}

/** Opcions de serveis externs. */
function serviceOptions(empty = '—') {
  return optionsFrom(
    store.live('services').map((s) => ({ value: s.id, label: `${s.name} (${tEnum('serviceKind', s.kind)})` })),
    { empty },
  );
}

/** Opcions del catàleg normatiu. */
function normativeOptions() {
  return optionsFrom(
    (settings().normative || []).map((n) => ({ value: n.id, label: `${n.ref} — ${n.title}` })),
    { empty: '—' },
  );
}

/** Substitueix els snippets dinàmics dins d'un text. */
export function expandSnippets(text, context = {}) {
  const student = context.studentId ? store.find('students', context.studentId) : null;
  const map = {
    alumne: student ? sel.fullName(student, presentation()) : '',
    curs: student?.level || settings().centre?.schoolYear || '',
    grup: student?.group || '',
    data: fmtDate(today()),
    tutor: sel.tutorLabel(student),
    tutorindividual: student?.tutorIndividual || '',
    professional: settings().centre?.professional || '',
    centre: settings().centre?.name || '',
  };
  return String(text || '').replace(/\{\{(\w+)\}\}/g, (m, key) => (key in map ? map[key] : m));
}

/** Connecta l'expansió automàtica de snippets a un camp de text. */
function bindSnippets(element, context) {
  element.addEventListener('input', () => {
    if (!element.value.includes('}}')) return;
    const caret = element.selectionStart;
    const before = element.value;
    const after = expandSnippets(before, context);
    if (after !== before) {
      element.value = after;
      const delta = after.length - before.length;
      element.setSelectionRange(caret + delta, caret + delta);
    }
  });
}

/** Barra del banc de frases per a un camp de text llarg. */
function phraseBar(targetId) {
  const phrases = settings().phrases || [];
  if (!phrases.length) return '';
  const categories = [...new Set(phrases.map((p) => p.category || '—'))];
  const id = `${targetId}-phrases`;
  return html`<div class="field">
    <label class="field__label" for="${id}">${t('records.insertPhrase')}</label>
    <select class="select input--sm" id="${id}" data-phrase-for="${targetId}">
      <option value="">—</option>
      ${categories.map((c) => html`<optgroup label="${c}">
        ${phrases.filter((p) => (p.category || '—') === c).map((p) => html`<option value="${p.id}">${p.text.slice(0, 70)}</option>`)}
      </optgroup>`)}
    </select>
  </div>`;
}

function bindPhrases(root) {
  root.querySelectorAll('[data-phrase-for]').forEach((select) => {
    select.addEventListener('change', () => {
      const phrase = (settings().phrases || []).find((p) => p.id === select.value);
      const target = root.querySelector(`#${select.dataset.phraseFor}`);
      if (phrase && target) insertAtCursor(target, `${target.value && !target.value.endsWith('\n') ? '\n' : ''}${phrase.text}`);
      select.value = '';
    });
  });
}

/**
 * Embolcall d'una fila repetible. El botó d'esborrar viu fora de la graella
 * de camps, ancorat a la cantonada, perquè no en desquadri les columnes.
 */
function repeatRow(id, inner) {
  return html`<div class="repeat" data-row="${id}">
    ${inner}
    <button type="button" class="iconbtn iconbtn--sm repeat__del" data-remove-row aria-label="${t('common.remove')}">${icon('trash')}</button>
  </div>`;
}

/** Repetidor genèric de files dins d'un formulari. */
function bindRepeater(root, { addSelector, listSelector, template }) {
  const list = root.querySelector(listSelector);
  root.querySelector(addSelector)?.addEventListener('click', () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = toHTML(template(uid('r')));
    list.appendChild(wrapper.firstElementChild);
  });
  list?.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-row]');
    if (remove) remove.closest('[data-row]')?.remove();
  });
}

/** Llegeix les files d'un repetidor. */
function readRows(root, listSelector) {
  return [...root.querySelectorAll(`${listSelector} [data-row]`)].map((row) => {
    const values = {};
    row.querySelectorAll('[data-k]').forEach((el) => {
      values[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value;
    });
    values.id = row.dataset.row;
    return values;
  });
}

/* ------------------------------------------------------------- Alumne/a */

export function editStudent(studentId = '', { onSaved } = {}) {
  const existing = studentId ? store.find('students', studentId) : null;
  const s = existing || {};
  const nese = s.nese || {};
  const pools = {
    tutors: sel.pool(state(), 'tutors'),
    levels: sel.pool(state(), 'levels'),
    groups: sel.pool(state(), 'groups'),
    tags: sel.pool(state(), 'tags'),
    diagnoses: sel.pool(state(), 'diagnoses'),
    measures: sel.pool(state(), 'measures'),
    professionals: sel.pool(state(), 'professionals'),
  };

  const measureRow = (id, m = {}) => repeatRow(id, html`
    <div class="fields fields--2">
      <div class="field field--full"><label>${t('students.measureText')}</label>
        <input class="input" data-k="text" value="${m.text || ''}" list="dl-measures"></div>
      <div class="field"><label>${t('students.measureType')}</label>
        <select class="select" data-k="type">${enumOptions('measure').map((o) => html`<option value="${o.value}"${raw(o.value === m.type ? ' selected' : '')}>${o.label}</option>`)}</select></div>
      <div class="field"><label>${t('common.date')}</label>
        <input class="input" type="date" data-k="date" value="${m.date || today()}"></div>
      <div class="field field--full"><label>${t('students.measureNorm')}</label>
        <select class="select" data-k="normativeId">${normativeOptions().map((o) => html`<option value="${o.value}"${raw(o.value === m.normativeId ? ' selected' : '')}>${o.label}</option>`)}</select></div>
    </div>`);

  const diagnosisRow = (id, d = {}) => repeatRow(id, html`
    <div class="fields fields--3">
      <div class="field"><label>${t('students.fields.diagnoses')}</label>
        <input class="input" data-k="text" value="${d.text || ''}" list="dl-diagnoses"></div>
      <div class="field"><label>${t('students.diagnosisPro')}</label>
        <input class="input" data-k="pro" value="${d.pro || ''}" list="dl-professionals"></div>
      <div class="field"><label>${t('common.date')}</label>
        <input class="input" type="date" data-k="date" value="${d.date || ''}"></div>
    </div>`);

  const body = html`
    ${datalist('dl-tutors', pools.tutors)}
    ${datalist('dl-levels', pools.levels)}
    ${datalist('dl-groups', pools.groups)}
    ${datalist('dl-tags', pools.tags)}
    ${datalist('dl-diagnoses', pools.diagnoses)}
    ${datalist('dl-measures', pools.measures)}
    ${datalist('dl-professionals', pools.professionals)}

    ${fieldset(t('students.tabs.summary'), html`
      ${field({ name: 'name', label: t('students.fields.name'), value: s.name, required: true, autofocus: true })}
      ${field({ name: 'surname', label: t('students.fields.surname'), value: s.surname, required: true })}
      ${field({ name: 'birth', label: t('students.fields.birth'), type: 'date', value: s.birth })}
      ${field({ name: 'gender', label: t('students.fields.gender'), type: 'select', value: s.gender || 'noConsta', options: enumOptions('gender') })}
      ${field({ name: 'level', label: t('students.fields.level'), value: s.level, list: 'dl-levels' })}
      ${field({ name: 'group', label: t('students.fields.group'), value: s.group, list: 'dl-groups' })}
      ${multiField({
    name: 'tutors',
    label: t('students.fields.tutors'),
    value: s.tutors,
    list: 'dl-tutors',
    hint: t('students.tutorsHint'),
  })}
      ${field({ name: 'tutorIndividual', label: t('students.fields.tutorIndividual'), value: s.tutorIndividual, list: 'dl-tutors' })}
      ${field({ name: 'originCentre', label: t('students.fields.originCentre'), value: s.originCentre })}
      ${field({ name: 'enrolled', label: t('students.fields.enrolled'), type: 'date', value: s.enrolled || today() })}
      ${multiField({ name: 'tags', label: t('students.fields.tags'), value: s.tags, list: 'dl-tags' })}
      <p class="field__hint field--full" data-age-hint></p>
    `)}

    ${fieldset(t('common.course'), html`
      ${field({ name: 'repeats', label: t('students.fields.repeats'), type: 'number', min: 0, max: 4, value: s.academic?.repeats ?? 0 })}
      ${field({ name: 'attendance', label: t('students.fields.attendance'), type: 'number', min: 0, max: 100, value: s.academic?.attendance })}
      ${field({ name: 'pendingSubjects', label: t('students.fields.pendingSubjects'), value: s.academic?.pendingSubjects, className: 'field--full' })}
      ${field({ name: 'statusValue', label: t('students.fields.status'), type: 'select', value: s.status?.value || 'actiu', options: enumOptions('fileState') })}
      ${field({ name: 'statusDate', label: t('students.fields.statusDate'), type: 'date', value: s.status?.date || today() })}
      ${field({ name: 'statusReason', label: t('students.fields.statusReason'), value: s.status?.reason, className: 'field--full' })}
    `)}

    ${fieldset('NESE', html`
      ${field({ name: 'neseCategory', label: t('students.fields.neseCategory'), type: 'select', value: nese.category || 'cap', options: enumOptions('nese') })}
      ${field({ name: 'reportHas', label: t('students.fields.report'), type: 'checkbox', value: nese.report?.has })}
      ${field({ name: 'reportDate', label: t('students.fields.reportDate'), type: 'date', value: nese.report?.date })}
      ${field({ name: 'reportRef', label: t('students.fields.reportRef'), value: nese.report?.ref })}
      ${field({ name: 'piHas', label: t('students.fields.pi'), type: 'checkbox', value: nese.pi?.has })}
      ${field({ name: 'piApproved', label: t('students.fields.piApproved'), type: 'date', value: nese.pi?.approved })}
      ${field({ name: 'piReview', label: t('students.fields.piReview'), type: 'date', value: nese.pi?.review, hint: 'Data preceptiva de revisió' })}
      ${field({ name: 'siei', label: t('students.fields.siei'), type: 'checkbox', value: nese.siei })}
      ${field({ name: 'sial', label: t('students.fields.sial'), type: 'checkbox', value: nese.sial })}
      <div class="field field--full">
        <span class="field__label">${t('students.fields.measures')}</span>
        <div class="repeats" data-measures>${(nese.measures || []).map((m) => measureRow(m.id || uid('r'), m))}</div>
        <button type="button" class="btn btn--sm" data-add-measure>${icon('plus')}${t('students.addMeasure')}</button>
      </div>
    `, 3)}

    ${fieldset(t('students.fields.healthNotes'), html`
      <div class="field field--full">
        <span class="field__label">${t('students.fields.diagnoses')}</span>
        <div class="repeats" data-diagnoses>${(s.health?.diagnoses || []).map((d) => diagnosisRow(d.id || uid('r'), d))}</div>
        <button type="button" class="btn btn--sm" data-add-diagnosis>${icon('plus')}${t('students.addDiagnosis')}</button>
      </div>
      ${field({ name: 'medication', label: t('students.fields.medication'), value: s.health?.medication })}
      ${field({ name: 'allergies', label: t('students.fields.allergies'), value: s.health?.allergies })}
      ${field({ name: 'healthNotes', label: t('common.observations'), type: 'textarea', rows: 3, value: s.health?.notes, className: 'field--full' })}
    `)}

    ${fieldset(t('students.tabs.family'), html`
      ${field({ name: 'familyStructure', label: t('students.fields.familyStructure'), type: 'select', value: s.family?.structure, options: optionsFrom(enumOptions('familyStructure'), { empty: '—' }) })}
      ${field({ name: 'siblings', label: t('students.fields.siblings'), value: s.family?.siblings })}
      ${field({ name: 'homeLanguage', label: t('students.fields.homeLanguage'), value: s.family?.homeLanguage })}
      ${field({ name: 'socialServices', label: t('students.fields.socialServices'), type: 'checkbox', value: s.family?.socialServices })}
    `)}
  `;

  openModal({
    title: existing ? t('students.edit') : t('students.new'),
    size: 'wide',
    form: true,
    body,
    onMount: (root) => {
      const birth = root.querySelector('[name="birth"]');
      const hint = root.querySelector('[data-age-hint]');
      const updateHint = () => {
        const expected = sel.expectedLevel(birth.value);
        hint.textContent = expected ? t('students.ageSuggest', { c: expected }) : '';
      };
      birth.addEventListener('change', updateHint);
      updateHint();

      bindRepeater(root, { addSelector: '[data-add-measure]', listSelector: '[data-measures]', template: (id) => measureRow(id) });
      bindRepeater(root, { addSelector: '[data-add-diagnosis]', listSelector: '[data-diagnoses]', template: (id) => diagnosisRow(id) });
    },
    onSubmit: (event) => {
      const form = event.target;
      if (!validate(form)) return false;
      const v = formValues(form);
      const data = {
        id: existing?.id,
        name: v.name.trim(),
        surname: v.surname.trim(),
        birth: v.birth,
        gender: v.gender,
        level: v.level,
        group: v.group,
        tutors: parseMulti(v.tutors),
        tutorIndividual: v.tutorIndividual,
        originCentre: v.originCentre,
        enrolled: v.enrolled,
        tags: parseMulti(v.tags),
        academic: {
          repeats: Number(v.repeats) || 0,
          attendance: v.attendance,
          pendingSubjects: v.pendingSubjects,
        },
        nese: {
          category: v.neseCategory,
          report: { has: Boolean(v.reportHas), date: v.reportDate, ref: v.reportRef },
          pi: { has: Boolean(v.piHas), approved: v.piApproved, review: v.piReview },
          siei: Boolean(v.siei),
          sial: Boolean(v.sial),
          measures: readRows(form, '[data-measures]').filter((m) => m.text),
        },
        health: {
          diagnoses: readRows(form, '[data-diagnoses]').filter((d) => d.text),
          medication: v.medication,
          allergies: v.allergies,
          notes: v.healthNotes,
        },
        family: {
          structure: v.familyStructure,
          siblings: v.siblings,
          homeLanguage: v.homeLanguage,
          socialServices: Boolean(v.socialServices),
        },
        status: { value: v.statusValue, date: v.statusDate, reason: v.statusReason },
      };
      const saved = act.save('students', data);
      toast(t('common.saved'));
      onSaved?.(saved);
      return true;
    },
  });
}

/* ------------------------------------------------------ Referent familiar */

export function editGuardian(studentId, guardianId = '', { onSaved } = {}) {
  const existing = guardianId ? store.find('guardians', guardianId) : null;
  const g = existing || {};

  openModal({
    title: existing ? t('common.edit') : t('students.addGuardian'),
    form: true,
    body: fields(html`
      ${field({ name: 'name', label: t('common.name'), value: g.name, required: true, autofocus: true })}
      ${field({ name: 'kinship', label: t('students.kinship'), type: 'select', value: g.kinship || 'mare', options: enumOptions('kinship') })}
      ${field({ name: 'phone', label: t('common.phone'), type: 'tel', value: g.phone })}
      ${field({ name: 'email', label: t('common.email'), type: 'email', value: g.email })}
      ${field({ name: 'language', label: t('students.commLanguage'), value: g.language || 'ca' })}
      ${field({ name: 'availability', label: t('students.availability'), value: g.availability })}
      ${field({ name: 'custody', label: t('students.custody'), type: 'textarea', rows: 2, value: g.custody, className: 'field--full' })}
      ${field({ name: 'notes', label: t('common.observations'), type: 'textarea', rows: 2, value: g.notes, className: 'field--full' })}
    `),
    onSubmit: (event) => {
      const form = event.target;
      if (!validate(form)) return false;
      const v = formValues(form);
      const saved = act.save('guardians', { id: existing?.id, studentId, ...v });
      toast(t('common.saved'));
      onSaved?.(saved);
      return true;
    },
  });
}

/* ------------------------------------------------------------- Registres */

/**
 * Editor de registre de seguiment.
 * @param {object} options
 * @param {string} [options.recordId] Registre existent.
 * @param {string} [options.studentId] Context heretat.
 * @param {object} [options.prefill]  Valors precarregats.
 */
export function editRecord({ recordId = '', studentId = '', prefill = {}, onSaved } = {}) {
  const existing = recordId ? store.find('records', recordId) : null;
  const r = existing || {};
  const contextStudent = existing?.studentIds?.[0] || studentId || prefill.studentIds?.[0] || '';
  const sealed = existing ? act.isSealed(existing) : false;

  const suggestedType = existing?.type || prefill.type || (contextStudent ? sel.suggestRecordType(state(), contextStudent) : 'entrevistaFamilia');
  const suggestedParticipants = existing?.participants
    || prefill.participants
    || (contextStudent ? sel.suggestParticipants(state(), contextStudent) : []);
  const suggestedService = existing?.serviceId || prefill.serviceId || (contextStudent ? sel.suggestService(state(), contextStudent) : '');
  const initialContent = existing?.content ?? prefill.content ?? (settings().templates?.[suggestedType] || '');
  const contentId = 'rec-content';

  const agreementRow = (id, a = {}) => repeatRow(id, html`
    <div class="fields fields--3">
      <div class="field field--full"><label>${t('records.agreementText')}</label>
        <input class="input" data-k="text" value="${a.text || ''}"></div>
      <div class="field"><label>${t('records.agreementOwner')}</label>
        <input class="input" data-k="owner" value="${a.owner || ''}" list="dl-participants"></div>
      <div class="field"><label>${t('records.agreementDue')}</label>
        <input class="input" type="date" data-k="due" value="${a.due || ''}"></div>
      <div class="field"><label>${t('common.state')}</label>
        <select class="select" data-k="state">${enumOptions('taskState').map((o) => html`<option value="${o.value}"${raw(o.value === (a.state || 'pendent') ? ' selected' : '')}>${o.label}</option>`)}</select></div>
    </div>`);

  const body = html`
    ${datalist('dl-participants', sel.pool(state(), 'participants'))}
    ${sealed ? html`<p class="notice notice--warn">${icon('lock')}<span>${t('records.sealedNote')}</span></p>` : ''}

    ${fields(html`
      ${field({
    name: 'studentIds',
    label: t('common.student'),
    type: 'select',
    value: contextStudent,
    options: studentOptions(''),
    required: true,
    suggested: Boolean(studentId) && !existing,
  })}
      ${field({ name: 'type', label: t('common.type'), type: 'select', value: suggestedType, options: enumOptions('recordType'), suggested: !existing })}
      ${field({ name: 'at', label: `${t('common.date')} · ${t('common.time')}`, type: 'datetime', value: existing?.at || prefill.at || roundToSlot(toISOLocal(new Date())), suggested: !existing })}
      ${field({ name: 'author', label: t('common.author'), value: existing?.author || act.currentAuthor(), suggested: !existing })}
      ${multiField({ name: 'participants', label: t('common.participants'), value: suggestedParticipants, list: 'dl-participants', className: 'field--full', suggested: !existing && suggestedParticipants.length > 0 })}
      ${field({ name: 'serviceId', label: t('common.service'), type: 'select', value: suggestedService, options: serviceOptions(), suggested: !existing && Boolean(suggestedService) })}
      ${field({ name: 'normativeId', label: t('students.measureNorm'), type: 'select', value: r.normativeId, options: normativeOptions() })}
      ${field({ name: 'confidentiality', label: t('records.confidentiality'), type: 'select', value: r.confidentiality || 'visible', options: [{ value: 'visible', label: t('records.visible') }, { value: 'restringit', label: t('records.restricted') }] })}
    `)}

    <div class="field">
      <div class="row row--between">
        <label for="${contentId}">${t('common.content')}</label>
        <button type="button" class="btn btn--sm btn--ghost" data-load-template>${t('records.template')}</button>
      </div>
      <textarea class="textarea textarea--tall" id="${contentId}" name="content" placeholder="{{alumne}}, {{curs}}, {{data}}, {{tutor}}">${initialContent}</textarea>
      <p class="field__hint">Els snippets {{alumne}}, {{curs}}, {{data}}, {{tutor}} i {{professional}} s’expandeixen automàticament.</p>
      ${phraseBar(contentId)}
    </div>

    <div class="field">
      <span class="field__label">${t('common.agreements')}</span>
      <p class="field__hint">${t('records.agreementsHint')}</p>
      <div class="repeats" data-agreements>${(r.agreements || prefill.agreements || []).map((a) => agreementRow(a.id, a))}</div>
      <button type="button" class="btn btn--sm" data-add-agreement>${icon('plus')}${t('records.addAgreement')}</button>
    </div>

    ${!existing ? field({ name: 'createAppointment', label: t('records.createAppointment'), type: 'checkbox', value: false }) : ''}
    ${sealed ? field({ name: 'editReason', label: t('records.editReason'), required: true, hint: t('records.sealedNote') }) : ''}
  `;

  openModal({
    title: existing ? t('records.edit') : t('records.new'),
    size: 'wide',
    form: true,
    body,
    onMount: (root) => {
      const content = root.querySelector(`#${contentId}`);
      const typeSelect = root.querySelector('[name="type"]');
      const studentSelect = root.querySelector('[name="studentIds"]');

      bindSnippets(content, { studentId: studentSelect.value });
      bindPhrases(root);
      bindRepeater(root, { addSelector: '[data-add-agreement]', listSelector: '[data-agreements]', template: (id) => agreementRow(id) });

      root.querySelector('[data-load-template]').addEventListener('click', () => {
        const template = settings().templates?.[typeSelect.value] || '';
        if (!template) { toast(t('stats.noData')); return; }
        if (content.value.trim() && !window.confirm('Voleu substituir el contingut actual per la plantilla?')) return;
        content.value = expandSnippets(template, { studentId: studentSelect.value });
        content.focus();
      });

      // En canviar el tipus, si el contingut encara és la plantilla anterior, s'actualitza.
      typeSelect.addEventListener('change', () => {
        const templates = settings().templates || {};
        const previous = Object.values(templates).some((tpl) => tpl && tpl === content.value);
        if (!content.value.trim() || previous) {
          content.value = expandSnippets(templates[typeSelect.value] || '', { studentId: studentSelect.value });
        }
      });

      // El canvi d'alumne actualitza els suggeriments.
      studentSelect.addEventListener('change', () => {
        const id = studentSelect.value;
        if (!id) return;
        const participants = root.querySelector('[name="participants"]');
        if (!participants.value.trim()) participants.value = sel.suggestParticipants(state(), id).join(', ');
      });
    },
    onSubmit: (event) => {
      const form = event.target;
      if (!validate(form)) return false;
      const v = formValues(form);
      const agreements = readRows(form, '[data-agreements]')
        .filter((a) => a.text)
        .map((a) => newAgreement(a));

      const data = {
        id: existing?.id,
        studentIds: [v.studentIds].filter(Boolean),
        type: v.type,
        at: v.at,
        author: v.author,
        participants: parseMulti(v.participants),
        serviceId: v.serviceId,
        normativeId: v.normativeId,
        confidentiality: v.confidentiality,
        content: expandSnippets(v.content, { studentId: v.studentIds }),
        agreements,
        appointmentId: existing?.appointmentId || prefill.appointmentId || '',
        demandId: existing?.demandId || prefill.demandId || '',
      };

      const saved = act.saveRecord(data, { reason: v.editReason || '' });

      if (!existing && v.createAppointment) {
        const start = addMinutes(v.at, 7 * 24 * 60);
        act.saveAppointment({
          studentIds: data.studentIds,
          start,
          end: addMinutes(start, settings().calendar?.slotMinutes || 45),
          type: 'entrevistaFamilia',
          attendees: data.participants,
          notes: `Seguiment del registre del ${fmtDate(dateOf(v.at))}`,
        });
      }

      toast(t('common.saved'));
      onSaved?.(saved);
      return true;
    },
  });
}

/* ----------------------------------------------------------------- Cites */

export function editAppointment({ appointmentId = '', studentId = '', start, end, onSaved } = {}) {
  const existing = appointmentId ? store.find('appointments', appointmentId) : null;
  const a = existing || {};
  const slot = settings().calendar?.slotMinutes || 45;
  const initialStart = a.start || start || roundToSlot(toISOLocal(new Date()), 15);
  const initialEnd = a.end || end || addMinutes(initialStart, slot);
  const types = settings().appointmentTypes || [];

  const body = html`
    ${datalist('dl-participants', sel.pool(state(), 'participants'))}
    ${datalist('dl-locations', sel.pool(state(), 'locations'))}
    ${fields(html`
      ${field({ name: 'studentIds', label: t('common.student'), type: 'select', value: a.studentIds?.[0] || studentId, options: studentOptions('—'), suggested: Boolean(studentId) && !existing })}
      ${field({ name: 'type', label: t('common.type'), type: 'select', value: a.type || types[0]?.id || 'entrevistaFamilia', options: types.map((x) => ({ value: x.id, label: tEnum('appointmentType', x.id) })) })}
      ${field({ name: 'start', label: t('common.start'), type: 'datetime', value: initialStart, required: true })}
      ${field({ name: 'end', label: t('common.end'), type: 'datetime', value: initialEnd, required: true })}
      ${field({ name: 'modality', label: t('common.modality'), type: 'select', value: a.modality || 'presencial', options: enumOptions('modality') })}
      ${field({ name: 'location', label: t('common.location'), value: a.location, list: 'dl-locations' })}
      ${multiField({ name: 'attendees', label: t('common.attendees'), value: a.attendees, list: 'dl-participants', className: 'field--full' })}
      ${field({ name: 'serviceId', label: t('common.service'), type: 'select', value: a.serviceId, options: serviceOptions() })}
      ${field({ name: 'state', label: t('common.state'), type: 'select', value: a.state || 'programada', options: enumOptions('appointmentState') })}
      ${field({
    name: 'reminderMinutes',
    label: t('agenda.reminder'),
    type: 'select',
    value: a.reminderMinutes ?? 0,
    options: [
      { value: 0, label: t('agenda.reminderNone') },
      ...[15, 30, 60, 120, 1440].map((n) => ({ value: n, label: t('agenda.reminderAt', { n: n >= 1440 ? '1440' : n }) })),
    ],
  })}
      ${!existing ? field({
    name: 'seriesRule',
    label: t('agenda.recurrence'),
    type: 'select',
    value: 'none',
    options: [
      { value: 'none', label: t('agenda.recurrenceNone') },
      { value: 'weekly', label: t('agenda.recurrenceWeekly') },
      { value: 'biweekly', label: t('agenda.recurrenceBiweekly') },
      { value: 'monthly', label: t('agenda.recurrenceMonthly') },
    ],
  }) : ''}
      ${!existing ? field({ name: 'seriesUntil', label: t('agenda.recurrenceUntil'), type: 'date', value: toISODate(addDays(today(), 90)) }) : ''}
      ${field({ name: 'notes', label: t('common.notesPrev'), type: 'textarea', rows: 3, value: a.notes, className: 'field--full' })}
    `)}
    <div data-warnings class="stack stack--sm"></div>
  `;

  openModal({
    title: existing ? t('agenda.editAppointment') : t('agenda.newAppointment'),
    size: 'wide',
    form: true,
    body,
    onMount: (root) => {
      const startInput = root.querySelector('[name="start"]');
      const endInput = root.querySelector('[name="end"]');
      const warnings = root.querySelector('[data-warnings]');

      const check = () => {
        if (endInput.value <= startInput.value) endInput.value = addMinutes(startInput.value, slot);
        const overlaps = sel.overlapping(state(), startInput.value, endInput.value, existing?.id || '');
        const available = sel.withinAvailability(state(), startInput.value, endInput.value);
        warnings.innerHTML = toHTML(html`
          ${overlaps.length ? html`<p class="notice notice--warn">${icon('alert')}<span>${t('agenda.overlap', { n: overlaps.length })}</span></p>` : ''}
          ${!available ? html`<p class="notice">${icon('info')}<span>${t('agenda.outsideAvailability')}</span></p>` : ''}
        `);
      };

      startInput.addEventListener('change', () => {
        endInput.value = addMinutes(startInput.value, slot);
        check();
      });
      endInput.addEventListener('change', check);
      check();
    },
    onSubmit: (event) => {
      const form = event.target;
      if (!validate(form)) return false;
      const v = formValues(form);
      if (v.end <= v.start) {
        form.querySelector('[name="end"]').setAttribute('aria-invalid', 'true');
        toast(t('validation.endBeforeStart'), { type: 'danger' });
        return false;
      }
      const saved = act.saveAppointment({
        id: existing?.id,
        studentIds: [v.studentIds].filter(Boolean),
        type: v.type,
        start: v.start,
        end: v.end,
        modality: v.modality,
        location: v.location,
        attendees: parseMulti(v.attendees),
        serviceId: v.serviceId,
        state: v.state,
        reminderMinutes: Number(v.reminderMinutes) || 0,
        notes: v.notes,
        seriesRule: v.seriesRule,
        seriesUntil: v.seriesUntil,
      });
      toast(t('common.saved'));
      onSaved?.(saved);
      return true;
    },
  });
}

/**
 * Tancament d'una cita: en marcar-la com a feta s'ofereix crear el registre
 * de seguiment amb tot el context ja precarregat.
 */
export async function closeAppointment(appointmentId, { onSaved } = {}) {
  const appointment = store.find('appointments', appointmentId);
  if (!appointment) return;
  act.setAppointmentState(appointmentId, 'feta');
  const wants = await confirmModal({
    title: t('agenda.createRecord'),
    message: t('agenda.createRecordHint'),
    confirmLabel: t('records.new'),
  });
  if (!wants) { onSaved?.(); return; }
  editRecord({
    studentId: appointment.studentIds?.[0] || '',
    prefill: {
      at: appointment.start,
      type: act.mapAppointmentTypeToRecordType(appointment.type),
      participants: appointment.attendees || [],
      serviceId: appointment.serviceId || '',
      appointmentId: appointment.id,
      studentIds: appointment.studentIds || [],
    },
    onSaved: (record) => {
      store.mutate((draft) => {
        const target = draft.appointments.find((x) => x.id === appointmentId);
        if (target) target.recordId = record.id;
      });
      onSaved?.(record);
    },
  });
}

/** Anul·lació d'una cita amb motiu obligatori. */
export async function cancelAppointment(appointmentId, { onSaved } = {}) {
  const reason = await promptModal({
    title: t('agenda.cancelAppointment'),
    label: t('agenda.cancelReason'),
    required: true,
  });
  if (reason === null) return;
  act.setAppointmentState(appointmentId, 'anullada', reason);
  toast(t('common.saved'));
  onSaved?.();
}

/* --------------------------------------------------------------- Tasques */

export function editTask({ taskId = '', studentId = '', onSaved } = {}) {
  const existing = taskId ? store.find('tasks', taskId) : null;
  const k = existing || {};

  openModal({
    title: existing ? t('common.edit') : t('tasks.new'),
    form: true,
    body: fields(html`
      ${field({ name: 'title', label: t('common.title'), value: k.title, required: true, autofocus: true, className: 'field--full' })}
      ${field({ name: 'studentId', label: t('common.student'), type: 'select', value: k.studentId || studentId, options: studentOptions('—') })}
      ${field({ name: 'owner', label: t('common.responsible'), value: k.owner || act.currentAuthor(), list: 'dl-participants' })}
      ${field({ name: 'due', label: t('common.deadline'), type: 'date', value: k.due })}
      ${field({ name: 'state', label: t('common.state'), type: 'select', value: k.state || 'pendent', options: enumOptions('taskState') })}
      ${field({ name: 'notes', label: t('common.notes'), type: 'textarea', rows: 3, value: k.notes, className: 'field--full' })}
      ${datalist('dl-participants', sel.pool(state(), 'participants'))}
    `),
    onSubmit: (event) => {
      const form = event.target;
      if (!validate(form)) return false;
      const v = formValues(form);
      const saved = act.save('tasks', { id: existing?.id, ...v, origin: existing?.origin || { kind: 'manual', refId: '' } });
      toast(t('common.saved'));
      onSaved?.(saved);
      return true;
    },
  });
}

/* -------------------------------------------------------------- Demandes */

export function editDemand({ demandId = '', studentId = '', onSaved } = {}) {
  const existing = demandId ? store.find('demands', demandId) : null;
  const d = existing || {};

  openModal({
    title: existing ? t('common.edit') : t('casework.newDemand'),
    form: true,
    body: fields(html`
      ${field({ name: 'studentId', label: t('common.student'), type: 'select', value: d.studentId || studentId, options: studentOptions('—'), required: true })}
      ${field({ name: 'origin', label: t('casework.demandOrigin'), type: 'select', value: d.origin || 'tutor', options: enumOptions('demandOrigin') })}
      ${field({ name: 'receivedAt', label: t('casework.receivedAt'), type: 'date', value: d.receivedAt || today(), required: true, suggested: !existing })}
      ${field({ name: 'urgency', label: t('casework.urgency'), type: 'select', value: d.urgency || 'mitjana', options: enumOptions('urgency') })}
      ${field({ name: 'assignedTo', label: t('casework.assignedTo'), value: d.assignedTo || act.currentAuthor(), suggested: !existing })}
      ${field({ name: 'firstActionAt', label: t('casework.firstActionAt'), type: 'date', value: d.firstActionAt })}
      ${field({ name: 'state', label: t('common.state'), type: 'select', value: d.state || 'rebuda', options: enumOptions('demandState') })}
      ${field({ name: 'motive', label: t('common.reason'), type: 'textarea', rows: 3, value: d.motive, required: true, className: 'field--full' })}
    `),
    onSubmit: (event) => {
      const form = event.target;
      if (!validate(form)) return false;
      const saved = act.save('demands', { id: existing?.id, ...formValues(form) });
      toast(t('common.saved'));
      onSaved?.(saved);
      return true;
    },
  });
}

/* ------------------------------------------------------------ Derivacions */

export function editReferral({ referralId = '', studentId = '', onSaved } = {}) {
  const existing = referralId ? store.find('referrals', referralId) : null;
  const r = existing || {};
  const consents = store.live('consents').filter((c) => !studentId || c.studentId === (r.studentId || studentId));

  openModal({
    title: existing ? t('common.edit') : t('casework.newReferral'),
    form: true,
    body: fields(html`
      ${field({ name: 'studentId', label: t('common.student'), type: 'select', value: r.studentId || studentId, options: studentOptions('—'), required: true })}
      ${field({ name: 'serviceId', label: t('casework.destination'), type: 'select', value: r.serviceId, options: serviceOptions() })}
      ${field({ name: 'serviceName', label: `${t('casework.destination')} (${t('common.custom').toLowerCase()})`, value: r.serviceName, hint: 'Si el servei no és a la llista' })}
      ${field({ name: 'requestedAt', label: t('casework.requestedAt'), type: 'date', value: r.requestedAt || today(), required: true })}
      ${field({ name: 'state', label: t('common.state'), type: 'select', value: r.state || 'preparacio', options: enumOptions('referralState') })}
      ${field({ name: 'consentId', label: t('casework.consent'), type: 'select', value: r.consentId, options: optionsFrom(consents.map((c) => ({ value: c.id, label: `${tEnum('consentType', c.type)} · ${fmtDate(c.obtainedAt)}` })), { empty: '—' }) })}
      ${field({ name: 'motive', label: t('common.reason'), type: 'textarea', rows: 3, value: r.motive, required: true, className: 'field--full' })}
      ${field({ name: 'sentDocs', label: t('casework.sentDocs'), type: 'textarea', rows: 2, value: r.sentDocs, className: 'field--full' })}
      ${field({ name: 'response', label: t('casework.response'), type: 'textarea', rows: 2, value: r.response, className: 'field--full' })}
      ${field({ name: 'resolvedAt', label: t('casework.resolvedAt'), type: 'date', value: r.resolvedAt })}
    `),
    onSubmit: (event) => {
      const form = event.target;
      if (!validate(form)) return false;
      const v = formValues(form);
      if (v.serviceId && !v.serviceName) v.serviceName = store.find('services', v.serviceId)?.name || '';
      const saved = act.save('referrals', { id: existing?.id, ...v });
      toast(t('common.saved'));
      onSaved?.(saved);
      return true;
    },
  });
}

/* --------------------------------------------------------- Consentiments */

export function editConsent({ consentId = '', studentId = '', onSaved } = {}) {
  const existing = consentId ? store.find('consents', consentId) : null;
  const c = existing || {};

  openModal({
    title: existing ? t('common.edit') : t('casework.newConsent'),
    form: true,
    body: fields(html`
      ${field({ name: 'studentId', label: t('common.student'), type: 'select', value: c.studentId || studentId, options: studentOptions('—'), required: true })}
      ${field({ name: 'type', label: t('casework.consentType'), type: 'select', value: c.type || 'avaluacio', options: enumOptions('consentType') })}
      ${field({ name: 'obtainedAt', label: t('casework.obtainedAt'), type: 'date', value: c.obtainedAt || today(), required: true })}
      ${field({ name: 'via', label: t('casework.via'), type: 'select', value: c.via || 'signatura', options: enumOptions('consentVia') })}
      ${field({ name: 'validUntil', label: t('casework.validUntil'), type: 'date', value: c.validUntil })}
      ${field({ name: 'document', label: t('common.document'), value: c.document, hint: 'Referència de l’arxiu físic o digital' })}
      ${field({ name: 'scope', label: t('casework.scope'), type: 'textarea', rows: 2, value: c.scope, className: 'field--full' })}
    `),
    onSubmit: (event) => {
      const form = event.target;
      if (!validate(form)) return false;
      const saved = act.save('consents', { id: existing?.id, ...formValues(form) });
      toast(t('common.saved'));
      onSaved?.(saved);
      return true;
    },
  });
}

/* --------------------------------------------------------------- Serveis */

export function editService({ serviceId = '', onSaved } = {}) {
  const existing = serviceId ? store.find('services', serviceId) : null;
  const s = existing || {};

  openModal({
    title: existing ? t('services.edit') : t('services.new'),
    form: true,
    body: fields(html`
      ${field({ name: 'name', label: t('services.entity'), value: s.name, required: true, autofocus: true })}
      ${field({ name: 'kind', label: t('services.kind'), type: 'select', value: s.kind || 'eap', options: enumOptions('serviceKind') })}
      ${field({ name: 'contact', label: t('services.contact'), value: s.contact, list: 'dl-professionals' })}
      ${field({ name: 'phone', label: t('common.phone'), type: 'tel', value: s.phone })}
      ${field({ name: 'email', label: t('common.email'), type: 'email', value: s.email })}
      ${field({ name: 'frequency', label: t('services.frequency'), value: s.frequency })}
      ${field({ name: 'startedAt', label: t('services.startedAt'), type: 'date', value: s.startedAt })}
      ${field({ name: 'endedAt', label: t('services.endedAt'), type: 'date', value: s.endedAt })}
      ${field({ name: 'notes', label: t('common.observations'), type: 'textarea', rows: 2, value: s.notes, className: 'field--full' })}
      ${datalist('dl-professionals', sel.pool(state(), 'professionals'))}
    `),
    onSubmit: (event) => {
      const form = event.target;
      if (!validate(form)) return false;
      const saved = act.save('services', { id: existing?.id, ...formValues(form) });
      toast(t('common.saved'));
      onSaved?.(saved);
      return true;
    },
  });
}

/** Vinculació d'un servei a un alumne/a. */
export function editServiceLink({ linkId = '', studentId = '', serviceId = '', onSaved } = {}) {
  const existing = linkId ? store.find('serviceLinks', linkId) : null;
  const l = existing || {};

  openModal({
    title: existing ? t('common.edit') : t('services.linkStudent'),
    form: true,
    body: fields(html`
      ${field({ name: 'studentId', label: t('common.student'), type: 'select', value: l.studentId || studentId, options: studentOptions('—'), required: true })}
      ${field({ name: 'serviceId', label: t('common.service'), type: 'select', value: l.serviceId || serviceId, options: serviceOptions(''), required: true })}
      ${field({ name: 'role', label: t('services.role'), value: l.role })}
      ${field({ name: 'linkedAt', label: t('services.linkedAt'), type: 'date', value: l.linkedAt || today() })}
      ${field({ name: 'endedAt', label: t('services.endedAt'), type: 'date', value: l.endedAt })}
      ${field({ name: 'notes', label: t('common.observations'), type: 'textarea', rows: 2, value: l.notes, className: 'field--full' })}
    `),
    onSubmit: (event) => {
      const form = event.target;
      if (!validate(form)) return false;
      const saved = act.save('serviceLinks', { id: existing?.id, ...formValues(form) });
      toast(t('common.saved'));
      onSaved?.(saved);
      return true;
    },
  });
}

/* --------------------------------------------------- Professionals interns */

export function editStaff({ staffId = '', onSaved } = {}) {
  const existing = staffId ? store.find('staff', staffId) : null;
  const p = existing || {};

  openModal({
    title: existing ? t('common.edit') : t('services.newInternal'),
    form: true,
    size: 'narrow',
    body: fields(html`
      ${field({ name: 'name', label: t('common.name'), value: p.name, required: true, autofocus: true, className: 'field--full' })}
      ${field({ name: 'role', label: t('services.internalRole'), type: 'select', value: p.role || 'tutor', options: enumOptions('staffRole') })}
      ${field({ name: 'email', label: t('common.email'), type: 'email', value: p.email })}
      ${field({ name: 'phone', label: t('common.phone'), type: 'tel', value: p.phone })}
    `, 1),
    onSubmit: (event) => {
      const form = event.target;
      if (!validate(form)) return false;
      const saved = act.save('staff', { id: existing?.id, ...formValues(form) });
      toast(t('common.saved'));
      onSaved?.(saved);
      return true;
    },
  });
}

/**
 * Esborrat definitiu d'un alumne/a. Es demana confirmació indicant quants
 * elements vinculats desapareixeran, perquè l'acció no té marxa enrere.
 */
export async function deleteStudent(studentId, { onDone } = {}) {
  const student = store.find('students', studentId);
  if (!student) return;
  const ok = await confirmModal({
    title: `${t('students.delete')} — ${sel.listName(student, presentation())}`,
    message: t('students.deleteWarn', { n: act.relatedCount(studentId) }),
    confirmLabel: t('students.deleteConfirm'),
    danger: true,
  });
  if (!ok) return;
  act.remove('students', studentId);
  toast(t('students.deleted'));
  onDone?.();
}

/** Anul·lació genèrica amb motiu i confirmació. */
export async function annulEntity(collection, id, { onDone, label } = {}) {
  const reason = await promptModal({
    title: label || t('common.delete'),
    label: t('common.reason'),
    required: false,
  });
  if (reason === null) return;
  act.annul(collection, id, reason);
  toast(t('common.saved'), {
    actionLabel: t('common.undo'),
    onAction: () => { act.restore(collection, id); onDone?.(); },
  });
  onDone?.();
}
