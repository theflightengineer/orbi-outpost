# Missing / failed data items

Last run: 2026-11-14 (key: NASA_API_KEY env var)

These items could not be downloaded or verified. Nothing was invented to replace them. Re-run `node tools/fetch-data.mjs` on a machine with internet access.

- APOD 2021-02-23: API returned a generic placeholder instead of the APOD entry
- APOD 2021-02-24: API returned a generic placeholder instead of the APOD entry
- APOD 2021-03-08: API returned a generic placeholder instead of the APOD entry
- NASA Mars Rover Photos API: HTTP 404 (service appears retired/unavailable; only a clickable link is used in-game).
- Mars Trek web services: HTTP 404 (service appears retired/unavailable; only a clickable link is used in-game).
- VERIFY MANUALLY: Mars surface absorbed dose 0.21 ± 0.04 mGy/day (Hassler et al. 2014, Science, doi:10.1126/science.1244797). The abstract (checked via Europe PMC) does not state the number; it comes from the paper body. Used in data/balance.json → radiation.siteRate_uGy_per_h.mars = 8.75.
- VERIFY MANUALLY: RadLab DOSTEL absorbed_dose_rate unit assumed to be µGy/h (the time-weighted mean, ~294 µGy/day, matches published ISS Columbus values). Check the RadLab data dictionary.
