// ============================================================
// sw.js — Service Worker: caché offline del app shell
// ============================================================

const CACHE_VERSION = 'v1';                 // ← subir al cambiar archivos precacheados
const CACHE_NAME = `todolist-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',

  // Estilos
  './styles/base.css',
  './styles/layout.css',
  './styles/header.css',
  './styles/forms.css',
  './styles/buttons.css',
  './styles/tasks.css',
  './styles/task-priority.css',
  './styles/subtasks.css',
  './styles/modals.css',
  './styles/action-modal.css',
  './styles/edit-modal.css',
  './styles/donate-modal.css',
  './styles/filter.css',
  './styles/animations.css',

  // Scripts
  './js/main.js',
  './js/i18n.js',
  './js/dateUtils.js',
  './js/storage.js',
  './js/taskManager.js',
  './js/taskRenderer.js',
  './js/taskActions.js',
  './js/modalManager.js',
  './js/dragDrop.js',
  './js/importExport.js',
  './js/pwa.js',
  './assets/vendor/purify.min.js',

  // Fuentes
  './assets/fonts/poppins-v24-latin-500.woff2',
  './assets/fonts/poppins-v24-latin-700.woff2',
  './assets/fonts/roboto-v50-latin-regular.woff2',
  './assets/fonts/roboto-v50-latin-500.woff2',

  // Íconos
  './assets/favicon.svg',
  './assets/favicon.ico',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
];

// 1) Instalación: precachear todo el app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// 2) Activación: borrar cachés de versiones anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('todolist-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// 3) Fetch: cache-first + revalidación en segundo plano (solo GET del mismo origen)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      // Navegación sin red y sin caché → devolver index.html
      return cached || network.then((r) => r || caches.match('./index.html'));
    })
  );
});
