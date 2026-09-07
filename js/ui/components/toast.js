/**
 * toast.js - avisos breus i no bloquejants amb acció opcional (desfés).
 */
import { esc } from '../../core/util.js';

const root = () => document.getElementById('toast-root');

/**
 * Mostra un avís.
 * @param {string} message Text de l'avís.
 * @param {object} [options]
 * @param {'info'|'danger'} [options.type]
 * @param {string} [options.actionLabel] Etiqueta del botó d'acció.
 * @param {Function} [options.onAction]  Acció a executar.
 * @param {number} [options.timeout]     Mil·lisegons fins a tancar-se.
 */
export function toast(message, { type = 'info', actionLabel, onAction, timeout = 4200 } = {}) {
  const container = root();
  if (!container) return () => {};

  const element = document.createElement('div');
  element.className = `toast${type === 'danger' ? ' toast--danger' : ''}`;
  element.innerHTML = `<span>${esc(message)}</span>${actionLabel ? `<button type="button">${esc(actionLabel)}</button>` : ''}`;

  const close = () => { clearTimeout(timer); element.remove(); };
  if (actionLabel && onAction) {
    element.querySelector('button').addEventListener('click', () => { close(); onAction(); });
  }

  container.appendChild(element);
  const timer = setTimeout(close, timeout);
  return close;
}

/** Avís d'error amb més temps en pantalla. */
export function toastError(message) {
  return toast(message, { type: 'danger', timeout: 7000 });
}
