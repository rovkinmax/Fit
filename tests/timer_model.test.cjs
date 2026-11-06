const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTimer, parseDuration, formatDuration, loadDuration, MAX_SECONDS } = require('../timer-model.js');

test('deadline, idempotent starts, pause/resume, expiry once and repeated cycles', () => {
  let clock = 100;
  const timer = createTimer({ now: () => clock });
  assert.equal(timer.snapshot().seconds, 60);
  timer.start(); clock += 1200; timer.start();
  assert.equal(timer.pause().remaining, 58800);
  clock += 100000; assert.equal(timer.snapshot().remaining, 58800);
  timer.start(); clock += 58800;
  assert.equal(timer.snapshot().completions, 1);
  assert.equal(timer.snapshot().completions, 1);
  assert.equal(timer.snapshot().running, false);
  timer.reset(); timer.start(); clock += 60001;
  assert.equal(timer.snapshot().completions, 2);
});
test('edits stop running timer, reset selected, zero and bounds', () => {
  const timer = createTimer();
  timer.start(); timer.setDuration(15);
  assert.equal(timer.snapshot().running, false);
  assert.equal(timer.reset().seconds, 15);
  assert.equal(timer.adjust(-30).seconds, 0);
  assert.equal(timer.start().running, false);
  assert.equal(timer.snapshot().completions, 0);
  assert.equal(timer.adjust(MAX_SECONDS + 1).seconds, MAX_SECONDS);
  for (const value of [-1, NaN, Infinity, 1.2, MAX_SECONDS + 1]) {
    assert.throws(() => timer.setDuration(value), RangeError);
  }
});
test('strict documented m:ss input', () => {
  assert.equal(parseDuration('1:00'), 60);
  assert.equal(parseDuration('1440:00'), MAX_SECONDS);
  assert.equal(parseDuration('0:00'), 0);
  for (const value of ['', '1', '-1:00', '1:60', '1:2', ' 1:00', 'Infinity', '1440:01']) assert.equal(parseDuration(value), null);
  assert.equal(formatDuration(75), '1:15');
});
test('saved/corrupt/blocked storage', () => {
  assert.equal(loadDuration(() => ({ getItem: () => '75' })), 75);
  assert.equal(loadDuration(() => ({ getItem: () => '0' })), 0);
  for (const value of [null, '', '-1', 'NaN', '1.5', '999999']) assert.equal(loadDuration(() => ({ getItem: () => value })), 60);
  assert.equal(loadDuration(() => { throw Error('blocked'); }), 60);
  assert.equal(loadDuration(() => ({ getItem() { throw Error('blocked'); } })), 60);
});
test('hidden elapsed time reconciles before actions without callback drift', () => {
  let clock = 0;
  const timer = createTimer({ duration: 2, now: () => clock });
  timer.start();
  clock = 1000;
  for (let i = 0; i < 100; i++) assert.equal(timer.snapshot().remaining, 1000);
  clock = 500000;
  assert.equal(timer.pause().completions, 1);
  assert.equal(timer.start().running, false);
  assert.equal(timer.reset().finished, false);
  assert.equal(timer.snapshot().completions, 1);
  timer.start();
  clock += 100;
  assert.equal(timer.adjust(15).seconds, 17);
  assert.equal(timer.snapshot().running, false);
  clock += 100000;
  assert.equal(timer.snapshot().seconds, 17);
});
