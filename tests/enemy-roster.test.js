import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, planetMission, step, mechStats, snapshot, setInput } from '../dist/core.js';
import { queueHeavyDrop, stepOperation } from '../dist/planet-mission.js';
import { taskStatus, hullStatus } from '../dist/hud-status.js';
const make = (n = 1) => {
  const w = newWorld(
    planetMission(39),
    Array.from({ length: n }, (_, i) => ({
      id: 'p' + i,
      build: { equipment: ['carbine', 'blade', 'emp'] },
    })),
  );
  w.operation.nextWave = 1e6;
  w.operation.nextStrike = 1e6;
  w.players.forEach((p) => (p.recoverUntil = 1e6));
  return w;
};
const tick = (w, n = 1) => {
  for (let i = 0; i < n; i++) step(w, 0.05);
};
test('ordinary reinforcements are fragile robots with distinct physical profiles', () => {
  const w = make();
  w.spawn = ['drone', 'gunner', 'tank'].map((type, i) => ({
    time: 0,
    type,
    zone: { x: 1200 + i * 150, y: 1100, operation: true, exact: true },
  }));
  tick(w);
  assert.deepEqual(
    w.enemies.map((e) => e.species),
    ['hunter', 'wisp', 'scarab'],
  );
  assert.deepEqual(
    w.enemies.map((e) => e.max),
    [90, 65, 160],
  );
  assert.deepEqual(
    w.enemies.map((e) => e.bodyHeight),
    [40, 34, 38],
  );
  assert.ok(w.enemies.every((e) => !e.elite && !e.landing));
  assert.equal(w.enemies[1].altitude, 100);
});
test('heavy arrival warns before a real descent, impacts once, and replicates to guests', () => {
  const w = make(),
    p = w.players[0];
  queueHeavyDrop(w, { x: p.x + 400, y: p.y });
  assert.equal(w.enemies.length, 0);
  assert.equal(taskStatus(w, p, 0).label, 'HOSTILE MECH INBOUND');
  tick(w, 121);
  const e = w.enemies[0];
  assert.ok(e.elite && e.landing);
  assert.equal(e.max, 3600);
  assert.ok(e.altitude > 500);
  assert.equal(e.windup, 0);
  const remote = JSON.parse(JSON.stringify(snapshot(w)));
  assert.deepEqual(remote.operation.heavyAlert, w.operation.heavyAlert);
  assert.equal(taskStatus(remote, remote.players[0], 0).heavy, true);
  tick(w, 40);
  assert.equal(e.landing, false);
  assert.ok(w.effects.some((f) => f.weapon === 'landing'));
  assert.equal(taskStatus(w, p, 0).label, 'SIEGE MECH LANDED');
  const impacts = w.effects.filter((f) => f.weapon === 'landing').length;
  tick(w);
  assert.equal(w.effects.filter((f) => f.weapon === 'landing').length, impacts);
});
test('landing impact harms grounded pilots once; flight avoids it', () => {
  for (const flight of [false, true]) {
    const w = make(),
      p = w.players[0];
    p.recoverUntil = 0;
    queueHeavyDrop(w, { x: p.x, y: p.y });
    for (let i = 0; i < 158; i++) {
      setInput(w, p.id, { fly: flight });
      step(w, 0.05);
    }
    assert.equal(p.hp < mechStats(p.build).hp, !flight);
  }
});
test('siege drops are limited to one in each of two phases, with no simultaneous siege arrivals', () => {
  const w = make();
  w.operation.phase = 1;
  w.operation.phaseAt = 0;
  w.operation.batteriesDown = [];
  w.enemies = [
    {
      id: 'battery-0',
      objective: true,
      locked: true,
      hp: 100,
      group: 0,
      x: 2000,
      y: 2000,
      altitude: 0,
    },
  ];
  w.time = 30;
  stepOperation(w, 0.01, mechStats);
  assert.equal(w.spawn.filter((s) => s.zone.elite).length, 1);
  stepOperation(w, 0.01, mechStats);
  assert.equal(w.spawn.filter((s) => s.zone.elite).length, 1);
  w.operation.phase = 2;
  w.operation.phaseAt = 0;
  w.time = 80;
  stepOperation(w, 0.01, mechStats);
  assert.equal(w.spawn.filter((s) => s.zone.elite).length, 1);
  w.spawn = [];
  stepOperation(w, 0.01, mechStats);
  assert.equal(w.spawn.filter((s) => s.zone.elite).length, 1);
  assert.deepEqual(w.operation.elitePhases, [1, 2]);
  w.spawn = [];
  stepOperation(w, 0.01, mechStats);
  assert.equal(w.spawn.filter((s) => s.zone.elite).length, 0);
});
test('robots do not cause repeated CONTACT BEHIND banners, but heavies still do', () => {
  const w = make(),
    p = w.players[0];
  w.time = 20;
  w.enemies = [{ x: p.x - 50, y: p.y, hp: 60, species: 'wisp' }];
  assert.notEqual(taskStatus(w, p, 0).label, 'CONTACT BEHIND');
  delete w.enemies[0].species;
  assert.equal(taskStatus(w, p, 0).label, 'CONTACT BEHIND');
});
test('hull display clamps damage and tracks repair, critical state and death', () => {
  assert.deepEqual(hullStatus({ hp: 100 }, 140), {
    current: 100,
    max: 140,
    percent: 71,
    state: 'online',
  });
  assert.equal(hullStatus({ hp: 30 }, 140).state, 'critical');
  assert.equal(hullStatus({ hp: 70 }, 140).state, 'damaged');
  assert.equal(hullStatus({ hp: 160 }, 140).current, 140);
  assert.equal(hullStatus({ hp: -2 }, 140).state, 'offline');
  assert.equal(hullStatus({ hp: -2 }, 140).percent, 0);
});
test('checkpoint redeploy never deletes a nearby siege mech or boss', () => {
  const w = make();
  queueHeavyDrop(w, w.mission.entry, true);
  tick(w, 160);
  const boss = w.enemies.find((e) => e.id === 'cinder-warden');
  assert.ok(boss);
  w.players[0].hp = 0;
  stepOperation(w, 0.01, mechStats);
  w.time += 7.1;
  stepOperation(w, 0.01, mechStats);
  assert.ok(w.enemies.includes(boss));
  assert.equal(w.operation.redeploys, 1);
});
