(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.ActivityStarMap = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const categories = new Set(['work', 'art', 'life', 'music']);
  const states = new WeakMap();
  const documents = new WeakMap();
  const pad = value => String(value).padStart(2, '0');
  const dayKey = date => `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  function validDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7));
    const day = Number(value.slice(8, 10));
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return month >= 1 && month <= 12 && day >= 1 && day <= lengths[month - 1];
  }

  function localDate(day) {
    const date = new Date(0);
    date.setHours(12, 0, 0, 0);
    date.setFullYear(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
    return date;
  }

  function summarize(entries, now = new Date()) {
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new RangeError('now must be a valid Date');
    const end = dayKey(now);
    const date = new Date(now.getTime());
    // Advance local calendar days at noon, never fixed 24-hour millisecond steps.
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - 364);
    const start = dayKey(date);
    const counts = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (!entry || !categories.has(entry.category) || !validDay(entry.day)) continue;
      if (entry.day < start || entry.day > end) continue;
      counts.set(entry.day, (counts.get(entry.day) || 0) + 1);
    }
    const days365 = [];
    let total = 0;
    let activeDays = 0;
    for (let i = 0; i < 365; i += 1) {
      const day = dayKey(date);
      const count = counts.get(day) || 0;
      days365.push({ day, count, level: Math.min(3, count), today: day === end });
      total += count;
      if (count) activeDays += 1;
      date.setDate(date.getDate() + 1);
    }
    return { days365, total, activeDays, start, end };
  }

  function closeTip(state) {
    if (state.tip) state.tip.hidden = true;
    state.tipDay = null;
    state.pinned = false;
    const controller = documents.get(state.map.ownerDocument);
    if (controller && controller.current === state) controller.current = null;
  }

  function positionTip(state, button) {
    const tip = state.tip;
    const win = state.map.ownerDocument.defaultView;
    if (!tip || !win) return;
    const mark = button.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    const left = Math.max(8, Math.min(mark.left + mark.width / 2 - box.width / 2, win.innerWidth - box.width - 8));
    let top = mark.bottom + 8;
    if (top + box.height > win.innerHeight - 8) top = mark.top - box.height - 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(8, top)}px`;
  }

  function showTip(state, button) {
    if (!state.tip || !button) return;
    const controller = documents.get(state.map.ownerDocument);
    if (controller.current && controller.current !== state) closeTip(controller.current);
    controller.current = state;
    state.tipDay = button.dataset.day;
    state.tip.textContent = button.getAttribute('aria-label');
    state.tip.hidden = false;
    positionTip(state, button);
  }

  function ensureDocument(doc) {
    if (documents.has(doc)) return;
    const controller = { current: null };
    documents.set(doc, controller);
    doc.addEventListener('pointerdown', event => {
      const state = controller.current;
      if (state && !state.map.contains(event.target)) closeTip(state);
    });
    doc.addEventListener('keydown', event => {
      if (event.key === 'Escape' && controller.current) closeTip(controller.current);
    });
    // One shared listener per document, not one listener per render or day.
    doc.addEventListener('scroll', event => {
      const state = controller.current;
      if (!state) return;
      const focused = doc.activeElement;
      if (focused && state.map.contains(focused) && focused.matches('.activity-star')) {
        positionTip(state, focused);
      } else closeTip(state);
    }, true);
    if (doc.defaultView) doc.defaultView.addEventListener('resize', () => {
      const state = controller.current;
      if (state) positionTip(state, state.buttons.get(state.tipDay));
    });
  }

  function starFromEvent(state, event) {
    const target = event.target;
    const button = target && target.closest ? target.closest('button.activity-star') : null;
    return button && state.map.contains(button) ? button : null;
  }

  function setTabStop(state, button) {
    const previous = state.buttons.get(state.focusDay);
    if (previous && previous !== button) previous.tabIndex = -1;
    button.tabIndex = 0;
    state.focusDay = button.dataset.day;
  }

  function revealButton(state, button) {
    const viewport = state.map.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    if (rect.left < viewport.left) state.map.scrollLeft -= viewport.left - rect.left + 2;
    else if (rect.right > viewport.right) state.map.scrollLeft += rect.right - viewport.right + 2;
  }

  function bindMap(state) {
    const map = state.map;
    map.addEventListener('mouseover', event => {
      const button = starFromEvent(state, event);
      if (button && !state.pinned) showTip(state, button);
    });
    map.addEventListener('mouseleave', () => {
      if (!state.pinned) closeTip(state);
    });
    map.addEventListener('focusin', event => {
      const button = starFromEvent(state, event);
      if (!button) return;
      setTabStop(state, button);
      showTip(state, button);
    });
    map.addEventListener('focusout', event => {
      if (!map.contains(event.relatedTarget)) closeTip(state);
    });
    map.addEventListener('click', event => {
      const button = starFromEvent(state, event);
      if (!button) return;
      setTabStop(state, button);
      state.pinned = true;
      showTip(state, button);
    });
    map.addEventListener('keydown', event => {
      const button = starFromEvent(state, event);
      if (!button || event.altKey || event.ctrlKey || event.metaKey) return;
      const index = state.index.get(button.dataset.day);
      const changes = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
      let next;
      if (Object.prototype.hasOwnProperty.call(changes, event.key)) next = index + changes[event.key];
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = state.summary.days365.length - 1;
      else return;
      event.preventDefault();
      next = Math.max(0, Math.min(state.summary.days365.length - 1, next));
      const destination = state.buttons.get(state.summary.days365[next].day);
      setTabStop(state, destination);
      state.pinned = false;
      revealButton(state, destination);
      destination.focus({ preventScroll: true });
      showTip(state, destination);
    });
  }

  function updateDetails(state, summary) {
    const doc = state.map.ownerDocument;
    if (!state.details) {
      state.details = doc.createElement('details');
      state.details.className = 'activity-details';
      const label = doc.createElement('summary');
      label.textContent = '日期明细';
      state.details.appendChild(label);
    }
    state.map.insertAdjacentElement('afterend', state.details);
    const oldTable = state.details.querySelector('table');
    const table = doc.createElement('table');
    table.className = 'activity-table';
    const caption = doc.createElement('caption');
    caption.textContent = `${summary.start} 至 ${summary.end} · 仅工作、画画、生活与音乐，不含私人日记`;
    table.appendChild(caption);
    const head = doc.createElement('thead');
    const heading = doc.createElement('tr');
    for (const text of ['日期', '篇数']) {
      const th = doc.createElement('th');
      th.scope = 'col';
      th.textContent = text;
      heading.appendChild(th);
    }
    head.appendChild(heading);
    table.appendChild(head);
    const body = doc.createElement('tbody');
    for (const row of summary.days365) {
      const tr = doc.createElement('tr');
      const day = doc.createElement('th');
      day.scope = 'row';
      day.textContent = row.day;
      const count = doc.createElement('td');
      count.textContent = String(row.count);
      tr.appendChild(day);
      tr.appendChild(count);
      body.appendChild(tr);
    }
    table.appendChild(body);
    if (oldTable) oldTable.replaceWith(table);
    else state.details.appendChild(table);
  }

  function render(entries, now = new Date()) {
    const summary = summarize(entries, now);
    if (typeof document === 'undefined') return summary;
    const map = document.getElementById('heatmap');
    if (!map) return summary;
    ensureDocument(document);
    let state = states.get(map);
    if (!state) {
      state = { map, buttons: new Map(), index: new Map(), focusDay: null, signature: null, details: null, tip: null, tipDay: null, pinned: false };
      states.set(map, state);
      bindMap(state);
    }
    state.tip = document.getElementById('hm-tip');
    if (state.tip) state.tip.setAttribute('role', 'tooltip');
    const stats = document.getElementById('heat-stats');
    if (stats) stats.textContent = `近一年 ${summary.total} 篇 · 活跃 ${summary.activeDays} 天`;
    const signature = `${summary.start}|${summary.end}|${summary.days365.map(row => row.count).join(',')}`;
    if (signature === state.signature) return summary;

    const firstRender = state.signature === null;
    const scrollLeft = map.scrollLeft;
    const scrollTop = map.scrollTop;
    const focused = document.activeElement;
    const hadFocus = map.contains(focused);
    const oldFocusDay = hadFocus && focused.dataset ? focused.dataset.day : state.focusDay;
    const tipDay = state.tipDay;
    const pinned = state.pinned;
    closeTip(state);
    state.summary = summary;
    state.signature = signature;
    state.buttons = new Map();
    state.index = new Map();
    state.focusDay = summary.days365.some(row => row.day === oldFocusDay) ? oldFocusDay : summary.end;
    map.setAttribute('role', 'group');
    map.setAttribute('aria-label', `近一年创作星图，${summary.start} 至 ${summary.end}。方向键切换日期，Home 到最早，End 到今天。`);
    const fragment = document.createDocumentFragment();
    const offset = localDate(summary.start).getDay();
    const slots = Math.ceil((offset + 365) / 7) * 7;
    let week;
    for (let slot = 0; slot < slots; slot += 1) {
      if (slot % 7 === 0) {
        week = document.createElement('div');
        week.className = 'activity-week';
        fragment.appendChild(week);
      }
      const index = slot - offset;
      if (index < 0 || index >= 365) {
        const spacer = document.createElement('span');
        spacer.className = 'activity-spacer';
        spacer.setAttribute('aria-hidden', 'true');
        week.appendChild(spacer);
        continue;
      }
      const row = summary.days365[index];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `activity-star level-${row.level}${row.today ? ' is-today' : ''}`;
      button.dataset.day = row.day;
      button.dataset.count = String(row.count);
      button.setAttribute('aria-label', `${row.day} · ${row.count} 篇`);
      if (row.today) button.setAttribute('aria-current', 'date');
      button.tabIndex = row.day === state.focusDay ? 0 : -1;
      const shape = document.createElement('span');
      shape.className = 'activity-star-shape';
      shape.setAttribute('aria-hidden', 'true');
      button.appendChild(shape);
      week.appendChild(button);
      state.buttons.set(row.day, button);
      state.index.set(row.day, index);
    }
    map.replaceChildren(fragment);
    updateDetails(state, summary);
    if (hadFocus) state.buttons.get(state.focusDay).focus({ preventScroll: true });
    map.scrollTop = scrollTop;
    const win = document.defaultView;
    map.scrollLeft = firstRender && win && win.matchMedia && win.matchMedia('(max-width: 640px)').matches
      ? map.scrollWidth : scrollLeft;
    if (tipDay && state.buttons.has(tipDay)) {
      state.pinned = pinned;
      showTip(state, state.buttons.get(tipDay));
    }
    return summary;
  }

  return { summarize, render };
}));
