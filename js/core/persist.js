/**
 * persist.js - persistència a localStorage amb desat automàtic (debounce 500 ms),
 * indicador d'estat i suport per al magatzem xifrat.
 */
import { STORAGE_KEY } from '../domain/schema.js';
import { debounce } from './util.js';
import * as vault from './crypto.js';

const SAVE_DELAY = 500;

let encrypted = false;
const listeners = new Set();

/** Subscripció a l'estat del desat: 'idle' | 'saving' | 'saved' | 'error'. */
export function onSaveState(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(state, detail) {
  listeners.forEach((fn) => fn(state, detail));
}

/** Activa o desactiva el mode xifrat per als desats posteriors. */
export function setEncrypted(value) { encrypted = Boolean(value); }

/** Indica si el magatzem actual està xifrat. */
export function isEncrypted() { return encrypted; }

/** Llegeix el valor cru desat, sense desxifrar. */
export function readRaw() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Carrega l'estat. Si el magatzem és xifrat, cal proporcionar `unlock`,
 * una funció asíncrona que demana la contrasenya i retorna el text pla.
 */
export async function load({ requestPassword } = {}) {
  const raw = readRaw();
  if (!raw) return null;

  if (vault.isEnvelope(raw)) {
    encrypted = true;
    if (typeof requestPassword !== 'function') throw new Error('locked');
    const text = await requestPassword(raw);
    return JSON.parse(text);
  }

  encrypted = false;
  return raw;
}

/** Escriu l'estat immediatament. */
export async function saveNow(state) {
  emit('saving');
  try {
    const text = JSON.stringify(state);
    const payload = encrypted ? JSON.stringify(await vault.encryptText(text)) : text;
    localStorage.setItem(STORAGE_KEY, payload);
    emit('saved', { at: Date.now() });
    return true;
  } catch (error) {
    const quota = error && (error.name === 'QuotaExceededError' || error.code === 22);
    emit('error', { error, quota });
    return false;
  }
}

/** Desat automàtic amb agrupació de canvis successius. */
export const saveDebounced = debounce((state) => { saveNow(state); }, SAVE_DELAY);

/** Força el desat pendent (per exemple, en tancar la pestanya). */
export function flush(state) {
  if (saveDebounced.pending()) {
    saveDebounced.cancel();
    return saveNow(state);
  }
  return Promise.resolve(true);
}

/** Elimina completament el magatzem local. */
export function wipe() {
  try { localStorage.removeItem(STORAGE_KEY); return true; } catch { return false; }
}

/** Mida aproximada del magatzem en bytes. */
export function storageSize() {
  try { return (localStorage.getItem(STORAGE_KEY) || '').length; } catch { return 0; }
}
