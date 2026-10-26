import test from 'node:test';
import assert from 'node:assert/strict';
import {
  testPlatform,
  newWorld,
  DEFAULT_BUILD,
  setInput,
  step,
  snapshot,
  WEAPONS,
} from '../dist/core.js';
test('test platform has no encounters, extraction, or horizontal edges', () => {
  const w = newWorld(testPlatform(), [{ id: 'p', build: DEFAULT_BUILD }]),
    p = w.players[0];
  for (const [x, y] of [
    [-50000, -50000],
    [50000, 50000],
  ]) {
    p.x = x;
    p.y = y;
    setInput(w, 'p', { x: 1, y: -1, sprint: true });
    step(w, 0.05);
    assert.ok(p.x > x);
    assert.ok(p.y < y);
  }
  p.x = 0;
  p.y = 0;
  for (let i = 0; i < 6000; i++) step(w, 0.05);
  assert.equal(w.status, 'playing');
  assert.equal(w.extractTime, 0);
  assert.equal(w.encounter, false);
  assert.equal(w.enemies.length, 6);
  assert.ok(w.enemies.every((e) => e.training));
  assert.equal(w.spawn.length, 0);
  assert.equal(w.hazards.length, 0);
  assert.equal(p.hp, 125);
  const remote = JSON.parse(JSON.stringify(snapshot(w)));
  assert.equal(remote.mission.mode, 'sandbox');
  assert.equal(remote.players[0].x, p.x);
});
test('each mech has independently activated ranged and melee weapons on the test deck', () => {
  for (const melee of ['blade', 'lance', 'hammer', 'claws', 'scythe']) {
    const w = newWorld(testPlatform(), [{ id: 'p', build: { ...DEFAULT_BUILD, melee } }]),
      p = w.players[0];
    setInput(w, 'p', { fire: true, angle: 0 });
    step(w, 0.01);
    assert.equal(p.shotCount, 1);
    assert.equal(p.meleeCount, 0);
    setInput(w, 'p', { melee: true, angle: 0 });
    step(w, 0.01);
    assert.equal(p.meleeCount, 1);
    assert.ok(p.shot > 0);
    assert.ok(p.meleeTime > 0);
    assert.ok(w.bullets.length > 0);
    assert.equal(w.status, 'playing');
  }
});
