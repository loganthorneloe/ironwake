import test from 'node:test';
import assert from 'node:assert/strict';
import { chassisBlueprint } from '../dist/chassis.js';
import {
  cleanDeploymentProgression,
  progressionModifiers,
  treeFor,
} from '../dist/career-progression.js';
import {
  cleanBuild,
  mechStats,
  combatStats,
  statsForPlayer,
  newWorld,
  testPlatform,
  combatTrial,
  planetMission,
  step,
  setInput,
  snapshot,
} from '../dist/core.js';
import { campaignRound, MISSIONS } from '../dist/mission-catalog.js';
import { destructionMission } from '../dist/destruction-mission.js';

const trained = {
  mech: ['vanguard.role.1', 'vanguard.frame.1', 'vanguard.systems.1'],
  pilot: ['tactics.1', 'survival.1', 'systems.1'],
};
const certified = {
  mech: treeFor('mech', 'vanguard').branches.flatMap((b) => b.nodes.map((n) => n.id)),
  pilot: treeFor('pilot', 'Pilot').branches.flatMap((b) => b.nodes.map((n) => n.id)),
};
const close = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-7, `${message || 'value'}: ${actual} ≠ ${expected}`);
const make = (
  progression = trained,
  mission = testPlatform(),
  equipment = ['blade', 'carbine', 'emp'],
) => {
  const w = newWorld(mission, [
    { id: 'p', name: 'Pilot', build: { ...chassisBlueprint('vanguard'), equipment }, progression },
  ]);
  w.enemies = [];
  return w;
};
const tick = (w, input = {}, n = 1) => {
  for (let i = 0; i < n; i++) {
    setInput(w, 'p', { angle: 0, ...input });
    step(w, 0.01);
  }
};
const target = (type = 'target') => ({
  id: 'target',
  type,
  training: true,
  x: 80,
  y: 0,
  altitude: 0,
  hp: 2000,
  max: 2000,
  stun: 0,
  r: 12,
});

test('deployment sanitizes career ranks separately from equipment and snapshots retain their effects', () => {
  const dirty = {
      mech: ['vanguard.frame.1', 'vanguard.frame.3', 'lark.frame.1', 'unknown'],
      pilot: ['survival.1', 'survival.1', 'tactics.3'],
      modifiers: { hp: 999 },
    },
    original = structuredClone(dirty);
  const w = make(dirty),
    p = w.players[0],
    base = mechStats(p.build),
    remote = JSON.parse(JSON.stringify(snapshot(w))).players[0];
  assert.deepEqual(dirty, original);
  assert.deepEqual(p.progression, cleanDeploymentProgression(dirty, 'vanguard'));
  assert.deepEqual(
    p.build,
    cleanBuild({ ...chassisBlueprint('vanguard'), equipment: ['blade', 'carbine', 'emp'] }),
  );
  assert.equal(p.build.progression, undefined);
  assert.equal(p.progression.modifiers, undefined);
  close(p.hp, Math.round(base.hp * 1.07), 'spawn hull');
  assert.deepEqual(combatStats(remote), combatStats(p));
  close(newWorld(testPlatform(), [remote]).players[0].hp, p.hp, 'redeployed snapshot hull');
  assert.deepEqual(statsForPlayer(p.build), base);
  assert.deepEqual(statsForPlayer(p.build, p), combatStats(p));
  assert.equal(combatStats(p).capacity, base.capacity);
  assert.equal(combatStats(p).valid, base.valid);
  assert.deepEqual(mechStats(p.build), base);
  dirty.mech.push('vanguard.frame.2');
  setInput(w, 'p', { progression: certified, modifiers: { hp: 999 } });
  assert.deepEqual(p.progression, remote.progression);
  close(combatStats(p).hp, remote.hp, 'deployment cannot gain combat-time ranks');
});

test('persistent weapon damage works in practice and campaign, and run modules multiply it once', () => {
  for (const mission of [testPlatform(), combatTrial(), campaignRound(MISSIONS[0].id, 61)])
    for (const modules of [[], ['power', 'power', 'breaker']])
      for (const type of ['target', 'tank']) {
        const w = make(certified, mission),
          p = w.players[0];
        Object.assign(p, { ...mission.entry, altitude: 0 });
        p.field = { modules, damage: 0 };
        const e = { ...target(type), x: p.x + 80, y: p.y };
        w.enemies = [e];
        tick(w, { left: true });
        tick(w, {}, 70);
        const mods = progressionModifiers(p.progression, 'vanguard'),
          runDamage = modules.length ? 1.24 * (type === 'tank' ? 1.2 : 1) : 1;
        assert.ok(mods.heavyDamage > 1);
        close(
          2000 - e.hp,
          180 * mods.damage * (type === 'tank' ? mods.heavyDamage : 1) * runDamage,
          'single sword impact',
        );
      }
});

test('trained ground speed, lift and cooldown rates compose with run thrusters and capacitor', () => {
  for (const modules of [[], ['thrusters', 'thrusters', 'capacitor']])
    for (const progression of [null, certified]) {
      const w = make(progression),
        p = w.players[0];
      Object.assign(p, { x: 0, y: 0, dashCd: 2, abilityCd: 2 });
      p.field = { modules };
      const f = combatStats(p),
        mods = progressionModifiers(p.progression, 'vanguard');
      setInput(w, 'p', { x: 1, angle: 0, fly: true });
      step(w, 0.05);
      close(p.x, f.speed * f.boost * 0.05, 'ground travel');
      close(p.altitude, f.lift * 0.05, 'powered lift');
      close(2 - p.dashCd, 0.05 * mods.dashRecharge * (modules.length ? 1.2 : 1), 'dash recharge');
      close(
        2 - p.abilityCd,
        0.05 * mods.specialRecharge * (modules.length ? 1.25 : 1),
        'special recharge',
      );
      if (progression) {
        assert.ok(f.speed > mechStats(p.build).speed);
        assert.ok(f.lift > mechStats(p.build).lift);
        assert.ok(mods.dashRecharge > 1);
        assert.ok(mods.specialRecharge > 1);
      }
    }
});

test('career damage reduction multiplies run armor and active shields on actual enemy projectiles', () => {
  for (const modules of [[], ['plating', 'plating']])
    for (const shield of [false, true]) {
      const w = make(certified),
        p = w.players[0];
      Object.assign(p, {
        x: 0,
        y: 0,
        recoverUntil: 0,
        activeAbility: shield ? 'shield' : null,
        active: shield ? 8 : 0,
      });
      p.field = { modules };
      const before = p.hp,
        mods = progressionModifiers(p.progression, 'vanguard');
      assert.ok(mods.damageReduction < 1);
      w.bullets = [
        { id: 999, x: 50, y: 0, z: 30, vx: -2000, vy: 0, vz: 0, life: 1, damage: 100, enemy: true },
      ];
      step(w, 0.05);
      // Career mitigation multiplies the additive field armor contract once.
      close(
        before - p.hp,
        100 * 0.6 * mods.damageReduction * (modules.length ? 0.8 : 1) * (shield ? 0.4 : 1),
        'incoming damage',
      );
    }
});

test('career recovery waits for a safe interval and adds to the existing campaign recovery modules', () => {
  const w = make(certified, campaignRound(MISSIONS[0].id, 73)),
    p = w.players[0],
    mods = progressionModifiers(p.progression, 'vanguard');
  assert.ok(mods.repair > 0);
  w.operation.nextWave = w.operation.nextStrike = 1e9;
  w.time = 10;
  p.hp = 50;
  p.lastHurt = 9;
  p.field.modules = ['repair', 'repair'];
  step(w, 0.05);
  close(p.hp, 50, 'recovery delay');
  p.lastHurt = 0;
  step(w, 0.05);
  close(p.hp, 50 + 0.05 * (4 + 4 + mods.repair), 'combined recovery');
});

test('career hull persists through squad revive and repair fields use each target maximum', () => {
  const build = chassisBlueprint('vanguard'),
    w = newWorld(testPlatform(), [
      { id: 'p', build, progression: trained },
      { id: 'ally', build },
    ]),
    p = w.players[0],
    ally = w.players[1];
  w.enemies = [];
  Object.assign(p, { x: 0, y: 0, hp: 0, revive: 2.99 });
  Object.assign(ally, { x: 30, y: 0 });
  step(w, 0.05);
  close(p.hp, combatStats(p).hp * 0.4, 'revive hull');
  p.hp = combatStats(p).hp - 0.1;
  p.lastHurt = w.time;
  ally.activeAbility = 'repair';
  ally.active = 8;
  step(w, 0.05);
  close(p.hp, combatStats(p).hp, 'repair cap');
  assert.ok(p.hp > mechStats(build).hp);
});

test('campaign, classic operation and demolition redeploy restore trained maximum hull', () => {
  for (const mission of [
    campaignRound(MISSIONS[0].id, 91),
    planetMission(91),
    destructionMission('level'),
    destructionMission('yard'),
  ]) {
    const w = make(trained, mission),
      p = w.players[0];
    w.time = 20;
    p.hp = 0;
    if (w.operation) {
      w.operation.wipeAt = 10;
      w.operation.nextWave = w.operation.nextStrike = 1e9;
    }
    if (w.siege) {
      w.siege.wipeAt = 10;
      w.siege.nextWave = 1e9;
    }
    step(w, 0.01);
    close(p.hp, combatStats(p).hp, mission.name);
    assert.equal(w.status, 'playing');
  }
});

test('classic operation checkpoints preserve trained hull rather than clamping to workshop armor', () => {
  const w = make(trained, planetMission(31)),
    p = w.players[0];
  w.time = 86;
  w.kills = 100;
  w.operation.nextWave = w.operation.nextStrike = 1e9;
  p.hp = 1;
  p.lastHurt = w.time;
  step(w, 0.01);
  assert.equal(w.operation.phase, 1);
  close(p.hp, combatStats(p).hp * 0.85, 'checkpoint hull');
});
