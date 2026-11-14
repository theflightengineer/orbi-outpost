// Prints win rates of the bot strategies for every site × difficulty. Use while tuning data/balance.json.
//   node tools/balance-report.mjs
import { winRate, doNothing, naive, sensible, randomish } from '../tests/strategies.mjs';

const N = Number(process.argv[2] || 200);
for (const site of ['moon', 'mars']) {
  for (const diff of ['cadet', 'explorer', 'commander']) {
    const row = [site.padEnd(5), diff.padEnd(10)];
    for (const [name, st] of [['nothing', doNothing], ['random', randomish], ['naive', naive], ['sensible', sensible]]) {
      const r = winRate(st, site, diff, N);
      row.push(`${name}=${(r.rate * 100).toFixed(0).padStart(3)}% ${JSON.stringify(r.causes)}`);
    }
    console.log(row.join(' | '));
  }
}
