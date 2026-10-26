import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, step } from '../dist/core.js';
import { campaignRound } from '../dist/mission-catalog.js';
import { chassisBlueprint } from '../dist/chassis.js';

const setup = () => {
  const w = newWorld(campaignRound('ashgate', 42), [
    { id: 'p', build: chassisBlueprint('vanguard') },
  ]);
  // Keep the real simulation tick while isolating collection from encounters and movement.
  w.operation = null;
  w.mission.mode = 'sandbox';
  w.mission.raid = false;
  w.mission.obstacles = [];
  w.mission.platforms = [];
  w.mission.ramps = [];
  w.enemies = [];
  w.spawn = [];
  w.field.nodes = [];
  Object.assign(w.players[0], { x: 1200, y: 1900, altitude: 0, recoverUntil: 0 });
  return w;
};
const drop = (id, itemId, x, y) => ({
  id,
  itemId,
  kind: 'cache',
  drop: true,
  x,
  y,
  z: 0,
  state: 'ready',
  revision: 0,
  cost: 0,
  claimed: [],
});

test('stack-capped combat drop does not starve a later eligible drop across real ticks', () => {
  const w = setup(),
    p = w.players[0];
  p.field.items = ['ferrite', 'ferrite', 'ferrite', 'gyro', 'gyro', 'gyro'];
  const capped = drop('capped', 'gyro', p.x + 50, p.y),
    eligible = drop('eligible', 'lens', p.x + 200, p.y);
  w.field.nodes = [capped, eligible];
  assert.equal(Math.hypot(capped.x - eligible.x, capped.y - eligible.y), 150);
  for (let i = 0; i < 100; i++) step(w, 0.01);
  assert.equal(capped.state, 'ready');
  assert.equal(capped.revision, 0);
  assert.deepEqual(capped.claimed, []);
  assert.equal(eligible.state, 'spent');
  assert.equal(eligible.revision, 1);
  assert.deepEqual(eligible.claimed, ['p']);
  assert.equal(p.field.items.filter((id) => id === 'gyro').length, 3);
  assert.equal(p.field.items.filter((id) => id === 'lens').length, 1);
});

test('obstructed combat drop does not starve a later visible drop across real ticks', () => {
  const w = setup(),
    p = w.players[0];
  p.field.items = ['ferrite', 'ferrite', 'ferrite'];
  w.mission.obstacles = [{ x: p.x + 20, y: p.y - 50, w: 10, h: 100, height: 100 }];
  const blocked = drop('blocked', 'gyro', p.x + 50, p.y),
    visible = drop('visible', 'lens', p.x, p.y + 200);
  w.field.nodes = [blocked, visible];
  for (let i = 0; i < 100; i++) step(w, 0.01);
  assert.equal(blocked.state, 'ready');
  assert.equal(blocked.revision, 0);
  assert.deepEqual(blocked.claimed, []);
  assert.equal(visible.state, 'spent');
  assert.equal(visible.revision, 1);
  assert.deepEqual(visible.claimed, ['p']);
  assert.deepEqual(p.field.items, ['ferrite', 'ferrite', 'ferrite', 'lens']);
  w.mission.obstacles = [];
  step(w, 0.01);
  assert.equal(blocked.state, 'spent');
  assert.equal(p.field.items.filter((id) => id === 'gyro').length, 1);
});
