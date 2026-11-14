// Debug helper: print one bot mission day by day.  node tools/trace.mjs moon commander T-3 sensible
import { play, sensible, naive, randomish, doNothing } from '../tests/strategies.mjs';
const [site = 'moon', diff = 'commander', seed = 'T-1', strat = 'sensible'] = process.argv.slice(2);
const s = play({ sensible, naive, randomish, doNothing }[strat], { seed, site, difficulty: diff });
for (const h of s.history) {
  const a = h.alloc;
  console.log(`d${String(h.day).padStart(2)} sun=${h.sun.toFixed(1)} gen=${String(h.gen).padStart(4)} | P${String(h.power).padStart(5)} O${String(h.oxygen).padStart(5)} S${String(h.shield).padStart(5)} F${String(h.food).padStart(5)} C${String(h.condition).padStart(5)} dose=${h.dose.toFixed(1)} hp=${h.health} | LS${a.lifeSupport} SH${a.shield} GH${a.greenhouse} SC${a.science} CO${a.comms} MT${a.maintenance} ${h.events.join(',')}`);
}
console.log(s.result, s.cause, 'storms:', s.storms.map(x => `${x.day}:${x.severity}${x.hit ? `(got ${x.hit.got} sh ${x.hit.shieldAtHit})` : ''}`).join(' '));
