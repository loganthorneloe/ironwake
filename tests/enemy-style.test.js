import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import { enemyPose, applyEnemyPose, locomotionStyle, ENEMY_MOTION } from '../dist/enemy-motion.js';
import { ENEMY_ATTACKS, enemyAttackSlots, stepEnemy } from '../dist/enemy-behaviors.js';
import { makeRobot, animateRobot, createRobotBatch } from '../dist/robot-models.js';
import { createEnemyFlair } from '../dist/enemy-flair.js';

const robot = (species = 'hunter', extra = {}) => ({
  id: species,
  species,
  hp: 100,
  max: 100,
  r: 20,
  bodyHeight: 40,
  x: 0,
  y: 0,
  altitude: 0,
  angle: 0,
  attackAngle: 0,
  attackKind: 'pounce',
  actionPhase: 'windup',
  actionTime: 0.35,
  ...extra,
});
test('anime anticipation has a stronger silhouette, with selective held body frames', () => {
  const p = robot(),
    anime = enemyPose(p),
    restrained = enemyPose(p, { style: 'restrained' });
  assert.ok(Math.abs(anime.height) > Math.abs(restrained.height) * 1.4);
  assert.ok(Math.abs(anime.pitch) > Math.abs(restrained.pitch) * 1.4);
  assert.deepEqual(
    enemyPose(robot('hunter', { actionTime: 0.101 })),
    enemyPose(robot('hunter', { actionTime: 0.109 })),
  );
  assert.notDeepEqual(
    enemyPose(robot('hunter', { actionTime: 0.101 }), { reduced: true }),
    enemyPose(robot('hunter', { actionTime: 0.109 }), { reduced: true }),
  );
});
test('release is fast, recovery springs change direction, and every pose settles exactly', () => {
  const active = enemyPose(robot('hunter', { actionPhase: 'active', actionTime: 0.04 }));
  assert.ok(active.height > 1);
  assert.ok(active.kick > 0);
  assert.ok(active.smear > 0);
  const a = ENEMY_ATTACKS.pounce,
    secondary = Array.from(
      { length: 40 },
      (_, i) =>
        enemyPose(robot('hunter', { actionPhase: 'recovery', actionTime: (i * a.recovery) / 39 }))
          .secondary,
    );
  assert.ok(secondary.some((n) => n > 0.02));
  assert.ok(secondary.some((n) => n < -0.005));
  for (const [k, a] of Object.entries(ENEMY_ATTACKS))
    for (const role of Object.keys(ENEMY_MOTION)) {
      const settled = enemyPose(
        robot(role, { attackKind: k, actionPhase: 'recovery', actionTime: a.recovery }),
      );
      assert.ok(
        Object.values(settled).every((n) => Math.abs(n) < 1e-8),
        k + '/' + role,
      );
    }
});
test('light enemies have more elasticity than rigid siege machines; Reduced removes extra deformation', () => {
  const active = { actionPhase: 'active', actionTime: 0.06 };
  assert.ok(
    enemyPose(robot('hunter', active)).stretch >
      enemyPose({ ...robot('scarab', active), elite: true }).stretch * 3,
  );
  const p = enemyPose(robot('hunter', active), { reduced: true });
  for (const key of ['squash', 'stretch', 'secondary', 'smear', 'kick', 'twist'])
    assert.equal(p[key], 0);
  assert.ok(p.height > 0, 'the essential attack silhouette remains readable');
  assert.ok(locomotionStyle(robot('hunter')).bounce > locomotionStyle(robot('mortar')).bounce * 3);
});
test('all exaggerated body and secondary-joint transforms remain finite and bounded', () => {
  for (const role of Object.keys(ENEMY_MOTION).filter((k) => k !== 'siege')) {
    const g = makeRobot(role);
    for (const [k, a] of Object.entries(ENEMY_ATTACKS))
      for (const phase of ['windup', 'active', 'recovery'])
        for (let i = 0; i <= 8; i++) {
          const p = robot(role, {
            attackKind: k,
            actionPhase: phase,
            actionTime: (a[phase] * i) / 8,
          });
          animateRobot(g, p, 0.016, i * 0.016, { reduced: false });
          g.updateMatrixWorld(true);
          g.traverse((o) =>
            assert.ok(o.matrixWorld.elements.every(Number.isFinite), role + '/' + k),
          );
          assert.ok(g.userData.body.scale.x > 0.8 && g.userData.body.scale.x < 1.25);
          assert.ok(g.userData.body.scale.y > 0.8 && g.userData.body.scale.y < 1.25);
        }
  }
});
test('switching styles or Reduced mid-action resets deformations and secondary motion', () => {
  const g = makeRobot('hunter'),
    p = robot('hunter', { actionPhase: 'active', actionTime: 0.06 });
  animateRobot(g, p, 0.016, 1, { reduced: false });
  assert.ok(g.userData.body.scale.y > 1);
  animateRobot(g, p, 0.016, 1, { reduced: true });
  assert.deepEqual(g.userData.body.scale.toArray(), [1, 1, 1]);
  assert.equal(g.userData.antenna.rotation.x, 0);
  animateRobot(g, p, 0.016, 1, { style: 'restrained', reduced: false });
  assert.deepEqual(g.userData.body.scale.toArray(), [1, 1, 1]);
});
test('siege animation applies to articulated arms and resets without changing actor position', () => {
  const g = new T.Group();
  g.userData = { body: new T.Group(), arms: [new T.Group(), new T.Group()] };
  g.position.set(4, 5, 6);
  applyEnemyPose(g, { ...robot(), elite: true, attackKind: 'siegeStomp' });
  assert.ok(g.userData.arms[0].rotation.z < 0);
  assert.ok(g.userData.arms[1].rotation.z > 0);
  assert.deepEqual(g.position.toArray(), [4, 5, 6]);
});
test('graphic accents share fixed buffers, respect Reduced, and do not mutate simulation state', () => {
  const parent = new T.Group(),
    flair = createEnemyFlair(parent),
    geometries = parent.children.map((g) => g.geometry),
    w = {
      time: 2,
      enemies: Array.from({ length: 100 }, (_, i) =>
        robot('hunter', { id: i, actionPhase: 'active', actionTime: 0.05, x: i * 10 }),
      ),
    };
  const before = JSON.stringify(w);
  for (let i = 0; i < 100; i++) flair.update(w, { reduced: false });
  assert.equal(parent.children.length, 2);
  assert.deepEqual(
    parent.children.map((g) => g.geometry),
    geometries,
  );
  assert.ok(flair.stats().lineVertices > 0);
  assert.ok(flair.stats().lineVertices <= flair.stats().maxVertices);
  assert.equal(JSON.stringify(w), before);
  parent.traverse((o) => {
    if (o.geometry) assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));
  });
  flair.update(w, { reduced: true });
  assert.ok(parent.children.every((o) => !o.visible && o.geometry.drawRange.count === 0));
  flair.update(w, { style: 'restrained', reduced: false });
  assert.equal(flair.stats().lineVertices, 0);
  flair.dispose();
  assert.equal(parent.children.length, 0);
});
test('robot ink shells batch by geometry and toon bands stay fixed across the horde', () => {
  const parent = new T.Group(),
    batch = createRobotBatch(parent),
    models = new Map(
      Array.from({ length: 56 }, (_, i) => [i, makeRobot(i % 2 ? 'hunter' : 'mender')]),
    );
  batch.update(models);
  const shells = parent.children.filter((o) => o.material.side === T.BackSide);
  assert.ok(shells.length > 0 && shells.length <= 3);
  const count = parent.children.length;
  for (const g of models.values())
    g.traverse((o) => {
      if (o.material?.isMeshToonMaterial) {
        assert.equal(o.material.gradientMap.minFilter, T.NearestFilter);
        assert.equal(o.material.gradientMap.magFilter, T.NearestFilter);
      }
    });
  for (let i = 0; i < 10; i++) batch.update(models);
  assert.equal(parent.children.length, count);
  batch.update(new Map());
  assert.ok(parent.children.every((o) => o.count === 0));
  batch.dispose();
  assert.equal(parent.children.length, 0);
});
test('co-op allows two to five simultaneous attackers as living team size grows', () => {
  for (const count of [1, 2, 3, 4]) {
    const players = Array.from({ length: count }, (_, i) => ({
        id: 'p' + i,
        hp: 125,
        x: 500,
        y: 0,
        altitude: 0,
      })),
      w = { players, time: 1, enemies: [] };
    assert.equal(enemyAttackSlots(w), count + 1);
    w.enemies = Array.from({ length: 8 }, (_, i) =>
      robot('needle', {
        id: i,
        actionPhase: 'idle',
        actionTime: 0,
        attackKind: null,
        cd: 0,
        speed: 0,
      }),
    );
    const api = {
      floor: () => 0,
      clear: () => true,
      move: () => {},
      waypoint: (_w, _e, t) => t,
      aimHeight: () => 32,
    };
    for (const e of w.enemies) stepEnemy(w, e, 0.01, api);
    assert.equal(w.enemies.filter((e) => e.actionPhase === 'windup').length, count + 1);
    w.players.forEach((p) => (p.hp = 0));
    assert.equal(enemyAttackSlots(w), 2);
  }
});
test('hectic cadence retains anticipation and stationary punish windows without long idle sequences', () => {
  assert.ok(Object.values(ENEMY_ATTACKS).every((a) => a.windup >= 0.32 && a.windup <= 0.86));
  assert.ok(Object.values(ENEMY_ATTACKS).every((a) => a.recovery >= 0.38 && a.recovery <= 1.15));
  assert.ok(
    ENEMY_ATTACKS.burst.windup + ENEMY_ATTACKS.burst.active + ENEMY_ATTACKS.burst.recovery < 1.25,
  );
  assert.ok(
    ENEMY_ATTACKS.pounce.windup + ENEMY_ATTACKS.pounce.active + ENEMY_ATTACKS.pounce.recovery < 1.3,
  );
});
test('Wisp strafes during a committed volley while its aim direction stays fixed', () => {
  const e = robot('wisp', {
      actionPhase: 'active',
      attackKind: 'burst',
      actionTime: 0.02,
      speed: 175,
      attackAngle: 0.3,
      fired: 1,
    }),
    w = { time: 2, players: [], enemies: [e] },
    angle = e.attackAngle;
  stepEnemy(w, e, 0.01, {
    floor: () => 0,
    move: (_w, p, vx, vy, dt) => {
      p.x += vx * dt;
      p.y += vy * dt;
    },
  });
  assert.ok(Math.hypot(e.x, e.y) > 0.8);
  assert.equal(e.attackAngle, angle);
  assert.equal(e.actionPhase, 'active');
});
