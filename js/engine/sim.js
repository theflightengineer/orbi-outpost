// Orbi's Outpost — simulation engine. PURE: no DOM, no Date.now(), no Math.random().
// Everything random comes from the seeded RNG whose state lives inside the game state, so the
// same seed + same choices always produce the same mission. All numbers come from balance.json.

import { makeRng, hashSeed } from './rng.js';
import { eventSeverity, stormRawDose, protection, backgroundDose, severityStars } from './spaceweather.js';

export const ACTIONS = ['lifeSupport', 'shield', 'greenhouse', 'science', 'comms', 'maintenance'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = v => Math.round(v * 10) / 10;
const clone = o => JSON.parse(JSON.stringify(o));

/** Pick storm days spread over the mission (never on day 1–2, so kids can learn first). */
function pickStormDays(rng, days, n, firstFixed) {
  const out = [];
  const start = 3, span = days - start + 1;
  const seg = span / n;
  for (let i = 0; i < n; i++) {
    const lo = start + Math.floor(i * seg), hi = Math.max(lo, start + Math.floor((i + 1) * seg) - 1);
    out.push(i === 0 && firstFixed ? start : rng.int(lo, hi));
  }
  return out;
}

const slimEvent = e => ({ id: e.id, type: e.type, date: e.date, classType: e.classType || null, speed: e.speed || null,
  linkedFlareClass: e.linkedFlareClass || null, link: e.link });

/**
 * Create a new mission.
 * @param {object} o
 * @param {string} o.seed       any string ("ROVER-4821", "DAY-2026-11-14")
 * @param {'moon'|'mars'} o.site
 * @param {'cadet'|'explorer'|'commander'} o.difficulty
 * @param {Array} o.events      real DONKI events (data/donki_events.json -> events)
 * @param {object} o.balance    data/balance.json
 * @param {object} [o.featuredEvent] for "Today's mission": this real event is the first storm (day 3)
 * @param {string} [o.mode]     'normal' | 'today' | 'daily' | 'tutorial'
 */
export function createGame({ seed, site = 'moon', difficulty = 'cadet', events, balance: B, featuredEvent = null, mode = 'normal', days = null, hint = null }) {
  const D = B.difficulty[difficulty];
  if (!D) throw new Error('unknown difficulty ' + difficulty);
  if (!B.sites[site]) throw new Error('unknown site ' + site);
  const rng = makeRng(hashSeed(`${seed}|${site}|${difficulty}|${mode}`));
  const length = days || D.days;
  const nStorms = Math.max(1, Math.round(D.storms * length / D.days));
  const stormDays = pickStormDays(rng, length, nStorms, !!featuredEvent);
  let pool = rng.shuffle(events.filter(e => ['FLR', 'CME', 'SEP'].includes(e.type) && (!featuredEvent || e.id !== featuredEvent.id)));
  const chosen = pool.slice(0, nStorms);
  if (featuredEvent) chosen[0] = featuredEvent;
  const storms = stormDays.map((day, i) => ({ day, event: slimEvent(chosen[i % chosen.length]), severity: eventSeverity(chosen[i % chosen.length], B.radiation), featured: !!(featuredEvent && i === 0) }));
  const S = B.sites[site];
  // Moon: where are we in the ~29.5-day light cycle? Cadet always starts in bright days.
  const sunPhase = site === 'moon' ? (difficulty === 'cadet' ? rng.next() * 4 - 2 : rng.next() * S.lunarPeriod) : 0;
  const st = B.start;
  return {
    v: 1, seed: String(seed), site, difficulty, mode, length, day: 1, sunPhase,
    rngState: rng.state,
    res: { power: st.power, oxygen: st.oxygen, shield: st.shield, food: st.food, condition: st.condition, dust: st.dust },
    dose: 0, evaDose: 0, hunger: 0, health: 100,
    sciencePending: 0, scienceSent: 0, commsCalls: 0, blackoutDays: 0,
    forecastBoostUntil: 0, dustStormUntil: 0,
    storms, inbox: [], history: [], over: false, result: null, cause: null, hint
  };
}

/** Sunlight factor 0..1 for a given day (before dust). */
export function sunFactor(s, day, B) {
  const S = B.sites[s.site];
  if (s.site === 'moon') {
    const c = 0.5 + 0.5 * Math.cos(2 * Math.PI * (day - 1 + s.sunPhase) / S.lunarPeriod);
    return S.minSun + (1 - S.minSun) * c;
  }
  return s.dustStormUntil >= day ? S.dustStormSun : 1;
}

/** Equipment efficiency: worn-out equipment works worse (compounding cost of skipping maintenance). */
export function efficiency(s, B) {
  const c = s.res.condition, lim = B.condition.efficiencyBelow;
  return c >= lim ? 1 : 0.5 + 0.5 * c / lim;
}

/** Forecast lead time in days for the current state. */
export function forecastLead(s, B) {
  const D = B.difficulty[s.difficulty];
  const boost = s.forecastBoostUntil >= s.day;
  return Math.max(0, D.forecastLead + (boost ? D.commsLeadBonus : 0) - (s.site === 'mars' ? D.marsForecastPenalty : 0));
}

/** Storm warnings the player can see today. Real events are hidden until they hit (only type + strength shown). */
export function getForecast(s, B) {
  const D = B.difficulty[s.difficulty];
  const lead = forecastLead(s, B);
  const precise = !D.severityRange || s.forecastBoostUntil >= s.day;
  return s.storms.filter(x => x.day >= s.day && x.day - s.day <= lead).map(x => {
    const stars = severityStars(x.severity);
    return { inDays: x.day - s.day, day: x.day, type: x.event.type, stars,
      range: precise ? [stars, stars] : [clamp(stars - D.severityRange, 1, 5), clamp(stars + D.severityRange, 1, 5)] };
  });
}

/** Clamp an allocation to the rules: per-action max, daily block limit, and power you actually have. */
export function normalizeAlloc(s, alloc, B) {
  const D = B.difficulty[s.difficulty];
  const a = {};
  for (const k of ACTIONS) a[k] = clamp(Math.floor(Number(alloc && alloc[k]) || 0), 0, B.actions[k].max);
  if (D.greenhouseToggle) a.greenhouse = Math.min(a.greenhouse, 1);
  const affordable = Math.min(B.maxBlocksPerDay, Math.floor(s.res.power / B.powerPerBlock));
  const order = ['science', 'comms', 'maintenance', 'shield', 'greenhouse', 'lifeSupport']; // trimmed first → last
  let total = ACTIONS.reduce((t, k) => t + a[k], 0);
  for (const k of order) { while (total > affordable && a[k] > 0) { a[k]--; total--; } }
  return a;
}

export const blocksUsed = a => ACTIONS.reduce((t, k) => t + (a[k] || 0), 0);

/**
 * Play one day/sol. Returns { state, report }. Does not mutate the input state.
 * Order: spend power → action benefits → sunlight → space weather (REAL) → simulated events → crew needs → checks.
 * opts.preview = true skips storms and random events (used for the "what will happen" preview).
 */
export function stepDay(prev, allocIn, B, opts = {}) {
  const s = clone(prev);
  if (s.over) return { state: s, report: null };
  const D = B.difficulty[s.difficulty], S = B.sites[s.site], A = B.actions, R = B.radiation, C = B.condition;
  const rng = makeRng(s.rngState);
  const a = normalizeAlloc(s, allocIn, B);
  const ev = [];
  const before = { ...s.res, dose: s.dose, health: s.health };
  const scale = D.simEventScale;

  // remember which storms were forecast (for the debrief)
  if (!opts.preview) for (const f of getForecast(s, B)) { const st = s.storms.find(x => x.day === f.day); if (st && st.warnedDay == null) st.warnedDay = s.day; }

  // 1) spend power on actions
  s.res.power -= blocksUsed(a) * B.powerPerBlock;
  const eff = efficiency(s, B);

  // 2) action benefits (and their side costs)
  s.res.oxygen += a.lifeSupport * A.lifeSupport.oxygen + a.greenhouse * A.greenhouse.oxygen - a.science * A.science.oxygen;
  s.res.shield += a.shield * A.shield.shield;
  s.res.food += a.greenhouse * A.greenhouse.food;
  s.res.condition += a.maintenance * A.maintenance.condition - a.science * A.science.wear;
  s.res.dust = Math.max(0, s.res.dust - a.maintenance * A.maintenance.clean);
  s.res.shield = clamp(s.res.shield, 0, 100);
  s.res.condition = clamp(s.res.condition, 0, 100);
  const bg = backgroundDose(s.site, R);
  if (a.science) {
    const pts = Math.round(a.science * A.science.points * eff);
    if (D.scienceNeedsTransmit) s.sciencePending += pts; else s.scienceSent += pts;
    const eva = a.science * A.science.evaDose * bg;
    s.dose += eva; s.evaDose += eva;
    ev.push({ kind: 'science', points: pts, eva: r1(eva) });
  }
  if (a.comms) {
    s.commsCalls++;
    const sent = s.sciencePending;
    s.scienceSent += sent; s.sciencePending = 0;
    let delay = S.commDelayDays;
    const [l0, l1] = S.lightSeconds;
    const lightSeconds = r1(l0 + (l1 - l0) * rng.next());
    if (!opts.preview && rng.chance(B.earth.messageDelayChance * scale)) { delay++; ev.push({ kind: 'msgDelayed', simulated: true }); }
    const low = ['oxygen', 'power', 'food', 'shield'].sort((x, y) => s.res[x] - s.res[y])[0];
    s.inbox.push({ sent: s.day, arrive: s.day + delay, tip: `tip_${low}` });
    ev.push({ kind: 'comms', sent, lightSeconds, arriveDay: s.day + delay });
  }

  // 3) sunlight → power
  const sun = sunFactor(s, s.day, B);
  const gen = S.solarPeak * sun * (1 - s.res.dust) * eff;
  const cold = s.site === 'moon' ? (sun < S.coldBelowSun ? S.coldDraw : 0) : S.coldDraw;
  s.res.power += gen - S.baseDraw - cold;

  // 4) REAL space weather from DONKI
  const prot = protection(s.res.shield, R);
  const storm = opts.preview ? null : s.storms.find(x => x.day === s.day);
  if (storm) {
    const raw = stormRawDose(storm.severity, s.site, R);
    const got = raw * (1 - prot);
    s.dose += got;
    storm.hit = { raw, got: r1(got), shieldAtHit: Math.round(s.res.shield), protection: Math.round(prot * 100) };
    s.res.shield = Math.max(0, s.res.shield - storm.severity * R.shieldDamagePerSeverity);
    ev.push({ kind: 'storm', real: true, event: storm.event, severity: storm.severity, stars: severityStars(storm.severity), ...storm.hit, warned: storm.warnedDay != null });
  }
  s.dose += bg * (1 - prot);

  // 5) SIMULATED events (not real data)
  if (!opts.preview) {
    const glitchP = (C.glitchBase + C.glitchPerMissing * Math.max(0, 60 - s.res.condition)) * scale;
    if (rng.chance(glitchP)) {
      if (rng.chance(0.5)) { s.res.power -= C.glitchPower; ev.push({ kind: 'glitch', simulated: true, what: 'power', amount: C.glitchPower }); }
      else { s.res.oxygen -= C.glitchOxygen; ev.push({ kind: 'glitch', simulated: true, what: 'oxygen', amount: C.glitchOxygen }); }
    }
    if (rng.chance(S.panelDustChance * scale)) { s.res.dust = Math.min(0.8, s.res.dust + 0.15); ev.push({ kind: 'panelDust', simulated: true }); }
    if (s.site === 'mars' && s.dustStormUntil < s.day && rng.chance(S.dustStormChance * scale)) {
      const len = rng.int(S.dustStormDays[0], S.dustStormDays[1]);
      s.dustStormUntil = s.day + len;
      ev.push({ kind: 'dustStorm', simulated: true, days: len });
    }
  }

  // 6) crew needs + wear and tear
  s.res.oxygen -= B.crew.oxygenPerDay;
  s.res.food -= B.crew.foodPerDay;
  s.res.shield -= B.passive.shieldDecay;
  s.res.condition -= B.passive.conditionWear;
  s.res.dust = Math.min(0.8, s.res.dust + B.passive.dustPerDay);
  if (s.res.power <= 0) {
    s.res.power = 0; s.blackoutDays++;
    s.res.oxygen -= B.passive.blackoutOxygenLoss;
    ev.push({ kind: 'blackout' });
  }
  for (const k of ['power', 'oxygen', 'shield', 'food', 'condition']) s.res[k] = r1(clamp(s.res[k], 0, 100));
  s.res.dust = Math.round(s.res.dust * 100) / 100;
  if (s.res.food <= 0 && !D.foodCanEnd) { s.hunger += D.hungerDamage; ev.push({ kind: 'hungry' }); }
  s.dose = Math.round(s.dose * 100) / 100;
  s.health = r1(clamp(100 - 100 * s.dose / D.doseLimit - s.hunger, 0, 100));

  s.history.push({ day: s.day, power: s.res.power, oxygen: s.res.oxygen, shield: s.res.shield, food: s.res.food,
    condition: s.res.condition, dose: s.dose, health: s.health, sun: r1(sun), gen: r1(gen), alloc: a, events: ev.map(e => e.kind) });

  // 7) end conditions
  if (s.res.oxygen <= 0) { s.over = true; s.result = 'lose'; s.cause = 'oxygen'; }
  else if (s.res.food <= 0 && D.foodCanEnd) { s.over = true; s.result = 'lose'; s.cause = 'food'; }
  else if (s.health <= 0) { s.over = true; s.result = 'lose'; s.cause = s.hunger > 100 * s.dose / D.doseLimit ? 'hunger' : 'radiation'; }
  else if (s.day >= s.length) { s.over = true; s.result = 'win'; s.cause = null; }

  // 8) deliver Earth messages that have arrived (comm delay!)
  const delivered = s.inbox.filter(m => m.arrive <= s.day);
  s.inbox = s.inbox.filter(m => m.arrive > s.day);
  if (delivered.length) s.forecastBoostUntil = s.day + B.earth.forecastBoostDays;

  s.rngState = rng.state;
  const report = { day: s.day, alloc: a, events: ev, delivered, before, after: { ...s.res, dose: s.dose, health: s.health }, sun: r1(sun), gen: r1(gen) };
  if (!s.over) s.day++;
  return { state: s, report };
}

/** What will probably happen if you end the day with this plan (no surprises counted). */
export function previewDay(s, alloc, B) {
  const { report } = stepDay(s, alloc, B, { preview: true });
  return report;
}

export function computeScore(s, B) {
  const D = B.difficulty[s.difficulty], K = B.score, G = B.badges;
  const days = s.history.length;
  const win = s.result === 'win';
  const base = days * K.perDay + s.scienceSent + Math.round(s.health) * K.perHealth + (win ? K.winBonus : 0);
  const score = Math.round(base * D.scoreMultiplier);
  const minOf = k => Math.min(...s.history.map(h => h[k]));
  const hits = s.storms.filter(x => x.hit);
  const badges = [];
  if (win) badges.push('missionComplete');
  if (hits.length && hits.length === s.storms.length && s.health >= G.stormSurvivorHealth) badges.push('stormSurvivor');
  // "Keep X healthy all mission" badges are only earned by finishing the mission (no free badges for doing nothing).
  if (win && s.blackoutDays === 0 && minOf('power') >= G.energySaverMin) badges.push('energySaver');
  if (s.scienceSent >= G.scienceStar * s.length / 20) badges.push('scienceStar');
  if (win && minOf('food') >= G.greenThumbMin) badges.push('greenThumb');
  if (s.commsCalls >= Math.ceil(G.goodListenerCalls * s.length / 20)) badges.push('goodListener');
  if (win && minOf('condition') >= G.mechanicMin) badges.push('mechanic');
  return { score, badges, days, science: s.scienceSent, health: s.health };
}

/** Real-world comparison for the debrief, using RadLab ISS DOSTEL measurements. */
export function doseComparison(s, B) {
  const R = B.radiation;
  const issDailyUGy = R.issRate_uGy_per_h * 24;
  const totalUGy = s.dose * issDailyUGy;
  return { doseUnits: r1(s.dose), totalMilliGray: Math.round(totalUGy / 10) / 100, issDays: r1(s.dose), issDailyMicroGray: Math.round(issDailyUGy), missionDays: s.history.length };
}

/**
 * Explain what happened as a cause-and-effect chain the UI can translate.
 * Returns { result, cause, chain:[{day,key,params}], hint, osdrTopic, storms }
 */
export function analyzeDebrief(s, B) {
  const D = B.difficulty[s.difficulty];
  const H = s.history;
  const chain = [];
  const add = (day, key, params = {}) => chain.push({ day, key, params });
  const stormInfo = s.storms.filter(x => x.hit).map(x => ({ day: x.day, event: x.event, stars: severityStars(x.severity), ...x.hit, warned: x.warnedDay != null, featured: x.featured }));
  let hint = null, osdrTopic = 'muscle';

  if (s.cause === 'radiation') {
    osdrTopic = 'radiation'; hint = 'hint_shield';
    for (const st of stormInfo) add(st.day, st.shieldAtHit < 50 ? 'chain_storm_lowshield' : 'chain_storm_ok', { shield: st.shieldAtHit, got: st.got, stars: st.stars, date: st.event.date.slice(0, 10) });
    const unwarned = stormInfo.filter(x => !x.warned);
    if (unwarned.length) { add(unwarned[0].day, 'chain_no_forecast'); hint = 'hint_comms'; }
    if (s.evaDose > D.doseLimit * 0.25) add(H.length, 'chain_eva_dose', { dose: r1(s.evaDose) });
    add(H.length, 'chain_dose_limit', { limit: D.doseLimit });
  } else if (s.cause === 'oxygen') {
    osdrTopic = 'body';
    const firstBlackout = H.find(h => h.events.includes('blackout'));
    if (firstBlackout) {
      hint = 'hint_power';
      const dark = H.filter(h => h.day <= firstBlackout.day && h.sun < 0.5);
      if (dark.length) add(dark[0].day, s.site === 'mars' ? 'chain_dust_storm' : 'chain_dark_days', { n: dark.length });
      const worn = H.find(h => h.condition < B.condition.efficiencyBelow);
      if (worn && worn.day <= firstBlackout.day) { add(worn.day, 'chain_skipped_maintenance', { condition: worn.condition }); hint = 'hint_maintenance'; }
      const glitches = H.filter(h => h.day <= firstBlackout.day && h.events.includes('glitch'));
      if (glitches.length) add(glitches[0].day, 'chain_glitch', { n: glitches.length });
      const spend = H.filter(h => h.day <= firstBlackout.day && blocksUsed(h.alloc) >= 5);
      if (spend.length) add(spend[0].day, 'chain_big_spend', { n: spend.length });
      add(firstBlackout.day, 'chain_blackout');
    } else {
      hint = 'hint_oxygen';
      const avg = H.reduce((t, h) => t + h.alloc.lifeSupport, 0) / H.length;
      add(1, 'chain_low_lifesupport', { avg: r1(avg), need: r1(B.crew.oxygenPerDay / B.actions.lifeSupport.oxygen) });
      const sci = H.reduce((t, h) => t + h.alloc.science, 0);
      if (sci) add(1, 'chain_science_oxygen', { o2: sci * B.actions.science.oxygen });
    }
    add(H.length, 'chain_oxygen_out');
  } else if (s.cause === 'food' || s.cause === 'hunger') {
    osdrTopic = 'food'; hint = 'hint_food';
    const runs = H.reduce((t, h) => t + h.alloc.greenhouse, 0);
    add(1, 'chain_greenhouse', { runs, days: H.length, need: r1(B.crew.foodPerDay / B.actions.greenhouse.food * H.length) });
    const firstZero = H.find(h => h.food <= 0);
    add(firstZero ? firstZero.day : H.length, s.cause === 'food' ? 'chain_food_out' : 'chain_hungry');
  } else {
    osdrTopic = ['muscle', 'bone', 'immune', 'food', 'radiation'][s.history.length % 5];
    for (const st of stormInfo) add(st.day, st.shieldAtHit < 50 ? 'chain_storm_lowshield' : 'chain_storm_ok', { shield: st.shieldAtHit, got: st.got, stars: st.stars, date: st.event.date.slice(0, 10) });
    const keys = ['power', 'oxygen', 'food', 'shield'];
    let close = null;
    for (const h of H) for (const k of keys) if (!close || h[k] < close.v) close = { day: h.day, k, v: h[k] };
    if (close && close.v < 25) add(close.day, 'chain_close_call', { res: close.k, v: close.v });
    add(H.length, 'chain_win');
  }
  chain.sort((x, y) => x.day - y.day);
  return { result: s.result, cause: s.cause, chain: chain.slice(0, 7), hint, osdrTopic, storms: stormInfo, dose: doseComparison(s, B) };
}
