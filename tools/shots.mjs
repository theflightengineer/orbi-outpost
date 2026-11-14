// Capture the same key screens at phone and desktop size (dev only), for before/after design reviews.
//   node tools/shots.mjs "<chrome.exe>" http://localhost:8080/ ./out
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [chrome, base = 'http://localhost:8080/', outDir = './shots'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const problems = [];

async function session(port) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'orbi-shots-'));
  const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--lang=en-US', 'about:blank'], { stdio: 'ignore' });
  let url;
  for (let i = 0; i < 40 && !url; i++) { try { url = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(x => x.type === 'page')?.webSocketDebuggerUrl; } catch { } await sleep(250); }
  const ws = new WebSocket(url); await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pending = new Map();
  ws.addEventListener('message', m => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); }
    if (msg.method === 'Runtime.exceptionThrown') problems.push('EXCEPTION ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') problems.push('console.error ' + msg.params.args.map(a => a.value ?? a.description).join(' '));
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') problems.push('LOG ' + msg.params.entry.text + ' ' + (msg.params.entry.url || ''));
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  return { send, close: () => { ws.close(); proc.kill(); } };
}

async function run(label, width, height, mobile) {
  const { send, close } = await session(mobile ? 9341 : 9342);
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ': ' + e); return r.result.value; };
  const click = s => ev(`(()=>{const e=document.querySelector(${JSON.stringify(s)}); if(!e) throw new Error('missing ${s.replace(/'/g, '')}'); e.click(); return 1})()`);
  const has = s => ev(`!!document.querySelector(${JSON.stringify(s)})`);
  const metrics = h => send('Emulation.setDeviceMetricsOverride', { width, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
  const shot = async (name, fullPage = false) => {
    if (fullPage) { const h = await ev('document.documentElement.scrollHeight'); await metrics(Math.min(h, 6000)); await sleep(500); }
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, `${label}-${name}.png`), Buffer.from(r.data, 'base64'));
    if (fullPage) { await metrics(height); await sleep(200); }
  };
  await metrics(height);
  await send('Page.navigate', { url: base }); await sleep(800);
  await ev(`localStorage.setItem('orbi-outpost:settings', JSON.stringify({lang:'en', sound:false})); localStorage.removeItem('orbi-outpost:current'); 1`);
  await send('Page.navigate', { url: base }); await sleep(1500);
  await shot('1-title');
  await click('[data-act="new"]'); await sleep(700);
  await shot('2-setup');
  // tutorial mission: storm arrives on day 3
  await click('[data-act="tutorial"]').catch(async () => { await click('[data-act="home"]'); await sleep(400); await click('[data-act="tutorial"]'); });
  await sleep(700);
  await click('[data-act="tutSkip"]'); await sleep(400);
  await click('[data-act="plus"][data-k="shield"]'); await sleep(200);
  await click('[data-act="toggle"][data-k="greenhouse"]').catch(() => {}); await sleep(400);
  await shot('3-game');
  await shot('3-game-full', true);
  for (let d = 1; d <= 3; d++) {
    await click('#endDay'); await sleep(d === 3 ? 900 : 2200);
    if (d === 3) { await shot('4-storm-hit'); await sleep(1800); await shot('5-report'); }
    await click('[data-act="closeReport"]'); await sleep(900);
    if (d < 3) { await click('[data-act="plus"][data-k="shield"]').catch(() => {}); await click('[data-act="toggle"][data-k="greenhouse"]').catch(() => {}); }
  }
  for (let d = 0; d < 5 && await has('#endDay'); d++) {
    await click('[data-act="toggle"][data-k="greenhouse"]').catch(() => {});
    await click('#endDay'); await sleep(2200); await click('[data-act="closeReport"]'); await sleep(900);
  }
  await sleep(1200);
  await shot('6-debrief-win');
  // losing mission (do nothing) on Mars
  await click('[data-act="new"]'); await sleep(500);
  await click('[data-field="site"][data-value="mars"]'); await sleep(300);
  await click('[data-act="start"]'); await sleep(700);
  await click('[data-act="minus"][data-k="lifeSupport"]').catch(() => {});
  await shot('7-game-mars');
  for (let d = 0; d < 20 && await has('#endDay'); d++) { await click('#endDay'); await sleep(2100); await click('[data-act="closeReport"]'); await sleep(800); }
  await sleep(1200);
  await shot('8-debrief-lose');
  await shot('8-debrief-lose-full', true);
  close();
}

try {
  await run('phone', 390, 844, true);
  await run('desktop', 1280, 800, false);
} catch (e) { problems.push('SHOTS FAILURE ' + e.message); }
console.log('PROBLEMS (' + problems.length + ')\n' + problems.join('\n'));
setTimeout(() => process.exit(0), 300);
