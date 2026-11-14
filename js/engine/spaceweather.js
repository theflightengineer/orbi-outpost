// Maps REAL DONKI events to a game "storm severity" and a radiation dose.
// The formulas are deliberately simple and are documented in docs/mechanics.md.
// Pure functions; all coefficients come from data/balance.json -> radiation.

/** GOES X-ray class like "X9.3" -> peak flux in W/m² (C=1e-6, M=1e-5, X=1e-4). */
export function flareFlux(classType) {
  const m = /^([ABCMX])(\d+(?:\.\d+)?)/.exec(classType || '');
  if (!m) return 0;
  return { A: 1e-8, B: 1e-7, C: 1e-6, M: 1e-5, X: 1e-4 }[m[1]] * parseFloat(m[2]);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = v => Math.round(v * 10) / 10;

/**
 * Severity on a 0.5–5 scale.
 *  FLR: 1 + k·log10(flux / 1e-5)        (M1 ≈ 1, X1 ≈ 2.5, X10 ≈ 4)
 *  CME: (speed − v0) / dv                (≈1000 km/s → 0.8, 2000 → 2.5, 3000 → 4.2)
 *  SEP: base + bonus for the flare class linked to it in DONKI (X: +1, M: +0.5)
 * SEPs score highest because energetic particles are what actually raise crew dose.
 */
export function eventSeverity(ev, rad) {
  const s = rad.severity;
  let v;
  if (ev.type === 'FLR') v = 1 + s.flrPerDecade * Math.log10(Math.max(flareFlux(ev.classType), 1e-7) / 1e-5);
  else if (ev.type === 'CME') v = ((ev.speed || 0) - s.cmeV0) / s.cmeDv;
  else if (ev.type === 'SEP') {
    const c = (ev.linkedFlareClass || '')[0];
    v = s.sepBase + (c === 'X' ? s.sepXBonus : c === 'M' ? s.sepMBonus : 0);
  } else v = 1;
  return r1(clamp(v, s.min, s.max));
}

/** Raw (unshielded) storm dose in game dose units ("ISS-days"), before habitat protection. */
export function stormRawDose(severity, site, rad) {
  return r1(severity * rad.stormDosePerSeverity * rad.siteStormFactor[site]);
}

/** Fraction of radiation blocked by habitat + shield (0..1). Shield gauge 0..100. */
export function protection(shield, rad) {
  return rad.minProtection + (rad.maxProtection - rad.minProtection) * clamp(shield, 0, 100) / 100;
}

/** Dose received = raw × (1 − protection). */
export function shieldedDose(raw, shield, rad) {
  return raw * (1 - protection(shield, rad));
}

/** 1–5 "lightning bolts" shown to kids. */
export function severityStars(sev) { return clamp(Math.round(sev), 1, 5); }

/** Background daily dose for a site in ISS-days, calibrated with RadLab (see balance.json). */
export function backgroundDose(site, rad) {
  return rad.background[site];
}
