/**
 * main.js - arrencada de l'aplicació.
 * Ordre: recuperació del magatzem (amb desbloqueig si cal), idioma i tema,
 * capa d'interfície, encaminament i registre del service worker.
 */
import * as store from './core/store.js';
import * as persist from './core/persist.js';
import * as vault from './core/crypto.js';
import { migrate, defaultState } from './domain/schema.js';
import { setLang, detectLang, t } from './core/i18n.js';
import { initShell, render, applyTheme, checkReminders } from './ui/shell.js';
import { startRouter } from './ui/router.js';
import { toastError } from './ui/components/toast.js';

const boot = document.getElementById('boot');
const bootMessage = document.getElementById('boot-msg');

/** Demana la contrasenya de desbloqueig fins que sigui correcta o es cancel·li. */
function requestPassword(envelope) {
  return new Promise((resolve, reject) => {
    boot.innerHTML = `
      <form class="boot__inner" id="unlock-form" style="width:min(92vw,320px)">
        <p class="boot__mark">Rumb</p>
        <p class="boot__msg" id="unlock-msg">Introduïu la contrasenya per obrir les dades.</p>
        <input class="input" type="password" id="unlock-pw" autocomplete="current-password" required autofocus
          style="margin-top:12px" aria-label="Contrasenya">
        <button class="btn btn--primary btn--block" type="submit" style="margin-top:8px">Desbloqueja</button>
      </form>`;

    const form = document.getElementById('unlock-form');
    const input = document.getElementById('unlock-pw');
    const message = document.getElementById('unlock-msg');
    let attempts = 0;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const text = await vault.unlockWith(input.value, envelope);
        resolve(text);
      } catch {
        attempts += 1;
        message.textContent = 'Contrasenya incorrecta.';
        message.style.color = 'var(--danger)';
        input.value = '';
        input.focus();
        if (attempts >= 8) reject(new Error('massa intents'));
      }
    });

    setTimeout(() => input.focus(), 50);
  });
}

async function loadState() {
  try {
    const raw = await persist.load({ requestPassword });
    if (!raw) return defaultState();
    return migrate(raw);
  } catch (error) {
    if (error.message === 'locked') throw error;
    console.warn('No s’ha pogut recuperar el magatzem:', error);
    toastError('No s’han pogut recuperar les dades desades. Es continua amb un magatzem buit.');
    return defaultState();
  }
}

async function start() {
  let state;
  try {
    state = await loadState();
  } catch {
    bootMessage.textContent = 'No s’han pogut desxifrar les dades.';
    return;
  }

  // Idioma: la configuració desada mana; si no n'hi ha, el del navegador.
  setLang(state.settings.lang || detectLang());
  applyTheme(state.settings.theme);

  store.setState(state, { save: false });
  initShell();
  startRouter();
  render();

  boot.remove();
  document.getElementById('app').hidden = false;

  // Recordatoris de cites i de còpia de seguretat, un cop la vista és visible.
  setTimeout(checkReminders, 800);
  setInterval(checkReminders, 5 * 60 * 1000);
}

/* --------------------------- Service worker i PWA ------------------------ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* la PWA és opcional */ });
  });
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  window.__seguimentInstall = async () => {
    event.prompt();
    await event.userChoice;
    window.__seguimentInstall = null;
  };
});

/* ------------------------------ Errors globals --------------------------- */

window.addEventListener('error', (event) => {
  console.error('Error no controlat:', event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('Promesa rebutjada:', event.reason);
});

start().catch((error) => {
  console.error(error);
  bootMessage.textContent = `${t('common.error')}: ${error.message}`;
});
