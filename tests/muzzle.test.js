import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newWorld,
  testPlatform,
  setInput,
  step,
  RANGED,
  cleanBuild,
  snapshot,
} from '../dist/core.js';
import { muzzleOrigin, correctedProjectile, launchCorrection } from '../dist/weapon-origin.js';
const make = (weapon) =>
  newWorld(testPlatform(), [{ id: 'p', build: { weapon, parts: { booster: 'heavy' } } }]);
test('every gun launches from its barrel, with replicated origin and finite flight direction', () => {
  for (const weapon of Object.keys(RANGED)) {
    const w = make(weapon),
      p = w.players[0];
    w.enemies = [];
    const ticks = weapon === 'rail' ? Math.round(RANGED.rail.charge / 0.01) : 1;
    for (let i = 0; i < ticks; i++) {
      setInput(w, 'p', { fire: true, angle: 0, pitch: 0.2 });
      step(w, 0.01);
    }
    const expected = muzzleOrigin(p);
    assert.ok(Math.abs(expected.y - p.y) > 10, weapon + ' must be out at the arm, not the chest');
    if (weapon === 'phaser' || weapon === 'flamer') {
      assert.deepEqual((p.beam || p.flame).origin, expected);
      continue;
    }
    const bullet = w.bullets[0];
    assert.deepEqual(bullet.origin, expected, weapon);
    assert.ok(Number.isFinite(bullet.vx + bullet.vy + bullet.vz));
    assert.deepEqual(snapshot(w, false).bullets[0].origin, expected);
  }
});
test('barrel origin respects arm scale, chassis width, heading and elevation', () => {
  const light = {
      x: 12,
      y: 18,
      altitude: 0,
      angle: 0,
      build: cleanBuild({ frame: 'scout', weapon: 'rail' }),
    },
    heavy = { ...light, build: cleanBuild({ frame: 'bulwark', weapon: 'rail' }) };
  const a = muzzleOrigin(light),
    b = muzzleOrigin(heavy);
  assert.notEqual(a.y, b.y);
  const high = muzzleOrigin({ ...heavy, altitude: 125 });
  assert.ok(Math.abs(high.z - b.z - 125) < 1e-8);
  const turn = muzzleOrigin({ ...heavy, angle: Math.PI });
  assert.ok(Math.abs(turn.x - heavy.x + (b.x - heavy.x)) < 1e-8);
  assert.ok(Math.abs(turn.y - heavy.y + (b.y - heavy.y)) < 1e-8);
});
test('crosshair target remains hittable from an offset muzzle while aiming and boosting', () => {
  for (const weapon of ['carbine', 'phaser', 'rail']) {
    const w = make(weapon),
      p = w.players[0];
    p.x = p.y = 0;
    const target = w.enemies[0];
    Object.assign(target, { x: 320, y: 0, r: 8 });
    w.enemies = [target];
    for (let i = 0; i < 120; i++) {
      setInput(w, 'p', {
        fire: true,
        x: 0.1,
        aiming: true,
        angle: Math.atan2(-p.y, 320 - p.x),
        aimPoint: { x: 320, y: 0, z: 32 },
      });
      step(w, 0.01);
    }
    assert.ok(target.hp < target.max, weapon);
  }
});
test('a barrel intersecting cover cannot spawn projectiles or a beam through it', () => {
  for (const weapon of ['carbine', 'phaser', 'launcher']) {
    const w = make(weapon),
      p = w.players[0];
    p.x = p.y = 0;
    w.enemies = [
      {
        id: 'dummy',
        type: 'target',
        training: true,
        x: 100,
        y: 0,
        hp: 1000,
        max: 1000,
        r: 22,
        stun: 0,
      },
    ];
    w.mission.obstacles = [{ x: 10, y: -50, w: 5, h: 100, height: 100 }];
    setInput(w, 'p', { fire: true, angle: 0, aimPoint: { x: 100, y: 0, z: 32 } });
    step(w, 0.01);
    assert.equal(w.enemies[0].hp, 1000, weapon);
    if (weapon === 'phaser') assert.equal(p.beam.blocked, true);
    else assert.equal(w.bullets.length, 0);
  }
});
test('visual launch offset freezes, converges to collision path, and is independent of later gun motion', () => {
  const bullet = { origin: { x: 10, y: 20, z: 30 }, x: 10, y: 20, z: 30 },
    muzzle = { x: 14, y: 25, z: 32 },
    offset = launchCorrection(muzzle, bullet);
  assert.deepEqual(correctedProjectile(bullet, offset), muzzle);
  muzzle.x = 500;
  assert.deepEqual(correctedProjectile(bullet, offset), { x: 14, y: 25, z: 32 });
  const distant = { ...bullet, x: 300 };
  assert.deepEqual(correctedProjectile(distant, offset), { x: 300, y: 20, z: 30 });
});
