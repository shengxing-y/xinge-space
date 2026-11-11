'use strict';
// Reference fixtures: Astronomy Engine 2.1.19, geometric Horizon (no refraction).
// Generated independently of sky-astronomy.js; no runtime/test package dependency.
const assert = require('node:assert/strict');
const sky = require('./sky-astronomy.js');
const catalog = require('./sky-catalog.js');
const events = [
  ['2026-01-15', 'dawn', '2026-01-14T22:43:27.062Z'],
  ['2026-01-15', 'vesper', '2026-01-15T10:00:56.538Z'],
  ['2026-06-21', 'dawn', '2026-06-20T19:53:39.208Z'],
  ['2026-06-21', 'vesper', '2026-06-21T12:28:01.911Z'],
  ['2026-11-10', 'dawn', '2026-11-09T22:05:05.505Z'],
  ['2026-11-10', 'vesper', '2026-11-10T09:48:40.014Z'],
  ['2026-12-21', 'dawn', '2026-12-20T22:39:22.554Z'],
  ['2026-12-21', 'vesper', '2026-12-21T09:41:17.735Z'],
];
for (const [day, theme, reference] of events) {
  const time = sky.twilight(day, theme);
  assert.equal(sky.chinaDate(time), day);
  assert.ok(Math.abs(time - new Date(reference)) < 180000);
}
const date = new Date('2026-11-09T22:05:06Z');
for (const [id, alt, az] of [[32263, 27.42737255, 214.32543658], [30365, -6.60781079, 201.51449248], [69451, 18.48413830, 79.96383782]]) {
  const row = catalog.find(s => s[0] === id);
  const eq = sky.precess(row[1], row[2], date);
  const pos = sky.horizontal(date, eq.ra, eq.dec);
  assert.ok(Math.abs(pos.alt - alt) < .1 && Math.abs(pos.az - az) < .1);
}
assert.equal(catalog.length, 5070);
assert.ok(catalog.every(s => s[0] !== 0 && s[3] <= 6));
assert.equal(sky.chinaDate(new Date('2026-11-10T15:59:59Z')), '2026-11-10');
assert.equal(sky.chinaDate(new Date('2026-11-10T16:00:00Z')), '2026-11-11');
assert.ok(Math.abs(sky.BEARING - 64.11407975) < 1e-6);
assert.deepEqual(sky.project({ alt:35, az:sky.BEARING }, 1000, 1000), { x:500, y:500 });
assert.equal(sky.project({ alt:-1, az:sky.BEARING }, 1000, 1000), null);
const star = { alt:40, az:sky.BEARING+5 };
const wide = sky.project(star, 1000, 1000), narrow = sky.project(star, 390, 1000);
assert.ok(Math.abs((wide.x-500)-(narrow.x-195)) < 1e-10);
assert.equal(wide.y, narrow.y);
assert.deepEqual(sky.sky('2026-11-10', 'dawn', catalog), sky.sky('2026-11-10', 'dawn', catalog));
console.log('PASS: independent twilight/star fixtures, catalog, China date, bearing, horizon, isotropic projection and deterministic positions');
