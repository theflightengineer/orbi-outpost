# 🚀 Orbi's Outpost: Junior Mission Control

**▶ Play now: https://orbioutpost.page.gd** (free, no account, works on phones, tablets and computers)
*Base do Orbi: Controle de Missão Júnior* · NASA Space Apps Challenge 2026: "Build a Junior Astronaut Mission Trainer"

A free browser game for kids aged **7–12**. You run a base at the **Moon's south pole** or in **Mars' Jezero Crater**, and every day you split a small power budget between oxygen, a radiation shield, a greenhouse, science, repairs and calls to Earth. The solar storms are **real events from NASA's DONKI database**. Radiation is measured against **real ISS detector data (NASA OSDR RadLab)**. When a mission fails, you get a friendly debrief that explains why. No account, no download, works offline, in **English and Portuguese**.

> NASA does not endorse this project. Data: NASA (DONKI, OSDR, RadLab, Image Library, NASA Science) and the Canadian Space Agency (food toolkit). See *Data & Credits* in the game and [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## How to play
1. Choose **Moon** or **Mars**, then a level: **Cadet** (7–8), **Explorer** (9–10) or **Commander** (11–12).
2. Each day (a *sol* on Mars) you get up to 6 **power blocks** (10 ⚡ each), if your battery can afford them. Use ➕/➖ to spend them:
   - 🫁 Life support (+oxygen) · 🛡️ Shield (+protection) · 🌱 Greenhouse (+food, a little oxygen)
   - 🔬 Science (points, but uses oxygen, wears equipment and adds a little radiation)
   - 📡 Talk to Earth (better forecast + advice; replies are delayed on Mars; sends your science)
   - 🔧 Fix & clean (equipment and dusty panels; skipping it costs power later)
3. Watch the **Space Weather Forecast**. Real storms come from NASA DONKI. Build the shield *before* they hit.
4. Press **End day** and read the report. **REAL** and **SIMULATED** events are clearly tagged.
5. Survive every day. If oxygen or food runs out, or the radiation dose passes the limit, the **Mission Debrief** shows what happened, a timeline chart, what NASA really does, a real OSDR science fact, and **Try again with a hint**.

Other modes: **Tutorial** (1 minute with Orbi), **Today's mission** (newest real DONKI event in the archive, or live via the optional PHP proxy), **Daily challenge** (same mission for everyone today), **share a mission code** with friends, and **Classroom mode** (one code for the whole class, a results table, discussion questions and CSA/NASA teacher links).

Accessibility: read-aloud (browser speech), high contrast, reduced motion, bigger text, keyboard play, large touch targets. Sound effects are generated with WebAudio.

## Run locally
Any static web server works. ES modules don't load from `file://`, so you need a server.
```bash
cd junior-astronaut-trainer
node tools/serve.mjs 8080        # Node 18+, no install needed
# or: python -m http.server 8080
```
Open http://localhost:8080/

### Tests
```bash
npm test                         # = node --test tests/engine.test.mjs tests/balance.test.mjs tests/data.test.mjs
node tools/balance-report.mjs    # win rates of bot strategies per site/level
node tools/trace.mjs moon commander T-3 sensible   # one mission, day by day
node tools/smoke.mjs "<path to chrome.exe>" http://localhost:8080/ ./shots   # headless browser smoke test + screenshots
```
37 tests cover resource math, the event → dose mapping, seed reproducibility, game-over rules, comm delay, RadLab calibration, data integrity, i18n completeness, balance (do-nothing always loses; a sensible strategy wins Cadet; Commander is hard but winnable) and deploy safety (`tests/deploy.test.mjs`: nothing external is loaded, fonts are vendored, the service worker precaches every runtime file, all paths are relative and case-exact, size < 5 MB).

`node tools/check.mjs "<chrome.exe>" http://localhost:8080/ ./out` plays every main screen at desktop, tablet and 360 px phone. It reports console errors, every network request, overflow, WCAG text contrast and touch targets under 44 px. It also checks that reduced motion (OS setting and in-game toggle) stops all animations, that high contrast and big text work, and that keyboard-only play works with focus kept inside dialogs. Fresh screenshots are in `docs/screenshots/`.

### Refresh the NASA data
```bash
NASA_API_KEY=your_key node tools/fetch-data.mjs        # macOS/Linux
$env:NASA_API_KEY="your_key"; node tools/fetch-data.mjs   # Windows PowerShell
```
Without a key it uses `DEMO_KEY`. The key is only used by this build-time script and is **never** written into any shipped file. Anything that fails is listed in `data/MISSING.md`; nothing is invented. See [tools/README.md](tools/README.md).

## Project layout
```
index.html, css/, js/ui/      UI (vanilla JS modules, original SVG art, canvas chart); "toy mission console" design, see docs/redesign/
fonts/                        self-hosted Lilita One + Atkinson Hyperlegible (WOFF2, SIL OFL 1.1, licences included)
js/engine/                    pure, deterministic simulation (no DOM), tested in Node
data/                         archived real data + balance.json (all tuning numbers) + config.json
i18n/en.json, i18n/pt.json    every UI string
api/donki.php                 OPTIONAL live DONKI proxy (off by default)
sw.js, manifest.webmanifest   offline PWA
tools/                        fetch-data, balance report, trace, local server, smoke test (dev only)
tests/                        node:test suites
docs/                         PLAN, mechanics, DATA_SOURCES, PITCH
```
Deploying to InfinityFree: see [DEPLOY.md](DEPLOY.md).

## Decisions we made (and why)
- **Name and mascot:** "Orbi's Outpost" with *Orbi*, an original round robot drawn in SVG. No NASA logos and no existing characters.
- **Gauges:** 3 big core gauges (Power, Oxygen, Shield) plus smaller Food, Crew health (with dose) and Equipment. **Food and comm delay exist at every level**, simplified in Cadet (greenhouse on/off switch; friendly "waiting for Earth…" message; empty food hurts health instead of ending the mission).
- **Dose unit = "ISS-day"**, calibrated with RadLab. Kids understand "like 13 days on the space station" better than milligray. The milligray value is shown too.
- **Storm doses are game-scaled** and documented honestly in `docs/mechanics.md`. The real part is which event, when it happened, and how strong it was.
- **The FLR endpoint on api.nasa.gov returned 404**, so the fetch script falls back to NASA CCMC's public DONKI web service (same database).
- **The Mars Rover Photos API and Mars Trek services were unreachable (404)**, so we used two small public-domain images from the NASA Image and Video Library and link to Mars Trek and APOD.
- **Scene sizing:** on wide screens the SVG scene is cropped to a band so gauges and actions stay visible.
- `color-mix()` CSS is used for soft tints. Very old browsers (Safari < 16.2) just show plain backgrounds, and the game still works.
- **Scores and classroom results live in `localStorage` only.** There is no server, so this is privacy-friendly for schools.

## Use of AI
AI tools (Claude and Claude Code by Anthropic) were used to help write the code, the SVG artwork, the documentation and the presentation. The author, Lucca Martins, directed the project: chose the challenge and the idea, planned the game and its requirements (audience, mechanics, levels, real NASA and CSA data sources, accessibility, languages, offline play), guided and reviewed every design and feature decision, played and tested each version on computer and phone, and published the game on InfinityFree and the code on GitHub.

- **No facts were made up by AI:** every fact, space weather event and radiation measurement comes from a real NASA or CSA source, linked in the game. Gameplay numbers were tuned for fun and are documented in [docs/mechanics.md](docs/mechanics.md).
- **No AI image generators were used:** the photos are public-domain NASA images, and the artwork is SVG drawn in code.
- **The AI's work was checked, not just accepted:** 37 automated tests check the game rules, the data and the deploy, and a browser check covers accessibility, contrast and phone layout. Anyone can run them (see [Tests](#tests)).

## License
Code: MIT (see [LICENSE](LICENSE)). Fonts: SIL Open Font License 1.1 (`fonts/OFL-*.txt`). NASA data and images: public domain (credit given). CSA content: quoted briefly with credit and links.
