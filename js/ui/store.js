// Safe localStorage wrappers (private mode / blocked storage must never break the game).
const NS = 'orbi-outpost:';
export function load(key, fallback) {
  try { const v = localStorage.getItem(NS + key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
export function save(key, value) {
  try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch { /* ignore */ }
}

export const defaultSettings = { lang: null, readAloud: false, contrast: false, reducedMotion: null, sound: true, bigText: false, tutorialDone: false };
export function getSettings() { return { ...defaultSettings, ...load('settings', {}) }; }
export function setSettings(patch) { const s = { ...getSettings(), ...patch }; save('settings', s); return s; }

export function getScores() { return load('scores', []); }
export function addScore(entry) {
  const list = getScores();
  list.push({ ...entry, at: new Date().toISOString() });
  list.sort((a, b) => b.score - a.score);
  save('scores', list.slice(0, 50));
  return list;
}
export function getClassResults() { return load('class', []); }
export function addClassResult(r) { const l = getClassResults(); l.push(r); save('class', l.slice(-100)); return l; }
export function clearClassResults() { save('class', []); }
