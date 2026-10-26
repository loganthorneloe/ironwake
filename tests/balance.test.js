import test from 'node:test';
import assert from 'node:assert/strict';
import { measure } from '../scripts/weapon-balance.mjs';
import { WEAPONS, newWorld, testPlatform, setInput, step } from '../dist/core.js';
test('sustained damage stays in the shared balance band at 60, 30 and 20Hz', () => {
  for (const [id, g] of Object.entries(WEAPONS)) {
    if (g.guard) continue;
    const values = [1 / 60, 1 / 30, 0.05].map((dt) => measure(id, 80, dt));
    for (const d of values)
      assert.ok(
        d >= (id === 'phaser' ? 180 : 175) && d <= (g.melee ? 250 : 290),
        `${id}: ${d} DPS`,
      );
    assert.ok(Math.max(...values) - Math.min(...values) <= 16.01, `${id}: frame-rate dependence`);
  }
});
test('range and utility differentiate weapons without hidden stun damage boosts', () => {
  assert.ok(measure('scatter', 400) > measure('scatter') * 0.5);
  assert.ok(measure('scatter', 400) < measure('scatter') * 0.65);
  assert.equal(measure('claws', 400), 0);
  assert.equal(measure('flamer', 400), 0);
  assert.ok(measure('blade', 400) > 100 && measure('blade', 400) < 125);
  for (const id of ['carbine', 'plasma', 'lance', 'phaser'])
    assert.equal(measure(id, 80, 1 / 60, 100), measure(id));
  assert.ok(WEAPONS.plasma.rate <= WEAPONS.launcher.rate / 2);
  assert.ok(WEAPONS.plasma.speed > WEAPONS.launcher.speed);
});
test('claw sustain is once per connected swing, with no healing on misses', () => {
  for (const count of [0, 1, 5]) {
    const w = newWorld(testPlatform(), [
        { id: 'p', build: { equipment: ['claws', 'guard', 'emp'] } },
      ]),
      p = w.players[0];
    p.x = p.y = 0;
    p.hp = 50;
    w.enemies = Array.from({ length: count }, (_, id) => ({
      id,
      type: 'target',
      training: true,
      x: 85,
      y: id * 3,
      hp: 2000,
      max: 2000,
      r: 10,
      stun: 0,
    }));
    for (let i = 0; i < 10; i++) {
      setInput(w, 'p', { left: i === 0, angle: 0 });
      step(w, 0.01);
    }
    assert.equal(p.hp, count ? 53 : 50);
    assert.ok(w.enemies.every((e) => e.hp === 1946));
  }
});
test('lance reaches beyond other direct melee and briefly interrupts; scythe pulls without crossing walls', () => {
  for (const id of ['lance', 'scythe']) {
    const w = newWorld(testPlatform(), [
        { id: 'p', build: { equipment: [id, 'guard', 'emp'], parts: { booster: 'heavy' } } },
      ]),
      p = w.players[0];
    p.x = p.y = 0;
    const e = {
      id: 1,
      type: 'gunner',
      x: 180,
      y: 0,
      hp: 2000,
      max: 2000,
      r: 10,
      stun: 0,
      windup: 0.8,
      cd: 99,
      speed: 0,
    };
    w.enemies = [e];
    for (let i = 0; i < 43; i++) {
      setInput(w, 'p', { left: i === 0, angle: 0 });
      step(w, 0.01);
    }
    assert.ok(e.hp < 2000);
    if (id === 'lance') {
      assert.equal(e.windup, 0);
      assert.ok(e.stun > 0 && e.stun <= 0.4);
    } else assert.ok(e.x <= 110.01);
  }
});
test('continuous dual plasma cannot permanently stagger-lock an enemy', () => {
  const w = newWorld(testPlatform(), [
      { id: 'p', build: { equipment: ['plasma', 'plasma', 'emp'], parts: { booster: 'heavy' } } },
    ]),
    p = w.players[0];
  p.x = p.y = 0;
  w.enemies = [
    {
      id: 1,
      type: 'gunner',
      x: 200,
      y: 0,
      hp: 1e6,
      max: 1e6,
      r: 22,
      stun: 0,
      windup: 0,
      cd: 0,
      speed: 0,
    },
  ];
  let retaliated = false;
  for (let i = 0; i < 600; i++) {
    p.hp = 125;
    setInput(w, 'p', { left: true, right: true, angle: 0, aimPoint: { x: 200, y: 0, z: 32 } });
    step(w, 0.02);
    retaliated ||= w.bullets.some((b) => b.enemy) || p.hp < 125;
  }
  assert.ok(retaliated);
});
