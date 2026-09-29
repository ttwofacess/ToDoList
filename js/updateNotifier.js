// ============================================================
// updateNotifier.js — Responsabilidad: detectar nueva versión
// del Service Worker y mostrar el toast de actualización.
// ============================================================

let refreshing = false;

const getToastEls = () => ({
    toast:  document.getElementById('updateToast'),
    reload: document.getElementById('updateReloadButton'),
});

const showToast = (registration) => {
    const { toast, reload } = getToastEls();
    if (!toast || !reload) return;

    toast.hidden = false;
    toast.classList.add('toast--visible');

    reload.onclick = () => {
        const waitingWorker = registration.waiting;
        if (waitingWorker) {
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        }
    };
};

/** Vincula el ciclo de vida del registration a la UI del toast. */
const watchRegistration = (registration) => {
    // Caso 1: ya había un SW esperando cuando cargó la página
    if (registration.waiting) showToast(registration);

    // Caso 2: se descubre un SW nuevo mientras la página está abierta
    registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
            // "installed" + ya existe un controller = había una versión previa
            // activa, así que esto es una ACTUALIZACIÓN (no la primera instalación)
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                showToast(registration);
            }
        });
    });
};

/**
 * Recargar automáticamente una única vez cuando un NUEVO SW toma el control.
 *
 * OJO: `controllerchange` también se dispara en la PRIMERA visita, cuando el
 * SW recién instalado hace `clients.claim()`. Ahí no hay nada que recargar: la
 * navegación inicial la sirvió la red, así que la página ya tiene los archivos
 * actuales. Recargar ahí solo wastea una descarga y puede abortar la
 * navegación o el click que el usuario tenía en curso.
 *
 * Por eso guardamos si la página ya estaba controlada ANTES de que el evento
 * ocurriera: sólo entonces el SW que toma el relevo es una versión nueva.
 */
const watchControllerChange = (wasControlledAtLoad) => {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!wasControlledAtLoad) return;  // primer control: no hay versión nueva
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });
};

/** Pide al servidor (vía fetch normal) si hay un sw.js más nuevo. */
const pollForUpdates = (registration) => {
    const check = () => registration.update().catch(() => {});

    // Al volver a la pestaña (usuario vuelve tras minutos/horas)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
    });

    // Cada 60 min mientras la pestaña sigue abierta
    setInterval(check, 60 * 60 * 1000);
};

export const initUpdateNotifier = () => {
    if (!('serviceWorker' in navigator)) return;

    // ¿La página ya estaba controlada por un SW al cargar? Si no, el
    // próximo `controllerchange` será el claim inicial y no debe recargar.
    const wasControlledAtLoad = !!navigator.serviceWorker.controller;

    navigator.serviceWorker.ready.then((registration) => {
        watchRegistration(registration);
        pollForUpdates(registration);
    });

    watchControllerChange(wasControlledAtLoad);
};
