import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, step } from '../dist/core.js';
import { campaignRound } from '../dist/mission-catalog.js';
import { chassisBlueprint } from '../dist/chassis.js';

const rosters = [
  ['weak', 'strong', 'target'],
  ['weak', 'target', 'strong'],
  ['strong', 'weak', 'target'],
  ['strong', 'target', 'weak'],
  ['target', 'weak', 'strong'],
  ['target', 'strong', 'weak'],
];
function projectileDamage(roster, { weak = {}, strong = {} } = {}) {
  const w = newWorld(
    campaignRound('ashgate', 42),
    roster.map((id) => ({
      id,
      build:
        id === 'target'
          ? chassisBlueprint('vanguard')
          : { ...chassisBlueprint('vanguard'), equipment: ['blade', 'carbine', 'shield'] },
    })),
  );
  w.mission.raid = false;
  w.operation.nextWave = w.operation.nextStrike = 1e9;
  w.mission.obstacles = [];
  w.mission.platforms = [];
  w.mission.ramps = [];
  w.enemies = [];
  w.spawn = [];
  w.field.nodes = [];
  w.time = 10;
  for (const p of w.players) {
    Object.assign(p, {
      x: 1000 + (p.id === 'target' ? 0 : p.id === 'weak' ? 100 : -100),
      y: 1000,
      altitude: 0,
      recoverUntil: 0,
    });
    if (p.id === 'target') continue;
    const config = p.id === 'weak' ? weak : strong;
    p.field.items = config.items || [];
    p.field.buffs = config.buffs || [];
    if (config.active !== false) Object.assign(p, { activeAbility: 'shield', active: 8 });
  }
  const target = w.players.find((p) => p.id === 'target'),
    before = target.hp;
  w.bullets.push({
    id: 999,
    enemy: true,
    x: target.x,
    y: target.y,
    z: 32,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0.2,
    damage: 40,
  });
  step(w, 0.01);
  return before - target.hp;
}
function expectDamage(actual, expected, context) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${context}: expected ${expected}, received ${actual}`,
  );
}

test('overlapping normal domes cannot weaken reactor-powered protection in any roster order', () => {
  const strong = { items: ['reactor', 'reactor', 'reactor'] };
  const baseline = projectileDamage(rosters[0], { weak: { active: false }, strong });
  expectDamage(baseline, 7.008, 'strong dome alone');
  for (const roster of rosters)
    expectDamage(projectileDamage(roster, { strong }), baseline, roster.join(','));
});

test('overlapping domes compare combined special and shield bonuses instead of shield bonus alone', () => {
  const weak = { items: ['aegis'] },
    strong = {
      items: ['reactor', 'reactor', 'reactor'],
      buffs: [{ relayId: 'capacitor', expiresAt: 60 }],
    };
  const baseline = projectileDamage(rosters[0], { weak: { active: false }, strong });
  expectDamage(baseline, 5.808, 'special-powered dome alone');
  for (const roster of rosters)
    expectDamage(projectileDamage(roster, { weak, strong }), baseline, roster.join(','));
});

test('overlapping field bonuses preserve the shield mitigation floor without multiplying domes', () => {
  const strong = { items: ['reactor', 'reactor', 'reactor', 'aegis', 'aegis'] },
    weak = { items: ['aegis', 'aegis'] };
  for (const roster of rosters)
    expectDamage(projectileDamage(roster, { weak, strong }), 3.6, roster.join(','));
});
