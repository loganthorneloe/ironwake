import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, testPlatform, setInput, step } from '../dist/core.js';
const target = (id, x, y, altitude = 0) => ({
  id,
  type: 'target',
  training: true,
  x,
  y,
  altitude,
  hp: 2000,
  max: 2000,
  stun: 0,
  r: 12,
});
const make = (weapon = 'blade') => {
  const w = newWorld(testPlatform(), [
    { id: 'p', build: { equipment: [weapon, 'carbine', 'emp'], parts: { booster: 'heavy' } } },
  ]);
  w.players[0].x = w.players[0].y = 0;
  return w;
};
const tick = (w, input = {}, n = 1) => {
  for (let i = 0; i < n; i++) {
    setInput(w, 'p', { angle: 0, ...input });
    step(w, 0.01);
  }
};
test('sword contact is stronger than its wide wave; the same swing never double-hits a close target', () => {
  const w = make();
  w.enemies = [
    target(1, 80, 0),
    target(2, 260, 60),
    target(3, 260, -60),
    target(4, 260, 150),
    target(5, -100, 0),
  ];
  tick(w, { left: true });
  tick(w, {}, 68);
  assert.equal(w.enemies[0].hp, 1820);
  assert.equal(w.enemies[1].hp, 1910);
  assert.equal(w.enemies[2].hp, 1910);
  assert.equal(w.enemies[3].hp, 2000);
  assert.equal(w.enemies[4].hp, 2000);
  assert.ok(w.damageEvents.some((e) => e.kind === 'bladeWave'));
});
test('wide sword wave and radial hammer slam cannot damage through solid cover', () => {
  for (const weapon of ['blade', 'hammer']) {
    const w = make(weapon);
    w.enemies = [target(1, 100, 0)];
    w.mission.obstacles = [{ x: 55, y: -100, w: 20, h: 200, height: 160 }];
    tick(w, { left: true });
    tick(w, {}, 70);
    assert.equal(w.enemies[0].hp, 2000, weapon);
  }
});
test('plasma sledgehammer hits all directions, staggers and has finite radius', () => {
  const w = make('hammer');
  w.enemies = [
    target(1, 80, 0),
    target(2, -150, 0),
    target(3, 0, 150),
    target(4, 0, -150),
    target(5, 260, 0),
  ];
  tick(w, { left: true });
  tick(w, {}, 60);
  assert.equal(w.enemies[0].hp, 1700);
  assert.ok(w.enemies.slice(1, 4).every((e) => e.hp < 2000 && e.stun > 0));
  assert.equal(w.enemies[4].hp, 2000);
  assert.ok(w.effects.some((e) => e.kind === 'plasmaSlam'));
});
test('airborne hammer dives and waits for ground contact before applying the slam', () => {
  const w = make('hammer'),
    p = w.players[0];
  p.altitude = 230;
  w.enemies = [target(1, 80, 0)];
  tick(w, { left: true, fly: true });
  tick(w, { fly: true }, 60);
  assert.equal(w.enemies[0].hp, 2000);
  assert.equal(p.hands[0].slamDiving, true);
  tick(w, {}, 50);
  assert.ok(p.altitude < 8);
  assert.ok(w.enemies[0].hp < 2000);
  assert.equal(p.hands[0].meleeImpactCount, 1);
});
