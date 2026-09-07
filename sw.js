/**
 * sw.js - service worker: precàrrega de l'aplicació per treballar sense
 * connexió. Només s'hi guarden els fitxers de l'aplicació; cap dada personal
 * passa mai per la memòria cau, que viu al mateix dispositiu.
 */
const VERSION = 'seguiment-v1.0.0';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/icon.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'css/base.css',
  'css/layout.css',
  'css/components.css',
  'css/print.css',
  'js/main.js',
  'js/core/util.js',
  'js/core/dates.js',
  'js/core/i18n.js',
  'js/core/lang/ca.js',
  'js/core/lang/es.js',
  'js/core/store.js',
  'js/core/persist.js',
  'js/core/audit.js',
  'js/core/crypto.js',
  'js/core/export.js',
  'js/domain/schema.js',
  'js/domain/actions.js',
  'js/domain/selectors.js',
  'js/domain/stats.js',
  'js/domain/demo.js',
  'js/ui/dom.js',
  'js/ui/router.js',
  'js/ui/shell.js',
  'js/ui/editors.js',
  'js/ui/print.js',
  'js/ui/labels.js',
  'js/ui/components/modal.js',
  'js/ui/components/toast.js',
  'js/ui/components/form.js',
  'js/ui/components/charts.js',
  'js/ui/views/dashboard.js',
  'js/ui/views/agenda.js',
  'js/ui/views/students.js',
  'js/ui/views/student.js',
  'js/ui/views/tasks.js',
  'js/ui/views/compliance.js',
  'js/ui/views/casework.js',
  'js/ui/views/services.js',
  'js/ui/views/stats.js',
  'js/ui/views/audit.js',
  'js/ui/views/documents.js',
  'js/ui/views/settings.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegacions: xarxa primer amb retorn a la memòria cau si no hi ha connexió.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put('index.html', copy));
          return response;
        })
        .catch(() => caches.match('index.html').then((cached) => cached || caches.match('./'))),
    );
    return;
  }

  // Recursos estàtics: memòria cau primer, amb actualització en segon pla.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    }),
  );
});
