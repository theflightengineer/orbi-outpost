# Slides brief: Orbi's Outpost (NASA Space Apps Challenge 2026)

**For:** the assistant building a **7-slide deck for the Space Apps judges**.

**Status:** every fact below was checked in the project files on 2026-11-14. Anything not known is marked **TODO**; do not invent it. The screenshots for the slides are in `docs/screenshots/`; see section 10.

---

## 1. The project
- **Name:** *Orbi's Outpost: Junior Mission Control* (PT: *Base do Orbi: Controle de Missão Júnior*).
- **Challenge:** answers the NASA Space Apps 2026 challenge **"Build a Junior Astronaut Mission Trainer"**.
- **Audience:** kids aged **7–12**.
- **What it is:** a free, no-login browser game. Players run a base at the Moon's south pole or in Mars' Jezero Crater. Every day they split a small power budget between oxygen, a radiation shield, a greenhouse, science, repairs and calls to Earth.
- **Pitch:** *Keep your crew alive through real NASA solar storms, where every choice that helps one thing costs another.*

## 2. The problem and our idea
- **Problem:** mission trade-offs are hard to teach with words. Kids hear "power is limited" or "radiation is dangerous", but they don't feel that a choice today causes a problem next week.
- **Our idea:** turn the trade-offs into the core game loop.
  - There is never enough power for everything.
  - Every action has a visible cost and benefit.
  - The storms are real events from NASA's space-weather database.
  - Failure ends with a friendly debrief. It shows the cause-and-effect chain on a timeline, then offers "Try again with a hint".

## 3. How it plays
**One mission in 6 steps**
1. **Pick a site and a level.** Moon (low Sun, long shadows, 1.3 s radio delay) or Mars (dust storms, 3–22 min radio delay). The levels are Cadet, Explorer and Commander.
2. **Read the gauges.** Four liquid "tanks": ⚡ Power, 🫁 Oxygen, 🛡️ Shield, 🥬 Food. Below them are meters for ❤️ Crew health (driven by radiation dose) and 🔧 Equipment.
3. **Share out up to 6 power blocks** (10 power each) across 6 actions:
   - life support;
   - shield;
   - greenhouse;
   - science;
   - talk to Earth;
   - fix & clean.

   A preview shows "tonight, if nothing surprising happens".
4. **Check the space-weather forecast.** It warns 0–3 days ahead about a real DONKI storm. Calling Earth extends the warning.
5. **End the day and read the report.**
   - Real storm cards say "Real NASA data", with the event date and a link to NASA.
   - Simulated surprises are tagged "Simulated": glitches, dusty panels, Mars dust storms, delayed messages.
6. **Survive every day, or get the debrief.** The debrief shows:
   - a cause → effect chain;
   - a timeline chart with the real-storm markers;
   - what NASA really does;
   - a real astronaut-health finding (OSDR);
   - a dose comparison with the ISS;
   - badges and a score;
   - "Try again with a hint".

**Levels**

| Level | Ages | Length | Real storms | Forecast | Notes |
|---|---|---|---|---|---|
| Cadet | 7–8 | 10 days | 2 | 2 days ahead | Greenhouse is an on/off switch; empty food hurts health instead of ending the mission; friendly "waiting for Earth…" message |
| Explorer | 9–10 | 20 days | 4 | 2 days ahead | Food can run out; science must be sent to Earth |
| Commander | 11–12 | 30 days | 7 | 1 day ahead | Fuzzy forecasts (±1 strength); 1.4× surprises; full message delay |

**Modes**
- **Tutorial:** 1 minute, 10 steps with the mascot Orbi, then a 5-day practice mission.
- **Today's mission:** starts with the newest archived real event (a CME of 10 Nov 2026), arriving on day 3. An optional server proxy can fetch it live.
- **Daily challenge:** the same mission for everyone on the same day.
- **Shareable mission codes**, e.g. `ROVER-4821`.
- **Classroom mode:** one code for the whole class, a results table on the device, 5 discussion questions, and CSA/NASA teacher links.
- **Local high scores.**

## 4. Where the trade-offs are (real in-game numbers, from `data/balance.json`)
1. **Oxygen vs everything.** The crew breathes **12 oxygen per day**, and one life-support block makes **14**. That leaves 5 blocks for everything else, if the battery can pay for them.
2. **Science costs breath, wear and dose.**
   - Each science block gives **+10 points**.
   - It also costs **2 oxygen** and **2 equipment wear**, plus extra radiation for working outside.
   - On Explorer and Commander, points only count once sent to Earth, which costs another block.
3. **Shield now, or something else?**
   - A shield block adds **+15**, but the shield decays **3 per day**.
   - A real storm knocks off **6 × its strength**.
   - Protection runs from **30%** (walls only) to **85%** (full shield).
   - Example from a real run: an **X8.2 flare (10 Sep 2017)** hit a 100% shield. It blocked 85% and the crew still took +4.7 dose; crew health went 98 → 84.
4. **Skipping repairs compounds.**
   - Equipment wears **5 per day**.
   - Below **50%**, the machines make less power.
   - Every point below **60%** raises the glitch chance, and a glitch costs **12 power or 10 oxygen**.
5. **Empty battery means losing air.** At **0 power** the base blacks out and the crew loses **15 extra oxygen**. Power feeds oxygen.

Bonus trade-off: the greenhouse block gives **+13 food and +3 oxygen**, against **8 food eaten per day**.

## 5. Real NASA data used (all retrieved **2026-11-14** by `tools/fetch-data.mjs`, stored as JSON, nothing invented)

### NASA DONKI (space weather)
- **Fetched:** **51 real events**: **21 solar flares, 12 CMEs, 18 solar particle events (SEP)**, from **4 Sep 2017 to 10 Nov 2026**.
- **Windows:** 11 date windows, including Sep 2017, the May 2024 "Gannon" storm, Oct 2024, Nov 2025, and the last 45 days.
- **Biggest events:** strongest flares **X9.3** (6 Sep 2017), **X9.0** (3 Oct 2024) and **X8.7** (14 May 2024); fastest CME **3,529 km/s** (12 Feb 2024).
- **Endpoints:** `api.nasa.gov/DONKI/CME` and `/SEP`; flares from `ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR`.
- **In the game:** each storm is one of these events. Its class or speed sets the strength, which sets the radiation dose.
- **Why:** real space weather is the heart of the radiation trade-off.

### NASA OSDR RadLab (ISS radiation)
- **Fetched:** **6 days** of ISS **DOSTEL1** detector data (Columbus module, 2022): **6,655 samples**.
- **Result:** time-weighted mean **12.24 µGy/h ≈ 294 µGy/day**.
- **Unit:** absorbed dose rate, assumed µGy/h (TODO-verify, see section 7).
- **In the game:** this defines the dose unit, **1 "ISS-day"**. It calibrates background radiation (Moon 1.08, Mars 0.71) and powers the debrief line "like N days on the ISS".
- **Why:** it ties an abstract "dose" to a real astronaut measurement.

### NASA OSDR (space biology studies)
- **Fetched:** the OSDR search API with **6 keywords** (bone density, muscle, sleep, immune system, radiation, plant growth) returned 75 candidate studies. We use **11 studies**: OSD-417, 342, 946, 937, 32, 903, 689, 269, 772, 992, 546.
- **How the text was made:** titles and URLs come from the API; we wrote the kid-friendly sentence for each.
- **In the game:** the debrief shows one finding matched to what went wrong (radiation, food, muscle/bone, immune).
- **Why:** real astronaut-health science, linked to the player's own mission.

### Moon & Mars facts
- **Fetched:** 14 facts (7 per site) from NASA Science pages, a NASA technical-report deck, and two peer-reviewed papers. **12 of the 12 checkable quotes were automatically re-verified** against the live pages.
- **The papers:**
  - Moon: Chang'e-4 LND, **13.2 µGy/h**.
  - Mars: Curiosity RAD, **0.21 mGy/day**.
- **In the game:** low Sun at the south pole; 29.5-day light cycle; dust; Mars sol length (24.6 h); temperatures; radio delay of 1.3 s (Moon) and about 3–22 min (Mars).
- **Also checked:** the Perseverance MEDA weather feed (7 sols returned, 4 with temperatures).

### Canadian Space Agency (CSA): "Food production on the Moon and in remote areas" toolkit
- **Fetched:** **8 food facts**, all quotes re-verified, plus **6 classroom links**.
- **In the game:** the source of the greenhouse mechanic, shown in the debrief and classroom mode.
- **Why:** the challenge asked for it, and it explains why growing food costs energy.

### NASA Image and Video Library
- **Fetched:** 2 small public-domain images:
  - **PIA25068** "Dust Storm and Jezero Crater" (NASA/JPL-Caltech/MSSS), 13 KB;
  - **PIA12905** "Lunar South Pole – Out of the Shadows" (NASA/GSFC/Arizona State University), 19 KB.
- **In the game:** the site-picker cards.

## 6. Real vs simulated vs game-scaled
- **Real:**
  - storm dates, types and strengths (DONKI);
  - ISS dose level (RadLab);
  - Moon/Mars numbers;
  - astronaut-health findings (OSDR);
  - food facts (CSA);
  - site images.
- **Simulated**, tagged "Simulated" on every card:
  - equipment glitches;
  - dust on panels;
  - Mars dust storms;
  - delayed messages;
  - which mission day a real storm reaches the base.
- **Game-scaled** (documented in `docs/mechanics.md`):
  - **Storm strength:** a flare uses its X-ray class, a CME its speed, and an SEP gets the highest base value.
  - **Raw dose:** `strength × 8 × site factor`, where the factor is Moon 1.0 and Mars 0.7.
  - **Shielding:** the crew receives `raw × (1 − protection)`.
  - **The honest note:** background radiation is real, but storm doses are game-scaled. Real large SEP events can be much worse, which is why NASA plans storm shelters.

## 7. What went wrong and how we handled it
| Problem | What we did | Lesson |
|---|---|---|
| DONKI **flares** on `api.nasa.gov` returned **HTTP 404** | Fell back to NASA CCMC's public DONKI web service (same database). The SEP endpoint also rejected long date ranges, so the script uses windows of a month or less. | Always have a second source for the same data. |
| **Mars Rover Photos API** and **Mars Trek** web services returned **404** (they appear retired) | Used the NASA Image and Video Library instead; Mars Trek is a clickable link only. | Check that APIs are alive before designing around them. |
| **APOD API** returned a generic placeholder instead of the requested dates | The script detects the placeholder and records the failure; APOD is link-only. | Validate content, not just the HTTP status. |
| The OSDR search found **no study on astronaut sleep** | Used OSD-32 (brain changes from fluid shift) and said so. | Report gaps instead of filling them. |
| RadLab plain average was **31 µGy/h** (too high) | The detector samples more often in high-radiation zones, so we switched to a **time-weighted** mean: **12.24 µGy/h**. | Understand how the data was collected. |
| On the live InfinityFree site, the browser console showed a **manifest syntax error** | InfinityFree's anti-bot check answers requests without its cookie with an HTML page, and browsers fetch the app manifest without cookies by default. Fixed by adding `crossorigin="use-credentials"` to the manifest link. | Test on the real host, not only on a local server. |

**Two numbers still to verify manually** (also listed in `data/MISSING.md`):
1. **TODO-verify:** Mars surface dose 0.21 ± 0.04 mGy/day (Hassler et al. 2014, *Science*). The paper is paywalled and the number is not in its abstract.
2. **TODO-verify:** RadLab DOSTEL unit assumed to be µGy/h. It matches published ISS values, but the RadLab data dictionary should be checked.

## 8. Technical summary
- **Stack:** plain HTML, CSS and vanilla JavaScript modules. No framework, no build step, no CDN, no account, no API key in the browser.
- **Offline:** installable app with a service worker that pre-stores every file; works offline after the first visit.
- **Engine:** pure and seeded (`js/engine/`), separate from the UI; the same code plus the same choices always replays the same mission.
- **Size:** **340 KB, 41 files** to upload.
- **Hosting:** InfinityFree free plan (static files; optional PHP live-data proxy, off by default). Cost: **$0**.
- **Live URL:** **https://orbioutpost.page.gd/**. It is deployed, answers over HTTPS with a valid certificate (the free `*.page.gd` certificate), and was checked on 2026-11-14.
- **Tests:** **37 passing, 0 failing**: the 31 engine/data/balance tests plus 6 deploy-safety tests.
- **Balance** (bot players, 200 missions per cell):

| Site / level | Do nothing | Naive fixed plan | Sensible plan |
|---|---|---|---|
| Moon Cadet | 0% | 100% | 100% |
| Moon Explorer | 0% | 14% | 84% |
| Moon Commander | 0% | 0% | 57% |
| Mars Cadet | 0% | 100% | 100% |
| Mars Explorer | 0% | 14% | 86% |
| Mars Commander | 0% | 0% | 48% |

  Playing only one thing (oxygen only or science only) wins at most 20% on Cadet.
- **Browser check** (headless Chrome, 15 screens × desktop 1280 / tablet 820 / phone 360):
  - **0 console errors or warnings**;
  - **0 external network requests**;
  - 0 sideways overflow;
  - 0 contrast failures;
  - 0 touch targets under 44 px.

## 9. Educational and accessibility value
- **Learning:**
  - in-context **glossary** of 21 terms (sol, solar flare, CME, SEP, dose, comm delay, regolith, DONKI, OSDR, RadLab…);
  - mascot tips;
  - **failure that teaches**: cause → effect chain, timeline chart, "Try again with a hint".
- **Accessibility:**
  - **read-aloud** using the browser's built-in voices;
  - **high contrast**;
  - **reduced motion**, which follows the device setting and has an in-game switch; checked to stop all animations;
  - **bigger text**;
  - keyboard play, with focus kept inside dialogs;
  - touch targets of 44 px or more;
  - **Portuguese and English**, switchable at any time.
- **Classroom and replay:**
  - classroom mode with shared codes, a results table and discussion questions;
  - seeded randomness, so every mission differs but can be replayed exactly;
  - daily challenge and badges.

## 10. Visual design and screenshots
- **Direction:** a "toy mission console".
  - Deep-space indigo background with drifting stars.
  - Chunky push-buttons that sink when pressed.
  - The base is seen through a **porthole window**.
  - Resources are **liquid tanks**, one colour each: Power `#FFC531`, Oxygen `#43D2FF`, Shield `#B98AFF`, Food `#59E07A`, Crew health `#FF6B8B`, on Space Ink `#0D1137`.
- **Fonts** (self-hosted): **Lilita One** for titles and buttons; **Atkinson Hyperlegible** for reading (made by the Braille Institute for legibility).
- **Mascot:** **Orbi**, an original round helper robot with a star antenna, waving arm, blinking eyes and a tiny jet. No NASA logos or existing characters.
- **Animations:**
  - tanks pour to their new levels each day;
  - on a real storm, the Sun flares, a CME ring expands, the window flashes and the shield bubble ripples;
  - a win stamps a mission patch with confetti; a loss is calm and lavender.

**Screenshots for slides** (`docs/screenshots/`)

| File | Size (px) | What it shows | Best for |
|---|---|---|---|
| `slide-1-title-desktop.png` | 1280×800 | Title screen: Orbi, chunky wordmark, mode tiles | **Title slide** |
| `slide-2-title-phone.png` | 780×1688 | Same title on a phone | Title / "works on phones" |
| `slide-3-gameplay-desktop.png` | 1280×800 | Moon base window, 4 tanks, control deck with power blocks | **Gameplay / how it plays** |
| `slide-4-gameplay-phone.png` | 780×1688 | Day 1 on a phone: window, tanks, meters | **Phone view** |
| `slide-5-storm-hit-phone.png` | 780×1688 | Real storm hitting: flaring Sun, CME ring, glowing shield, +/- tank badges | **Real-data / storm event** |
| `slide-6-storm-report-desktop.png` | 1280×800 | Day report: a "Real NASA data" card for the X8.2 solar flare of 10 Sep 2017, a link to NASA, resource changes | **Real-data / attribution** |
| `slide-7-debrief-win-desktop.png` | 1280×800 | Win: mission patch with score, badges, cause chain, timeline chart | **Debrief / learning** |
| `slide-8-debrief-lose-phone.png` | 780×1688 | Gentle loss: "Training mission" patch, encouraging message | **Failure that teaches** |
| `phone-9-high-contrast.png` | 360×640 | High-contrast mode | Accessibility |
| `phone-9-big-text.png` | 360×640 | Bigger-text mode | Accessibility |

The rest of `docs/screenshots/` (desktop-, phone- and tablet- files) is the full raw set. A before/after redesign comparison is in `docs/redesign/` (`compare.html`, plus `before/` and `after/`).

## 11. Mapping to the challenge
| The challenge asks for | How we meet it | Where |
|---|---|---|
| Run a lunar or Martian outpost | Moon south pole and Mars Jezero, each with its own physics | Setup screen; `data/sites.json` |
| Balance life support, shielding, power (and food) | 4 resource tanks, 6 actions, a 6-block power budget | Game screen; `docs/mechanics.md` |
| Communication delay | Moon 1.3 s; Mars 3–22 min, replies next sol; worse Mars forecasts | Earth messages panel |
| Real trade-offs, no free choice | Every action costs power; do-nothing always loses (tested) | `tests/balance.test.mjs` |
| Real NASA data | DONKI, RadLab, OSDR, NASA Science facts, NASA images (+ CSA) | `data/*.json`; `docs/DATA_SOURCES.md` |
| Clear attribution in the app | "Real event: date, source: NASA DONKI" + link on every storm; Data & Credits page; "archived on" footer | Day report; Credits page |
| Plain language for kids 7–12 | Short sentences, glossary, mascot, read-aloud, 3 levels by age | Everywhere |
| Browser-playable, no account or download | Static web app, offline-ready, 340 KB, live at orbioutpost.page.gd | https://orbioutpost.page.gd/; `DEPLOY.md` |
| Replayability | Seeds, shareable codes, daily challenge, random events, 2 sites × 3 levels | Setup / home |
| Failure that teaches | Debrief chain, timeline, what NASA does, OSDR fact, hint retry | Debrief screen |
| Explain the datasets | Credits page + `docs/DATA_SOURCES.md` | In game and docs |

## 12. Links and credits
- **Live game:** **https://orbioutpost.page.gd/** (InfinityFree free plan).
- **GitHub:** **TODO**.
- **Required line:** **"NASA does not endorse this project."** The Canadian Space Agency does not endorse it either.
- **Data sources**
  - NASA DONKI: https://kauai.ccmc.gsfc.nasa.gov/DONKI/ and https://api.nasa.gov/
  - NASA OSDR: https://osdr.nasa.gov/bio/
  - OSDR RadLab: https://visualization.osdr.nasa.gov/radlab/
  - NASA Science, Moon: https://science.nasa.gov/moon/facts/ and https://science.nasa.gov/moon/weather-on-the-moon/
  - NASA Science, Mars: https://science.nasa.gov/mars/facts/ and https://science.nasa.gov/mars/mars-relay-network-update/
  - Perseverance: https://science.nasa.gov/mission/mars-2020-perseverance/
  - Lunar south pole lighting (NTRS): https://ntrs.nasa.gov/api/citations/20230006101/downloads/PowerPoint%20Presentation.pdf
  - Zhang et al. 2020, *Sci. Adv.* (Moon dose): https://www.science.org/doi/10.1126/sciadv.aaz1334
  - Hassler et al. 2014, *Science* (Mars dose): https://www.science.org/doi/10.1126/science.1244797
  - CSA food toolkit: https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production/
  - NASA Image Library: https://images.nasa.gov/details/PIA25068 and https://images.nasa.gov/details/PIA12905
- **Third-party assets**
  - Fonts: **Lilita One** (© 2011 Juan Montoreano) and **Atkinson Hyperlegible** (© 2020 Braille Institute of America), both **SIL Open Font License 1.1**; licence files in `fonts/`.
  - NASA images are public domain (credited).
  - All other art (base, rover, Orbi, patch) was drawn in code for this project.
  - Code licence: MIT.

## 13. Future work
1. **Test with real kids and teachers** on the live site (school tablets, iPad Safari, school networks that may filter free hosting). No one besides the developer has played it yet.
2. **Optional live mode:** turn on the PHP DONKI proxy so "Today's mission" can show a storm from this week.
3. **More data:** a real Mars dust-storm record and more OSDR studies (including astronaut sleep, if one is published).
4. **Teacher tools:** a printable activity sheet and a class results export; add more languages.

## 14. Key numbers cheat sheet
- **51** real NASA DONKI solar events (2017–2026): 21 flares, 12 CMEs, 18 particle storms
- Strongest flare in the game: **X9.3** (6 Sep 2017); fastest CME: **3,529 km/s**
- **294 µGy/day**: real ISS dose (RadLab DOSTEL, 6,655 samples) = 1 game "ISS-day"
- **11** real NASA OSDR astronaut and space-biology studies in kid language
- **2 sites × 3 levels**: 10 / 20 / 30-day missions for ages 7–8 / 9–10 / 11–12
- **6** power blocks a day, **6** actions, **0** free choices (doing nothing loses 100% of the time)
- **37 / 37** automated tests passing; **0** console errors; **0** external requests
- **340 KB** total, works offline, **$0** to host, live at **orbioutpost.page.gd**
- **2** languages (PT/EN), **21** glossary terms, read-aloud + high contrast + reduced motion
