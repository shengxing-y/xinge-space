/* Screen-space named-star identification; no canvas drawing or animation loop. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StarIdentify = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const named = s => s && typeof s.name === 'string' && s.name.trim() &&
    Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.mag) && s.mag <= 3;
  const idCompare = (a, b) => {
    const x = String(a.id == null ? '' : a.id), y = String(b.id == null ? '' : b.id);
    return x < y ? -1 : x > y ? 1 : 0;
  };

  /** Return the original nearest named star, or null. Coordinates/radius are CSS
   * viewport pixels; stars are {id,x,y,mag,name,constellation,english}.
   * Only finite coordinates/magnitude and mag <= 3 qualify. Ties: mag, then id
   * (lexical, independent of locale). allowed, when supplied, is a star predicate.
   */
  function nearest(stars, x, y, radius, allowed) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius < 0) return null;
    let best = null, distance = Infinity;
    for (const star of stars || []) {
      if (!named(star) || (allowed && !allowed(star))) continue;
      const d = Math.hypot(star.x - x, star.y - y);
      if (d > radius) continue;
      if (d < distance || (d === distance && (!best || star.mag < best.mag ||
          (star.mag === best.mag && idCompare(star, best) < 0)))) {
        best = star;
        distance = d;
      }
    }
    return best;
  }

  /** create({document, enabled}) -> {setStars, close, setSuspended, keyboardButton}.
   * Append keyboardButton to the renderer's controls; style its ID for sr-only /
   * :focus-visible. setStars receives current viewport CSS coordinates after each
   * build and closes stale UI. Renderer must close on modal / view-transition
   * entry (or setSuspended(true)); enabled gates every subsequent interaction.
   */
  function create(options) {
    const doc = options.document, win = doc.defaultView;
    const enabled = options.enabled || (() => true);
    let stars = [], suspended = false, pinned = false, gesture = null;
    let selected = null, index = 0;
    const tip = doc.createElement('div');
    tip.id = 'star-tip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    tip.style.position = 'fixed';
    tip.style.pointerEvents = 'none';
    doc.body.appendChild(tip);
    const button = doc.createElement('button');
    button.id = 'star-identify-keyboard';
    button.type = 'button';
    button.className = 'sr-only';
    button.textContent = '识别当前视野中的亮星';
    const blocked = 'a,button,input,select,textarea,[contenteditable],dialog,#lightbox,#player,' +
      '.entry,.verse,.echo,.heat,.intro-links,.pigments,h1,h2,h3,p,.eyebrow,.tags';
    const backgrounds = 'html,body,main,header,footer,.intro,.intro>div,.collection,.entries,.sky-control';
    const ready = () => !suspended && !doc.hidden && !!enabled();

    function close() {
      tip.hidden = true;
      button.removeAttribute('aria-describedby');
      selected = null;
      pinned = false;
      gesture = null;
    }
    function background(node) {
      if (!node || node.nodeType !== 1 || node.closest(blocked)) return false;
      if (node.tagName === 'CANVAS' && node.id === 'sky') return true;
      if (!node.matches(backgrounds)) return false;
      if (Array.from(node.childNodes).some(n => n.nodeType === 3 && n.textContent.trim())) return false;
      if (node.tagName !== 'HTML' && node.tagName !== 'BODY' && win && win.getComputedStyle) {
        const css = win.getComputedStyle(node), color = css.backgroundColor;
        if (color && color !== 'transparent' && !/\/\s*0(?:\.0+)?\s*\)$/.test(color) &&
            !/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(color)) return false;
        if (css.backgroundImage && css.backgroundImage !== 'none') return false;
      }
      return true;
    }
    function clearAt(x, y) {
      return Number.isFinite(x) && Number.isFinite(y) && background(doc.elementFromPoint(x, y));
    }
    function visible(star) {
      const width = doc.documentElement.clientWidth || (win && win.innerWidth) || 0;
      const height = doc.documentElement.clientHeight || (win && win.innerHeight) || 0;
      return named(star) && star.x >= 0 && star.y >= 0 && star.x < width && star.y < height &&
        clearAt(star.x, star.y);
    }
    function pointerClear(event) {
      return background(event.target) && clearAt(event.clientX, event.clientY);
    }
    function show(star, keyboard) {
      if (!ready()) return close();
      selected = star;
      tip.textContent = star ? star.name + (star.constellation ? ' / ' + star.constellation : '') +
        ' / 视星等 ' + star.mag.toFixed(2) : '当前视野暂无可识别亮星';
      tip.hidden = false;
      if (keyboard) button.setAttribute('aria-describedby', tip.id);
      else button.removeAttribute('aria-describedby');
      const width = doc.documentElement.clientWidth || (win && win.innerWidth) || 0;
      const height = doc.documentElement.clientHeight || (win && win.innerHeight) || 0;
      tip.style.maxWidth = Math.max(0, width - 16) + 'px';
      const rect = star || button.getBoundingClientRect();
      const x = star ? star.x : rect.left, y = star ? star.y : rect.bottom;
      tip.style.left = Math.max(8, Math.min(x + 14, width - tip.offsetWidth - 8)) + 'px';
      tip.style.top = Math.max(8, Math.min(y + 14, height - tip.offsetHeight - 8)) + 'px';
    }
    function candidates() {
      return stars.filter(visible).sort((a, b) => a.x - b.x || a.y - b.y || a.mag - b.mag || idCompare(a, b));
    }
    function keyboardShow(key) {
      if (!ready()) return close();
      const list = candidates();
      const current = list.indexOf(selected);
      index = current < 0 ? 0 : current;
      if (key === 'Home') index = 0;
      else if (key === 'End') index = list.length - 1;
      else if (key === 'ArrowRight' || key === 'ArrowDown') index = current < 0 ? 0 : index + 1;
      else if (key === 'ArrowLeft' || key === 'ArrowUp') index = current < 0 ? list.length - 1 : index - 1;
      index = list.length ? (index + list.length) % list.length : 0;
      show(list[index] || null, true);
    }
    button.addEventListener('focus', () => keyboardShow());
    button.addEventListener('blur', close);
    button.addEventListener('keydown', event => {
      if (event.key === 'Escape') { close(); return; }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', ' '].includes(event.key)) return;
      if (!ready()) { close(); return; }
      event.preventDefault();
      keyboardShow(event.key);
      if (event.key === 'Enter' || event.key === ' ') pinned = true;
    });
    // Native keyboard/AT button activation is separate from pointer gesture matching.
    button.addEventListener('click', event => {
      if (event.detail === 0) keyboardShow();
    });
    doc.addEventListener('pointermove', event => {
      if (gesture && gesture.id === event.pointerId &&
          Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10) gesture = null;
      if (!ready()) return close();
      if (event.pointerType !== 'mouse' || event.buttons || pinned || doc.activeElement === button) return;
      if (!pointerClear(event)) return close();
      const star = nearest(stars, event.clientX, event.clientY, 12, visible);
      if (star) show(star, false);
      else close();
    }, { passive: true });
    // Capture the enabled state at gesture START: transitions may finish before up.
    doc.addEventListener('pointerdown', event => {
      const allowed = ready();
      gesture = null;
      if (pinned && (!allowed || !selected || !pointerClear(event) ||
          Math.hypot(event.clientX - selected.x, event.clientY - selected.y) > 24)) close();
      if (!allowed || event.isPrimary === false || event.button !== 0 ||
          event.pointerType !== 'touch' || !pointerClear(event)) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };
    }, { capture: true, passive: true });
    doc.addEventListener('pointerup', event => {
      const start = gesture;
      gesture = null;
      if (!start || start.id !== event.pointerId || event.pointerType !== 'touch' || !ready()) return;
      const elapsed = event.timeStamp - start.time;
      if (elapsed < 0 || elapsed > 500 || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10 ||
          !pointerClear(event)) return;
      const star = nearest(stars, event.clientX, event.clientY, 24, visible);
      if (star) { show(star, false); pinned = true; }
      else close();
    }, { passive: true });
    doc.addEventListener('pointercancel', close, { passive: true });
    doc.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    doc.addEventListener('scroll', close, { capture: true, passive: true });
    doc.addEventListener('visibilitychange', () => { if (doc.hidden) close(); });
    if (win) {
      win.addEventListener('resize', close, { passive: true });
      win.addEventListener('blur', close);
    }
    return {
      keyboardButton: button,
      setStars(next) { close(); stars = Array.from(next || []).filter(named); },
      close,
      setSuspended(value) { suspended = !!value; if (suspended) close(); },
    };
  }
  return { nearest, create };
}));
