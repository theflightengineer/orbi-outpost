// Original SVG art drawn in code (no NASA logos, no copyrighted characters).
// sceneSVG(site) builds the outpost seen through the porthole; updateScene() sets day/night,
// shield bubble, dust and greenhouse; playStorm() runs the real-storm animation.

const STARS = Array.from({ length: 54 }, (_, i) => [(i * 73 + 11) % 400, (i * 37 + 5) % 118, ((i * 7) % 3) * 0.35 + 0.45, i % 6 === 0]);

export function sceneSVG(site, earthLabel = 'Earth') {
  const moon = site === 'moon';
  const sunX = moon ? 342 : 326, sunY = moon ? 104 : 40; // south pole: the Sun hugs the horizon
  const ground = moon
    ? `<path d="M0 138 Q60 126 120 136 T240 132 T400 138 V200 H0Z" fill="#9aa0ad"/>
       <path d="M248 138 L284 106 L322 138Z" fill="#878d9b"/><path d="M284 106 L299 120 L292 138 L322 138Z" fill="#666c79"/>
       <path d="M0 158 Q90 148 180 156 T400 154 V200 H0Z" fill="#7d8391"/>
       <ellipse cx="58" cy="172" rx="24" ry="5" fill="#646a77"/><ellipse cx="58" cy="171" rx="20" ry="3.4" fill="#5a606c"/>
       <ellipse cx="322" cy="184" rx="32" ry="6" fill="#646a77"/><ellipse cx="146" cy="188" rx="12" ry="3" fill="#646a77"/>`
    : `<path d="M0 132 Q40 106 92 126 Z" fill="#b65f37"/><path d="M296 130 Q350 96 400 116 V134Z" fill="#b65f37"/>
       <path d="M0 136 Q70 120 140 134 T280 128 T400 136 V200 H0Z" fill="#c96a3d"/>
       <path d="M0 158 Q100 146 200 156 T400 152 V200 H0Z" fill="#a8532e"/>
       <circle cx="70" cy="178" r="5" fill="#7f3a1f"/><circle cx="332" cy="186" r="7" fill="#7f3a1f"/><circle cx="152" cy="190" r="3" fill="#7f3a1f"/>`;
  const earth = moon
    ? `<g id="earth" aria-hidden="true"><circle cx="62" cy="42" r="21" fill="#7fd4ff" opacity=".22" filter="url(#soft)"/>
        <circle cx="62" cy="42" r="17" fill="#2f7de1"/><path d="M50 36 q6 -8 14 -3 q4 6 -4 9 q-6 2 -10 -6Z M64 50 q6 -4 10 2 q-3 5 -10 -2Z" fill="#41c36a"/>
        <path d="M47 44 q10 4 27 -2" stroke="#fff" stroke-width="2" fill="none" opacity=".75"/><circle cx="62" cy="42" r="17" fill="url(#earthShade)"/>
        <text x="62" y="74" text-anchor="middle" font-size="8.5" fill="#cfe9ff" opacity=".9">${earthLabel}</text></g>`
    : `<g id="earth" aria-hidden="true"><circle cx="72" cy="30" r="6" fill="#7fc4ff" opacity=".35" filter="url(#soft)"/><circle cx="72" cy="30" r="2.6" fill="#a9dcff"/>
        <text x="80" y="33" font-size="8.5" fill="#fff" opacity=".9">${earthLabel}</text></g>`;
  const stars = STARS.map(([x, y, r, tw], i) => `<circle class="${tw ? 'tw' : ''}" style="animation-delay:${(i % 7) * 0.6}s" cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`).join('');
  const rays = Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<line x1="${sunX + Math.cos(a) * 17}" y1="${sunY + Math.sin(a) * 17}" x2="${sunX + Math.cos(a) * 34}" y2="${sunY + Math.sin(a) * 34}"/>`; }).join('');
  const parts = Array.from({ length: 12 }, (_, i) => `<line class="p" style="animation-delay:${(i * 0.11).toFixed(2)}s" x1="${sunX - 10 - i * 3}" y1="${sunY + (i % 4) * 5}" x2="${sunX - 24 - i * 3}" y2="${sunY + 5 + (i % 4) * 5}"/>`).join('');
  return `<svg class="scene site-${site}" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" role="img" aria-labelledby="sceneTitle" xmlns="http://www.w3.org/2000/svg">
  <title id="sceneTitle">${moon ? 'Moon outpost' : 'Mars outpost'}</title>
  <defs>
    <linearGradient id="skyNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${moon ? '#02030c' : '#14123a'}"/><stop offset="1" stop-color="${moon ? '#121a3e' : '#3b2b56'}"/></linearGradient>
    <linearGradient id="skyDay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${moon ? '#0a1030' : '#c07c58'}"/><stop offset="1" stop-color="${moon ? '#1d2a5c' : '#f3c99e'}"/></linearGradient>
    <radialGradient id="sunGlow"><stop offset="0" stop-color="#fff8cf"/><stop offset=".4" stop-color="#ffd23f" stop-opacity=".95"/><stop offset="1" stop-color="#ff9f1c" stop-opacity="0"/></radialGradient>
    <radialGradient id="shieldGrad" cx=".5" cy=".75" r=".62"><stop offset="0" stop-color="#d5b8ff" stop-opacity=".04"/><stop offset=".8" stop-color="#b98aff" stop-opacity=".28"/><stop offset="1" stop-color="#e9dcff" stop-opacity=".75"/></radialGradient>
    <radialGradient id="earthShade" cx=".3" cy=".3" r=".8"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="400" height="200" fill="url(#skyNight)"/>
  <rect id="daySky" width="400" height="200" fill="url(#skyDay)" opacity="1"/>
  <g id="stars">${stars}</g>
  ${earth}
  <g id="sun" class="sun">
    <circle class="corona" cx="${sunX}" cy="${sunY}" r="40" fill="url(#sunGlow)"/>
    <circle cx="${sunX}" cy="${sunY}" r="13" fill="#ffe066"/>
    <g id="flare" class="flare" stroke="#ff8a00" stroke-width="3" stroke-linecap="round">${rays}</g>
    <g class="loops" fill="none" stroke="#ff6a00" stroke-width="2.5" stroke-linecap="round">
      <path d="M${sunX - 9} ${sunY - 10} q-10 -18 4 -22 q10 2 6 14"/><path d="M${sunX + 8} ${sunY + 9} q16 6 14 16 q-8 6 -16 -6"/></g>
    <circle class="cme" cx="${sunX}" cy="${sunY}" r="16" fill="none" stroke="#ffd166" stroke-width="3"/>
  </g>
  <g id="particles" class="particles" stroke="#ffd166" stroke-width="2" stroke-linecap="round">${parts}</g>
  ${ground}
  <g id="rover" class="rover"><rect x="86" y="146" width="40" height="12" rx="4" fill="#f4f4f8" stroke="#3a3f55" stroke-width="1.5"/><rect x="92" y="137" width="15" height="9" rx="2" fill="#ffc531" stroke="#3a3f55" stroke-width="1.5"/>
    <line x1="116" y1="146" x2="116" y2="130" stroke="#3a3f55" stroke-width="2"/><rect x="110" y="125" width="12" height="7" rx="2" fill="#2a2f45"/><circle cx="119" cy="128.5" r="1.6" fill="#43d2ff"/>
    <circle cx="92" cy="161" r="5.5" fill="#2a2f45"/><circle cx="106" cy="161" r="5.5" fill="#2a2f45"/><circle cx="120" cy="161" r="5.5" fill="#2a2f45"/>
    <circle cx="92" cy="161" r="2" fill="#8a90a8"/><circle cx="106" cy="161" r="2" fill="#8a90a8"/><circle cx="120" cy="161" r="2" fill="#8a90a8"/></g>
  <g id="antenna"><line x1="160" y1="150" x2="160" y2="104" stroke="#d7dbe6" stroke-width="3"/><path d="M145 100 Q160 121 177 97 Z" fill="#eef1f7" stroke="#9aa0b4"/>
    <circle id="antennaLight" cx="161" cy="104" r="3.2" fill="#59e07a" filter="url(#glow)"/><g class="waves" fill="none" stroke="#43d2ff" stroke-width="1.6" stroke-linecap="round"><path d="M168 92 q6 -6 0 -12"/><path d="M173 96 q10 -10 0 -20"/></g></g>
  <g id="habitat"><rect x="176" y="125" width="76" height="35" rx="10" fill="#f6f6fb" stroke="#5b6283" stroke-width="2"/>
    <path d="M186 125 Q214 90 242 125 Z" fill="#e6ecfa" stroke="#5b6283" stroke-width="2"/>
    <rect x="207" y="104" width="14" height="4" rx="2" fill="#ffc531"/>
    <g class="wins"><circle cx="197" cy="141" r="5.5" class="win"/><circle cx="214" cy="141" r="5.5" class="win"/><circle cx="231" cy="141" r="5.5" class="win"/></g>
    <rect x="170" y="158" width="88" height="5" rx="2.5" fill="#8f96ad"/></g>
  <g id="greenhouse"><path d="M252 160 Q268 128 284 160 Z" fill="#c9f6ff" fill-opacity=".45" stroke="#86c6d6" stroke-width="1.5"/>
    <g id="plants" fill="#59e07a"><circle cx="262" cy="155" r="4"/><circle cx="268" cy="150.5" r="5"/><circle cx="275" cy="155" r="4"/></g>
    <rect id="growLight" x="260" y="140" width="16" height="2.5" rx="1" fill="#ff7ad9" filter="url(#glow)"/></g>
  <g id="panels">${[0, 1, 2].map(i => `<g transform="translate(${296 + i * 30} 150)"><line x1="11" y1="0" x2="11" y2="12" stroke="#a3a9bd" stroke-width="2"/><polygon points="0,0 22,0 26,-16 4,-16" fill="#2453d6" stroke="#9cc4ff"/><line x1="2" y1="-8" x2="24" y2="-8" stroke="#9cc4ff" stroke-width=".7"/><line x1="13" y1="0" x2="15" y2="-16" stroke="#9cc4ff" stroke-width=".7"/></g>`).join('')}
    <rect id="panelDust" x="294" y="132" width="90" height="20" fill="#9c6b45" opacity="0"/></g>
  <g id="shield" class="shield">
    <ellipse id="shieldBubble" cx="214" cy="160" rx="80" ry="62" fill="url(#shieldGrad)"/>
    <ellipse id="shieldRim" class="shieldRim" cx="214" cy="160" rx="80" ry="62" fill="none" stroke="#d9c2ff" stroke-width="2.2" filter="url(#glow)"/>
  </g>
  <rect id="duststorm" width="400" height="200" fill="#c27a4a" opacity="0" pointer-events="none"/>
  <rect id="night" width="400" height="200" fill="#030616" opacity="0" pointer-events="none"/>
  <rect id="flash" class="flash" width="400" height="200" fill="#fff4c2" opacity="0" pointer-events="none"/>
</svg>`;
}

export function updateScene(root, { sun = 1, shield = 50, dust = 0, greenhouse = false, dustStorm = false, power = 50 } = {}) {
  const svg = root && root.querySelector('svg.scene');
  if (!svg) return;
  const q = id => svg.querySelector('#' + id);
  const mars = svg.classList.contains('site-mars');
  const dark = Math.max(0, Math.min(1, (0.95 - sun) / 0.55)); // 0 = full day, 1 = deep night
  q('daySky').setAttribute('opacity', (mars ? 1 - dark * 0.85 : 0.55 - dark * 0.45).toFixed(2));
  q('stars').setAttribute('opacity', (mars ? 0.15 + dark * 0.8 : 0.9).toFixed(2));
  q('night').setAttribute('opacity', (dark * 0.42).toFixed(2));
  q('sun').setAttribute('opacity', (0.4 + 0.6 * sun).toFixed(2));
  q('shield').setAttribute('opacity', (0.12 + 0.88 * shield / 100).toFixed(2));
  q('shieldRim').setAttribute('stroke-width', (1 + 2.6 * shield / 100).toFixed(1));
  q('panelDust').setAttribute('opacity', Math.min(0.85, dust * 1.1).toFixed(2));
  q('duststorm').setAttribute('opacity', dustStorm ? '0.38' : '0');
  q('plants').setAttribute('opacity', greenhouse ? '1' : '0.35');
  q('growLight').setAttribute('opacity', greenhouse ? '1' : '0');
  svg.querySelectorAll('.win').forEach(w => { w.setAttribute('fill', power > 0 ? '#ffd166' : '#4b5268'); w.setAttribute('filter', power > 0 && dark > 0.3 ? 'url(#glow)' : ''); });
  q('antennaLight').setAttribute('fill', power > 0 ? '#59e07a' : '#ff6b8b');
}

/** Real storm: Sun flares, CME ring expands, particles fly, porthole flashes, shield ripples. */
export function playStorm(root, ms = 2400) {
  const svg = root && root.querySelector('svg.scene');
  if (!svg) return;
  svg.classList.remove('storming'); void svg.getBoundingClientRect();
  svg.classList.add('storming');
  root.classList.add('jolt');
  setTimeout(() => { svg.classList.remove('storming'); root.classList.remove('jolt'); }, ms);
}
export function playComms(root) {
  const svg = root && root.querySelector('svg.scene');
  if (!svg) return;
  svg.classList.add('talking');
  setTimeout(() => svg.classList.remove('talking'), 1800);
}

/** Orbi, our original mascot: a small round helper robot with a star antenna and a tiny jet. */
export function orbiSVG(mood = 'happy', size = 72) {
  const mouth = mood === 'worried' ? 'M40 62 Q48 56 56 62' : mood === 'think' ? 'M41 60 Q48 62 55 59' : 'M38 58 Q48 68 58 58';
  const brows = mood === 'worried' ? '<path d="M35 42 l7 -2 M61 42 l-7 -2" stroke="#9ff7ff" stroke-width="2" stroke-linecap="round"/>' : '';
  return `<svg class="orbi orbi-${mood}" width="${size}" height="${size}" viewBox="0 0 96 96" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <path class="jet" d="M42 86 Q48 98 54 86 Z" fill="#ffc531"/>
  <line x1="48" y1="20" x2="48" y2="10" stroke="#5966a8" stroke-width="3.5" stroke-linecap="round"/>
  <path class="tip" d="M48 1 l2.6 5.2 5.7 .8 -4.1 4 1 5.7 -5.2 -2.7 -5.2 2.7 1 -5.7 -4.1 -4 5.7 -.8Z" fill="#ffc531"/>
  <g class="arm-l"><rect x="10" y="50" width="12" height="20" rx="6" fill="#1f9aa6"/></g>
  <g class="arm-r"><rect x="74" y="50" width="12" height="20" rx="6" fill="#1f9aa6"/></g>
  <circle cx="48" cy="52" r="32" fill="#34d6c8" stroke="#1f9aa6" stroke-width="3.5"/>
  <path d="M22 44 Q48 14 74 44" fill="none" stroke="#a8fff5" stroke-width="3" stroke-linecap="round" opacity=".55"/>
  <rect x="26" y="34" width="44" height="34" rx="16" fill="#111a4f"/>
  <path d="M31 40 Q38 36 46 37" stroke="#4f5fb0" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  ${brows}
  <g class="eyes"><rect class="eye" x="36" y="44" width="7" height="10" rx="3.5" fill="#9ff7ff"/><rect class="eye" x="53" y="44" width="7" height="10" rx="3.5" fill="#9ff7ff"/></g>
  <path d="${mouth}" stroke="#9ff7ff" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="24" cy="62" r="4.5" fill="#ff8fab" opacity=".85"/><circle cx="72" cy="62" r="4.5" fill="#ff8fab" opacity=".85"/>
  <circle cx="48" cy="77" r="5" fill="#ffc531"/><ellipse cx="48" cy="77" rx="9" ry="2.6" fill="none" stroke="#fff3c4" stroke-width="1.4"/></svg>`;
}

/** Circular mission patch for the debrief. */
export function patchSVG({ win, site, score, label, sub }) {
  const ring = win ? '#ffc531' : '#b98aff';
  const planet = site === 'mars' ? '#d4683a' : '#aab0be';
  return `<svg class="patch ${win ? 'patch-win' : 'patch-lose'}" viewBox="0 0 200 200" role="img" aria-label="${label} ${score}" xmlns="http://www.w3.org/2000/svg">
  <defs><path id="arcBot" d="M9 100 A91 91 0 0 0 191 100"/><clipPath id="patchIn"><circle cx="100" cy="100" r="70"/></clipPath></defs>
  <circle cx="100" cy="100" r="98" fill="${ring}"/><circle cx="100" cy="100" r="98" fill="none" stroke="#0d1137" stroke-opacity=".25" stroke-width="3"/>
  <text font-family="Lilita One, sans-serif" font-size="17" fill="#1d1442" letter-spacing=".5"><textPath href="#arcBot" startOffset="50%" text-anchor="middle">${label}</textPath></text>
  <circle cx="100" cy="100" r="70" fill="#0d1137"/>
  <g clip-path="url(#patchIn)"><circle cx="100" cy="196" r="62" fill="${planet}"/><circle cx="76" cy="150" r="6" fill="#000" opacity=".18"/><circle cx="122" cy="160" r="9" fill="#000" opacity=".18"/>
    <circle cx="58" cy="62" r="1.6" fill="#fff"/><circle cx="140" cy="54" r="1.3" fill="#fff"/><circle cx="150" cy="96" r="1.1" fill="#fff"/><circle cx="48" cy="104" r="1.2" fill="#fff"/></g>
  <circle cx="100" cy="100" r="70" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="2" stroke-dasharray="2 6"/>
  <path d="M100 40 l4 8 9 1 -6.5 6.3 1.5 9 -8 -4.2 -8 4.2 1.5 -9 -6.5 -6.3 9 -1Z" fill="${ring}"/>
  <text x="100" y="108" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="36" fill="#f3f1ff">${score}</text>
  <text x="100" y="126" text-anchor="middle" font-family="Atkinson Hyperlegible, sans-serif" font-weight="700" font-size="12" fill="#b9bce8">${sub}</text></svg>`;
}

/**
 * Decorative sky for the title screen. Mars and Earth are separate small SVGs placed with CSS, so they are
 * always drawn whole at any screen width; only the Moon horizon stretches (slice) to fill the width.
 */
export function titleSkySVG() {
  return `<svg class="title-moon" viewBox="0 0 400 100" preserveAspectRatio="xMidYMax slice" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="tMoon" cx=".5" cy=".1" r=".9"><stop offset="0" stop-color="#d9dde6"/><stop offset="1" stop-color="#7c8292"/></radialGradient></defs>
    <ellipse cx="200" cy="190" rx="330" ry="140" fill="url(#tMoon)"/>
    <ellipse cx="120" cy="72" rx="26" ry="6" fill="#6c7282" opacity=".55"/><ellipse cx="275" cy="64" rx="18" ry="4.5" fill="#6c7282" opacity=".55"/><ellipse cx="205" cy="90" rx="34" ry="6" fill="#6c7282" opacity=".5"/></svg>
  <svg class="t-planet t-mars" viewBox="0 0 64 64" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="tMars" cx=".35" cy=".35"><stop offset="0" stop-color="#ff9a62"/><stop offset="1" stop-color="#a8411f"/></radialGradient></defs>
    <circle cx="32" cy="32" r="30" fill="url(#tMars)"/><path d="M14 24 q10 -4 18 3 M36 46 q8 -3 14 2" stroke="#7d2e14" stroke-width="3" fill="none" opacity=".45" stroke-linecap="round"/></svg>
  <svg class="t-planet t-earth" viewBox="0 0 32 32" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="tEarth" cx=".35" cy=".35"><stop offset="0" stop-color="#6fc3ff"/><stop offset="1" stop-color="#1f5fc4"/></radialGradient></defs>
    <circle cx="16" cy="16" r="14" fill="url(#tEarth)"/><path d="M9 12 q5 -5 10 0 q-2 6 -10 0Z" fill="#41c36a"/></svg>`;
}
