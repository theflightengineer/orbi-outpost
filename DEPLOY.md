# Deploying to InfinityFree (free plan)

The game is just static files. No build step, no Node or database on the server.

## 1. Create the site
1. Sign up at https://www.infinityfree.com and click **Create Account** (hosting account).
2. Pick a free subdomain (e.g. `orbi-outpost.rf.gd`) or connect your own domain. Wait a few minutes for it to activate.

## 2. Upload the files (FTP into `htdocs`)
1. In the InfinityFree client area, open your account and find **FTP Details**: host (e.g. `ftpupload.net`), username (`if0_…`), password and port 21.
2. Install the free FTP client **FileZilla** and connect with those details.
3. On the right (server) side, open the **`htdocs`** folder and delete the default `index2.html` if it's there.
4. On the left (your computer), open `junior-astronaut-trainer/`. Select and upload these files and folders **into `htdocs`**:
   ```
   index.html  manifest.webmanifest  sw.js  .htaccess
   css/  js/  i18n/  img/  data/  fonts/
   api/          (optional: only if you want the live DONKI proxy, see step 4)
   ```
5. **Do NOT upload** (not needed, some contain dev info):
   ```
   tools/  tests/  docs/  node_modules/  package.json  README.md  DEPLOY.md
   data/MISSING.md  tools/cache/  api/private/config.php from your PC (create it on the server instead)
   ```
   (`.htaccess` also blocks `.md`, `.mjs` and `package.json` if they get uploaded by mistake.)
6. Visit `http://yourname.rf.gd/`. The game should load. On the very first visit InfinityFree may show a short "checking your browser" page; that's normal.

## 3. Turn on free HTTPS (SSL)
HTTPS is needed for the offline mode (service worker) and the share/copy button.
1. Client area → your account → **SSL Certificates** → **Add SSL Certificate** → choose your domain → **Let's Encrypt** (or GoGetSSL).
2. Follow the steps (InfinityFree adds the DNS validation record for its own subdomains automatically) and wait until the status is **Ready**. Click **Install** (it's installed for you on the free plan).
3. Open `https://yourname.rf.gd/`. Optional: to force HTTPS, add this to the top of `htdocs/.htaccess`:
   ```apache
   RewriteEngine On
   RewriteCond %{HTTPS} off
   RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
   ```

## 4. (Optional) Live DONKI for "Today's mission"
The game works perfectly without this. It only adds a "LIVE" newest event.
1. Upload the `api/` folder (with `donki.php`, `private/.htaccess`, `private/config.sample.php`, `cache/.htaccess`).
2. In FileZilla, right-click `htdocs/api/private/config.sample.php`, then **Copy** / **Rename** it to `config.php`, and edit it **on the server**. Set `'ENABLED' => true` and `'NASA_API_KEY' => 'your key from api.nasa.gov'`. The `.htaccess` in that folder blocks web access, so the key is never public. Never put the key in JavaScript.
3. Check that `htdocs/data/config.json` has `"liveDonki": true` (the repo ships with true; without `config.php` the proxy just answers "archived" and the game uses the archive).
4. Test: open `https://yourname.rf.gd/api/donki.php`. You should see JSON with `"source":"live"` (or `"archived"` and a reason if something failed; the game then quietly uses the archive). Responses are cached for 1 hour in `api/cache/` to respect InfinityFree's limits.
   - Note: InfinityFree's anti-bot cookie can block calls from other sites, but the game calls its own domain, so it works after the first page load. If `donki.php` reports `live fetch failed`, the free plan may be blocking outgoing requests. Just leave `liveDonki` false.

## 5. Update the data later
1. On your computer: `$env:NASA_API_KEY="your_key"; node tools/fetch-data.mjs` (or `NASA_API_KEY=… node tools/fetch-data.mjs`).
2. Check `data/MISSING.md`, then run `npm test` (data tests must pass).
3. Upload only the changed `data/*.json` (and `img/` if images changed) to `htdocs/data/`, overwriting the old files.
4. Bump `VERSION` in `sw.js` (e.g. `orbi-v1.0.1`) and upload `sw.js`, so returning players' offline caches refresh.

## Troubleshooting
- **Blank page or "Could not load game data":** a folder is missing or was uploaded inside another folder. `htdocs/index.html` and `htdocs/data/balance.json` must exist at those exact paths.
- **Old version keeps showing:** bump `VERSION` in `sw.js`, or hard-refresh (Ctrl+F5).
- **Speech not working:** read-aloud uses the device's built-in voices. Some browsers don't have Portuguese voices installed.
