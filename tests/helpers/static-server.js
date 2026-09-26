// ============================================================
// Servidor estático mínimo para los tests de integración (PWA).
// Debe servir por HTTP en localhost para que el Service Worker
// sea permitido (SW requiere HTTPS o localhost).
// ============================================================

import http from 'node:http';
import fs   from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT    = Number(process.env.PORT || 4173);

const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.js':    'text/javascript; charset=utf-8',
  '.mjs':   'text/javascript; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.json':  'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg':   'image/svg+xml',
  '.png':   'image/png',
  '.ico':   'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    // Decodifica %20 y similar, y bloquea path traversal fuera del root
    const decoded = decodeURIComponent(url.pathname);
    let filePath  = path.join(ROOT, decoded);

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let stat = await fs.stat(filePath).catch(() => null);

    // Directorio o "/" → index.html
    if (stat?.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = await fs.stat(filePath).catch(() => null);
    }

    if (!stat) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not Found');
      return;
    }

    const body = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      // Sin cache: evita que el SW sirva respuestas viejas entre tests
      'Cache-Control': 'no-store',
      // Requerido para que navigator.serviceWorker funcione en localhost
      'Service-Worker-Allowed': '/',
    }).end(body);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`[static-server] sirviendo ${ROOT} en http://localhost:${PORT}`);
});
