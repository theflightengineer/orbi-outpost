// Orbi's Outpost — UI controller. All game rules live in /js/engine (pure, tested).
import { createGame, stepDay, previewDay, getForecast, normalizeAlloc, blocksUsed, analyzeDebrief, computeScore, sunFactor, forecastLead, ACTIONS } from '../engine/sim.js';
import { randomSeedString, dailySeed } from '../engine/rng.js';
import { loadAll, todaysEvent } from './data.js';
import { initI18n, setLang, getLang, t, L, fmtDate } from './i18n.js';
import { sceneSVG, updateScene, playStorm, playComms, orbiSVG, patchSVG, titleSkySVG } from './scene.js';
import { drawChart, SERIES } from './chart.js';
import { sfx, setSound } from './audio.js';
import { speak, stopSpeaking, speechSupported } from './speech.js';
import * as store from './store.js';

const $ = (sel, el = document) => el.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICON = { power: '⚡', oxygen: '🫁', shield: '🛡️', food: '🥬', health: '❤️', condition: '🔧', science: '🔬', lifeSupport: '🫁', greenhouse: '🌱', comms: '📡', maintenance: '🔧' };
const EMPTY = () => ({ lifeSupport: 0, shield: 0, greenhouse: 0, science: 0, comms: 0, maintenance: 0 });

const app = {
  data: null, B: null, settings: store.getSettings(), view: 'home',
  setup: { site: 'moon', difficulty: 'cadet', seed: randomSeedString(), mode: 'normal' },
  state: null, alloc: EMPTY(), featured: null, featuredInfo: null, report: null, hint: null, tutorial: null, classroom: false, debrief: null,
  score: null, prevRes: null, prevView: null, lastDelivered: []
};

// ------------------------------------------------------------------ boot
async function boot() {
  applySettings();
  try { app.data = await loadAll(); app.B = app.data.balance; }
  catch (e) { $('#app').innerHTML = '<p class="card">Could not load game data. Please run the game from a web server (see README).</p>'; return; }
  await initI18n(app.settings.lang);
  const p = new URLSearchParams(location.search);
  if (p.get('seed')) {
    app.setup = { site: p.get('site') === 'mars' ? 'mars' : 'moon', difficulty: ['cadet', 'explorer', 'commander'].includes(p.get('diff')) ? p.get('diff') : 'cadet', seed: p.get('seed').slice(0, 40), mode: p.get('mode') === 'daily' ? 'daily' : 'normal' };
    go('setup');
  } else go('home');
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', () => { if (app.view === 'debrief') drawDebriefChart(); });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}

function applySettings() {
  const s = app.settings, root = document.documentElement;
  root.classList.toggle('contrast', !!s.contrast);
  const rm = s.reducedMotion == null ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : s.reducedMotion;
  root.classList.toggle('reduce-motion', !!rm);
  root.classList.toggle('big-text', !!s.bigText);
  setSound(!!s.sound);
}
const reduced = () => document.documentElement.classList.contains('reduce-motion');

// ------------------------------------------------------------------ routing
/** CSS selector that finds "the same control" again after a re-render (to keep keyboard/touch focus). */
function selectorFor(el) {
  if (!el || el === document.body) return null;
  if (el.id) return '#' + CSS.escape(el.id);
  const d = el.dataset || {};
  if (!d.act) return null;
  return `[data-act="${d.act}"]` + ['field', 'value', 'key', 'view', 'lang', 'k'].filter(k => d[k] != null).map(k => `[data-${k}="${CSS.escape(d[k])}"]`).join('');
}

/**
 * Render a screen. Moving to another screen scrolls to the top and focuses its heading.
 * keep:true = same screen updated in place (picking an option, a setting, the language):
 * the scroll position and the focused control stay where they were.
 */
let navSeq = 0; // increases on every render, so a delayed transition never overrides a newer navigation
function go(view, { keep = false } = {}) {
  navSeq++;
  const y = keep ? window.scrollY : 0;
  const focusSel = keep ? selectorFor(document.activeElement) : null;
  app.view = view;
  stopSpeaking();
  const views = { home, setup, game: gameView, debrief: debriefView, credits, glossary, scores, classroom, settings };
  $('#app').innerHTML = header() + `<main id="main" tabindex="-1">${views[view]()}</main>` + footer();
  if (view === 'game') afterGameRender();
  if (view === 'debrief') drawDebriefChart();
  if (keep) {
    window.scrollTo(0, y);
    const el = focusSel && $(focusSel);
    if (el) el.focus({ preventScroll: true });
  } else {
    const h = $('#main h1, #main h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
  }
  if (view === 'game' && app.tutorial) showTutorial();
}

function header() {
  const lang = getLang();
  return `<header class="topbar">
    <button class="brand" data-act="home" aria-label="${t('nav_home')}">${orbiSVG('happy', 34)}<span>${t('title_short')}</span></button>
    <nav class="tools">
      <button class="chip" data-act="lang" aria-label="${t('nav_lang')}">${lang === 'pt' ? 'EN' : 'PT'}</button>
      ${speechSupported() ? `<button class="chip ${app.settings.readAloud ? 'on' : ''}" data-act="toggleRead" aria-pressed="${!!app.settings.readAloud}" aria-label="${t('set_read')}">🔊</button>` : ''}
      <button class="chip" data-act="view" data-view="glossary" aria-label="${t('nav_glossary')}">📖</button>
      <button class="chip" data-act="view" data-view="settings" aria-label="${t('nav_settings')}">⚙️</button>
    </nav></header>`;
}
function footer() {
  const d = app.data.donki_events.retrieved;
  return `<footer class="foot"><p>${t('foot_archived', { date: fmtDate(d) })} · <button class="link" data-act="view" data-view="credits">${t('nav_credits')}</button></p>
    <p class="muted">${t('foot_endorse')}</p></footer>`;
}

// ------------------------------------------------------------------ home
function home() {
  const saved = store.load('current', null);
  const resume = saved && saved.state && !saved.state.over;
  return `<section class="title-screen">
    ${titleSkySVG()}
    <div class="title-inner">
      <div class="title-orbi">${orbiSVG('happy', 132)}</div>
      <h1 class="wordmark"><span>${t('title_w1')}</span><span>${t('title_w2')}</span></h1>
      <p class="title-sub">${t('title_sub')}</p>
      <p class="lead">${t('home_lead')}</p>
      <div class="menu">
        ${resume ? `<button class="btn big primary" data-act="resume">▶ ${t('home_resume', { day: saved.state.day })}</button>` : ''}
        <button class="btn big ${resume ? 'secondary' : 'primary'}" data-act="new">🚀 ${t('home_new')}</button>
        <div class="menu-grid">
          <button class="btn tile t-oxygen" data-act="tutorial"><span class="tile-ico">🎓</span>${t('home_tutorial')}</button>
          <button class="btn tile t-power" data-act="today"><span class="tile-ico">🌞</span>${t('home_today')}</button>
          <button class="btn tile t-shield" data-act="daily"><span class="tile-ico">📅</span>${t('home_daily')}</button>
          <button class="btn tile t-food" data-act="view" data-view="classroom"><span class="tile-ico">🍎</span>${t('home_class')}</button>
        </div>
        <div class="menu-row">
          <button class="btn small" data-act="view" data-view="scores">🏆 ${t('home_scores')}</button>
          <button class="btn small" data-act="view" data-view="credits">📚 ${t('nav_credits')}</button>
        </div>
      </div>
      <div class="bubble">${orbiSVG('happy', 44)}<span>${t('home_orbi')}</span> ${sayBtn(t('home_orbi'))}</div>
    </div>
  </section>`;
}
const sayBtn = text => speechSupported() ? `<button class="say" data-act="say" data-text="${esc(text)}" aria-label="${t('read_this')}">🔈</button>` : '';

// ------------------------------------------------------------------ setup
function setup() {
  const s = app.setup, data = app.data;
  const img = k => (data.imagery && data.imagery.images || []).find(i => i.key === k);
  const site = (k, imgKey) => {
    const im = img(imgKey); const sd = data.sites[k];
    return `<button class="site-card ${s.site === k ? 'sel' : ''}" data-act="pick" data-field="site" data-value="${k}" aria-pressed="${s.site === k}">
      ${im ? `<img src="${esc(im.file)}" alt="${esc(im.title)}" loading="lazy" width="160" height="120">` : ''}
      <b>${k === 'moon' ? '🌑' : '🔴'} ${esc(L(sd.name))}</b>
      <small>${esc(L(sd.facts[0]))}</small>
      ${im ? `<small class="credit">${t('img_credit')}: ${esc(im.credit)}</small>` : ''}</button>`;
  };
  const diff = (k, age, desc) => `<button class="diff-card ${s.difficulty === k ? 'sel' : ''}" data-act="pick" data-field="difficulty" data-value="${k}" aria-pressed="${s.difficulty === k}">
     <b>${t('diff_' + k)}</b><span class="age">${age}</span><small>${desc}</small></button>`;
  const featured = s.mode === 'today' && app.featured ? featuredCard(app.featured) : '';
  return `<section><h2>${s.mode === 'daily' ? '📅 ' + t('home_daily') : s.mode === 'today' ? '🌞 ' + t('home_today') : '🚀 ' + t('setup_title')}</h2>
    ${featured}
    <h3>${t('setup_site')}</h3><div class="grid2">${site('moon', 'moon_south_pole')}${site('mars', 'jezero')}</div>
    <h3>${t('setup_diff')}</h3><div class="grid3">
      ${diff('cadet', t('age_cadet'), t('diff_cadet_d'))}${diff('explorer', t('age_explorer'), t('diff_explorer_d'))}${diff('commander', t('age_commander'), t('diff_commander_d'))}</div>
    <h3>${t('setup_seed')}</h3>
    <div class="seed-row"><input id="seed" value="${esc(s.seed)}" maxlength="40" aria-label="${t('setup_seed')}" ${s.mode === 'daily' ? 'readonly' : ''}>
      ${s.mode === 'normal' ? `<button class="btn" data-act="reseed">🎲 ${t('setup_reseed')}</button>` : ''}</div>
    <p class="muted">${t('setup_seed_help')}</p>
    <button class="btn big primary" data-act="start">🚀 ${t('setup_start')}</button>
  </section>`;
}
function featuredCard(f) {
  const e = f.event;
  return `<div class="card real featured"><span class="tag ${f.source === 'live' ? 'live' : 'arch'}">${f.source === 'live' ? t('tag_live') : t('tag_archived')}</span>
    <h3>${typeIcon(e.type)} ${eventName(e)}</h3>
    <p>${t('today_desc', { date: fmtDate(e.date) })}</p>
    <p class="src">${t('real_event_src', { date: fmtDate(e.date) })}. <a href="${esc(e.link)}" target="_blank" rel="noopener">${t('see_nasa')}</a>
    · ${f.source === 'live' ? t('live_fetched', { date: esc(String(f.retrieved).slice(0, 16)) }) : t('archived_on', { date: fmtDate(f.retrieved) })}</p></div>`;
}
const typeIcon = ty => ({ FLR: '☀️', CME: '🌪️', SEP: '☢️' }[ty] || '☀️');
function eventName(e) {
  if (e.type === 'FLR') return t('ev_flr', { cls: esc(e.classType) });
  if (e.type === 'CME') return t('ev_cme', { speed: e.speed });
  return t('ev_sep') + (e.linkedFlareClass ? ` (${t('ev_after_flare', { cls: esc(e.linkedFlareClass) })})` : '');
}

function startMission({ site, difficulty, seed, mode = 'normal', featured = null, days = null, hint = null }) {
  app.state = createGame({ seed, site, difficulty, mode, events: app.data.donki_events.events, balance: app.B, featuredEvent: featured ? featured.event : null, days, hint });
  app.featuredInfo = featured;
  app.alloc = defaultAlloc();
  app.report = null;
  app.lastDelivered = [];
  app.prevRes = null;
  saveCurrent();
  go('game');
  const msg = hint ? t(hint) : t('orbi_start_' + site);
  if (app.settings.readAloud && !app.tutorial) speak(msg);
}
function defaultAlloc() { return { ...EMPTY(), lifeSupport: 1 }; }
function saveCurrent() { store.save('current', { state: app.state, featuredInfo: app.featuredInfo || null, classroom: app.classroom }); }

// ------------------------------------------------------------------ game
const dayWord = () => app.state.site === 'mars' ? t('sol') : t('day');
const levelOf = v => v < 25 ? 'low' : v < 50 ? 'mid' : 'ok';
/** Liquid tank gauge. Starts at yesterday's level (data-from) and pours to today's after render. */
function tankHTML(key, value, prev) {
  const v = Math.round(value), p = Math.round(prev ?? value), d = v - p;
  return `<div class="tank r-${key} ${levelOf(v)}" id="g-${key}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}" aria-label="${t('res_' + key)} ${v}">
    <div class="tank-glass"><div class="liquid" style="--lv:${p}%" data-to="${v}"><i class="wave"></i></div>
      <span class="tank-val">${v}</span>${d ? `<span class="tank-delta ${d < 0 ? 'neg' : 'pos'}">${d > 0 ? '+' : ''}${d}</span>` : ''}</div>
    <button class="term tank-label" data-act="term" data-term="${key}"><span aria-hidden="true">${ICON[key]}</span> ${t('res_' + key)}</button></div>`;
}
function meterHTML(key, value, prev, note = '') {
  const v = Math.round(value), p = Math.round(prev ?? value);
  return `<div class="meter r-${key} ${levelOf(v)}" id="g-${key}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}" aria-label="${t('res_' + key)} ${v}">
    <div class="meter-head"><button class="term" data-act="term" data-term="${key}"><span aria-hidden="true">${ICON[key]}</span> ${t('res_' + key)}</button><b>${v}</b></div>
    <div class="meter-track"><div class="liquid" style="--lv:${p}%" data-to="${v}"></div></div>${note}</div>`;
}
function gameView() {
  const s = app.state, B = app.B, D = B.difficulty[s.difficulty];
  const prev = app.prevRes || { ...s.res, health: s.health };
  return `<section class="game">
    <div class="mission-bar">
      <h2 class="day-badge" aria-label="${dayWord()} ${s.day} ${t('of_n', { n: s.length })}"><small>${dayWord()}</small><b>${s.day}</b><small>${t('of_n', { n: s.length })}</small></h2>
      <div class="mission-meta">
        <p class="site-name"><span aria-hidden="true">${s.site === 'moon' ? '🌑' : '🔴'}</span> ${esc(L(app.data.sites[s.site].name))}</p>
        <div class="chips"><span class="chip small-chip">${t('diff_' + s.difficulty)}</span>
          <button class="chip small-chip" data-act="share" title="${t('share_seed')}">🔗 ${esc(s.seed)}</button>
          <button class="chip small-chip" data-act="quit">⏸ ${t('quit')}</button></div></div></div>
    ${s.hint && s.day === 1 ? `<div class="bubble hint">${orbiSVG('think', 44)}<span>💡 ${t(s.hint)}</span></div>` : ''}
    <div class="console">
      <div class="col-main">
        <div class="porthole" id="scene">${sceneSVG(s.site, t('earth'))}</div>
        <div class="tanks" id="tanks">
          ${['power', 'oxygen', 'shield', 'food'].map(k => tankHTML(k, s.res[k], prev[k])).join('')}
        </div>
        <div class="meters">
          ${meterHTML('health', s.health, prev.health, `<small class="muted">☢️ <button class="term" data-act="term" data-term="dose">${t('res_dose')}</button> ${s.dose.toFixed(1)} / ${D.doseLimit}</small>`)}
          ${meterHTML('condition', s.res.condition, prev.condition)}
          <div class="sci-chip"><span aria-hidden="true">🔬</span> ${t('science_sent')} <b>${s.scienceSent}</b>${D.scienceNeedsTransmit ? `<br><small class="muted">${t('science_waiting')} <b>${s.sciencePending}</b></small>` : ''}</div>
        </div>
        ${D.foodCanEnd ? '' : `<p class="muted small note-food">🥬 ${t('food_cadet_note')}</p>`}
        <div class="panels">
          <div class="card forecast" id="forecast">${forecastHTML()}</div>
          <div class="card earth" id="earthPanel">${earthHTML()}</div>
        </div>
      </div>
      <aside class="col-deck"><div class="card deck actions" id="actions">${actionsHTML()}</div></aside>
    </div>
    <div class="facts-strip">${siteFactHTML()}</div>
  </section>`;
}
function pourTanks() {
  const els = document.querySelectorAll('.liquid[data-to]');
  requestAnimationFrame(() => requestAnimationFrame(() => els.forEach(el => el.style.setProperty('--lv', el.dataset.to + '%'))));
}
function siteFactHTML() {
  const s = app.state;
  const facts = app.data.sites[s.site].facts;
  const f = facts[(s.day - 1) % facts.length];
  return `<div class="card fact"><span class="tag real-tag">${t('tag_real_fact')}</span> ${esc(L(f))} ${sayBtn(L(f))}
    <small class="src"><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.source)}</a>${f.derived ? ` · ${t('derived')}` : ''}</small></div>`;
}
function forecastHTML() {
  const s = app.state, B = app.B, D = B.difficulty[s.difficulty];
  const fc = getForecast(s, B);
  const lead = forecastLead(s, B);
  const when = d => d === 0 ? t('fc_today') : d === 1 ? t('fc_tomorrow') : t('fc_in_days', { n: d });
  const bolts = (a, b) => a === b ? '⚡'.repeat(a) : `${'⚡'.repeat(a)} – ${'⚡'.repeat(b)}`;
  const list = fc.length ? fc.map(f => `<li class="${f.inDays === 0 ? 'urgent' : ''}"><b>${typeIcon(f.type)} ${t('fc_type_' + f.type)}</b> · ${when(f.inDays)}<br>
      <span class="bolts" aria-label="${t('fc_strength')} ${f.range[0]}-${f.range[1]} / 5">${bolts(f.range[0], f.range[1])}</span>${f.range[0] !== f.range[1] ? ` <small>${t('fc_uncertain')}</small>` : ''}</li>`).join('')
    : lead ? `<li class="clear">☀️ ${t('fc_clear', { n: lead })}</li>` : `<li>❔ ${t('fc_clear0')}</li>`;
  return `<h3>🛰️ <button class="term" data-act="term" data-term="forecast">${t('fc_title')}</button></h3>
    <ul class="fc-list">${list}</ul>
    <p class="muted small">${lead ? t('fc_lead', { n: lead }) : t('fc_lead0')} ${s.forecastBoostUntil >= s.day ? '📡 ' + t('fc_boost') : t('fc_talk')}
    ${s.site === 'mars' && D.marsForecastPenalty ? '<br>🔴 ' + t('fc_mars_note') : ''}</p>
    <p class="src small">${t('fc_source', { date: fmtDate(app.data.donki_events.retrieved) })}</p>`;
}
function earthHTML() {
  const s = app.state, B = app.B, D = B.difficulty[s.difficulty];
  const pending = s.inbox;
  const delivered = app.lastDelivered || [];
  let html = `<h3>🌍 <button class="term" data-act="term" data-term="delay">${t('earth_title')}</button></h3>`;
  if (delivered.length) html += delivered.map(m => `<div class="msg in">📨 <b>${t('earth_says')}</b> ${t(m.tip)} ${sayBtn(t(m.tip))}</div>`).join('');
  if (pending.length) {
    html += pending.map(m => D.commStyle === 'friendly'
      ? `<div class="msg wait"><span class="dots" aria-hidden="true">📡</span> ${t('earth_wait_friendly')}</div>`
      : `<div class="msg wait">📡 ${t('earth_wait', { day: m.arrive, word: dayWord() })}</div>`).join('');
  }
  if (!pending.length && !delivered.length) html += `<p class="muted">${t('earth_idle')}</p>`;
  const S = B.sites[s.site];
  html += `<p class="muted small">${s.site === 'moon' ? t('delay_moon') : t('delay_mars', { min: Math.round(S.lightSeconds[0] / 60), max: Math.round(S.lightSeconds[1] / 60) })}</p>`;
  return html;
}
function actionsHTML() {
  const s = app.state, B = app.B, D = B.difficulty[s.difficulty], A = B.actions;
  const a = app.alloc = normalizeAlloc(s, app.alloc, B);
  const used = blocksUsed(a);
  const avail = Math.min(B.maxBlocksPerDay, Math.floor(s.res.power / B.powerPerBlock));
  const P = B.powerPerBlock;
  const eff = {
    lifeSupport: `−${P}⚡ → +${A.lifeSupport.oxygen}🫁`,
    shield: `−${P}⚡ → +${A.shield.shield}🛡️`,
    greenhouse: `−${P}⚡ → +${A.greenhouse.food}🥬 +${A.greenhouse.oxygen}🫁`,
    science: `−${P}⚡ −${A.science.oxygen}🫁 → +${A.science.points}🔬 · ${t('eff_science_side')}`,
    comms: `−${P}⚡ → ${D.scienceNeedsTransmit ? t('eff_comms_send') + ' · ' : ''}${t('eff_comms')}`,
    maintenance: `−${P}⚡ → +${A.maintenance.condition}🔧 · ${t('eff_maint_side')}`
  };
  const row = k => {
    const toggle = k === 'comms' || (k === 'greenhouse' && D.greenhouseToggle);
    const n = a[k];
    const canAdd = used < avail && n < (toggle ? 1 : A[k].max);
    const ctl = toggle
      ? `<button class="switch ${n ? 'on' : ''}" data-act="toggle" data-k="${k}" role="switch" aria-checked="${!!n}" aria-label="${t('act_' + k)}" ${!n && !canAdd ? 'disabled' : ''}><span></span></button>`
      : `<button class="pm" data-act="minus" data-k="${k}" aria-label="${t('less')} ${t('act_' + k)}" ${n ? '' : 'disabled'}>−</button>
         <output aria-live="polite">${n}</output>
         <button class="pm" data-act="plus" data-k="${k}" aria-label="${t('more')} ${t('act_' + k)}" ${canAdd ? '' : 'disabled'}>+</button>`;
    return `<div class="act a-${k} ${n ? 'active' : ''}" id="act-${k}"><div class="act-ico" aria-hidden="true">${ICON[k]}</div>
      <div class="act-txt"><b>${t('act_' + k)}</b><small>${eff[k]}</small></div><div class="act-ctl">${ctl}</div></div>`;
  };
  // each used block takes the colour of the action that spends it
  const spent = ACTIONS.flatMap(k => Array(a[k]).fill(k));
  const blocks = Array.from({ length: B.maxBlocksPerDay }, (_, i) => `<span class="blk ${i < used ? 'used a-' + spent[i] : i < avail ? 'free' : 'none'}"></span>`).join('');
  const pv = previewDay(s, a, B);
  const delta = k => { const d = Math.round(pv.after[k] - s.res[k]); return `<span class="pv r-${k} ${d < 0 ? 'neg' : d > 0 ? 'pos' : ''}"><span aria-hidden="true">${ICON[k]}</span> ${Math.round(pv.after[k])} <small>${d > 0 ? '+' : ''}${d}</small></span>`; };
  return `<h3 class="deck-title">${t('act_title')}</h3>
    <div class="budget" aria-label="${t('budget_aria', { used, avail })}"><div class="blocks">${blocks}</div><span>${t('budget', { used, avail })}</span></div>
    <p class="muted small">${t('budget_help', { p: P })}</p>
    <div class="act-list">${ACTIONS.map(row).join('')}</div>
    <div class="preview"><b>${t('preview_title')}</b><div>${['power', 'oxygen', 'shield', 'food'].map(delta).join('')}</div></div>
    <button class="btn big launch" id="endDay" data-act="endDay">${t('end_day', { word: dayWord().toLowerCase() })} <span aria-hidden="true">🌙</span></button>`;
}
function refreshActions() {
  $('#actions').innerHTML = actionsHTML();
  updateScene($('#scene'), sceneState());
}
function sceneState() {
  const s = app.state;
  return { sun: sunFactor(s, s.day, app.B), shield: s.res.shield, dust: s.res.dust, greenhouse: app.alloc.greenhouse > 0, dustStorm: s.site === 'mars' && s.dustStormUntil >= s.day, power: s.res.power };
}
function afterGameRender() { updateScene($('#scene'), sceneState()); pourTanks(); }

/** Smooth turn change: cross-fade with the View Transitions API where supported (skipped for reduced motion). */
function transitionTo(fn) {
  if (!document.startViewTransition || reduced()) return fn();
  const seq = navSeq;
  try {
    // if the player navigates somewhere else before the transition's update runs, skip this stale update
    const vt = document.startViewTransition(() => { if (navSeq === seq) fn(); });
    // A transition can be skipped (e.g. the device rotates mid-turn). The DOM update still runs; just silence the promises.
    [vt.ready, vt.finished, vt.updateCallbackDone].forEach(p => p && p.catch(() => {}));
  } catch { fn(); }
}

function endDay() {
  const prev = app.state;
  app.prevRes = { ...prev.res, health: prev.health };
  const { state, report } = stepDay(prev, app.alloc, app.B);
  app.state = state; app.report = report;
  app.lastDelivered = report.delivered;
  const storm = report.events.find(e => e.kind === 'storm');
  if (report.alloc.comms) playComms($('#scene'));
  sfx.endDay();
  if (storm) { playStorm($('#scene')); sfx.storm(); }
  saveCurrent();
  setTimeout(showReport, storm && !reduced() ? 1600 : 150);
}

function showReport() {
  const r = app.report, s = app.state, B = app.B;
  const cards = r.events.map(e => eventCard(e)).filter(Boolean).join('');
  const keys = ['power', 'oxygen', 'shield', 'food', 'health'];
  const changes = keys.map(k => { const d = Math.round(r.after[k] - r.before[k]); return `<li>${ICON[k]} ${t('res_' + k)}: ${Math.round(r.before[k])} → <b>${Math.round(r.after[k])}</b> <span class="${d < 0 ? 'neg' : d > 0 ? 'pos' : ''}">(${d > 0 ? '+' : ''}${d})</span></li>`; }).join('');
  const low = ['oxygen', 'power', 'food', 'shield'].filter(k => r.after[k] < 30).sort((a, b) => r.after[a] - r.after[b])[0];
  const hadStorm = r.events.some(e => e.kind === 'storm');
  const orbiMsg = s.over ? (s.result === 'win' ? t('orbi_win') : t('orbi_lose')) : low ? t('orbi_low_' + low) : hadStorm ? t('orbi_storm') : t('orbi_good');
  const delivered = r.delivered.map(m => `<div class="msg in">📨 <b>${t('earth_says')}</b> ${t(m.tip)}</div>`).join('');
  modal(`<h2>${t('report_title', { word: dayWord(), day: r.day })}</h2>
    ${cards || `<p class="muted">${t('report_quiet')}</p>`}
    ${delivered}
    <ul class="changes">${changes}</ul>
    <div class="bubble">${orbiSVG(low || s.result === 'lose' ? 'worried' : 'happy', 44)}<span>${orbiMsg}</span> ${sayBtn(orbiMsg)}</div>
    <button class="btn big primary" data-act="closeReport">${s.over ? t('see_debrief') : t('next_day', { word: dayWord().toLowerCase() })} ▶</button>`);
  if (app.settings.readAloud) speak(orbiMsg);
  if (low && !s.over) sfx.warn();
}
function eventCard(e) {
  const tagSim = `<span class="tag sim">${t('tag_simulated')}</span>`;
  switch (e.kind) {
    case 'storm': {
      const ev = e.event;
      const featured = app.featuredInfo && app.featuredInfo.event.id === ev.id;
      return `<div class="card real storm"><span class="tag ${featured && app.featuredInfo.source === 'live' ? 'live' : 'real-tag'}">${featured && app.featuredInfo.source === 'live' ? t('tag_live') : t('tag_real')}</span>
        <h3>${typeIcon(ev.type)} ${eventName(ev)} <span class="bolts">${'⚡'.repeat(e.stars)}</span></h3>
        <p>${t('storm_hit', { shield: e.shieldAtHit, prot: e.protection, got: e.got })}</p>
        <p class="src">${t('real_event_src', { date: fmtDate(ev.date) })}. <a href="${esc(ev.link)}" target="_blank" rel="noopener">${t('see_nasa')}</a>
        ${!e.warned ? `<br>⚠️ ${t('storm_surprise')}` : ''}</p></div>`;
    }
    case 'glitch': return `<div class="card sim">${tagSim}<h3>🔧 ${t('ev_glitch')}</h3><p>${t('ev_glitch_' + e.what, { n: e.amount })}</p></div>`;
    case 'panelDust': return `<div class="card sim">${tagSim}<h3>🌫️ ${t('ev_paneldust')}</h3><p>${t('ev_paneldust_d')}</p></div>`;
    case 'dustStorm': return `<div class="card sim">${tagSim}<h3>🌪️ ${t('ev_duststorm')}</h3><p>${t('ev_duststorm_d', { n: e.days })}</p></div>`;
    case 'msgDelayed': return `<div class="card sim">${tagSim}<h3>📡 ${t('ev_msgdelay')}</h3><p>${t('ev_msgdelay_d')}</p></div>`;
    case 'blackout': return `<div class="card alert"><h3>🔌 ${t('ev_blackout')}</h3><p>${t('ev_blackout_d')}</p></div>`;
    case 'hungry': return `<div class="card alert"><h3>🥬 ${t('ev_hungry')}</h3><p>${t('ev_hungry_d')}</p></div>`;
    case 'science': return `<div class="card ok"><h3>🔬 ${t('ev_science', { n: e.points })}</h3>${e.eva ? `<p class="small">${t('ev_science_eva', { n: e.eva })}</p>` : ''}</div>`;
    case 'comms': {
      const sec = e.lightSeconds;
      const time = sec < 60 ? t('secs', { n: sec }) : t('mins', { n: Math.round(sec / 60) });
      return `<div class="card ok"><h3>📡 ${t('ev_comms')}</h3><p>${t('ev_comms_d', { time })}${e.sent ? ' ' + t('ev_comms_sent', { n: e.sent }) : ''}</p></div>`;
    }
    default: return '';
  }
}

function modal(html) {
  closeModal();
  const m = document.createElement('div');
  m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
  m.innerHTML = `<div class="modal-box">${html}</div>`;
  const h = m.querySelector('h2');
  if (h) { h.id = 'modalTitle'; m.setAttribute('aria-labelledby', 'modalTitle'); }
  document.body.appendChild(m);
  // keep keyboard focus inside the dialog: the page behind is inert, and Tab wraps around
  const appEl = $('#app'); if (appEl) appEl.inert = true;
  m.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const f = [...m.querySelectorAll('button:not([disabled]), a[href], input')];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  const b = m.querySelector('.btn.primary, button');
  if (b) b.focus();
}
function closeModal() {
  document.querySelectorAll('.modal').forEach(m => m.remove());
  const appEl = $('#app'); if (appEl) appEl.inert = false;
}

// ------------------------------------------------------------------ debrief
function finishMission() {
  const s = app.state;
  app.debrief = analyzeDebrief(s, app.B);
  app.score = computeScore(s, app.B);
  if (s.mode !== 'tutorial') store.addScore({ score: app.score.score, site: s.site, difficulty: s.difficulty, seed: s.seed, days: app.score.days, result: s.result, badges: app.score.badges });
  store.save('current', null);
  if (s.result === 'win') sfx.win(); else sfx.lose();
  if (app.tutorial) { app.tutorial = null; app.settings = store.setSettings({ tutorialDone: true }); }
  go('debrief');
}
function debriefView() {
  const s = app.state, d = app.debrief, sc = app.score, data = app.data;
  const win = s.result === 'win';
  const chain = d.chain.map(c => `<li><span class="dayb">${dayWord()} ${c.day}</span> ${t(c.key, { ...c.params, date: c.params.date ? fmtDate(c.params.date) : '', res: c.params.res ? t('res_' + c.params.res) : '' })}</li>`).join('');
  const osdr = pickOsdr(d.osdrTopic);
  const csa = data.csa_food ? data.csa_food.facts[(s.history.length + s.seed.length) % data.csa_food.facts.length] : null;
  const storms = d.storms.map(st => `<div class="card real"><span class="tag real-tag">${t('tag_real')}</span>
      <p>${t('debrief_storm', { date: fmtDate(st.event.date), name: eventName(st.event), word: dayWord(), day: st.day, shield: st.shieldAtHit, got: st.got })}</p>
      <p class="src"><a href="${esc(st.event.link)}" target="_blank" rel="noopener">${t('see_nasa')}</a> · NASA DONKI</p></div>`).join('');
  const dose = d.dose;
  const radlab = data.radlab_iss;
  const badges = sc.badges.map(b => `<li class="badge">${t('badge_' + b + '_i')} <b>${t('badge_' + b)}</b></li>`).join('') || `<li class="muted">${t('no_badges')}</li>`;
  const nasaDo = t('nasa_does_' + (d.cause || 'win'));
  return `<section class="debrief">
    <div class="debrief-hero ${win ? 'win' : 'lose'}">
      ${win && !reduced() ? confettiHTML() : ''}
      <div class="patch-wrap">${patchSVG({ win, site: s.site, score: sc.score, label: win ? t('patch_win') : t('patch_lose'), sub: t('score') })}</div>
      <div class="hero-text"><h2>${win ? t('debrief_win') : t('debrief_lose')}</h2><p>${win ? t('debrief_win_d', { n: s.length, word: dayWord().toLowerCase() }) : t('debrief_lose_d_' + d.cause, { n: s.history.length, word: dayWord().toLowerCase() })}</p>
        ${win ? '' : `<p class="gentle">${orbiSVG('think', 40)}<span>${t('debrief_gentle')}</span></p>`}</div>
    </div>
    <div class="score-row">
      <div class="score"><small>${t('days_survived')}</small><b>${sc.days}/${s.length}</b></div>
      <div class="score"><small>${t('science_sent')}</small><b>${sc.science}</b></div>
      <div class="score"><small>${t('res_health')}</small><b>${Math.round(sc.health)}</b></div></div>
    <ul class="badges">${badges}</ul>
    <div class="card chain-card"><h3>🧩 ${t('debrief_what')}</h3><ol class="chain">${chain}</ol></div>
    <div class="card"><h3>📈 ${t('debrief_chart')}</h3>
      <canvas id="chart" class="chart" role="img"></canvas>
      <div class="legend">${SERIES.map(x => `<span><i style="background:${x.color}"></i>${t('res_' + x.key)}</span>`).join('')}<span>⚡ ${t('legend_storm')}</span></div>
      <details><summary>${t('show_numbers')}</summary>${numbersTable()}</details></div>
    ${storms ? `<h3>🌞 ${t('debrief_real')}</h3>${storms}` : ''}
    <div class="card"><h3>👩‍🚀 ${t('debrief_nasa')}</h3><p>${nasaDo}</p></div>
    <div class="card real"><h3>☢️ ${t('debrief_dose')}</h3>
      <p>${t('dose_compare', { units: dose.doseUnits, mgy: dose.totalMilliGray, iss: dose.issDays, days: dose.missionDays, word: dayWord().toLowerCase() })}</p>
      ${radlab ? `<p class="small">${t('dose_radlab', { ugy: dose.issDailyMicroGray, module: esc(radlab.days[0].module), year: radlab.days[0].date.slice(0, 4) })}</p>
      <p class="src"><a href="https://visualization.osdr.nasa.gov/radlab/" target="_blank" rel="noopener">NASA OSDR RadLab</a> · ${t('archived_on', { date: fmtDate(radlab.retrieved) })}</p>` : ''}</div>
    ${osdr ? `<div class="card real"><span class="tag real-tag">NASA OSDR</span><h3>🧬 ${t('debrief_osdr')}</h3><p>${esc(L(osdr))} ${sayBtn(L(osdr))}</p>
      <p class="src">${esc(osdr.id)}: <a href="${esc(osdr.url)}" target="_blank" rel="noopener">${esc(osdr.title)}</a></p></div>` : ''}
    ${csa ? `<div class="card"><span class="tag csa">CSA</span><h3>🥬 ${t('debrief_csa')}</h3><p>${esc(L(csa))}</p><p class="src"><a href="${esc(csa.url)}" target="_blank" rel="noopener">${t('csa_credit')}</a></p></div>` : ''}
    <div class="menu">
      ${d.hint ? `<button class="btn big primary" data-act="retryHint">💡 ${t('retry_hint')}</button>` : `<button class="btn big primary" data-act="retry">🔁 ${t('retry_same')}</button>`}
      <button class="btn big" data-act="new">🚀 ${t('home_new')}</button>
      <button class="btn" data-act="share">🔗 ${t('share_seed')}</button>
      ${app.classroom ? `<div class="seed-row"><input id="studentName" maxlength="20" placeholder="${t('class_name')}" aria-label="${t('class_name')}"><button class="btn" data-act="saveClass">💾 ${t('class_save')}</button></div>` : ''}
      <button class="btn" data-act="home">🏠 ${t('nav_home')}</button></div>
  </section>`;
}
function confettiHTML() {
  const colors = ['#ffc531', '#43d2ff', '#b98aff', '#59e07a', '#ff6b8b'];
  return `<div class="confetti" aria-hidden="true">${Array.from({ length: 36 }, (_, i) =>
    `<i style="--x:${(i * 37) % 100}%;--d:${(i % 9) * 0.07}s;--c:${colors[i % 5]};--r:${(i * 47) % 360}deg;--s:${0.7 + (i % 4) * 0.15}"></i>`).join('')}</div>`;
}
function numbersTable() {
  const rows = app.state.history.map(h => `<tr><td>${h.day}</td><td>${Math.round(h.power)}</td><td>${Math.round(h.oxygen)}</td><td>${Math.round(h.shield)}</td><td>${Math.round(h.food)}</td><td>${Math.round(h.health)}</td><td>${h.events.filter(x => x !== 'science' && x !== 'comms').map(x => t('evshort_' + x)).join(', ')}</td></tr>`).join('');
  return `<div class="table-wrap"><table><thead><tr><th>${dayWord()}</th>${['power', 'oxygen', 'shield', 'food', 'health'].map(k => `<th>${ICON[k]}</th>`).join('')}<th>${t('events')}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function drawDebriefChart() {
  const c = $('#chart'); if (!c || !app.state) return;
  drawChart(c, app.state.history, app.state.storms.filter(x => x.hit), { aria: t('chart_aria') }, { contrast: app.settings.contrast });
}
function pickOsdr(topic) {
  const f = (app.data.osdr_facts && app.data.osdr_facts.facts) || [];
  if (!f.length) return null;
  const m = f.filter(x => x.topic === topic);
  const list = m.length ? m : f;
  return list[(app.state.seed.length + app.state.history.length) % list.length];
}

// ------------------------------------------------------------------ info pages
function credits() {
  const d = app.data, dk = d.donki_events, o = d.osdr_facts, r = d.radlab_iss, im = d.imagery, csa = d.csa_food;
  const siteSources = ['moon', 'mars'].flatMap(k => d.sites[k].facts.map(f => `<li>${esc(L(f))} <a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.source)}</a>${f.verified === true ? ' ✔︎' : ''}</li>`)).join('');
  const nEv = dk.events.length, counts = ['FLR', 'CME', 'SEP'].map(ty => `${ty}: ${dk.events.filter(e => e.type === ty).length}`).join(', ');
  return `<section class="credits"><h2>📚 ${t('nav_credits')}</h2>
    <p class="lead">${t('cr_intro')}</p>
    <div class="card endorse"><b>${t('foot_endorse')}</b> ${t('cr_endorse_more')}</div>
    <div class="card real"><h3>☀️ NASA DONKI: ${t('cr_donki_t')}</h3><p>${t('cr_donki', { n: nEv, counts, date: fmtDate(dk.retrieved) })}</p>
      <p class="src">${dk.endpoints.map(u => esc(u)).join(' · ')}</p><p><a href="https://kauai.ccmc.gsfc.nasa.gov/DONKI/" target="_blank" rel="noopener">DONKI (NASA CCMC)</a> · <a href="https://api.nasa.gov/" target="_blank" rel="noopener">api.nasa.gov</a></p></div>
    ${r ? `<div class="card real"><h3>☢️ NASA OSDR RadLab: ${t('cr_radlab_t')}</h3><p>${t('cr_radlab', { n: r.days.length, rate: r.meanRatePerHour, daily: r.meanDailyDose_uGy, date: fmtDate(r.retrieved) })}</p>
      <p class="src"><a href="https://visualization.osdr.nasa.gov/radlab/" target="_blank" rel="noopener">visualization.osdr.nasa.gov/radlab</a></p></div>` : ''}
    ${o ? `<div class="card real"><h3>🧬 NASA OSDR: ${t('cr_osdr_t')}</h3><p>${t('cr_osdr', { n: o.facts.length, terms: o.terms.join(', '), date: fmtDate(o.retrieved) })}</p>
      <ul class="small">${o.facts.map(f => `<li><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.id)}</a>: ${esc(f.title)}</li>`).join('')}</ul></div>` : ''}
    <div class="card real"><h3>🌑🔴 ${t('cr_sites_t')}</h3><p>${t('cr_sites')}</p><ul class="small">${siteSources}</ul>
      ${d.sites.marsWeather && d.sites.marsWeather.meda ? `<p class="small">${t('cr_meda', { n: d.sites.marsWeather.meda.solsReturned })} <a href="${esc(d.sites.marsWeather.meda.url)}" target="_blank" rel="noopener">MEDA feed</a></p>` : ''}</div>
    ${csa ? `<div class="card"><span class="tag csa">CSA</span><h3>🥬 ${t('cr_csa_t')}</h3><p>${t('cr_csa')}</p><p><a href="${esc(csa.toolkit.url)}" target="_blank" rel="noopener">${esc(csa.toolkit.title)}</a></p></div>` : ''}
    <div class="card"><h3>🖼️ ${t('cr_images_t')}</h3><ul class="small">${(im ? im.images : []).filter(x => !x.apod).map(x => `<li>${esc(x.title)}, ${esc(x.credit)} (<a href="${esc(x.page)}" target="_blank" rel="noopener">${esc(x.nasaId)}</a>, NASA Image and Video Library)</li>`).join('')}</ul>
      <p class="small">${t('cr_images_note')}</p>
      <p class="small"><a href="https://trek.nasa.gov/mars/" target="_blank" rel="noopener">NASA Mars Trek</a> · <a href="https://apod.nasa.gov/" target="_blank" rel="noopener">APOD</a> · <a href="https://science.nasa.gov/mission/mars-2020-perseverance/" target="_blank" rel="noopener">Perseverance</a></p></div>
    <div class="card"><h3>✅ ${t('cr_realsim_t')}</h3><div class="table-wrap"><table>
      <tr><th>${t('tag_real')}</th><td>${t('cr_real_list')}</td></tr>
      <tr><th>${t('tag_simulated')}</th><td>${t('cr_sim_list')}</td></tr>
      <tr><th>${t('cr_game_t')}</th><td>${t('cr_game_list')}</td></tr></table></div></div>
    <div class="card"><h3>🧑‍💻 ${t('cr_code_t')}</h3><p>${t('cr_code')}</p></div>
  </section>`;
}
const TERMS = ['power', 'oxygen', 'shield', 'food', 'health', 'condition', 'dose', 'issday', 'sol', 'flare', 'cme', 'sep', 'forecast', 'delay', 'science', 'greenhouse', 'microgravity', 'regolith', 'donki', 'osdr', 'radlab'];
function glossary() {
  return `<section><h2>📖 ${t('nav_glossary')}</h2><dl class="gloss">${TERMS.map(k => `<div class="card"><dt>${t('g_' + k + '_t')} ${sayBtn(t('g_' + k + '_t') + '. ' + t('g_' + k + '_d'))}</dt><dd>${t('g_' + k + '_d')}</dd></div>`).join('')}</dl>
    <button class="btn" data-act="back">◀ ${t('back')}</button></section>`;
}
function scores() {
  const list = store.getScores();
  return `<section><h2>🏆 ${t('home_scores')}</h2>${list.length ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>${t('score')}</th><th>${t('setup_site')}</th><th>${t('setup_diff')}</th><th>${t('setup_seed')}</th><th>${t('days_survived')}</th><th>🏅</th></tr></thead><tbody>
    ${list.slice(0, 25).map((r, i) => `<tr><td>${i + 1}</td><td><b>${r.score}</b></td><td>${r.site === 'moon' ? '🌑' : '🔴'}</td><td>${t('diff_' + r.difficulty)}</td><td><code>${esc(r.seed)}</code></td><td>${r.days}${r.result === 'win' ? ' ✅' : ''}</td><td>${(r.badges || []).map(b => t('badge_' + b + '_i')).join('')}</td></tr>`).join('')}</tbody></table></div>`
    : `<p class="muted">${t('scores_empty')}</p>`}<p class="muted small">${t('scores_local')}</p><button class="btn" data-act="home">🏠 ${t('nav_home')}</button></section>`;
}
function classroom() {
  const c = app.setup, res = store.getClassResults().filter(r => r.seed === c.seed).sort((a, b) => b.score - a.score);
  const link = shareLink(c.seed, c.site, c.difficulty);
  const csaLinks = (app.data.csa_food ? app.data.csa_food.classroom : []).map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a> (CSA)</li>`).join('');
  return `<section class="classroom"><h2>🍎 ${t('home_class')}</h2><p class="lead">${t('class_intro')}</p>
    <div class="grid3">
      <label>${t('setup_site')}<select id="cSite"><option value="moon" ${c.site === 'moon' ? 'selected' : ''}>🌑 ${esc(L(app.data.sites.moon.name))}</option><option value="mars" ${c.site === 'mars' ? 'selected' : ''}>🔴 ${esc(L(app.data.sites.mars.name))}</option></select></label>
      <label>${t('setup_diff')}<select id="cDiff">${['cadet', 'explorer', 'commander'].map(k => `<option value="${k}" ${c.difficulty === k ? 'selected' : ''}>${t('diff_' + k)}</option>`).join('')}</select></label>
      <label>${t('setup_seed')}<input id="cSeed" value="${esc(c.seed)}" maxlength="40"></label></div>
    <div class="class-code" aria-live="polite"><small>${t('class_code')}</small><b>${esc(c.seed)}</b><small>${c.site === 'moon' ? '🌑' : '🔴'} ${t('diff_' + c.difficulty)}</small></div>
    <div class="seed-row"><input readonly value="${esc(link)}" aria-label="${t('share_seed')}" id="classLink"><button class="btn" data-act="copyClass">📋 ${t('copy')}</button><button class="btn" data-act="reseedClass">🎲</button></div>
    <button class="btn big primary" data-act="startClass">🚀 ${t('class_start')}</button>
    <div class="card"><h3>📊 ${t('class_results')}</h3>${res.length ? `<div class="table-wrap"><table><thead><tr><th>${t('class_name')}</th><th>${t('score')}</th><th>${t('days_survived')}</th><th>${t('res_health')}</th><th>🔬</th></tr></thead><tbody>${res.map(r => `<tr><td>${esc(r.name)}</td><td><b>${r.score}</b></td><td>${r.days}${r.result === 'win' ? ' ✅' : ''}</td><td>${Math.round(r.health)}</td><td>${r.science}</td></tr>`).join('')}</tbody></table></div>
      <button class="btn" data-act="clearClass">🗑️ ${t('class_clear')}</button>` : `<p class="muted">${t('class_none')}</p>`}</div>
    <div class="card"><h3>💬 ${t('class_discuss')}</h3><ol>${[1, 2, 3, 4, 5].map(i => `<li>${t('class_q' + i)}</li>`).join('')}</ol></div>
    <div class="card"><h3>🧑‍🏫 ${t('class_resources')}</h3><ul>${csaLinks}
      <li><a href="https://kauai.ccmc.gsfc.nasa.gov/DONKI/" target="_blank" rel="noopener">NASA DONKI</a></li><li><a href="https://osdr.nasa.gov/bio/" target="_blank" rel="noopener">NASA OSDR</a></li><li><a href="https://www.nasa.gov/stem/" target="_blank" rel="noopener">NASA STEM</a></li></ul></div>
    <button class="btn" data-act="home">🏠 ${t('nav_home')}</button></section>`;
}
function settings() {
  const s = app.settings;
  const tog = (key, label, val) => `<div class="act"><div class="act-txt"><b>${label}</b></div><div class="act-ctl"><button class="switch ${val ? 'on' : ''}" role="switch" aria-checked="${!!val}" data-act="setting" data-key="${key}" aria-label="${label}"><span></span></button></div></div>`;
  const rm = s.reducedMotion == null ? reduced() : s.reducedMotion;
  return `<section><h2>⚙️ ${t('nav_settings')}</h2><div class="card">
    <div class="act"><div class="act-txt"><b>${t('nav_lang')}</b></div><div class="act-ctl"><button class="btn ${getLang() === 'en' ? 'primary' : ''}" data-act="setLang" data-lang="en">English</button><button class="btn ${getLang() === 'pt' ? 'primary' : ''}" data-act="setLang" data-lang="pt">Português</button></div></div>
    ${speechSupported() ? tog('readAloud', t('set_read'), s.readAloud) : `<p class="muted">${t('set_read_na')}</p>`}
    ${tog('sound', t('set_sound'), s.sound)}
    ${tog('contrast', t('set_contrast'), s.contrast)}
    ${tog('reducedMotion', t('set_motion'), rm)}
    ${tog('bigText', t('set_bigtext'), s.bigText)}
    </div><p class="muted small">${t('set_privacy')}</p><button class="btn" data-act="back">◀ ${t('back')}</button></section>`;
}

// ------------------------------------------------------------------ tutorial
const TUT = [
  { key: 'tut_1' }, { key: 'tut_2', target: '.gauges' }, { key: 'tut_3', target: '#g-power' }, { key: 'tut_4', target: '#g-oxygen' },
  { key: 'tut_5', target: '#g-shield' }, { key: 'tut_6', target: '#g-food' }, { key: 'tut_7', target: '#actions' }, { key: 'tut_8', target: '#forecast' },
  { key: 'tut_9', target: '#earthPanel' }, { key: 'tut_10', target: '#endDay' }
];
function startTutorial() {
  app.tutorial = { step: 0 };
  app.classroom = false;
  const fe = app.data.donki_events.events.find(e => e.type === 'FLR' && /^X8/.test(e.classType)) || app.data.donki_events.events[0];
  startMission({ site: 'moon', difficulty: 'cadet', seed: 'ORBI-TUTORIAL', mode: 'tutorial', featured: { event: fe, source: 'archived', retrieved: app.data.donki_events.retrieved }, days: 5 });
}
function showTutorial() {
  document.querySelectorAll('.tut-focus').forEach(e => e.classList.remove('tut-focus'));
  $('#tut') && $('#tut').remove();
  const tu = app.tutorial; if (!tu) return;
  const st = TUT[tu.step];
  if (!st) { app.tutorial = null; return; }
  if (st.target) { const el = $(st.target); if (el) { el.classList.add('tut-focus'); el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); } }
  const div = document.createElement('div');
  div.id = 'tut'; div.className = 'tut'; div.setAttribute('role', 'dialog'); div.setAttribute('aria-live', 'polite');
  const text = t(st.key);
  div.innerHTML = `${orbiSVG(tu.step === 4 ? 'think' : 'happy', 56)}<div><p>${text}</p><div class="tut-btns">
    <button class="btn primary" data-act="tutNext">${tu.step === TUT.length - 1 ? t('tut_go') : t('tut_next')} ▶</button>
    <button class="btn" data-act="tutSkip">${t('tut_skip')}</button> <span class="muted small">${tu.step + 1}/${TUT.length}</span></div></div>`;
  document.body.appendChild(div);
  div.querySelector('.btn.primary').focus({ preventScroll: true });
  if (app.settings.readAloud) speak(text);
}
function endTutorialOverlay() {
  document.querySelectorAll('.tut-focus').forEach(e => e.classList.remove('tut-focus'));
  $('#tut') && $('#tut').remove();
  if (app.tutorial) app.tutorial.step = TUT.length;
}

// ------------------------------------------------------------------ misc
function shareLink(seed, site, diff) {
  const u = new URL(location.href);
  u.search = ''; u.hash = '';
  u.searchParams.set('seed', seed); u.searchParams.set('site', site); u.searchParams.set('diff', diff);
  return u.toString();
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast(t('copied')); }
  catch { toast(text); }
}
function toast(msg) {
  const d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = msg;
  document.body.appendChild(d); setTimeout(() => d.remove(), 3500);
}
function showTerm(key) {
  modal(`<h2>${t('g_' + key + '_t')}</h2><p>${t('g_' + key + '_d')}</p>${sayBtn(t('g_' + key + '_t') + '. ' + t('g_' + key + '_d'))}<button class="btn primary" data-act="closeModal">${t('ok')}</button>`);
  if (app.settings.readAloud) speak(t('g_' + key + '_t') + '. ' + t('g_' + key + '_d'));
}

// ------------------------------------------------------------------ events
async function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const act = b.dataset.act, k = b.dataset.k;
  sfx.click();
  switch (act) {
    case 'home': closeModal(); endTutorialOverlay(); app.tutorial = null; go('home'); break;
    case 'view': closeModal(); app.prevView = app.view === 'game' || app.view === 'debrief' ? app.view : 'home'; endTutorialOverlay(); go(b.dataset.view); break;
    case 'back': go(app.prevView && app.prevView !== 'game' ? app.prevView : app.state && !app.state.over ? 'game' : 'home'); break;
    case 'lang': await setLang(getLang() === 'pt' ? 'en' : 'pt'); app.settings = store.setSettings({ lang: getLang() }); rerender(); break;
    case 'setLang': await setLang(b.dataset.lang); app.settings = store.setSettings({ lang: getLang() }); rerender(); break;
    case 'toggleRead': app.settings = store.setSettings({ readAloud: !app.settings.readAloud }); if (!app.settings.readAloud) stopSpeaking(); rerender(); break;
    case 'setting': {
      const key = b.dataset.key;
      const cur = key === 'reducedMotion' ? reduced() : !!app.settings[key];
      app.settings = store.setSettings({ [key]: !cur }); applySettings(); go('settings', { keep: true }); break;
    }
    case 'say': speak(b.dataset.text); break;
    case 'new': app.setup = { ...app.setup, mode: 'normal', seed: randomSeedString() }; app.featured = null; app.classroom = false; app.tutorial = null; go('setup'); break;
    case 'resume': {
      const sv = store.load('current', null);
      if (sv && sv.state) { app.state = sv.state; app.featuredInfo = sv.featuredInfo; app.classroom = !!sv.classroom; app.alloc = defaultAlloc(); app.lastDelivered = []; go('game'); }
      break;
    }
    case 'tutorial': startTutorial(); break;
    case 'today': {
      app.featured = await todaysEvent(app.data);
      app.setup = { ...app.setup, mode: 'today', seed: `TODAY-${app.featured.event.date.slice(0, 10)}` };
      app.classroom = false; go('setup'); break;
    }
    case 'daily': app.setup = { ...app.setup, mode: 'daily', seed: dailySeed() }; app.featured = null; app.classroom = false; go('setup'); break;
    case 'pick': app.setup[b.dataset.field] = b.dataset.value; go('setup', { keep: true }); break;
    case 'reseed': app.setup.seed = randomSeedString(); go('setup', { keep: true }); break;
    case 'start': {
      const seed = ($('#seed').value || '').trim().slice(0, 40) || randomSeedString();
      app.setup.seed = seed;
      startMission({ ...app.setup, seed, featured: app.setup.mode === 'today' ? app.featured : null });
      break;
    }
    case 'plus': app.alloc[k] = (app.alloc[k] || 0) + 1; sfx.plus(); refreshActions(); focusAct(k, 'plus'); break;
    case 'minus': app.alloc[k] = Math.max(0, (app.alloc[k] || 0) - 1); sfx.minus(); refreshActions(); focusAct(k, 'minus'); break;
    case 'toggle': app.alloc[k] = app.alloc[k] ? 0 : 1; refreshActions(); focusAct(k, 'toggle'); break;
    case 'endDay': endTutorialOverlay(); endDay(); break;
    case 'closeReport': {
      closeModal();
      if (app.state.over) { finishMission(); break; }
      // keep yesterday's plan as a starting point (kids can tweak); tanks pour from yesterday's levels
      transitionTo(() => go('game'));
      sfx.pour();
      break;
    }
    case 'closeModal': closeModal(); break;
    case 'term': showTerm(b.dataset.term); break;
    case 'quit': store.save('current', app.state && !app.state.over ? { state: app.state, featuredInfo: app.featuredInfo, classroom: app.classroom } : null); endTutorialOverlay(); app.tutorial = null; go('home'); break;
    case 'share': copyText(shareLink(app.state ? app.state.seed : app.setup.seed, app.state ? app.state.site : app.setup.site, app.state ? app.state.difficulty : app.setup.difficulty)); break;
    case 'retryHint': case 'retry': {
      const s = app.state;
      startMission({ site: s.site, difficulty: s.difficulty, seed: s.seed, mode: s.mode === 'tutorial' ? 'normal' : s.mode, featured: s.mode === 'today' ? app.featuredInfo : null, hint: act === 'retryHint' ? app.debrief.hint : null });
      break;
    }
    case 'tutNext': app.tutorial.step++; if (app.tutorial.step >= TUT.length) { endTutorialOverlay(); } else showTutorial(); break;
    case 'tutSkip': endTutorialOverlay(); break;
    case 'copyClass': copyText($('#classLink').value); break;
    case 'reseedClass': app.setup.seed = randomSeedString(); go('classroom', { keep: true }); break;
    case 'startClass': app.classroom = true; startMission({ site: app.setup.site, difficulty: app.setup.difficulty, seed: app.setup.seed, mode: 'normal' }); break;
    case 'saveClass': {
      const name = ($('#studentName').value || '').trim().slice(0, 20) || '?';
      const s = app.state, sc = app.score;
      store.addClassResult({ name, seed: s.seed, site: s.site, difficulty: s.difficulty, score: sc.score, days: sc.days, health: sc.health, science: sc.science, result: s.result });
      app.setup = { ...app.setup, seed: s.seed, site: s.site, difficulty: s.difficulty };
      toast(t('class_saved')); go('classroom'); break;
    }
    case 'clearClass': store.clearClassResults(); go('classroom', { keep: true }); break;
  }
}
function focusAct(k, which) {
  const el = $(`#act-${k} [data-act="${which}"]`) || $(`#act-${k} button:not([disabled])`);
  if (el) el.focus({ preventScroll: true });
}
function onChange(e) {
  const id = e.target.id;
  if (id === 'cSite') { app.setup.site = e.target.value; go('classroom', { keep: true }); }
  if (id === 'cDiff') { app.setup.difficulty = e.target.value; go('classroom', { keep: true }); }
  if (id === 'cSeed') { app.setup.seed = e.target.value.trim().slice(0, 40) || randomSeedString(); go('classroom', { keep: true }); }
}
function onKey(e) {
  if (e.key === 'Escape') { if ($('.modal') && !(app.report && app.view === 'game' && $('.modal [data-act="closeReport"]'))) closeModal(); }
}
function rerender() { go(app.view, { keep: true }); }

boot();
