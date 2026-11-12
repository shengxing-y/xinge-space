'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('./src/theme-policy.js');
function storage(values = {}) {
  const data = new Map(Object.entries(values));
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
test('visitor-local clock: only 00:00–05:59 is dawn', () => {
  for (const hour of [0, 2, 5]) assert.equal(policy.automatic(new Date(2026, 10, 12, hour, 59)), 'dawn');
  for (const hour of [6, 12, 18, 23]) assert.equal(policy.automatic(new Date(2026, 10, 12, hour)), 'vesper');
});
test('legacy manual choices survive; explicit auto is not mistaken for manual', () => {
  assert.deepEqual(policy.restore(storage({'xj-theme':'dawn'})), {manual:true,theme:'dawn'});
  assert.deepEqual(policy.restore(storage({'xj-theme':'vesper','xj-theme-manual':'1'})), {manual:true,theme:'vesper'});
  assert.deepEqual(policy.restore(storage({'xj-theme':'dawn','xj-theme-manual':'0'}), new Date(2026,10,12,18)), {manual:false,theme:'vesper'});
  assert.equal(policy.restore(storage({'xj-theme':'bad','xj-theme-manual':'1'})).manual, false);
});
test('storage failure is nonfatal and restored automatic time stays local', () => {
  const blocked = {getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.deepEqual(policy.restore(blocked,new Date(2026,10,12,2)),{manual:false,theme:'dawn'});
  assert.doesNotThrow(()=>policy.save(blocked,true,'vesper'));
});
test('restoring auto overrides a stale saved theme', () => {
  const s=storage();policy.save(s,true,'dawn');assert.equal(policy.restore(s).manual,true);
  policy.save(s,false,'vesper');assert.deepEqual(policy.restore(s,new Date(2026,10,12,2)),{manual:false,theme:'dawn'});
});
test('twilight time always formats in Beijing timezone', () => {
  assert.equal(policy.formatTime('2026-11-12T09:48:00Z'),'17:48');
});
