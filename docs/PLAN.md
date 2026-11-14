# Build plan — "Orbi's Outpost: Junior Mission Control"

## Architecture (static, no build step)
```
index.html            single-page app shell (CSP meta, ES modules)
css/style.css         mobile-first styles, high-contrast + reduced-motion modes
js/engine/*.js        PURE simulation (no DOM): rng, events, sim, debrief analysis
js/ui/*.js            DOM/SVG/canvas UI, i18n, audio (WebAudio), speech, storage
data/*.json           archived real NASA/CSA data + balance.json (all tuning numbers)
i18n/en.json, pt.json all UI strings
api/donki.php         OPTIONAL live DONKI proxy (off by default)
tools/fetch-data.mjs  one-time downloader (Node 18+), writes /data
tests/*.test.mjs      node:test engine + balance tests
sw.js + manifest      offline PWA
```

## Steps
1. Probe APIs (done): DONKI via api.nasa.gov (FLR returns 404 there → fall back to the public CCMC DONKI web service, same database); OSDR search API works; RadLab API works; NASA Image Library works; Mars Rover Photos API retired (404); Mars Trek REST 404; CSA toolkit pages readable.
2. Write `tools/fetch-data.mjs`: DONKI FLR/CME/SEP for 10 historic windows + the most recent 45 days; OSDR search by keyword; RadLab ISS DOSTEL dose rates; Perseverance MEDA + Curiosity REMS weather feeds; NASA Image Library thumbnails; verify hand-collected site/CSA quotes still appear on their source pages. Write `data/MISSING.md` for anything that failed.
3. Engine: seeded RNG (xmur3 + mulberry32), daily turn = allocate power blocks → apply → space weather → simulated events → passive drain → checks. Debrief analysis builds a cause-and-effect chain.
4. Tests: resource math, dose mapping, seed reproducibility, game-over, balance (do-nothing loses, sensible strategy wins Cadet, Commander hard-but-winnable). Tune `balance.json` until green.
5. UI: home, tutorial with mascot Orbi, game, forecast, Earth messages with comm delay, debrief with chart, Data & Credits, glossary, classroom mode, high scores, settings (PT/EN, read-aloud, contrast, motion, sound).
6. PWA, PHP proxy, docs (README, DEPLOY, mechanics, DATA_SOURCES, PITCH).
7. Serve locally, smoke-test in headless browser (Edge/Chrome if available), fix.

## Key decisions
- 3 big gauges (Power, Oxygen, Shield) + a smaller Food gauge (all levels; Cadet = simple greenhouse on/off) + a crew-health/dose meter.
- Comm delay in all levels: Cadet = friendly "waiting for Earth…" message; Commander = real minutes shown, Mars replies arrive next sol.
- Dose unit = "ISS-days": 1 = average daily dose that ISS's DOSTEL detector measured (RadLab). Storm doses are game-scaled and say so.
