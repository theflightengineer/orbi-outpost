# Visual redesign — "Toy mission console"

Subject: a mission-control game for kids aged 7–12 who run a Moon or Mars base. The visuals have three jobs:
- make the four resources instantly readable;
- make real solar storms feel dramatic;
- make failure feel safe.

## Concept
The screen is a **chunky toy control console**, like a plastic mission panel a kid could own:
- a round **porthole** looks out onto the base;
- four **liquid tanks** show the resources;
- **push-buttons** have real travel (they sink when pressed);
- the debrief hands out a **mission patch**.

The bold, memorable part is the porthole and the tanks. Everything else stays quiet: flat indigo console panels with a single bevel line.

## Tokens
| Name | Hex | Role |
|---|---|---|
| Space Ink | `#0D1137` | page background (deep space) |
| Nebula | `#2B1A66` | background gradient partner |
| Console | `#1A2158` | panels |
| Console Edge | `#323E8F` | panel bevel / dividers |
| Starlight | `#F3F1FF` | text (contrast 16:1 on Space Ink) |
| Haze | `#B9BCE8` | secondary text (9:1) |
| Power — Sunburst | `#FFC531` | ⚡ tank, primary "launch" buttons (ink text) |
| Oxygen — Sky | `#43D2FF` | 🫁 tank |
| Shield — Plasma | `#B98AFF` | 🛡️ tank, shield bubble |
| Food — Sprout | `#59E07A` | 🥬 tank |
| Health — Coral | `#FF6B8B` | ❤️ meter, warnings (never red alarms for kids) |

**Type**
- **Lilita One** (display): titles, tank numbers, buttons. A poster-like, mission-patch voice.
- **Atkinson Hyperlegible** (body): designed by the Braille Institute so letters like I/l/1 and b/d are easy to tell apart, which suits young and dyslexic readers.
- Both are self-hosted WOFF2 (Latin subset, Portuguese accents included), 45 KB in total, under SIL OFL 1.1.
- Scale (×1.25): 14 · 16 · 20 · 25 · 31 · 39 · 49 px.
- Sentence case everywhere: no all-caps eyebrows. Real-data tags are coloured pills in normal case.

**Shape**
- The radius encodes hierarchy: porthole = circle/oval window; tanks = capsules; panels = 22 px; buttons = pills.
- Buttons get a 6 px "depth" shadow that collapses on press.

## Layout
```
phone                              desktop ≥ 1000 px
┌ Orbi  Sol 3/30  [Moon] ┐          ┌──────────── porthole ───────────┬ control deck ┐
│ ( porthole scene )     │          │                                 │  actions     │
│ [⚡][🫁][🛡][🥬] tanks   │          ├ [⚡][🫁][🛡][🥬]  ❤ 🔧 meters     │  preview     │
│ ❤ ▬▬▬   🔧 ▬▬▬          │          ├ forecast        │ Earth radio   │ [ END SOL ]  │
│ forecast · Earth radio │          └─────────────────────────────────┴──────────────┘
│ control deck           │
│ [   END SOL   ]        │
```
- Panel text is left-aligned. Only the title screen and debrief hero are centred.
- On desktop the control deck sticks to the top so the "End" button is always in reach.

## Motion
Kept to purposeful moments only:
1. **Title:** slow star drift, plus Orbi bobbing (the one ambient loop).
2. **Turn change:** tanks pour from yesterday's level to today's.
3. **Real storm:** the Sun flares, a CME ring expands, the porthole flashes and the shield bubble ripples.
4. **Debrief win:** one confetti burst. Debrief loss: a calm pulse, no shake.

The `prefers-reduced-motion` setting (and the in-game toggle) turns all of it off. Values still update.

## Review against the brief
| My first instinct | Why it was generic | What I changed it to |
|---|---|---|
| Frosted-glass cards with neon glow on every panel | The standard "space dashboard" look | Opaque toy-plastic panels with one bevel. Glow is kept only for the Sun, the shield bubble and the tanks' liquid, where light means something. |
| A gradient-text accent on one word of the title | A known "generated page" tell | The whole title is set as a chunky stacked mission-patch wordmark. |
| One accent colour | — | Four resource colours, as the brief asks. Colour is information: each tank, action row and chart line uses its resource colour. |
