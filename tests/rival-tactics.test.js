import test from 'node:test';
import assert from 'node:assert/strict';
import { combatTrial, newWorld, DEFAULT_BUILD, setInput, step, snapshot } from '../dist/core.js';
const make = (build = DEFAULT_BUILD) => {
  const w = newWorld(combatTrial(), [{ id: 'p', build }]);
  w.time = 4;
  w.enemies[0].cd = 0;
  return w;
};
const advance = (w, n, fn) => {
  for (let i = 0; i < n; i++) {
    fn?.(w, i);
    step(w, 1 / 60);
  }
};
test('rival keeps moving while winding up and firing a burst', () => {
  const w = make(),
    e = w.enemies[0];
  step(w, 0.01);
  assert.ok(e.windup > 0);
  const start = { x: e.x, y: e.y };
  advance(w, 20);
  assert.ok(Math.hypot(e.x - start.x, e.y - start.y) > 70);
  advance(w, 7);
  assert.ok(e.burst > 0);
  const fired = { x: e.x, y: e.y, count: e.shotCount };
  advance(w, 20);
  assert.ok(Math.hypot(e.x - fired.x, e.y - fired.y) > 70);
  assert.ok(e.shotCount > fired.count);
});
test('rival leads lateral movement and can hit a continuously strafing pilot', () => {
  const w = make(),
    e = w.enemies[0],
    p = w.players[0];
  e.speed = 0;
  let led = false;
  advance(w, 150, () => {
    setInput(w, p.id, { x: 1 });
    if (e.attackPoint?.x > p.x + 20) led = true;
  });
  assert.ok(led);
  assert.ok(p.hp < 125, 'predictive fire should connect instead of shooting behind the pilot');
});
test('incoming rockets trigger a delayed dodge with a cooldown', () => {
  const w = make(),
    e = w.enemies[0];
  e.cd = 100;
  e.x = e.y = 0;
  e.strafeSign = 1;
  e.tacticAt = 100;
  w.players[0].x = 0;
  w.players[0].y = -400;
  w.bullets.push({
    id: 1000,
    owner: 'p',
    kind: 'launcher',
    x: -400,
    y: 0,
    z: 30,
    vx: 1000,
    vy: 0,
    vz: 0,
    life: 2,
    damage: 225,
    splash: 125,
    hit: [],
    pierce: 1,
  });
  step(w, 0.01);
  assert.ok(e.dodgeAt > w.time);
  assert.equal(e.dashTime, 0);
  advance(w, 10);
  assert.ok(e.dashTime > 0);
  assert.ok(e.dashCd > 1);
  assert.equal(e.intent, 'EVADING');
  advance(w, 25);
  assert.equal(e.dashTime, 0);
  assert.ok(e.dashCd > 0);
  assert.equal(e.dodgeAt, 0);
});
test('AI preserves an opening: a committed sword lunge can be dodged', () => {
  const w = make(),
    e = w.enemies[0],
    p = w.players[0];
  e.x = p.x;
  e.y = p.y - 100;
  step(w, 0.01);
  assert.equal(e.attackKind, 'melee');
  const facing = e.attackAngle;
  advance(w, 32, () => setInput(w, p.id, { x: 1 }));
  assert.equal(p.hp, 125);
  assert.ok(e.cd > 0);
  assert.ok(e.meleeTime > 0);
  assert.ok(Number.isFinite(facing));
});
test('AI gives short-range builds space and closes against a long-range opening', () => {
  const short = make({ ...DEFAULT_BUILD, equipment: ['blade', 'claws', 'emp'] }),
    long = make();
  for (const w of [short, long]) {
    const e = w.enemies[0],
      p = w.players[0];
    e.x = p.x;
    e.y = p.y - 240;
    e.cd = 100;
  }
  long.players[0].hands[1].shot = 0.9;
  step(short, 0.01);
  step(long, 0.01);
  assert.equal(short.enemies[0].intent, 'KEEPING RANGE');
  assert.equal(long.enemies[0].intent, 'PRESSING');
  assert.ok(short.enemies[0].y < -265);
  assert.ok(long.enemies[0].y > -265);
});
test('rival stays damageable during dodge and does not gain more armor', () => {
  const w = make(),
    e = w.enemies[0],
    p = w.players[0];
  assert.equal(e.max, 900);
  e.x = p.x;
  e.y = p.y - 70;
  e.dashTime = 0.28;
  e.dashCd = 1.6;
  e.dashAngle = 0;
  setInput(w, p.id, { ability: true });
  step(w, 0.01);
  assert.equal(e.hp, 855);
  assert.ok(e.stun > 3);
  assert.equal(e.dashTime, 0);
  assert.equal(e.burst, 0);
});
test('network snapshots exclude host perception memory but retain motion and aim', () => {
  const w = make();
  advance(w, 40);
  const remote = snapshot(w);
  assert.equal(remote.enemies[0].observations, undefined);
  assert.equal(remote.enemies[0].boostX, w.enemies[0].boostX);
  assert.deepEqual(remote.enemies[0].attackPoint, w.enemies[0].attackPoint);
});
