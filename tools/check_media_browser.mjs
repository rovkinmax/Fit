// Real Chrome checks with Node 22+ and installed Chrome; no npm dependencies.
// Set CHROME_PATH for a non-default installation. Usage:
// node tools/check_media_browser.mjs [--baseline] [--output /absolute/directory]
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, extname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const baseline = process.argv.includes('--baseline');
const outputIndex = process.argv.indexOf('--output');
const output = outputIndex < 0 ? await mkdtemp(join(tmpdir(), 'fit-media-evidence-')) : resolve(process.argv[outputIndex + 1]);
await mkdir(output, { recursive: true });
const root = resolve(import.meta.dirname, '..');
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let mode = 'hold';
let pending = [];
let failedSources = new Set();
let mediaRequests = 0;
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (path.startsWith('/assets-')) mediaRequests++;
  const send = async () => {
    if (response.destroyed) return;
    if (mode === 'error' && failedSources.has(path.slice(1))) {
      response.writeHead(404).end();
      return;
    }
    try {
      const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
      if (!file.startsWith(root + '/')) throw new Error('Outside root');
      const body = await readFile(file);
      response.writeHead(200, {
        'Content-Type': ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.jpg': 'image/jpeg' })[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
      }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  };
  if (path.startsWith('/assets-') && mode === 'hold') pending.push(send);
  else await send();
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(join(tmpdir(), 'fit-media-chrome-'));
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let socket;
let id = 0;
const calls = new Map();
const cacheHits = new Map();
const report = {
  baseline, root, profile, output,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root, encoding: 'utf8' }).trim(),
  gitStatus: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim(),
  cases: [],
};
function command(method, params = {}, sessionId) {
  const callId = ++id;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { calls.delete(callId); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
    calls.set(callId, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: callId, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function waitFor(check, label) {
  for (let i = 0; i < 300; i++) {
    if (await check()) return;
    await delay(100);
  }
  throw new Error(`Timed out: ${label}`);
}
const snapshot = `(() => {
  const rect = e => { const r=e.getBoundingClientRect(); return [r.x+scrollX,r.y+scrollY,r.width,r.height]; };
  return [...document.querySelectorAll('.panel.active .exercise-media img')].map(img => ({
    src: img.getAttribute('src'), image: rect(img), figure: rect(img.parentElement),
    next: rect(img.parentElement.nextElementSibling || img.parentElement.parentElement),
    natural: [img.naturalWidth,img.naturalHeight], declared: [img.width,img.height],
    attributes: [Number(img.getAttribute('width')),Number(img.getAttribute('height'))],
    complete: img.complete, lazy: img.loading, state: img.dataset.mediaState,
    background: getComputedStyle(img).backgroundColor, fit: getComputedStyle(img).objectFit,
    border: parseFloat(getComputedStyle(img).borderLeftWidth),
    opacity: getComputedStyle(img).opacity
  }));
})()`;
try {
  let port;
  await waitFor(async () => {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; return !!port; } catch { return false; }
  }, 'Chrome startup');
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  report.browser = version.Browser;
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r, j) => { socket.onopen = r; socket.onerror = j; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Network.requestServedFromCache' ||
        (message.method === 'Network.responseReceived' && message.params.response.fromDiskCache)) {
      cacheHits.set(message.sessionId, (cacheHits.get(message.sessionId) || 0) + 1);
    }
    const call = calls.get(message.id);
    if (!call) return;
    clearTimeout(call.timer);
    calls.delete(message.id);
    if (message.error) call.reject(new Error(JSON.stringify(message.error)));
    else call.resolve(message.result);
  };
  for (const [width, height] of [[390, 844], [1280, 900]]) {
    for (const outcome of baseline ? ['success'] : process.argv.includes('--error-only') ? ['error'] : ['success', 'error']) {
      const { browserContextId } = await command('Target.createBrowserContext');
      const { targetId } = await command('Target.createTarget', { url: 'about:blank', browserContextId });
      const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
      const c = (method, params) => command(method, params, sessionId);
      const evaluate = async expression => {
        const result = await c('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
      };
      await c('Page.enable');
      await c('Page.bringToFront');
      await c('Emulation.setFocusEmulationEnabled', { enabled: true });
      await c('Network.enable');
      await c('Network.setCacheDisabled', { cacheDisabled: true });
      await c('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
      for (let day = 1; day <= 5; day++) {
        mode = 'hold';
        pending = [];
        await c('Page.navigate', { url: `${origin}/?case=${width}-${outcome}-${day}#day-${day}` });
        await waitFor(() => evaluate(`document.readyState !== 'loading' && !!document.querySelector('#panel-day-${day}.active')`), 'day DOM');
        assert.equal(await evaluate('document.visibilityState'), 'visible', 'Lazy-loading tests need a foreground document');
        await evaluate(`document.documentElement.style.scrollBehavior='auto'; document.documentElement.style.overflowAnchor='none'; document.body.style.overflowAnchor='none'`);
        const count = await evaluate(`document.querySelectorAll('.panel.active .exercise-media img').length`);
        assert.ok(count > 0);
        // Trigger the native lazy loader by scrolling, without changing loading attributes.
        for (let index = 0; index < count; index++) {
          await evaluate(`document.querySelectorAll('.panel.active .exercise-media img')[${index}].scrollIntoView({block:'center',behavior:'instant'})`);
          await delay(40);
        }
        await delay(300);
        await evaluate('window.scrollTo({top:0,behavior:"instant"})');
        const before = await evaluate(snapshot);
        // Fail one actual image of each format per day; other media still
        // loads normally, exercising the surrounding mixed-success layout.
        failedSources = new Set(['.jpg', '.webp'].map(extension => before.find(image => image.src.endsWith(extension)).src));
        assert.ok(before.every(item => item.natural[0] === 0), 'Image requests must remain held');
        assert.ok(before.every(item => item.lazy === 'lazy'), 'Native lazy loading retained');
        if (!baseline) {
          assert.ok(before.every(item => item.image[2] > 0 && item.image[3] > 0), 'Reserved geometry');
          assert.ok(before.every(item => item.state === 'loading' && item.background === 'rgb(25, 45, 72)'), 'Dark loading state');
        }
        if (day === 1) {
          const { data } = await c('Page.captureScreenshot', { format: 'png' });
          await writeFile(join(output, `${width}-${outcome}-loading.png`), Buffer.from(data, 'base64'));
        }
        mode = outcome;
        await Promise.all(pending.splice(0).map(send => send()));
        // Revisit viewports as requests settle without forcing eager loading.
        if (outcome === 'error') {
          for (let index = 0; index < count; index++) {
            await evaluate(`document.querySelectorAll('.panel.active .exercise-media img')[${index}].scrollIntoView({block:'center',behavior:'instant'})`);
            try {
              await waitFor(() => evaluate(`document.querySelectorAll('.panel.active .exercise-media img')[${index}].complete`), `failed lazy image ${index}`);
            } catch (error) {
              report.unsettled = { width, outcome, day, index, pending: pending.length,
                environment: await evaluate(`({visibility:document.visibilityState,scrollY,innerHeight,scrollHeight:document.documentElement.scrollHeight})`),
                images: await evaluate(snapshot) };
              throw error;
            }
          }
          await evaluate('window.scrollTo({top:0,behavior:"instant"})');
        }
        try {
          await waitFor(() => evaluate(`Array.from(document.querySelectorAll('.panel.active .exercise-media img')).every(img => img.complete)`), 'image settlement');
        } catch (error) {
          report.unsettled = { width, outcome, day, images: await evaluate(snapshot) };
          throw error;
        }
        const after = await evaluate(snapshot);
        let maxShift = 0;
        for (let i = 0; i < before.length; i++) {
          for (const kind of ['image', 'figure', 'next']) {
            for (let coordinate = 0; coordinate < 4; coordinate++) {
              maxShift = Math.max(maxShift, Math.abs(after[i][kind][coordinate] - before[i][kind][coordinate]));
            }
          }
          if (!baseline) {
            if (outcome === 'success' || !failedSources.has(after[i].src)) {
              assert.deepEqual(after[i].natural, after[i].attributes, after[i].src);
              const [w, h] = after[i].attributes;
              assert.ok(Math.abs((after[i].image[2] - 2 * after[i].border) * h / w - (after[i].image[3] - 2 * after[i].border)) <= 1, `Rendered ratio: ${after[i].src}`);
              assert.equal(after[i].background, 'rgb(255, 255, 255)');
              assert.equal(after[i].opacity, '1');
              assert.equal(after[i].state, 'loaded');
            } else {
              assert.equal(after[i].state, 'error');
              assert.equal(after[i].natural[0], 0);
              assert.ok(after[i].image[3] > 0);
            }
          }
        }
        if (baseline) assert.ok(maxShift > 1, 'Baseline must reproduce layout displacement');
        else assert.ok(maxShift <= 1, `Media displacement ${width}/${outcome}/day${day}: ${maxShift}`);
        if (day === 1) {
          const { data } = await c('Page.captureScreenshot', { format: 'png' });
          await writeFile(join(output, `${width}-${outcome}-settled.png`), Buffer.from(data, 'base64'));
        }
        if (!baseline) {
          // Run the actual initializer after images have completed, exercising
          // the same branch used when cached images finish before defer runs.
          const states = after.map(item => item.state);
          await evaluate(`document.querySelectorAll('.exercise-media img').forEach(img => delete img.dataset.mediaState)`);
          await evaluate(await readFile(join(root, 'media.js'), 'utf8'));
          assert.deepEqual((await evaluate(snapshot)).map(item => item.state), states, 'Completed-image initializer');
        }
        if (!baseline && outcome === 'success' && day === 4) {
          // This source has 87 frames / 5790 ms: the longest existing animation.
          const clip = await evaluate(`(() => {
            const img=[...document.querySelectorAll('.panel.active img')].find(img=>img.src.includes('63501ccae03a077cda9337b4a30933b8'));
            img.scrollIntoView({block:'center',behavior:'instant'});
            const r=img.getBoundingClientRect();
            return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};
          })()`);
          await delay(200);
          const first = await c('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
          await delay(500);
          const second = await c('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
          assert.notEqual(first.data, second.data, 'Long WebP must continue animating');
          await writeFile(join(output, `${width}-animation-a.png`), Buffer.from(first.data, 'base64'));
          await writeFile(join(output, `${width}-animation-b.png`), Buffer.from(second.data, 'base64'));
          report.animation = [...(report.animation || []), { width, frames: 87, durationMs: 5790, changed: true }];
        }
        report.cases.push({ width, height, outcome, day, count, failedSources: outcome === 'error' ? [...failedSources] : [], maxShift, before, after });
        console.log(`${baseline ? 'REPRODUCED' : 'PASS'} ${width} ${outcome} day${day}: ${count} images; max delta ${maxShift.toFixed(3)}px`);
      }
      if (!baseline && outcome === 'success') {
        mode = 'success';
        await c('Network.setCacheDisabled', { cacheDisabled: false });
        // First warm with caching enabled, then actually revisit cached media.
        const url = `${origin}/?cached=${width}#day-1`;
        const requestsPerVisit = [];
        for (let visit = 0; visit < 2; visit++) {
          const requestsBefore = mediaRequests;
          await c('Page.navigate', { url });
          await waitFor(() => evaluate(`document.readyState !== 'loading' && !!document.querySelector('#panel-day-1.active')`), 'cached day DOM');
          await evaluate(`document.documentElement.style.scrollBehavior='auto'`);
          for (let index = 0; index < 35; index++) {
            await evaluate(`document.querySelectorAll('.panel.active img')[${index}].scrollIntoView({block:'center',behavior:'instant'})`);
            await waitFor(() => evaluate(`document.querySelectorAll('.panel.active img')[${index}].complete`), 'cached image');
          }
          const cached = await evaluate(snapshot);
          assert.ok(cached.every(image => image.state === 'loaded' && image.natural[0] > 0));
          requestsPerVisit.push(mediaRequests - requestsBefore);
        }
        report.cached = [...(report.cached || []), { width, hits: cacheHits.get(sessionId) || 0, requestsPerVisit }];
        assert.ok(cacheHits.get(sessionId) > 0 || requestsPerVisit[1] === 0, 'Real network cache reuse observed');
        report.cached.at(-1).result = 'PASS';
      }
      await command('Target.disposeBrowserContext', { browserContextId });
    }
  }
  report.result = 'PASS';
} catch (error) {
  report.result = 'FAIL';
  report.error = error.stack;
  process.exitCode = 1;
  console.error(error);
} finally {
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Evidence: ${output}`);
  if (socket?.readyState === WebSocket.OPEN) {
    await command('Browser.close').catch(() => {});
    socket.close();
  }
  chrome.kill('SIGTERM');
  server.closeAllConnections();
  await new Promise(r => server.close(r));
}
