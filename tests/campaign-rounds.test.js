import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, campaignRound, missionTuning } from '../dist/mission-catalog.js';
import {
  newCampaign,
  cleanCampaign,
  campaignMission,
  recordSortie,
  installRefit,
  profileFor,
  refitOffer,
  registerPilot,
} from '../dist/campaign.js';
import { newWorld, cleanBuild, step, setInput, snapshot, mechStats } from '../dist/core.js';
import { chassisBlueprint, chassisBounds } from '../dist/chassis.js';
import { stepRound } from '../dist/round-director.js';
import {
  fieldOffer,
  chooseFieldModule,
  sortieReport,
  moduleLevel,
  fieldDamage,
} from '../dist/sortie-progression.js';
import * as T from '../dist/vendor/three.module.min.js';
import { buildRoundScene, updateRoundScene } from '../dist/round-scene.js';

test('nine authored deterministic arenas cover all acts, distinct routes and increasing encounter pressure', () => {
  assert.equal(MISSIONS.length, 9);
  assert.equal(new Set(MISSIONS.map((m) => m.id)).size, 9);
  assert.equal(new Set(MISSIONS.map((m) => m.layout)).size, 9);
  for (let i = 0; i < 9; i++) {
    const spec = MISSIONS[i],
      m = campaignRound(spec.id, 42);
    assert.deepEqual(m, campaignRound(spec.id, 42));
    assert.equal(m.sector, i + 1);
    assert.equal(spec.act, Math.floor(i / 3) + 1);
    assert.ok(spec.minutes <= 3.5);
    if (i) {
      assert.ok(missionTuning(i).health > missionTuning(i - 1).health);
      assert.ok(missionTuning(i).damage > missionTuning(i - 1).damage);
      assert.ok(spec.wave < MISSIONS[i - 1].wave);
    }
    for (const team of [1, 4]) assert.ok(missionTuning(i, team).cap <= 48);
    const radius = chassisBounds(chassisBlueprint('citadel')).radius;
    for (const point of [m.entry, m.exit, ...m.points, ...m.portals])
      assert.ok(
        !m.obstacles.some(
          (o) =>
            point.x + radius > o.x &&
            point.x - radius < o.x + o.w &&
            point.y + radius > o.y &&
            point.y - radius < o.y + o.h,
        ),
        spec.id + ' must leave objective/spawn clearance',
      );
    for (const p of m.points.filter((p) => p.z)) {
      assert.ok(p.z <= 240);
      assert.ok(
        m.platforms.some((d) => p.x > d.x && p.x < d.x + d.w && p.y > d.y && p.y < d.y + d.h),
      );
    }
  }
});

test('campaign save migration, ordered advancement and failed-run locks preserve chassis builds', () => {
  const legacy = { version: 1, id: 'old', seed: 99, sorties: 3, victories: 1 },
    c = cleanCampaign(legacy);
  assert.equal(c.level, 0);
  assert.equal(c.version, 2);
  assert.equal(c.sorties, 3);
  const next = recordSortie(c, 'victory', {
    outcome: 'victory',
    missionId: 'ashgate',
    missionName: 'Ashgate',
    round: true,
    pilots: [{ name: 'p', modules: [] }],
    salvage: 240,
    seconds: 90,
  });
  assert.equal(next.level, 1);
  assert.equal(next.pilots[0].credits, 2);
  assert.equal(campaignMission(next).missionId, 'glasswater');
  assert.equal(
    recordSortie(next, 'victory', { outcome: 'victory', missionId: 'ashgate' }),
    next,
    'duplicate/old mission report cannot grant rewards',
  );
  const failed = recordSortie(next, 'defeat', { outcome: 'defeat', missionId: 'glasswater' });
  assert.equal(failed.runState, 'lost');
  assert.equal(recordSortie(failed, 'victory'), failed);
  assert.deepEqual(cleanCampaign(JSON.parse(JSON.stringify(next))), next);
  const forged = cleanCampaign({
    ...next,
    level: 999,
    pilots: [
      {
        name: 'p',
        credits: 999,
        modules: ['power', 'power', 'power', 'power', '__proto__', 'unknown'],
      },
    ],
  });
  assert.equal(forged.level, 9);
  assert.deepEqual(forged.pilots[0].modules, ['power', 'power', 'power']);
  assert.ok(forged.pilots[0].credits <= 15);
});

test('refit is personal, revision-checked and persistent across missions; combat rejects installations', () => {
  let c = {
    ...newCampaign(22),
    level: 1,
    pilots: [
      { name: 'one', modules: [], credits: 2 },
      { name: 'two', modules: [], credits: 1 },
    ],
  };
  const request = { revision: c.revision, id: refitOffer(c, 'one')[0] },
    next = installRefit(c, 'one', request);
  assert.notEqual(next, c);
  assert.equal(profileFor(next, 'one').credits, 1);
  assert.equal(profileFor(next, 'two').credits, 1);
  assert.equal(installRefit(next, 'one', request), next);
  assert.equal(installRefit(next, 'two', { revision: next.revision, id: '__proto__' }), next);
  const build = cleanBuild(chassisBlueprint('warden')),
    w = newWorld(campaignMission(next), [
      { id: 'one', name: 'one', build },
      { id: 'two', name: 'two', build },
    ]);
  assert.equal(w.players[0].field.modules.length, 1);
  assert.deepEqual(w.players[0].build, build);
  assert.deepEqual(fieldOffer(w, w.players[0]), []);
  assert.equal(chooseFieldModule(w, w.players[0], { id: 'power', rank: 2 }), false);
  const report = sortieReport(w, 'victory');
  report.salvage = 400;
  const after = recordSortie(next, 'victory', report);
  assert.equal(profileFor(after, 'one').modules[0], request.id);
  assert.equal(after.level, 2);
  assert.equal(fieldDamage({ field: { modules: ['power'] } }, {}, 100), 112.00000000000001);
  assert.equal(moduleLevel(w.players[1], 'power'), 0);
});

test('each authored objective can complete for solo and four-pilot squads, then requires grounded team extraction', () => {
  for (const team of [1, 4])
    for (const spec of MISSIONS) {
      const w = newWorld(
          campaignRound(spec.id, 32),
          Array.from({ length: team }, (_, i) => ({
            id: 'p' + i,
            name: 'p' + i,
            build: chassisBlueprint(i ? 'citadel' : 'vanguard'),
          })),
        ),
        o = w.operation;
      const tick = (dt = 0.05) => {
        w.time += dt;
        stepRound(w, dt, mechStats);
      };
      w.time = spec.minimum + 1;
      w.kills = 200;
      if (spec.kind === 'purge') tick();
      else if (['salvage', 'escort'].includes(spec.kind)) {
        w.enemies = [];
        for (const cell of o.cells) {
          Object.assign(w.players[0], { x: cell.x, y: cell.y, altitude: cell.z });
          tick();
          assert.equal(cell.state, 'carried', spec.id);
          Object.assign(w.players[0], { x: o.crawler.x, y: o.crawler.y, altitude: 0 });
          tick();
          assert.equal(cell.state, 'delivered');
        }
        if (spec.kind === 'escort') {
          for (let i = 0; i < 1600 && o.phase === 0; i++) {
            Object.assign(w.players[0], { x: o.crawler.x, y: o.crawler.y, altitude: 0 });
            tick(0.05);
          }
        }
      } else if (spec.kind === 'uplink') {
        for (const p of w.mission.points) {
          Object.assign(w.players[0], { x: p.x, y: p.y, altitude: p.z });
          for (let i = 0; i < 400 && o.terminal < w.mission.points.indexOf(p) + 1; i++) tick();
        }
      } else if (spec.kind === 'siege') {
        for (const e of w.enemies) if (e.objectiveKind === 'relay') e.hp = 0;
        tick();
        assert.ok(w.enemies.filter((e) => e.objectiveKind === 'battery').every((e) => !e.locked));
        w.enemies = [];
        tick();
      } else if (spec.kind === 'sabotage') {
        w.enemies = [];
        tick();
      } else {
        w.enemies = [];
        w.spawn = [];
        tick();
        if (spec.kind === 'core') {
          assert.ok(o.bossSpawned);
          assert.ok(w.spawn.some((s) => s.zone.raidTarget));
          w.spawn = [];
          tick();
        }
      }
      assert.equal(o.phase, 1, `${spec.id}/${team} should reach extraction`);
      Object.assign(w.players[0], { ...w.mission.exit, altitude: 0 });
      w.time = o.shipAt + 1;
      tick(3.1);
      if (team > 1) assert.equal(w.status, 'playing');
      for (const p of w.players) Object.assign(p, { ...w.mission.exit, altitude: 0 });
      tick(3.1);
      assert.equal(w.status, 'won', spec.id);
      assert.equal(w.cleared, 3);
    }
});

test('enemy spawns scale with level, remain bounded and survive host/guest snapshot transport', () => {
  for (const index of [0, 4, 8]) {
    const w = newWorld(campaignRound(MISSIONS[index].id, 73), [
      { id: 'p', build: chassisBlueprint('colossus') },
    ]);
    w.players[0].recoverUntil = 1000;
    for (let i = 0; i < 240; i++) step(w, 0.05);
    const tune = missionTuning(index, 1);
    assert.ok(w.enemies.filter((e) => !e.objective).length + w.spawn.length <= tune.cap + 1);
    assert.ok(w.enemies.some((e) => e.species || e.elite));
    assert.equal(JSON.parse(JSON.stringify(snapshot(w))).mission.missionId, MISSIONS[index].id);
    assert.ok(w.enemies.every((e) => Number.isFinite(e.hp) && Number.isFinite(e.x)));
  }
});

test('nine consecutive victories carry earned personal modules and finish the run without repeat rewards', () => {
  let c = newCampaign(33);
  for (const [i, spec] of MISSIONS.entries()) {
    while (refitOffer(c, 'p').length) {
      const id = refitOffer(c, 'p')[0];
      c = installRefit(c, 'p', { id, revision: c.revision });
    }
    const w = newWorld(campaignMission(c), [
      { id: 'p', name: 'p', build: chassisBlueprint('vanguard') },
    ]);
    assert.deepEqual(w.players[0].field.modules, profileFor(c, 'p').modules);
    const report = sortieReport(w, 'victory');
    report.salvage = 350;
    report.seconds = 90;
    report.cleared = 3;
    c = recordSortie(c, 'victory', report);
    assert.equal(c.level, i + 1);
    assert.ok(profileFor(c, 'p').modules.length <= 18);
    assert.deepEqual(cleanCampaign(JSON.parse(JSON.stringify(c))), c);
  }
  assert.equal(c.runState, 'won');
  assert.equal(profileFor(c, 'p').credits, 0);
  assert.deepEqual(refitOffer(c, 'p'), []);
  assert.equal(recordSortie(c, 'victory'), c);
});

test('mission difficulty changes actual incoming damage while inherited run armor still mitigates it', () => {
  const losses = [];
  for (const [index, modules] of [
    [0, []],
    [8, []],
    [8, ['plating', 'plating']],
  ]) {
    const m = campaignRound(MISSIONS[index].id, 73),
      w = newWorld(m, [{ id: 'p', build: chassisBlueprint('vanguard') }]),
      p = w.players[0];
    Object.assign(p, { x: m.entry.x, y: m.entry.y, altitude: 0, recoverUntil: 0 });
    p.field.modules = modules;
    w.time = 10;
    w.operation.nextWave = w.operation.nextStrike = 999;
    w.bullets = [
      {
        id: 999,
        x: p.x + 50,
        y: p.y,
        z: 30,
        vx: -2000,
        vy: 0,
        vz: 0,
        life: 1,
        damage: 10,
        enemy: true,
      },
    ];
    step(w, 0.05);
    losses.push(mechStats(p.build).hp - p.hp);
  }
  assert.ok(losses[1] > losses[0]);
  assert.ok(losses[2] < losses[1]);
  assert.ok(Math.abs(losses[1] / losses[0] - missionTuning(8).damage) < 1e-8);
});

test('late joiners get bounded catch-up refits once, while returning pilots retain their run modules', () => {
  const c = {
      ...newCampaign(17),
      level: 4,
      pilots: [{ name: 'host', modules: ['power'], credits: 0 }],
    },
    joined = registerPilot(c, 'guest', ['host', 'guest']);
  assert.equal(profileFor(joined, 'guest').credits, 4);
  assert.equal(registerPilot(joined, 'guest', ['host', 'guest']), joined);
  assert.deepEqual(profileFor(joined, 'host').modules, ['power']);
  const after = recordSortie(joined, 'victory', {
    outcome: 'victory',
    missionId: 'gale-foundry',
    salvage: 200,
    pilots: [{ name: 'host' }],
  });
  assert.equal(profileFor(after, 'guest').credits, 4);
  assert.deepEqual(profileFor(after, 'host').modules, ['power']);
  assert.ok(after.pilots.length <= 4);
});

test('all arena meshes and dynamic mission objects have finite transforms and registered solid cover', () => {
  for (const spec of MISSIONS) {
    const m = campaignRound(spec.id, 42),
      w = newWorld(m, [{ id: 'p', build: chassisBlueprint('vanguard') }]),
      group = new T.Group(),
      cover = [];
    buildRoundScene(group, m, cover);
    updateRoundScene(group, w, 0.5);
    assert.equal(cover.length, 1 + m.obstacles.length + m.platforms.length + m.ramps.length);
    group.traverse((o) => {
      assert.ok([...o.position, ...o.scale].every(Number.isFinite), spec.id);
      if (o.isMesh) assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));
    });
  }
});
