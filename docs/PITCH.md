# Pitch kit: Orbi's Outpost, Junior Mission Control

## Project summary (for the Space Apps submission form)
Orbi's Outpost is a free, no-login browser game for kids aged 7–12. Players run a base at the Moon's south pole or in Mars' Jezero Crater. Each day they split a small power budget between life support, radiation shielding, a greenhouse, science, maintenance and calls to Earth. Every action has a visible cost and benefit, so there is never a free choice. The solar storms are **real events from NASA's DONKI database** (like the X9.0 flare of October 2024). A forecast warns players ahead of time, but on Mars messages from Earth arrive late. Radiation is measured in "ISS-days", calibrated with **real ISS dosimeter data from NASA OSDR RadLab**. When a mission fails, a friendly debrief shows the cause-and-effect chain on a timeline chart, explains what real astronauts do, and shares a real **NASA OSDR** finding about astronaut health or a **CSA** fact about growing food in space. Then it offers "try again with a hint". The game is offline-ready and works in Portuguese and English with read-aloud. It fits on free static hosting, and every data source is credited in-game.

## 2-minute demo script
| Time | On screen | Say |
|---|---|---|
| 0:00 | Home, Orbi bobbing | "Kids 7 to 12 run a Moon or Mars base. No download, no login, works offline, in Portuguese and English." |
| 0:10 | Tap Tutorial | "Orbi, our original mascot, explains power, oxygen, shield, sol, solar flare and comm delay right where they appear." |
| 0:25 | Game screen, actions | "Each day you share 6 power blocks. Every block has a cost and a benefit. Science wears out equipment and adds radiation. Skipping repairs makes less power later. There's no free option." |
| 0:45 | Forecast card shows a storm | "This forecast is a REAL NASA DONKI event. I'll add shield blocks the day before it hits." |
| 0:55 | End day → storm animation → report | "The Sun flares, the shield glows. The card says: Real event, 10 September 2017, source NASA DONKI, with a link." |
| 1:10 | Switch to a Mars Commander mission, talk to Earth | "On Mars, light takes 3 to 22 minutes, so Earth's reply comes next sol and forecasts are fuzzier." |
| 1:25 | Debrief after a failure | "Failure teaches. Here's the chain: worn equipment, then dark days, then an empty battery, then oxygen ran out. The timeline shows how sol 4 caused sol 9." |
| 1:40 | Scroll: dose vs ISS, OSDR fact, CSA fact | "Your crew's dose compared with a real ISS detector from OSDR RadLab, a real OSDR study, and a CSA food fact." |
| 1:50 | Classroom mode / share code | "Teachers share one mission code so the whole class faces the same real storms, then compare. The Data & Credits page lists every dataset. Thanks!" |

## Features → judging criteria
- **Real trade-offs:** 6 power blocks per day; every action costs power, and science also costs oxygen, wear and dose. Maintenance has compounding effects. Tested: "do nothing" loses 100%, one-track play loses on Cadet, and Commander wins about 50% with a good strategy.
- **Real NASA open data:** DONKI flares, CMEs and SEPs (51 events); OSDR RadLab ISS dose rates (dose calibration); OSDR study search (11 facts); Mars/Moon environment facts from NASA pages; Perseverance MEDA feed; NASA Image Library images; CSA food toolkit.
- **Clear attribution in the app:** every storm card shows "Real event: date, source: NASA DONKI" with a link. Simulated events are tagged "SIMULATED". A Data & Credits page lists everything. The footer reads "archived on (date)" and "NASA does not endorse this project."
- **Plain language for kids:** short sentences, an in-context glossary, mascot tips, read-aloud, and big friendly gauges (3 core gauges + food + health).
- **Browser-playable, no account:** static HTML/CSS/JS, PWA offline, 258 KB total.
- **Replayability:** seeded RNG, shareable mission codes, daily challenge, Today's mission (newest real event), 2 sites × 3 levels, badges and local high scores.
- **Failure that teaches:** Mission Debrief with a cause → effect chain, timeline chart, what NASA does, an OSDR fact, a dose comparison, and "Try again with a hint".
- **Accessibility:** keyboard-operable buttons, ARIA meters, high contrast, reduced motion, bigger text, read-aloud, touch targets ≥ 44 px.
- **Explained data use:** `docs/DATA_SOURCES.md` and `docs/mechanics.md`, including honest simplifications.

## 5 screenshot moments
1. **Storm hit:** the Sun flaring and the shield bubble glowing, with the "Real NASA data" card for the X8.2 solar flare of 10 Sep 2017.
2. **Forecast + action panel** on a phone: the ⚡⚡⚡ warning "in 2 days" next to the power-block budget and the cost/benefit chips.
3. **Mission Debrief:** cause → effect chain and the timeline chart with the orange real-storm marker.
4. **Dose vs real astronaut** card (RadLab) and the OSDR study card with its link.
5. **Mars at Jezero** during a dust storm with "Waiting for Earth… reply on sol 6", plus the Portuguese UI or Classroom mode with the big mission code.
