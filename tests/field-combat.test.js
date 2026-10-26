import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, setInput, step, WEAPONS, mechStats, combatStats } from '../dist/core.js';
import { chassisBlueprint } from '../dist/chassis.js';
import { campaignRound } from '../dist/mission-catalog.js';
import {
  newCampaign,
  registerPilot,
  campaignMission,
  recordSortie,
  cleanCampaign,
  profileFor,
} from '../dist/campaign.js';
import {
  sortieReport,
  xpForLevel,
  fieldOffer,
  chooseFieldModule,
} from '../dist/sortie-progression.js';

const make = (weapon = 'carbine', upgrades = [], items = []) => {
  const w = newWorld(campaignRound('ashgate', 42), [
      {
        id: 'p',
        name: 'Pilot',
        build: { equipment: [weapon, 'guard', 'emp'], parts: { booster: 'heavy' } },
      },
    ]),
    p = w.players[0];
  // Use the real operation initializer, then isolate a clear test floor from encounter AI.
  w.operation = null;
  w.mission.mode = 'sandbox';
  w.mission.raid = false;
  w.mission.obstacles = [];
  w.mission.platforms = [];
  w.mission.ramps = [];
  w.field.nodes = [];
  w.enemies = [];
  w.spawn = [];
  p.x = p.y = p.altitude = 0;
  p.recoverUntil = 0;
  p.field.upgrades = upgrades;
  p.field.items = items;
  return w;
};
const tick = (w, input = {}, n = 1, dt = 0.01) => {
  for (let i = 0; i < n; i++) {
    setInput(w, 'p', input);
    step(w, dt);
  }
};
const target = (id = 'target', x = 150, hp = 10000) => ({
  id,
  type: 'target',
  training: true,
  x,
  y: 0,
  altitude: 0,
  hp,
  max: hp,
  r: 22,
  stun: 0,
});
const hit = (w, { damage = 20, kind = 'carbine', enemy = false, z = 32 } = {}) => {
  const e = w.enemies[0],
    p = w.players[0];
  w.bullets.push({
    id: w.id++,
    kind,
    owner: enemy ? null : p.id,
    enemy,
    x: enemy ? p.x : e.x - 3,
    y: enemy ? p.y : e.y,
    z,
    vx: enemy ? 0 : 100,
    vy: 0,
    vz: 0,
    life: 0.1,
    damage,
    pierce: 1,
    hit: [],
  });
  tick(w);
};
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} should equal ${b}`);

test('accelerator servos increase sustained carbine, charged rail and melee cycles in the actual simulation', () => {
  for (const weapon of ['carbine', 'rail', 'claws']) {
    const base = make(weapon),
      fast = make(weapon, ['servo', 'servo', 'servo']);
    tick(base, { left: true, angle: 0 }, 600);
    tick(fast, { left: true, angle: 0 }, 600);
    const read = (w) =>
      weapon === 'claws' ? w.players[0].hands[0].meleeCount : w.players[0].hands[0].shotCount;
    assert.ok(
      read(fast) > read(base),
      `${weapon}: ${read(fast)} upgraded cycles > ${read(base)} baseline`,
    );
    assert.equal(fast.players[0].hands[1].shotCount, 0);
  }
});

test('coil acceleration changes projectile velocity without changing its designed travel range', () => {
  const base = make(),
    fast = make('carbine', ['ballistics', 'ballistics']);
  tick(base, { left: true });
  tick(fast, { left: true });
  const a = base.bullets[0],
    b = fast.bullets[0],
    speed = (b) => Math.hypot(b.vx, b.vy, b.vz);
  near(speed(b) / speed(a), 1.4);
  assert.ok(b.life < a.life);
  near(speed(a) * (a.life + 0.01), WEAPONS.carbine.range);
  near(speed(b) * (b.life + 0.01), WEAPONS.carbine.range);
});

test('phaser native repair and field siphon both survive hand state synchronization and cap at upgraded hull', () => {
  const w = make('phaser', ['siphon', 'hull']),
    p = w.players[0];
  w.enemies = [target('a', 120)];
  p.hp = 50;
  p.field.leechBudget = 24;
  tick(w, { left: true, angle: 0, aimPoint: { x: 120, y: 0, z: 32 } });
  const dealt = 10000 - w.enemies[0].hp;
  assert.ok(dealt > 0);
  near(p.hp, 50 + dealt * (WEAPONS.phaser.leech + 0.015));
  near(combatStats(p).hp, mechStats(p.build).hp * 1.15);
  p.hp = combatStats(p).hp - 0.1;
  tick(w, { left: true, angle: 0, aimPoint: { x: 120, y: 0, z: 32 } }, 20);
  near(p.hp, combatStats(p).hp);
});

test('kill repair is awarded once for actual damage kills and lingering projectiles cannot revive a downed pilot', () => {
  const w = make('carbine', [], ['bloodpump']),
    p = w.players[0];
  p.hp = 50;
  w.enemies = [target('a', 120, 5)];
  hit(w);
  near(p.hp, 53);
  tick(w, {}, 10);
  near(p.hp, 53);
  const downed = make('carbine', ['siphon'], ['bloodpump']),
    q = downed.players[0];
  downed.enemies = [target('a', 120, 5)];
  q.hp = 0;
  q.field.leechBudget = 24;
  hit(downed);
  assert.equal(q.hp, 0);
  assert.equal(downed.status, 'lost');
});

test('reactive armor mitigates actual incoming projectile hits and ablative mirror returns bounded damage', () => {
  const base = make(),
    armored = make('carbine', ['plating', 'plating'], ['mirror']);
  base.enemies = [target('a', 120)];
  armored.enemies = [target('a', 120)];
  const before = base.players[0].hp,
    beforeArmor = armored.players[0].hp;
  hit(base, { enemy: true, damage: 40, z: 30 });
  hit(armored, { enemy: true, damage: 40, z: 30 });
  near(before - base.players[0].hp, 24);
  near(beforeArmor - armored.players[0].hp, 24 * 0.8);
  near(armored.enemies[0].max - armored.enemies[0].hp, 12);
  assert.equal(base.enemies[0].hp, base.enemies[0].max);
});

test('finisher and weakpoint hardware modify real projectile hits only under their combat conditions', () => {
  const healthy = make('carbine', ['execution'], ['lens']),
    weak = make('carbine', ['execution'], ['lens']);
  healthy.enemies = [target()];
  weak.enemies = [target()];
  weak.enemies[0].hp = 2000;
  // Disable chance-based criticals so this verifies the deterministic body/weakpoint conditions.
  healthy.players[0].field.items = [];
  weak.players[0].field.items = [];
  hit(healthy);
  hit(weak);
  near(10000 - healthy.enemies[0].hp, 20);
  near(2000 - weak.enemies[0].hp, 25);
  const plain = make(),
    optic = make('carbine', [], ['gyro']);
  plain.enemies = [target()];
  optic.enemies = [target()];
  hit(plain, { z: 50 });
  hit(optic, { z: 50 });
  near((10000 - optic.enemies[0].hp) / (10000 - plain.enemies[0].hp), 1.1);
});

test('campaign extraction persists sanitized tech and XP, restores unspent levels, and clears relay support', () => {
  let campaign = registerPilot(newCampaign(987), 'Pilot');
  const w = newWorld(campaignMission(campaign), [
      { id: 'p', name: 'Pilot', build: chassisBlueprint('vanguard') },
    ]),
    p = w.players[0];
  Object.assign(p.field, {
    upgrades: ['hull'],
    items: ['spall', 'gyro'],
    xp: xpForLevel(4),
    level: 4,
    pending: 2,
    relays: ['uplink'],
    buffs: [{ relayId: 'assault', expiresAt: 100 }],
    relayCount: 2,
  });
  const report = sortieReport(w, 'victory');
  campaign = recordSortie(campaign, 'victory', report);
  const saved = cleanCampaign(JSON.parse(JSON.stringify(campaign))),
    profile = profileFor(saved, 'Pilot');
  assert.deepEqual(profile.upgrades, ['hull']);
  assert.deepEqual(profile.items, ['spall', 'gyro']);
  assert.equal(profile.xp, xpForLevel(4));
  const next = newWorld(campaignMission(saved), [
      { id: 'p', name: 'Pilot', build: chassisBlueprint('vanguard') },
    ]),
    q = next.players[0];
  assert.equal(q.field.level, 4);
  assert.equal(q.field.pending, 2);
  assert.deepEqual(q.field.upgrades, ['hull']);
  assert.deepEqual(q.field.items, ['spall', 'gyro']);
  assert.deepEqual(q.field.buffs, []);
  assert.deepEqual(q.field.relays, []);
  assert.equal(q.field.relayCount, 0);
  near(q.hp, combatStats(q).hp);
  const offer = fieldOffer(next, q)[0];
  assert.ok(chooseFieldModule(next, q, { id: offer.id, revision: offer.revision }));
  assert.equal(q.field.pending, 1);
  const forged = cleanCampaign({
    ...saved,
    pilots: [
      {
        ...profile,
        upgrades: ['hull', 'hull', 'hull', 'hull', '__proto__'],
        items: ['aegis', 'aegis', 'aegis', 'invalid'],
      },
    ],
  });
  assert.deepEqual(forged.pilots[0].upgrades, ['hull', 'hull', 'hull']);
  assert.deepEqual(forged.pilots[0].items, ['aegis', 'aegis']);
});
