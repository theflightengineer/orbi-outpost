// Sound effects generated with WebAudio — no audio files to download.
let ctx = null, enabled = true;
export function setSound(on) { enabled = on; }
function ac() {
  if (!enabled) return null;
  // Browsers only allow audio after a real tap/click; don't even try before that (avoids console warnings).
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}
function tone(freq, dur = 0.12, type = 'sine', vol = 0.15, when = 0) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  const t0 = c.currentTime + when;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur = 0.8, vol = 0.12) {
  const c = ac(); if (!c) return;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  f.type = 'lowpass'; f.frequency.value = 600; g.gain.value = vol;
  src.buffer = buf; src.connect(f).connect(g).connect(c.destination); src.start();
}
export const sfx = {
  click: () => { tone(520, 0.04, 'triangle', 0.09); tone(780, 0.05, 'triangle', 0.06, 0.03); },
  pour: () => [330, 392, 494, 587].forEach((f, i) => tone(f, 0.09, 'sine', 0.05, i * 0.07)),
  plus: () => tone(880, 0.06, 'triangle', 0.08),
  minus: () => tone(440, 0.06, 'triangle', 0.08),
  endDay: () => { tone(523, 0.12); tone(659, 0.12, 'sine', 0.15, 0.1); tone(784, 0.18, 'sine', 0.15, 0.2); },
  storm: () => { noise(1.0, 0.2); tone(110, 0.6, 'sawtooth', 0.05); },
  warn: () => { tone(520, 0.15, 'square', 0.06); tone(390, 0.2, 'square', 0.06, 0.18); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.14, i * 0.12)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'sine', 0.12, i * 0.18)),
  beep: () => { tone(1200, 0.05, 'sine', 0.06); tone(1500, 0.05, 'sine', 0.06, 0.08); }
};
