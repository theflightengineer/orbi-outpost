// Full browser verification (dev only). Chrome/Edge + Node 22.
//   node tools/check.mjs "<chrome.exe>" http://localhost:8080/ ./out
// For desktop / tablet / small-phone: plays title → tutorial → full Moon run → full Mars run → Today's mission →
// glossary/settings/classroom/credits/scores. Records console errors+warnings, exceptions, every network request,
// horizontal overflow, WCAG text contrast, touch-target sizes. Then an accessibility pass: reduced motion (OS setting and
// in-game toggle), high contrast, big text, keyboard-only play.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [chrome, base = 'http://localhost:8080/', outDir = './check'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const origin = new URL(base).origin;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = { viewports: {}, a11y: {} };

const A11Y_LIB = `window.__a11y = {
  parse(c){ const m=/rgba?\\(([^)]+)\\)/.exec(c); if(!m) return null; const p=m[1].split(/[\\s,/]+/).filter(Boolean).map(Number); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; },
  lum(c){ const f=v=>{v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4)}; return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); },
  blend(t,b){ const a=t.a; return {r:t.r*a+b.r*(1-a), g:t.g*a+b.g*(1-a), b:t.b*a+b.b*(1-a), a:1}; },
  bgOf(el){ const stack=[]; let e=el; while(e && e.nodeType===1){ const c=this.parse(getComputedStyle(e).backgroundColor); if(c && c.a>0){ stack.push(c); if(c.a>=1) break; } e=e.parentElement; }
    let b=this.parse(getComputedStyle(document.documentElement).backgroundColor) || {r:13,g:17,b:55,a:1}; if(b.a<1) b={r:13,g:17,b:55,a:1};
    for(let i=stack.length-1;i>=0;i--) b = stack[i].a>=1 ? stack[i] : this.blend(stack[i], b); return b; },
  contrast(){ const out=[]; let n=0;
    for(const e of document.querySelectorAll('body *')){
      if(!e.getClientRects().length || e.closest('svg,[disabled],[aria-hidden="true"],.skip')) continue;
      if(![...e.childNodes].some(x=>x.nodeType===3 && /[A-Za-z0-9À-ú]/.test(x.textContent))) continue;
      const cs=getComputedStyle(e); if(cs.visibility==='hidden' || parseFloat(cs.opacity)===0) continue;
      const bg=this.bgOf(e); let fg=this.parse(cs.color); if(fg.a<1) fg=this.blend(fg,bg);
      const L1=this.lum(fg), L2=this.lum(bg); const ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
      const size=parseFloat(cs.fontSize), bold=parseInt(cs.fontWeight)>=700 || /Lilita/.test(cs.fontFamily);
      const need=(size>=24 || (bold && size>=18.66)) ? 3 : 4.5; n++;
      if(ratio<need) out.push({text:e.textContent.trim().replace(/\\s+/g,' ').slice(0,40), ratio:+ratio.toFixed(2), need, fg:cs.color});
    } return {checked:n, fails:out}; },
  targets(){ return [...document.querySelectorAll('button,a,input,select,[role=switch]')].filter(e=>e.getClientRects().length && !e.closest('[aria-hidden="true"]'))
    .map(e=>{const r=e.getBoundingClientRect(); return {w:Math.round(r.width),h:Math.round(r.height), inline:e.matches('.term,.link,.skip') || (e.tagName==='A' && !e.classList.contains('btn')), t:(e.getAttribute('aria-label')||e.textContent||e.id).trim().replace(/\\s+/g,' ').slice(0,28)}})
    .filter(x=>!x.inline && (x.w<44 || x.h<44)); },
  overflow(){ const W=innerWidth; const off=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect(); return r.width && r.right>W+1 && !e.closest('.table-wrap,.title-sky,svg,.confetti,.porthole,.toast')}).slice(0,5).map(e=>e.tagName+'.'+(typeof e.className==='string'?e.className:'')); return {page: document.documentElement.scrollWidth>W, offenders:off}; },
  anims(){ return document.getAnimations().filter(a=>a.playState==='running').length; }
};1`;

async function session(port) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'orbi-check-'));
  const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', '--lang=en-US', 'about:blank'], { stdio: 'ignore' });
  let url;
  for (let i = 0; i < 40 && !url; i++) { try { url = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(x => x.type === 'page')?.webSocketDebuggerUrl; } catch { } await sleep(250); }
  const ws = new WebSocket(url); await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pending = new Map();
  const log = { console: [], requests: new Map() };
  ws.addEventListener('message', m => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); return; }
    const P = msg.params;
    if (msg.method === 'Runtime.exceptionThrown') log.console.push('EXCEPTION ' + (P.exceptionDetails.exception?.description || P.exceptionDetails.text));
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(P.type)) log.console.push(`console.${P.type}: ` + P.args.map(a => a.value ?? a.description).join(' '));
    if (msg.method === 'Log.entryAdded' && ['error', 'warning'].includes(P.entry.level)) log.console.push(`${P.entry.source}.${P.entry.level}: ${P.entry.text} ${P.entry.url || ''}`);
    if (msg.method === 'Network.requestWillBeSent') { const u = P.request.url.split('#')[0]; log.requests.set(u, (log.requests.get(u) || 0) + 1); }
    if (msg.method === 'Network.loadingFailed' && !P.canceled) log.console.push('NETWORK FAIL ' + P.errorText);
    if (msg.method === 'Network.responseReceived' && P.response.status >= 400) log.console.push(`HTTP ${P.response.status} ${P.response.url}`);
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable'); await send('Page.enable');
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const has = s => ev(`!!document.querySelector(${JSON.stringify(s)})`);
  const click = s => ev(`(()=>{const e=document.querySelector(${JSON.stringify(s)}); if(!e) throw new Error('missing ${s.replace(/'/g, '')}'); e.click(); return 1})()`);
  const waitFor = async (s, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await has(s)) return true; await sleep(80); } throw new Error('timeout waiting for ' + s); };
  // Enter must carry text '\r' so Chrome generates the keypress that activates a focused button (like a real keyboard)
  const key = async (k, code, vk, shift = false) => { const extra = k === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}; const modifiers = shift ? 8 : 0;
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers, ...extra }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers }); };
  const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(r.data, 'base64')); };
  const open = async (settings = { lang: 'en', sound: false }) => {
    await send('Page.navigate', { url: base }); await sleep(700);
    await ev(`localStorage.clear(); localStorage.setItem('orbi-outpost:settings', ${JSON.stringify(JSON.stringify(settings))}); 1`);
    await send('Page.navigate', { url: base }); await waitFor('.title-screen'); await sleep(300); await ev(A11Y_LIB);
  };
  return { send, ev, has, click, waitFor, key, shot, open, log, close: () => { ws.close(); proc.kill(); } };
}

/** in-page "sensible-ish" player: greenhouse on, shield before forecast storms, maintenance & comms now and then */
const PLAN_DAY = `(()=>{const q=s=>document.querySelector(s); const day=+((q('.day-badge b')||{}).textContent||1);
  const tap=s=>{const e=q(s); if(e && !e.disabled){e.click(); return true} return false};
  const gh=q('[data-k="greenhouse"][data-act="toggle"]'); if(gh && gh.getAttribute('aria-checked')==='false') gh.click();
  if(q('[data-k="greenhouse"][data-act="plus"]') && q('#act-greenhouse output').textContent==='0') tap('[data-k="greenhouse"][data-act="plus"]');
  const storm=[...document.querySelectorAll('.fc-list li')].some(l=>!l.classList.contains('clear') && l.textContent.includes('⚡'));
  const sh=+q('#act-shield output').textContent; if(storm && sh<2){tap('[data-k="shield"][data-act="plus"]'); tap('[data-k="shield"][data-act="plus"]');} if(!storm && sh>0) tap('[data-k="shield"][data-act="minus"]');
  const mt=+q('#act-maintenance output').textContent; if(day%4===0 && mt===0) tap('[data-k="maintenance"][data-act="plus"]'); if(day%4!==0 && mt>0) tap('[data-k="maintenance"][data-act="minus"]');
  const co=q('[data-k="comms"][data-act="toggle"]'); const want=day%3===0; if(co && (co.getAttribute('aria-checked')==='true')!==want) co.click();
  return day})()`;

async function playToEnd(S, label, maxDays = 40) {
  let days = 0;
  while (await S.has('#endDay') && days < maxDays) {
    await S.ev(PLAN_DAY);
    await S.click('#endDay'); await S.waitFor('.modal [data-act="closeReport"]');
    if (days === 2) await S.shot(`${label}-report`);
    await S.click('.modal [data-act="closeReport"]'); await S.waitFor('#endDay, .debrief'); await sleep(120);
    days++;
  }
  await S.waitFor('.debrief'); await sleep(600);
  return days;
}

async function screen(S, vp, name, extra) {
  await sleep(250);
  const o = await S.ev('__a11y.overflow()');
  const c = await S.ev('__a11y.contrast()');
  const t = await S.ev('__a11y.targets()');
  report.viewports[vp].screens[name] = { overflow: o.page, overflowOffenders: o.offenders, textChecked: c.checked, contrastFails: c.fails, smallTargets: t, ...extra };
  await S.shot(`${vp}-${name}`);
}

async function runViewport(vp, width, height, mobile, port) {
  report.viewports[vp] = { screens: {} };
  const S = await session(port);
  await S.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  if (mobile) await S.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await S.open();
  await screen(S, vp, 'title');
  // tutorial: every step, then the 5-day mission
  await S.click('[data-act="tutorial"]'); await S.waitFor('#tut');
  let steps = 1; while (await S.has('[data-act="tutNext"]')) { await S.click('[data-act="tutNext"]'); await sleep(120); steps++; if (steps > 15) break; }
  await screen(S, vp, 'game-tutorial', { tutorialSteps: steps - 1 });
  const tDays = await playToEnd(S, `${vp}-tutorial`);
  await screen(S, vp, 'debrief-tutorial', { days: tDays, result: await S.ev(`document.querySelector('.debrief-hero').className`) });
  // full Moon run (Cadet)
  await S.click('[data-act="new"]'); await S.waitFor('[data-act="start"]');
  await S.click('[data-field="site"][data-value="moon"]'); await S.click('[data-field="difficulty"][data-value="cadet"]');
  await screen(S, vp, 'setup');
  await S.click('[data-act="start"]'); await S.waitFor('#endDay');
  await screen(S, vp, 'game-moon');
  const mDays = await playToEnd(S, `${vp}-moon`);
  await screen(S, vp, 'debrief-moon', { days: mDays, result: await S.ev(`document.querySelector('.debrief-hero').className`) });
  // full Mars run (Explorer)
  await S.click('[data-act="new"]'); await S.waitFor('[data-act="start"]');
  await S.click('[data-field="site"][data-value="mars"]'); await S.click('[data-field="difficulty"][data-value="explorer"]');
  await S.click('[data-act="start"]'); await S.waitFor('#endDay');
  await screen(S, vp, 'game-mars');
  const sDays = await playToEnd(S, `${vp}-mars`);
  await screen(S, vp, 'debrief-mars', { days: sDays, result: await S.ev(`document.querySelector('.debrief-hero').className`) });
  // Today's mission: real event on day 3
  await S.click('[data-act="home"]'); await S.waitFor('.title-screen');
  await S.click('[data-act="today"]'); await S.waitFor('.featured');
  await screen(S, vp, 'today-setup', { featured: await S.ev(`document.querySelector('.featured').innerText.split('\\n').slice(0,3).join(' | ')`) });
  await S.click('[data-act="start"]'); await S.waitFor('#endDay');
  let stormCard = null;
  for (let d = 0; d < 3; d++) { await S.click('#endDay'); await S.waitFor('.modal [data-act="closeReport"]'); if (d === 2) { stormCard = await S.ev(`(()=>{const c=document.querySelector('.modal .card.storm'); return c? c.innerText.replace(/\\s+/g,' ').slice(0,160)+' || link: '+c.querySelector('a').href : null})()`); await screen(S, vp, 'today-storm-report'); } await S.click('.modal [data-act="closeReport"]'); await S.waitFor('#endDay'); }
  report.viewports[vp].todayStormCard = stormCard;
  // info pages
  for (const v of ['glossary', 'settings', 'classroom', 'credits', 'scores']) {
    await S.click('[data-act="home"]'); await S.waitFor('.title-screen');
    await S.click(`[data-act="view"][data-view="${v}"]`); await sleep(250);
    await screen(S, vp, v);
  }
  report.viewports[vp].console = S.log.console;
  report.viewports[vp].requests = [...S.log.requests.entries()];
  S.close();
}

async function a11yPass(port) {
  const S = await session(port);
  await S.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  const A = report.a11y;
  // baseline: motion is normally running (proves the counter works)
  await S.open();
  A.animationsTitleNormal = await S.ev('__a11y.anims()');
  // 1) OS-level reduced motion
  await S.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await S.open();
  A.reduceClassFromOS = await S.ev(`document.documentElement.classList.contains('reduce-motion')`);
  A.animationsTitleReduced = await S.ev('__a11y.anims()');
  await S.click('[data-act="tutorial"]'); await S.waitFor('#tut'); await S.click('[data-act="tutSkip"]');
  for (let d = 0; d < 3; d++) {
    await S.click('#endDay'); await sleep(60);
    if (d === 2) A.animationsDuringStormReduced = await S.ev('__a11y.anims()');
    await S.waitFor('.modal [data-act="closeReport"]'); await S.click('.modal [data-act="closeReport"]'); await S.waitFor('#endDay');
  }
  A.animationsGameReduced = await S.ev('__a11y.anims()');
  // 2) in-game "Reduce motion" toggle without the OS setting
  await S.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await S.open();
  await S.click('[data-act="view"][data-view="settings"]'); await S.waitFor('[data-key="reducedMotion"]');
  await S.click('[data-key="reducedMotion"]'); await sleep(200);
  A.reduceToggleChecked = await S.ev(`document.querySelector('[data-key="reducedMotion"]').getAttribute('aria-checked')`);
  await S.click('[data-act="home"]'); await S.waitFor('.title-screen'); await sleep(200);
  A.animationsTitleToggle = await S.ev('__a11y.anims()');
  // 3) high contrast
  await S.open();
  await S.click('[data-act="view"][data-view="settings"]'); await S.waitFor('[data-key="contrast"]'); await S.click('[data-key="contrast"]'); await sleep(200);
  A.contrastClass = await S.ev(`document.documentElement.classList.contains('contrast')`);
  A.contrastBodyBg = await S.ev(`getComputedStyle(document.body).backgroundColor`);
  await S.click('[data-act="new"]').catch(async () => { await S.click('[data-act="home"]'); await S.waitFor('.title-screen'); await S.click('[data-act="new"]'); });
  await S.waitFor('[data-act="start"]'); await S.click('[data-act="start"]'); await S.waitFor('#endDay'); await sleep(300);
  A.contrastGame = await S.ev('__a11y.contrast()');
  A.contrastOverflow = await S.ev('__a11y.overflow()');
  await S.shot('a11y-high-contrast-game');
  // 4) big text on the smallest phone: every main screen must still fit
  await S.open({ lang: 'en', sound: false, bigText: true });
  A.bigText = {};
  A.bigText.title = await S.ev('__a11y.overflow()');
  await S.click('[data-act="new"]'); await S.waitFor('[data-act="start"]'); A.bigText.setup = await S.ev('__a11y.overflow()');
  await S.click('[data-act="start"]'); await S.waitFor('#endDay'); await sleep(300); A.bigText.game = await S.ev('__a11y.overflow()'); await S.shot('a11y-big-text-game');
  await S.click('#endDay'); await S.waitFor('.modal [data-act="closeReport"]'); A.bigText.report = await S.ev('__a11y.overflow()');
  await S.click('.modal [data-act="closeReport"]'); await S.waitFor('#endDay');
  A.bigText.contrast = await S.ev('__a11y.contrast()');
  // 5) keyboard only: Tab to "End day", Enter, focus lands in the report, Tab stays inside it, Enter continues
  await S.open();
  await S.click('[data-act="new"]'); await S.waitFor('[data-act="start"]'); await S.click('[data-act="start"]'); await S.waitFor('#endDay'); await sleep(300);
  await S.ev(`document.activeElement && document.activeElement.blur(); 1`);
  let tabs = 0, reached = false, noOutline = [];
  const seen = [];
  while (tabs < 80) {
    await S.key('Tab', 'Tab', 9); tabs++;
    const f = await S.ev(`(()=>{const a=document.activeElement; const cs=getComputedStyle(a); return {id:a.id, act:a.dataset&&a.dataset.act, k:a.dataset&&a.dataset.k, tag:a.tagName, outline:cs.outlineStyle+' '+cs.outlineWidth, fv:a.matches(':focus-visible')}})()`);
    seen.push(f.act ? `${f.act}${f.k ? ':' + f.k : ''}` : f.tag);
    if (f.outline.startsWith('none') || !f.fv) noOutline.push(f.act || f.tag);
    if (f.id === 'endDay') { reached = true; break; }
  }
  A.keyboard = { tabsToEndDay: tabs, reachedEndDay: reached, focusOrder: seen.join(' > '), focusWithoutVisibleOutline: noOutline };
  // use the + button by keyboard too
  await S.ev(`document.querySelector('[data-act="plus"][data-k="shield"]').focus(); 1`); await S.key('Enter', 'Enter', 13); await sleep(150);
  A.keyboard.enterOnPlusAddsShield = await S.ev(`document.querySelector('#act-shield output').textContent`);
  A.keyboard.focusKeptOnPlus = await S.ev(`document.activeElement.dataset.act + ':' + document.activeElement.dataset.k`);
  await S.ev(`document.querySelector('#endDay').focus(); 1`); await S.key('Enter', 'Enter', 13);
  await S.waitFor('.modal [data-act="closeReport"]'); await sleep(200);
  A.keyboard.focusInReportAfterEnd = await S.ev(`!!document.activeElement.closest('.modal')`);
  let leaked = 0; for (let i = 0; i < 12; i++) { await S.key('Tab', 'Tab', 9); if (!(await S.ev(`!!document.activeElement.closest('.modal')`))) leaked++; }
  A.keyboard.tabsThatLeftTheReportOf12 = leaked;
  await S.ev(`document.querySelector('.modal [data-act="closeReport"]').focus(); 1`); await S.key('Enter', 'Enter', 13);
  await S.waitFor('#endDay'); await sleep(200);
  A.keyboard.nextDayReached = await S.ev(`document.querySelector('.day-badge b').textContent`);
  A.keyboard.focusAfterNextDay = await S.ev(`document.activeElement.tagName + (document.activeElement.id ? '#' + document.activeElement.id : '')`);
  A.allClickablesAreButtonsOrLinks = await S.ev(`[...document.querySelectorAll('[data-act]')].filter(e=>!['BUTTON','A','INPUT','SELECT'].includes(e.tagName)).map(e=>e.tagName+':'+e.dataset.act)`);
  A.console = S.log.console;
  A.requests = [...S.log.requests.entries()];
  S.close();
}

try {
  await runViewport('desktop', 1280, 800, false, 9351);
  await runViewport('tablet', 820, 1180, true, 9352);
  await runViewport('phone360', 360, 640, true, 9353);
  await a11yPass(9354);
} catch (e) { report.failure = String(e.stack || e); }

// ---------- summary ----------
const all = Object.entries(report.viewports);
const ext = new Set(); const same = new Map();
for (const [, v] of all) for (const [u, n] of v.requests || []) { if (u.startsWith(origin) || u.startsWith('data:') || u.startsWith('blob:')) same.set(u.replace(origin, ''), (same.get(u.replace(origin, '')) || 0) + n); else ext.add(u); }
for (const [u] of report.a11y.requests || []) if (!(u.startsWith(origin) || u.startsWith('data:') || u.startsWith('blob:'))) ext.add(u);
console.log('=== CONSOLE errors/warnings per viewport ===');
for (const [k, v] of all) console.log(`${k}: ${(v.console || []).length}`, (v.console || []).slice(0, 10));
console.log(`a11y pass: ${(report.a11y.console || []).length}`, (report.a11y.console || []).slice(0, 10));
console.log('\n=== NETWORK ===\nexternal requests:', ext.size, [...ext]);
console.log('same-origin files requested:', same.size); for (const [u, n] of [...same.entries()].sort()) console.log(`  ${u}  ×${n}`);
console.log('\n=== SCREENS (overflow / contrast fails / small targets) ===');
for (const [k, v] of all) for (const [s, r] of Object.entries(v.screens)) {
  console.log(`${k.padEnd(8)} ${s.padEnd(20)} overflow=${r.overflow}${r.overflowOffenders.length ? ' ' + r.overflowOffenders.join(',') : ''} text=${r.textChecked} contrastFails=${r.contrastFails.length} smallTargets=${r.smallTargets.length}` +
    (r.days ? ` days=${r.days} ${r.result}` : '') + (r.tutorialSteps ? ` tutorialSteps=${r.tutorialSteps}` : '') + (r.featured ? ` featured="${r.featured}"` : ''));
  for (const f of r.contrastFails.slice(0, 6)) console.log('      contrast', JSON.stringify(f));
  for (const f of r.smallTargets.slice(0, 8)) console.log('      target', JSON.stringify(f));
}
for (const [k, v] of all) console.log(`${k} Today storm card: ${v.todayStormCard}`);
const { console: _c, requests: _r, ...a } = report.a11y;
console.log('\n=== ACCESSIBILITY PASS (360×640) ===\n' + JSON.stringify(a, null, 1));
if (report.failure) console.log('\nFAILURE:', report.failure);
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
setTimeout(() => process.exit(0), 300);
