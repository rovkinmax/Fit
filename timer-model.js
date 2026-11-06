(function (root) {
  'use strict';
  const MAX_SECONDS = 24 * 60 * 60;
  const valid = value => Number.isInteger(value) && value >= 0 && value <= MAX_SECONDS;
  function parseDuration(text) {
    if (!/^\d{1,4}:[0-5]\d$/.test(text)) return null;
    const [minutes, seconds] = text.split(':').map(Number);
    const value = minutes * 60 + seconds;
    return valid(value) ? value : null;
  }
  const formatDuration = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  function loadDuration(storage) {
    try {
      const raw = storage().getItem('fit.rest-duration');
      if (raw !== null && /^\d+$/.test(raw) && valid(Number(raw))) return Number(raw);
    } catch { /* Restricted storage leaves the in-memory timer usable. */ }
    return 60;
  }
  function createTimer({ duration = 60, now = Date.now } = {}) {
    if (!valid(duration)) throw new RangeError('Invalid duration');
    let selected = duration, remaining = duration * 1000, deadline = null, completions = 0, finished = false;
    function reconcile() {
      if (deadline !== null) {
        remaining = Math.max(0, deadline - now());
        if (remaining === 0) {
          deadline = null;
          finished = true;
          completions++;
        }
      }
      return { selected, remaining, seconds: Math.ceil(remaining / 1000), running: deadline !== null, finished, completions };
    }
    return {
      snapshot: reconcile,
      start() {
        reconcile();
        if (deadline === null && remaining > 0) deadline = now() + remaining;
        return reconcile();
      },
      pause() { reconcile(); deadline = null; return reconcile(); },
      setDuration(value) {
        if (!valid(value)) throw new RangeError('Invalid duration');
        selected = value; remaining = value * 1000; deadline = null; finished = false;
        return reconcile();
      },
      reset() { return this.setDuration(selected); },
      adjust(delta) { return this.setDuration(Math.min(MAX_SECONDS, Math.max(0, selected + delta))); },
    };
  }
  const api = { MAX_SECONDS, parseDuration, formatDuration, loadDuration, createTimer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FitTimer = api;
})(globalThis);
