#!/usr/bin/env node
// One-time data downloader for Orbi's Outpost. Node 18+ (uses global fetch). No dependencies.
//
//   NASA_API_KEY=yourkey node tools/fetch-data.mjs          (macOS/Linux)
//   $env:NASA_API_KEY="yourkey"; node tools/fetch-data.mjs  (Windows PowerShell)
//
// Without NASA_API_KEY it uses DEMO_KEY. The key is only used here, at build time; it is never
// written to any file that is shipped to the browser.
// Writes: data/donki_events.json, data/osdr_facts.json, data/radlab_iss.json, data/sites.json,
//         data/csa_food.json, data/imagery.json, data/meta.json, data/MISSING.md, img/*.jpg
// Never invents numbers: anything that fails is listed in data/MISSING.md.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const IMG = path.join(ROOT, 'img');
const SRC = path.join(ROOT, 'tools', 'sources');
const CACHE = path.join(ROOT, 'tools', 'cache');
const KEY = process.env.NASA_API_KEY || 'DEMO_KEY';
const TODAY = new Date().toISOString().slice(0, 10);
const missing = [];
const log = (...a) => console.log('[fetch]', ...a);

async function get(url, { tries = 3, timeout = 45000, type = 'json' } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'junior-astronaut-trainer-data-fetch/1.0' } });
      clearTimeout(t);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (type === 'json') return await r.json();
      if (type === 'text') return await r.text();
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (String(e.message).includes('HTTP 404') || String(e.message).includes('HTTP 400')) break; // not retryable
      await new Promise(res => setTimeout(res, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}
const hideKey = u => u.replace(/api_key=[^&]+/, 'api_key=***');

// ---------------------------------------------------------------- DONKI
// Historic windows chosen because they contain well-known solar storms, plus the latest 45 days
// (for "Today's mission"). Windows are <= ~1 month because the SEP endpoint rejects long ranges.
const daysAgo = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const WINDOWS = [
  ['2017-09-01', '2017-09-30'], ['2021-10-01', '2021-10-31'], ['2022-01-15', '2022-02-15'],
  ['2023-02-10', '2023-03-10'], ['2024-02-01', '2024-02-29'], ['2024-05-01', '2024-05-31'],
  ['2024-10-01', '2024-10-31'], ['2025-01-01', '2025-01-31'], ['2025-06-01', '2025-06-30'],
  ['2025-11-01', '2025-11-30'], [daysAgo(45), TODAY]
];

async function donki(type, start, end) {
  const a = `https://api.nasa.gov/DONKI/${type}?startDate=${start}&endDate=${end}&api_key=${KEY}`;
  const b = `https://ccmc.gsfc.nasa.gov/DONKI/WS/get/${type}?startDate=${start}&endDate=${end}`;
  try { return { data: (await get(a)) || [], endpoint: hideKey(a) }; }
  catch (e1) {
    try { return { data: (await get(b)) || [], endpoint: b }; }
    catch (e2) { throw new Error(`${type} ${start}..${end}: api.nasa.gov ${e1.message}; ccmc ${e2.message}`); }
  }
}

const flareFlux = cls => {
  const m = /^([ABCMX])(\d+(\.\d+)?)/.exec(cls || '');
  if (!m) return 0;
  return { A: 1e-8, B: 1e-7, C: 1e-6, M: 1e-5, X: 1e-4 }[m[1]] * parseFloat(m[2]);
};

function cmeBest(c) {
  const an = (c.cmeAnalyses || []);
  const best = an.find(a => a.isMostAccurate) || an[0];
  return best ? { speed: best.speed || 0, halfAngle: best.halfAngle || null, type: best.type || null } : null;
}

async function fetchDonki() {
  const events = [];
  const allFlares = {};
  const endpoints = new Set();
  let ok = 0, fail = 0;
  for (const [s, e] of WINDOWS) {
    const recent = s === WINDOWS[WINDOWS.length - 1][0];
    for (const type of ['FLR', 'CME', 'SEP']) {
      try {
        const { data, endpoint } = await donki(type, s, e);
        endpoints.add(endpoint.replace(/\?.*/, ''));
        ok++;
        if (type === 'FLR') {
          for (const f of data) if (f.flrID) allFlares[f.flrID] = f.classType;
          const list = data.filter(f => f.classType).sort((x, y) => flareFlux(y.classType) - flareFlux(x.classType));
          for (const f of list.slice(0, recent ? 3 : 2)) {
            if (!recent && flareFlux(f.classType) < 5e-5) continue; // keep M5+ for historic windows
            events.push({ id: f.flrID, type: 'FLR', date: f.peakTime || f.beginTime, classType: f.classType,
              sourceLocation: f.sourceLocation || null, link: f.link, instruments: (f.instruments || []).map(i => i.displayName) });
          }
        } else if (type === 'CME') {
          const list = data.map(c => ({ c, b: cmeBest(c) })).filter(x => x.b && x.b.speed).sort((x, y) => y.b.speed - x.b.speed);
          for (const { c, b } of list.slice(0, recent ? 2 : 1)) {
            if (!recent && b.speed < 900) continue;
            events.push({ id: c.activityID, type: 'CME', date: c.startTime, speed: Math.round(b.speed), cmeType: b.type,
              halfAngle: b.halfAngle, link: c.link, instruments: (c.instruments || []).map(i => i.displayName) });
          }
        } else {
          const days = new Set();
          for (const p of data) {
            const day = (p.eventTime || '').slice(0, 10);
            if (days.has(day) || days.size >= 2) continue; // one SEP per day, max 2 per window
            days.add(day);
            const linked = (p.linkedEvents || []).map(l => l.activityID);
            events.push({ id: p.sepID, type: 'SEP', date: p.eventTime, linkedEvents: linked, link: p.link,
              instruments: (p.instruments || []).map(i => i.displayName) });
          }
        }
      } catch (err) {
        fail++;
        missing.push(`DONKI ${err.message}`);
      }
      await new Promise(r => setTimeout(r, 400));
    }
  }
  // link SEP to the flare class that caused it, if we have it
  for (const e of events) {
    if (e.type === 'SEP') {
      const id = (e.linkedEvents || []).find(x => allFlares[x]);
      if (id) { e.linkedFlareClass = allFlares[id]; e.linkedFlareId = id; }
    }
  }
  const seen = new Set();
  const uniq = events.filter(e => (seen.has(e.id) ? false : seen.add(e.id))).sort((a, b) => a.date.localeCompare(b.date));
  log(`DONKI: ${uniq.length} events (${ok} ok / ${fail} failed requests)`);
  return { retrieved: TODAY, endpoints: [...endpoints], windows: WINDOWS, events: uniq };
}

// ---------------------------------------------------------------- OSDR
const OSDR_TERMS = ['bone density', 'muscle', 'sleep', 'immune system', 'radiation', 'plant growth'];
async function fetchOsdr() {
  const candidates = {};
  for (const term of OSDR_TERMS) {
    const url = `https://osdr.nasa.gov/osdr/data/search?term=${encodeURIComponent(term)}&type=cgene&size=15`;
    try {
      const j = await get(url);
      for (const h of j.hits.hits) {
        const s = h._source;
        const id = s.Accession || s['Study Identifier'];
        if (!id || candidates[id]) continue;
        candidates[id] = {
          id, term, title: s['Study Title'], publication: s['Study Publication Title'] || null,
          organism: s.organism || null, mission: s.Mission ? s.Mission.Name : null,
          program: s['Flight Program'] || null,
          description: (s['Study Description'] || '').slice(0, 900),
          url: `https://osdr.nasa.gov/bio/repo/data/studies/${id}`, searchUrl: url
        };
      }
    } catch (e) { missing.push(`OSDR search '${term}': ${e.message}`); }
  }
  await fs.mkdir(CACHE, { recursive: true });
  await fs.writeFile(path.join(CACHE, 'osdr_candidates.json'), JSON.stringify(candidates, null, 1));
  // merge with hand-written kid versions (written by reading the fetched descriptions above)
  const kid = JSON.parse(await fs.readFile(path.join(SRC, 'osdr_kid.source.json'), 'utf8'));
  const facts = [];
  for (const k of kid.facts) {
    let c = candidates[k.id];
    if (!c) { // try the study metadata endpoint directly
      try {
        const m = await get(`https://osdr.nasa.gov/osdr/data/osd/meta/${k.id.replace('OSD-', '')}`, { timeout: 90000 });
        const st = m.study[k.id];
        const sd = st && st.studies && st.studies[0];
        if (sd) c = { id: k.id, title: sd.title, description: (sd.description || '').slice(0, 900), url: `https://osdr.nasa.gov/bio/repo/data/studies/${k.id}` };
      } catch (e) { /* fallthrough */ }
    }
    if (!c) { missing.push(`OSDR study ${k.id} not retrievable — fact skipped`); continue; }
    facts.push({ ...k, title: c.title, publication: c.publication || null, organism: c.organism || null,
      mission: c.mission || null, url: c.url, foundBy: c.term ? `OSDR search: "${c.term}"` : 'OSDR study metadata API' });
  }
  log(`OSDR: ${Object.keys(candidates).length} candidates, ${facts.length} kid facts`);
  return { retrieved: TODAY, api: 'https://osdr.nasa.gov/osdr/data/search', terms: OSDR_TERMS, facts };
}

// ---------------------------------------------------------------- RadLab (OSDR Radiation Dosimetry)
// Real ISS absorbed dose rates from DOSTEL1/DOSTEL2 (Columbus module). We average whole days.
const RADLAB_DAYS = ['2022-03-01', '2022-03-02', '2022-03-03', '2022-03-04', '2022-09-15', '2022-12-15'];
async function fetchRadlab() {
  const days = [];
  for (const d of RADLAB_DAYS) {
    const next = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10);
    const url = `https://visualization.osdr.nasa.gov/radlab/api/?instrument_id=DosTel1&timestamp%3E=${d}T00:00&timestamp%3C${next}T00:00&absorbed_dose_rate&module&format=tsv`;
    const url2 = url.replace('timestamp%3C' + next, 'timestamp%3C=' + next);
    try {
      let txt;
      try { txt = await get(url2, { type: 'text', timeout: 120000 }); } catch { txt = await get(url, { type: 'text', timeout: 120000 }); }
      const rows = txt.trim().split('\n').slice(1).map(l => l.split('\t'))
        .map(r => [Date.parse(r[0].replace(/"/g, '') + 'Z'), parseFloat(r[2]), r[3]]).filter(r => Number.isFinite(r[0]) && Number.isFinite(r[1]))
        .sort((a, b) => a[0] - b[0]);
      const vals = rows.map(r => r[1]);
      if (vals.length < 10) throw new Error('no values');
      // DOSTEL samples more often in high-flux regions (e.g. South Atlantic Anomaly), so a plain
      // average over-weights peaks. Time-weighted mean: each sample counts for the time until the next one
      // (capped at 15 min to bridge data gaps).
      let wsum = 0, tsum = 0;
      for (let i = 0; i < rows.length - 1; i++) { const dt = Math.min(rows[i + 1][0] - rows[i][0], 9e5); wsum += rows[i][1] * dt; tsum += dt; }
      const mean = wsum / tsum;
      const max = Math.max(...vals), min = Math.min(...vals);
      const module = String(rows[0] && rows[0][2] || '').replace(/"/g, '').trim();
      const plain = vals.reduce((a, b) => a + b, 0) / vals.length;
      days.push({ date: d, instrument: 'DosTel1', module, samples: vals.length, meanRate: +mean.toFixed(3), plainMeanRate: +plain.toFixed(3), minRate: +min.toFixed(3), maxRate: +max.toFixed(3), url: url2 });
    } catch (e) { missing.push(`RadLab ${d}: ${e.message}`); }
  }
  if (!days.length) return null;
  const meanRate = days.reduce((a, b) => a + b.meanRate, 0) / days.length;
  log(`RadLab: ${days.length} days, mean rate ${meanRate.toFixed(3)}`);
  return {
    retrieved: TODAY, api: 'https://visualization.osdr.nasa.gov/radlab/api/',
    unitAsReported: 'absorbed_dose_rate (RadLab DOSTEL; µGy/h)',
    unitNote: 'RadLab reports DOSTEL absorbed dose rate; we treat it as µGy per hour. Please double-check units in the RadLab data dictionary before quoting outside the game.',
    days, meanRatePerHour: +meanRate.toFixed(3), meanDailyDose_uGy: +(meanRate * 24).toFixed(1)
  };
}

// ---------------------------------------------------------------- Mars weather (MEDA / REMS)
async function fetchMarsWeather() {
  const out = {};
  for (const [k, cat, label] of [['meda', 'mars2020', 'Perseverance MEDA (Jezero)'], ['rems', 'msl', 'Curiosity REMS (Gale)']]) {
    const url = `https://mars.nasa.gov/rss/api/?feed=weather&category=${cat}&feedtype=json`;
    try {
      const j = await get(url);
      const sols = (j.sols || j.soles || []).map(s => ({ sol: s.sol, date: s.terrestrial_date, min: parseFloat(s.min_temp), max: parseFloat(s.max_temp), sunrise: s.sunrise, sunset: s.sunset, pressure: parseFloat(s.pressure) }));
      const temps = sols.filter(s => Number.isFinite(s.min) && Number.isFinite(s.max));
      out[k] = { label, url, solsReturned: sols.length, solsWithTemps: temps.length,
        minTemp: temps.length ? Math.min(...temps.map(s => s.min)) : null,
        maxTemp: temps.length ? Math.max(...temps.map(s => s.max)) : null,
        latest: sols[0] || null, sample: temps.slice(0, 7) };
      if (!temps.length) missing.push(`${label}: feed returned ${sols.length} sols but no temperature values ("--").`);
    } catch (e) { missing.push(`${label} weather feed: ${e.message}`); }
  }
  return out;
}

// ---------------------------------------------------------------- Imagery (NASA Image Library, APOD)
async function fetchImagery() {
  await fs.mkdir(IMG, { recursive: true });
  const out = { retrieved: TODAY, images: [], notes: [] };
  const wanted = [
    { key: 'jezero', q: 'Jezero crater', file: 'jezero.jpg' },
    { key: 'moon_south_pole', q: 'lunar south pole', file: 'moon-south-pole.jpg' }
  ];
  for (const w of wanted) {
    const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(w.q)}&media_type=image`;
    try {
      const j = await get(url);
      const items = j.collection.items.filter(i => i.links && i.links[0] && /thumb/.test(i.links[0].href));
      let saved = false;
      for (const it of items.slice(0, 10)) {
        const d = it.data[0];
        if (!d.center || d.center === 'HQ') continue; // prefer mission-centre science images
        const buf = await get(it.links[0].href, { type: 'buf' });
        if (buf.length > 220000) { log(`skip ${d.nasa_id} (${buf.length} bytes)`); continue; } // keep the game small
        await fs.writeFile(path.join(IMG, w.file), buf);
        out.images.push({ key: w.key, file: `img/${w.file}`, bytes: buf.length, title: d.title, nasaId: d.nasa_id, center: d.center,
          date: d.date_created, credit: d.secondary_creator || d.photographer || `NASA/${d.center || ''}`,
          page: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`, searchApi: url });
        saved = true; break;
      }
      if (!saved) missing.push(`NASA Image Library: no small image for "${w.q}"`);
    } catch (e) { missing.push(`NASA Image Library "${w.q}": ${e.message}`); }
  }
  // APOD: Perseverance landing APOD entries (metadata + link only, no download)
  for (const date of ['2021-02-23', '2021-02-24', '2021-03-08']) {
    const url = `https://api.nasa.gov/planetary/apod?date=${date}&api_key=${KEY}`;
    try {
      const a = await get(url, { tries: 2 });
      if (!a.title || a.title === 'NASA Science' || /Discover the cosmos/.test(a.explanation || '')) throw new Error('API returned a generic placeholder instead of the APOD entry');
      out.images.push({ key: `apod_${date}`, apod: true, title: a.title, date: a.date, mediaType: a.media_type,
        credit: a.copyright ? a.copyright.trim() : 'NASA (public domain unless noted on page)',
        page: `https://apod.nasa.gov/apod/ap${date.slice(2).replace(/-/g, '')}.html` });
    } catch (e) { missing.push(`APOD ${date}: ${e.message}`); }
  }
  // Retired / unreachable services — recorded honestly
  for (const [label, url] of [
    ['NASA Mars Rover Photos API', `https://api.nasa.gov/mars-photos/api/v1/rovers/perseverance/photos?sol=100&api_key=${KEY}`],
    ['Mars Trek web services', 'https://trek.nasa.gov/mars/TrekWS/rest/']]) {
    try { await get(url, { tries: 1 }); out.notes.push(`${label}: reachable`); }
    catch (e) { missing.push(`${label}: ${e.message} (service appears retired/unavailable; only a clickable link is used in-game).`); out.notes.push(`${label}: unavailable on ${TODAY} (${e.message})`); }
  }
  return out;
}

// ---------------------------------------------------------------- quote verification
async function verifyQuotes(items) {
  const cache = {};
  for (const f of items) {
    if (f.noVerify || !f.check) { f.verified = null; continue; }
    try {
      cache[f.url] = cache[f.url] || (await get(f.url, { type: 'text', tries: 2 }));
      const norm = s => s.replace(/<[^>]+>/g, '').replace(/&#8217;|’/g, "'").replace(/&nbsp;|\s+/g, ' ').replace(/&#176;|&deg;/g, '°');
      f.verified = norm(cache[f.url]).includes(norm(f.check));
      if (!f.verified) missing.push(`Quote check failed (page changed?): "${f.check}" at ${f.url}`);
    } catch (e) { f.verified = false; missing.push(`Could not re-check ${f.url}: ${e.message}`); }
  }
  return items;
}

// ---------------------------------------------------------------- main
async function main() {
  await fs.mkdir(DATA, { recursive: true });
  const only = process.argv.slice(2);
  const want = k => !only.length || only.includes(k);
  const meta = JSON.parse(await fs.readFile(path.join(DATA, 'meta.json'), 'utf8').catch(() => '{}'));

  if (want('donki')) {
    const d = await fetchDonki();
    if (d.events.length) { await fs.writeFile(path.join(DATA, 'donki_events.json'), JSON.stringify(d, null, 1)); meta.donki = TODAY; }
  }
  if (want('osdr')) {
    const o = await fetchOsdr();
    if (o.facts.length) { await fs.writeFile(path.join(DATA, 'osdr_facts.json'), JSON.stringify(o, null, 1)); meta.osdr = TODAY; }
  }
  if (want('radlab')) {
    const r = await fetchRadlab();
    if (r) { await fs.writeFile(path.join(DATA, 'radlab_iss.json'), JSON.stringify(r, null, 1)); meta.radlab = TODAY; }
  }
  if (want('sites')) {
    const src = JSON.parse(await fs.readFile(path.join(SRC, 'site_facts.source.json'), 'utf8'));
    await verifyQuotes([...src.moon.facts, ...src.mars.facts]);
    const weather = await fetchMarsWeather();
    delete src._note;
    await fs.writeFile(path.join(DATA, 'sites.json'), JSON.stringify({ retrieved: TODAY, ...src, marsWeather: weather }, null, 1));
    meta.sites = TODAY;
  }
  if (want('csa')) {
    const csa = JSON.parse(await fs.readFile(path.join(SRC, 'csa_food.source.json'), 'utf8'));
    await verifyQuotes(csa.facts);
    delete csa._note;
    await fs.writeFile(path.join(DATA, 'csa_food.json'), JSON.stringify({ retrieved: TODAY, credit: 'Canadian Space Agency (CSA)', ...csa }, null, 1));
    meta.csa = TODAY;
  }
  if (want('images')) {
    const im = await fetchImagery();
    await fs.writeFile(path.join(DATA, 'imagery.json'), JSON.stringify(im, null, 1));
    meta.images = TODAY;
  }
  await fs.writeFile(path.join(DATA, 'meta.json'), JSON.stringify(meta, null, 1));
  // Numbers we could not machine-verify against an open page (paywalled papers). Kept honest here.
  missing.push('VERIFY MANUALLY: Mars surface absorbed dose 0.21 ± 0.04 mGy/day (Hassler et al. 2014, Science, doi:10.1126/science.1244797). The abstract (checked via Europe PMC) does not state the number; it comes from the paper body. Used in data/balance.json → radiation.siteRate_uGy_per_h.mars = 8.75.');
  missing.push('VERIFY MANUALLY: RadLab DOSTEL absorbed_dose_rate unit assumed to be µGy/h (the time-weighted mean, ~294 µGy/day, matches published ISS Columbus values). Check the RadLab data dictionary.');
  const md = ['# Missing / failed data items', '', `Last run: ${TODAY} (key: ${KEY === 'DEMO_KEY' ? 'DEMO_KEY' : 'NASA_API_KEY env var'})`, '',
    missing.length ? 'These items could not be downloaded or verified. Nothing was invented to replace them. Re-run `node tools/fetch-data.mjs` on a machine with internet access.' : 'Everything downloaded and verified. 🎉', '',
    ...missing.map(m => `- ${m}`), ''].join('\n');
  // keep MISSING.md per-section friendly: when running a subset, append instead of overwrite
  if (only.length) await fs.appendFile(path.join(DATA, 'MISSING.md'), `\n## Partial run (${only.join(', ')}) ${TODAY}\n${missing.map(m => `- ${m}`).join('\n') || '- none'}\n`);
  else await fs.writeFile(path.join(DATA, 'MISSING.md'), md);
  log(`done. ${missing.length} missing items → data/MISSING.md`);
}
main().catch(e => { console.error(e); process.exit(1); });
