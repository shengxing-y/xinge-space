/* Shared lifecycle for the existing native reading dialog. */
(function (root) {
  'use strict';
  const states = new WeakMap();
  const properties = ['position', 'top', 'left', 'right', 'width', 'overflow', 'padding-right'];

  function outside(dialog, event) {
    const box = dialog.getBoundingClientRect();
    return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  }

  function restoreFocus(state) {
    const doc = state.dialog.ownerDocument;
    const available = element => element && element.isConnected && !element.disabled && element.getClientRects().length > 0 && !element.closest('[inert]');
    let target = state.trigger;
    if (!available(target)) {
      const card = Array.from(doc.querySelectorAll('.entry[data-id]')).find(el => el.dataset.id === state.id);
      target = card && card.querySelector('.entry-open');
    }
    if (!available(target)) target = Array.from(doc.querySelectorAll('nav a.active, #search, nav a')).find(available);
    if (target) target.focus({ preventScroll: true });
  }

  function release(state) {
    if (states.get(state.dialog) !== state || state.dialog.open) return;
    const doc = state.dialog.ownerDocument;
    const win = doc.defaultView;
    const next = doc.querySelector('dialog[open]');
    if (next) {
      // Editing can immediately replace the reader. Keep its scroll lock and focus.
      next.addEventListener('close', () => win.requestAnimationFrame(() => release(state)), { once: true });
      return;
    }
    for (const [name, value, priority] of state.styles) {
      if (value) doc.body.style.setProperty(name, value, priority);
      else doc.body.style.removeProperty(name);
    }
    const html = doc.documentElement.style;
    const behavior = html.getPropertyValue('scroll-behavior');
    const priority = html.getPropertyPriority('scroll-behavior');
    html.setProperty('scroll-behavior', 'auto', 'important');
    win.scrollTo(state.x, state.y);
    restoreFocus(state);
    if (behavior) html.setProperty('scroll-behavior', behavior, priority);
    else html.removeProperty('scroll-behavior');
    states.delete(state.dialog);
  }

  function bind(dialog) {
    if (dialog.dataset.readerBound) return;
    dialog.dataset.readerBound = 'true';
    let downOutside = false;
    dialog.addEventListener('pointerdown', event => {
      downOutside = event.target === dialog && outside(dialog, event);
    });
    dialog.addEventListener('pointercancel', () => { downOutside = false; });
    dialog.addEventListener('click', event => {
      if (downOutside && event.target === dialog && outside(dialog, event)) dialog.close();
      downOutside = false;
    });
    dialog.addEventListener('close', () => {
      const state = states.get(dialog);
      if (state) dialog.ownerDocument.defaultView.requestAnimationFrame(() => release(state));
    });
  }

  function open(dialog, id) {
    bind(dialog);
    const doc = dialog.ownerDocument;
    const win = doc.defaultView;
    let state = states.get(dialog);
    if (!state) {
      const trigger = doc.activeElement;
      state = { dialog, id, trigger, x: win.scrollX, y: win.scrollY,
        styles: properties.map(name => [name, doc.body.style.getPropertyValue(name), doc.body.style.getPropertyPriority(name)]) };
      states.set(dialog, state);
      const gutter = Math.max(0, win.innerWidth - doc.documentElement.clientWidth);
      const padding = parseFloat(win.getComputedStyle(doc.body).paddingRight) || 0;
      Object.assign(doc.body.style, {
        position: 'fixed', top: `${-state.y}px`, left: `${-state.x}px`, right: '0', width: '100%', overflow: 'hidden',
        paddingRight: `${padding + gutter}px`,
      });
    } else state.id = id;
    dialog.scrollTop = 0;
    try {
      if (!dialog.open) dialog.showModal();
      const close = dialog.querySelector('[data-close="reader"]');
      if (close) close.focus({ preventScroll: true });
      dialog.scrollTop = 0;
    } catch (error) {
      release(state);
      throw error;
    }
  }

  root.ReaderView = { open };
}(typeof globalThis !== 'undefined' ? globalThis : this));
