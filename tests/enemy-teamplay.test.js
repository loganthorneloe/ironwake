import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, testPlatform, DEFAULT_BUILD, step, setInput, snapshot } from '../dist/core.js';
import { coordinateEnemies, squadDestination } from '../dist/enemy-coordination.js';
import { recordTeamHit, stepTeamCombos } from '../dist/team-combos.js';
import { createCombatAudioTracker } from '../dist/combat-audio.js';
import { ENEMY_TELLS, playEnemyTell } from '../dist/sound-design.js';
import { enemyPose } from '../dist/enemy-motion.js';
import { createEnemyFlair } from '../dist/enemy-flair.js';
import * as T from '../dist/vendor/three.module.min.js';
const unit = (id, species = 'hunter', x = 500, y = 1000) => ({
  id,
  type: species === 'hunter' ? 'drone' : 'gunner',
  species,
  x,
  y,
  altitude: 0,
  hp: 1000,
  max: 1000,
  r: 20,
  speed: 175,
  bodyHeight: 40,
  stun: 0,
  cd: 0,
  actionPhase: 'idle',
});
function world(count = 2) {
  const w = newWorld(
    testPlatform(),
    Array.from({ length: count }, (_, i) => ({ id: 'p' + i, build: DEFAULT_BUILD })),
  );
  w.enemies = [];
  w.encounter = true;
  w.hazardTimer = 1e6;
  w.players.forEach((p, i) =>
    Object.assign(p, { x: 1000, y: 1000 + i * 80, hp: 125, recoverUntil: 1e6 }),
  );
  return w;
}
const tick = (w, time) => {
  for (let t = 0; t < time - 1e-8; t += 0.01) step(w, 0.01);
};
function hit(w, e, owner, kind = 'carbine', damage = 24) {
  w.bullets.push({
    id: w.id++,
    owner,
    kind,
    x: e.x - 2,
    y: e.y,
    z: 20,
    vx: 100,
    vy: 0,
    vz: 0,
    life: 0.1,
    damage,
    enemy: false,
    pierce: 1,
    hit: [],
    origin: { x: e.x - 2, y: e.y, z: 20 },
  });
  step(w, 0.01);
}

test('packs assign a staggered rush, opposite flanks, and a suppressor without global waiting', () => {
  const w = world(1);
  w.enemies = [
    unit(1),
    unit(2),
    unit(3, 'rammer'),
    unit(4, 'wisp'),
    unit(5, 'needle'),
    unit(6, 'scarab'),
  ];
  coordinateEnemies(w);
  const orders = w.enemies.map((e) => e.squadOrder);
  assert.ok(orders.every(Boolean));
  assert.equal(new Set(orders.map((o) => o.group)).size, 1);
  assert.equal(orders.filter((o) => o.kind === 'rush').length, 3);
  assert.equal(orders.filter((o) => o.kind === 'suppress').length, 1);
  const flanks = orders.filter((o) => o.kind === 'flank');
  assert.deepEqual(flanks.map((o) => o.side).sort(), [-1, 1]);
  assert.ok(flanks[0].y > 1000 && flanks[1].y < 1000);
  const rush = orders.filter((o) => o.kind === 'rush');
  assert.ok(rush[2].rushAt - rush[0].rushAt < 0.2);
  assert.ok(rush.every((o) => o.rushAt <= 0.34));
});
test('flankers move to opposite sides and cover still stops the ground flanker', () => {
  const w = world(1);
  w.mission.mode = 'station';
  w.mission.zones = [{ x: 4000, y: 2900 }];
  w.enemies = [unit(1, 'needle'), unit(2, 'scarab')];
  w.enemies.forEach((e) => (e.cd = 99));
  coordinateEnemies(w);
  tick(w, 0.15);
  assert.ok(w.enemies[0].y > 1000);
  assert.ok(w.enemies[1].y < 1000);
  const e = w.enemies[0];
  w.mission.obstacles = [{ x: e.x + e.r + 1, y: e.y - 300, w: 30, h: 600, height: 300 }];
  tick(w, 0.4);
  assert.ok(e.x <= w.mission.obstacles[0].x - e.r);
});
test('rush members continue moving, then use the full telegraph and fixed aim', () => {
  const w = world(1);
  w.enemies = [unit(1, 'hunter', 880), unit(2, 'hunter', 850)];
  step(w, 0.01);
  const e = w.enemies[0];
  assert.equal(e.actionPhase, 'idle');
  const x = e.x;
  tick(w, 0.12);
  assert.ok(e.x > x);
  tick(w, 0.1);
  assert.equal(e.actionPhase, 'windup');
  assert.ok(e.windup > 0.3);
  const aim = e.attackAngle;
  w.players[0].y += 200;
  tick(w, 0.25);
  assert.equal(e.attackAngle, aim);
});
test('orders expire quickly, abandon dead targets and staggered units, and never recruit objectives or rivals', () => {
  const w = world(1);
  w.enemies = [
    unit(1),
    unit(2),
    { ...unit(3), training: true },
    { ...unit(4), objective: true },
    { ...unit(5), type: 'rival' },
    { ...unit(6), elite: true },
  ];
  coordinateEnemies(w);
  assert.ok(w.enemies[0].squadOrder);
  assert.ok(w.enemies.slice(2).every((e) => !e.squadOrder));
  const first = w.enemies[0].squadOrder.group;
  w.time = 3;
  coordinateEnemies(w);
  assert.ok(w.enemies[0].squadOrder.group > first);
  w.enemies[0].stun = 2;
  w.time += 0.3;
  coordinateEnemies(w);
  assert.equal(w.enemies[0].squadOrder, undefined);
  w.players[0].hp = 0;
  w.time += 0.3;
  coordinateEnemies(w);
  assert.ok(w.enemies.every((e) => !e.squadOrder));
});
test('separate co-op fronts receive independent packs and orders serialize with their destinations', () => {
  const w = world(4);
  w.players.forEach((p, i) => {
    p.x = 500 + i * 1000;
    p.y = 500;
  });
  for (let i = 0; i < 4; i++)
    w.enemies.push(
      unit(i * 2 + 1, 'hunter', 200 + i * 1000, 500),
      unit(i * 2 + 2, 'rammer', 250 + i * 1000, 500),
    );
  coordinateEnemies(w);
  assert.equal(new Set(w.enemies.map((e) => e.squadOrder.targetId)).size, 4);
  const remote = JSON.parse(JSON.stringify(snapshot(w)));
  assert.deepEqual(
    remote.enemies.map((e) => e.squadOrder),
    w.enemies.map((e) => e.squadOrder),
  );
  assert.ok(squadDestination(w, w.enemies[0], w.players[0]).speed > 1);
});
test('two real pilots can Cross Break with actual weapons; damage stays additive and stun cannot lock permanently', () => {
  const w = world(),
    e = unit(1, 'scarab', 600);
  e.speed = 0;
  e.cd = 99;
  w.enemies = [e];
  hit(w, e, 'p0');
  hit(w, e, 'p1');
  assert.equal(w.teamCombos.length, 0);
  hit(w, e, 'p0');
  assert.equal(e.hp, 928);
  assert.equal(w.teamCombos.length, 1);
  assert.equal(w.teamCombos[0].label, 'CROSS BREAK');
  assert.deepEqual(w.teamCombos[0].owners, ['p0', 'p1']);
  assert.ok(e.stun > 0.2);
  for (let i = 0; i < 5; i++) {
    hit(w, e, i % 2 ? 'p0' : 'p1');
  }
  assert.equal(w.teamCombos.length, 1);
  tick(w, 0.4);
  assert.equal(e.stun, 0);
});
test('same-pilot spam, stale tags, DOT, unknown/downed owners, objectives and targets cannot manufacture team combos', () => {
  const w = world(),
    e = unit(1);
  w.time = 1;
  for (let i = 0; i < 10; i++) recordTeamHit(w, e, 30, 'p0', 'carbine');
  assert.equal(w.teamCombos, undefined);
  w.time = 2;
  recordTeamHit(w, e, 30, 'p1', 'carbine');
  assert.equal(w.teamCombos, undefined);
  recordTeamHit(w, e, 30, 'p0', 'burn');
  recordTeamHit(w, e, 30, 'forged', 'carbine');
  w.players[0].hp = 0;
  recordTeamHit(w, e, 30, 'p0', 'carbine');
  assert.equal(w.teamCombos, undefined);
  w.players[0].hp = 125;
  for (const target of [
    { ...e, training: true },
    { ...e, objective: true },
  ])
    assert.equal(recordTeamHit(w, target, 100, 'p0', 'carbine'), null);
});
test('cooperative kills promote a break into Team Finish without duplicate kill credit or ledger replication', () => {
  const w = world(),
    e = unit(1, 'scarab', 600);
  e.speed = 0;
  e.cd = 99;
  e.hp = e.max = 120;
  w.enemies = [e];
  hit(w, e, 'p0');
  hit(w, e, 'p1');
  hit(w, e, 'p0');
  assert.equal(w.teamCombos[0].kind, 'break');
  hit(w, e, 'p1');
  hit(w, e, 'p0');
  assert.equal(w.kills, 1);
  assert.equal(w.enemies.length, 0);
  assert.equal(w.teamCombos.at(-1).kind, 'finish');
  assert.equal(w.teamCombos.at(-1).label, 'TEAM FINISH');
  assert.equal(recordTeamHit(w, e, 20, 'p1', 'carbine'), null);
  const remote = snapshot({ ...w, enemies: [e] });
  assert.equal(remote.enemies[0].teamHits, undefined);
  assert.deepEqual(remote.teamCombos, w.teamCombos);
});
test('combo events and ledgers stay bounded, expire, and respect existing stagger protection', () => {
  const w = world(),
    e = unit(1, 'scarab', 600);
  e.speed = 0;
  e.cd = 99;
  e.staggerReadyAt = 100;
  w.enemies = [e];
  for (let i = 0; i < 4; i++) hit(w, e, i % 2 ? 'p1' : 'p0');
  assert.equal(e.stun, 0);
  assert.ok(w.teamCombos.length > 0);
  for (let i = 0; i < 40; i++) {
    const target = unit(i);
    recordTeamHit(w, target, 40, 'p0', 'carbine');
    recordTeamHit(w, target, 40, 'p1', 'carbine');
  }
  assert.equal(w.teamCombos.length, 12);
  w.time += 1;
  stepTeamCombos(w);
  assert.equal(w.teamCombos.length, 0);
  for (let i = 0; i < 100; i++) recordTeamHit(w, e, 10, 'p0', 'carbine');
  assert.ok(e.teamHits.length <= 32);
});
test('anime combo recoil is local and Reduced retains gameplay without extra motion', () => {
  const e = { ...unit(1), comboAt: 1, stun: 0.2 },
    plain = enemyPose({ ...e, comboAt: undefined }, { time: 1.15 }),
    react = enemyPose(e, { time: 1.15 }),
    reduced = enemyPose(e, { time: 1.15, reduced: true });
  assert.ok(react.pitch < plain.pitch);
  assert.equal(reduced.pitch, plain.pitch);
  const parent = new T.Group(),
    flair = createEnemyFlair(parent),
    w = {
      time: 1.15,
      enemies: [],
      teamCombos: [{ id: 1, at: 1, x: 0, y: 0, z: 20, kind: 'finish' }],
    };
  flair.update(w, { reduced: false });
  assert.ok(flair.stats().lineVertices > 0);
  flair.update(w, { reduced: true });
  assert.equal(flair.stats().lineVertices, 0);
  flair.dispose();
});
const listener = { id: 'p', hp: 125, x: 0, y: 0, angle: 0 };
const warning = (id, species = 'needle', x = 100, y = 0) => ({
  ...unit(id, species, x, y),
  actionPhase: 'windup',
  actionTime: 0.05,
  actionCount: 1,
  attackTarget: 'p',
});
test('warning cues are distinct, directional, range-scaled and emitted once per committed attack', () => {
  const tracker = createCombatAudioTracker(),
    w = { time: 1, enemies: [warning(1, 'needle', 0, 100), warning(2, 'rammer', 0, -100)] };
  const cues = tracker.collect(w, listener);
  assert.equal(cues.length, 2);
  assert.ok(cues.find((c) => c.cue === 'needle').pan > 0);
  assert.ok(cues.find((c) => c.cue === 'rammer').pan < 0);
  assert.equal(tracker.collect(w, listener).length, 0);
  w.time += 0.2;
  w.enemies[0].actionCount++;
  assert.equal(tracker.collect(w, listener).length, 1);
  assert.equal(
    new Set(Object.values(ENEMY_TELLS).map((p) => JSON.stringify(p))).size,
    Object.keys(ENEMY_TELLS).length,
  );
});
test('crowds have a strict sound budget and discarded cues never replay as a stale queue', () => {
  const tracker = createCombatAudioTracker(),
    w = {
      time: 1,
      enemies: Array.from({ length: 56 }, (_, i) =>
        warning(i, i % 2 ? 'wisp' : 'needle', 100 + i, 0),
      ),
    };
  assert.equal(tracker.collect(w, listener).length, 3);
  w.time += 0.01;
  w.enemies.forEach((e) => e.actionCount++);
  assert.equal(tracker.collect(w, listener).length, 0);
  w.time += 0.13;
  assert.equal(tracker.collect(w, listener).length, 0);
  w.enemies[0].actionCount++;
  assert.equal(tracker.collect(w, listener).length, 1);
  const edge = createCombatAudioTracker(),
    v = { time: 0, enemies: [] };
  edge.collect(v, listener);
  v.time = 0.11;
  v.enemies = [warning(1), warning(2), warning(3)];
  assert.equal(edge.collect(v, listener).length, 3);
  v.time = 0.121;
  v.enemies.forEach((e) => e.actionCount++);
  assert.equal(
    edge.collect(v, listener).length,
    0,
    'crossing a window boundary cannot double the voice burst',
  );
});
test('muted, stale, canceled, dead and distant attacks stay quiet; combo and rush cues deduplicate', () => {
  const tracker = createCombatAudioTracker(),
    e = warning(1),
    w = { time: 1, enemies: [e] };
  assert.equal(tracker.collect(w, listener, false).length, 0);
  assert.equal(tracker.collect(w, listener, true).length, 0);
  tracker.reset();
  e.stun = 1;
  assert.equal(tracker.collect(w, listener).length, 0);
  e.stun = 0;
  e.actionTime = 0.3;
  assert.equal(tracker.collect(w, listener).length, 0);
  e.actionTime = 0.05;
  e.x = 2000;
  assert.equal(tracker.collect(w, listener).length, 0);
  tracker.reset();
  e.x = 100;
  e.actionPhase = 'idle';
  e.squadOrder = { kind: 'rush', group: 1, start: 1, rushAt: 1.18 };
  w.teamCombos = [{ id: 4, kind: 'break', at: 1, x: 100, y: 0 }];
  const cues = tracker.collect(w, listener);
  assert.ok(cues.some((c) => c.cue === 'rush'));
  assert.ok(cues.some((c) => c.cue === 'teamBreak'));
  assert.equal(tracker.collect(w, listener).length, 0);
});
function fakeAudio() {
  const sources = [],
    nodes = [],
    param = () => ({
      value: 0,
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
      linearRampToValueAtTime() {},
    });
  const node = (extra) => {
    const n = {
      connected: false,
      disconnected: false,
      connect() {
        this.connected = true;
      },
      disconnect() {
        this.disconnected = true;
      },
      ...extra,
    };
    nodes.push(n);
    return n;
  };
  const source = (noise) => {
    const n = node({
      frequency: param(),
      start(at) {
        this.startAt = at;
      },
      stop(at) {
        this.stopAt = at;
      },
    });
    sources.push(n);
    return n;
  };
  return {
    state: 'running',
    currentTime: 10,
    sampleRate: 8000,
    sources,
    nodes,
    createOscillator: () => source(false),
    createBufferSource: () => source(true),
    createGain: () => node({ gain: param() }),
    createBiquadFilter: () => node({ frequency: param(), Q: param() }),
    createStereoPanner: () => node({ pan: param() }),
    createBuffer: (_c, n) => ({ getChannelData: () => new Float32Array(n) }),
  };
}
test('every procedural tell schedules two short voices and disconnects all transient audio nodes', () => {
  const ctx = fakeAudio();
  for (const cue of Object.keys(ENEMY_TELLS)) playEnemyTell(ctx, {}, { cue, gain: 0.5, pan: -0.4 });
  assert.equal(ctx.sources.length, Object.keys(ENEMY_TELLS).length * 2);
  assert.ok(
    ctx.sources.every((s) => s.startAt >= 10 && s.stopAt > s.startAt && s.stopAt - 10 < 0.4),
  );
  for (const s of ctx.sources) s.onended();
  assert.ok(ctx.nodes.every((n) => n.disconnected));
});
