'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const names = require('./sky-names.js');
const catalog = require('./sky-catalog.js');

test('name metadata references real bright catalog stars only', () => {
  assert.equal(Object.keys(names).length, 145);
  const stars = new Map(catalog.map(row => [String(row[0]), row]));
  for (const [id, item] of Object.entries(names)) {
    assert.ok(stars.has(id));
    assert.ok(stars.get(id)[3] <= 3);
    assert.ok(item.name && item.english && item.constellation && /^[A-Za-z]{3}$/.test(item.con));
  }
});
test('verified familiar names retain catalog identity, not brightness rank', () => {
  assert.equal(names[32263].name, '天狼');
  assert.equal(names[69451].name, '大角');
  const capella = Object.entries(names).find(([, star]) => star.english === 'Capella');
  assert.equal(capella[1].name, '五车二');
  assert.equal(capella[1].con, 'Aur');
  assert.equal(capella[1].constellation, '御夫座');
  assert.equal(Object.values(names).filter(star => star.name !== star.english).length, 46);
});
