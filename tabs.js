(() => {
  const buttons = Array.from(document.querySelectorAll('.tab-btn'));
  const panels = Array.from(document.querySelectorAll('.panel'));
  const storageKey = 'fit.selected-tab';
  const available = new Map(buttons.flatMap(button => {
    const panel = panels.find(item => item.id === button.getAttribute('aria-controls'));
    return panel ? [[button.id, { button, panel }]] : [];
  }));
  const byHash = hash => {
    const value = hash.replace(/^#/, '');
    const id = /^day-[1-5]$/.test(value) ? `tab-${value}` : value === 'tab-overview' ? value : null;
    return available.get(id);
  };
  const savedSelection = () => {
    try {
      return available.get(window.localStorage.getItem(storageKey));
    } catch {
      return undefined;
    }
  };
  const activate = (selection, updateHash) => {
    if (!selection) return;
    const { button, panel } = selection;
    buttons.forEach(item => item.setAttribute('aria-selected', item === button ? 'true' : 'false'));
    panels.forEach(item => item.classList.toggle('active', item === panel));
    try {
      window.localStorage.setItem(storageKey, button.id);
    } catch {
      // Storage restrictions must not disable tab navigation.
    }
    if (updateHash) {
      const hash = button.id === 'tab-overview' ? button.id : button.id.replace('tab-', '');
      history.replaceState(null, '', `#${hash}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  buttons.forEach(button => button.addEventListener('click', () => activate(available.get(button.id), true)));
  activate(byHash(location.hash) || savedSelection() || available.get('tab-overview'), false);
  window.addEventListener('hashchange', () => activate(byHash(location.hash) || available.get('tab-overview'), false));
})();
