import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newWorld,
  mechStats,
  combatStats,
  statsForPlayer,
  testPlatform,
  setInput,
  step,
  snapshot,
} from '../dist/core.js';
import { chassisBlueprint } from '../dist/chassis.js';
import {
  treeFor,
  progressionModifiers,
  applyProgressionStats,
  newCareer,
  unlockCareer,
  resetCareer,
  careerProfile,
  deploymentProgression,
  awardCareerForWorld,
  cleanCareer,
} from '../dist/career-progression.js';
import {
  newCampaign,
  campaignMission,
  recordSortie,
  profileFor,
  refitOffer,
  installRefit,
  cleanCampaign,
} from '../dist/campaign.js';
import {
  fieldModifiers,
  interactField,
  awardSalvage,
  sortieReport,
} from '../dist/sortie-progression.js';

const trained = {
  mech: treeFor('mech', 'vanguard').branches.flatMap((b) => b.nodes.map((n) => n.id)),
  pilot: treeFor('pilot', 'Pilot').branches.flatMap((b) => b.nodes.map((n) => n.id)),
};
const close = (a, b, label = 'value') =>
  assert.ok(Math.abs(a - b) < 1e-7, `${label}: ${a} != ${b}`);
const campaignFor = (profile) => ({
  ...newCampaign(72),
  pilots: [{ name: 'Pilot', modules: [], upgrades: [], items: [], xp: 0, credits: 2, ...profile }],
});
function make(profile = {}, progression = trained) {
  const campaign = campaignFor(profile),
    w = newWorld(campaignMission(campaign), [
      { id: 'p', name: 'Pilot', build: chassisBlueprint('vanguard'), progression },
    ]);
  w.operation.nextWave = w.operation.nextStrike = 1e9;
  w.mission.obstacles = [];
  w.mission.platforms = [];
  w.mission.ramps = [];
  w.enemies = [];
  w.spawn = [];
  w.field.nodes = [];
  Object.assign(w.players[0], { x: 1000, y: 1000, altitude: 0, recoverUntil: 0 });
  return { w, p: w.players[0], campaign };
}
const careerBase = (p) =>
  applyProgressionStats(mechStats(p.build), progressionModifiers(p.progression, p.build.chassis));
function itemNode(w, p, itemId) {
  const node = {
    id: 'test-cache-' + w.field.nodes.length,
    kind: 'cache',
    itemId,
    x: p.x,
    y: p.y,
    z: 0,
    state: 'ready',
    revision: 0,
    cost: 0,
    claimed: [],
  };
  w.field.nodes.push(node);
  return node;
}
function shoot(w, p, e, damage = 24) {
  w.bullets.push({
    id: w.id++,
    owner: p.id,
    kind: 'carbine',
    origin: { x: p.x, y: p.y, z: 32 },
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
  step(w, 0.01);
}

test('trained hull is the field base, carried hull applies once and authoritative ticks preserve it through relay expiry', () => {
  const { w, p } = make({ upgrades: ['hull'], items: ['spall'] });
  const base = careerBase(p);
  assert.ok(base.hp > mechStats(p.build).hp);
  close(p.field.maxHull, base.hp);
  close(p.hp, base.hp * 1.23);
  close(combatStats(p).hp, p.hp);
  p.field.buffs = [{ relayId: 'assault', expiresAt: 0.03 }];
  for (let i = 0; i < 100; i++) step(w, 0.01);
  assert.deepEqual(p.field.buffs, []);
  close(p.hp, base.hp * 1.23, 'field tick must not discard trained hull');
  const remote = JSON.parse(JSON.stringify(snapshot(w))).players[0];
  assert.deepEqual(combatStats(remote), combatStats(p));
  assert.deepEqual(statsForPlayer(p.build), mechStats(p.build));
  assert.deepEqual(statsForPlayer(p.build, p), combatStats(p));
});

test('field hull rewards and repair relay use trained maximum without mutating permanent ranks or workshop hardware', () => {
  const { w, p } = make();
  const base = careerBase(p),
    progression = JSON.stringify(p.progression),
    hardware = JSON.stringify(p.build),
    cache = itemNode(w, p, 'spall');
  assert.equal(interactField(w, p, { id: cache.id, revision: 0 }), true);
  close(p.hp, base.hp * 1.08);
  close(p.field.maxHull, base.hp);
  const relay = {
    id: 'bulkhead',
    kind: 'relay',
    relayId: 'colossus',
    x: p.x,
    y: p.y,
    z: 0,
    state: 'ready',
    revision: 0,
    cost: 16,
    claimed: [],
  };
  w.field.nodes.push(relay);
  awardSalvage(w, 20);
  assert.equal(interactField(w, p, { id: relay.id, revision: 0 }), true);
  close(p.hp, base.hp * 1.2);
  const repair = {
    ...relay,
    id: 'mender',
    relayId: 'mender',
    revision: 0,
    state: 'ready',
    cost: 0,
    claimed: [],
  };
  w.field.nodes.push(repair);
  p.hp = 20;
  assert.equal(interactField(w, p, { id: repair.id, revision: 0 }), true);
  close(p.hp, 20 + base.hp * 1.2 * 0.35);
  assert.equal(JSON.stringify(p.progression), progression);
  assert.equal(JSON.stringify(p.build), hardware);
});

test('career movement rounds before field thrusters and recharge bonuses apply once to real simulation', () => {
  const { w, p } = make({
    modules: ['thrusters', 'capacitor'],
    upgrades: ['thrusters', 'capacitor'],
    items: ['gyro', 'reactor'],
  });
  const base = careerBase(p),
    career = progressionModifiers(p.progression, p.build.chassis);
  p.dashCd = p.abilityCd = 2;
  setInput(w, p.id, { x: 1, fly: true, angle: 0 });
  step(w, 0.05);
  close(p.x - 1000, base.speed * 1.28 * base.boost * 0.05, 'travel');
  close(p.altitude, base.lift * 1.2 * 0.05, 'lift');
  close(p.dashCd, 2 - 0.05 * career.dashRecharge * 1.2, 'dash');
  close(p.abilityCd, 2 - 0.05 * career.specialRecharge * 1.6, 'special');
  close(combatStats(p).capacity, mechStats(p.build).capacity);
});

test('career and field damage compose for body hits against ordinary and armored targets in campaign and practice', () => {
  for (const practice of [false, true])
    for (const heavy of [false, true]) {
      const { w, p } = make({ modules: ['power', 'breaker'], upgrades: ['power', 'power'] });
      if (practice) {
        w.mission.mode = 'sandbox';
        w.mission.raid = false;
        w.operation = null;
        w.sortie = null;
      }
      const career = progressionModifiers(p.progression, p.build.chassis),
        e = {
          id: 'target',
          type: heavy ? 'tank' : 'target',
          training: true,
          x: p.x + 80,
          y: p.y,
          altitude: 0,
          hp: 10000,
          max: 10000,
          r: 22,
          stun: 0,
        };
      w.enemies = [e];
      shoot(w, p, e);
      close(
        10000 - e.hp,
        24 * career.damage * (heavy ? career.heavyDamage : 1) * 1.36 * (heavy ? 1.2 : 1),
      );
    }
});

test('career armor multiplies field armor and the strongest complete shield factor on actual incoming fire', () => {
  const { w, p } = make({
    modules: ['plating'],
    upgrades: ['plating'],
    items: ['spall', 'reactor', 'reactor', 'aegis'],
  });
  w.mission.raid = false;
  p.activeAbility = 'shield';
  p.active = 8;
  const before = p.hp,
    career = progressionModifiers(p.progression, p.build.chassis);
  w.bullets = [
    { id: 999, enemy: true, x: p.x, y: p.y, z: 32, vx: 0, vy: 0, vz: 0, life: 0.2, damage: 100 },
  ];
  step(w, 0.01);
  close(
    before - p.hp,
    100 * 0.6 * career.damageReduction * 0.74 * (0.4 - 0.12 - 0.36 * 0.2),
    'combined incoming damage',
  );
});

test('safe recovery adds career training to field recovery and waits after an actual hit timestamp', () => {
  const { w, p } = make({ modules: ['repair'], upgrades: ['repair'], items: ['medic'] });
  const career = progressionModifiers(p.progression, p.build.chassis);
  w.time = 10;
  p.hp = 50;
  p.lastHurt = 9;
  step(w, 0.05);
  close(p.hp, 50);
  p.lastHurt = 0;
  step(w, 0.05);
  close(p.hp, 50 + 0.05 * (10 + career.repair));
  const sandbox = newWorld(testPlatform(), [
      { id: 'p', build: chassisBlueprint('vanguard'), progression: trained },
    ]),
    q = sandbox.players[0];
  sandbox.enemies = [];
  q.hp = 50;
  q.lastHurt = -10;
  step(sandbox, 0.05);
  close(q.hp, 50 + 0.05 * career.repair, 'permanent recovery remains available outside campaign');
});

test('career certifications and run inventories settle separately, survive save reload and spend independent currencies', () => {
  let career = newCareer();
  career = unlockCareer(career, {
    kind: 'mech',
    key: 'vanguard',
    nodeId: 'vanguard.frame.1',
    revision: career.revision,
  });
  career = unlockCareer(career, {
    kind: 'pilot',
    key: 'Pilot',
    nodeId: 'survival.1',
    revision: career.revision,
  });
  const { w, p, campaign } = make(
    { modules: ['power'], upgrades: ['hull'], items: ['gyro'], xp: 100 },
    deploymentProgression(career, 'vanguard', 'Pilot'),
  );
  p.field.items.push('spall');
  awardSalvage(w, 250);
  w.status = 'won';
  const report = sortieReport(w, 'victory'),
    next = recordSortie(campaign, 'victory', report),
    awarded = awardCareerForWorld(career, w, p.id, 'Pilot');
  assert.equal(next.level, 1);
  assert.deepEqual(profileFor(next, 'Pilot').items, ['gyro', 'spall']);
  assert.equal(profileFor(next, 'Pilot').credits, 4);
  assert.equal(careerProfile(awarded, 'mech', 'vanguard').earned, 2);
  assert.equal(careerProfile(awarded, 'pilot', 'Pilot').earned, 2);
  assert.equal(awardCareerForWorld(awarded, w, p.id, 'Pilot'), awarded);
  assert.deepEqual(cleanCampaign(JSON.parse(JSON.stringify(next))), next);
  assert.deepEqual(cleanCareer(JSON.parse(JSON.stringify(awarded))), awarded);
  const refitted = installRefit(next, 'Pilot', {
    id: refitOffer(next, 'Pilot')[0],
    revision: next.revision,
  });
  assert.equal(profileFor(refitted, 'Pilot').credits, 3);
  assert.equal(careerProfile(awarded, 'mech', 'vanguard').earned, 2);
  const reset = resetCareer(awarded, { kind: 'mech', key: 'vanguard', revision: awarded.revision });
  assert.deepEqual(careerProfile(reset, 'mech', 'vanguard').unlocked, []);
  assert.equal(careerProfile(reset, 'mech', 'vanguard').earned, 2);
  assert.deepEqual(profileFor(refitted, 'Pilot').items, ['gyro', 'spall']);
  const fresh = newWorld(campaignMission(newCampaign(73)), [
    {
      id: 'p',
      name: 'Pilot',
      build: p.build,
      progression: deploymentProgression(reset, 'vanguard', 'Pilot'),
    },
  ]);
  assert.deepEqual(fresh.players[0].field.items, []);
  assert.deepEqual(fresh.players[0].field.upgrades, []);
  assert.equal(fresh.players[0].field.xp, 0);
  assert.deepEqual(fresh.players[0].progression.pilot, ['survival.1']);
  assert.ok(fresh.players[0].hp > mechStats(p.build).hp);
});

test('failed sorties cannot bank new field tech or permanent career points, and practice cannot earn certifications', () => {
  const { w, p, campaign } = make({ items: ['gyro'] });
  p.field.items.push('spall');
  p.field.xp = 100;
  w.status = 'lost';
  const career = newCareer(),
    failed = recordSortie(campaign, 'defeat', sortieReport(w, 'defeat'));
  assert.equal(failed.runState, 'lost');
  assert.deepEqual(profileFor(failed, 'Pilot').items, ['gyro']);
  assert.equal(profileFor(failed, 'Pilot').xp, 0);
  assert.equal(awardCareerForWorld(career, w, p.id, 'Pilot'), career);
  w.status = 'won';
  w.mission.practice = true;
  assert.equal(awardCareerForWorld(career, w, p.id, 'Pilot'), career);
  assert.equal(fieldModifiers(p).maxHull, 0.08);
});
