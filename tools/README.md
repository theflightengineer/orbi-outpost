# tools/ (development only, do not upload)

| File | What it does |
|---|---|
| `fetch-data.mjs` | Downloads the real data once and writes `/data/*.json`, `/img/*.jpg` and `data/MISSING.md`. Node 18+, no npm install. `node tools/fetch-data.mjs [donki osdr radlab sites csa images]` runs only some parts. |
| `sources/site_facts.source.json` | Moon/Mars facts with source URL and a short quote. The script re-downloads each page and sets `verified: true/false`. |
| `sources/csa_food.source.json` | CSA food toolkit facts and classroom links, also re-verified. |
| `sources/osdr_kid.source.json` | Our kid-friendly sentence for each OSDR study ID. Title and URL are filled in from the OSDR API at fetch time. If a study can't be fetched, its fact is skipped and reported. |
| `cache/osdr_candidates.json` | All OSDR search hits (to pick new studies from). |
| `balance-report.mjs` | Win rates of bot strategies per site/level, for tuning `data/balance.json`. |
| `trace.mjs` | Prints one bot mission day by day. |
| `serve.mjs` | Tiny local static server. |
| `smoke.mjs` | Headless Chrome/Edge smoke test via DevTools Protocol: plays the tutorial, a full losing mission and every page; reports console errors and external requests; saves screenshots. |

## API key
Set `NASA_API_KEY` as an environment variable (get one free at https://api.nasa.gov). It's used only for the HTTP requests in `fetch-data.mjs`. Endpoints are recorded with `api_key=***`.

## Endpoints
- DONKI: `https://api.nasa.gov/DONKI/{FLR|CME|SEP}?startDate&endDate&api_key`, falling back to `https://ccmc.gsfc.nasa.gov/DONKI/WS/get/{type}` (no key). SEP rejects ranges over about 2 months, so windows are ≤ 1 month.
- OSDR search: `https://osdr.nasa.gov/osdr/data/search?term=…&type=cgene&size=15`
- RadLab: `https://visualization.osdr.nasa.gov/radlab/api/?instrument_id=DosTel1&timestamp>=…&timestamp<=…&absorbed_dose_rate&module&format=tsv`
- Mars weather: `https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json` (and `msl`)
- Images: `https://images-api.nasa.gov/search?q=…&media_type=image`
