# Data sources (judge summary)

Everything was downloaded **once** by `tools/fetch-data.mjs` on **2026-11-14** and shipped as static JSON in `/data`. The browser never calls an outside server (verified with a headless browser: 0 external requests). The UI says "Real NASA data from DONKI, archived on 14 November 2026". The one live part is **Today's mission**: it asks the site's own PHP proxy (`api/donki.php`), which fetches the newest DONKI event of the last 30 days from api.nasa.gov (CCMC as backup) and caches it for 1 hour. It is tagged **LIVE** with the fetch time only when that really worked; otherwise the game uses the newest archived event, tagged **ARCHIVED**. The API key stays on the server.

> **NASA does not endorse this project.** The Canadian Space Agency (CSA) does not endorse it either. NASA data is public domain; CSA material is credited and linked, not copied wholesale.

| Dataset | Endpoint used | What the game uses it for | Why | Retrieved |
|---|---|---|---|---|
| **NASA DONKI** (CCMC): FLR, CME, SEP | `api.nasa.gov/DONKI/CME`, `/SEP` (with API key) and `ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR`. api.nasa.gov returned 404 for FLR, so the script falls back to the same database's public CCMC web service. | 51 real events (21 flares, 12 CMEs, 18 SEPs) from 11 windows: Sep 2017, Oct 2021, Feb 2022, Feb 2023, Feb 2024, May 2024 "Gannon storm", Oct 2024, Jan 2025, Jun 2025, Nov 2025, and the last 45 days. Each storm card shows its date, class/speed and a DONKI link. "Today's mission" uses the newest event (CME, 10 Nov 2026). | Real space weather is the heart of the radiation trade-off | 2026-11-14 |
| **NASA OSDR RadLab** (Radiation Dosimetry) | `visualization.osdr.nasa.gov/radlab/api/?instrument_id=DosTel1&…&absorbed_dose_rate&module&format=tsv` | ISS DOSTEL1 (Columbus module) dose rate for 6 days of 2022. Time-weighted mean 12.24 µGy/h ≈ 294 µGy/day = the game's dose unit. Calibrates background radiation and powers the "real astronaut dose" comparison in the debrief. | Grounds an abstract "dose" in a real astronaut measurement | 2026-11-14 |
| **NASA OSDR** study search | `osdr.nasa.gov/osdr/data/search?term=…&type=cgene` with terms: bone density, muscle, sleep, immune system, radiation, plant growth | 11 studies (OSD-417, 342, 946, 937, 32, 903, 689, 269, 772, 992, 546). Title and URL come from the API. The kid-friendly sentence was written by us from the fetched description. The debrief shows one fact matching the failure cause. | Real astronaut-health science, linked to what went wrong | 2026-11-14 |
| **Moon facts** | NASA Science pages (Moon Facts, Weather on the Moon, Top Moon Questions), NASA NTRS south-pole lighting deck; Zhang et al. 2020 *Sci. Adv.* (Chang'e-4 LND, 13.2 µGy/h, abstract checked via Europe PMC) | Low Sun (minSun), lunar day cycle (29.5 d), no shield from atmosphere, dust, 1.3 s delay (our arithmetic from 384,400 km), background radiation | Site-specific numbers that change gameplay | 2026-11-14; quotes re-checked automatically (12/12 ✔) |
| **Mars facts** | NASA Science (Mars Facts, Mars Relay Network, Perseverance/Jezero); Hassler et al. 2014 *Science* (Curiosity RAD 0.21 mGy/day); Perseverance MEDA weather feed `mars.nasa.gov/rss/api/?feed=weather&category=mars2020` | Sol length, temperatures, thin CO₂ air, dust storms, 3–22 min delay, Jezero description, background radiation | Same | 2026-11-14 |
| **CSA toolkit "Food production on the Moon and in remote areas"** | Toolkit page plus the two linked CSA science pages (quotes auto-verified) | 8 food facts shown with the greenhouse mechanic. Classroom links (Interplanetary Farming, Tomatosphere, Toolkits, Youth & educators). | Source for the food mechanic and kid facts | 2026-11-14 |
| **NASA Image and Video Library** | `images-api.nasa.gov/search` | 2 small public-domain thumbnails: PIA25068 "Dust Storm and Jezero Crater" (NASA/JPL-Caltech/MSSS) and PIA12905 "Lunar South Pole – Out of the Shadows" (NASA/GSFC/ASU) | Real imagery of the two sites (13 KB and 19 KB) | 2026-11-14 |

## Requested but unavailable (details in `data/MISSING.md`)
- **NASA Mars Rover Photos API**: HTTP 404, appears retired. Replaced by the NASA Image Library image above.
- **Mars Trek web services**: HTTP 404. The game only links to trek.nasa.gov.
- **APOD API**: returned a generic placeholder instead of the requested entries. Only a link is shown.
- **Checked by hand (2026-11-15):** the Mars 0.210 ± 0.040 mGy/day figure (in the body of Hassler et al., not the abstract) and the RadLab unit (µGy/hour, per the RadLab knowledge base: https://visualization.osdr.nasa.gov/radlab/kb/absorbed_dose_rate).
- The OSDR "sleep" search returned no study directly about astronaut sleep, so OSD-32 (brain / fluid shift) is used instead.

## Real vs simulated in the game
- **Real:** storm dates, types and strengths (DONKI); ISS dose level (RadLab); Moon/Mars environment numbers; OSDR findings; CSA food facts; site images.
- **Simulated (labeled "SIMULATED" on every card):** equipment glitches, panel dust, Mars dust storms, delayed messages, and which mission day a real storm arrives.
- **Simplified game rules:** resource arithmetic and the severity → dose formula (see `docs/mechanics.md`).
