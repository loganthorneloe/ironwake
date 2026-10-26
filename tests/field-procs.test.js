import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, testPlatform, step, setInput } from '../dist/core.js';
import { initSortie } from '../dist/sortie-progression.js';

const target = (id, x = 200, y = 0) => ({
  id,
  type: 'target',
  training: true,
  x,
  y,
  altitude: 0,
  hp: 1000000,
  max: 1000000,
  r: 22,
  stun: 0,
});
const make = (team = 1) => {
  const w = newWorld(
    testPlatform(),
    Array.from({ length: team }, (_, i) => ({
      id: 'p' + i,
      build: { equipment: ['carbine', 'guard', 'emp'], parts: { booster: 'heavy' } },
    })),
  );
  initSortie(w);
  w.field.nodes = [];
  w.enemies = [target('a'), target('b', 240, 80), target('c', 270, 100)];
  Object.assign(w.players[0], { x: 0, y: 0, altitude: 0 });
  if (team > 1) Object.assign(w.players[1], { x: 1500, y: 1500, altitude: 0 });
  return w;
};
function inject(w, e = w.enemies[0], damage = 24, owner = 'p0') {
  w.bullets.push({
    id: w.id++,
    kind: 'carbine',
    owner,
    origin: { x: 0, y: 0, z: 32 },
    x: e.x - 3,
    y: e.y,
    z: 32,
    vx: 100,
    vy: 0,
    vz: 0,
    life: 0.1,
    damage,
    enemy: false,
    pierce: 1,
    hit: [],
  });
}
const tick = (w, seconds = 0.01) => {
  for (let i = 0; i < Math.round(seconds / 0.01); i++) step(w, 0.01);
};
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, actual + ' != ' + expected);

test('arc procs damage one visible neighbor, cannot recurse and share a pilot cooldown across simultaneous hits', () => {
  const w = make(),
    p = w.players[0];
  p.field.upgrades = ['conductor', 'conductor', 'conductor'];
  p.field.items = ['relaycoil', 'relaycoil', 'relaycoil'];
  p.field.buffs = [{ relayId: 'storm', expiresAt: 999 }];
  w.seed = 1;
  for (let i = 0; i < 8; i++) inject(w, w.enemies[0], 1000);
  tick(w);
  near(1000000 - w.enemies[1].hp, 120);
  assert.equal(w.enemies[2].hp, 1000000);
  assert.ok(p.field.chainAt > w.time);
  w.seed = 1;
  inject(w, w.enemies[0], 1000);
  tick(w);
  near(1000000 - w.enemies[1].hp, 120, 'cooldown blocks a second proc');
  tick(w, 0.4);
  w.seed = 1;
  inject(w, w.enemies[0], 1000);
  tick(w);
  near(1000000 - w.enemies[1].hp, 240);
});

test('arc propagation respects intervening solid cover even when the initial projectile hits', () => {
  const w = make(),
    p = w.players[0];
  p.field.upgrades = ['conductor', 'conductor', 'conductor'];
  p.field.items = ['relaycoil', 'relaycoil', 'relaycoil'];
  p.field.buffs = [{ relayId: 'storm', expiresAt: 999 }];
  w.seed = 1;
  w.mission.obstacles = [{ x: 180, y: 35, w: 200, h: 20, height: 200 }];
  inject(w, w.enemies[0], 1000);
  tick(w);
  assert.equal(w.enemies[0].hp, 999000);
  assert.equal(w.enemies[1].hp, 1000000);
  assert.equal(w.enemies[2].hp, 1000000);
});

test('ignition from a non-flame weapon has one finite burn and scales burn damage without recursive ignition', () => {
  const w = make(),
    p = w.players[0],
    e = w.enemies[0];
  p.field.upgrades = ['thermal', 'thermal', 'thermal'];
  p.field.items = ['igniter', 'igniter', 'igniter'];
  p.field.buffs = [{ relayId: 'inferno', expiresAt: 999 }];
  w.seed = 1;
  inject(w);
  tick(w);
  assert.ok(e.burnUntil > w.time + 1.9);
  assert.equal(e.burnOwner, p.id);
  const afterHit = e.hp;
  tick(w, 2.2);
  near(afterHit - e.hp, 8 * 6 * (1 + 0.6 + 0.75 + 0.6));
  assert.equal(e.burnUntil, 0);
  assert.equal(e.burnNext, null);
  assert.equal(w.enemies[1].hp, 1000000);
  const afterBurn = e.hp;
  tick(w, 1);
  assert.equal(e.hp, afterBurn);
});

test('native flame preserves a longer ignition applied by field hardware during the same hit', () => {
  const w = make(),
    p = w.players[0],
    e = w.enemies[0];
  p.build.equipment = ['flamer', 'guard', 'emp'];
  p.field.upgrades = ['thermal', 'thermal', 'thermal'];
  p.field.items = ['igniter', 'igniter', 'igniter'];
  e.x = 80;
  w.seed = 1;
  setInput(w, p.id, { left: true, angle: 0, aimPoint: { x: 80, y: 0, z: 32 } });
  tick(w);
  assert.ok(
    e.burnUntil >= w.time + 1.99,
    'a two-second field ignition must survive native 1.25-second flame refresh',
  );
});

test('lifesteal is bounded across simultaneous high-damage hits and replenishes by elapsed simulation time', () => {
  const w = make(),
    p = w.players[0];
  p.field.upgrades = ['siphon', 'siphon', 'siphon'];
  p.field.buffs = [{ relayId: 'siphon', expiresAt: 999 }];
  p.hp = 20;
  p.field.leechTick = 0;
  w.time = 1;
  for (let i = 0; i < 100; i++) inject(w, w.enemies[0], 1000);
  tick(w);
  near(p.hp, 44);
  assert.ok(p.field.leechBudget >= 0);
  tick(w, 0.5);
  inject(w, w.enemies[0], 1000);
  tick(w);
  near(p.hp, 44 + 0.51 * 24);
  assert.ok(p.hp <= p.field.maxHull);
});

test('lingering projectiles and their burn cannot resurrect a downed owner through repair procs', () => {
  const w = make(2),
    p = w.players[0];
  p.field.upgrades = ['siphon', 'siphon', 'siphon', 'thermal', 'thermal', 'thermal'];
  p.field.items = ['bloodpump', 'bloodpump', 'bloodpump', 'igniter', 'igniter', 'igniter'];
  p.field.buffs = [
    { relayId: 'inferno', expiresAt: 999 },
    { relayId: 'siphon', expiresAt: 999 },
  ];
  p.hp = 0;
  w.seed = 1;
  w.enemies[0].hp = 30;
  inject(w, w.enemies[0], 24);
  tick(w);
  assert.equal(p.hp, 0);
  tick(w, 0.5);
  assert.equal(w.enemies[0].hp, 0);
  assert.equal(p.hp, 0);
  assert.equal(w.status, 'playing');
});

test('retaliation requires actual incoming damage and cannot cross solid cover or repeatedly trigger during recovery', () => {
  const w = make(),
    p = w.players[0];
  w.enemies = [target('near', 100), target('far', 350)];
  p.field.items = ['mirror', 'mirror', 'mirror'];
  const hit = () => {
    w.bullets.push({
      id: w.id++,
      x: 5,
      y: 0,
      z: 32,
      vx: -100,
      vy: 0,
      vz: 0,
      life: 0.1,
      damage: 10,
      enemy: true,
    });
    tick(w);
  };
  hit();
  near(1000000 - w.enemies[0].hp, 36);
  assert.equal(w.enemies[1].hp, 1000000);
  hit();
  near(1000000 - w.enemies[0].hp, 36);
  tick(w, 0.31);
  w.mission.obstacles = [{ x: 40, y: -100, w: 10, h: 200, height: 150 }];
  hit();
  near(1000000 - w.enemies[0].hp, 36);
});

test('relay buffs expire before damage resolves at the same authoritative timestamp', () => {
  const w = make(),
    p = w.players[0],
    e = w.enemies[0];
  p.field.buffs = [{ relayId: 'assault', expiresAt: 0.01 }];
  setInput(w, p.id, { angle: 0 });
  inject(w);
  tick(w);
  near(1000000 - e.hp, 24);
  assert.equal(p.field.buffs.length, 0);
});
