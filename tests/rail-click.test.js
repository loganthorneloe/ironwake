import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, testPlatform, setInput, step, snapshot, WEAPONS } from '../dist/core.js';
const make = () => {
  const w = newWorld(testPlatform(), [
    { id: 'p', build: { equipment: ['rail', 'carbine', 'emp'], parts: { booster: 'heavy' } } },
  ]);
  w.enemies = [];
  return w;
};
const tick = (w, input = {}, frames = 1) => {
  for (let i = 0; i < frames; i++) {
    setInput(w, 'p', input);
    step(w, 0.01);
  }
  return w.players[0].hands[0];
};
test('one quick rail click charges on release, then fires at 0.66 seconds', () => {
  const w = make();
  let h = tick(w, { left: true });
  assert.ok(h.railCharging);
  h = tick(w, {}, 64);
  assert.equal(h.shotCount, 0);
  assert.ok(h.railCharge > 0.98);
  h = tick(w);
  assert.equal(h.shotCount, 1);
  assert.equal(h.railCharge, 0);
  assert.equal(h.railCharging, false);
  assert.equal(h.shot, 0.5);
  assert.equal(w.bullets[0].damage, 320);
});
test('holding repeats full charge and recovery, then release stops the next cycle', () => {
  const w = make();
  const h = tick(w, { left: true }, 300);
  assert.equal(h.shotCount, 3);
  assert.equal(h.railCharging, false);
  tick(w, {}, 180);
  assert.equal(h.shotCount, 3);
  tick(w, { left: true });
  tick(w, {}, 65);
  assert.equal(h.shotCount, 4);
});
test('repeated clicks cannot skip recovery or silently queue another rail shot', () => {
  const w = make();
  tick(w, { left: true });
  const h = tick(w, {}, 65);
  for (let i = 0; i < 40; i++) tick(w, { leftPressed: i % 2 === 0 });
  assert.equal(h.shotCount, 1);
  assert.equal(h.railCharging, false);
  tick(w, {}, 80);
  assert.equal(h.shotCount, 1);
  tick(w, { leftPressed: true });
  tick(w, {}, 65);
  assert.equal(h.shotCount, 2);
});
test('a press and release arriving before the same host tick are retained exactly once', () => {
  const w = make();
  setInput(w, 'p', { leftPressed: true });
  setInput(w, 'p', { left: false });
  step(w, 0.01);
  assert.ok(w.players[0].hands[0].railCharging);
  assert.equal(w.players[0].input.leftPressed, false);
  tick(w, {}, 170);
  assert.equal(w.players[0].hands[0].shotCount, 1);
});
test('dash and death cancel committed charges and do not fire after recovery', () => {
  for (const mode of ['dash', 'death']) {
    const w = make();
    tick(w, { left: true }, 20);
    if (mode === 'dash') tick(w, { dash: true, left: true });
    else {
      w.players[0].hp = 0;
      tick(w);
    }
    const h = w.players[0].hands[0];
    assert.equal(h.railCharging, false);
    assert.equal(h.railCharge, 0);
    tick(w, {}, 150);
    assert.equal(h.shotCount, 0);
  }
});
test('rail charge survives snapshot transport while the other hand continues firing', () => {
  const w = make();
  tick(w, { leftPressed: true, right: true });
  tick(w, { right: true }, 30);
  const p = snapshot(w, false).players[0];
  assert.ok(p.hands[0].railCharging);
  assert.ok(p.hands[0].railCharge > 0.4);
  assert.ok(p.hands[1].shotCount >= 3);
  tick(w, { right: true }, 35);
  assert.equal(w.players[0].hands[0].shotCount, 1);
  assert.equal(WEAPONS.rail.charge, 0.66);
});

test('both rail hands repeat independently and keep their full recovery', () => {
  const w = newWorld(testPlatform(), [
    { id: 'p', build: { equipment: ['rail', 'rail', 'emp'], parts: { booster: 'heavy' } } },
  ]);
  w.enemies = [];
  tick(w, { left: true, right: true }, 300);
  assert.deepEqual(
    w.players[0].hands.map((h) => h.shotCount),
    [3, 3],
  );
  tick(w, { right: true }, 120);
  assert.deepEqual(
    w.players[0].hands.map((h) => h.shotCount),
    [3, 4],
  );
});
