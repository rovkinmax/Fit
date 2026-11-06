// Node 22+ and installed Chrome; no npm dependencies.
// Usage: node tools/check_tabs_browser.mjs [--output /absolute/directory]
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, extname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '..');
const outputIndex = process.argv.indexOf('--output');
const output = outputIndex < 0 ? await mkdtemp(join(tmpdir(), 'fit-tabs-evidence-')) : resolve(process.argv[outputIndex + 1]);
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'fit-tabs-chrome-'));
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + '/')) throw Error('Outside root');
    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type': ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg' })[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  { stdio: 'ignore' });
let socket;
let id = 0;
const calls = new Map();
const report = {
  root, profile, origin,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
  status: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim(),
  cases: [], errors: [],
};
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const callId = ++id;
    const timer = setTimeout(() => { calls.delete(callId); reject(Error(`CDP timeout: ${method}`)); }, 30000);
    calls.set(callId, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: callId, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function waitFor(check) {
  for (let i = 0; i < 300; i++) {
    if (await check()) return;
    await delay(100);
  }
  throw Error('Timed out waiting for document');
}
try {
  let port;
  await waitFor(async () => {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; return !!port; } catch { return false; }
  });
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  report.browser = version.Browser;
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r, j) => { socket.onopen = r; socket.onerror = j; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown' ||
        (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error')) report.errors.push(message);
    const call = calls.get(message.id);
    if (!call) return;
    clearTimeout(call.timer);
    calls.delete(message.id);
    if (message.error) call.reject(Error(JSON.stringify(message.error)));
    else call.resolve(message.result);
  };
  async function openTab(injection = '') {
    const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
    const c = (method, params) => command(method, params, sessionId);
    await c('Page.enable');
    await c('Runtime.enable');
    if (injection) await c('Page.addScriptToEvaluateOnNewDocument', { source: injection });
    const evaluate = async expression => {
      const result = await c('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const navigate = async (hash = '') => {
      await c('Page.navigate', { url: 'about:blank' });
      await waitFor(() => evaluate(`location.href === 'about:blank'`));
      await c('Page.navigate', { url: origin + '/' + hash });
      await waitFor(() => evaluate(`document.readyState === 'complete' && !!document.querySelector('.tab-btn')`));
    };
    const check = async (expected, label) => {
      const state = await evaluate(`({
        selected: [...document.querySelectorAll('[role=tab][aria-selected=true]')].map(e=>e.id),
        visible: [...document.querySelectorAll('[role=tabpanel]')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.id),
        active: [...document.querySelectorAll('.panel.active')].map(e=>e.id),
        hash: location.hash,
        media: [...document.querySelectorAll('.exercise-media img')].every(e=>e.width>0 && e.height>0)
      })`);
      assert.deepEqual(state.selected, [expected], label);
      assert.deepEqual(state.visible, [expected.replace('tab-', 'panel-')], label);
      assert.deepEqual(state.active, state.visible, label);
      assert.equal(state.media, true, 'FIT-3 declared dimensions retained');
      report.cases.push({ label, expected, state });
    };
    return { targetId, c, evaluate, navigate, check };
  }
  const p = await openTab();
  await p.navigate();
  await p.check('tab-overview', 'fresh origin defaults to Overview');
  const ids = ['tab-overview', ...Array.from({ length: 5 }, (_, i) => `tab-day-${i + 1}`)];
  for (const selected of [...ids.slice(1), ids[0]]) {
    await p.evaluate(`document.getElementById(${JSON.stringify(selected)}).click()`);
    await p.check(selected, 'click ' + selected);
    await p.c('Page.reload');
    await waitFor(() => p.evaluate(`document.readyState === 'complete'`));
    await p.check(selected, 'reload ' + selected);
    const fresh = await openTab();
    await fresh.navigate();
    await fresh.check(selected, 'return visit without hash ' + selected);
    assert.equal(await fresh.evaluate('location.hash'), '');
    await command('Target.closeTarget', { targetId: fresh.targetId });
  }
  for (const selected of ids) {
    await p.evaluate(`localStorage.setItem('fit.selected-tab','tab-day-4')`);
    await p.navigate('#' + selected.replace(/^tab-(?=day)/, ''));
    await p.check(selected, 'explicit URL overrides storage ' + selected);
    assert.equal(await p.evaluate(`localStorage.getItem('fit.selected-tab')`), selected);
  }
  for (const saved of ['', 'garbage', '{"day":3}', 'tab-day-6']) {
    await p.evaluate(`localStorage.setItem('fit.selected-tab',${JSON.stringify(saved)})`);
    await p.navigate('#unknown');
    await p.check('tab-overview', 'invalid saved value ' + saved);
  }
  await p.evaluate(`localStorage.setItem('fit.selected-tab','tab-day-3')`);
  await p.navigate('#unknown');
  await p.check('tab-day-3', 'unknown hash restores saved day');
  assert.equal(await p.evaluate('location.hash'), '#unknown');
  for (const [name, injection] of [
    ['getter', `Object.defineProperty(window,'localStorage',{get(){throw Error('denied')}})`],
    ['read', `Storage.prototype.getItem=function(){throw Error('denied')}`],
    ['write', `Storage.prototype.setItem=function(){throw Error('quota')}`],
  ]) {
    await p.evaluate(`localStorage.setItem('fit.selected-tab','tab-day-3')`);
    const restricted = await openTab(injection);
    await restricted.navigate();
    await restricted.check(name === 'write' ? 'tab-day-3' : 'tab-overview', name + ' failure startup');
    await restricted.navigate('#day-2');
    await restricted.check('tab-day-2', name + ' failure deep link');
    await restricted.evaluate(`document.getElementById('tab-day-5').click()`);
    await restricted.check('tab-day-5', name + ' failure click');
    await restricted.evaluate(`location.hash='#day-1'`);
    await waitFor(() => restricted.evaluate(`document.getElementById('tab-day-1').getAttribute('aria-selected')==='true'`));
    await restricted.check('tab-day-1', name + ' failure hashchange');
    await command('Target.closeTarget', { targetId: restricted.targetId });
  }
  assert.deepEqual(report.errors, [], 'No page exceptions or console errors');
  report.result = 'PASS';
} catch (error) {
  report.result = 'FAIL';
  report.error = error.stack;
  console.error(error);
  process.exitCode = 1;
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
