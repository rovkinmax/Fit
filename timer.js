(() => {
  'use strict';
  const { createTimer, loadDuration, parseDuration, formatDuration } = FitTimer;
  // Wall time includes hidden-page elapsed time. System clock changes also
  // affect the deadline; no closed-page or suspended-browser alarm is promised.
  const timer = createTimer({ duration: loadDuration(() => window.localStorage) });
  const panel = document.getElementById('rest-timer');
  const time = panel.querySelector('[data-time]');
  const toggle = panel.querySelector('[data-toggle]');
  const mute = panel.querySelector('[data-mute]');
  const status = panel.querySelector('[role=status]');
  const editor = panel.querySelector('form');
  const input = editor.querySelector('input');
  const error = panel.querySelector('[data-error]');
  let scheduler = null, announced = 0, muted = false, audio = null, audioReady = false;
  try { muted = window.localStorage.getItem('fit.rest-muted') === 'true'; } catch {}
  const save = (key, value) => {
    try { window.localStorage.setItem(key, String(value)); } catch {}
  };
  function unlockAudio() {
    if (muted) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ||= new Audio();
      if (audio.state === 'running') audioReady = true;
      else audio.resume().then(() => { audioReady = audio.state === 'running'; }).catch(() => { audioReady = false; });
    } catch { audioReady = false; }
  }
  function sound() {
    // Never queue playback on a pending resume: a stale alarm is worse than silence.
    if (muted || !audioReady || audio?.state !== 'running') return;
    try {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.12, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(); oscillator.stop(audio.currentTime + 0.25);
    } catch { /* Audio is optional; visual completion remains available. */ }
  }
  function render() {
    const state = timer.snapshot();
    time.textContent = formatDuration(state.seconds);
    time.setAttribute('aria-label', `Edit rest duration, ${formatDuration(state.seconds)} remaining`);
    toggle.textContent = state.running ? 'Pause' : 'Start';
    toggle.disabled = state.remaining === 0;
    mute.textContent = muted ? 'Sound off' : 'Sound on';
    mute.setAttribute('aria-pressed', String(muted));
    panel.classList.toggle('timer-finished', state.finished);
    if (state.completions > announced) {
      announced = state.completions;
      status.textContent = 'Time is up';
      sound();
    } else if (!state.finished) status.textContent = '';
    if (state.running && scheduler === null) scheduler = window.setInterval(render, 100);
    if (!state.running && scheduler !== null) {
      clearInterval(scheduler); scheduler = null;
    }
  }
  function setDuration(value) {
    render();
    timer.setDuration(value);
    save('fit.rest-duration', value);
    render();
  }
  toggle.addEventListener('click', () => {
    unlockAudio(); render();
    if (timer.snapshot().running) timer.pause(); else timer.start();
    render();
  });
  panel.querySelector('[data-reset]').addEventListener('click', () => { render(); timer.reset(); render(); });
  for (const button of panel.querySelectorAll('[data-adjust]')) {
    button.addEventListener('click', () => {
      render();
      const state = timer.adjust(Number(button.dataset.adjust));
      save('fit.rest-duration', state.selected); render();
    });
  }
  mute.addEventListener('click', () => {
    render(); muted = !muted;
    save('fit.rest-muted', muted);
    if (!muted) unlockAudio();
    render();
  });
  time.addEventListener('click', () => {
    input.value = formatDuration(timer.snapshot().selected);
    error.textContent = ''; input.removeAttribute('aria-invalid');
    editor.hidden = false; input.focus(); input.select();
  });
  function closeEditor() { editor.hidden = true; time.focus(); }
  editor.addEventListener('submit', event => {
    event.preventDefault();
    const value = parseDuration(input.value);
    if (value === null) {
      error.textContent = 'Enter m:ss, from 0:00 to 1440:00.';
      input.setAttribute('aria-invalid', 'true'); input.focus(); return;
    }
    setDuration(value); closeEditor();
  });
  editor.querySelector('[data-cancel]').addEventListener('click', closeEditor);
  editor.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeEditor(); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  window.addEventListener('pageshow', render);
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--timer-space', `${Math.ceil(panel.getBoundingClientRect().height) + 32}px`);
  }).observe(panel);
  render();
})();
