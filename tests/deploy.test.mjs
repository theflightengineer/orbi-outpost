// Static deploy checks: nothing external is LOADED, every runtime file is precached by the service worker,
// and every referenced path matches a real file with the exact same letter case (InfinityFree is Linux = case-sensitive).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const walk = dir => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name).replace(/\\/g, '/')]);
/** true only if the path exists with exactly this case, segment by segment */
function existsExactCase(rel) {
  let cur = ROOT;
  for (const seg of rel.split('/').filter(Boolean)) {
    if (!fs.existsSync(cur) || !fs.statSync(cur).isDirectory() || !fs.readdirSync(cur).includes(seg)) return false;
    cur = path.join(cur, seg);
  }
  return true;
}
const CODE = ['index.html', 'manifest.webmanifest', 'sw.js', ...walk('css'), ...walk('js')];
// files the game needs at runtime (what gets uploaded, minus server-only files)
const RUNTIME = ['index.html', 'manifest.webmanifest', ...walk('css'), ...walk('js'), ...walk('i18n'), ...walk('fonts').filter(f => f.endsWith('.woff2')),
  ...walk('img'), ...walk('data').filter(f => f.endsWith('.json'))];

test('no external resource is loaded by the game (scripts, styles, fonts, images, fetch, @import)', () => {
  const bad = [];
  for (const f of CODE) {
    const src = read(f);
    const patterns = [
      /<script[^>]+src=["']https?:/gi, /<link[^>]+href=["']https?:/gi, /<img[^>]+src=["']https?:/gi,
      /@import/gi, /url\(\s*["']?https?:/gi, /fetch\(\s*[`'"]https?:/gi, /fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|unpkg\.com|cdnjs/gi,
      /new\s+(WebSocket|EventSource)\(/g, /importScripts\(/g, /import\s[^;]*from\s+['"]https?:/g
    ];
    for (const p of patterns) for (const m of src.matchAll(p)) bad.push(`${f}: ${m[0]}`);
  }
  assert.deepEqual(bad, []);
});

test('external URLs in code are only clickable links (<a href>), never loaded', () => {
  const offenders = [];
  for (const f of CODE.filter(f => f.endsWith('.js') || f.endsWith('.html'))) {
    for (const line of read(f).split('\n')) {
      if (!/https?:\/\//.test(line)) continue;
      if (/<a\s[^>]*href=["']https?:/.test(line) || /^\s*(\/\/|\*)/.test(line) || /xmlns=/.test(line)) continue;
      offenders.push(`${f}: ${line.trim().slice(0, 120)}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('fonts are self-hosted: every @font-face points at a vendored woff2 that exists', () => {
  const css = read('css/style.css');
  const urls = [...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m => m[1]);
  assert.ok(urls.length >= 3);
  for (const u of urls) { assert.ok(!/^https?:/.test(u), u); assert.ok(existsExactCase(path.posix.normalize('css/' + u)), u); }
  assert.ok(existsExactCase('fonts/OFL-LilitaOne.txt') && existsExactCase('fonts/OFL-AtkinsonHyperlegible.txt'), 'font licences shipped');
});

test('service worker precaches every runtime file, and every precached path exists (exact case)', () => {
  const sw = read('sw.js');
  const list = JSON.parse('[' + /const ASSETS = \[([\s\S]*?)\];/.exec(sw)[1].replace(/'/g, '"').replace(/,\s*$/, '') + ']');
  const missingOnDisk = list.filter(a => a !== './' && !existsExactCase(a));
  const notPrecached = RUNTIME.filter(f => !list.includes(f));
  assert.deepEqual(missingOnDisk, [], 'precached but missing');
  assert.deepEqual(notPrecached, [], 'runtime file not precached');
  assert.match(sw, /const VERSION = 'orbi-v\d+\.\d+\.\d+'/);
});

test('all referenced paths are relative and match real files with exact case', () => {
  const refs = new Set();
  const html = read('index.html');
  for (const m of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) refs.add(m[1]);
  for (const f of walk('js')) {
    const src = read(f);
    for (const m of src.matchAll(/import[^'"]*['"](\.[^'"]+)['"]/g)) refs.add(path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])));
    for (const m of src.matchAll(/fetch\(\s*[`'"]([a-z0-9_\-/.]+\.json)[`'"]/gi)) refs.add(m[1]);
    for (const m of src.matchAll(/[`'"](i18n|data)\/\$\{[^}]+\}\.json/g)) { /* dynamic: checked through sw list */ }
  }
  for (const im of JSON.parse(read('data/imagery.json')).images.filter(i => i.file)) refs.add(im.file);
  const man = JSON.parse(read('manifest.webmanifest'));
  for (const i of man.icons) refs.add(i.src);
  const absolute = [...refs].filter(r => r.startsWith('/'));
  const broken = [...refs].filter(r => !r.startsWith('/') && !existsExactCase(r.replace(/^\.\//, '')));
  assert.deepEqual(absolute, [], 'absolute paths break when the site is not at the domain root');
  assert.deepEqual(broken, []);
  // code must not use absolute URLs like fetch('/data/..') either
  for (const f of CODE) assert.ok(!/(fetch|register)\(\s*['"`]\//.test(read(f)), f + ' uses an absolute path');
});

test('deployable size stays small (< 5 MB)', () => {
  const files = [...RUNTIME, 'sw.js', '.htaccess', ...walk('api')];
  const bytes = files.reduce((t, f) => t + fs.statSync(path.join(ROOT, f)).size, 0);
  assert.ok(bytes < 5 * 1024 * 1024, `${bytes} bytes`);
});
