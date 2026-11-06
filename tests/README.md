# Site verification

Run from the repository root:

```sh
python3 tools/verify_site.py
node --test tests/*.test.cjs
node tools/check_tabs_browser.mjs --output /absolute/evidence/directory
node tools/check_timer_browser.mjs --output /absolute/timer/evidence/directory
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

Timer model tests inject a wall clock and cover deadlines, pause/resume, repeated
starts and completion cycles, duration bounds, strict manual parsing, and storage
failures. The browser timer checks cover the actual panel, persistence, day/hash
navigation, keyboard entry, completion and optional audio, restricted storage,
real background target visibility, and mobile/enlarged-text layout. Reports
include commit/tree and dirty status; screenshots show the manual error state
and reachable last content. Safe-area CSS support in Chrome emulation does not
constitute physical iOS device testing. Audio evidence proves a running
AudioContext and oscillator start, not physical audibility.

Manual duration format is `m:ss`, from `0:00` to `1440:00` (24 hours). Edits
pause and replace the countdown; reset restores the selected duration. Only
duration and mute preferences persist. The timer uses an absolute `Date.now`
deadline so hidden-tab elapsed time is included, but system wall-clock changes
affect the deadline. Browser suspension can delay completion feedback until
the page runs again; closing the page does not continue the countdown.
