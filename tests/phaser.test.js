import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newWorld,
  testPlatform,
  setInput,
  step,
  mechStats,
  snapshot,
  cleanBuild,
  partsFor,
} from '../dist/core.js';
const make = () => {
  const w = newWorld(testPlatform(), [
      { id: 'p', build: { equipment: ['phaser', 'carbine', 'blade', 'emp'] } },
    ]),
    p = w.players[0];
  p.x = 0;
  p.y = 0;
  p.hp = 50;
  w.enemies = [
    {
      id: 'dummy',
      type: 'target',
      training: true,
      x: 120,
      y: 0,
      altitude: 0,
      hp: 1000,
      max: 1000,
      r: 22,
      stun: 0,
    },
  ];
  return w;
};
const tick = (w, input = { fire: true, angle: 0 }, dt = 0.05) => {
  setInput(w, 'p', input);
  step(w, dt);
};
test('phaser applies faster repeated damage in repeated ticks and heals 12.5 percent with replicated beam and damage numbers', () => {
  const w = make(),
    p = w.players[0];
  for (let i = 0; i < 20; i++) tick(w);
  assert.equal(w.enemies[0].hp, 808);
  assert.equal(p.hp, 74);
  assert.equal(w.bullets.length, 0);
  assert.equal(p.beam.hit, true);
  assert.equal(snapshot(w, false).players[0].beam.hit, true);
  assert.ok(w.damageEvents.every((e) => e.kind === 'phaser' && e.amount === 16));
});
test('phaser stops at cover, cannot leech misses, and ends when its hand is released', () => {
  const w = make(),
    p = w.players[0];
  w.mission.obstacles = [{ x: 60, y: -30, w: 10, h: 60, height: 100 }];
  tick(w);
  assert.equal(p.hp, 50);
  assert.equal(w.enemies[0].hp, 1000);
  assert.equal(p.beam.hit, false);
  assert.ok(p.beam.x <= 60);
  w.mission.obstacles = [];
  tick(w, { fire: true, angle: Math.PI });
  assert.equal(p.hp, 50);
  tick(w, {});
  assert.equal(p.beam, null);
  tick(w, { left: true, right: false });
  assert.equal(p.beam, null);
});
test('phaser healing caps at assembled armor and uses actual damage without overkill', () => {
  const w = make(),
    p = w.players[0];
  w.enemies[0].hp = 2;
  tick(w);
  assert.equal(p.hp, 50.25);
  tick(w);
  assert.equal(p.hp, 50.25);
  const v = make(),
    q = v.players[0];
  q.hp = mechStats(q.build).hp - 1;
  tick(v);
  assert.equal(q.hp, mechStats(q.build).hp);
});
test('phaser respects vertical aim, stale input and death', () => {
  for (const mode of ['aim', 'stale', 'death']) {
    const w = make(),
      p = w.players[0];
    if (mode === 'death') p.hp = 0;
    if (mode === 'stale') {
      setInput(w, 'p', { fire: true });
      w.time = 2;
      step(w, 0.05);
    } else tick(w, { fire: true, pitch: mode === 'aim' ? 1 : 0 });
    assert.equal(w.enemies[0].hp, 1000, mode);
    if (mode !== 'aim') assert.equal(p.beam ?? null, null);
  }
});
test('all boosters sustain flight indefinitely; lightweight boosters produce faster lift and translation', () => {
  const speeds = [];
  for (const booster of ['light', 'standard', 'heavy']) {
    const build = cleanBuild({
        frame: 'scout',
        parts: { ...partsFor({ frame: 'scout' }), booster },
      }),
      w = newWorld(testPlatform(), [{ id: 'p', build }]),
      p = w.players[0];
    p.energy = 0;
    for (let i = 0; i < 2000; i++) tick(w, { fly: true, x: 1 });
    assert.equal(p.airborne, true);
    assert.equal(p.altitude, 240);
    assert.equal(p.energy, 0);
    const f = mechStats(build);
    speeds.push([f.lift, f.speed * f.boost]);
  }
  assert.ok(speeds[0][0] > speeds[1][0] && speeds[1][0] > speeds[2][0]);
  assert.ok(speeds[0][1] > speeds[1][1] && speeds[1][1] > speeds[2][1]);
});
