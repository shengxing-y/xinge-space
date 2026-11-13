'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const EntryRoute = require('./src/entry-route.js');

function fixture(hash = '#home', initialState = null, extra = {}) {
  const listeners = {};
  const history = [{ hash, state: initialState }];
  const calls = [], queue = [];
  let index = 0, context = { view: 'home', filter: 'all', search: '', month: '', scrollY: 420 };
  const win = {
    location: { hash },
    addEventListener(name, fn) { (listeners[name] ||= []).push(fn); },
    history: {
      get state() { return history[index].state; },
      get length() { return history.length; },
      replaceState(state, unused, nextHash) {
        history[index] = { hash: nextHash, state: structuredClone(state) };
        win.location.hash = nextHash;
      },
      pushState(state, unused, nextHash) {
        history.splice(index + 1);
        history.push({ hash: nextHash, state: structuredClone(state) });
        index++;
        win.location.hash = nextHash;
      },
      back() { calls.push(['back']); queue.push(() => travel(-1)); },
      forward() { queue.push(() => travel(1)); },
    },
  };
  function emit(name) { for (const fn of listeners[name] || []) fn({ type: name }); }
  function travel(delta) {
    if (index + delta < 0 || index + delta >= history.length) return;
    index += delta;
    win.location.hash = history[index].hash;
    emit('popstate');
    emit('hashchange');
  }
  const router = EntryRoute.create({ window: win, getContext: () => context,
    onList: value => calls.push(['list', value]),
    onEntry: (id, from, value) => calls.push(['entry', id, from, value]),
    onMissing: value => calls.push(['missing', value]), ...extra });
  return {
    win, router, calls, history,
    setContext(value) { context = value; },
    get index() { return index; },
    emit,
    hash(nextHash) {
      win.history.pushState(null, '', nextHash);
      emit('hashchange');
    },
    async flush() { while (queue.length) queue.shift()(); await Promise.resolve(); },
  };
}

const defaults = view => ({ view, filter: 'all', search: '', month: '', scrollY: 0 });

test('UMD exposes the same API in browsers and CommonJS', () => {
  const root = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('./src/entry-route.js'), 'utf8'), { globalThis: root });
  assert.deepEqual(Object.keys(root.EntryRoute), ['parse', 'encode', 'create']);
  assert.equal(root.EntryRoute.encode('id', 'art'), '#entry/id?from=art');
  let amd;
  const define = (dependencies, factory) => { assert.equal(dependencies.length, 0); amd = factory(); };
  define.amd = true;
  vm.runInNewContext(fs.readFileSync(require.resolve('./src/entry-route.js'), 'utf8'), { define });
  assert.equal(amd.parse('#music').view, 'music');
});

test('parse accepts only known list views and explicitly gates diary', () => {
  for (const hash of ['', '#', '#home']) assert.deepEqual(EntryRoute.parse(hash), { kind: 'list', view: 'home' });
  for (const view of ['work', 'art', 'life', 'music']) {
    assert.deepEqual(EntryRoute.parse('#' + view), { kind: 'list', view });
  }
  assert.deepEqual(EntryRoute.parse('#diary'), { kind: 'missing', from: 'home' });
  assert.deepEqual(EntryRoute.parse('#diary', true), { kind: 'list', view: 'diary' });
});

test('entry IDs round-trip unicode and reserved characters with exactly one decoding', () => {
  for (const id of ['plain', '中文 空格', 'a/b?c=d#e&f+g', '%2F', ' x ', '😀']) {
    const hash = EntryRoute.encode(id, 'art');
    assert.deepEqual(EntryRoute.parse(hash), { kind: 'entry', id, from: 'art' });
  }
  assert.deepEqual(EntryRoute.parse('#entry/id'), { kind: 'entry', id: 'id', from: 'home' });
  assert.equal(EntryRoute.encode('id', 'bogus'), '#entry/id?from=home');
  assert.equal(EntryRoute.encode('id'), '#entry/id?from=home');
  assert.deepEqual(EntryRoute.parse('#entry/id?from=diary'), { kind: 'missing', from: 'home' });
  assert.deepEqual(EntryRoute.parse('#entry/id?from=diary', true), { kind: 'entry', id: 'id', from: 'diary' });
});

test('parse rejects malformed routes without throwing', () => {
  for (const hash of [null, undefined, 1, {}, 'home', '#bogus', '#entry/', '#entry/a/b', '#entry/%',
    '#entry/%E0%A4%A', '#entry/%20', '#entry/%00', '#entry/a%0Ab', '#entry/a%7F', '#entry/id?',
    '#entry/id?from=', '#entry/id?from=unknown', '#entry/id?from=work&from=art',
    '#entry/id?other=x', '#entry/id?from=work&x=1', '#entry/id#other', '#home?x=1']) {
    assert.deepEqual(EntryRoute.parse(hash), { kind: 'missing', from: 'home' }, String(hash));
  }
  for (const id of ['', '  ', '\n', 'a\0b', null, 2]) assert.throws(() => EntryRoute.encode(id), TypeError);
});

test('start is synchronous and idempotent, cold links have a neutral list baseline', () => {
  const f = fixture('#entry/deep?from=music', { unrelated: { preserved: true } });
  assert.equal(f.router.start(), f.router);
  f.router.start();
  assert.deepEqual(f.calls, [['entry', 'deep', 'music', defaults('music')]]);
  assert.equal(f.history.length, 1);
  assert.equal(f.win.history.state.__xjRoute, undefined);
});

test('open snapshots the list before the reader locks scroll and preserves unrelated history fields', async () => {
  let f;
  f = fixture('#art', { other: { value: 1 } }, {
    onEntry(id, from, context) {
      f.calls.push(['entry', id, from, context]);
      f.setContext({ view: 'art', scrollY: 0 });
    },
  });
  const saved = { view: 'art', filter: 'all', search: 'ink', month: '2026-11', scrollY: 837 };
  f.setContext(saved);
  f.router.start().open('picture');
  saved.search = 'mutated';
  assert.equal(f.history.length, 2);
  assert.equal(f.history[0].hash, '#art');
  assert.equal(f.history[1].hash, '#entry/picture?from=art');
  for (const item of f.history) assert.deepEqual(item.state.other, { value: 1 });
  assert.equal(f.history[0].state.__xjRoute.kind, 'list');
  assert.equal(f.history[1].state.__xjRoute.owned, true);
  assert.equal(f.calls.at(-1)[3].scrollY, 837);
  f.router.close();
  assert.equal(f.win.location.hash, '#entry/picture?from=art');
  await f.flush();
  assert.deepEqual(f.calls.at(-1), ['list', { ...saved, search: 'ink' }]);
});

test('Back and Forward restore owned snapshots and paired browser events apply only once', async () => {
  const f = fixture('#home');
  const saved = { view: 'home', filter: 'music', search: 'song', month: '2025-02', scrollY: 620 };
  f.setContext(saved);
  f.router.start().open('song');
  f.win.history.back();
  await f.flush();
  assert.deepEqual(f.calls.at(-1), ['list', saved]);
  let count = f.calls.length;
  f.emit('hashchange');
  await f.flush();
  assert.equal(f.calls.length, count);
  f.win.history.forward();
  await f.flush();
  assert.deepEqual(f.calls.at(-1), ['entry', 'song', 'home', saved]);
  count = f.calls.length;
  f.emit('popstate');
  await f.flush();
  assert.equal(f.calls.length, count);
  f.router.close().close();
  assert.equal(f.calls.filter(call => call[0] === 'back').length, 2);
  await f.flush();
  assert.equal(f.index, 0);
});

test('gallery replace updates entry without growing history and preserves close ownership', async () => {
  const f = fixture('#art');
  f.router.start().open('one').replace('two').open('three');
  assert.equal(f.history.length, 2);
  assert.equal(f.calls.at(-1)[1], 'three');
  assert.equal(f.win.history.state.__xjRoute.owned, true);
  f.router.close();
  await f.flush();
  assert.equal(f.win.location.hash, '#art');
  f.win.history.forward();
  await f.flush();
  assert.equal(f.calls.at(-1)[1], 'three');
});

test('closing a cold direct link replaces it locally instead of leaving the site', () => {
  const f = fixture('#entry/id?from=work', { other: 7 });
  f.router.start().replace('next').close();
  assert.equal(f.win.location.hash, '#work');
  assert.equal(f.history.length, 1);
  assert.equal(f.win.history.state.other, 7);
  assert.deepEqual(f.calls.at(-1), ['list', defaults('work')]);
  assert.equal(f.calls.some(call => call[0] === 'back'), false);
});

test('forged or previous-instance state cannot authorize Back or inject list filters', () => {
  const fake = { __xjRoute: { marker: 'xj-entry-route-v1', session: 'forged', kind: 'entry',
    owned: true, listId: 1, entryId: 2, listcontext: { view: 'art', search: 'injected' } } };
  const f = fixture('#entry/id?from=art', fake);
  f.router.start().close();
  assert.deepEqual(f.calls.at(-1), ['list', defaults('art')]);
  assert.equal(f.calls.some(call => call[0] === 'back'), false);
  const previous = fixture('#life');
  previous.router.start().open('old');
  const reload = fixture(previous.win.location.hash, previous.win.history.state);
  reload.router.start().close();
  assert.deepEqual(reload.calls.at(-1), ['list', defaults('life')]);
  assert.equal(reload.calls.some(call => call[0] === 'back'), false);
});

test('a stale owned state copied to a different entry is not trusted', async () => {
  const f = fixture('#art');
  f.router.start().open('one');
  f.win.history.pushState(f.win.history.state, '', '#entry/unowned?from=art');
  f.emit('hashchange');
  await f.flush();
  f.router.close();
  assert.equal(f.win.location.hash, '#art');
  assert.equal(f.calls.some(call => call[0] === 'back'), false);
});

test('leave and forced close replace the entry; clear performs editor handoff without any UI callback', () => {
  for (const method of ['leave', 'close', 'clear']) {
    const f = fixture('#work');
    const saved = { view: 'work', filter: 'all', search: 'note', month: '', scrollY: 99 };
    f.setContext(saved);
    f.router.start().open('id');
    const count = f.calls.length;
    f.router[method]({ replace: true });
    assert.equal(f.win.location.hash, '#work');
    assert.equal(f.history.length, 2);
    assert.equal(f.calls.some(call => call[0] === 'back'), false);
    if (method === 'clear') assert.equal(f.calls.length, count);
    else assert.deepEqual(f.calls.at(-1), ['list', saved]);
  }
});

test('list callbacks can close overlays through router.close without recursion', async () => {
  let f;
  f = fixture('#home', null, { onList(value) { f.calls.push(['list', value]); f.router.close(); } });
  f.router.start().open('id').close();
  await f.flush();
  assert.equal(f.calls.filter(call => call[0] === 'list').length, 2);
});

test('hash-only navigation discards old filters and invalid routes call onMissing with home context', async () => {
  const f = fixture('#home');
  f.router.start().open('id');
  f.hash('#music');
  await f.flush();
  assert.deepEqual(f.calls.at(-1), ['list', defaults('music')]);
  f.hash('#entry/other?from=life');
  await f.flush();
  assert.deepEqual(f.calls.at(-1), ['entry', 'other', 'life', defaults('life')]);
  f.hash('#entry/%');
  await f.flush();
  assert.deepEqual(f.calls.at(-1), ['missing', defaults('home')]);
  f.router.close();
  assert.deepEqual(f.calls.at(-1), ['list', defaults('home')]);
});

test('create enforces diary policy and sanitizes snapshots without retaining caller objects', () => {
  const publicSite = fixture('#diary');
  publicSite.router.start();
  assert.equal(publicSite.calls[0][0], 'missing');
  const local = fixture('#diary', null, { allowDiary: true });
  local.setContext({ view: 'diary', filter: 'diary', search: 1, month: null, scrollY: NaN });
  local.router.start().open('private');
  assert.equal(local.win.location.hash, '#entry/private?from=diary');
  assert.deepEqual(local.calls.at(-1)[3], { ...defaults('diary'), filter: 'diary' });
  assert.throws(() => EntryRoute.create({}), TypeError);
});
