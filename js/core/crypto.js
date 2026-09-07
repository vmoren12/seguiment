/**
 * crypto.js - xifratge opcional del magatzem local amb AES-GCM i PBKDF2.
 * Només s'utilitza si l'usuari activa el bloqueig amb contrasenya. La clau
 * derivada viu en memòria mentre la sessió és oberta i no es desa mai.
 */

const PBKDF2_ITERATIONS = 250000;
const enc = new TextEncoder();
const dec = new TextDecoder();

let sessionKey = null;
let sessionSalt = null;

/** Indica si hi ha una clau activa en memòria. */
export function isUnlocked() { return sessionKey !== null; }

/** Oblida la clau en memòria (bloqueja la sessió). */
export function lock() { sessionKey = null; sessionSalt = null; }

function toB64(buffer) {
  const bytes = new Uint8Array(buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(text) {
  const s = atob(text);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) bytes[i] = s.charCodeAt(i);
  return bytes;
}

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Prepara una clau nova a partir d'una contrasenya (activació del bloqueig). */
export async function setPassword(password) {
  sessionSalt = crypto.getRandomValues(new Uint8Array(16));
  sessionKey = await deriveKey(password, sessionSalt);
}

/** Intenta obrir un sobre xifrat amb la contrasenya indicada. */
export async function unlockWith(password, envelope) {
  const salt = fromB64(envelope.salt);
  const key = await deriveKey(password, salt);
  const iv = fromB64(envelope.iv);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, fromB64(envelope.data));
  sessionKey = key;
  sessionSalt = salt;
  return dec.decode(plain);
}

/** Xifra un text amb la clau de sessió i retorna el sobre serialitzable. */
export async function encryptText(text) {
  if (!sessionKey || !sessionSalt) throw new Error('No hi ha cap clau activa');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sessionKey, enc.encode(text));
  return {
    enc: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: toB64(sessionSalt),
    iv: toB64(iv),
    data: toB64(data),
  };
}

/** Comprova si un valor desat és un sobre xifrat. */
export function isEnvelope(value) {
  return Boolean(value && typeof value === 'object' && value.enc === 'AES-GCM' && value.data && value.iv && value.salt);
}

/** El navegador admet l'API de criptografia necessària. */
export function isSupported() {
  return Boolean(globalThis.crypto?.subtle && globalThis.isSecureContext !== false);
}
