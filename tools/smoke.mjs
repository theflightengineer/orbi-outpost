// Headless browser smoke test (dev only). Needs Chrome/Edge + Node 22 (global WebSocket).
//   node tools/smoke.mjs "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:8080/ ./shots
// Plays through the main screens on a phone-sized viewport, records console errors, uncaught exceptions
// and any request that leaves the site, and saves screenshots.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [chrome, base = 'http://localhost:8080/', outDir = './shots'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'orbi-smoke-'));
const port = 9333;
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let ws, id = 0; const pending = new Map(); const problems = []; const external = new Set(); const logs = [];
async function connect() {
  for (let i = 0; i < 40; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const pg = list.find(x => x.type === 'page'); if (pg) return pg.webSocketDebuggerUrl; } catch { }
    await sleep(250);
  }
  throw new Error('no chrome');
}
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + expr); return r.result.value; };
const click = sel => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) throw new Error('missing '+${JSON.stringify(sel)}); e.click(); return true})()`);
const has = sel => evaluate(`!!document.querySelector(${JSON.stringify(sel)})`);
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(r.data, 'base64'));
}
async function full(name) {
  const h = await evaluate('document.documentElement.scrollHeight');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: Math.min(h, 4000), deviceScaleFactor: 1, mobile: true });
  await sleep(300); await shot(name);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
}

try {
  ws = new WebSocket(await connect());
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', m => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); return; }
    if (msg.method === 'Runtime.exceptionThrown') problems.push('EXCEPTION ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) problems.push(`CONSOLE.${msg.params.type} ` + msg.params.args.map(a => a.value ?? a.description).join(' '));
    if (msg.method === 'Log.entryAdded' && ['error', 'warning'].includes(msg.params.entry.level)) problems.push(`LOG.${msg.params.entry.level} ${msg.params.entry.text} ${msg.params.entry.url || ''}`);
    if (msg.method === 'Network.requestWillBeSent') { const u = msg.params.request.url; if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) external.add(u); }
  });
  await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: base });
  await sleep(1500);
  await shot('01-home');
  logs.push('home ok: ' + await has('.title-screen'));

  // tutorial
  await click('[data-act="tutorial"]'); await sleep(500);
  await shot('02-tutorial-1');
  for (let i = 0; i < 4; i++) { await click('[data-act="tutNext"]'); await sleep(250); }
  await shot('03-tutorial-shield');
  await click('[data-act="tutSkip"]'); await sleep(200);
  await full('04-game-moon-cadet');
  // play tutorial mission to the end
  for (let d = 0; d < 8 && await has('#endDay'); d++) {
    await click('[data-act="plus"][data-k="shield"]').catch(() => {});
    await click('#endDay'); await sleep(1900);
    if (d === 2) await shot('05-day-report');
    await click('[data-act="closeReport"]'); await sleep(350);
  }
  await full('06-debrief-tutorial');
  logs.push('debrief ok: ' + await has('.debrief') + ' canvas: ' + await has('#chart'));

  // new Mars commander mission, do nothing -> lose -> debrief
  await click('[data-act="new"]'); await sleep(300);
  await click('[data-field="site"][data-value="mars"]'); await sleep(200);
  await click('[data-field="difficulty"][data-value="commander"]'); await sleep(200);
  await full('07-setup-mars');
  await click('[data-act="start"]'); await sleep(400);
  await click('[data-act="minus"][data-k="lifeSupport"]').catch(() => {});
  await full('08-game-mars');
  for (let d = 0; d < 40 && await has('#endDay'); d++) {
    await click('#endDay'); await sleep(d < 2 ? 1800 : 1700);
    await click('[data-act="closeReport"]'); await sleep(300);
  }
  await full('09-debrief-lose');
  logs.push('lose debrief chain items: ' + await evaluate('document.querySelectorAll(".chain li").length'));

  // today's mission
  await click('[data-act="home"]'); await sleep(300);
  await click('[data-act="today"]'); await sleep(500);
  await full('10-today');
  logs.push('today featured: ' + await evaluate('document.querySelector(".featured")?.innerText.slice(0,140)'));

  // pages
  for (const v of ['credits', 'glossary', 'classroom', 'settings', 'scores']) {
    await click('[data-act="home"]'); await sleep(200);
    await evaluate(`(()=>{const b=document.querySelector('[data-view="${v}"]'); b.click(); return 1})()`); await sleep(300);
    await full('11-' + v);
  }
  // Portuguese + high contrast
  await click('[data-act="lang"]'); await sleep(600);
  await click('[data-act="home"]'); await sleep(300);
  await shot('12-home-pt');
  await click('[data-act="daily"]'); await sleep(300); await click('[data-act="start"]'); await sleep(400);
  await evaluate(`document.documentElement.classList.add('contrast')`); await sleep(200);
  await full('13-game-pt-contrast');
  // tablet layout
  await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false });
  await sleep(300); await shot('14-tablet');
  const overflow = await evaluate('document.documentElement.scrollWidth > window.innerWidth');
  logs.push('horizontal overflow at 1024: ' + overflow);
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 1, mobile: true });
  await sleep(300);
  logs.push('horizontal overflow at 360: ' + await evaluate('document.documentElement.scrollWidth > window.innerWidth'));
} catch (e) {
  problems.push('SMOKE FAILURE ' + e.message);
} finally {
  console.log(logs.join('\n'));
  console.log('\nPROBLEMS (' + problems.length + '):\n' + problems.join('\n'));
  console.log('\nEXTERNAL REQUESTS (' + external.size + '):\n' + [...external].join('\n'));
  try { ws && ws.close(); } catch { }
  proc.kill();
  setTimeout(() => process.exit(0), 300);
}
