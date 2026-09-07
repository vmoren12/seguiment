/**
 * settings.js - configuració completa amb desat automàtic en cada canvi:
 * dades del centre, aparença, cursos i grups, agenda, tipus i colors,
 * plantilles i frases, catàleg normatiu, llindars, dades i privacitat.
 */
import { html, icon, raw } from '../dom.js';
import { t, tEnum, fmtDateTime, LANGS, getLang } from '../../core/i18n.js';
import * as store from '../../core/store.js';
import * as persist from '../../core/persist.js';
import * as vault from '../../core/crypto.js';
import * as act from '../../domain/actions.js';
import * as sel from '../../domain/selectors.js';
import { current, setQuery } from '../router.js';
import { uid, pickFile, readFileAsText } from '../../core/util.js';
import { daysSince, schoolYear } from '../../core/dates.js';
import { exportJSON } from '../../core/export.js';
import { openModal, confirmModal } from '../components/modal.js';
import { toast, toastError } from '../components/toast.js';
import { scheduleRender, applyTheme, changeLanguage } from '../shell.js';
import { APP_VERSION, SCHEMA_VERSION, DEFAULT_TEMPLATES, RECORD_TYPES } from '../../domain/schema.js';

const SECTIONS = ['centre', 'appearance', 'groups', 'calendar', 'types', 'content', 'normative', 'thresholds', 'data', 'privacy', 'about'];

export function title() { return { title: t('settings.title'), subtitle: '' }; }

function section() { return SECTIONS.includes(current().query.s) ? current().query.s : 'centre'; }

/** Camp de configuració amb desat automàtic. */
function setting(path, label, { type = 'text', value = '', options = [], hint = '', min, max } = {}) {
  const id = `set_${path.replace(/\./g, '_')}`;
  const attrs = raw(`id="${id}" data-act-change="set:change" data-act-input="set:input" data-path="${path}"`
    + `${min !== undefined ? ` min="${min}"` : ''}${max !== undefined ? ` max="${max}"` : ''}`);

  if (type === 'checkbox') {
    return html`<label class="check">
      <input type="checkbox" ${attrs}${raw(value ? ' checked' : '')}>
      <span>${label}${hint ? html`<span class="field__hint">${hint}</span>` : ''}</span>
    </label>`;
  }
  if (type === 'select') {
    return html`<div class="field">
      <label for="${id}">${label}</label>
      <select class="select" ${attrs}>
        ${options.map((o) => html`<option value="${o.value}"${raw(String(o.value) === String(value) ? ' selected' : '')}>${o.label}</option>`)}
      </select>
      ${hint ? html`<p class="field__hint">${hint}</p>` : ''}
    </div>`;
  }
  if (type === 'textarea') {
    return html`<div class="field">
      <label for="${id}">${label}</label>
      <textarea class="textarea" ${attrs} rows="6">${value}</textarea>
      ${hint ? html`<p class="field__hint">${hint}</p>` : ''}
    </div>`;
  }
  return html`<div class="field">
    <label for="${id}">${label}</label>
    <input class="input" type="${type}" ${attrs} value="${value}">
    ${hint ? html`<p class="field__hint">${hint}</p>` : ''}
  </div>`;
}

/* ------------------------------------------------------------- Seccions */

function centreSection(s) {
  return html`<section class="card">
    <div class="card__head"><h3>${t('settings.sections.centre')}</h3></div>
    <div class="fields fields--2">
      ${setting('centre.name', t('settings.centreName'), { value: s.centre.name })}
      ${setting('centre.code', t('settings.centreCode'), { value: s.centre.code })}
      ${setting('centre.address', t('settings.centreAddress'), { value: s.centre.address })}
      ${setting('centre.schoolYear', t('settings.schoolYear'), { value: s.centre.schoolYear || schoolYear(), hint: 'Format AAAA-AAAA' })}
      ${setting('centre.professional', t('settings.professionalName'), { value: s.centre.professional, hint: 'Signa els registres i l’auditoria' })}
      ${setting('centre.role', t('settings.professionalRole'), {
    type: 'select',
    value: s.centre.role,
    options: ['orientacio', 'tutor', 'coordinacio', 'direccio', 'docent', 'tis', 'altres'].map((k) => ({ value: k, label: tEnum('staffRole', k) })),
  })}
    </div>
  </section>`;
}

function appearanceSection(s) {
  return html`<section class="card">
    <div class="card__head"><h3>${t('settings.sections.appearance')}</h3></div>
    <div class="fields fields--2">
      ${setting('lang', t('common.language'), { type: 'select', value: getLang(), options: LANGS.map((l) => ({ value: l.code, label: l.label })) })}
      ${setting('theme', t('settings.theme'), {
    type: 'select',
    value: s.theme,
    options: [
      { value: 'auto', label: t('settings.themeAuto') },
      { value: 'light', label: t('settings.themeLight') },
      { value: 'dark', label: t('settings.themeDark') },
    ],
  })}
    </div>
    <div style="margin-top:12px">
      <div class="switchrow">
        <div class="switchrow__txt"><b>${t('settings.autosave')}</b><span class="field__hint">${t('settings.autosaveHint')}</span></div>
        ${setting('autosave', '', { type: 'checkbox', value: s.autosave })}
      </div>
      <div class="switchrow">
        <div class="switchrow__txt"><b>${t('settings.presentation')}</b><span class="field__hint">${t('settings.presentationHint')}</span></div>
        ${setting('presentation', '', { type: 'checkbox', value: s.presentation })}
      </div>
    </div>
  </section>`;
}

function listEditor(title, items, columns, addLabel, addAction, removeAction) {
  return html`<section class="card">
    <div class="card__head"><h3>${title}</h3>
      <button type="button" class="btn btn--sm" data-act="${addAction}">${icon('plus')}${addLabel}</button></div>
    ${items.length ? html`<div class="tablewrap"><table class="table table--cards">
      <thead><tr>${columns.map((c) => html`<th>${c.label}</th>`)}<th></th></tr></thead>
      <tbody>${items.map((item) => html`<tr>
        ${columns.map((c) => html`<td data-th="${c.label}">${c.render(item)}</td>`)}
        <td class="right"><button type="button" class="iconbtn iconbtn--sm" data-act="${removeAction}" data-id="${item.id}" aria-label="${t('common.remove')}">${icon('trash')}</button></td>
      </tr>`)}</tbody>
    </table></div>` : html`<p class="muted small">${t('common.empty')}</p>`}
  </section>`;
}

function groupsSection(s, state) {
  return html`<div class="stack">
    <section class="card">
      <div class="card__head"><h3>${t('settings.levels')}</h3></div>
      ${setting('levels', t('settings.levels'), {
    type: 'textarea',
    value: (s.levels || []).join('\n'),
    hint: 'Un nivell per línia. S’utilitza als filtres i a les estadístiques.',
  })}
    </section>
    ${listEditor(
    t('settings.sections.groups'),
    s.groups || [],
    [
      { label: t('common.group'), render: (g) => html`<input class="input input--sm" value="${g.name}" data-act-change="set:group" data-id="${g.id}" data-k="name">` },
      { label: t('common.level'), render: (g) => html`<input class="input input--sm" value="${g.level || ''}" data-act-change="set:group" data-id="${g.id}" data-k="level" list="dl-levels">` },
      { label: t('common.tutor'), render: (g) => html`<input class="input input--sm" value="${g.tutor || ''}" data-act-change="set:group" data-id="${g.id}" data-k="tutor">` },
    ],
    t('settings.addGroup'), 'set:group:add', 'set:group:del',
  )}
    <datalist id="dl-levels">${(s.levels || []).map((l) => html`<option value="${l}"></option>`)}</datalist>
    <p class="field__hint">${t('settings.groupsHint')} ${t('common.total')}: ${sel.groups(state).length}</p>
  </div>`;
}

function calendarSection(s) {
  const cal = s.calendar || {};
  return html`<div class="stack">
    <section class="card">
      <div class="card__head"><h3>${t('settings.sections.calendar')}</h3></div>
      <div class="fields fields--3">
        ${setting('calendar.dayStart', t('settings.dayStart'), { type: 'time', value: cal.dayStart })}
        ${setting('calendar.dayEnd', t('settings.dayEnd'), { type: 'time', value: cal.dayEnd })}
        ${setting('calendar.slotMinutes', t('settings.slotMinutes'), { type: 'number', value: cal.slotMinutes, min: 5, max: 240 })}
      </div>
    </section>
    ${listEditor(
    t('settings.availability'),
    cal.availability || [],
    [
      {
        label: t('common.day'),
        render: (a) => html`<select class="select input--sm" data-act-change="set:avail" data-id="${a.id}" data-k="day">
          ${[1, 2, 3, 4, 5, 6, 0].map((d) => html`<option value="${d}"${raw(Number(a.day) === d ? ' selected' : '')}>${tEnum('weekday', d)}</option>`)}
        </select>`,
      },
      { label: t('common.from'), render: (a) => html`<input class="input input--sm" type="time" value="${a.from}" data-act-change="set:avail" data-id="${a.id}" data-k="from">` },
      { label: t('common.to'), render: (a) => html`<input class="input input--sm" type="time" value="${a.to}" data-act-change="set:avail" data-id="${a.id}" data-k="to">` },
    ],
    t('settings.addAvailability'), 'set:avail:add', 'set:avail:del',
  )}
  </div>`;
}

function typesSection(s) {
  return html`<div class="stack">
    ${listEditor(
    t('settings.appointmentTypes'),
    s.appointmentTypes || [],
    [
      { label: t('common.label'), render: (x) => html`<span>${tEnum('appointmentType', x.id)}</span>` },
      {
        label: t('common.color'),
        render: (x) => html`<input class="input input--sm" type="color" value="${x.color}" data-act-change="set:apptype" data-id="${x.id}" style="width:64px;padding:2px">`,
      },
    ],
    '', '', 'set:apptype:del',
  )}
    <section class="card">
      <div class="card__head"><h3>${t('settings.recordTypes')}</h3></div>
      <p class="row row--tight">${(s.recordTypes || RECORD_TYPES).map((k) => html`<span class="tag">${tEnum('recordType', k)}</span>`)}</p>
      <p class="field__hint" style="margin-top:8px">Els tipus de registre integrats cobreixen les actuacions previstes a la normativa. Les plantilles associades es poden editar a la secció de contingut.</p>
    </section>
  </div>`;
}

function contentSection(s) {
  const types = s.recordTypes || RECORD_TYPES;
  return html`<div class="stack">
    <section class="card">
      <div class="card__head"><h3>${t('settings.templates')}</h3></div>
      <div class="field">
        <label for="tpl-type">${t('common.type')}</label>
        <select class="select" id="tpl-type" data-act-change="set:tpl:type">
          ${types.map((k) => html`<option value="${k}"${raw(k === (current().query.tpl || types[0]) ? ' selected' : '')}>${tEnum('recordType', k)}</option>`)}
        </select>
      </div>
      <div class="field" style="margin-top:12px">
        <label for="tpl-text">${t('settings.templateFor', { t: tEnum('recordType', current().query.tpl || types[0]) })}</label>
        <textarea class="textarea textarea--tall" id="tpl-text" data-act-change="set:tpl:text" data-key="${current().query.tpl || types[0]}">${(s.templates || {})[current().query.tpl || types[0]] || ''}</textarea>
        <p class="field__hint">Els snippets {{alumne}}, {{curs}}, {{data}}, {{tutor}}, {{professional}} i {{centre}} s’expandeixen en escriure.</p>
      </div>
      <div class="card__foot">
        <button type="button" class="btn btn--sm" data-act="set:tpl:reset">${t('common.reset')}</button>
      </div>
    </section>

    ${listEditor(
    t('settings.phrases'),
    s.phrases || [],
    [
      { label: t('settings.phraseCategory'), render: (p) => html`<input class="input input--sm" value="${p.category || ''}" data-act-change="set:phrase" data-id="${p.id}" data-k="category">` },
      { label: t('settings.phraseText'), render: (p) => html`<input class="input input--sm" value="${p.text}" data-act-change="set:phrase" data-id="${p.id}" data-k="text">` },
    ],
    t('settings.addPhrase'), 'set:phrase:add', 'set:phrase:del',
  )}
  </div>`;
}

function normativeSection(s) {
  return listEditor(
    t('settings.normativeCatalog'),
    s.normative || [],
    [
      { label: t('common.reference'), render: (n) => html`<input class="input input--sm" value="${n.ref}" data-act-change="set:norm" data-id="${n.id}" data-k="ref">` },
      { label: t('common.title'), render: (n) => html`<input class="input input--sm" value="${n.title}" data-act-change="set:norm" data-id="${n.id}" data-k="title">` },
    ],
    t('settings.addNormative'), 'set:norm:add', 'set:norm:del',
  );
}

function thresholdsSection(s) {
  const th = s.thresholds || {};
  return html`<section class="card">
    <div class="card__head"><h3>${t('settings.sections.thresholds')}</h3></div>
    <div class="fields fields--2">
      ${setting('thresholds.noContactDays', t('settings.thresholdNoContact'), { type: 'number', value: th.noContactDays, min: 1, max: 365 })}
      ${setting('thresholds.sealDays', t('settings.thresholdSeal'), { type: 'number', value: th.sealDays, min: 1, max: 365, hint: t('records.sealedNote') })}
      ${setting('thresholds.piWarnDays', t('settings.thresholdPiWarn'), { type: 'number', value: th.piWarnDays, min: 1, max: 180 })}
      ${setting('thresholds.backupDays', t('settings.thresholdBackup'), { type: 'number', value: th.backupDays, min: 1, max: 180 })}
    </div>
  </section>`;
}

function dataSection(s, state) {
  const size = persist.storageSize();
  const last = s.lastBackupAt;
  const gap = last ? daysSince(last) : null;
  const counts = ['students', 'records', 'appointments', 'tasks', 'demands', 'referrals', 'consents', 'services'];

  return html`<div class="stack">
    <section class="card">
      <div class="card__head"><h3>${t('settings.sections.data')}</h3></div>
      ${gap !== null && gap >= (s.thresholds?.backupDays ?? 14)
    ? html`<p class="notice notice--warn">${icon('alert')}<span>${t('settings.backupReminder', { n: gap })}</span></p>` : ''}
      <dl class="deflist" style="margin-top:12px">
        ${counts.map((c) => html`<div><dt>${t(`audit.entities.${c.replace(/s$/, '').replace('serie', 'service')}`) || c}</dt><dd>${state[c].length}</dd></div>`)}
        <div><dt>${t('audit.title')}</dt><dd>${state.audit.length}</dd></div>
        <div><dt>${t('common.total')}</dt><dd>${(size / 1024).toFixed(0)} kB</dd></div>
        <div><dt>${t('settings.lastBackup', { d: '' })}</dt><dd>${last ? fmtDateTime(last) : t('common.never')}</dd></div>
      </dl>
      <div class="card__foot">
        <div class="row">
          <button type="button" class="btn btn--primary" data-act="set:export">${icon('download')}${t('settings.exportAll')}</button>
          <button type="button" class="btn" data-act="set:export:student">${icon('download')}${t('settings.exportStudent')}</button>
          <button type="button" class="btn" data-act="set:import">${icon('upload')}${t('settings.importJson')}</button>
        </div>
      </div>
    </section>
  </div>`;
}

function privacySection(s) {
  const locked = s.lockEnabled;
  return html`<div class="stack">
    <section class="card">
      <div class="card__head"><h3>${t('settings.sections.privacy')}</h3></div>
      <p class="notice notice--ok">${icon('shield')}<span>${t('app.privacy')} ${t('settings.offline')}</span></p>
      <div style="margin-top:16px">
        <div class="switchrow">
          <div class="switchrow__txt">
            <b>${t('settings.lock')}</b>
            <span class="field__hint">${t('settings.lockHint')}</span>
          </div>
          <button type="button" class="btn btn--sm" data-act="set:lock">${locked ? t('settings.lockDisable') : t('settings.lockEnable')}</button>
        </div>
        <div class="switchrow">
          <div class="switchrow__txt">
            <b>${t('settings.presentation')}</b>
            <span class="field__hint">${t('settings.presentationHint')}</span>
          </div>
          ${setting('presentation', '', { type: 'checkbox', value: s.presentation })}
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card__head"><h3>${t('settings.legal')}</h3></div>
      <p class="small">${t('settings.legalText')}</p>
    </section>

    <section class="card">
      <div class="card__head"><h3>${t('settings.wipe')}</h3></div>
      <p class="notice notice--danger">${icon('alert')}<span>${t('settings.wipeHint')}</span></p>
      <div class="card__foot">
        <button type="button" class="btn btn--danger" data-act="set:wipe">${icon('trash')}${t('settings.wipe')}</button>
      </div>
    </section>
  </div>`;
}

function aboutSection() {
  return html`<section class="card">
    <div class="card__head"><h3>${t('settings.sections.about')}</h3></div>
    <dl class="deflist">
      <div><dt>${t('app.name')}</dt><dd>${t('app.tagline')}</dd></div>
      <div><dt>${t('common.version')}</dt><dd>${t('settings.version', { v: APP_VERSION, s: SCHEMA_VERSION })}</dd></div>
      <div><dt>${t('settings.offline')}</dt><dd>${t('common.yes')}</dd></div>
    </dl>
    <p class="small muted" style="margin-top:12px">${t('quick.shortcuts')}: ${t('quick.shortcutNew')} · ${t('quick.shortcutSearch')} · ${t('quick.shortcutSave')} · ${t('quick.shortcutEsc')}</p>
    <div class="card__foot">
      <button type="button" class="btn" data-act="set:install" id="btn-install" hidden>${icon('download')}${t('settings.install')}</button>
      <button type="button" class="btn btn--sm btn--ghost" data-act="set:notifications">${icon('info')}${t('agenda.reminder')}</button>
    </div>
  </section>`;
}

/* ---------------------------------------------------------------- Render */

export function render({ state }) {
  const s = state.settings;
  const active = section();
  const panels = {
    centre: () => centreSection(s),
    appearance: () => appearanceSection(s),
    groups: () => groupsSection(s, state),
    calendar: () => calendarSection(s),
    types: () => typesSection(s),
    content: () => contentSection(s),
    normative: () => normativeSection(s),
    thresholds: () => thresholdsSection(s),
    data: () => dataSection(s, state),
    privacy: () => privacySection(s),
    about: () => aboutSection(),
  };

  return html`
    <div class="page-head"><div><h2>${t('settings.title')}</h2></div></div>
    <nav class="tabs" role="tablist">
      ${SECTIONS.map((k) => html`<button type="button" class="tab" role="tab" aria-selected="${k === active}"
        data-act="set:section" data-s="${k}">${t(`settings.sections.${k}`)}</button>`)}
    </nav>
    <div role="tabpanel">${panels[active]()}</div>`;
}

/* --------------------------------------------------------------- Accions */

function applyPath(path, value, { audit = true } = {}) {
  const [head, tail] = path.split('.');
  const patch = tail ? { [head]: { [tail]: value } } : { [head]: value };
  // Mentre s'escriu, el valor es desa sense deixar constància; l'entrada
  // d'auditoria s'afegeix un cop quan el camp perd el focus (event change).
  if (audit) act.updateSettings(patch, `${t('settings.title')}: ${path}`);
  else store.patchSettings(patch);
}

function readControl(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.type === 'number') return Number(el.value);
  return el.value;
}

async function importFlow() {
  const file = await pickFile();
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await readFileAsText(file));
    act.previewImport(data);
  } catch (error) {
    toastError(t('settings.importInvalid', { e: error.message }));
    return;
  }

  const preview = act.previewImport(data);
  openModal({
    title: t('settings.importJson'),
    body: html`
      <p>${t('settings.importSummary', { a: preview.add, u: preview.update })}</p>
      <div class="tablewrap" style="margin-top:12px"><table class="table">
        <thead><tr><th>${t('common.type')}</th><th class="num">${t('common.new')}</th><th class="num">${t('common.updatedAt')}</th></tr></thead>
        <tbody>${Object.entries(preview.detail).filter(([, v]) => v.total).map(([k, v]) => html`<tr>
          <td>${k}</td><td class="num">${v.add}</td><td class="num">${v.update}</td>
        </tr>`)}
        <tr><td>${t('audit.title')}</td><td class="num">${preview.auditNew}</td><td class="num">0</td></tr></tbody>
      </table></div>
      <div class="field" style="margin-top:16px">
        <label for="imp-mode">${t('settings.importMode')}</label>
        <select class="select" id="imp-mode">
          <option value="merge">${t('settings.importMerge')}</option>
          <option value="replace">${t('settings.importReplace')}</option>
        </select>
      </div>`,
    footer: html`
      <button type="button" class="btn" data-modal-close>${t('common.cancel')}</button>
      <button type="button" class="btn btn--primary" data-import-apply>${t('common.apply')}</button>`,
    onMount: (root, api) => {
      root.querySelector('[data-import-apply]').addEventListener('click', async () => {
        const mode = root.querySelector('#imp-mode').value;
        if (mode === 'replace') {
          const ok = await confirmModal({
            title: t('settings.importReplace'),
            message: t('settings.wipeConfirm1'),
            danger: true,
          });
          if (!ok) return;
        }
        try {
          act.applyImport(data, mode);
          api.close();
          toast(t('common.saved'));
          scheduleRender();
        } catch (error) {
          toastError(t('settings.importInvalid', { e: error.message }));
        }
      });
    },
  });
}

async function wipeFlow() {
  const first = await confirmModal({
    title: t('settings.wipe'),
    message: t('settings.wipeConfirm1'),
    confirmLabel: t('common.continue'),
    danger: true,
  });
  if (!first) return;

  openModal({
    title: t('settings.wipe'),
    size: 'narrow',
    form: true,
    submitLabel: t('settings.wipe'),
    body: html`<div class="field">
      <label for="wipe-word">${t('settings.wipeConfirm2')}</label>
      <input class="input" id="wipe-word" name="word" autocomplete="off" autofocus>
    </div>`,
    onSubmit: (event) => {
      const value = event.target.querySelector('#wipe-word').value.trim().toUpperCase();
      if (value !== t('settings.wipeWord')) {
        event.target.querySelector('#wipe-word').setAttribute('aria-invalid', 'true');
        return false;
      }
      act.wipeAll();
      store.flush().then(() => {
        persist.wipe();
        location.reload();
      });
      return true;
    },
  });
}

async function lockFlow(enabled) {
  if (enabled) {
    const ok = await confirmModal({ title: t('settings.lockDisable'), message: t('settings.lockHint'), danger: true });
    if (!ok) return;
    persist.setEncrypted(false);
    vault.lock();
    act.updateSettings({ lockEnabled: false }, t('settings.lockDisable'));
    await store.saveNow();
    toast(t('common.saved'));
    scheduleRender();
    return;
  }

  if (!vault.isSupported()) { toastError('El navegador no admet el xifratge necessari.'); return; }

  openModal({
    title: t('settings.lockEnable'),
    size: 'narrow',
    form: true,
    body: html`
      <p class="notice notice--warn">${icon('alert')}<span>${t('settings.lockHint')}</span></p>
      <div class="fields" style="margin-top:12px">
        <div class="field"><label for="pw1">${t('settings.password')}</label>
          <input class="input" type="password" id="pw1" autocomplete="new-password" required autofocus></div>
        <div class="field"><label for="pw2">${t('settings.passwordRepeat')}</label>
          <input class="input" type="password" id="pw2" autocomplete="new-password" required></div>
      </div>`,
    onSubmit: async (event) => {
      const pw1 = event.target.querySelector('#pw1').value;
      const pw2 = event.target.querySelector('#pw2').value;
      if (pw1.length < 8) { toastError(t('settings.passwordShort')); return false; }
      if (pw1 !== pw2) { toastError(t('settings.passwordMismatch')); return false; }
      await vault.setPassword(pw1);
      persist.setEncrypted(true);
      act.updateSettings({ lockEnabled: true }, t('settings.lockEnable'));
      await store.saveNow();
      toast(t('common.saved'));
      scheduleRender();
      return true;
    },
  });
}

export function actions({ state }) {
  return {
    'set:section': (el) => setQuery({ s: el.dataset.s }),

    'set:change': (el) => {
      const path = el.dataset.path;
      const value = readControl(el);
      if (path === 'lang') { act.updateSettings({ lang: value }); changeLanguage(value); return; }
      if (path === 'theme') { applyTheme(value); }
      if (path === 'levels') { applyPath(path, String(value).split('\n').map((x) => x.trim()).filter(Boolean)); scheduleRender(); return; }
      applyPath(path, value);
      if (path === 'presentation' || path === 'autosave') scheduleRender();
    },
    'set:input': (el) => {
      // Els camps de text es desen amb el mateix mecanisme, amb l'antirebot
      // del magatzem (500 ms) evitant escriptures excessives.
      if (el.type === 'checkbox' || el.tagName === 'SELECT') return;
      const path = el.dataset.path;
      if (path === 'levels' || path === 'lang' || path === 'theme') return;
      applyPath(path, readControl(el), { audit: false });
    },

    'set:group:add': () => {
      act.updateSettings({ groups: [...(state.settings.groups || []), { id: uid('gr'), name: '', level: '', tutor: '' }] }, t('settings.addGroup'));
      scheduleRender();
    },
    'set:group:del': (el) => {
      act.updateSettings({ groups: (state.settings.groups || []).filter((g) => g.id !== el.dataset.id) }, t('common.remove'));
      scheduleRender();
    },
    'set:group': (el) => {
      act.updateSettings({
        groups: (state.settings.groups || []).map((g) => (g.id === el.dataset.id ? { ...g, [el.dataset.k]: el.value } : g)),
      });
    },

    'set:avail:add': () => {
      act.updateSettings({
        calendar: { ...state.settings.calendar, availability: [...(state.settings.calendar.availability || []), { id: uid('av'), day: 1, from: '08:00', to: '14:00' }] },
      }, t('settings.addAvailability'));
      scheduleRender();
    },
    'set:avail:del': (el) => {
      act.updateSettings({
        calendar: { ...state.settings.calendar, availability: (state.settings.calendar.availability || []).filter((a) => a.id !== el.dataset.id) },
      }, t('common.remove'));
      scheduleRender();
    },
    'set:avail': (el) => {
      act.updateSettings({
        calendar: {
          ...state.settings.calendar,
          availability: (state.settings.calendar.availability || []).map((a) => (a.id === el.dataset.id ? { ...a, [el.dataset.k]: el.value } : a)),
        },
      });
    },

    'set:apptype': (el) => {
      act.updateSettings({
        appointmentTypes: (state.settings.appointmentTypes || []).map((x) => (x.id === el.dataset.id ? { ...x, color: el.value } : x)),
      });
    },
    'set:apptype:del': (el) => {
      act.updateSettings({ appointmentTypes: (state.settings.appointmentTypes || []).filter((x) => x.id !== el.dataset.id) }, t('common.remove'));
      scheduleRender();
    },

    'set:tpl:type': (el) => setQuery({ tpl: el.value }),
    'set:tpl:text': (el) => {
      act.updateSettings({ templates: { ...state.settings.templates, [el.dataset.key]: el.value } });
    },
    'set:tpl:reset': () => {
      act.updateSettings({ templates: { ...DEFAULT_TEMPLATES } }, t('common.reset'));
      scheduleRender();
    },

    'set:phrase:add': () => {
      act.updateSettings({ phrases: [...(state.settings.phrases || []), { id: uid('fr'), category: '', text: '' }] }, t('settings.addPhrase'));
      scheduleRender();
    },
    'set:phrase:del': (el) => {
      act.updateSettings({ phrases: (state.settings.phrases || []).filter((p) => p.id !== el.dataset.id) }, t('common.remove'));
      scheduleRender();
    },
    'set:phrase': (el) => {
      act.updateSettings({
        phrases: (state.settings.phrases || []).map((p) => (p.id === el.dataset.id ? { ...p, [el.dataset.k]: el.value } : p)),
      });
    },

    'set:norm:add': () => {
      act.updateSettings({ normative: [...(state.settings.normative || []), { id: uid('nr'), ref: '', title: '' }] }, t('settings.addNormative'));
      scheduleRender();
    },
    'set:norm:del': (el) => {
      act.updateSettings({ normative: (state.settings.normative || []).filter((n) => n.id !== el.dataset.id) }, t('common.remove'));
      scheduleRender();
    },
    'set:norm': (el) => {
      act.updateSettings({
        normative: (state.settings.normative || []).map((n) => (n.id === el.dataset.id ? { ...n, [el.dataset.k]: el.value } : n)),
      });
    },

    'set:export': () => {
      const payload = act.buildExport();
      exportJSON(payload, `seguiment-${state.settings.centre?.code || 'centre'}`);
      act.updateSettings({ lastBackupAt: new Date().toISOString() }, t('settings.exportAll'));
      act.logExport('JSON', t('settings.exportAll'));
      toast(t('common.saved'));
      scheduleRender();
    },
    'set:export:student': () => {
      openModal({
        title: t('settings.exportStudent'),
        size: 'narrow',
        form: true,
        submitLabel: t('common.export'),
        body: html`<div class="field">
          <label for="exp-student">${t('common.student')}</label>
          <select class="select" id="exp-student" required>
            ${sel.allStudents(state).map((s) => html`<option value="${s.id}">${sel.listName(s, false)}</option>`)}
          </select>
        </div>`,
        onSubmit: (event) => {
          const id = event.target.querySelector('#exp-student').value;
          if (!id) return false;
          const student = store.find('students', id);
          exportJSON(act.buildExport({ studentId: id }), `traspas-${sel.listName(student, false)}`);
          act.logExport('JSON', `Traspàs de ${sel.listName(student, false)}`);
          toast(t('common.saved'));
          return true;
        },
      });
    },
    'set:import': () => importFlow(),
    'set:wipe': () => wipeFlow(),
    'set:lock': () => lockFlow(state.settings.lockEnabled),
    'set:install': () => window.__seguimentInstall?.(),
    'set:notifications': async () => {
      if (!('Notification' in window)) { toastError('El navegador no admet notificacions.'); return; }
      const result = await Notification.requestPermission();
      toast(result === 'granted' ? t('common.saved') : t('common.cancel'));
    },
  };
}

export function mount(root) {
  const install = root.querySelector('#btn-install');
  if (install && window.__seguimentInstall) install.hidden = false;
}

