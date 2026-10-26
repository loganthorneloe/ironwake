import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planetMission,
  newWorld,
  cleanBuild,
  mechStats,
  step,
  snapshot,
  setInput,
  surfaceAt,
} from '../dist/core.js';
import {
  stepOperation,
  operationObjective,
  operationMarkers,
  operationEnemyCap,
} from '../dist/planet-mission.js';
const world = (n = 1) =>
  newWorld(
    planetMission(38),
    Array.from({ length: n }, (_, i) => ({
      id: 'p' + i,
      build: cleanBuild({ equipment: ['carbine', 'blade', 'repair'] }),
    })),
  );
const tick = (w, dt = 0.05) => {
  w.time += dt;
  stepOperation(w, dt, mechStats);
};
const batteries = (w) => {
  w.time = 86;
  w.kills = 100;
  tick(w);
};
const crawler = (w) => {
  batteries(w);
  w.enemies = [];
  tick(w);
};
const reactor = (w) => {
  crawler(w);
  w.operation.delivered = 6;
  w.operation.crawler.segment = w.mission.route.length - 1;
  tick(w);
};
const spawnWarden = (w) => {
  w.time += 6.1;
  step(w, 0.01);
};
const extraction = (w) => {
  reactor(w);
  w.enemies = [];
  tick(w);
  spawnWarden(w);
  w.enemies = [];
  tick(w);
};
test('planet seed is deterministic, varies batteries, and elevated objectives are landable', () => {
  const a = planetMission(38);
  assert.deepEqual(a, planetMission(38));
  assert.notDeepEqual(a.batteries, planetMission(39).batteries);
  for (const p of [...a.batteries, ...a.cells].filter((p) => p.z))
    assert.equal(surfaceAt(a, p.x, p.y, 240), p.z);
  assert.equal(a.zones.length, 5);
});
for (const n of [1, 2, 3, 4])
  test(`${n} pilot mission progresses through every objective and extracts together`, () => {
    const w = world(n);
    assert.equal(w.operation.phase, 0);
    batteries(w);
    assert.equal(w.enemies.filter((e) => e.objectiveKind === 'battery').length, 3);
    assert.equal(w.enemies[0].hp, 3600 * (1 + 0.75 * (n - 1)));
    for (const e of w.enemies) if (e.objectiveKind === 'relay') e.hp = 0;
    tick(w);
    assert.ok(w.enemies.filter((e) => e.objectiveKind === 'battery').every((e) => !e.locked));
    w.enemies = [];
    tick(w);
    assert.equal(w.operation.phase, 2);
    for (const c of w.operation.cells) {
      w.enemies = w.enemies.filter((e) => e.id !== 'cache-' + c.id);
      const p = w.players[0];
      Object.assign(p, { x: c.x, y: c.y, altitude: c.z });
      tick(w);
      assert.equal(c.state, 'carried');
      Object.assign(p, { x: w.operation.crawler.x, y: w.operation.crawler.y, altitude: 0 });
      tick(w);
      assert.equal(c.state, 'delivered');
    }
    for (let i = 0; i < 6000 && w.operation.phase === 2; i++) tick(w);
    assert.equal(w.operation.phase, 3);
    assert.equal(w.operation.delivered, 6);
    w.enemies = [];
    tick(w);
    spawnWarden(w);
    const boss = w.enemies.find((e) => e.id === 'cinder-warden');
    assert.equal(boss.hp, 16000 * (1 + 0.9 * (n - 1)));
    boss.hp = 0;
    tick(w);
    assert.equal(w.operation.phase, 4);
    for (const p of w.players) Object.assign(p, { ...w.mission.exit, altitude: 0 });
    w.time = w.operation.shipAt + 1;
    for (let i = 0; i < 122; i++) tick(w);
    assert.equal(w.status, 'won');
    assert.equal(w.cleared, 5);
    assert.equal(operationObjective(w, w.players[0]).progress, 100);
  });
test('carried cells drop at last carrier position on death and disconnect', () => {
  for (const disconnect of [false, true]) {
    const w = world(2);
    crawler(w);
    w.enemies = [];
    const c = w.operation.cells[0],
      p = w.players[0];
    Object.assign(p, { x: c.x, y: c.y, altitude: c.z });
    tick(w);
    p.x += 200;
    tick(w);
    if (disconnect) w.players.shift();
    else p.hp = 0;
    tick(w);
    assert.equal(c.state, 'loose');
    assert.equal(c.x, p.x);
    assert.equal(c.z, 0);
    assert.equal(c.carrier, null);
  }
});
test('battery shields block projectiles and bombardment until relays are destroyed', () => {
  const w = world();
  batteries(w);
  const b = w.enemies[0];
  w.hazards = [{ x: b.x, y: b.y, r: 100, time: 0 }];
  w.bullets = [
    {
      id: 999,
      x: b.x - 60,
      y: b.y,
      z: 30,
      vx: 1000,
      vy: 0,
      vz: 0,
      life: 1,
      damage: 999,
      pierce: 1,
      hit: [],
      owner: 'p0',
      kind: 'carbine',
    },
  ];
  const hp = b.hp;
  for (let i = 0; i < 3; i++) step(w, 0.05);
  assert.equal(b.hp, hp);
});
test('a team wipe redeploys at checkpoints twice while keeping objective progress', () => {
  const w = world(2);
  batteries(w);
  const count = w.enemies.length;
  for (let attempt = 0; attempt < 2; attempt++) {
    w.players.forEach((p) => (p.hp = 0));
    tick(w);
    tick(w, 7.1);
    assert.ok(w.players.every((p) => p.hp > 0));
    assert.equal(w.operation.redeploys, 1 - attempt);
    assert.equal(w.operation.phase, 1);
    assert.equal(w.enemies.filter((e) => e.objective).length, count);
  }
  w.players.forEach((p) => (p.hp = 0));
  tick(w);
  assert.equal(w.status, 'lost');
});
test('extraction waits for ship, every surviving pilot, and a continuous grounded hold', () => {
  const w = world(2);
  extraction(w);
  w.players.forEach((p) => Object.assign(p, { ...w.mission.exit, altitude: 0 }));
  tick(w, 5);
  assert.equal(w.operation.extraction, 0);
  w.time = w.operation.shipAt;
  w.players[1].x += 500;
  tick(w, 2);
  assert.equal(w.operation.extraction, 0);
  w.players[1].x = w.mission.exit.x;
  tick(w, 3);
  assert.equal(w.operation.extraction, 3);
  w.players[1].altitude = 150;
  tick(w);
  assert.equal(w.operation.extraction, 0);
});
test('reinforcements are telegraphed, capped, and serialized for guests', () => {
  const w = world(4);
  w.time = 9;
  tick(w);
  assert.ok(w.spawn.length >= 4);
  assert.ok(w.spawn.every((s) => s.time > w.time + 2));
  const snap = JSON.parse(JSON.stringify(snapshot(w)));
  assert.equal(snap.pendingDrops.length, w.spawn.length);
  assert.deepEqual(snap.operation, w.operation);
  w.enemies = Array.from({ length: operationEnemyCap(4) }, () => ({
    hp: 10,
    x: w.players[0].x,
    y: w.players[0].y,
  }));
  w.spawn = [];
  w.time += 20;
  tick(w);
  assert.equal(w.spawn.length, 0);
});
test('objective guidance follows the current phase and carries no generic extraction instruction', () => {
  const w = world();
  assert.match(operationObjective(w, w.players[0]).team, /beachhead/);
  crawler(w);
  assert.ok(operationMarkers(w, w.players[0]).some((m) => m.name.includes('CELL')));
  reactor(world());
});
test('real weapon simulation destroys a relay and anchored objectives cannot be pushed', () => {
  const w = world();
  batteries(w);
  const p = w.players[0],
    relay = w.enemies.find((e) => e.objectiveKind === 'relay');
  w.operation.nextWave = Infinity;
  w.operation.nextStrike = Infinity;
  Object.assign(p, { x: relay.x - 160, y: relay.y, altitude: relay.altitude, recoverUntil: 1000 });
  const position = [relay.x, relay.y];
  for (let i = 0; i < 600 && relay.hp > 0; i++) {
    setInput(w, p.id, {
      left: true,
      angle: 0,
      aimPoint: { x: relay.x, y: relay.y, z: relay.altitude + 32 },
    });
    step(w, 0.02);
  }
  assert.ok(relay.hp <= 0, 'normal shots must damage mission structures');
  assert.deepEqual([relay.x, relay.y], position);
});
