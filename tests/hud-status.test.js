import test from 'node:test';
import assert from 'node:assert/strict';
import { taskStatus } from '../dist/hud-status.js';
import { mapPoint } from '../dist/nearby-map.js';
const p = { id: 'self', x: 0, y: 0, hp: 100 },
  w = () => ({
    mission: { mode: 'sandbox', zones: [] },
    players: [p],
    enemies: [],
    hazards: [],
    zoneIndex: 0,
  });
test('warnings take priority over tasks and clear when danger passes', () => {
  const world = w();
  assert.equal(taskStatus(world, p, 0).warning, undefined);
  world.enemies = [{ x: -100, y: 0, hp: 100 }];
  assert.equal(taskStatus(world, p, 0).label, 'CONTACT BEHIND');
  world.hazards = [{ x: 0, y: 0, r: 80 }];
  assert.equal(taskStatus(world, p, 0).label, 'INCOMING STRIKE');
  assert.equal(taskStatus(world, { ...p, hp: 0 }, 0).label, 'MECH DISABLED');
  world.hazards = [];
  world.enemies[0].hp = 0;
  assert.equal(taskStatus(world, p, 0).label, 'TEST YOUR LOADOUT');
});
test('training targets do not trigger false combat warnings; downed allies do', () => {
  const world = w();
  world.enemies = [{ x: -100, y: 0, hp: 100, training: true }];
  assert.equal(taskStatus(world, p, 0).warning, undefined);
  world.players.push({ id: 'ally', hp: 0 });
  assert.equal(taskStatus(world, p, 0).label, 'PILOT DOWN');
});
test('mission tasks follow approach, encounter and extraction', () => {
  const world = w();
  world.mission = { zones: [{ x: 100, y: 0, name: 'DOCK' }] };
  assert.equal(taskStatus(world, p, 0).label, 'ADVANCE TO SECTOR 1');
  world.encounter = true;
  assert.equal(taskStatus(world, p, 0).label, 'CLEAR THE SECTOR');
  world.encounter = false;
  world.zoneIndex = 1;
  assert.equal(taskStatus(world, p, 0).label, 'REGROUP AT EXTRACTION');
  world.extractTime = 1;
  assert.equal(taskStatus(world, p, 0).label, 'EXTRACTING SQUAD');
});
test('vicinity map tracks the player while preserving north and consistent contact scale', () => {
  assert.deepEqual(mapPoint(100, 200, { x: 100, y: 200 }), { x: 90, y: 90 });
  assert.deepEqual(mapPoint(750, 200, { x: 100, y: 200 }), { x: 170, y: 90 });
  assert.deepEqual(mapPoint(100, -450, { x: 100, y: 200 }), { x: 90, y: 10 });
});

test('objective screen separates personal instructions from shared mission progress', async () => {
  const { objectiveStatus } = await import('../dist/hud-status.js');
  const world = w();
  assert.equal(objectiveStatus(world, p).personal, 'Test your mech');
  assert.equal(objectiveStatus(world, p).progress, null);
  world.mission = {
    zones: [
      { name: 'DOCK', x: 300, y: 0 },
      { name: 'REACTOR', x: 900, y: 0 },
    ],
  };
  world.cleared = 0;
  world.spawn = [{}, {}];
  let s = objectiveStatus(world, p);
  assert.equal(s.personal, 'Reach DOCK');
  assert.equal(s.team, 'Advance together');
  world.encounter = true;
  world.enemies = [{ hp: 100 }, { hp: 0 }];
  s = objectiveStatus(world, p);
  assert.equal(s.team, 'Clear the sector');
  assert.match(s.teamDetail, /3 hostiles/);
  world.players.push({ id: 'ally', hp: 0 });
  assert.equal(objectiveStatus(world, p).personal, 'Recover your teammate');
  assert.equal(objectiveStatus(world, { ...p, hp: 0 }).personal, 'Wait for recovery');
  world.players = [p];
  world.zoneIndex = 2;
  world.cleared = 2;
  world.encounter = false;
  world.extractTime = 1;
  assert.equal(objectiveStatus(world, p).team, 'Hold for extraction');
  world.status = 'won';
  assert.equal(objectiveStatus(world, p).team, 'Mission complete');
  world.status = 'lost';
  assert.equal(objectiveStatus(world, p).team, 'Mission failed');
});
test('ultimate display follows real active duration, cooldown, readiness and disabled states', async () => {
  const { ultimateStatus } = await import('../dist/hud-status.js');
  const ability = { cd: 20 };
  assert.deepEqual(ultimateStatus({ ...p, abilityCd: 0 }, ability), {
    state: 'ready',
    percent: 100,
    counter: 'READY',
    detail: 'PRESS E TO ACTIVATE',
    ready: true,
  });
  const active = ultimateStatus({ ...p, abilityCd: 18, active: 6 }, ability);
  assert.equal(active.state, 'active');
  assert.equal(active.counter, '18.0s');
  assert.equal(active.detail, 'ACTIVE · 6.0s');
  assert.equal(active.ready, false);
  const charging = ultimateStatus({ ...p, abilityCd: 10, active: 0 }, ability);
  assert.equal(charging.percent, 50);
  assert.equal(charging.state, 'charging');
  assert.equal(ultimateStatus({ ...p, hp: 0 }, ability).ready, false);
  assert.equal(ultimateStatus(p, null).state, 'unavailable');
  assert.equal(ultimateStatus({ ...p, abilityCd: 50 }, ability).percent, 0);
});
test('network clients receive the same team hostile count including pending spawns', async () => {
  const { newWorld, mission, snapshot, DEFAULT_BUILD } = await import('../dist/core.js');
  const { objectiveStatus } = await import('../dist/hud-status.js');
  const world = newWorld(mission(42), [{ id: 'self', build: DEFAULT_BUILD }]);
  world.encounter = true;
  world.spawn = [{ time: 1 }, { time: 2 }];
  world.enemies = [{ hp: 100 }];
  const remote = snapshot(world);
  assert.equal(
    objectiveStatus(remote, remote.players[0]).teamDetail,
    objectiveStatus(world, world.players[0]).teamDetail,
  );
});
