// Seeded, deterministic RNG. Pure functions, no DOM. Works in browser and Node.
// xmur3 string hash -> 32-bit seed; mulberry32 generator. The generator state is a plain
// integer so it can be stored inside the game state (keeps stepDay() pure & replayable).

export function hashSeed(str) {
  let h = 1779033703 ^ String(str).length;
  for (let i = 0; i < String(str).length; i++) {
    h = Math.imul(h ^ String(str).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** Create an RNG object around an integer state. rng.state can be saved and restored. */
export function makeRng(state) {
  const rng = {
    state: state >>> 0,
    next() {
      let t = (rng.state = (rng.state + 0x6d2b79f5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) { return min + Math.floor(rng.next() * (max - min + 1)); },
    chance(p) { return rng.next() < p; },
    pick(arr) { return arr[Math.floor(rng.next() * arr.length)]; },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }
  };
  return rng;
}

const WORDS = ['COMET', 'ROVER', 'CRATER', 'ORBIT', 'NOVA', 'LUNA', 'DUNE', 'SOLAR', 'PHOBOS', 'ASTRO', 'NEBULA', 'QUASAR', 'ROCKET', 'VEGGIE', 'HALO', 'ZENITH'];
/** Kid-friendly shareable seed like "ROVER-4821". */
export function randomSeedString(entropy = Math.random()) {
  const n = Math.floor(entropy * 1e9);
  return `${WORDS[n % WORDS.length]}-${1000 + (Math.floor(n / WORDS.length) % 9000)}`;
}
/** Same seed for everyone on the same calendar day (UTC). */
export function dailySeed(date = new Date()) {
  return `DAY-${date.toISOString().slice(0, 10)}`;
}
