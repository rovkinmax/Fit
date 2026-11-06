const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const script = html.includes('src="tabs.js"')
  ? fs.readFileSync('tabs.js', 'utf8')
  : html.match(/<script>([\s\S]*?)<\/script>/)[1];
const key = 'fit.selected-tab';
function page({ saved, hash = '', failure, unavailable = [] } = {}) {
  const values = new Map(saved === undefined ? [] : [[key, saved]]);
  const listeners = {};
  const panels = Array.from({ length: 6 }, (_, i) => ({
    id: i ? `panel-day-${i}` : 'panel-overview',
    active: !i,
    classList: { toggle(_, active) { panels[i].active = active; } },
  }));
  const buttons = panels.map((panel, i) => ({
    id: panel.id.replace('panel-', 'tab-'),
    selected: !i,
    getAttribute: () => panel.id,
    setAttribute(_, value) { this.selected = value === 'true'; },
    addEventListener(_, handler) { this.click = handler; },
  }));
  const location = { hash };
  let scrolls = 0;
  const window = {
    addEventListener(name, handler) { listeners[name] = handler; },
    scrollTo() { scrolls++; },
    get localStorage() {
      if (failure === 'getter') throw Error('denied');
      return {
        getItem(k) { if (failure === 'read') throw Error('read'); return values.get(k) ?? null; },
        setItem(k, v) { if (failure === 'write') throw Error('write'); values.set(k, v); },
      };
    },
  };
  vm.runInNewContext(script, {
    window, location,
    history: { replaceState(_, __, hash) { location.hash = hash; } },
    document: {
      querySelectorAll: selector => selector === '.tab-btn' ? buttons : panels.filter(p => !unavailable.includes(p.id)),
      getElementById: id => [...buttons, ...panels].find(e => e.id === id && !unavailable.includes(id)),
    },
  });
  return {
    values, location, buttons, panels,
    selected(id) {
      assert.deepEqual(buttons.filter(b => b.selected).map(b => b.id), [id]);
      assert.deepEqual(panels.filter(p => p.active).map(p => p.id), [id.replace('tab-', 'panel-')]);
    },
    hashchange(hash) { location.hash = hash; listeners.hashchange(); },
    scrolls: () => scrolls,
  };
}
const ids = ['tab-overview', ...Array.from({ length: 5 }, (_, i) => `tab-day-${i + 1}`)];
test('default and invalid saved values fall back to Overview', () => {
  for (const saved of [undefined, '', 'garbage', '{"day":3}', 'tab-day-6']) page({ saved }).selected('tab-overview');
});
test('all selections survive a new document, including Overview', () => {
  for (const id of ids) {
    const first = page({ saved: 'tab-day-4' });
    first.buttons.find(b => b.id === id).click();
    assert.equal(first.values.get(key), id);
    page({ saved: first.values.get(key) }).selected(id);
  }
});
test('explicit valid hashes override saved values and are remembered', () => {
  for (const id of ids) {
    const p = page({ saved: 'tab-day-4', hash: '#' + id.replace(/^tab-(?=day)/, '') });
    p.selected(id);
    assert.equal(p.values.get(key), id);
    assert.equal(p.scrolls(), 0);
  }
});
test('missing and unknown startup hashes restore saved selection without rewriting URL', () => {
  for (const hash of ['', '#unknown']) {
    const p = page({ saved: 'tab-day-3', hash });
    p.selected('tab-day-3');
    assert.equal(p.location.hash, hash);
  }
});
test('unavailable panel is not restored', () => {
  page({ saved: 'tab-day-3', unavailable: ['panel-day-3'] }).selected('tab-overview');
});
test('storage failures leave clicks and hash navigation working', () => {
  for (const failure of ['getter', 'read', 'write']) {
    const p = page({ failure, hash: '#day-2' });
    p.selected('tab-day-2');
    for (const id of ids) {
      p.buttons.find(b => b.id === id).click();
      p.selected(id);
      p.hashchange('#' + id.replace(/^tab-(?=day)/, ''));
      p.selected(id);
    }
    p.hashchange('#unknown');
    p.selected('tab-overview');
  }
});
