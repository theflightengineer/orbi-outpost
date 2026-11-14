# Game mechanics & balance (all numbers live in `data/balance.json`)

The engine (`js/engine/`) is pure JavaScript: no DOM, no clock, no `Math.random()`. The same **mission code (seed) + same choices ⇒ the same mission**, which the tests check.

## One turn = one day (Moon) or one sol (Mars)

Order inside `stepDay()`:

1. **Spend power.** Each block costs `powerPerBlock` (10). You can use at most `maxBlocksPerDay` (6) blocks, and never more than your battery holds. If a plan costs too much, the extras are trimmed in this order: science, comms, maintenance, shield, greenhouse, life support.
2. **Action effects** (per block):

| Action | Benefit | Side cost |
|---|---|---|
| Life support | +14 oxygen | none |
| Shield | +15 shield | none |
| Greenhouse | +13 food, +3 oxygen | (Cadet: on/off switch, max 1) |
| Science | +10 points × efficiency | −2 oxygen, −2 equipment, EVA dose 0.25 × site background |
| Comms (max 1) | sends pending science; Earth reply → +1 day forecast lead for 2 days, plus a tip | reply arrives after `commDelayDays` (Moon 0, Mars 1), +15% × difficulty chance of 1 extra day (simulated) |
| Maintenance | +22 equipment, cleans 0.35 of the dust off the panels | none |

   Unused blocks stay in the battery. Saving power is a choice too, but it is never free: nothing else moves forward that day.
3. **Sunlight → power.** `gen = solarPeak × sun × (1 − dust) × efficiency`, minus `baseDraw` and `coldDraw`.
   - Moon south pole: `sun = minSun + (1−minSun)·(½ + ½·cos(2π(day+phase)/29.5))`, with minSun 0.6. Polar ridges are lit most of the time but the Sun stays low ([NTRS](https://ntrs.nasa.gov/api/citations/20230006101/downloads/PowerPoint%20Presentation.pdf)). The cycle uses the real 29.5-day synodic month. Cold draw +5 when sun < 0.75. Cadet always starts in the bright part of the cycle.
   - Mars: sun = 1 every sol, except during **simulated dust storms** (6% × difficulty chance per sol, lasting 3–5 sols at sun 0.45). Cold draw +3 every sol (cold Martian nights).
   - `efficiency = 1` while equipment ≥ 50%, otherwise `0.5 + 0.5·condition/50`. Skipping maintenance compounds: less power, more glitches.
4. **Real space weather (DONKI).** If a storm is scheduled today, see "Radiation" below.
5. **Simulated events:** glitch chance `(0.03 + 0.006·max(0, 60−condition)) × scale`, which costs 12 power or 10 oxygen; panel dust (Moon 8%, Mars 12% × scale, +0.15 dust); Mars dust storm.
6. **Crew needs:** −12 oxygen, −8 food, −3 shield decay, −5 equipment wear, +0.02 dust. If the battery is empty there is a **blackout**: −15 extra oxygen. This creates the power → oxygen cause-and-effect chain.
7. **End checks:** oxygen 0 → lose. Food 0 → lose (Explorer/Commander); in Cadet, food 0 instead costs 18 health per day. Health 0 → lose. Surviving the last day → win.

## Radiation: from a real DONKI event to a dose

**Dose unit = 1 "ISS-day":** the mean daily absorbed dose measured by the DOSTEL1 detector in the ISS Columbus module (NASA OSDR RadLab). We use a time-weighted mean of 6 archived days, 12.24 µGy/h ≈ **294 µGy/day**. Time weighting matters because DOSTEL samples more often in high-flux regions; a plain mean over-counts and would give 31 µGy/h.

**Background per day**, calibrated as site rate ÷ ISS rate:
- Moon: 13.2 µGy/h (Chang'e-4 LND, Zhang et al. 2020) ÷ 12.24 = **1.08**
- Mars: 0.21 mGy/day = 8.75 µGy/h (Curiosity RAD, Hassler et al. 2014) ÷ 12.24 = **0.71**

**Storm severity (0.5–5)** from the real event's own numbers:
- Solar flare (FLR): `1 + 1.5·log10(peak X-ray flux / 1e-5 W/m²)`. M1 = 1.0, X1 = 2.5, X9.3 ≈ 3.95.
- CME: `(speed − 500 km/s) / 600`. 974 km/s ≈ 0.8, 2650 km/s ≈ 3.6.
- SEP (energetic particles): `3`, plus 1 if DONKI links it to an X-class flare, plus 0.5 for M-class.

**Dose received:**
```
raw        = severity × 8 × siteStormFactor        (Moon 1.0, Mars 0.7)
protection = 0.30 + (0.85 − 0.30) × shield/100     (habitat walls alone block 30%)
storm dose = raw × (1 − protection)
background = siteBackground × (1 − protection)     (every day)
storm also damages the shield by 6 × severity
health     = 100 − 100 × totalDose / doseLimit − hunger
```
`doseLimit`: Cadet 35, Explorer 50, Commander 55.

### Honest simplifications
- The background numbers are real measurements. **The storm doses are game-scaled.** Real large SEP events can be much worse than this, which is why NASA plans storm shelters. Flares themselves mostly bring X-rays, and CMEs mostly matter at Earth, but kids need a single "storm" idea, so all three types raise dose, with SEPs counted strongest.
- A real event's date and strength are real. **The day it reaches your base is simulated.** Events are drawn from 2017–2026, not "now".
- Mars' thin air and the planet's bulk are folded into one factor (0.7) for storms. Background uses the real RAD measurement.
- On Mars the radio delay (3–22 min, shown in the message card) is real. Turning it into "replies arrive next sol" is a game abstraction for relay passes plus team planning time.
- Forecast lead: Cadet/Explorer 2 days, Commander 1. A recent Earth reply adds +1. Mars Explorer/Commander get −1, because Mars is often far from the Earth–Sun line where most solar monitors sit. Commander shows a ±1 strength range unless Earth just replied.

## Difficulty table

| | Cadet (7–8) | Explorer (9–10) | Commander (11–12) |
|---|---|---|---|
| Days/sols | 10 | 20 | 30 |
| Real storms | 2 | 4 | 7 |
| Food | greenhouse on/off; empty food hurts health | slider; empty = mission ends | same |
| Comm delay | friendly "waiting for Earth…" | shown with reply day | real minutes + reply day + forecast penalty on Mars |
| Science | counts immediately | must be sent with comms | same |
| Simulated surprises | ×0.5 | ×1 | ×1.4 |

## Balance results (`node tools/balance-report.mjs 200`, bots in `tests/strategies.mjs`)

| Site / level | do nothing | random | naive fixed plan | sensible |
|---|---|---|---|---|
| Moon Cadet | 0% | 100% | 100% | 100% |
| Moon Explorer | 0% | 59% | 14% | 84% |
| Moon Commander | 0% | 10% | 0% | 57% |
| Mars Cadet | 0% | 100% | 100% | 100% |
| Mars Explorer | 0% | 80% | 14% | 86% |
| Mars Commander | 0% | 6% | 0% | 48% |

On Cadet, one-track play loses: "oxygen only" wins 4% (Moon) and 20% (Mars), and "science only" wins 0.5% and 12%. Random play wins Cadet because a random spread ends up balanced. That is intended for 7–8 year-olds. The tests in `tests/balance.test.mjs` enforce these ranges.

## Scoring
`score = (days×10 + science sent + health×2 + 100 if won) × difficulty multiplier (1 / 1.5 / 2)`.

Badges:
- **Mission Complete**
- **Storm Survivor**: every storm hit and health ≥ 70
- **Energy Saver**: won with no blackout and power never below 20
- **Science Star**: ≥ 6 science per mission day
- **Green Thumb**: won with food ≥ 30
- **Good Listener**: talked to Earth ≥ 1 per 5 days
- **Master Mechanic**: won with equipment ≥ 40
