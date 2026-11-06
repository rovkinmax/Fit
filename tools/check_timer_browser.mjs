// Dependency-free Chrome/CDP interaction checks. Node 22+, local Chrome.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, extname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '..');
const outputIndex = process.argv.indexOf('--output');
const output = outputIndex < 0 ? await mkdtemp(join(tmpdir(), 'fit-timer-evidence-')) : resolve(process.argv[outputIndex + 1]);
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'fit-timer-chrome-'));
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + '/')) throw Error('Outside root');
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': ({
      '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
      '.webp': 'image/webp', '.jpg': 'image/jpeg',
    })[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let socket, sequence = 0;
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
    const id = ++sequence;
    const timeout = setTimeout(() => { calls.delete(id); reject(Error(`CDP timeout: ${method}`)); }, 30000);
    calls.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function waitFor(check) {
  for (let i = 0; i < 150; i++) { if (await check()) return; await delay(100); }
  throw Error('Timed out waiting for condition');
}
const instrumentation = `
window.timerEvidence = { oscillators: 0, started: 0, audioStates: [], visibility: [], completions: 0, intervals: 0, maxIntervals: 0 };
const liveIntervals = new Set();
const originalSet = window.setInterval.bind(window), originalClear = window.clearInterval.bind(window);
window.setInterval = (...args) => { const id = originalSet(...args); liveIntervals.add(id); timerEvidence.intervals = liveIntervals.size; timerEvidence.maxIntervals = Math.max(timerEvidence.maxIntervals, liveIntervals.size); return id; };
window.clearInterval = id => { liveIntervals.delete(id); timerEvidence.intervals = liveIntervals.size; originalClear(id); };
document.addEventListener('visibilitychange', () => timerEvidence.visibility.push({state: document.visibilityState, at: Date.now()}));
if (window.AudioContext) {
 const original = AudioContext.prototype.createOscillator;
 AudioContext.prototype.createOscillator = function(...args) {
  timerEvidence.oscillators++; timerEvidence.audioStates.push(this.state);
  const oscillator = original.apply(this,args), start = oscillator.start.bind(oscillator);
  oscillator.start = (...args) => { timerEvidence.started++; return start(...args); };
  return oscillator;
 };
}
document.addEventListener('DOMContentLoaded', () => {
 new MutationObserver(() => {
  if(document.querySelector('#rest-timer [role=status]').textContent === 'Time is up') timerEvidence.completions++;
 }).observe(document.querySelector('#rest-timer [role=status]'), {childList:true, subtree:true});
});
`;
try {
  let port;
  await waitFor(async () => {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; return !!port; } catch { return false; }
  });
  report.browser = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).Browser;
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r, j) => { socket.onopen = r; socket.onerror = j; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') report.errors.push(message.params);
    const call = calls.get(message.id);
    if (!call) return;
    clearTimeout(call.timeout); calls.delete(message.id);
    if (message.error) call.reject(Error(JSON.stringify(message.error))); else call.resolve(message.result);
  };
  async function page(injection = '') {
    const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
    const c = (method, params) => command(method, params, sessionId);
    await c('Page.enable'); await c('Runtime.enable');
    await c('Page.addScriptToEvaluateOnNewDocument', { source: instrumentation + injection });
    const evaluate = async expression => {
      const result = await c('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
      if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const navigate = async () => {
      await c('Page.navigate', { url: origin });
      await waitFor(() => evaluate(`document.readyState==='complete' && !!document.querySelector('[data-time]')`));
    };
    await navigate();
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const state = () => evaluate(`({
      time: document.querySelector('[data-time]').textContent,
      toggle: document.querySelector('[data-toggle]').textContent,
      status: document.querySelector('#rest-timer [role=status]').textContent,
      error: document.querySelector('[data-error]').textContent,
      muted: document.querySelector('[data-mute]').getAttribute('aria-pressed'),
      evidence: timerEvidence
    })`);
    const edit = async text => {
      await click('[data-time]');
      await evaluate(`document.querySelector('#rest-duration').value=${JSON.stringify(text)}; document.querySelector('#rest-timer form').requestSubmit()`);
    };
    return { targetId, c, evaluate, click, state, edit, navigate };
  }
  const p = await page();
  assert.equal((await p.state()).time, '1:00');
  await p.click('[data-toggle]'); await delay(1150); await p.click('[data-toggle]');
  const paused = (await p.state()).time;
  assert.notEqual(paused, '1:00'); await delay(1100); assert.equal((await p.state()).time, paused);
  await p.click('[data-toggle]'); await delay(1100); await p.click('[data-reset]');
  assert.equal((await p.state()).time, '1:00');
  for (let i = 0; i < 10; i++) await p.click('[data-toggle]');
  assert.equal((await p.state()).toggle, 'Start');
  assert.equal((await p.state()).evidence.maxIntervals, 1);
  await p.click('[data-toggle]'); await p.click('[data-adjust="15"]');
  assert.equal((await p.state()).time, '1:15'); assert.equal((await p.state()).toggle, 'Start');
  await p.click('[data-adjust="-15"]'); await p.edit('0:30');
  await p.click('[data-toggle]');
  await p.edit('0:30');
  assert.equal((await p.state()).toggle, 'Start', 'manual apply pauses running timer');
  await p.click('[data-toggle]');
  for (let day = 1; day <= 5; day++) {
    await p.click(`#tab-day-${day}`);
    await p.evaluate(`location.hash='day-${day}';window.scrollTo(0,500)`);
    assert.equal((await p.state()).toggle, 'Pause');
  }
  assert.equal(await p.evaluate(`document.querySelectorAll('#rest-timer').length`), 1);
  await p.click('[data-toggle]');
  for (const invalid of ['', '-1:00', '1:60', '1440:01', 'no']) {
    await p.edit(invalid);
    assert.match((await p.state()).error, /Enter m:ss/);
    assert.equal(await p.evaluate(`document.activeElement.id`), 'rest-duration');
  }
  await p.c('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await p.c('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await command('Target.activateTarget', { targetId: p.targetId });
  assert.equal(await p.evaluate(`document.activeElement.hasAttribute('data-time')`), true);
  await p.c('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await p.c('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  assert.equal(await p.evaluate(`document.querySelector('#rest-timer form').hidden`), false);
  await p.edit('0:00'); await p.click('[data-toggle]');
  assert.equal((await p.state()).status, '');
  assert.equal((await p.state()).evidence.intervals, 0);
  await p.edit('0:02'); await p.click('[data-toggle]');
  await waitFor(async () => (await p.state()).status === 'Time is up');
  let completed = await p.state();
  assert.equal(completed.evidence.started, 1);
  assert.deepEqual(completed.evidence.audioStates, ['running']);
  await delay(600);
  assert.equal((await p.state()).evidence.started, 1);
  report.cases.push({ label: 'controls, all days, scroll, input validation, keyboard and real audio', state: await p.state() });
  await p.click('[data-mute]'); await p.edit('0:01'); await p.click('[data-toggle]');
  await waitFor(async () => (await p.state()).status === 'Time is up');
  assert.equal((await p.state()).evidence.started, 1);
  await p.edit('0:03'); await p.click('[data-toggle]');
  // A second real target is brought to front; verify actual visibility events.
  const other = await page();
  await command('Target.activateTarget', { targetId: other.targetId });
  await waitFor(() => p.evaluate(`document.hidden`));
  await delay(3500);
  await command('Target.activateTarget', { targetId: p.targetId });
  await waitFor(() => p.evaluate(`!document.hidden`));
  await waitFor(async () => (await p.state()).status === 'Time is up');
  completed = await p.state();
  assert.ok(completed.evidence.visibility.some(e => e.state === 'hidden'));
  assert.ok(completed.evidence.visibility.some(e => e.state === 'visible'));
  assert.equal(completed.evidence.maxIntervals, 1);
  report.cases.push({ label: 'real hidden target expiry and mute', state: completed });
  await p.edit('0:10'); await p.click('[data-toggle]');
  await command('Target.activateTarget', { targetId: other.targetId });
  await waitFor(() => p.evaluate(`document.hidden`));
  await delay(1200);
  await command('Target.activateTarget', { targetId: p.targetId });
  await waitFor(() => p.evaluate(`!document.hidden`));
  const returned = await p.state();
  assert.ok(Number(returned.time.split(':')[1]) <= 9 && Number(returned.time.split(':')[1]) >= 5);
  assert.equal(returned.toggle, 'Pause');
  report.cases.push({ label: 'real background return retains running deadline', state: returned });
  await p.edit('1:15'); await p.click('[data-toggle]');
  await p.c('Page.reload');
  await waitFor(() => p.evaluate(`document.readyState==='complete' && document.querySelector('[data-time]')?.textContent==='1:15'`));
  assert.equal((await p.state()).toggle, 'Start');
  assert.equal((await p.state()).evidence.started, 0);
  assert.equal(await p.evaluate(`localStorage.getItem('fit.selected-tab')`), 'tab-day-5');
  report.cases.push({ label: 'reload selected duration stopped; tab storage retained', state: await p.state() });
  for (const [name, injection] of [
    ['corrupt', `localStorage.setItem('fit.rest-duration','invalid');`],
    ['getter blocked', `Object.defineProperty(window,'localStorage',{get(){throw Error('blocked')}});`],
    ['read blocked', `Storage.prototype.getItem=function(){throw Error('blocked')};`],
    ['write blocked', `localStorage.setItem('fit.rest-duration','invalid');Storage.prototype.setItem=function(){throw Error('blocked')};`],
    ['audio unavailable', `localStorage.clear();Object.defineProperty(window,'AudioContext',{value:undefined});Object.defineProperty(window,'webkitAudioContext',{value:undefined});`],
    ['audio rejected', `localStorage.clear();Object.defineProperty(AudioContext.prototype,'state',{get(){return 'suspended'}});AudioContext.prototype.resume=function(){return Promise.reject(Error('blocked'))};`],
    ['audio constructor throws', `localStorage.clear();window.AudioContext=function(){throw Error('unavailable')};`],
    ['audio pending resume', `localStorage.clear();Object.defineProperty(AudioContext.prototype,'state',{get(){return 'suspended'}});AudioContext.prototype.resume=function(){return new Promise(resolve=>window.finishAudioResume=resolve)};`],
    ['audio playback throws', `localStorage.clear();AudioContext.prototype.createOscillator=function(){throw Error('playback blocked')};`],
  ]) {
    const q = await page(injection);
    assert.equal((await q.state()).time, '1:00', name);
    await q.edit('0:01'); await q.click('[data-toggle]');
    await waitFor(async () => (await q.state()).status === 'Time is up');
    if (name.startsWith('audio')) assert.equal((await q.state()).evidence.started, 0, name);
    if (name === 'audio pending resume') {
      await q.evaluate(`window.finishAudioResume()`); await delay(250);
      assert.equal((await q.state()).evidence.started, 0, 'no delayed stale completion audio');
    }
    await q.click('#tab-day-2');
    assert.equal(await q.evaluate(`document.getElementById('tab-day-2').getAttribute('aria-selected')`), 'true');
    report.cases.push({ label: name, state: await q.state() });
    await command('Target.closeTarget', { targetId: q.targetId });
  }
  await command('Target.activateTarget', { targetId: p.targetId });
  await waitFor(() => p.evaluate(`!document.hidden`));
  for (const [name, width, height, scale] of [['desktop', 1280, 900, 1], ['mobile', 390, 844, 1], ['narrow-large-text', 320, 740, 2]]) {
    await p.c('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
    await p.evaluate(`document.documentElement.style.fontSize='${16 * scale}px'; document.querySelector('#rest-timer').style.fontSize='${16 * scale}px'`);
    await p.edit('bad');
    await p.click('#tab-day-5');
    await delay(300);
    report.cases.push({ label: name + ' spacing', spacing: await p.evaluate(`({
      space:getComputedStyle(document.documentElement).getPropertyValue('--timer-space'),
      height:document.querySelector('#rest-timer').getBoundingClientRect().height,
      padding:getComputedStyle(document.body).paddingBottom
    })`) });
    await p.evaluate(`document.documentElement.style.scrollBehavior='auto';window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})`);
    await delay(300);
    await p.evaluate(`window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})`);
    const layout = await p.evaluate(`(()=>{
      const panel=document.querySelector('#rest-timer').getBoundingClientRect();
      const last=document.querySelector('#panel-day-5 article').lastElementChild.getBoundingClientRect();
      return {panel:{left:panel.left,right:panel.right,top:panel.top,bottom:panel.bottom,height:panel.height},
        lastBottom:last.bottom,width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
        scrollY,scrollHeight:document.documentElement.scrollHeight,
        safeArea:CSS.supports('bottom','max(12px, env(safe-area-inset-bottom, 0px))'),
        targets:[...document.querySelectorAll('#rest-timer button')].filter(e=>e.getClientRects().length).map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))};
    })()`);
    assert.ok(layout.panel.left >= 0 && layout.panel.right <= layout.width);
    assert.ok(layout.panel.top >= 0 && layout.panel.bottom <= layout.height);
    report.cases.push({ label: name, layout });
    assert.ok(layout.lastBottom <= layout.panel.top, `${name}: last content reachable above panel: ${JSON.stringify(layout)}`);
    assert.ok(layout.targets.every(t => t.width >= 44 && t.height >= 44));
    assert.ok(layout.scrollWidth <= layout.width);
    const screenshot = await p.c('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(output, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
    await p.click('[data-cancel]');
    await delay(100);
    const compact = await p.c('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(output, `${name}-compact.png`), Buffer.from(compact.data, 'base64'));
  }
  assert.deepEqual(report.errors, []);
  report.result = 'PASS';
} catch (error) {
  report.result = 'FAIL'; report.error = error.stack;
  console.error(error); process.exitCode = 1;
} finally {
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Evidence: ${output}`);
  if (socket?.readyState === WebSocket.OPEN) { await command('Browser.close').catch(() => {}); socket.close(); }
  chrome.kill('SIGTERM'); server.closeAllConnections();
  await new Promise(r => server.close(r));
}
