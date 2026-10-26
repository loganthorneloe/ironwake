import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, testPlatform, setInput, step, snapshot, WEAPONS } from '../dist/core.js';
const target = (id, x = 200, y = 0) => ({
  id,
  type: 'target',
  training: true,
  x,
  y,
  altitude: 0,
  hp: 10000,
  max: 10000,
  r: 22,
  stun: 0,
});
const make = (gun = 'carbine', second = 'guard') => {
  const w = newWorld(testPlatform(), [
    { id: 'p', build: { equipment: [gun, second, 'emp'], parts: { booster: 'heavy' } } },
  ]);
  w.players[0].x = w.players[0].y = 0;
  w.enemies = [target('a')];
  return w;
};
const tick = (w, input = {}, n = 1) => {
  for (let i = 0; i < n; i++) {
    setInput(w, 'p', input);
    step(w, 0.01);
  }
};
const hit = (w, kind, e = w.enemies[0], z = 32, owner = 'p', salvo = w.id++) => {
  const g = WEAPONS[kind];
  w.bullets.push({
    id: w.id++,
    kind,
    owner,
    salvo,
    origin: { x: 0, y: 0, z },
    x: e.x - 3,
    y: e.y,
    z,
    vx: 100,
    vy: 0,
    vz: 0,
    life: 0.1,
    damage: g.damage,
    enemy: false,
    pierce: 1,
    hit: [],
  });
  tick(w);
};
test('carbine and rail reward upper armor precision, while body damage stays unchanged', () => {
  for (const kind of ['carbine', 'rail'])
    for (const z of [32, 50]) {
      const w = make(kind),
        e = w.enemies[0];
      hit(w, kind, e, z);
      assert.equal(10000 - e.hp, WEAPONS[kind].damage * (z === 50 ? WEAPONS[kind].precision : 1));
      assert.equal(w.damageEvents[0].kind, z === 50 ? 'precision' : kind);
    }
});
test('four plasma contacts overload a group; charges expire and are visible to guests', () => {
  const w = make('plasma'),
    e = w.enemies[0];
  w.enemies.push(target('b', 240, 30), target('far', 500));
  for (let i = 0; i < 3; i++) hit(w, 'plasma');
  assert.equal(e.plasmaHits, 3);
  assert.equal(w.enemies[1].hp, 10000);
  assert.equal(snapshot(w).enemies[0].plasmaHits, 3);
  hit(w, 'plasma');
  assert.equal(e.plasmaHits, 0);
  assert.equal(e.hp, 10000 - 4 * 70 - 36);
  assert.equal(w.enemies[1].hp, 9964);
  assert.equal(w.enemies[2].hp, 10000);
  assert.ok(e.stun > 0);
  assert.equal(w.effects.filter((x) => x.kind === 'explosion').length, 1);
  hit(w, 'plasma');
  tick(w, {}, 151);
  assert.equal(e.plasmaHits, 0);
  hit(w, 'plasma');
  assert.equal(e.plasmaHits, 1);
});
test('plasma team hits combine, but overload cannot damage through cover', () => {
  const w = make('plasma'),
    e = w.enemies[0];
  w.enemies.push(target('covered', 200, 100));
  w.mission.obstacles = [{ x: 180, y: 40, w: 40, h: 10, height: 150 }];
  for (let i = 0; i < 4; i++) hit(w, 'plasma', e, 32, i % 2 ? 'ally' : 'p');
  assert.equal(e.plasmaHits, 0);
  assert.equal(w.enemies[1].hp, 10000);
});
test('shotgun has a useful center pattern and only pushes once per salvo', () => {
  const w = make('scatter');
  w.enemies = [];
  tick(w, { left: true });
  assert.equal(w.bullets.length, 9);
  assert.ok(w.bullets.slice(0, 5).every((b) => Math.abs(Math.atan2(b.vy, b.vx)) < 0.03));
  const e = { ...target('enemy', 100), training: false, speed: 0, windup: 1, cd: 99 };
  w.enemies = [e];
  w.bullets = [];
  const salvo = 500;
  hit(w, 'scatter', e, 32, 'p', salvo);
  const first = e.x;
  assert.ok(first > 100);
  assert.equal(e.windup, 0);
  hit(w, 'scatter', e, 32, 'p', salvo);
  assert.equal(e.x, first);
});
test('Gatling spins up, tightens its spread and resets without changing the other hand', () => {
  const w = make('rotary', 'rotary'),
    p = w.players[0];
  w.enemies = [];
  tick(w, { left: true });
  const firstCooldown = p.hands[0].shot;
  tick(w, { left: true }, 80);
  assert.equal(p.hands[0].spin, 1);
  assert.equal(p.hands[1].spin, 0);
  assert.ok(firstCooldown > WEAPONS.rotary.rate);
  const recent = w.bullets.filter((b) => b.born > w.time - 0.1);
  assert.ok(recent.every((b) => Math.abs(Math.atan2(b.vy, b.vx)) < 0.013));
  assert.equal(snapshot(w).players[0].hands[0].spin, 1);
  tick(w, {}, 26);
  assert.equal(p.hands[0].spin, 0);
});
test('flame leaves a bounded non-stacking burn after releasing; misses never ignite', () => {
  const w = make('flamer'),
    e = w.enemies[0];
  e.x = 80;
  w.enemies.push(target('far', 400));
  tick(w, { left: true, angle: 0, aimPoint: { x: 80, y: 0, z: 32 } });
  const hp = e.hp;
  assert.ok(e.burnUntil > w.time);
  tick(w, {}, 160);
  assert.ok(hp - e.hp >= 24 && hp - e.hp <= 30);
  assert.equal(w.enemies[1].hp, 10000);
  const after = e.hp;
  tick(w, {}, 100);
  assert.equal(e.hp, after);
  assert.equal(e.burnNext, null);
});
test('burn is cleared when a training target dies and cannot damage its respawn', () => {
  const w = make('flamer'),
    e = w.enemies[0];
  e.x = 80;
  tick(w, { left: true });
  e.hp = 0;
  tick(w, {}, 250);
  assert.equal(e.hp, e.max);
  assert.equal(e.burnUntil, 0);
  assert.equal(e.plasmaHits, 0);
});
test('rocket guidance acquires at launch, follows lateral movement and preserves speed', () => {
  const w = make('launcher'),
    e = w.enemies[0];
  e.x = 500;
  tick(w, { left: true, angle: 0, aimPoint: { x: 500, y: 0, z: 32 } });
  assert.equal(w.bullets[0].seekTarget, e.id);
  for (let i = 0; i < 100 && e.hp === e.max; i++) {
    e.y += 1;
    tick(w);
    for (const b of w.bullets)
      assert.ok(Math.abs(Math.hypot(b.vx, b.vy, b.vz) - WEAPONS.launcher.speed) < 1e-6);
  }
  assert.ok(e.hp < e.max);
  assert.ok(w.effects.some((x) => x.weapon === 'launcher'));
});
test('rockets do not acquire enemies outside the aim cone or behind cover', () => {
  for (const covered of [false, true]) {
    const w = make('launcher');
    w.enemies[0].y = covered ? 0 : 200;
    if (covered) w.mission.obstacles = [{ x: 100, y: -50, w: 10, h: 100, height: 100 }];
    tick(w, { left: true, angle: 0 });
    assert.ok(w.bullets.every((b) => b.seekTarget == null));
  }
});
test('Dynamo can pierce two enemies and rail can pierce three', () => {
  for (const gun of ['dynamo', 'rail']) {
    const w = make(gun);
    w.enemies = [target('a', 180), target('b', 280), target('c', 380)];
    tick(w, { leftPressed: true, angle: 0, aimPoint: { x: 180, y: 0, z: 32 } });
    tick(w, {}, 100);
    assert.equal(w.enemies.filter((e) => e.hp < e.max).length, gun === 'dynamo' ? 2 : 3);
  }
});
test('two flamethrowers refresh one burn, rather than multiplying damage over time', () => {
  const w = make('flamer', 'flamer'),
    e = w.enemies[0];
  e.x = 80;
  tick(w, { left: true, right: true, aimPoint: { x: 80, y: 0, z: 32 } });
  const hp = e.hp;
  tick(w, {}, 160);
  assert.equal(hp - e.hp, 30);
});
test('burn and plasma state are serialized, and no lingering damage runs after the round ends', () => {
  const w = make('flamer'),
    e = w.enemies[0];
  e.x = 80;
  tick(w, { left: true });
  const remote = JSON.parse(JSON.stringify(snapshot(w)));
  assert.equal(remote.enemies[0].burnUntil, e.burnUntil);
  assert.equal(remote.enemies[0].burnOwner, 'p');
  w.status = 'won';
  const hp = e.hp;
  tick(w, {}, 200);
  assert.equal(e.hp, hp);
});
test('dual precision guns and plasma retain enemy retaliation windows', () => {
  for (const gun of ['rail', 'scatter', 'plasma']) {
    const w = make(gun, gun),
      p = w.players[0];
    w.enemies = [
      { ...target('ai', 120), training: false, type: 'gunner', speed: 0, windup: 0, cd: 0 },
    ];
    let attacked = false;
    for (let i = 0; i < 1200; i++) {
      p.hp = 125;
      const ready = gun !== 'rail' || (p.hands[0].shot <= 0 && !p.hands[0].railCharging);
      tick(w, {
        left: ready,
        right: ready,
        angle: 0,
        aimPoint: { x: w.enemies[0].x, y: 0, z: 32 },
      });
      attacked ||= w.bullets.some((b) => b.enemy) || p.hp < 125;
    }
    assert.ok(attacked, gun);
  }
});
