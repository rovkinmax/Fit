# Site verification

Run from the repository root:

```sh
python3 tools/verify_site.py
node --test tests/*.test.cjs
node tools/check_tabs_browser.mjs --output /absolute/evidence/directory
```

The structural verifier does not replace the JavaScript or real-browser checks.
The JavaScript tests execute the production tab script with deterministic DOM
and storage fixtures. The browser check serves the actual static site over HTTP
and uses Chrome's DevTools protocol to verify rendered visibility, accessibility
selection, reloads, fresh documents at the same origin, deep links, malformed
storage and independently injected storage getter/read/write failures. It
captures page exceptions and console errors in `report.json`.

Browser checks require Node 22+ and local Chrome. Set `CHROME_PATH` if Chrome is
not at the default macOS application path. No npm install is needed. Each run
uses a fresh disposable browser profile and closes its browser and HTTP server.
The profile and report remain outside the repository for inspection.

Existing media behavior has a separate browser check:

```sh
node tools/check_media_browser.mjs --output /absolute/media/evidence/directory
```
