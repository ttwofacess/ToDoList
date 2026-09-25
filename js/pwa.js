// ============================================================
// pwa.js — Responsabilidad: Service Worker + botón "Instalar"
// ============================================================

import { t } from './i18n.js';

let deferredPrompt = null;

const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;               // iOS

const isIOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1); // iPadOS

const showButton = (btn) => { btn.hidden = false; };
const hideButton = (btn) => { btn.hidden = true; };

/** Registra el Service Worker (solo en HTTPS o localhost). */
const registerServiceWorker = () => {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('./sw.js')
            .catch((err) => console.error('SW registration failed:', err));
    });
};

/** Lógica del botón Instalar. */
const initInstallButton = () => {
    const btn = document.getElementById('installButton');
    if (!btn) return;

    // Ya instalada / abierta como app → no mostrar nada
    if (isStandalone()) { hideButton(btn); return; }

    // Chrome / Edge / Samsung Internet / Opera (Android y escritorio)
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();          // evita el mini-infobar automático
        deferredPrompt = e;          // guardamos el evento para dispararlo con nuestro botón
        showButton(btn);
    });

    btn.addEventListener('click', async () => {
        // iOS: no existe prompt programático → mostrar instrucciones
        if (!deferredPrompt) {
            if (isIOS()) alert(t('installIosHint'));
            return;
        }
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;   // { outcome: 'accepted' | 'dismissed' }
        deferredPrompt = null;             // el evento solo se puede usar una vez
        hideButton(btn);
    });

    // Se instaló (por nuestro botón o por el menú del navegador)
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        hideButton(btn);
    });

    // Safari en iOS nunca dispara beforeinstallprompt: mostramos el botón con instrucciones
    if (isIOS()) showButton(btn);
};

export const initPWA = () => {
    registerServiceWorker();
    initInstallButton();
};
