/**
 * store.js - magatzem d'estat centralitzat.
 * Tota modificació passa per `mutate`, que aplica el canvi, dispara el desat
 * automàtic i notifica els subscriptors. El renderitzat mai modifica l'estat
 * directament.
 */
import { defaultState } from '../domain/schema.js';
import * as persist from './persist.js';
import { nowStamp } from './dates.js';

let state = defaultState();
let revision = 0;
let dirty = false;
const subscribers = new Set();
let notifyScheduled = false;

/** Substitueix l'estat sencer (càrrega inicial o importació). */
export function setState(next, { save = true } = {}) {
  state = next;
  revision += 1;
  if (save) persist.saveDebounced(state);
  notify();
}

/** Estat actual. No s'ha de modificar fora de `mutate`. */
export function getState() { return state; }

/** Configuració actual. */
export function settings() { return state.settings; }

/** Comptador de revisions, útil per invalidar memòries de càlcul. */
export function getRevision() { return revision; }

/** Subscripció als canvis d'estat. Retorna la funció per cancel·lar-la. */
export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function notify() {
  if (notifyScheduled) return;
  notifyScheduled = true;
  queueMicrotask(() => {
    notifyScheduled = false;
    subscribers.forEach((fn) => fn(state));
  });
}

/**
 * Aplica una modificació a l'estat.
 * @param {(draft: object) => (object|void)} mutator Funció que modifica l'estat.
 * @param {object} [options]
 * @param {boolean} [options.save=true]    Desa al magatzem local.
 * @param {boolean} [options.silent=false] No notifica els subscriptors.
 */
export function mutate(mutator, options = {}) {
  const { save = true, silent = false } = options;
  const result = mutator(state);
  if (result && typeof result === 'object') state = result;

  state.updatedAt = nowStamp();
  revision += 1;

  if (save) {
    if (state.settings.autosave === false) dirty = true;
    else { dirty = false; persist.saveDebounced(state); }
  }
  if (!silent) notify();
  return state;
}

/** Hi ha canvis sense desar (només possible amb el desat automàtic desactivat). */
export function isDirty() { return dirty; }

/** Desa immediatament i marca l'estat com a net. */
export async function saveNow() {
  const ok = await persist.saveNow(state);
  if (ok) dirty = false;
  return ok;
}

/**
 * Modifica la configuració amb una fusió superficial per seccions.
 * Amb `silent` el canvi es desa però no provoca cap repintat: és el que
 * s'utilitza mentre s'escriu en un camp, per no perdre'n el focus.
 */
export function patchSettings(patch, options = {}) {
  return mutate((draft) => {
    Object.entries(patch).forEach(([key, value]) => {
      const current = draft.settings[key];
      if (current && typeof current === 'object' && !Array.isArray(current) && value && typeof value === 'object' && !Array.isArray(value)) {
        draft.settings[key] = { ...current, ...value };
      } else {
        draft.settings[key] = value;
      }
    });
  }, options);
}

/** Cerca una entitat per identificador dins d'una col·lecció. */
export function find(collection, id) {
  if (!id) return null;
  return state[collection]?.find((x) => x.id === id) || null;
}

/** Entitats vives d'una col·lecció (exclou les anul·lades). */
export function live(collection) {
  return (state[collection] || []).filter((x) => !x.annulled);
}

/** Força el desat pendent. */
export function flush() { return persist.flush(state); }
