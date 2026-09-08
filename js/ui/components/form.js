/**
 * form.js - construcció declarativa de camps de formulari.
 * Tots els camps porten etiqueta associada, `inputmode` i `autocomplete`
 * adequats i marca visual quan el valor és un suggeriment automàtic.
 */
import { html, raw, toHTML } from '../dom.js';
import { toast } from './toast.js';
import { t } from '../../core/i18n.js';
import { uid } from '../../core/util.js';

const INPUT_MODES = {
  number: 'numeric', tel: 'tel', email: 'email', date: 'none', time: 'none',
};

const AUTOCOMPLETE = {
  email: 'email', tel: 'tel', name: 'name',
};

/**
 * Construeix un camp.
 * @param {object} config
 * @param {string} config.name
 * @param {string} config.label
 * @param {string} [config.type='text'] text|textarea|select|date|time|datetime|number|tel|email|checkbox|radio|hidden
 * @param {*} [config.value]
 * @param {Array} [config.options] Per a select i radio: [{ value, label }]
 * @param {string} [config.hint]
 * @param {boolean} [config.required]
 * @param {boolean} [config.suggested] Marca el camp com a valor suggerit editable.
 * @param {string} [config.list] Identificador d'un datalist d'autocompletat.
 * @param {string} [config.className] Classes addicionals per al contenidor.
 */
export function field(config) {
  const {
    name, label, type = 'text', value = '', options = [], hint, required = false,
    suggested = false, list, className = '', placeholder = '', rows,
    min, max, step, disabled = false, id = `f_${name}_${uid('x').slice(-6)}`,
    autofocus = false, tall = false,
  } = config;

  if (type === 'hidden') return html`<input type="hidden" name="${name}" value="${value}">`;

  const describedBy = hint ? `${id}_h` : '';
  const common = raw(`id="${id}" name="${name}"${required ? ' required' : ''}${disabled ? ' disabled' : ''}`
    + `${describedBy ? ` aria-describedby="${describedBy}"` : ''}`
    + `${suggested ? ' data-suggested="true"' : ''}`
    + `${list ? ` list="${list}"` : ''}`
    + `${autofocus ? ' autofocus' : ''}`);

  let control;
  if (type === 'textarea') {
    control = html`<textarea class="textarea${tall ? ' textarea--tall' : ''}" ${common} rows="${rows || 5}" placeholder="${placeholder}">${value}</textarea>`;
  } else if (type === 'select') {
    control = html`<select class="select" ${common}>${options.map((o) => html`<option value="${o.value}"${raw(String(o.value) === String(value) ? ' selected' : '')}>${o.label}</option>`)}</select>`;
  } else if (type === 'checkbox') {
    return html`<div class="field field--check ${className}">
      <label class="check">
        <input type="checkbox" ${common}${raw(value ? ' checked' : '')}>
        <span>${label}</span>
      </label>
      ${hint ? html`<p class="field__hint" id="${describedBy}">${hint}</p>` : ''}
    </div>`;
  } else {
    const inputType = type === 'datetime' ? 'datetime-local' : type;
    const mode = INPUT_MODES[type] ? ` inputmode="${INPUT_MODES[type]}"` : '';
    const auto = AUTOCOMPLETE[type] ? ` autocomplete="${AUTOCOMPLETE[type]}"` : ' autocomplete="off"';
    const bounds = `${min !== undefined ? ` min="${min}"` : ''}${max !== undefined ? ` max="${max}"` : ''}${step !== undefined ? ` step="${step}"` : ''}`;
    control = html`<input class="input" type="${inputType}" ${common}${raw(mode + auto + bounds)} value="${value}" placeholder="${placeholder}">`;
  }

  return html`<div class="field ${className}">
    <label for="${id}">${label}${required ? raw(' <span aria-hidden="true">*</span>') : ''}</label>
    ${control}
    ${hint ? html`<p class="field__hint" id="${describedBy}">${hint}</p>` : ''}
  </div>`;
}

/** Llista de suggeriments per a l'autocompletat amb creació sobre la marxa. */
export function datalist(id, values) {
  return html`<datalist id="${id}">${values.filter(Boolean).map((v) => html`<option value="${v}"></option>`)}</datalist>`;
}

/** Agrupació de camps amb títol. */
export function fieldset(legend, children, columns = 2) {
  return html`<fieldset class="fieldset">
    <legend>${legend}</legend>
    <div class="fields fields--${columns}">${children}</div>
  </fieldset>`;
}

/** Files de camps sense títol. */
export function fields(children, columns = 2) {
  return html`<div class="fields fields--${columns}">${children}</div>`;
}

/** Opcions a partir d'una llista de cadenes. */
export function optionsFrom(values, { empty } = {}) {
  const list = values.map((v) => (typeof v === 'string' ? { value: v, label: v } : v));
  return empty === undefined ? list : [{ value: '', label: empty }, ...list];
}

/** Valida un formulari i marca els camps incorrectes. Retorna cert si és vàlid. */
export function validate(form) {
  let valid = true;
  form.querySelectorAll('[required]').forEach((el) => {
    const empty = el.type === 'checkbox' ? !el.checked : !String(el.value).trim();
    el.setAttribute('aria-invalid', empty ? 'true' : 'false');
    if (empty) valid = false;
  });
  form.querySelectorAll('input[type="email"]').forEach((el) => {
    if (el.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value)) {
      el.setAttribute('aria-invalid', 'true');
      valid = false;
    }
  });
  if (!valid) {
    const first = form.querySelector('[aria-invalid="true"]');
    first?.scrollIntoView({ block: 'center' });
    first?.focus();
    // Sense missatge, un camp marcat en vermell enmig d'un formulari llarg
    // passa desapercebut i sembla que el desat no faci res.
    toast(t('validation.fixErrors'), { type: 'danger' });
  }
  return valid;
}

/** Missatge d'error del formulari. */
export function formError(message = t('validation.fixErrors')) {
  return toHTML(html`<p class="notice notice--danger">${message}</p>`);
}

/** Camp de text lliure amb valors separats per comes i autocompletat. */
export function multiField(config) {
  const value = Array.isArray(config.value) ? config.value.join(', ') : (config.value || '');
  return field({ ...config, value, hint: config.hint || 'Separeu els valors amb comes.' });
}

/** Converteix el valor d'un `multiField` en llista. */
export function parseMulti(value) {
  return String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
}
