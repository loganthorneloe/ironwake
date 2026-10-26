import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, testPlatform, setInput, step, snapshot, mechStats } from '../dist/core.js';
import { muzzleOrigin } from '../dist/weapon-origin.js';
const make = () => {
  const w = newWorld(testPlatform(), [
    { id: 'p', build: { weapon: 'flamer', melee: 'guard', parts: { booster: 'heavy' } } },
  ]);
  w.players[0].x = w.players[0].y = w.players[0].angle = 0;
  w.enemies = [];
  return w;
};
function shot(direction, guard = true, z = 30) {
  const w = make(),
    p = w.players[0],
    hp = p.hp;
  setInput(w, 'p', { angle: 0, left: guard });
  w.bullets = [
    {
      x: Math.cos(direction) * 38,
      y: Math.sin(direction) * 38,
      z,
      vx: -Math.cos(direction) * 300,
      vy: -Math.sin(direction) * 300,
      vz: 0,
      life: 1,
      enemy: true,
      damage: 30,
    },
  ];
  step(w, 0.04);
  step(w, 0.04);
  return { w, p, loss: hp - p.hp };
}
test('held shield protects 54 percent of frontal height and replicates impacts', () => {
  const front = shot(0),
    bare = shot(0, false);
  assert.ok(front.loss > 0);
  assert.ok(Math.abs(front.loss - bare.loss * 0.2) < 1e-8);
  for (const direction of [-Math.PI / 2, Math.PI / 2, Math.PI])
    assert.equal(shot(direction).loss, bare.loss);
  for (const z of [8, 54]) assert.equal(shot(0, true, z).loss, bare.loss);
  assert.equal(snapshot(front.w).players[0].guarding, true);
  assert.ok(front.p.guardHitTime > 0);
});
test('held shield permits the other hand and full movement, releases immediately, and drops on stale input', () => {
  const w = make(),
    p = w.players[0];
  setInput(w, 'p', { left: true, right: true, x: 1 });
  step(w, 0.05);
  assert.ok(p.shotCount > 0);
  assert.ok(p.flame);
  assert.equal(p.meleeTime, 0);
  assert.ok(Math.abs(p.x - mechStats(p.build).speed * mechStats(p.build).boost * 0.05) < 1e-7);
  assert.equal(p.guarding, true);
  setInput(w, 'p', {});
  step(w, 0.05);
  assert.equal(p.guarding, false);
  setInput(w, 'p', { left: true });
  step(w, 0.05);
  assert.equal(p.guarding, true);
  for (let i = 0; i < 16; i++) step(w, 0.05);
  assert.equal(p.guarding, false);
  setInput(w, 'p', { left: true });
  p.hp = 0;
  step(w, 0.05);
  assert.equal(p.guarding, false);
});
test('every ranged weapon remains usable with a held shield in either hand', () => {
  for (const weapon of [
    'carbine',
    'launcher',
    'rail',
    'plasma',
    'rotary',
    'scatter',
    'phaser',
    'flamer',
  ])
    for (const reverse of [false, true]) {
      const w = make(),
        p = w.players[0];
      p.build.equipment = reverse ? [weapon, 'guard', 'emp'] : ['guard', weapon, 'emp'];
      for (let i = 0; i < 125; i++) {
        setInput(w, p.id, { left: true, right: true, angle: 0 });
        step(w, 0.01);
      }
      assert.ok(p.shotCount > 0, weapon + ' fires');
      assert.equal(p.guarding, true);
    }
});
test('flamethrower damages multiple close targets rapidly, with range/cone limits and cover occlusion', () => {
  const w = make(),
    p = w.players[0],
    origin = muzzleOrigin(p);
  const target = (id, x, y, z = origin.z - 30) => ({
    id,
    type: 'target',
    training: true,
    x: origin.x + x,
    y: origin.y + y,
    altitude: z,
    hp: 2000,
    max: 2000,
    stun: 0,
    r: 10,
  });
  w.enemies = [
    target(1, 60, 0),
    target(2, 100, 12),
    target(3, 200, 0),
    target(4, -30, 0),
    target(5, 50, 90),
  ];
  for (let i = 0; i < 100; i++) {
    setInput(w, 'p', { fire: true, angle: 0 });
    step(w, 0.01);
  }
  assert.ok(2000 - w.enemies[0].hp >= 235);
  assert.ok(w.enemies[1].hp < 2000);
  assert.ok(w.enemies.slice(2).every((e) => e.hp === 2000));
  assert.ok(w.damageEvents.every((e) => ['flamer', 'burn'].includes(e.kind) && e.amount > 0));
  assert.ok(snapshot(w).players[0].flame.length > 0);
  const hp = w.enemies.map((e) => e.hp);
  w.mission.obstacles = [{ x: origin.x + 10, y: origin.y - 100, w: 10, h: 200, height: 150 }];
  w.damageEvents = [];
  for (let i = 0; i < 30; i++) {
    setInput(w, 'p', { fire: true, angle: 0 });
    step(w, 0.01);
  }
  assert.ok(w.damageEvents.every((e) => e.kind === 'burn'));
  assert.ok(w.enemies[0].hp < hp[0]);
  assert.deepEqual(
    w.enemies.slice(2).map((e) => e.hp),
    hp.slice(2),
  );
  assert.ok(p.flame.length < 30);
  for (let i = 0; i < 180; i++) {
    setInput(w, 'p', { fire: true, angle: 0 });
    step(w, 0.01);
  }
  const settled = w.enemies.map((e) => e.hp);
  for (let i = 0; i < 100; i++) {
    setInput(w, 'p', { fire: true, angle: 0 });
    step(w, 0.01);
  }
  assert.deepEqual(
    w.enemies.map((e) => e.hp),
    settled,
  );
  setInput(w, 'p', {});
  step(w, 0.01);
  assert.equal(p.flame, null);
});
test('smaller Bulwark leaves newly exposed edges unprotected', async () => {
  const { blocksBullet, BULWARK } = await import('../dist/bulwark.js');
  const p = { x: 0, y: 0, altitude: 0, angle: 0, hp: 100, guarding: true },
    b = { x: 25, y: 0, z: 30.6, vx: -300, vy: 0 };
  assert.equal(BULWARK.scale, 0.9);
  assert.ok(Math.abs((BULWARK.top - BULWARK.bottom) / 62 - 0.54) < 1e-9);
  assert.equal(blocksBullet(p, b), true);
  for (const outside of [
    { ...b, z: 13 },
    { ...b, z: 48 },
    { ...b, y: 22 },
  ])
    assert.equal(blocksBullet(p, outside), false);
});
