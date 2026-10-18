// ============================================================
// scripts/lint.js — Chequeo básico del proyecto, sin dependencias.
// Detecta patrones que no deberían llegar a un commit:
//   - var (el repo usa const/let)
//   - console.log/debug en código de la app (js/ y sw.js)
//   - debugger olvidado
//   - trailing whitespace y falta de newline final (js, css, html)
//   - <html> sin lang
// Salida: archivo:linea + mensaje. Exit 1 si hay hallazgos.

// Nota: las reglas que más facil se autodetectan se arman con concat
// ('debug' + 'ger') para que revisar su propio archivo no dé falso postivo
// por el literal de la regla mismo.
// ============================================================

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const collect = (entry, acc = []) => {
    const abs = path.resolve(ROOT, entry);
    if (fs.statSync(abs).isDirectory()) {
        for (const name of fs.readdirSync(abs)) {
            if (name === 'node_modules' || name === 'test-results') continue;
            collect(path.join(abs, name), acc);
        }
    } else if (/\.(js|css|html)$/.test(abs)) {
        acc.push(abs);
    }
    return acc;
};

// Código que se publica (app) vs auxiliar (tests, tooling, HTML shell).
// console.log sólo se castiga en lo que se publica.
const files = {
    app:       [...collect('js'), ...collect('sw.js')],
    auxiliary: [...collect('tests'), ...collect('scripts'), ...collect('index.html')],
};

const findings = [];
const report = (file, line, message) =>
    findings.push(`${path.relative(ROOT, file)}:${line}: ${message}`);

// Comentarios puros ignorados: los falso-positivos de ejemplo ("// no usar
// var ...") ensucian la salida.
const isPureComment = (trimmed) =>
    trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');

const RULES_ALL = [
    { re: new RegExp(`\\b${'var'}\\s+[A-Za-z_$]`), msg: 'declara con "var"; el repo usa const/let' },
    { re: new RegExp(`\\b${'debug'}${'ger'}\\b`),  msg: 'deja un punto de depuración en el código' },
];

const RULE_APP = [
    { re: new RegExp(`\\b${'console'}\\.(?:log|debug)\\(`), msg: 'usa console.log/debug; en la app se permite console.error/warn' },
];

for (const file of [...files.app, ...files.auxiliary]) {
    const isApp = files.app.includes(file);
    const lines = fs.readFileSync(file, 'utf8').split('\n');

    lines.forEach((line, i) => {
        if (/\s$/.test(line)) report(file, i + 1, 'whitespace al final de la linea');
        if (!file.endsWith('.js') || isPureComment(line.trim())) return;

        for (const { re, msg } of [...RULES_ALL, ...(isApp ? RULE_APP : [])]) {
            if (re.test(line)) report(file, i + 1, msg);
        }
    });

    if (lines.length > 1 && lines[lines.length - 1] !== '') {
        report(file, lines.length, 'sin newline final');
    }
}

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
if (!/<html[^>]*\slang=/.test(html)) {
    report(path.join(ROOT, 'index.html'), 1, '<html> sin atributo lang');
}

if (findings.length) {
    for (const f of findings) console.log(f);
    console.error(`\nLint fallo: ${findings.length} hallazgo(s).`);
    process.exit(1);
}

console.log(`Lint OK — ${files.app.length + files.auxiliary.length} archivos revisados.`);
