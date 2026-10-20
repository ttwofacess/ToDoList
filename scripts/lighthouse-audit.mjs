// ============================================================
// lighthouse-audit.mjs — Auditoría Lighthouse de la app
//
// Corre Lighthouse sobre los cuatro combos (móvil/escritorio × claro/oscuro)
// y deja un resumen con las puntuaciones y las métricas clave.
//
// Uso:  node scripts/lighthouse-audit.mjs [etiqueta]
//   - APP_URL:      base de la app (por defecto http://localhost:4173)
//   - CHROME_PATH:  Chrome/Chromium a usar (por defecto el de Playwright)
//   - LH_OUT:       carpeta de los informes (por defecto /tmp/opencode/lh)
//
// El tema oscuro se fuerza con el flag de Blink
// `--blink-settings=preferredColorScheme=0`: la app arranca en 'auto', así
// que respeta la preferencia del sistema sin tocar el código.
//
// Lighthouse se baja con `pnpm dlx` (no se agrega como dependencia).
// ============================================================

import { spawn } from 'node:child_process';
import fs   from 'node:fs/promises';
import os   from 'node:os';
import path from 'node:path';

const LABEL   = process.argv[2] || 'audit';
const BASE    = process.env.APP_URL || 'http://localhost:4173';
const OUT_DIR = process.env.LH_OUT || path.join(os.tmpdir(), 'opencode', 'lh');
const CHROME  = process.env.CHROME_PATH ||
  path.join(os.homedir(), '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome');

const DARK_FLAG = '--blink-settings=preferredColorScheme=0';
const BASE_FLAGS = `--headless=new --no-sandbox --disable-dev-shm-usage`;

const COMBOS = [
  { name: 'mobile-light',  dark: false, desktop: false },
  { name: 'mobile-dark',   dark: true,  desktop: false },
  { name: 'desktop-light', dark: false, desktop: true  },
  { name: 'desktop-dark',  dark: true,  desktop: true  },
];

const run = (args) => new Promise((resolve) => {
  // Lighthouse necesita el Chrome en CHROME_PATH.
  const child = spawn('pnpm', ['dlx', 'lighthouse', ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CHROME_PATH: CHROME },
  });
  let out = '';
  child.stdout.on('data', d => (out += d));
  child.stderr.on('data', d => (out += d));
  child.on('close', code => resolve({ code, out }));
});

await fs.access(CHROME).catch(() => {
  console.error(`No se encuentra el Chrome en ${CHROME}. Seteá CHROME_PATH.`);
  process.exit(1);
});

await fs.mkdir(OUT_DIR, { recursive: true });

const reports = [];
for (const combo of COMBOS) {
  const file = path.join(OUT_DIR, `${LABEL}-${combo.name}.json`);
  const flags = [BASE_FLAGS, combo.dark ? DARK_FLAG : ''].filter(Boolean).join(' ');
  const args = [
    `${BASE}/index.html`,
    '--output=json',
    `--output-path=${file}`,
    `--chrome-flags=${flags}`,
    '--quiet',
    ...(combo.desktop ? ['--preset=desktop'] : []),
  ];

  process.stdout.write(`[lh] ${combo.name}... `);
  const { code } = await run(args);
  if (code !== 0) {
    console.log('ERROR');
    continue;
  }
  reports.push({ name: combo.name, data: JSON.parse(await fs.readFile(file, 'utf8')) });
  console.log('ok');
}

const score = (r, cat) => Math.round(r.categories[cat].score * 100);
const value = (r, id) => r.audits[id]?.numericValue;

console.log('');
console.log('combo            perf  a11y   bp  seo |    FCP     LCP     TBT     CLS');
for (const { name, data } of reports) {
  console.log(
    name.padEnd(16),
    String(score(data, 'performance')).padStart(4),
    String(score(data, 'accessibility')).padStart(5),
    String(score(data, 'best-practices')).padStart(4),
    String(score(data, 'seo')).padStart(4), '|',
    `${(value(data, 'first-contentful-paint') / 1000).toFixed(2)}s`.padStart(7),
    `${(value(data, 'largest-contentful-paint') / 1000).toFixed(2)}s`.padStart(7),
    `${value(data, 'total-blocking-time').toFixed(0)}ms`.padStart(7),
    value(data, 'cumulative-layout-shift').toFixed(3).padStart(7),
  );
}
console.log('');
console.log(`Informes en ${OUT_DIR}`);
