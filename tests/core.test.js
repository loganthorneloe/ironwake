import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mission,
  newWorld,
  step,
  setInput,
  cleanBuild,
  cost,
  DEFAULT_BUILD,
  FRAMES,
  mechStats,
  validBuild,
  partsFor,
  PARTS,
  WEAPONS,
  ABILITIES,
  surfaceAt,
  snapshot,
} from '../dist/core.js';
const make = (build = DEFAULT_BUILD) => {
  const w = newWorld(mission(42), [{ id: 'p1', name: 'Pilot', build }]);
  w.players[0].x = 835;
  w.players[0].y = 690;
  w.mission.obstacles = [];
  w.mission.zones = w.mission.zones.map((z) => ({ ...z, x: 3000, y: 2000 }));
  return w;
};
test('generated levels are deterministic, varied, connected, with safe spawns', () => {
  assert.deepEqual(mission(42), mission(42));
  assert.notDeepEqual(mission(42).paths, mission(43).paths);
  for (let seed = 0; seed < 150; seed++) {
    const m = mission(seed),
      blocked = (x, y, r = 25) =>
        m.obstacles.some(
          (o) => x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h,
        );
    for (const path of m.paths)
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1],
          b = path[i],
          n = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 30);
        for (let j = 0; j <= n; j++)
          assert.equal(
            blocked(a.x + ((b.x - a.x) * j) / n, a.y + ((b.y - a.y) * j) / n, 49),
            false,
            `seed ${seed}: path blocked`,
          );
      }
    const w = newWorld(
      m,
      [1, 2, 3, 4].map((id) => ({ id, build: DEFAULT_BUILD })),
    );
    for (const p of w.players) assert.equal(blocked(p.x, p.y), false);
    assert.equal(m.zones.length, 5);
  }
});
test('legacy saves preserve their components and injected stats are stripped', () => {
  for (const frame of Object.keys(FRAMES))
    for (const weapon of Object.keys(WEAPONS).filter((id) => !['flamer', 'guard'].includes(id)))
      for (const ability of Object.keys(ABILITIES)) {
        const b = cleanBuild({ frame, weapon, ability, hp: 99999 });
        assert.deepEqual(b.parts, partsFor({ frame }));
        assert.equal(b.hp, undefined);
      }
  assert.deepEqual(cleanBuild({ frame: 'hacker' }).parts, partsFor(DEFAULT_BUILD));
});
test('normalized movement prevents diagonal speed advantage and stale input stops', () => {
  const w = make();
  w.mission.obstacles = [];
  const p = w.players[0],
    x = p.x,
    y = p.y;
  setInput(w, 'p1', { x: 1, y: 1 });
  step(w, 0.05);
  assert.ok(
    Math.abs(
      Math.hypot(p.x - x, p.y - y) - mechStats(p.build).speed * mechStats(p.build).boost * 0.05,
    ) < 0.001,
  );
  w.time = 2;
  const old = p.x;
  step(w, 0.05);
  assert.equal(p.x, old);
});
test('abilities enforce cooldown and EMP exposes enemies', () => {
  const w = make();
  w.enemies = [
    { id: 1, type: 'drone', x: 860, y: 690, hp: 100, max: 100, stun: 0, cd: 2, speed: 0, r: 18 },
  ];
  setInput(w, 'p1', { ability: true });
  step(w, 0.05);
  assert.ok(w.enemies[0].stun > 1.7);
  assert.equal(w.players[0].abilityCd, 14);
  step(w, 0.05);
  assert.ok(w.players[0].abilityCd < 14);
});
test('shield applies 60 percent reduction and duplicate domes do not multiply', () => {
  const w = make({ ...DEFAULT_BUILD, ability: 'shield' });
  w.players[0].active = 5;
  w.bullets = [
    { x: w.players[0].x, y: w.players[0].y, vx: 0, vy: 0, life: 1, damage: 20, enemy: true },
  ];
  step(w, 0.01);
  assert.equal(w.players[0].hp, 120.2);
});
test('nearby teammate revives downed pilot, solo wipe ends mission', () => {
  const w = newWorld(mission(1), [
    { id: 'a', build: DEFAULT_BUILD },
    { id: 'b', build: DEFAULT_BUILD },
  ]);
  w.players[0].hp = 0;
  for (let i = 0; i < 62; i++) step(w, 0.05);
  assert.ok(w.players[0].hp > 0);
  const s = make();
  s.players[0].hp = 0;
  step(s, 0.05);
  assert.equal(s.status, 'lost');
});
test('repair overlap does not stack healing', () => {
  const b = { ...DEFAULT_BUILD, ability: 'repair' },
    w = newWorld(mission(1), [
      { id: 'a', build: b },
      { id: 'b', build: b },
    ]);
  for (const p of w.players) {
    p.hp = 50;
    p.active = 4;
  }
  step(w, 0.05);
  assert.ok(Math.abs(w.players[0].hp - 50.6) < 0.0001);
});
test('level progression is triggered by travel, requires every sector and squad extraction', () => {
  const w = newWorld(mission(42), [
    { id: 'a', build: DEFAULT_BUILD },
    { id: 'b', build: DEFAULT_BUILD },
  ]);
  for (let i = 0; i < 300; i++) step(w, 0.05);
  assert.equal(w.encounter, false);
  assert.equal(w.enemies.length, 0);
  w.players.forEach((p) => {
    p.x = w.mission.exit.x;
    p.y = w.mission.exit.y;
  });
  for (let i = 0; i < 50; i++) step(w, 0.05);
  assert.equal(w.status, 'playing');
  for (const zone of w.mission.zones) {
    Object.assign(w.players[0], { x: zone.x, y: zone.y });
    step(w, 0.01);
    assert.equal(w.encounter, true);
    assert.ok(w.enemies.length + w.spawn.length > 0);
    w.enemies = [];
    w.spawn = [];
    step(w, 0.01);
  }
  assert.equal(w.cleared, 5);
  assert.equal(w.status, 'playing');
  Object.assign(w.players[0], { x: w.mission.exit.x, y: w.mission.exit.y });
  Object.assign(w.players[1], { x: w.mission.entry.x, y: w.mission.entry.y });
  for (let i = 0; i < 50; i++) step(w, 0.05);
  assert.equal(w.status, 'playing');
  Object.assign(w.players[1], { x: w.mission.exit.x, y: w.mission.exit.y });
  for (let i = 0; i < 42; i++) step(w, 0.05);
  assert.equal(w.status, 'won');
});
test('gunners navigate around cover to reach a player firing line', () => {
  const w = make();
  w.players[0].x = 900;
  w.players[0].y = 600;
  w.mission.obstacles = [{ x: 650, y: 350, w: 100, h: 500 }];
  w.enemies = [
    { id: 2, type: 'gunner', x: 500, y: 600, hp: 100, max: 100, stun: 0, cd: 1, speed: 75, r: 18 },
  ];
  let hits = 0;
  for (let i = 0; i < 1000; i++) {
    step(w, 0.05);
    if (w.players[0].hp < 125) hits++;
    w.players[0].hp = 125;
  }
  assert.ok(hits > 0, 'gunner must navigate to a clear firing line');
});
test('projectiles hit cover and rail shots pierce multiple exposed targets', () => {
  const w = make({ ...DEFAULT_BUILD, weapon: 'rail' });
  w.mission.obstacles = [];
  w.enemies = [1, 2, 3].map((id) => ({
    id,
    type: 'drone',
    x: 950 + id * 35,
    y: 690,
    hp: 500,
    max: 500,
    stun: 3,
    cd: 99,
    speed: 0,
    r: 18,
  }));
  for (let i = 0; i < 20; i++) {
    setInput(w, 'p1', { fire: true, angle: 0 });
    step(w, 0.05);
  }
  setInput(w, 'p1', {});
  for (let i = 0; i < 8; i++) step(w, 0.05);
  assert.equal(w.enemies.length, 3);
  assert.ok(w.enemies.every((e) => Math.abs(e.hp - 180) < 0.01));
  const c = make();
  c.mission.obstacles = [{ x: 875, y: 650, w: 20, h: 100 }];
  c.enemies = [
    { id: 1, type: 'drone', x: 950, y: 690, hp: 100, max: 100, stun: 3, cd: 99, speed: 0, r: 18 },
  ];
  setInput(c, 'p1', { fire: true, angle: 0 });
  step(c, 0.05);
  setInput(c, 'p1', {});
  for (let i = 0; i < 8; i++) step(c, 0.05);
  assert.equal(c.enemies[0].hp, 100);
});
test('encounter pressure scales with squad size', () => {
  const solo = newWorld(mission(42), [{ id: 's', build: DEFAULT_BUILD }]),
    squad = newWorld(
      mission(42),
      [1, 2, 3, 4].map((id) => ({ id: String(id), build: DEFAULT_BUILD })),
    );
  for (const w of [solo, squad]) {
    Object.assign(w.players[0], { x: w.mission.zones[0].x, y: w.mission.zones[0].y });
    step(w, 0.01);
  }
  assert.ok(squad.spawn.length + squad.enemies.length > solo.spawn.length + solo.enemies.length);
  assert.ok(squad.enemies[0].max > solo.enemies[0].max);
});
test('continuous fire has no heat state or thermal lockout', () => {
  const w = make(),
    p = w.players[0];
  w.enemies = [];
  for (let i = 0; i < 1200; i++) {
    setInput(w, 'p1', { fire: true, angle: 0 });
    step(w, 0.05);
  }
  assert.ok(p.shotCount >= 400);
  assert.equal(p.heat, undefined);
  assert.equal(p.overheated, undefined);
});
test('universal dash works without energy and is faster than automatic boost', () => {
  const a = make(),
    b = make();
  a.mission.obstacles = [];
  b.mission.obstacles = [];
  a.players[0].energy = b.players[0].energy = 0;
  setInput(a, 'p1', { x: 1 });
  setInput(b, 'p1', { x: 1, dash: true });
  step(a, 0.05);
  step(b, 0.05);
  assert.ok(b.players[0].x > a.players[0].x);
  assert.equal(b.players[0].moveKind, 'dash');
  assert.equal(b.players[0].dashCd, 3);
  assert.ok(b.players[0].boosting);
});
test('enemy shots have a visible wind-up and EMP cancels it', () => {
  const w = make();
  w.mission.obstacles = [];
  w.enemies = [
    {
      id: 1,
      type: 'gunner',
      x: 950,
      y: 690,
      hp: 100,
      max: 100,
      stun: 0,
      windup: 0,
      cd: 0,
      speed: 0,
      r: 18,
    },
  ];
  step(w, 0.01);
  assert.ok(w.enemies[0].windup > 0);
  assert.equal(w.bullets.length, 0);
  setInput(w, 'p1', { ability: true });
  step(w, 0.01);
  assert.equal(w.enemies[0].windup, 0);
  assert.equal(w.bullets.length, 0);
});
test('3D shots above a target do not damage it and grounded shots do', () => {
  const w = make();
  w.mission.obstacles = [];
  w.enemies = [
    { id: 1, type: 'drone', x: 950, y: 690, hp: 200, max: 200, stun: 2, cd: 99, speed: 0, r: 18 },
  ];
  w.bullets = [
    {
      id: 2,
      x: 940,
      y: 690,
      z: 100,
      vx: 100,
      vy: 0,
      vz: 0,
      life: 1,
      damage: 24,
      enemy: false,
      pierce: 1,
      hit: [],
    },
  ];
  step(w, 0.05);
  assert.equal(w.enemies[0].hp, 200);
  w.bullets[0].z = 38;
  step(w, 0.05);
  assert.ok(w.enemies[0].hp < 200);
});
test('clearing a sector repairs surviving pilots once', () => {
  const w = make();
  w.encounter = true;
  w.players[0].hp = 50;
  step(w, 0.01);
  assert.equal(w.players[0].hp, 75);
  step(w, 0.01);
  assert.equal(w.players[0].hp, 75);
});

test('flight changes elevation without consuming thrust', () => {
  const w = make(),
    p = w.players[0];
  for (let i = 0; i < 20; i++) {
    setInput(w, p.id, { fly: true });
    step(w, 0.05);
  }
  assert.ok(Math.abs(p.altitude - mechStats(p.build).lift) < 0.001);
  assert.ok(
    Math.abs(p.energy - (mechStats(p.build).energy - mechStats(p.build).flightCost)) < 0.01,
  );
  setInput(w, p.id, {});
  for (let i = 0; i < 40; i++) step(w, 0.05);
  assert.equal(p.altitude, 0);
  assert.ok(p.energy > 80);
});
test('flight vaults low cover but cannot pass tall level walls', () => {
  const w = make(),
    p = w.players[0];
  p.altitude = 110;
  w.mission.obstacles = [{ x: 860, y: 600, w: 100, h: 200, height: 70 }];
  setInput(w, p.id, { x: 1, fly: true, sprint: true });
  step(w, 0.05);
  assert.ok(p.x > 835);
  p.x = 835;
  w.mission.obstacles[0].height = 180;
  setInput(w, p.id, { x: 1, fly: true, sprint: true });
  step(w, 0.05);
  assert.equal(p.x, 835);
});
test('elevation dodges low projectiles and enemy aim tracks airborne pilots', () => {
  const w = make(),
    p = w.players[0];
  p.altitude = 120;
  w.bullets = [{ x: p.x, y: p.y, z: 38, vx: 0, vy: 0, vz: 0, life: 1, damage: 30, enemy: true }];
  w.enemies = [
    {
      id: 1,
      type: 'gunner',
      x: 950,
      y: 690,
      hp: 100,
      max: 100,
      stun: 0,
      windup: 0,
      cd: 0,
      speed: 0,
      r: 18,
    },
  ];
  step(w, 0.01);
  assert.equal(p.hp, 125);
  assert.ok(w.enemies[0].attackPitch > 0);
});
test('melee checks range, cone and cover; hammer stun does not bypass walls', () => {
  for (const weapon of ['blade', 'lance', 'hammer']) {
    const w = make({ ...DEFAULT_BUILD, weapon: 'carbine', melee: weapon, ability: 'shield' });
    w.enemies = [
      { id: 1, type: 'drone', x: 920, y: 690, hp: 500, max: 500, stun: 0, cd: 99, speed: 0, r: 18 },
      { id: 2, type: 'drone', x: 750, y: 690, hp: 500, max: 500, stun: 0, cd: 99, speed: 0, r: 18 },
    ];
    setInput(w, 'p1', { melee: true, angle: 0 });
    step(w, 0.01);
    assert.equal(w.enemies[0].hp, 500, 'windup cannot damage');
    setInput(w, 'p1', { angle: 0 });
    for (let i = 0; i < 12; i++) step(w, 0.05);
    assert.ok(w.enemies[0].hp < 500, weapon);
    if (weapon === 'hammer') assert.ok(w.enemies[1].hp < 500, 'radial slam hits behind');
    else assert.equal(w.enemies[1].hp, 500);
    const old = w.enemies[0].hp;
    w.players[0].meleeTime = 0;
    w.mission.obstacles = [{ x: 870, y: 650, w: 20, h: 100, height: 180 }];
    setInput(w, 'p1', { melee: true, angle: 0 });
    step(w, 0.01);
    setInput(w, 'p1', { angle: 0 });
    for (let i = 0; i < 12; i++) step(w, 0.05);
    assert.equal(w.enemies[0].hp, old);
  }
});
test('blast launcher splashes nearby enemies with falloff and respects cover', () => {
  const w = make();
  w.enemies = [
    { id: 1, type: 'drone', x: 920, y: 690, hp: 500, max: 500, stun: 0, cd: 99, speed: 0, r: 18 },
    { id: 2, type: 'drone', x: 970, y: 690, hp: 500, max: 500, stun: 0, cd: 99, speed: 0, r: 18 },
  ];
  w.bullets = [
    {
      id: 4,
      owner: 'p1',
      x: 920,
      y: 690,
      z: 32,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0.001,
      damage: 105,
      splash: 105,
      enemy: false,
      pierce: 1,
      hit: [],
    },
  ];
  step(w, 0.01);
  assert.ok(w.enemies[0].hp < w.enemies[1].hp);
  assert.ok(w.enemies[1].hp < 500);
});

test('every encounter spawns all enemy sizes clear of generated cover', () => {
  for (let seed = 0; seed < 50; seed++) {
    const w = newWorld(mission(seed), [{ id: 'p', build: DEFAULT_BUILD }]);
    for (let i = 0; i < 5; i++) {
      w.zoneIndex = i;
      w.encounter = false;
      w.enemies = [];
      w.spawn = [];
      w.bullets = [];
      Object.assign(w.players[0], { ...w.mission.zones[i], hp: 100000 });
      for (let n = 0; n < 72; n++) {
        step(w, 0.05);
        for (const e of w.enemies)
          assert.equal(
            w.mission.obstacles.some(
              (o) =>
                e.x + e.r > o.x &&
                e.x - e.r < o.x + o.w &&
                e.y + e.r > o.y &&
                e.y - e.r < o.y + o.h,
            ),
            false,
            `seed ${seed} sector ${i} ${e.type}`,
          );
      }
    }
  }
});

test('a downed airborne mech lands on cover without sinking inside it', () => {
  const w = make();
  w.players.push({ ...w.players[0], id: 'ally', x: 1000 });
  const p = w.players[0];
  p.hp = 0;
  p.altitude = 120;
  w.mission.obstacles = [{ x: 800, y: 650, w: 80, h: 80, height: 70 }];
  for (let i = 0; i < 20; i++) step(w, 0.05);
  assert.equal(p.altitude, 70);
});

test('all chassis can walk generated ramps and recharge on raised decks', () => {
  for (let seed = 0; seed < 12; seed++)
    for (const frame of Object.keys(FRAMES)) {
      const w = newWorld(mission(seed), [
          { id: 'p', build: { ...DEFAULT_BUILD, frame, ability: 'shield' } },
        ]),
        p = w.players[0],
        r = w.mission.ramps[0];
      w.mission.zones = [];
      p.x = r.x + r.w / 2;
      p.y = r.y + (r.sign > 0 ? -20 : r.h + 20);
      p.energy = 40;
      for (let i = 0; i < 800; i++) {
        setInput(w, p.id, { y: r.sign });
        step(w, 0.01);
        if (p.altitude >= r.z - 0.1) break;
      }
      assert.ok(p.altitude >= r.z - 12, `seed ${seed} ${frame}: ${p.altitude}`);
      const deck = w.mission.platforms[0];
      p.x = deck.x + deck.w * 0.5;
      p.y = deck.y + deck.h * 0.5;
      p.altitude = deck.z;
      p.energy = 40;
      setInput(w, p.id, {});
      for (let i = 0; i < 10; i++) step(w, 0.05);
      assert.ok(p.energy > 40);
      assert.equal(p.altitude, deck.z);
    }
});
test('mechs can pass beneath decks and land on a jet-only perch', () => {
  const w = make(),
    p = w.players[0];
  w.mission.platforms = [{ x: 700, y: 600, w: 400, h: 200, z: 150 }];
  w.mission.ramps = [];
  p.altitude = 0;
  assert.equal(surfaceAt(w.mission, p.x, p.y, 0), 0);
  step(w, 0.05);
  assert.equal(p.altitude, 0);
  p.altitude = 220;
  for (let i = 0; i < 15; i++) step(w, 0.05);
  assert.equal(p.altitude, 150);
});
test('deck slabs block vertical fire and elevated enemies need height-correct hits', () => {
  const w = make();
  w.mission.ramps = [];
  w.mission.platforms = [{ x: 900, y: 600, w: 200, h: 200, z: 100 }];
  w.enemies = [
    {
      id: 1,
      type: 'gunner',
      x: 950,
      y: 690,
      altitude: 100,
      hp: 200,
      max: 200,
      stun: 5,
      cd: 99,
      speed: 0,
      r: 18,
    },
  ];
  w.bullets = [
    {
      id: 3,
      owner: 'p1',
      x: 950,
      y: 690,
      z: 80,
      vx: 0,
      vy: 0,
      vz: 300,
      life: 1,
      damage: 25,
      pierce: 1,
      hit: [],
    },
  ];
  step(w, 0.05);
  assert.equal(w.bullets.length, 0);
  assert.equal(w.enemies[0].hp, 200);
  w.bullets = [
    {
      id: 4,
      owner: 'p1',
      x: 940,
      y: 690,
      z: 125,
      vx: 100,
      vy: 0,
      vz: 0,
      life: 1,
      damage: 25,
      pierce: 1,
      hit: [],
    },
  ];
  step(w, 0.05);
  assert.ok(w.enemies[0].hp < 200);
});
test('chassis movement roles trade flight and boost for armor', () => {
  const values = {};
  for (const frame of Object.keys(FRAMES)) {
    const w = make({ ...DEFAULT_BUILD, frame, ability: 'shield' }),
      p = w.players[0];
    w.mission.platforms = [];
    w.mission.ramps = [];
    const x = p.x;
    for (let i = 0; i < 10; i++) {
      setInput(w, p.id, { x: 1, fly: true, sprint: true });
      step(w, 0.05);
    }
    values[frame] = {
      travel: p.x - x,
      alt: p.altitude,
      energy: mechStats(p.build).energy - p.energy,
    };
  }
  assert.ok(
    values.scout.travel > values.striker.travel && values.striker.travel > values.bulwark.travel,
  );
  assert.ok(values.scout.alt > values.striker.alt && values.striker.alt > values.bulwark.alt);
  assert.equal(values.scout.energy, 0);
  assert.equal(values.bulwark.energy, 0);
  assert.ok(FRAMES.bulwark.hp > FRAMES.scout.hp);
});

test('flying into a deck underside stops the mech instead of phasing through', () => {
  const w = make(),
    p = w.players[0];
  w.mission.platforms = [{ x: 700, y: 600, w: 400, h: 200, z: 100 }];
  w.mission.ramps = [];
  for (let i = 0; i < 30; i++) {
    setInput(w, p.id, { fly: true });
    step(w, 0.05);
  }
  assert.equal(p.altitude, 34);
});
test('high-speed vertical shots cannot tunnel through a thin raised deck', () => {
  const w = make();
  w.mission.ramps = [];
  w.mission.platforms = [{ x: 900, y: 600, w: 200, h: 200, z: 100 }];
  w.bullets = [
    {
      id: 1,
      x: 950,
      y: 690,
      z: 20,
      vx: 0,
      vy: 0,
      vz: 3000,
      life: 1,
      damage: 25,
      pierce: 1,
      hit: [],
    },
  ];
  step(w, 0.05);
  assert.equal(w.bullets.length, 0);
});

// Cross-product audit covers every assembly plus all 21 weapon/system pairs.
test('all five-part assemblies and equipment combinations have bounded stats; legal builds can reach high perches', () => {
  const slots = Object.keys(PARTS);
  let legal = 0,
    invalid = 0;
  for (let mask = 0; mask < 243; mask++) {
    let n = mask;
    const parts = {};
    for (const slot of slots) {
      parts[slot] = ['light', 'standard', 'heavy'][n % 3];
      n = Math.floor(n / 3);
    }
    for (const weapon of Object.keys(WEAPONS))
      for (const ability of Object.keys(ABILITIES)) {
        const build = cleanBuild({ ...DEFAULT_BUILD, parts, weapon, ability }),
          f = mechStats(build);
        assert.ok(f.hp >= 79 && f.hp <= 193);
        assert.ok(f.speed >= 200 && f.speed <= 370);
        assert.ok(f.energy >= 90 && f.energy <= 125);
        if (f.valid) {
          legal++;
          assert.ok(f.weight <= f.capacity && f.power <= f.output);
          assert.ok(
            (f.lift * (f.energy - 1)) / f.flightCost > 170,
            'flight can reach highest generated perch',
          );
        } else invalid++;
      }
  }
  assert.ok(legal > 1000 && invalid > 1000);
});
test('heavier torso and added equipment trade speed for durability and flexibility', () => {
  const b = cleanBuild(DEFAULT_BUILD),
    light = { ...b, parts: { ...b.parts, torso: 'light' } },
    heavy = { ...b, parts: { ...b.parts, torso: 'heavy' } };
  const l = mechStats(light),
    h = mechStats(heavy);
  assert.ok(h.hp > l.hp && h.weight > l.weight && h.speed < l.speed && h.lift < l.lift);
  const extra = mechStats({ ...b, equipment: ['launcher', b.melee, b.ability] });
  assert.equal(extra.weight, mechStats(b).weight + 8);
  assert.ok(extra.speed < mechStats(b).speed);
  assert.equal(extra.hp, mechStats(b).hp);
});
test('host blocks suits beyond their booster weight limit; drafts remain editable', () => {
  const parts = partsFor({ frame: 'bulwark' }),
    overweight = cleanBuild({ ...DEFAULT_BUILD, parts: { ...parts, booster: 'light' } }),
    underpowered = cleanBuild({ ...DEFAULT_BUILD, parts: { ...parts, booster: 'standard' } });
  assert.equal(overweight.parts.booster, 'light');
  assert.equal(validBuild(overweight), false);
  assert.equal(validBuild(underpowered), false);
  for (const build of [overweight, underpowered])
    assert.throws(() => newWorld(mission(1), [{ id: 'p', build }]), /capacity/);
});
test('boosters control initial reserve and grounded recharge ceiling; repair uses assembled HP', () => {
  for (const booster of ['light', 'standard', 'heavy']) {
    const b = cleanBuild({
        frame: 'scout',
        parts: { ...partsFor({ frame: 'scout' }), booster },
        ability: 'repair',
      }),
      f = mechStats(b),
      w = make(b),
      p = w.players[0];
    assert.equal(p.energy, f.energy);
    p.energy = f.energy - 1;
    p.hp = f.hp - 1;
    p.active = 5;
    for (let i = 0; i < 20; i++) step(w, 0.05);
    assert.equal(p.energy, f.energy);
    assert.equal(p.hp, f.hp);
  }
});
test('part migration and saved copies do not alias components or accept unknown stat overrides', () => {
  const original = cleanBuild({ frame: 'scout' }),
    copy = cleanBuild(original);
  copy.parts.head = 'heavy';
  assert.equal(original.parts.head, 'light');
  const b = cleanBuild({
    parts: { head: '__proto__', legs: 'constructor' },
    hp: 99999,
    energy: 99999,
  });
  assert.equal(b.parts.head, 'standard');
  assert.equal(b.hp, undefined);
  assert.equal(b.energy, undefined);
  assert.deepEqual(cleanBuild(JSON.parse(JSON.stringify(original))), original);
});
test('arm variants trade armor for mass without changing gun cadence', () => {
  const a = cleanBuild(DEFAULT_BUILD),
    l = make({ ...a, parts: { ...a.parts, arms: 'light' } }),
    h = make({ ...a, parts: { ...a.parts, arms: 'heavy' } });
  for (const w of [l, h])
    for (let i = 0; i < 100; i++) {
      setInput(w, 'p1', { fire: true });
      step(w, 0.05);
    }
  assert.equal(l.players[0].shotCount, h.players[0].shotCount);
  assert.ok(mechStats(h.players[0].build).hp > mechStats(l.players[0].build).hp);
});

test('concurrent enemy volleys allow a recovery window instead of instantly deleting a mech', () => {
  const w = make(),
    p = w.players[0];
  const bullet = () => ({ x: p.x, y: p.y, z: 30, vx: 0, vy: 0, life: 1, damage: 30, enemy: true });
  w.bullets = [bullet(), bullet(), bullet()];
  step(w, 0.01);
  assert.equal(p.hp, 107);
  w.bullets = [bullet()];
  step(w, 0.05);
  assert.equal(p.hp, 107);
  for (let i = 0; i < 6; i++) step(w, 0.05);
  w.bullets = [bullet()];
  step(w, 0.01);
  assert.equal(p.hp, 89);
});
test('sector recovery caps at build limits and does not revive downed pilots', () => {
  const w = make(),
    p = w.players[0];
  p.hp = 120;
  p.energy = 95;
  w.players.push({ ...p, id: 'down', hp: 0, x: 3000 });
  w.encounter = true;
  step(w, 0.01);
  assert.equal(p.hp, 125);
  assert.equal(p.energy, 100);
  assert.equal(w.players[1].hp, 0);
});

test('directional boosts preserve aim, equal speed and energy, and replicate exhaust direction', () => {
  for (const fly of [false, true])
    for (const [x, y] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const w = make(),
        p = w.players[0],
        f = mechStats(p.build);
      w.mission.platforms = [];
      w.mission.ramps = [];
      const start = { x: p.x, y: p.y, energy: p.energy };
      setInput(w, p.id, { x, y, sprint: true, fly, angle: 0.43, fire: true });
      step(w, 0.05);
      const length = Math.hypot(x, y),
        distance = f.speed * f.boost * 0.05;
      assert.ok(Math.abs(p.x - start.x - (x / length) * distance) < 1e-6);
      assert.ok(Math.abs(p.y - start.y - (y / length) * distance) < 1e-6);
      assert.equal(p.angle, 0.43);
      assert.ok(p.shotCount > 0);
      assert.ok(
        Math.abs(start.energy - p.energy - (f.boostCost + (fly ? f.flightCost : 0)) * 0.05) < 1e-6,
      );
      assert.equal(p.boostX, x / length);
      assert.equal(p.boostY, y / length);
      const remote = snapshot(w, false).players[0];
      assert.equal(remote.boostX, p.boostX);
      assert.equal(remote.boostY, p.boostY);
      if (fly) assert.ok(p.altitude > 0);
      setInput(w, p.id, { x: 0, y: 0 });
      step(w, 0.05);
      assert.equal(p.boostX, 0);
      assert.equal(p.boostY, 0);
    }
});
