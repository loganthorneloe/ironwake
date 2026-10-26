import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as T from '../dist/vendor/three.module.min.js';
import {
  CHASSIS,
  CHASSIS_CLASSES,
  chassisFor,
  chassisBlueprint,
  chassisBounds,
} from '../dist/chassis.js';
import {
  cleanBuild,
  mechStats,
  newWorld,
  testPlatform,
  setInput,
  step,
  snapshot,
  validBuild,
  buildKey,
} from '../dist/core.js';
import { makeMech, animateMech, disposeMech } from '../dist/three-view.js';
import { CHASSIS_ART } from '../dist/chassis-art.js';
import { muzzleOrigin } from '../dist/weapon-origin.js';
import { thirdPersonView } from '../dist/third-person-view.js';
import { blocksBullet } from '../dist/bulwark.js';
import { fitComponent } from '../dist/workshop-grid.js';
import { CAMPAIGN_MECHS } from '../dist/campaign-view.js';

test('fifteen deployable factory chassis cover five classes, with three specialties in each class', () => {
  assert.equal(Object.keys(CHASSIS).length, 15);
  assert.equal(CAMPAIGN_MECHS.length, 15);
  for (const size of Object.keys(CHASSIS_CLASSES)) {
    const group = Object.values(CHASSIS).filter((c) => c.size === size);
    assert.equal(group.length, 3);
    assert.equal(new Set(group.map((c) => c.specialty)).size, 3);
    for (const c of group) {
      const b = cleanBuild(chassisBlueprint(c.id)),
        f = mechStats(b);
      assert.equal(f.valid, true, c.id + ': ' + f.issues.join(' '));
      assert.equal(f.chassisClass, size);
      assert.ok(f.heavyUsed <= f.heavySlots);
      assert.ok(f.weight <= f.capacity);
      assert.equal(newWorld(testPlatform(), [{ id: 'p', build: b }]).players[0].hp, f.hp);
    }
  }
});
test('chassis identity survives copies, JSON, snapshots and component fitting while forged profiles are stripped', () => {
  for (const c of Object.values(CHASSIS)) {
    const b = cleanBuild({ ...chassisBlueprint(c.id), scale: 99, heavySlots: 99, hp: 999999 });
    assert.equal(b.scale, undefined);
    assert.equal(b.hp, undefined);
    assert.deepEqual(cleanBuild(JSON.parse(JSON.stringify(b))), b);
    assert.equal(
      snapshot(newWorld(testPlatform(), [{ id: 'p', build: b }]), false).players[0].build.chassis,
      c.id,
    );
    const fitted = fitComponent(b, 'head', { kind: 'head', id: 'heavy' });
    assert.equal(fitted.chassis, c.id);
    assert.deepEqual(fitted.equipment, b.equipment);
    assert.deepEqual(fitted.partColors, b.partColors);
  }
  for (const id of ['missing', '__proto__', 'constructor', null, {}, false]) {
    assert.equal(cleanBuild({ chassis: id }).chassis, null);
    assert.equal(chassisBlueprint(id), null);
  }
  const legacy = cleanBuild({ frame: 'scout' });
  assert.equal(legacy.chassis, null);
  assert.equal(chassisFor(legacy).scale, 1);
  assert.equal(legacy.parts.torso, 'light');
});
test('heavy-rated mounts are enforced independently of weight; invalid drafts remain editable', () => {
  const lark = cleanBuild({ ...chassisBlueprint('lark'), equipment: ['blade', 'rail', 'emp'] });
  assert.ok(mechStats(lark).weight <= mechStats(lark).capacity);
  assert.equal(validBuild(lark), false);
  assert.match(mechStats(lark).issues.join(' '), /Lark supports 0/);
  assert.throws(() => newWorld(testPlatform(), [{ id: 'p', build: lark }]), /heavy/);
  const fixed = fitComponent(lark, 'equip1', { kind: 'hand', id: 'carbine' });
  assert.equal(validBuild(fixed), true);
  assert.equal(fixed.chassis, 'lark');
  const sniper = cleanBuild({
    ...chassisBlueprint('needle'),
    equipment: ['rail', 'dynamo', 'emp'],
  });
  assert.equal(mechStats(sniper).heavyUsed, 2);
  assert.equal(mechStats(sniper).heavySlots, 1);
  assert.equal(validBuild(sniper), false);
  const longbow = cleanBuild({ ...sniper, chassis: 'longbow' });
  assert.equal(validBuild(longbow), true);
  const tooHeavy = cleanBuild({
    ...chassisBlueprint('lark'),
    parts: chassisBlueprint('colossus').parts,
    equipment: ['blade', 'carbine', 'emp'],
  });
  assert.equal(validBuild(tooHeavy), false);
  assert.match(mechStats(tooHeavy).issues[0], /payload capacity/);
});
test('scale, armor, ground mobility and lift are real differences; aerial specialties climb faster in their class', () => {
  const stats = (id) => mechStats(cleanBuild(chassisBlueprint(id))),
    order = ['lark', 'kestrel', 'vanguard', 'bastion', 'colossus'];
  for (let i = 1; i < order.length; i++) {
    assert.ok(stats(order[i]).scale > stats(order[i - 1]).scale);
    assert.ok(stats(order[i]).hp > stats(order[i - 1]).hp);
    assert.ok(stats(order[i]).speed < stats(order[i - 1]).speed);
  }
  for (const [air, ground] of [
    ['wisp', 'lark'],
    ['harrier', 'kestrel'],
    ['skyguard', 'bastion'],
  ])
    assert.ok(stats(air).lift > stats(ground).lift);
  for (const id of order) {
    const b = cleanBuild(chassisBlueprint(id)),
      f = mechStats(b),
      w = newWorld(testPlatform(), [{ id: 'p', build: b }]),
      p = w.players[0],
      x = p.x;
    setInput(w, p.id, { x: 1, fly: true });
    step(w, 0.05);
    assert.ok(Math.abs(p.x - x - f.speed * f.boost * 0.05) < 1e-8);
    assert.ok(Math.abs(p.altitude - f.lift * 0.05) < 1e-8);
  }
});
test('barrels and physical models agree for both hands at every size and heading', () => {
  for (const c of Object.values(CHASSIS)) {
    const b = cleanBuild(chassisBlueprint(c.id)),
      g = makeMech(b);
    assert.equal(g.scale.x, c.scale);
    for (const angle of [0, 0.6, Math.PI]) {
      const p = { x: 120, y: -80, altitude: 90, angle, build: b, weapon: 'carbine' };
      g.position.set(12, 9, -8);
      g.rotation.y = -angle - Math.PI / 2;
      g.updateMatrixWorld(true);
      for (const [hand, kit] of g.userData.kits.entries()) {
        if (
          ![
            'rail',
            'carbine',
            'phaser',
            'plasma',
            'rotary',
            'flamer',
            'launcher',
            'dynamo',
          ].includes(kit.item)
        )
          continue;
        const visual = new T.Vector3();
        kit.muzzle.getWorldPosition(visual);
        const origin = muzzleOrigin({ ...p, hand }, kit.item);
        assert.ok(
          Math.hypot(
            visual.x - origin.x * 0.1,
            visual.y - origin.z * 0.1,
            visual.z - origin.y * 0.1,
          ) < 1e-6,
          c.id + ':' + kit.item,
        );
      }
    }
    disposeMech(g);
  }
});
test('camera distance, shield coverage and incoming bullet hitboxes follow chassis size', () => {
  for (const id of ['lark', 'vanguard', 'colossus']) {
    const build = cleanBuild(chassisBlueprint(id)),
      bounds = chassisBounds(build),
      p = { x: 0, y: 0, altitude: 20, angle: 0, hp: 100, guarding: true, build },
      camera = thirdPersonView(p, { yaw: 0, pitch: 0 });
    assert.ok(Math.abs(camera.position.x + 14 * bounds.scale) < 1e-8);
    assert.ok(Math.abs(camera.pivot.y - 2 - 4.8 * bounds.scale) < 1e-8);
    const shot = { x: 25 * bounds.scale, y: 0, z: 20 + 31 * bounds.scale, vx: -100, vy: 0, vz: 0 };
    assert.equal(blocksBullet(p, shot), true);
    assert.equal(blocksBullet(p, { ...shot, z: 20 + 5 * bounds.scale }), false);
    const w = newWorld(testPlatform(), [{ id: 'p', build }]),
      target = w.players[0];
    w.enemies = [];
    w.bullets = [
      {
        id: 1,
        x: target.x + 100,
        y: target.y,
        z: bounds.height - 2,
        vx: -2000,
        vy: 0,
        vz: 0,
        life: 1,
        damage: 10,
        enemy: true,
      },
    ];
    step(w, 0.05);
    assert.ok(target.hp < mechStats(build).hp, id);
  }
});
test('giga collision stops at walls and deck undersides instead of clipping its larger body', () => {
  const build = cleanBuild(chassisBlueprint('colossus')),
    bounds = chassisBounds(build),
    m = {
      ...testPlatform(),
      mode: 'test',
      obstacles: [{ x: 100, y: -100, w: 30, h: 200, height: 300 }],
      platforms: [],
      ramps: [],
      width: 1000,
      height: 1000,
      zones: [],
    },
    w = newWorld(m, [{ id: 'p', build }]),
    p = w.players[0];
  p.x = 50;
  p.y = 0;
  for (let i = 0; i < 30; i++) {
    setInput(w, p.id, { x: 1 });
    step(w, 0.05);
  }
  assert.ok(p.x <= 100 - bounds.radius + 0.01);
  w.mission.obstacles = [];
  w.mission.platforms = [{ x: 0, y: 0, w: 150, h: 150, z: 150 }];
  p.x = 75;
  p.y = 75;
  p.altitude = 0;
  for (let i = 0; i < 40; i++) {
    setInput(w, p.id, { fly: true });
    step(w, 0.05);
  }
  assert.ok(p.altitude + bounds.clearance <= 142 + 0.01);
});
test('all classes can reach elevated Cinderfall objectives and their identity changes model cache keys', () => {
  for (const c of Object.values(CHASSIS)) {
    const build = cleanBuild(chassisBlueprint(c.id)),
      w = newWorld(testPlatform(), [{ id: 'p', build }]),
      p = w.players[0];
    for (let i = 0; i < 120; i++) {
      setInput(w, p.id, { fly: true });
      step(w, 0.05);
    }
    assert.equal(p.altitude, 240);
    const legacy = cleanBuild({ ...build, chassis: null });
    assert.notEqual(buildKey(legacy), buildKey(build));
  }
});
test('mixed and all-Giga squads spawn with enough space for their real body radii', () => {
  for (const ids of [
    ['lark', 'needle', 'vanguard', 'colossus'],
    ['colossus', 'leviathan', 'citadel', 'colossus'],
  ]) {
    const w = newWorld(
      testPlatform(),
      ids.map((id, i) => ({ id: 'p' + i, build: chassisBlueprint(id) })),
    );
    for (let i = 0; i < w.players.length; i++)
      for (let j = i + 1; j < w.players.length; j++) {
        const a = w.players[i],
          b = w.players[j];
        assert.ok(
          Math.hypot(a.x - b.x, a.y - b.y) >
            chassisBounds(a.build).radius + chassisBounds(b.build).radius,
        );
      }
  }
});

test('all fifteen platforms have distinct structural geometry with identical parts, paint and equipment', () => {
  const signatures = new Set();
  for (const c of Object.values(CHASSIS)) {
    const build = cleanBuild({
        ...chassisBlueprint(c.id),
        color: '#d3dadd',
        parts: {
          head: 'standard',
          torso: 'standard',
          arms: 'standard',
          legs: 'standard',
          booster: 'standard',
        },
        equipment: ['carbine', 'carbine', 'emp'],
      }),
      g = makeMech(build),
      hash = createHash('sha256');
    assert.equal(g.userData.chassisPose.name, CHASSIS_ART[c.id].name);
    const roots = [
      g.userData.body,
      g.userData.head,
      ...g.userData.legs,
      ...g.userData.arms,
      ...g.userData.arms.map((a) => a.userData.elbow),
    ];
    for (const root of roots)
      for (const m of root.children.filter((o) => o.isMesh)) {
        const pa = m.geometry.attributes.position.array;
        assert.ok(pa.every(Number.isFinite), c.id + ' geometry must stay finite');
        hash.update(new Uint8Array(pa.buffer, pa.byteOffset, pa.byteLength));
      }
    const signature = hash.digest('hex');
    assert.ok(
      !signatures.has(signature),
      c.id + ' must change shape, independently of color or weapons',
    );
    signatures.add(signature);
    // New art remains rigid-batched; detail must not introduce hundreds of draw roots.
    let meshes = 0,
      triangles = 0;
    g.traverse((o) => {
      if (o.isMesh) {
        meshes++;
        triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3;
      }
    });
    assert.ok(meshes < 160, c.id);
    assert.ok(triangles < 20000, c.id);
    disposeMech(g);
  }
  assert.equal(signatures.size, 15);
  const legacy = makeMech(cleanBuild({ frame: 'striker' }));
  assert.equal(legacy.userData.chassisPose, null);
  disposeMech(legacy);
  const enemy = makeMech(cleanBuild(chassisBlueprint('citadel')), true, 'tank');
  assert.equal(enemy.userData.chassisPose, undefined);
  disposeMech(enemy);
});

test('redesigned shells preserve both weapon origins through every replaceable part tier and pitch', () => {
  for (const c of Object.values(CHASSIS))
    for (const tier of ['light', 'standard', 'heavy']) {
      const build = cleanBuild({
          ...chassisBlueprint(c.id),
          parts: { head: tier, torso: tier, arms: tier, legs: tier, booster: tier },
          equipment: ['carbine', 'phaser', 'emp'],
        }),
        g = makeMech(build);
      for (const pitch of [-0.45, 0, 0.65]) {
        const p = { x: 0, y: 0, altitude: 0, angle: 0.63, pitch, hp: 100, build };
        animateMech(g, p, 1, 10);
        g.updateMatrixWorld(true);
        for (const [hand, kit] of g.userData.kits.entries()) {
          const visual = kit.muzzle.getWorldPosition(new T.Vector3()),
            origin = muzzleOrigin({ ...p, hand }, kit.item);
          assert.ok(
            Math.hypot(
              visual.x - origin.x * 0.1,
              visual.y - origin.z * 0.1,
              visual.z - origin.y * 0.1,
            ) < 1e-6,
            `${c.id}/${tier}/${hand}/${pitch}`,
          );
        }
      }
      disposeMech(g);
    }
});

test('tracked Citadel stays level during movement and flight, while four-legged and runner frames articulate', () => {
  for (const id of ['citadel', 'leviathan', 'lark']) {
    const build = cleanBuild(chassisBlueprint(id)),
      g = makeMech(build);
    for (let i = 0; i < 20; i++)
      animateMech(
        g,
        { x: i * 5, y: 0, angle: -Math.PI / 2, altitude: 0, hp: 100, build },
        0.05,
        i * 0.05,
      );
    if (id === 'citadel') {
      assert.equal(g.position.y, 0);
      for (const leg of g.userData.legs) {
        assert.equal(leg.rotation.x, 0);
        assert.equal(leg.rotation.z, 0);
      }
    } else
      assert.ok(
        g.userData.legs.some((leg) => Math.abs(leg.rotation.x) > 0.01),
        id,
      );
    for (let i = 0; i < 20; i++)
      animateMech(
        g,
        { x: 100, y: 0, angle: -Math.PI / 2, altitude: 70, hp: 100, airborne: true, build },
        0.05,
        1 + i * 0.05,
      );
    if (id === 'citadel')
      for (const leg of g.userData.legs) {
        assert.equal(leg.rotation.x, 0);
        assert.equal(leg.rotation.z, 0);
      }
    assert.ok(g.userData.jets.every((j) => j.userData.exhaust.visible));
    if (id === 'leviathan')
      for (const leg of g.userData.legs) {
        // Each side has a front and a rear ground contact, rather than one broad boot.
        const geometry = leg.children.find(
            (o) => o.isMesh && !o.material.isMeshBasicMaterial,
          ).geometry,
          pa = geometry.attributes.position;
        let front = 0,
          rear = 0;
        for (let i = 0; i < pa.count; i++)
          if (pa.getY(i) < -2) {
            if (pa.getZ(i) < -0.8) front++;
            if (pa.getZ(i) > 0.8) rear++;
          }
        assert.ok(front > 0 && rear > 0);
      }
    disposeMech(g);
  }
});
