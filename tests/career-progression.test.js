import test from 'node:test';
import assert from 'node:assert/strict';
import { CHASSIS } from '../dist/chassis.js';
import { MISSIONS } from '../dist/mission-catalog.js';
import {
  CAREER_POINT_CAP,
  MECH_TREES,
  PILOT_TREE,
  PROGRESSION_LIMITS,
  newCareer,
  cleanCareer,
  treeFor,
  careerProfile,
  availablePoints,
  nodeStatus,
  unlockCareer,
  resetCareer,
  deploymentProgression,
  cleanDeploymentProgression,
  progressionModifiers,
  applyProgressionStats,
  awardCareer,
} from '../dist/career-progression.js';

const nodes = (tree) => tree.branches.flatMap((branch) => branch.nodes);
const unlock = (state, kind, key, nodeId) =>
  unlockCareer(state, { kind, key, nodeId, revision: state.revision });
const funded = () =>
  cleanCareer({
    ...newCareer(),
    mechs: { vanguard: { earned: 18 } },
    pilots: { Ace: { earned: 18 } },
  });
const victory = (overrides = {}) => ({
  campaignId: 'campaign-a',
  level: 0,
  missionId: MISSIONS[0].id,
  outcome: 'victory',
  practice: false,
  chassisId: 'vanguard',
  pilot: 'Ace',
  ...overrides,
});

test('all fifteen chassis and custom frame have immutable authored branches and distinct signature effects', () => {
  assert.deepEqual(Object.keys(MECH_TREES).sort(), [...Object.keys(CHASSIS), 'custom'].sort());
  const signatures = new Set();
  for (const [id, tree] of Object.entries(MECH_TREES)) {
    assert.equal(treeFor('mech', id), tree);
    assert.equal(tree.branches.length, 3);
    assert.equal(nodes(tree).length, 9);
    assert.ok(Object.isFrozen(tree));
    assert.equal(new Set(nodes(tree).map((node) => node.id)).size, 9);
    assert.equal(
      nodes(tree).reduce((sum, node) => sum + node.cost, 0),
      CAREER_POINT_CAP,
    );
    for (const branch of tree.branches) {
      assert.deepEqual(
        branch.nodes.map((node) => node.cost),
        [1, 2, 3],
      );
      assert.deepEqual(branch.nodes[0].requires, []);
      for (let i = 1; i < 3; i++)
        assert.deepEqual(branch.nodes[i].requires, [branch.nodes[i - 1].id]);
      assert.ok(Object.isFrozen(branch.nodes[0].effects));
    }
    signatures.add(JSON.stringify(tree.branches.map((branch) => branch.nodes[2].effects)));
  }
  assert.equal(signatures.size, 16);
  assert.equal(treeFor('mech', null), MECH_TREES.custom);
  assert.equal(treeFor('mech', '__proto__'), null);
  assert.equal(treeFor('pilot', 'Ace'), PILOT_TREE);
  assert.equal(treeFor('pilot', 'Wing'), PILOT_TREE);
  assert.equal(treeFor('unknown', 'Ace'), null);
});

test('starter points, prerequisite costs, stale requests and free respec are copy-on-write', () => {
  const initial = newCareer();
  assert.deepEqual(initial, { version: 1, revision: 0, mechs: {}, pilots: {}, receipts: [] });
  assert.equal(availablePoints(initial, 'mech', 'vanguard'), 1);
  const first = unlock(initial, 'mech', 'vanguard', 'vanguard.role.1');
  assert.equal(first.revision, 1);
  assert.equal(availablePoints(first, 'mech', 'vanguard'), 0);
  assert.equal(initial.revision, 0);
  assert.deepEqual(initial.mechs, {});
  assert.equal(unlock(first, 'mech', 'vanguard', 'vanguard.role.2'), first);
  assert.equal(unlock(first, 'mech', 'vanguard', 'vanguard.role.1'), first);
  assert.equal(
    unlockCareer(first, { kind: 'pilot', key: 'Ace', nodeId: 'tactics.1', revision: 0 }),
    first,
  );
  assert.match(nodeStatus(first, 'mech', 'vanguard', 'vanguard.role.3').reason, /previous/);
  assert.match(nodeStatus(first, 'mech', 'vanguard', 'vanguard.role.2').reason, /2/);
  const reset = resetCareer(first, { kind: 'mech', key: 'vanguard', revision: 1 });
  assert.equal(availablePoints(reset, 'mech', 'vanguard'), 1);
  assert.equal(reset.revision, 2);
  assert.deepEqual(careerProfile(first, 'mech', 'vanguard').unlocked, ['vanguard.role.1']);
  assert.equal(resetCareer(reset, { kind: 'mech', key: 'vanguard', revision: 2 }), reset);
});

test('chassis ownership and pilot callsigns remain independent across deployments and JSON saves', () => {
  let state = funded();
  state = unlock(state, 'mech', 'vanguard', 'vanguard.role.1');
  state = unlock(state, 'pilot', 'Ace', 'tactics.1');
  assert.equal(availablePoints(state, 'mech', 'vanguard'), 17);
  assert.equal(availablePoints(state, 'mech', 'lark'), 1);
  assert.equal(availablePoints(state, 'pilot', 'Ace'), 17);
  assert.equal(availablePoints(state, 'pilot', 'Wing'), 1);
  assert.deepEqual(deploymentProgression(state, 'vanguard', 'Ace'), {
    mech: ['vanguard.role.1'],
    pilot: ['tactics.1'],
  });
  assert.deepEqual(deploymentProgression(state, 'lark', 'Ace'), { mech: [], pilot: ['tactics.1'] });
  assert.deepEqual(deploymentProgression(state, 'vanguard', 'Wing'), {
    mech: ['vanguard.role.1'],
    pilot: [],
  });
  assert.deepEqual(cleanCareer(JSON.parse(JSON.stringify(state))), state);
  const profile = careerProfile(state, 'pilot', 'Ace');
  profile.unlocked.length = 0;
  assert.deepEqual(careerProfile(state, 'pilot', 'Ace').unlocked, ['tactics.1']);
  const respec = resetCareer(state, { kind: 'pilot', key: 'Ace', revision: state.revision });
  assert.deepEqual(deploymentProgression(respec, 'vanguard', 'Ace'), {
    mech: ['vanguard.role.1'],
    pilot: [],
  });
});

test('corrupt and future saves cannot retain prototype identities, invalid ranks or overspending', () => {
  const corrupt = {
    version: 1,
    revision: -5,
    mechs: {
      ...JSON.parse('{"__proto__":{"earned":99}}'),
      vanguard: {
        earned: 2,
        unlocked: [
          'vanguard.role.2',
          'vanguard.role.1',
          'vanguard.frame.1',
          'vanguard.systems.1',
          'power',
        ],
      },
      lark: { earned: 99, unlocked: ['lark.role.3'] },
      future: { earned: 18 },
    },
    pilots: {
      constructor: { earned: 99 },
      Ace: { earned: 99, unlocked: ['tactics.3', 'tactics.2', 'tactics.1', 'tactics.1', 'power'] },
    },
    receipts: ['fake', '["campaign-a",0]', '["campaign-a",0]'],
  };
  const state = cleanCareer(corrupt);
  assert.equal(state.revision, 0);
  assert.deepEqual(Object.keys(state.mechs), ['vanguard', 'lark']);
  assert.deepEqual(Object.keys(state.pilots), ['Ace']);
  assert.equal(state.mechs.lark.earned, 18);
  assert.deepEqual(state.mechs.lark.unlocked, []);
  assert.deepEqual(state.mechs.vanguard.unlocked, ['vanguard.role.1', 'vanguard.frame.1']);
  assert.equal(availablePoints(state, 'mech', 'vanguard'), 0);
  assert.deepEqual(state.pilots.Ace.unlocked, ['tactics.1', 'tactics.2', 'tactics.3']);
  assert.equal(state.receipts.length, 1);
  assert.deepEqual(cleanCareer({ ...state, version: 2 }), newCareer());
  assert.deepEqual(deploymentProgression({ ...state, version: 2 }, 'vanguard', 'Ace'), {
    mech: [],
    pilot: [],
  });
  assert.deepEqual(cleanCareer(null), newCareer());
  assert.equal(unlock(state, 'pilot', 'constructor', 'tactics.1'), state);
  assert.equal(unlock(state, 'mech', 'missing', 'vanguard.role.1'), state);
  assert.equal({}.earned, undefined);
  const inherited = Object.create({ Ace: { earned: 18, unlocked: ['tactics.1'] } });
  assert.deepEqual(cleanCareer({ ...newCareer(), pilots: inherited }).pilots, {});
  assert.equal(careerProfile({ ...newCareer(), pilots: inherited }, 'pilot', 'Ace').earned, 1);
});

test('deployment certificates reject foreign chassis, missing prerequisites and forged effect data', () => {
  const mech = nodes(MECH_TREES.vanguard).map((node) => node.id),
    pilot = nodes(PILOT_TREE).map((node) => node.id);
  assert.deepEqual(
    cleanDeploymentProgression(
      {
        mech: [...mech, 'lark.role.1', 'power', '__proto__'],
        pilot: [...pilot, 'vanguard.role.1'],
        hp: 99,
      },
      'vanguard',
    ),
    { mech, pilot },
  );
  assert.deepEqual(
    cleanDeploymentProgression(
      { mech: ['vanguard.role.3', 'vanguard.role.2'], pilot: ['systems.3'] },
      'vanguard',
    ),
    { mech: [], pilot: [] },
  );
  assert.deepEqual(cleanDeploymentProgression({ mech, pilot }, 'lark'), { mech: [], pilot });
  assert.deepEqual(cleanDeploymentProgression(null, 'vanguard'), { mech: [], pilot: [] });
  for (const tree of [...Object.values(MECH_TREES), PILOT_TREE])
    assert.ok(nodes(tree).reduce((sum, node) => sum + node.cost, 0) <= 18);
});

test('successful campaign rounds award both identities once, with capped points and bounded receipts', () => {
  const initial = newCareer(),
    first = awardCareer(initial, victory());
  assert.equal(first.revision, 1);
  assert.equal(careerProfile(first, 'mech', 'vanguard').earned, 2);
  assert.equal(careerProfile(first, 'pilot', 'Ace').earned, 2);
  assert.deepEqual(initial, newCareer());
  assert.equal(awardCareer(first, victory()), first);
  assert.equal(
    awardCareer(first, victory({ pilot: 'Wing', chassisId: 'lark' })),
    first,
    'a receipt identifies the round independently of the selected identity',
  );
  for (const change of [
    { outcome: 'defeat' },
    { practice: true },
    { practice: undefined },
    { campaignId: '' },
    { level: 1 },
    { level: -1 },
    { level: 9 },
    { level: 99, missionId: undefined },
    { missionId: 'other' },
    { chassisId: 'missing' },
    { chassisId: undefined },
    { pilot: '' },
    { pilot: 'constructor' },
  ])
    assert.equal(awardCareer(first, victory(change)), first, JSON.stringify(change));
  const second = awardCareer(
    first,
    victory({ campaignId: 'campaign-b', chassisId: 'lark', pilot: 'Wing' }),
  );
  assert.equal(careerProfile(second, 'mech', 'lark').earned, 2);
  assert.equal(careerProfile(second, 'pilot', 'Wing').earned, 2);
  assert.equal(careerProfile(second, 'pilot', 'Ace').earned, 2);
  let capped = initial;
  for (let i = 0; i < 300; i++)
    capped = awardCareer(capped, victory({ campaignId: 'campaign-' + i }));
  assert.equal(capped.receipts.length, 256);
  assert.equal(careerProfile(capped, 'mech', 'vanguard').earned, 18);
  assert.equal(careerProfile(capped, 'pilot', 'Ace').earned, 18);
  assert.deepEqual(cleanCareer(JSON.parse(JSON.stringify(capped))), capped);
  const custom = awardCareer(initial, victory({ chassisId: null }));
  assert.equal(custom.mechs.custom.earned, 2);
});

test('permanent modifiers are modest, additive and independent from campaign and field modules', () => {
  const empty = progressionModifiers({}, 'vanguard');
  assert.deepEqual(empty, {
    hp: 1,
    speed: 1,
    lift: 1,
    damage: 1,
    heavyDamage: 1,
    damageReduction: 1,
    dashRecharge: 1,
    specialRecharge: 1,
    repair: 0,
  });
  const mods = progressionModifiers(
    {
      mech: ['vanguard.role.1'],
      pilot: ['tactics.1'],
      field: { modules: ['power', 'power'] },
      modules: ['power'],
    },
    'vanguard',
  );
  assert.ok(Math.abs(mods.damage - 1.045) < 1e-10);
  assert.equal(mods.hp, 1);
  for (const [id, tree] of Object.entries(MECH_TREES)) {
    const maximum = progressionModifiers(
      { mech: nodes(tree).map((node) => node.id), pilot: nodes(PILOT_TREE).map((node) => node.id) },
      id,
    );
    for (const [key, [low, high]] of Object.entries(PROGRESSION_LIMITS))
      assert.ok(maximum[key] >= low && maximum[key] <= high, `${id}.${key}`);
  }
  const base = {
      hp: 100,
      speed: 200,
      walkSpeed: 48,
      lift: 80,
      capacity: 99,
      weight: 74,
      valid: false,
      issues: ['overweight'],
      heavySlots: 1,
      damage: 12,
    },
    scaled = applyProgressionStats(base, {
      hp: 1.1,
      speed: 1.1,
      lift: 1.2,
      capacity: 999,
      damage: 99,
    });
  assert.deepEqual(scaled, { ...base, hp: 110, speed: 220, walkSpeed: 53, lift: 96 });
  assert.equal(base.hp, 100);
  assert.equal(scaled.issues, base.issues);
  assert.equal(applyProgressionStats(base, { hp: Infinity, speed: 99, lift: -3 }).speed, 240);
  let state = funded();
  state = unlock(state, 'mech', 'vanguard', 'vanguard.role.1');
  const saved = JSON.stringify(state);
  assert.ok(!saved.includes('modules'));
  assert.ok(!saved.includes('field'));
  assert.ok(!saved.includes('campaign'));
  assert.deepEqual(
    cleanCareer({
      ...state,
      campaign: { pilots: [{ modules: ['power'] }] },
      field: { modules: ['power'] },
    }),
    state,
  );
});
