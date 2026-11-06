const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

const script = readFileSync(require('node:path').join(__dirname, '../media.js'), 'utf8');

function image(complete, naturalWidth) {
  return Object.assign(new EventTarget(), { complete, naturalWidth, dataset: {} });
}

function initialize(images) {
  runInNewContext(script, {
    document: { querySelectorAll: selector => {
      assert.equal(selector, '.exercise-media img');
      return images;
    } },
  });
}

test('already completed successful and failed images settle immediately', () => {
  const loaded = image(true, 700);
  const failed = image(true, 0);
  initialize([loaded, failed]);
  assert.equal(loaded.dataset.mediaState, 'loaded');
  assert.equal(failed.dataset.mediaState, 'error');
});

test('pending lazy images settle on success or failure without geometry changes', () => {
  const loaded = image(false, 0);
  const failed = image(false, 0);
  initialize([loaded, failed]);
  assert.equal(loaded.dataset.mediaState, 'loading');
  assert.equal(failed.dataset.mediaState, 'loading');
  loaded.naturalWidth = 700;
  loaded.complete = true;
  loaded.dispatchEvent(new Event('load'));
  failed.complete = true;
  failed.dispatchEvent(new Event('error'));
  assert.equal(loaded.dataset.mediaState, 'loaded');
  assert.equal(failed.dataset.mediaState, 'error');
  assert.equal(loaded.width, undefined);
  assert.equal(failed.height, undefined);
});

test('a completion between listener registration and complete check is handled', () => {
  const loaded = image(false, 0);
  const add = loaded.addEventListener.bind(loaded);
  loaded.addEventListener = (name, listener, options) => {
    add(name, listener, options);
    if (name === 'load') {
      loaded.naturalWidth = 1200;
      loaded.complete = true;
      loaded.dispatchEvent(new Event('load'));
    }
  };
  initialize([loaded]);
  assert.equal(loaded.dataset.mediaState, 'loaded');
});
