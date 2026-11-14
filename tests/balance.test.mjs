import { test } from 'node:test';
import assert from 'node:assert/strict';
import { winRate, doNothing, naive, sensible, randomish, oxygenOnly, scienceOnly } from './strategies.mjs';

const N = 120;
const SITES = ['moon', 'mars'];

test('"do nothing" always loses (no free option)', () => {
  for (const site of SITES) for (const d of ['cadet', 'explorer', 'commander'])
    assert.equal(winRate(doNothing, site, d, 40).rate, 0, `${site}/${d}`);
});
test('a sensible strategy wins Cadet', () => {
  for (const site of SITES) assert.ok(winRate(sensible, site, 'cadet', N).rate >= 0.95, site);
});
test('one-track play (only oxygen / only science) usually loses even on Cadet', () => {
  for (const site of SITES) {
    assert.ok(winRate(oxygenOnly, site, 'cadet', N).rate <= 0.35, `${site} oxygenOnly`);
    assert.ok(winRate(scienceOnly, site, 'cadet', N).rate <= 0.35, `${site} scienceOnly`);
  }
});
test('Explorer: sensible wins most, naive fixed plan mostly loses', () => {
  for (const site of SITES) {
    assert.ok(winRate(sensible, site, 'explorer', N).rate >= 0.7, `${site} sensible`);
    assert.ok(winRate(naive, site, 'explorer', N).rate <= 0.3, `${site} naive`);
  }
});
test('Commander is hard but winnable', () => {
  for (const site of SITES) {
    const good = winRate(sensible, site, 'commander', N).rate;
    assert.ok(good >= 0.3 && good <= 0.85, `${site} sensible ${good}`);
    assert.ok(winRate(naive, site, 'commander', N).rate <= 0.1, `${site} naive`);
    assert.ok(winRate(randomish, site, 'commander', N).rate <= 0.2, `${site} random`);
  }
});
