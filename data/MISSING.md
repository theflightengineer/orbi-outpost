# Missing / failed data items

Last run: 2026-11-14 (key: NASA_API_KEY env var)

These items could not be downloaded or verified. Nothing was invented to replace them. Re-run `node tools/fetch-data.mjs` on a machine with internet access.

- APOD 2021-02-23: API returned a generic placeholder instead of the APOD entry
- APOD 2021-02-24: API returned a generic placeholder instead of the APOD entry
- APOD 2021-03-08: API returned a generic placeholder instead of the APOD entry
- NASA Mars Rover Photos API: HTTP 404 (service appears retired/unavailable; only a clickable link is used in-game).
- Mars Trek web services: HTTP 404 (service appears retired/unavailable; only a clickable link is used in-game).

## Checked by hand (2026-11-15)
These were flagged by the script because it could not confirm them automatically. Both were then checked manually and are correct.
- Mars surface absorbed dose **0.210 ± 0.040 mGy/day** at Gale crater: stated in the body of Hassler et al., Science (doi:10.1126/science.1244797); the abstract does not give it. Used in data/balance.json → radiation.siteRate_uGy_per_h.mars = 8.75.
- RadLab `absorbed_dose_rate` unit is **µGy/hour**, per the RadLab knowledge base (https://visualization.osdr.nasa.gov/radlab/kb/absorbed_dose_rate). The resulting ~294 µGy/day matches published ISS Columbus DOSTEL values.
