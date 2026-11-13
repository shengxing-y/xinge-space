/* Hash routing and history ownership; UI and entry lookup stay with the caller. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.EntryRoute = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KEY = '__xjRoute';
  const MARKER = 'xj-entry-route-v1';
  const VIEWS = ['home', 'work', 'art', 'life', 'music', 'diary'];
  const validView = (view, allowDiary) => VIEWS.includes(view) && (allowDiary || view !== 'diary');
  const validId = id => typeof id === 'string' && id.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(id);
  const missing = () => ({ kind: 'missing', from: 'home' });

  function parse(hash, allowDiary = false) {
    if (typeof hash !== 'string') return missing();
    if (hash === '' || hash === '#') return { kind: 'list', view: 'home' };
    if (hash[0] !== '#') return missing();
    const value = hash.slice(1);
    if (validView(value, allowDiary)) return { kind: 'list', view: value };
    const match = /^entry\/([^/?#]+)(?:\?from=([^&#=?]+))?$/.exec(value);
    if (!match) return missing();
    try {
      const id = decodeURIComponent(match[1]);
      const from = match[2] === undefined ? 'home' : decodeURIComponent(match[2]);
      if (!validId(id) || !validView(from, allowDiary)) return missing();
      return { kind: 'entry', id, from };
    } catch (_) {
      return missing();
    }
  }

  function encode(id, from = 'home') {
    if (!validId(id)) throw new TypeError('Entry id must be a non-empty string without control characters');
    return '#entry/' + encodeURIComponent(id) + '?from=' + (validView(from, true) ? from : 'home');
  }

  function create(options) {
    options = options || {};
    const win = options.window || (typeof window !== 'undefined' ? window : null);
    if (!win || !win.history || !win.location) throw new TypeError('EntryRoute requires a window');
    const allowDiary = options.allowDiary === true;
    const getContext = options.getContext || (() => ({}));
    const onList = options.onList || (() => {});
    const onEntry = options.onEntry || (() => {});
    const onMissing = options.onMissing || (() => {});
    // A fresh closure token intentionally makes reloads and other router instances unowned.
    // Do not rely on a public marker or history.length as proof that Back is safe.
    const session = Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
    const lists = new Map();
    const entries = new Map();
    let serial = 0, started = false, scheduled = false, backing = false, last = '';
    const route = () => parse(win.location.hash, allowDiary);
    const defaultContext = view => ({ view, filter: 'all', search: '', month: '', scrollY: 0 });
    function context(value, view) {
      value = value || {};
      return {
        view,
        filter: value.filter === 'all' || validView(value.filter, allowDiary) && value.filter !== 'home' ? value.filter : 'all',
        search: typeof value.search === 'string' ? value.search : '',
        month: typeof value.month === 'string' ? value.month : '',
        scrollY: Number.isFinite(value.scrollY) && value.scrollY >= 0 ? value.scrollY : 0,
      };
    }
    function marker() {
      const state = win.history.state;
      const data = state && state[KEY];
      return data && data.marker === MARKER && data.session === session ? data : null;
    }
    function listContext(data, view) {
      const saved = data && lists.get(data.listId);
      return saved && saved.view === view ? context(saved, view) : defaultContext(view);
    }
    function entryMarker(current) {
      const data = marker();
      const issued = data && entries.get(data.entryId);
      return current.kind === 'entry' && data && data.kind === 'entry' && issued &&
        issued.id === current.id && issued.from === current.from && issued.listId === data.listId &&
        issued.owned === data.owned ? data : null;
    }
    function write(method, hash, data) {
      // Preserve other history users' top-level fields; replace only our namespace.
      const state = Object.assign({}, win.history.state || {});
      state[KEY] = data;
      win.history[method](state, '', hash);
    }
    function listState(saved) {
      const listId = ++serial;
      lists.set(listId, context(saved, saved.view));
      return { marker: MARKER, session, kind: 'list', listId, listcontext: context(saved, saved.view), owned: false };
    }
    function entryState(current, saved, owned, listId) {
      if (!listId) {
        listId = ++serial;
        lists.set(listId, context(saved, current.from));
      }
      const entryId = ++serial;
      entries.set(entryId, { id: current.id, from: current.from, listId, owned });
      return { marker: MARKER, session, kind: 'entry', entryId, listId,
        id: current.id, from: current.from, listcontext: context(saved, current.from), owned };
    }
    function identity() {
      const data = marker();
      return JSON.stringify([win.location.hash, data && data.kind, data && data.listId, data && data.entryId]);
    }
    function apply() {
      const key = identity();
      if (last === key) return;
      last = key;
      backing = false;
      const current = route();
      if (current.kind === 'entry') {
        const data = entryMarker(current);
        const saved = listContext(data, current.from);
        onEntry(current.id, current.from, saved);
      } else if (current.kind === 'list') {
        const data = marker();
        onList(listContext(data && data.kind === 'list' ? data : null, current.view));
      } else {
        onMissing(defaultContext('home'));
      }
    }
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      // The identity check also deduplicates events delivered in separate browser tasks.
      Promise.resolve().then(() => { scheduled = false; apply(); });
    }
    function start() {
      if (started) return api;
      started = true;
      win.addEventListener('popstate', schedule);
      win.addEventListener('hashchange', schedule);
      apply();
      return api;
    }
    function open(id) {
      const current = route();
      if (current.kind === 'entry') return replace(id);
      const raw = getContext() || {};
      const from = current.kind === 'list' ? current.view : validView(raw.view, allowDiary) ? raw.view : 'home';
      // Snapshot before onEntry can lock the reader/body and change scrollY.
      const saved = context(raw, from);
      const next = { kind: 'entry', id, from };
      const hash = encode(id, from);
      const base = listState(saved);
      write('replaceState', '#' + from, base);
      write('pushState', hash, entryState(next, saved, true, base.listId));
      apply();
      return api;
    }
    function replace(id) {
      const current = route();
      if (current.kind !== 'entry') return open(id);
      const data = entryMarker(current);
      const saved = listContext(data, current.from);
      const next = { kind: 'entry', id, from: current.from };
      write('replaceState', encode(id, current.from), entryState(next, saved, !!(data && data.owned), data && data.listId));
      apply();
      return api;
    }
    function exit(notify) {
      const current = route();
      if (current.kind === 'list') return api;
      const from = current.kind === 'entry' ? current.from : 'home';
      const saved = listContext(entryMarker(current), from);
      write('replaceState', '#' + from, listState(saved));
      backing = false;
      if (notify) apply();
      else last = identity();
      return api;
    }
    function close(settings) {
      const current = route();
      if (current.kind === 'list' || backing) return api;
      const data = entryMarker(current);
      if (!(settings && settings.replace) && data && data.owned && lists.has(data.listId)) {
        backing = true;
        win.history.back();
        return api;
      }
      return exit(true);
    }
    const api = { start, open, replace, close, leave: () => exit(true), clear: () => exit(false) };
    return api;
  }

  return { parse, encode, create };
});
