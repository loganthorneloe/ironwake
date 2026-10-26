import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, testPlatform, setInput, step, snapshot, mechStats } from '../dist/core.js';
const make = (dual = false) => {
  const w = newWorld(testPlatform(), [
    {
      id: 'p',
      build: {
        equipment: ['dynamo', dual ? 'dynamo' : 'guard', 'emp'],
        parts: { booster: 'heavy' },
      },
    },
  ]);
  w.enemies = [];
  w.players[0].x = w.players[0].y = 0;
  return w;
};
const tick = (w, input = {}, n = 1) => {
  for (let i = 0; i < n; i++) {
    setInput(w, 'p', input);
    step(w, 0.01);
  }
};
test('Dynamo spends one full charge and cannot reload by waiting or aiming', () => {
  const w = make(),
    p = w.players[0];
  tick(w, { left: true }, 400);
  assert.equal(p.hands[0].shotCount, 1);
  assert.equal(p.hands[0].motionCharge, 0);
  tick(w, { angle: 2, pitch: 0.5 }, 200);
  assert.equal(p.hands[0].motionCharge, 0);
});
test('Dynamo reloads from actual travel, caps at full, and fires again', () => {
  const w = make(),
    p = w.players[0];
  tick(w, { left: true });
  tick(w, { x: 1 }, 50);
  assert.ok(Math.abs(p.hands[0].motionCharge - p.x / 500) < 1e-8);
  tick(w, { x: 1 }, 300);
  assert.equal(p.hands[0].motionCharge, 1);
  tick(w, { left: true });
  assert.equal(p.hands[0].shotCount, 2);
  assert.equal(p.hands[0].motionCharge, 0);
});
test('powered flight and downward dash recharge; free fall does not', () => {
  const w = make(),
    p = w.players[0];
  p.hands[0].motionCharge = 0;
  tick(w, { fly: true }, 50);
  assert.ok(Math.abs(p.hands[0].motionCharge - p.altitude / 500) < 1e-8);
  const charge = p.hands[0].motionCharge;
  tick(w, {}, 10);
  assert.equal(p.hands[0].motionCharge, charge);
  p.altitude = 220;
  p.hands[0].motionCharge = 0;
  tick(w, { dash: true, pitch: -Math.PI / 2 }, 10);
  assert.ok(p.hands[0].motionCharge > 0.2);
});
test('dash moves backward and sideways without changing aim', () => {
  for (const [x, y] of [
    [-1, 0],
    [0, -1],
    [0, 1],
  ]) {
    const w = make(),
      p = w.players[0];
    p.hands[0].motionCharge = 0;
    tick(w, { dash: true, x, y, angle: 0 });
    tick(w, { angle: 0 }, 31);
    assert.ok(Math.abs(p.x - 400 * x) < 0.01);
    assert.ok(Math.abs(p.y - 400 * y) < 0.01);
    assert.equal(p.angle, 0);
    assert.ok(Math.abs(p.hands[0].motionCharge - 0.8) < 1e-8);
  }
});
test('wall pushing charges only the distance actually travelled', () => {
  const w = make(),
    p = w.players[0];
  w.mission.mode = 'mission';
  w.mission.width = w.mission.height = 2000;
  p.x = p.y = 200;
  w.mission.obstacles = [{ x: 260, y: 100, w: 8, h: 200, height: 100 }];
  p.hands[0].motionCharge = 0;
  tick(w, { x: 1 }, 200);
  assert.ok(p.x < 240);
  assert.ok(Math.abs(p.hands[0].motionCharge - (p.x - 200) / 500) < 1e-8);
});
test('dual Dynamos spend independently and replicate their charge for guests', () => {
  const w = make(true),
    p = w.players[0];
  tick(w, { left: true });
  assert.equal(p.hands[1].motionCharge, 1);
  tick(w, { x: -1 }, 40);
  const remote = JSON.parse(JSON.stringify(snapshot(w))).players[0];
  assert.deepEqual(
    remote.hands.map((h) => h.motionCharge),
    p.hands.map((h) => h.motionCharge),
  );
  tick(w, { right: true });
  assert.equal(p.hands[1].motionCharge, 0);
  assert.ok(p.hands[0].motionCharge > 0);
});
