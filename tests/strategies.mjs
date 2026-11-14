// Bot "players" used by the balance tests. They only see what a kid sees (gauges + forecast).
import { getForecast, createGame, stepDay } from '../js/engine/sim.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const balance = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/balance.json'), 'utf8'));
export const events = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/donki_events.json'), 'utf8')).events;

const empty = () => ({ lifeSupport: 0, shield: 0, greenhouse: 0, science: 0, comms: 0, maintenance: 0 });

export const doNothing = () => empty();

/** Same plan every day, ignores forecasts and gauges. */
export const naive = () => ({ lifeSupport: 1, shield: 1, greenhouse: 1, science: 2, comms: 0, maintenance: 0 });

/** Only keeps the crew breathing; ignores shield, food, maintenance. */
export const oxygenOnly = () => ({ lifeSupport: 1, shield: 0, greenhouse: 0, science: 0, comms: 0, maintenance: 0 });

/** Science-crazy: max science every day, just enough oxygen. Ignores storms. */
export const scienceOnly = () => ({ lifeSupport: 1, shield: 0, greenhouse: 0, science: 3, comms: 1, maintenance: 0 });

/** Random kid mashing buttons. */
export const randomish = (s, B, rnd) => {
  const a = empty();
  for (const k of Object.keys(a)) a[k] = Math.floor(rnd() * (B.actions[k].max + 1));
  return a;
};

/** A sensible player: oxygen first, shield before forecast storms, keep food and equipment OK, call Earth. */
export const sensible = (s, B) => {
  const D = B.difficulty[s.difficulty], r = s.res, A = B.actions;
  const a = empty();
  let budget = Math.min(B.maxBlocksPerDay, Math.floor(r.power / B.powerPerBlock));
  const take = (k, n) => { n = Math.max(0, Math.min(n, budget, A[k].max - a[k])); a[k] += n; budget -= n; };
  const fc = getForecast(s, B);
  take('lifeSupport', r.oxygen < 45 ? 2 : r.oxygen < 88 ? 1 : 0);
  if (r.food < 75) take('greenhouse', D.greenhouseToggle ? 1 : r.food < 35 ? 2 : 1);
  const soon = fc.filter(f => f.inDays <= 1);
  if (soon.length) take('shield', Math.ceil((92 - r.shield) / A.shield.shield));
  else if (r.shield < 30) take('shield', 1);
  // keep a reserve for the extras
  const reserve = s.site === 'moon' ? 35 : 30;
  const spare = () => Math.floor((r.power - (6 - budget) * B.powerPerBlock - reserve) / B.powerPerBlock);
  if (r.condition < 62 || r.dust > 0.3) take('maintenance', 1);
  if ((D.scienceNeedsTransmit && s.sciencePending >= 25) || (s.day % 4 === 0) || (s.difficulty === 'commander' && s.storms.some(x => x.day > s.day && x.day - s.day <= 3) && s.forecastBoostUntil < s.day + 1)) take('comms', Math.min(1, Math.max(spare(), r.power >= 30 ? 1 : 0)));
  take('science', Math.min(2, spare()));
  return a;
};

export function play(strategy, { seed, site, difficulty, featuredEvent }, B = balance) {
  let s = createGame({ seed, site, difficulty, events, balance: B, featuredEvent });
  let n = 0;
  let x = 0x9e3779b9 ^ seed.length;
  const rnd = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; };
  while (!s.over && n++ < 100) s = stepDay(s, strategy(s, B, rnd), B).state;
  return s;
}

export function winRate(strategy, site, difficulty, n = 100, B = balance) {
  let wins = 0; const causes = {};
  for (let i = 0; i < n; i++) {
    const s = play(strategy, { seed: `T-${i}`, site, difficulty }, B);
    if (s.result === 'win') wins++; else causes[s.cause] = (causes[s.cause] || 0) + 1;
  }
  return { rate: wins / n, causes };
}
