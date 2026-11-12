'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const activity = require('./src/activity.js');

const entry = (day, category = 'work') => ({ day, category });
const at = (year, month, day, hour = 12) => new Date(year, month - 1, day, hour);

test('365 local dates include today and exactly the previous 364 days', () => {
  const result = activity.summarize([], at(2026, 11, 12));
  assert.equal(result.start, '2025-11-13');
  assert.equal(result.end, '2026-11-12');
  assert.equal(result.days365.length, 365);
  assert.equal(new Set(result.days365.map(row => row.day)).size, 365);
  assert.deepEqual(result.days365[0], { day: '2025-11-13', count: 0, level: 0, today: false });
  assert.deepEqual(result.days365[364], { day: '2026-11-12', count: 0, level: 0, today: true });
  assert.equal(result.days365.filter(row => row.today).length, 1);
  assert.equal(result.total, 0);
  assert.equal(result.activeDays, 0);
});

test('only public categories inside the inclusive range contribute to totals', () => {
  const entries = [
    entry('2025-11-13', 'work'), entry('2026-11-12', 'art'),
    entry('2026-11-12', 'life'), entry('2026-11-12', 'music'),
    entry('2026-11-12', 'diary'), entry('2026-11-12', 'unknown'),
    entry('2026-11-12', '__proto__'), entry('2026-11-12', 'constructor'),
    entry('2025-11-12'), entry('2026-11-13'), entry('1990-01-01')
  ];
  const result = activity.summarize(entries, at(2026, 11, 12));
  assert.equal(result.total, 4);
  assert.equal(result.activeDays, 2);
  assert.equal(result.days365[0].count, 1);
  assert.equal(result.days365[364].count, 3);
});

test('one day remains one row; levels are 0, 1, 2 and 3+ without capping counts', () => {
  const entries = [entry('2026-11-09'), ...Array(2).fill(entry('2026-11-10')), ...Array(8).fill(entry('2026-11-11'))];
  const result = activity.summarize(entries, at(2026, 11, 12));
  assert.deepEqual(result.days365.slice(-4).map(({ count, level }) => [count, level]), [[1, 1], [2, 2], [8, 3], [0, 0]]);
  assert.equal(result.total, 11);
  assert.equal(result.activeDays, 3);
});

test('malformed dates and rows are ignored rather than normalized', () => {
  const badDays = ['2026-02-29', '2026-04-31', '2026-00-10', '2026-13-01', '2026-11-00',
    '2026-11-32', '2026-1-01', '2026-11-1', '2026-11-12T00:00:00Z', '2026-11-12 ',
    '<script>', '', null, undefined, 20261112, {}, new Date()];
  const entries = [...badDays.map(day => entry(day)), null, undefined, {}, 'invalid', entry('2026-02-28')];
  const result = activity.summarize(entries, at(2026, 11, 12));
  assert.equal(result.total, 1);
  assert.equal(result.days365.find(row => row.day === '2026-02-28').count, 1);
  assert.equal(result.days365.find(row => row.day === '2026-03-01').count, 0);
});

test('leap day participates in a 365-day window and century leap rules are strict', () => {
  const leap = activity.summarize([entry('2024-02-29'), entry('2024-03-01'), entry('2023-03-01')], at(2024, 3, 1));
  assert.equal(leap.start, '2023-03-03');
  assert.equal(leap.total, 2);
  assert.equal(leap.days365.filter(row => row.day === '2024-02-29').length, 1);
  assert.equal(activity.summarize([entry('2000-02-29')], at(2000, 3, 1)).total, 1);
  const nonLeap = activity.summarize([entry('2100-02-29'), entry('2100-02-28')], at(2100, 3, 1));
  assert.equal(nonLeap.total, 1);
  assert.ok(!nonLeap.days365.some(row => row.day === '2100-02-29'));
});

test('rerunning across local midnight advances both bounds without mutating inputs', () => {
  const row = Object.freeze(entry('2025-11-13'));
  const entries = Object.freeze([row, Object.freeze(entry('2026-11-13'))]);
  const now = at(2026, 11, 12, 23);
  const timestamp = now.getTime();
  const before = activity.summarize(entries, now);
  const after = activity.summarize(entries, at(2026, 11, 13, 0));
  assert.equal(now.getTime(), timestamp);
  assert.equal(before.start, '2025-11-13');
  assert.equal(after.start, '2025-11-14');
  assert.equal(after.end, '2026-11-13');
  assert.equal(before.total, 1);
  assert.equal(after.total, 1);
  assert.equal(before.days365[0].count, 1);
  assert.equal(after.days365[364].count, 1);
  assert.deepEqual(before, activity.summarize(entries, now));
});

test('missing entries are empty, invalid now is explicit, and render is SSR safe', () => {
  for (const input of [undefined, null, {}, 'invalid']) assert.equal(activity.summarize(input, at(2026, 11, 12)).total, 0);
  for (const input of [new Date('invalid'), null, '2026-11-12', 0]) {
    assert.throws(() => activity.summarize([], input), RangeError);
  }
  assert.equal(activity.summarize([]).days365.length, 365);
  assert.deepEqual(activity.render([], at(2026, 11, 12)), activity.summarize([], at(2026, 11, 12)));
});

test('UMD exposes browser global and AMD without requiring a DOM', () => {
  const source = fs.readFileSync(path.join(__dirname, 'src/activity.js'), 'utf8');
  const browser = {};
  vm.runInNewContext(source, browser);
  assert.equal(typeof browser.ActivityStarMap.summarize, 'function');
  assert.equal(typeof browser.ActivityStarMap.render, 'function');
  let amd;
  const define = (dependencies, factory) => { assert.equal(dependencies.length, 0); amd = factory(); };
  define.amd = {};
  vm.runInNewContext(source, { define });
  assert.equal(typeof amd.summarize, 'function');
});

test('DST transitions and UTC date boundaries use local calendar dates in isolated time zones', () => {
  const modulePath = JSON.stringify(path.join(__dirname, 'src/activity.js'));
  const script = `
    const assert = require('node:assert/strict');
    const activity = require(${modulePath});
    const key = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    for (const now of [new Date(2024,2,11,0), new Date(2024,10,4,0), new Date(2024,2,10,23), new Date(2024,10,3,23)]) {
      const result = activity.summarize([], now);
      assert.equal(result.end, key(now));
      assert.equal(result.days365.length, 365);
      assert.equal(new Set(result.days365.map(row => row.day)).size, 365);
      let cursor = new Date(now); cursor.setHours(12,0,0,0); cursor.setDate(cursor.getDate()-364);
      for (const row of result.days365) { assert.equal(row.day, key(cursor)); cursor.setDate(cursor.getDate()+1); }
      assert.equal(result.days365.at(-1).day, key(now));
    }
    if (process.env.TZ === 'America/New_York') {
      assert.notEqual(new Date(2024,2,9,12).getTimezoneOffset(), new Date(2024,2,11,12).getTimezoneOffset());
      assert.notEqual(new Date(2024,10,2,12).getTimezoneOffset(), new Date(2024,10,4,12).getTimezoneOffset());
      assert.equal(activity.summarize([], new Date('2024-03-11T02:00:00Z')).end, '2024-03-10');
    }
    if (process.env.TZ === 'Asia/Shanghai') {
      assert.equal(activity.summarize([], new Date('2024-03-10T16:01:00Z')).end, '2024-03-11');
    }
  `;
  for (const timezone of ['America/New_York', 'Europe/Berlin', 'Asia/Shanghai', 'UTC']) {
    const child = spawnSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: timezone }, encoding: 'utf8' });
    assert.equal(child.status, 0, `${timezone}: ${child.error || child.stderr || child.stdout}`);
  }
});
