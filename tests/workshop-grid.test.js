import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BUILD, cleanBuild, mechStats, validBuild } from '../dist/core.js';
import { SOCKETS, gridState, canFit, fitComponent } from '../dist/workshop-grid.js';
test('eight sockets account for every part and equipment load in the shared grid', () => {
  const b = cleanBuild(DEFAULT_BUILD),
    grid = gridState(b);
  assert.equal(SOCKETS.length, 8);
  assert.equal(
    grid.sockets.reduce((n, s) => n + s.weight, 0),
    grid.weight,
  );
  assert.equal(grid.capacity, mechStats(b).capacity);
  assert.equal(grid.sockets.filter((s) => s.kind === 'hand').length, 2);
});
test('fitting validates socket type and allows weapons in either hand without changing other slots', () => {
  const b = cleanBuild(DEFAULT_BUILD);
  for (const slot of ['equip0', 'equip1']) {
    const fitted = fitComponent(b, slot, { kind: 'hand', id: 'hammer' });
    assert.equal(fitted.equipment[Number(slot.slice(5))], 'hammer');
    assert.deepEqual(fitted.parts, b.parts);
  }
  for (const [slot, payload] of [
    ['torso', { kind: 'head', id: 'heavy' }],
    ['equip2', { kind: 'hand', id: 'rail' }],
    ['equip0', { kind: 'special', id: 'repair' }],
    ['head', { kind: 'head', id: 'missing' }],
    ['missing', { kind: 'hand', id: 'rail' }],
  ]) {
    assert.equal(canFit(slot, payload), false);
    assert.equal(fitComponent(b, slot, payload), null);
  }
  assert.equal(fitComponent(b, 'equip2', { kind: 'special', id: 'repair' }).equipment[2], 'repair');
});
test('overload is preserved for editing, disables power, and can be resolved with boosters', () => {
  let b = cleanBuild({
    ...DEFAULT_BUILD,
    parts: { torso: 'standard', head: 'heavy', arms: 'heavy', legs: 'heavy', booster: 'light' },
    equipment: ['flamer', 'launcher', 'repair'],
  });
  assert.equal(validBuild(b), false);
  assert.ok(gridState(b).weight > gridState(b).capacity);
  b = fitComponent(b, 'booster', { kind: 'booster', id: 'heavy' });
  assert.equal(validBuild(b), true);
  assert.equal(gridState(b).capacity, 110);
  assert.equal(b.equipment[0], 'flamer');
});
test('component fitting keeps part paint and exhaust color', () => {
  const b = cleanBuild(DEFAULT_BUILD),
    fitted = fitComponent(b, 'torso', { kind: 'torso', id: 'heavy' });
  assert.deepEqual(fitted.partColors, b.partColors);
  assert.equal(fitted.trailColor, b.trailColor);
  assert.equal(b.parts.torso, 'standard');
});

test('maximum armor and maximum weapons overload even the strongest boosters', () => {
  let b = cleanBuild({
    parts: { torso: 'heavy', head: 'heavy', arms: 'heavy', legs: 'heavy', booster: 'heavy' },
    equipment: ['flamer', 'flamer', 'repair'],
  });
  assert.equal(gridState(b).weight, 126);
  assert.equal(gridState(b).capacity, 110);
  assert.equal(validBuild(b), false);
  b = fitComponent(b, 'torso', { kind: 'torso', id: 'light' });
  assert.equal(validBuild(b), true);
  assert.equal(gridState(b).weight, 102);
});
