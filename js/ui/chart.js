// Mission timeline chart (Canvas 2D, no library). Shows how today's choice shaped tomorrow.
export const SERIES = [
  { key: 'power', color: '#ffc531', dash: [] },
  { key: 'oxygen', color: '#43d2ff', dash: [] },
  { key: 'shield', color: '#b98aff', dash: [] },
  { key: 'food', color: '#59e07a', dash: [6, 4] },
  { key: 'health', color: '#ff6b8b', dash: [2, 3] }
];

export function drawChart(canvas, history, storms, labels, { contrast = false } = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 320, h = canvas.clientHeight || 200;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement);
  const fg = css.getPropertyValue('--fg').trim() || '#1b2238';
  const grid = css.getPropertyValue('--line').trim() || '#d6dbe8';
  const pad = { l: 30, r: 10, t: 12, b: 24 };
  const n = Math.max(history.length, 2);
  const X = i => pad.l + (w - pad.l - pad.r) * (i / (n - 1));
  const Y = v => pad.t + (h - pad.t - pad.b) * (1 - v / 100);
  g.clearRect(0, 0, w, h);
  g.font = '12px "Atkinson Hyperlegible", system-ui, sans-serif';
  g.strokeStyle = grid; g.fillStyle = fg; g.lineWidth = 1;
  for (const v of [0, 25, 50, 75, 100]) { g.beginPath(); g.moveTo(pad.l, Y(v)); g.lineTo(w - pad.r, Y(v)); g.stroke(); g.fillText(String(v), 4, Y(v) + 4); }
  const step = Math.ceil(n / 10);
  history.forEach((hh, i) => { if (i % step === 0 || i === n - 1) g.fillText(String(hh.day), X(i) - 4, h - 6); });
  // storm markers (REAL events)
  for (const s of storms) {
    const i = history.findIndex(hh => hh.day === s.day);
    if (i < 0) continue;
    g.save(); g.strokeStyle = '#ff7b00'; g.setLineDash([3, 3]); g.lineWidth = 2;
    g.beginPath(); g.moveTo(X(i), pad.t); g.lineTo(X(i), h - pad.b); g.stroke(); g.restore();
    g.fillText('⚡', X(i) - 6, pad.t + 10);
  }
  for (const s of SERIES) {
    g.save(); g.strokeStyle = s.color; g.lineWidth = contrast ? 3.5 : 2.5; g.setLineDash(s.dash);
    g.beginPath();
    history.forEach((hh, i) => { const y = Y(hh[s.key]); if (i === 0) g.moveTo(X(i), y); else g.lineTo(X(i), y); });
    g.stroke(); g.restore();
  }
  canvas.setAttribute('aria-label', labels.aria);
}
