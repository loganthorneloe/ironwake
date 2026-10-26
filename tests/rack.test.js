import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanBuild,
  DEFAULT_BUILD,
  mechStats,
  newWorld,
  testPlatform,
  setInput,
  step,
  snapshot,
  WEAPONS,
  COLORS,
  TRAIL_COLORS,
} from '../dist/core.js';
const make = (equipment) =>
  newWorld(testPlatform(), [
    { id: 'p', build: { ...DEFAULT_BUILD, equipment, parts: { booster: 'heavy' } } },
  ]);
const tick = (w, input, dt = 0.01) => {
  setInput(w, 'p', input);
  step(w, dt);
  return w.players[0];
};
test('old saves become two hands plus special; canonical builds and duplicate items survive round trips', () => {
  assert.deepEqual(cleanBuild(DEFAULT_BUILD).equipment, ['blade', 'carbine', 'emp']);
  assert.deepEqual(cleanBuild({ equipment: ['rail', 'launcher', 'hammer', 'repair'] }).equipment, [
    'hammer',
    'rail',
    'repair',
  ]);
  for (const a of Object.keys(WEAPONS))
    for (const b of Object.keys(WEAPONS)) {
      const loadout = cleanBuild({ equipment: [a, b, 'repair'] });
      assert.deepEqual(loadout.equipment, [a, b, 'repair']);
      assert.deepEqual(cleanBuild(JSON.parse(JSON.stringify(loadout))), loadout);
    }
  assert.deepEqual(cleanBuild({ equipment: ['__proto__', 'constructor', null] }).equipment, [
    'blade',
    'carbine',
    'emp',
  ]);
});
test('both hand items and the special contribute weight exactly once', () => {
  const a = cleanBuild({ frame: 'scout', equipment: ['blade', 'carbine', 'emp'] }),
    b = cleanBuild({ ...a, equipment: ['launcher', 'hammer', 'repair'] });
  assert.equal(mechStats(b).equipmentWeight, 33);
  assert.equal(mechStats(b).valid, false);
  assert.ok(mechStats(b).speed < mechStats(a).speed);
  assert.throws(() => newWorld(testPlatform(), [{ id: 'p', build: b }]), /capacity/);
  assert.equal(mechStats({ equipment: ['rail', 'rail', 'emp'] }).equipmentWeight, 27);
});
test('each mouse hand acts independently, simultaneous hands fire from opposite arms', () => {
  for (const side of ['left', 'right']) {
    const w = make(['carbine', 'carbine', 'emp']);
    tick(w, { [side]: true });
    assert.equal(w.players[0].hands[side === 'left' ? 0 : 1].shotCount, 1);
    assert.equal(w.players[0].hands[side === 'left' ? 1 : 0].shotCount, 0);
  }
  const w = make(['carbine', 'carbine', 'emp']);
  tick(w, { left: true, right: true });
  assert.equal(w.bullets.length, 2);
  assert.equal(w.bullets[0].hand, 0);
  assert.equal(w.bullets[1].hand, 1);
  assert.ok(w.bullets[0].origin.y < w.players[0].y);
  assert.ok(w.bullets[1].origin.y > w.players[0].y);
});
test('a charging rail and firing carbine keep independent timers and release states', () => {
  const w = make(['rail', 'carbine', 'emp']),
    p = w.players[0];
  for (let i = 0; i < 10; i++) tick(w, { left: true, right: true }, 0.05);
  assert.equal(p.hands[0].shotCount, 0);
  assert.ok(p.hands[0].railCharge > 0.49);
  assert.ok(p.hands[1].shotCount >= 3);
  tick(w, { right: true });
  assert.ok(p.hands[0].railCharge > 0.75);
  for (let i = 0; i < 4; i++) tick(w, { right: true }, 0.05);
  assert.equal(p.hands[0].shotCount, 1);
  const count = p.hands[0].shotCount;
  for (let i = 0; i < 10; i++) tick(w, { left: i % 2 === 0, right: true }, 0.01);
  assert.equal(p.hands[0].shotCount, count, 'button toggles cannot bypass recovery');
});
test('melee hands recover independently and both strike once per swing', () => {
  const w = make(['blade', 'hammer', 'emp']),
    p = w.players[0];
  tick(w, { left: true, right: true });
  for (let i = 0; i < 65; i++) tick(w, {});
  assert.equal(p.hands[0].meleeImpactCount, 1);
  assert.equal(p.hands[1].meleeImpactCount, 1);
  assert.ok(p.hands[1].meleeTime > p.hands[0].meleeTime);
});
test('special and per-hand combat state replicate independently', () => {
  const w = make(['phaser', 'rail', 'repair']),
    p = w.players[0];
  p.hp = 20;
  for (let i = 0; i < 10; i++) tick(w, { right: true, ability: i === 0 }, 0.05);
  const q = JSON.parse(JSON.stringify(snapshot(w, false))).players[0];
  assert.deepEqual(q.build.equipment, ['phaser', 'rail', 'repair']);
  assert.equal(q.activeAbility, 'repair');
  assert.ok(q.hands[1].railCharge > 0.49);
  assert.equal(q.hands[0].railCharge, 0);
  assert.ok(q.hp > 20);
  assert.equal(q.input, undefined);
});
test('exhaust color remains cosmetic, sanitized, saved and replicated', () => {
  const b = cleanBuild({
    equipment: ['carbine', 'rail', 'shield'],
    trailColor: TRAIL_COLORS[2][0],
  });
  assert.equal(cleanBuild(JSON.parse(JSON.stringify(b))).trailColor, TRAIL_COLORS[2][0]);
  assert.deepEqual(mechStats(b), mechStats({ ...b, trailColor: TRAIL_COLORS[3][0] }));
  assert.equal(cleanBuild({ trailColor: 'url(evil)' }).trailColor, TRAIL_COLORS[0][0]);
  assert.equal(
    snapshot(newWorld(testPlatform(), [{ id: 'p', build: b }])).players[0].build.trailColor,
    b.trailColor,
  );
});
test('independent paint survives JSON saves and legacy global paint migrates to every part', () => {
  const old = cleanBuild({ color: COLORS[2][0] });
  assert.ok(Object.values(old.partColors).every((c) => c === COLORS[2][0]));
  const next = cleanBuild({
    ...old,
    partColors: { ...old.partColors, head: COLORS[3][0], arms: COLORS[4][0] },
  });
  assert.equal(next.partColors.torso, old.color);
  assert.deepEqual(cleanBuild(JSON.parse(JSON.stringify(next))), next);
  next.partColors.head = COLORS[0][0];
  assert.equal(old.partColors.head, COLORS[2][0]);
});
test('horizontal thrust is unlimited in all directions; vertical thrust is unlimited too', () => {
  for (const [x, y] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
  ]) {
    const w = make(['carbine']),
      p = w.players[0],
      f = mechStats(p.build);
    const start = { x: p.x, y: p.y };
    for (let i = 0; i < 300; i++) tick(w, { x, y }, 0.05);
    assert.equal(p.energy, f.energy);
    assert.ok(p.boosting);
    assert.ok(Math.abs(Math.hypot(p.x - start.x, p.y - start.y) - f.speed * f.boost * 15) < 0.01);
    p.energy = 0;
    p.altitude = 120;
    tick(w, { x, y, fly: true }, 0.05);
    assert.equal(p.boosting, true);
    assert.equal(p.airborne, true);
    assert.ok(p.altitude > 120);
    p.energy = 100;
    tick(w, { x, y, fly: true }, 0.05);
    assert.equal(p.energy, 100 - f.flightCost * 0.05);
    tick(w, {});
    assert.equal(p.boosting, false);
  }
});
