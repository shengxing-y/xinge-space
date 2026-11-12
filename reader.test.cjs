'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function fixture() {
  const makeStyle = () => ({
    getPropertyValue(name) { return this[name] || ''; },
    getPropertyPriority() { return ''; },
    setProperty(name, value) { this[name] = value; },
    removeProperty(name) { delete this[name]; },
  });
  const queue = [];
  let nextDialog = null;
  const trigger = { isConnected:true, disabled:false, getClientRects:()=>[{}], closest:()=>null,
    focus(options) { doc.activeElement = this; assert.equal(options.preventScroll, true); } };
  const fallback = { ...trigger };
  const win = { scrollX:0, scrollY:420, innerWidth:1000,
    getComputedStyle:()=>({paddingRight:'0'}), requestAnimationFrame:callback=>queue.push(callback),
    scrollTo(x, y) { this.scrollX=x; this.scrollY=y; } };
  const doc = { body:{style:makeStyle()}, documentElement:{clientWidth:1000,style:makeStyle()},
    defaultView:win, activeElement:trigger,
    querySelector:()=>nextDialog, querySelectorAll:selector=>selector.startsWith('.entry')?[]:[fallback] };
  const listeners = {};
  const closeButton = { focus() { doc.activeElement=this; } };
  const dialog = { ownerDocument:doc, dataset:{}, open:false, scrollTop:100,
    addEventListener(name, callback) { listeners[name]=callback; },
    querySelector:()=>closeButton, getBoundingClientRect:()=>({left:10,right:990,top:20,bottom:800}),
    showModal() { this.open=true; }, close() { this.open=false; listeners.close(); } };
  const root = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('./src/reader.js'),'utf8'), {globalThis:root});
  return { dialog, doc, win, trigger, fallback, listeners, open:()=>root.ReaderView.open(dialog,'entry'),
    flush() { while(queue.length)queue.shift()(); }, setNext(value) { nextDialog=value; } };
}

test('reader opens at top, locks page, and restores scroll/focus on close', () => {
  const f=fixture(); f.doc.body.style.setProperty('overflow','clip');
  f.open(); assert.equal(f.dialog.scrollTop,0); assert.equal(f.doc.body.style.position,'fixed');
  f.dialog.scrollTop=300; f.dialog.close(); f.flush();
  assert.equal(f.doc.body.style.position,undefined); assert.equal(f.doc.body.style.overflow,'clip');
  assert.equal(f.win.scrollY,420); assert.equal(f.doc.activeElement,f.trigger);
  f.open(); assert.equal(f.dialog.scrollTop,0);
});

test('editor handoff keeps lock and does not steal focus until the next modal closes', () => {
  const f=fixture(); f.open(); let closed;
  const editor={addEventListener(name, callback) { assert.equal(name,'close'); closed=callback; }};
  f.setNext(editor); f.dialog.close(); f.flush(); assert.equal(f.doc.body.style.position,'fixed');
  f.setNext(null); closed(); f.flush(); assert.equal(f.doc.body.style.position,undefined);
});

test('hidden or removed trigger falls back to a visible stable control', () => {
  for(const hidden of [true,false]) {
    const f=fixture();f.open();
    if(hidden)f.trigger.getClientRects=()=>[];else f.trigger.isConnected=false;
    f.dialog.close();f.flush();assert.equal(f.doc.activeElement,f.fallback);
  }
});

test('internal whitespace does not close; a complete backdrop click does', () => {
  const f=fixture();f.open();
  for(const name of ['pointerdown','click'])f.listeners[name]({target:f.dialog,clientX:30,clientY:40});
  assert.equal(f.dialog.open,true);
  for(const name of ['pointerdown','click'])f.listeners[name]({target:f.dialog,clientX:1,clientY:40});
  assert.equal(f.dialog.open,false);f.flush();assert.equal(f.doc.body.style.position,undefined);
});

test('rapid reopen cancels a pending old close cleanup', () => {
  const f=fixture();f.open();f.dialog.close();f.open();f.flush();
  assert.equal(f.dialog.open,true);assert.equal(f.doc.body.style.position,'fixed');
  f.dialog.close();f.flush();assert.equal(f.doc.body.style.position,undefined);
});
