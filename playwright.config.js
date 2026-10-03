import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// Navegadores disponibles. Se eligen con PW_PROJECTS=chromium,mobile-chrome,webkit
//
// Por defecto NO corremos webkit: sus binarios necesitan librerías del sistema
// (`sudo npx playwright install-deps webkit`), así que en una máquina sin ellas
// fallaría el arranque y tiraría la suite entera. Actívalo explícitamente con
// PW_PROJECTS=webkit una vez instaladas las dependencias.
const AVAILABLE = ['chromium', 'mobile-chrome', 'webkit'];
const selected = (process.env.PW_PROJECTS ?? 'chromium,mobile-chrome')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const unknown = selected.filter(p => !AVAILABLE.includes(p));
if (unknown.length) {
  throw new Error(`PW_PROJECTS: proyecto(s) desconocido(s): ${unknown.join(', ')}. Disponibles: ${AVAILABLE.join(', ')}`);
}

const PROJECTS = {
  chromium: {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], serviceWorkers: 'allow' },
  },
  // Emulación de móvil: viewport estrecho, touch y user agent de Android. Es
  // donde se rompen los layouts responsive y donde el usuario instala la PWA.
  // Usa el mismo binario que 'chromium', así que no requiere descargas extra.
  'mobile-chrome': {
    name: 'mobile-chrome',
    use: { ...devices['Pixel 7'], serviceWorkers: 'allow' },
  },
  // Safari / iOS: único motor donde se detectan los líos reales de PWA
  // (ciclo de vida del SW, safe areas, viewport-fit).
  webkit: {
    name: 'webkit',
    use: { ...devices['Desktop Safari'], serviceWorkers: 'allow' },
  },
};

export default defineConfig({
  testDir: './tests/integration',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-ES',
    timezoneId: 'UTC',
  },

  // El SW necesita un contexto seguro: localhost lo es (ver PROJECTS arriba).
  projects: selected.map(name => PROJECTS[name]),

  // Sirve el repo por HTTP para que la PWA funcione (SW, manifest, módulos ES)
  webServer: {
    command: `node tests/helpers/static-server.js`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
