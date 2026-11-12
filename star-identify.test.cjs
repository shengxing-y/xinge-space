'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const api = require('./src/star-identify.js');
const star = (id, x = 100, y = 100, mag = 1) => ({ id, x, y, mag, name: id, constellation: '猎户座', english: id });

test('CommonJS and standalone browser exports', () => {
  assert.deepEqual(Object.keys(api).sort(), ['create', 'nearest']);
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'src/star-identify.js'), 'utf8'), context);
  assert.equal(typeof context.StarIdentify.nearest, 'function');
  assert.equal(typeof context.StarIdentify.create, 'function');
});
test('nearest returns original objects and includes radius boundary', () => {
  const a = star('a', 12, 0), b = star('b', 13, 0);
  assert.equal(api.nearest([b, a], 0, 0, 12), a);
  assert.equal(api.nearest([a], 0, 0, 11), null);
  assert.equal(api.nearest([a], 12, 0, 0), a);
  assert.equal(api.nearest([], 0, 0, 12), null);
});
test('nearest rejects unnamed, nonfinite and dim candidates or invalid queries', () => {
  const invalid = [null, { ...star(''), name: '  ' }, { ...star('a'), name: null },
    star('a', NaN), star('a', Infinity), star('a', 0, NaN), star('a', 0, 0, NaN),
    star('a', 0, 0, Infinity), star('a', 0, 0, 3.01), { ...star('a'), mag: '1' }];
  assert.equal(api.nearest(invalid, 0, 0, 1000), null);
  for (const args of [[NaN, 0, 1], [0, Infinity, 1], [0, 0, -1], [0, 0, Infinity]]) {
    assert.equal(api.nearest([star('a')], ...args), null);
  }
  assert.equal(api.nearest(null, 0, 0, 1), null);
  const limit = star('a', 0, 0, 3);
  assert.equal(api.nearest([limit], 0, 0, 0), limit);
});
test('distance wins, then smaller magnitude, then stable lexical id regardless of input order', () => {
  const a = star('a', -1, 0, 1), b = star('b', 1, 0, 1), c = star('c', 0, 1, 2);
  for (const list of [[a, b, c], [c, b, a], [b, a, c]]) assert.equal(api.nearest(list, 0, 0, 5), a);
  const nearer = star('near', 0, 0, 3);
  assert.equal(api.nearest([a, nearer], 0, 0, 5), nearer);
  assert.equal(api.nearest([a, b], 0, 0, 5, s => s.id === 'b'), b);
  assert.equal(api.nearest([a], 0, 0, 5, () => false), null);
});

// Minimal DOM/event harness; no browser or external dependencies required.
function fixture() {
  function target(extra = {}) {
    return Object.assign({
      listeners: {}, attrs: {}, style: {}, childNodes: [], nodeType: 1,
      tagName: 'DIV', hidden: false, offsetWidth: 160, offsetHeight: 30,
      addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
      emit(type, event = {}) { for (const fn of this.listeners[type] || []) fn(event); },
      setAttribute(key, value) { this.attrs[key] = value; },
      removeAttribute(key) { delete this.attrs[key]; },
      appendChild(node) { this.children ||= []; this.children.push(node); },
      closest() { return this.blocked ? this : null; },
      matches() { return !!this.background; },
      getBoundingClientRect() { return { left: 0, bottom: 0 }; },
    }, extra);
  }
  const body = target({ tagName: 'BODY', background: true });
  const win = target({ innerWidth: 400, innerHeight: 300,
    getComputedStyle: node => ({ backgroundColor: node.color || 'rgba(0, 0, 0, 0)', backgroundImage: 'none' }) });
  let centerBlocked = false, allowed = true;
  const obstruction = target({ blocked: true });
  const doc = target({ body, defaultView: win, hidden: false,
    documentElement: { clientWidth: 400, clientHeight: 300 },
    createElement: tag => target({ tagName: tag.toUpperCase(), blocked: tag === 'button' }),
    elementFromPoint: (x, y) => centerBlocked && x === 100 && y === 100 ? obstruction : body });
  const controller = api.create({ document: doc, enabled: () => allowed });
  const tip = body.children[0], button = controller.keyboardButton;
  function pointer(type, extra = {}) {
    doc.emit(type, { pointerType: 'touch', pointerId: 1, button: 0, buttons: 0, isPrimary: true,
      target: body, clientX: 100, clientY: 100, timeStamp: 0, ...extra });
  }
  return { doc, win, body, controller, tip, button, pointer, target,
    setAllowed: v => { allowed = v; }, setBlocked: v => { centerBlocked = v; } };
}
test('mouse hover checks target, center occlusion, brightness and pointer type', () => {
  const f = fixture();
  f.controller.setStars([star('参宿四')]);
  f.pointer('pointermove', { pointerType: 'mouse' });
  assert.equal(f.tip.hidden, false);
  assert.equal(f.tip.textContent, '参宿四 / 猎户座 / 视星等 1.00');
  assert.equal(f.tip.style.pointerEvents, 'none');
  f.setBlocked(true);
  f.pointer('pointermove', { pointerType: 'mouse', clientX: 104 });
  assert.equal(f.tip.hidden, true);
  f.setBlocked(false);
  f.pointer('pointermove', { pointerType: 'pen' });
  assert.equal(f.tip.hidden, true);
  f.pointer('pointermove', { pointerType: 'mouse', target: f.target({ blocked: true }) });
  assert.equal(f.tip.hidden, true);
  f.pointer('pointermove', { pointerType: 'mouse', clientX: 113 });
  assert.equal(f.tip.hidden, true);
});
test('transparent allowlist rejects opaque wrapper and direct text', () => {
  const f = fixture();
  f.controller.setStars([star('a')]);
  for (const node of [f.target(), f.target({ background: true, color: 'rgb(0, 0, 0)' }),
    f.target({ background: true, childNodes: [{ nodeType: 3, textContent: '正文' }] })]) {
    f.pointer('pointermove', { pointerType: 'mouse', target: node });
    assert.equal(f.tip.hidden, true);
  }
});
test('touch pins within radius 24 and closes on outside down, scroll, resize, blur, hidden, rebuild', () => {
  const f = fixture();
  f.controller.setStars([star('a')]);
  function tap() {
    f.pointer('pointerdown', { clientX: 124 });
    f.pointer('pointerup', { clientX: 124, timeStamp: 200 });
    assert.equal(f.tip.hidden, false);
    f.pointer('pointermove', { pointerType: 'mouse', clientX: 300 });
    assert.equal(f.tip.hidden, false);
  }
  for (const cancel of [() => f.pointer('pointerdown', { clientX: 300 }),
    () => f.doc.emit('scroll'), () => f.win.emit('resize'), () => f.win.emit('blur'),
    () => { f.doc.hidden = true; f.doc.emit('visibilitychange'); f.doc.hidden = false; },
    () => f.controller.setStars([star('a')]), () => f.controller.setSuspended(true)]) {
    tap(); cancel(); assert.equal(f.tip.hidden, true); f.controller.setSuspended(false);
  }
});
test('touch gestures reject transition-start, drag, long press, cancellation, scroll and ordinary clicks', () => {
  const f = fixture();
  f.controller.setStars([star('a')]);
  f.setAllowed(false); f.pointer('pointerdown'); f.setAllowed(true);
  f.pointer('pointerup', { timeStamp: 100 });
  assert.equal(f.tip.hidden, true);
  for (const cancel of [() => f.pointer('pointermove', { clientX: 111 }),
    () => f.doc.emit('scroll'), () => f.pointer('pointercancel'),
    () => f.controller.setSuspended(true), () => f.setAllowed(false)]) {
    f.pointer('pointerdown'); cancel(); f.pointer('pointerup', { timeStamp: 100 });
    assert.equal(f.tip.hidden, true); f.controller.setSuspended(false); f.setAllowed(true);
  }
  f.pointer('pointerdown'); f.pointer('pointerup', { timeStamp: 501 });
  assert.equal(f.tip.hidden, true);
  f.doc.emit('click', { target: f.body, detail: 0 });
  assert.equal(f.tip.hidden, true);
});
test('keyboard traverses visible candidates in x order, wraps, and handles empty/Escape/Tab', () => {
  const f = fixture();
  f.controller.setStars([star('right', 200), star('left', 30), star('blocked'), star('offscreen', -1)]);
  f.setBlocked(true);
  const key = key => {
    let prevented = false;
    f.button.emit('keydown', { key, preventDefault() { prevented = true; } });
    return prevented;
  };
  f.button.emit('focus');
  assert.match(f.tip.textContent, /^left/);
  assert.equal(f.button.attrs['aria-describedby'], 'star-tip');
  assert.equal(key('ArrowRight'), true); assert.match(f.tip.textContent, /^right/);
  key('ArrowRight'); assert.match(f.tip.textContent, /^left/);
  key('End'); assert.match(f.tip.textContent, /^right/);
  key('Home'); assert.match(f.tip.textContent, /^left/);
  key('ArrowUp'); assert.match(f.tip.textContent, /^right/);
  assert.equal(key('Tab'), false);
  f.button.emit('blur'); assert.equal(f.tip.hidden, true);
  f.controller.setStars([]); f.button.emit('focus');
  assert.equal(f.tip.textContent, '当前视野暂无可识别亮星');
  key('Escape'); assert.equal(f.tip.hidden, true);
  assert.equal(f.button.attrs['aria-describedby'], undefined);
  f.setAllowed(false); f.button.emit('focus'); assert.equal(f.tip.hidden, true);
});
