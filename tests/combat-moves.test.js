import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newWorld,
  testPlatform,
  combatTrial,
  DEFAULT_BUILD,
  setInput,
  step,
  snapshot,
  COMBAT_MOVES,
  FRAMES,
} from '../dist/core.js';
const make = () => {
  const w = newWorld(testPlatform(), [{ id: 'p', build: DEFAULT_BUILD }]);
  w.players[0].x = w.players[0].y = 0;
  w.enemies = [];
  return w;
};
const tick = (w, input = {}, n = 1) => {
  for (let i = 0; i < n; i++) {
    setInput(w, 'p', input);
    step(w, 1 / 60);
  }
};
const target = (id, x, y, altitude = 0) => ({
  id,
  x,
  y,
  altitude,
  hp: 1000,
  max: 1000,
  training: true,
  r: 18,
  stun: 0,
});
test('AI moves immediately and fires within 1.2 seconds', () => {
  const w = newWorld(combatTrial(), [{ id: 'p', build: DEFAULT_BUILD }]);
  step(w, 0.016);
  assert.notEqual(w.enemies[0].y, -520);
  tick(w, {}, 71);
  assert.ok(w.enemies[0].shotCount > 0);
});
test('dash follows movement direction and shares one three-second cooldown', () => {
  const w = make(),
    p = w.players[0];
  tick(w, { dash: true, x: -1, angle: 0 });
  assert.equal(p.moveKind, 'dash');
  assert.equal(p.dashCd, 3);
  assert.equal(p.evadeCd, undefined);
  assert.equal(p.ramCd, undefined);
  assert.ok(p.x < -20);
  assert.ok(Math.abs(p.y) < 0.001);
  tick(w, {}, 20);
  assert.equal(p.moveTime, 0);
  assert.ok(Math.abs(p.x + 400) < 0.01);
  tick(w, { dash: true });
  assert.equal(p.moveCount, 1);
  tick(w, {}, 240);
  tick(w, { dash: true, angle: 0 });
  assert.equal(p.moveCount, 2);
  assert.equal(p.dashCd, 3);
});
test('every frame gets the same damaging dash without an equipment requirement', () => {
  for (const frame of Object.keys(FRAMES)) {
    const w = newWorld(testPlatform(), [{ id: 'p', build: { ...DEFAULT_BUILD, frame } }]);
    tick(w, { dash: true });
    assert.equal(w.players[0].moveKind, 'dash');
    assert.equal(w.players[0].dashCd, 3);
  }
  assert.deepEqual(Object.keys(COMBAT_MOVES), ['dash']);
});
test('removed evade and ram inputs cannot activate another move', () => {
  const w = make();
  tick(w, { evade: true, ram: true });
  assert.equal(w.players[0].moveCount, 0);
  assert.equal(w.players[0].dashCd, 0);
});
test('dash sweeps through multiple targets, deals damage only once to each, and pauses guns', () => {
  const w = make(),
    p = w.players[0];
  w.enemies = [target(1, 80, 0), target(2, 180, 0), target(3, 300, 0), target(4, 180, 150)];
  tick(w, { dash: true, angle: 0, left: true, right: true });
  assert.equal(p.moveKind, 'dash');
  assert.equal(p.shotCount, 0);
  tick(w, {}, 20);
  assert.ok(Math.abs(p.x - 400) < 0.01);
  assert.deepEqual(
    w.enemies.map((e) => e.hp),
    [840, 840, 840, 1000],
  );
  assert.equal(p.hits, 3);
  assert.ok(w.damageEvents.every((e) => e.kind === 'dash' && e.amount === 160));
});
test('airborne dash maintains altitude and can be aimed vertically', () => {
  const w = make(),
    p = w.players[0];
  p.altitude = 150;
  w.enemies = [target(1, 150, 0, 150)];
  tick(w, { dash: true, angle: 0 });
  tick(w, {}, 15);
  assert.equal(p.altitude, 150);
  assert.equal(w.enemies[0].hp, 840);
  const up = make();
  tick(up, { dash: true, angle: 0, pitch: 0.5 });
  tick(up, {}, 10);
  assert.ok(up.players[0].altitude > 90);
});
test('dash has no separate defensive damage reduction', () => {
  for (const dash of [false, true]) {
    const w = make(),
      p = w.players[0],
      hp = p.hp;
    tick(w, { dash, angle: 0 });
    w.bullets.push({
      id: 100,
      enemy: true,
      x: p.x + (dash ? 1250 / 60 : 0),
      y: p.y,
      z: 30,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 1,
      damage: 40,
    });
    tick(w, {});
    assert.ok(Math.abs(p.hp - (hp - 24)) < 0.001);
  }
});
test('dash does not tunnel through a wall or damage a target behind it', () => {
  const w = make(),
    p = w.players[0];
  w.mission.mode = 'mission';
  w.mission.width = w.mission.height = 2000;
  p.x = p.y = 200;
  w.mission.obstacles = [{ x: 260, y: 100, w: 8, h: 200, height: 100 }];
  w.enemies = [target(1, 300, 200)];
  tick(w, { dash: true, angle: 0 });
  tick(w, {}, 22);
  assert.ok(p.x < 240);
  assert.equal(w.enemies[0].hp, 1000);
});
test('disabled pilots cannot dash and snapshots preserve recharge and active movement', () => {
  const w = make(),
    p = w.players[0];
  tick(w, { dash: true });
  const remote = JSON.parse(JSON.stringify(snapshot(w)));
  assert.equal(remote.players[0].dashCd, COMBAT_MOVES.dash.cd);
  assert.ok(remote.players[0].moveTime > 0);
  p.hp = 0;
  tick(w, { dash: true });
  assert.equal(p.moveCount, 1);
  assert.equal(p.moveTime, 0);
});
