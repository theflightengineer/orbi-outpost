// Loads the archived JSON data shipped in /data. The game never needs the network after this.
// Optional: if data/config.json has "liveDonki": true AND api/donki.php is deployed, "Today's mission"
// asks that PHP proxy for the newest event (4 s timeout) and falls back to the archive.
const FILES = ['balance', 'donki_events', 'osdr_facts', 'radlab_iss', 'sites', 'csa_food', 'imagery', 'meta', 'config'];

export async function loadAll() {
  const out = {};
  await Promise.all(FILES.map(async f => {
    try { const r = await fetch(`data/${f}.json`); out[f] = r.ok ? await r.json() : null; }
    catch { out[f] = null; }
  }));
  if (!out.balance || !out.donki_events) throw new Error('core data missing');
  out.config = out.config || { liveDonki: false };
  return out;
}

export function latestArchivedEvent(donki) {
  return donki.events.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
}

/** Returns { event, source: 'live'|'archived', retrieved } */
export async function todaysEvent(data) {
  const archived = { event: latestArchivedEvent(data.donki_events), source: 'archived', retrieved: data.donki_events.retrieved };
  if (!data.config.liveDonki) return archived;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch('api/donki.php?latest=1', { signal: ctl.signal, credentials: 'same-origin' });
    clearTimeout(timer);
    if (!r.ok) return archived;
    const j = await r.json();
    if (j && j.event && j.event.date && j.event.link && j.source === 'live') return { event: j.event, source: 'live', retrieved: j.fetched };
    return archived;
  } catch { return archived; }
}
