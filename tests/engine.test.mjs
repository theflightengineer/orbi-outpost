import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeRng, hashSeed, dailySeed, randomSeedString } from '../js/engine/rng.js';
import { flareFlux, eventSeverity, stormRawDose, protection, shieldedDose } from '../js/engine/spaceweather.js';
import { createGame, stepDay, normalizeAlloc, previewDay, getForecast, analyzeDebrief, computeScore, sunFactor, doseComparison } from '../js/engine/sim.js';
import { balance as B, events } from './strategies.mjs';

const R = B.radiation;
const none = { lifeSupport: 0, shield: 0, greenhouse: 0, science: 0, comms: 0, maintenance: 0 };
const game = (o = {}) => createGame({ seed: 'TEST-1', site: 'moon', difficulty: 'explorer', events, balance: B, ...o });

// ---------------------------------------------------------------- RNG & seeds
test('seeded RNG is reproducible and seed-sensitive', () => {
  const a = makeRng(hashSeed('ROVER-1234')), b = makeRng(hashSeed('ROVER-1234')), c = makeRng(hashSeed('ROVER-1235'));
  const sa = Array.from({ length: 20 }, () => a.next()), sb = Array.from({ length: 20 }, () => b.next()), sc = Array.from({ length: 20 }, () => c.next());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  assert.ok(sa.every(x => x >= 0 && x < 1));
});
test('daily seed is the same all day and shareable seeds look friendly', () => {
  assert.equal(dailySeed(new Date('2026-11-14T01:00:00Z')), dailySeed(new Date('2026-11-14T23:00:00Z')));
  assert.match(randomSeedString(0.123), /^[A-Z]+-\d{4}$/);
});
test('same seed + same choices => identical mission (replayable for classmates)', () => {
  const plan = { lifeSupport: 1, shield: 1, greenhouse: 1, science: 1, comms: 1, maintenance: 0 };
  const run = () => { let s = game({ difficulty: 'commander', site: 'mars' }); for (let i = 0; i < 12; i++) s = stepDay(s, plan, B).state; return s; };
  assert.deepEqual(run(), run());
  const other = (() => { let s = game({ seed: 'OTHER', difficulty: 'commander', site: 'mars' }); for (let i = 0; i < 12; i++) s = stepDay(s, plan, B).state; return s; })();
  assert.notDeepEqual(run().storms, other.storms);
});
test('stepDay does not mutate its input', () => {
  const s = game(); const copy = JSON.stringify(s);
  stepDay(s, { lifeSupport: 2 }, B);
  assert.equal(JSON.stringify(s), copy);
});

// ---------------------------------------------------------------- resource math
test('one day of resource math (preview: no storms, no random events)', () => {
  const s = game();
  const a = { ...none, lifeSupport: 1, greenhouse: 1, shield: 1 };
  const r = previewDay(s, a, B);
  const S = B.sites.moon, sun = sunFactor(s, 1, B);
  const gen = S.solarPeak * sun * (1 - B.start.dust);
  const cold = sun < S.coldBelowSun ? S.coldDraw : 0;
  const expPower = B.start.power - 3 * B.powerPerBlock + gen - S.baseDraw - cold;
  assert.ok(Math.abs(r.after.power - Math.min(100, expPower)) < 0.11, `power ${r.after.power} vs ${expPower}`);
  assert.equal(r.after.oxygen, B.start.oxygen + B.actions.lifeSupport.oxygen + B.actions.greenhouse.oxygen - B.crew.oxygenPerDay);
  assert.equal(r.after.food, B.start.food + B.actions.greenhouse.food - B.crew.foodPerDay);
  assert.equal(r.after.shield, B.start.shield + B.actions.shield.shield - B.passive.shieldDecay);
});
test('every action has a cost: each block spends power, science also costs oxygen and wear', () => {
  const s = game();
  const base = previewDay(s, none, B);
  for (const k of ['lifeSupport', 'shield', 'greenhouse', 'science', 'comms', 'maintenance']) {
    const r = previewDay(s, { ...none, [k]: 1 }, B);
    assert.ok(r.after.power < base.after.power || base.after.power === 100, `${k} must cost power`);
  }
  const sci = previewDay(s, { ...none, science: 1 }, B);
  assert.ok(sci.after.oxygen < base.after.oxygen, 'science uses oxygen');
  assert.ok(sci.after.condition < base.after.condition, 'science wears equipment');
  assert.ok(sci.after.dose > base.after.dose, 'science outside adds dose (EVA)');
});
test('allocation rules: per-action max, daily limit, cannot spend power you do not have, Cadet greenhouse is a toggle', () => {
  const s = game();
  const a = normalizeAlloc(s, { lifeSupport: 9, shield: 9, greenhouse: 9, science: 9, comms: 9, maintenance: 9 }, B);
  assert.ok(a.lifeSupport <= 3 && a.comms <= 1);
  assert.ok(Object.values(a).reduce((x, y) => x + y, 0) <= B.maxBlocksPerDay);
  const poor = { ...s, res: { ...s.res, power: 25 } };
  const p = normalizeAlloc(poor, { lifeSupport: 3, science: 3 }, B);
  assert.equal(p.lifeSupport + p.science, 2);
  assert.equal(p.lifeSupport, 2, 'science is trimmed before life support');
  const cadet = game({ difficulty: 'cadet' });
  assert.equal(normalizeAlloc(cadet, { greenhouse: 2 }, B).greenhouse, 1);
});
test('skipping maintenance compounds: worn equipment makes less power', () => {
  const s = game();
  const worn = { ...s, res: { ...s.res, condition: 20 } };
  assert.ok(previewDay(worn, none, B).gen < previewDay(s, none, B).gen);
});

// ---------------------------------------------------------------- real event -> dose
test('flare class to flux', () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) / b < 1e-9, `${a} ≈ ${b}`);
  near(flareFlux('X9.3'), 9.3e-4);
  near(flareFlux('M1.0'), 1e-5);
  near(flareFlux('C5'), 5e-6);
  assert.equal(flareFlux('junk'), 0);
});
test('event severity mapping is monotonic and bounded', () => {
  const f = c => eventSeverity({ type: 'FLR', classType: c }, R);
  assert.ok(f('M1.0') < f('X1.0') && f('X1.0') < f('X9.3'));
  assert.equal(f('M1.0'), 1);
  assert.equal(f('X1.0'), 2.5);
  const c = v => eventSeverity({ type: 'CME', speed: v }, R);
  assert.ok(c(900) < c(1800) && c(1800) < c(3000));
  assert.ok(c(100) >= R.severity.min && c(9000) <= R.severity.max);
  assert.ok(eventSeverity({ type: 'SEP', linkedFlareClass: 'X5.1' }, R) > eventSeverity({ type: 'SEP' }, R));
  for (const e of events) { const v = eventSeverity(e, R); assert.ok(v >= R.severity.min && v <= R.severity.max, e.id); }
});
test('shield reduces dose; Mars thin air + planet reduce storm dose vs Moon', () => {
  assert.ok(protection(100, R) > protection(0, R));
  assert.ok(Math.abs(protection(0, R) - R.minProtection) < 1e-9);
  assert.ok(Math.abs(protection(100, R) - R.maxProtection) < 1e-9);
  const raw = stormRawDose(3, 'moon', R);
  assert.ok(shieldedDose(raw, 90, R) < shieldedDose(raw, 20, R));
  assert.ok(stormRawDose(3, 'mars', R) < stormRawDose(3, 'moon', R));
});
test('background radiation is calibrated with RadLab ISS DOSTEL data', () => {
  const rad = JSON.parse(fs.readFileSync(new URL('../data/radlab_iss.json', import.meta.url)));
  assert.ok(Math.abs(rad.meanRatePerHour - R.issRate_uGy_per_h) / R.issRate_uGy_per_h < 0.01, 'balance.json issRate matches archived RadLab mean');
  for (const site of ['moon', 'mars']) {
    const ratio = R.siteRate_uGy_per_h[site] / R.issRate_uGy_per_h;
    assert.ok(Math.abs(ratio - R.background[site]) < 0.02, `${site} background = site rate / ISS rate`);
  }
  const s = game(); s.dose = 10; s.history = [{}];
  assert.equal(doseComparison(s, B).totalMilliGray, Math.round(10 * R.issRate_uGy_per_h * 24 / 10) / 100);
});
test('real storm hits on its day and is recorded with the real DONKI event', () => {
  let s = game({ difficulty: 'cadet' });
  const st = s.storms[0];
  let rep;
  while (s.day <= st.day) { const out = stepDay(s, { lifeSupport: 1, greenhouse: 1, shield: 1 }, B); s = out.state; rep = out.report; if (rep.day === st.day) break; }
  const hit = rep.events.find(e => e.kind === 'storm');
  assert.ok(hit && hit.real);
  assert.equal(hit.event.id, st.event.id);
  assert.match(hit.event.link, /^https:\/\/.*DONKI/i);
});
test('forecast shows storms ahead; talking to Earth extends it (Commander)', () => {
  const s = game({ difficulty: 'commander' });
  const st = s.storms[0];
  const atLead = { ...s, day: st.day - 1 };
  assert.ok(getForecast(atLead, B).some(f => f.day === st.day));
  const early = { ...s, day: st.day - 2 };
  assert.ok(!getForecast(early, B).some(f => f.day === st.day));
  assert.ok(getForecast({ ...early, forecastBoostUntil: early.day }, B).some(f => f.day === st.day));
  const f = getForecast(atLead, B).find(x => x.day === st.day);
  assert.ok(f.range[1] >= f.range[0]);
});
test("Today's mission puts the featured real event on day 3", () => {
  const latest = events.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  const s = game({ featuredEvent: latest, mode: 'today' });
  assert.equal(s.storms[0].day, 3);
  assert.equal(s.storms[0].event.id, latest.id);
  assert.ok(s.storms[0].featured);
});
test('Mars comm delay: Earth reply arrives a sol later than on the Moon', () => {
  // preview mode = no random "message delayed" event, so we compare the built-in delay only
  const call = site => { const s = game({ site }); return stepDay(s, { comms: 1 }, B, { preview: true }); };
  const moon = call('moon'), mars = call('mars');
  const mDelay = e => e.report.events.find(x => x.kind === 'comms').arriveDay - e.report.day;
  assert.ok(mDelay(mars) > mDelay(moon));
  assert.ok(mars.report.events.find(x => x.kind === 'comms').lightSeconds >= 180);
});

// ---------------------------------------------------------------- game over
test('oxygen at zero ends the mission with cause=oxygen', () => {
  const s = game(); s.res.oxygen = 5;
  const { state } = stepDay(s, none, B);
  assert.equal(state.over, true); assert.equal(state.result, 'lose'); assert.equal(state.cause, 'oxygen');
});
test('power blackout drains extra oxygen (power → oxygen cause chain)', () => {
  const s = game(); s.res.power = 0; s.sunPhase = 14.75; // darkest
  s.res.dust = 0.8;
  const { state, report } = stepDay(s, none, B);
  assert.ok(report.events.some(e => e.kind === 'blackout'));
  assert.ok(state.res.oxygen <= B.start.oxygen - B.crew.oxygenPerDay - B.passive.blackoutOxygenLoss + 0.01);
});
test('food at zero ends Explorer/Commander; Cadet only hurts health', () => {
  const ex = game(); ex.res.food = 3;
  assert.equal(stepDay(ex, { lifeSupport: 1 }, B).state.cause, 'food');
  const ca = game({ difficulty: 'cadet' }); ca.res.food = 3;
  const out = stepDay(ca, { lifeSupport: 1 }, B).state;
  assert.equal(out.over, false);
  assert.ok(out.health < 100 - B.difficulty.cadet.hungerDamage + 1);
});
test('too much radiation ends the mission with cause=radiation', () => {
  const s = game(); s.dose = B.difficulty.explorer.doseLimit;
  assert.equal(stepDay(s, { lifeSupport: 1, greenhouse: 1 }, B).state.cause, 'radiation');
});
test('surviving all days is a win', () => {
  const s = game({ difficulty: 'cadet' }); s.day = s.length;
  const out = stepDay(s, { lifeSupport: 1, greenhouse: 1 }, B).state;
  assert.equal(out.result, 'win');
});
test('debrief explains the cause with a chain, a hint and an OSDR topic; score and badges', () => {
  let s = game();
  while (!s.over) s = stepDay(s, none, B).state;
  const d = analyzeDebrief(s, B);
  assert.equal(d.cause, 'oxygen');
  assert.ok(d.chain.length >= 2);
  assert.ok(d.hint);
  assert.ok(['body', 'muscle', 'bone', 'immune', 'food', 'radiation'].includes(d.osdrTopic));
  const sc = computeScore(s, B);
  assert.ok(sc.score > 0 && Array.isArray(sc.badges));
  assert.ok(!sc.badges.includes('missionComplete'));
});
