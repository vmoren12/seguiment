/**
 * modal.js - diàlegs modals accessibles: focus atrapat, tancament amb Escape
 * i retorn del focus a l'element que els ha obert.
 */
import { html, raw, toHTML, icon } from '../dom.js';
import { esc } from '../../core/util.js';
import { t } from '../../core/i18n.js';

const stack = [];

/**
 * Contingut d'un tros del diàleg. Les cadenes es prenen com a HTML ja
 * preparat (és el que documenta l'API); qualsevol altra cosa passa per
 * `toHTML`, que escapa el text interpolat.
 */
function content(value) {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : toHTML(value);
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Obre un diàleg modal.
 * @param {object} config
 * @param {string} config.title    Títol del diàleg (text pla).
 * @param {*}      config.body     Contingut: HTML en cadena o resultat de `html`.
 * @param {*}      [config.footer] Peu personalitzat.
 * @param {'narrow'|'default'|'wide'} [config.size]
 * @param {boolean} [config.form]  Embolcalla el cos en un formulari.
 * @param {Function} [config.onMount]  Rep (element, api).
 * @param {Function} [config.onSubmit] Rep (event, api); retorna false per no tancar.
 * @param {Function} [config.onClose]
 * @returns {{ close: Function, element: HTMLElement }}
 */
export function openModal(config) {
  const {
    title, body, footer, size = 'default', form = false,
    onMount, onSubmit, onClose, closeLabel = t('common.cancel'),
    submitLabel = t('common.save'), showSubmit = true,
  } = config;

  const previousFocus = document.activeElement;
  const host = document.createElement('div');
  host.className = `modal${size === 'wide' ? ' modal--wide' : size === 'narrow' ? ' modal--narrow' : ''}`;
  host.innerHTML = `
    <button type="button" class="modal__scrim" data-modal-close aria-label="${esc(t('a11y.closeDialog'))}"></button>
    <div class="modal__box" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal__head">
        <h2>${esc(title)}</h2>
        <button type="button" class="iconbtn" data-modal-close aria-label="${esc(t('a11y.closeDialog'))}">${toHTML(icon('close'))}</button>
      </div>
      ${form ? '<form class="modal__form" novalidate style="display:contents">' : ''}
      <div class="modal__body">${content(body)}</div>
      <div class="modal__foot">${footer !== undefined ? content(footer) : defaultFooter(closeLabel, submitLabel, showSubmit, form)}</div>
      ${form ? '</form>' : ''}
    </div>`;

  const api = { close: () => close(), element: host };

  function close() {
    const index = stack.indexOf(handleKey);
    if (index >= 0) stack.splice(index, 1);
    document.removeEventListener('keydown', handleKey, true);
    host.remove();
    if (!stack.length) document.body.style.removeProperty('overflow');
    if (previousFocus && previousFocus.focus) previousFocus.focus();
    if (onClose) onClose();
  }

  function handleKey(event) {
    if (stack[stack.length - 1] !== handleKey) return;
    if (event.key === 'Escape') { event.stopPropagation(); close(); return; }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && form) {
      event.preventDefault();
      host.querySelector('form')?.requestSubmit();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = [...host.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  host.querySelectorAll('[data-modal-close]').forEach((el) => el.addEventListener('click', close));

  if (form) {
    host.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      if (!onSubmit) { close(); return; }
      const result = onSubmit(event, api);
      if (result !== false) close();
    });
  }

  document.getElementById('modal-root').appendChild(host);
  document.body.style.overflow = 'hidden';
  stack.push(handleKey);
  document.addEventListener('keydown', handleKey, true);

  if (onMount) onMount(host, api);

  const autofocus = host.querySelector('[autofocus]') || host.querySelector(FOCUSABLE);
  if (autofocus) setTimeout(() => autofocus.focus(), 30);

  return api;
}

function defaultFooter(closeLabel, submitLabel, showSubmit, form) {
  return `
    <button type="button" class="btn" data-modal-close>${esc(closeLabel)}</button>
    ${showSubmit ? `<button type="${form ? 'submit' : 'button'}" class="btn btn--primary">${esc(submitLabel)}</button>` : ''}`;
}

/** Diàleg de confirmació. Retorna una promesa amb el resultat. */
export function confirmModal({ title, message, confirmLabel = t('common.confirm'), danger = false }) {
  return new Promise((resolve) => {
    let decided = false;
    const api = openModal({
      title,
      size: 'narrow',
      body: toHTML(html`<p>${message}</p>`),
      footer: toHTML(html`
        <button type="button" class="btn" data-modal-close>${t('common.cancel')}</button>
        <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-confirm>${confirmLabel}</button>`),
      onMount: (element) => {
        element.querySelector('[data-confirm]').addEventListener('click', () => {
          decided = true;
          api.close();
          resolve(true);
        });
      },
      onClose: () => { if (!decided) resolve(false); },
    });
  });
}

/** Diàleg amb un únic camp de text. Retorna el valor o null. */
export function promptModal({ title, label, value = '', placeholder = '', required = true, multiline = false }) {
  return new Promise((resolve) => {
    let decided = false;
    const id = `p_${Math.random().toString(36).slice(2, 8)}`;
    openModal({
      title,
      size: 'narrow',
      form: true,
      body: toHTML(html`<div class="field">
          <label for="${id}">${label}</label>
          ${multiline
    ? html`<textarea class="textarea" id="${id}" name="value" placeholder="${placeholder}" ${raw(required ? 'required' : '')} autofocus>${value}</textarea>`
    : html`<input class="input" id="${id}" name="value" value="${value}" placeholder="${placeholder}" ${raw(required ? 'required' : '')} autofocus>`}
        </div>`),
      onSubmit: (event) => {
        const field = event.target.querySelector(`#${id}`);
        if (required && !field.value.trim()) { field.setAttribute('aria-invalid', 'true'); return false; }
        decided = true;
        resolve(field.value.trim());
        return true;
      },
      onClose: () => { if (!decided) resolve(null); },
    });
  });
}
