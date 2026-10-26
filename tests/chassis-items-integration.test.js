import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import { CHASSIS, chassisBlueprint } from '../dist/chassis.js';
import { PART_DESIGNS } from '../dist/part-designs.js';
import {
  PARTS,
  ABILITIES,
  cleanBuild,
  mechStats,
  newWorld,
  testPlatform,
  planetMission,
  snapshot,
} from '../dist/core.js';
import { stepOperation } from '../dist/planet-mission.js';
import { makeMech, disposeMech } from '../dist/three-view.js';
import { muzzleOrigin } from '../dist/weapon-origin.js';
import { updateItemDetails } from '../dist/item-models.js';
import { createEquipmentFX } from '../dist/equipment-effects.js';
import { impactMode, toggleImpactMode } from '../dist/impact-preferences.js';

test('every part design preserves chassis identity, inherited balance and saved builds across all fifteen platforms', () => {
  for (const c of Object.values(CHASSIS))
    for (const [slot, items] of Object.entries(PARTS))
      for (const [id, part] of Object.entries(items)) {
        const b = cleanBuild({ ...chassisBlueprint(c.id), parts: { ...c.parts, [slot]: id } }),
          base = cleanBuild({ ...b, parts: { ...b.parts, [slot]: part.chassis } });
        assert.equal(b.chassis, c.id);
        assert.equal(b.parts[slot], id);
        assert.deepEqual(mechStats(b), mechStats(base));
        assert.deepEqual(cleanBuild(JSON.parse(JSON.stringify(b))), b);
        if (mechStats(b).valid)
          assert.deepEqual(
            snapshot(newWorld(testPlatform(), [{ id: 'p', build: b }]), false).players[0].build,
            b,
          );
      }
});

test('all alternate part families retain the named chassis shells, hardware and both authoritative muzzle mounts', () => {
  for (const c of Object.values(CHASSIS))
    for (let family = 0; family < 6; family++) {
      const parts = Object.fromEntries(
          Object.entries(PART_DESIGNS).map(([slot, designs]) => [slot, designs[family][0]]),
        ),
        build = cleanBuild({
          ...chassisBlueprint(c.id),
          parts,
          equipment: ['carbine', 'phaser', ['emp', 'shield', 'repair'][family % 3]],
        }),
        model = makeMech(build);
      assert.equal(model.userData.chassisPose.id, c.id);
      assert.equal(model.userData.itemDetails.special, build.ability);
      assert.equal(model.getObjectByName('special:' + build.ability)?.parent, model.userData.body);
      assert.ok(model.getObjectByName('attachment:0:carbine'));
      assert.ok(model.getObjectByName('attachment:1:phaser'));
      assert.equal(
        model.userData.body.userData.chassisShells.hull.scale.x,
        { light: 0.86, standard: 1, heavy: 1.13 }[PARTS.torso[parts.torso].chassis],
      );
      model.position.set(12, 7, -8);
      model.rotation.y = -0.63 - Math.PI / 2;
      model.updateMatrixWorld(true);
      for (const [hand, kit] of model.userData.kits.entries()) {
        const visual = kit.muzzle.getWorldPosition(new T.Vector3()),
          origin = muzzleOrigin(
            { x: 120, y: -80, altitude: 70, angle: 0.63, hand, build },
            kit.item,
          );
        assert.ok(
          Math.hypot(
            visual.x - origin.x * 0.1,
            visual.y - origin.z * 0.1,
            visual.z - origin.y * 0.1,
          ) < 1e-6,
          `${c.id}/${family}/${hand}`,
        );
      }
      disposeMech(model);
    }
});

test('mixed Scout and Giga squad fields keep world-space ability radii in Full and Reduced modes', () => {
  const fx = createEquipmentFX(new T.Group()),
    models = new Map();
  const players = ['wisp', 'colossus', 'leviathan', 'citadel'].map((id, i) => {
    const special = ['emp', 'shield', 'repair', 'shield'][i],
      build = cleanBuild({ ...chassisBlueprint(id), equipment: ['rail', 'dynamo', special] }),
      p = {
        id: 'p' + i,
        build,
        x: i * 40,
        y: i * 30,
        altitude: i * 50,
        hp: 100,
        activeAbility: special,
        active: ABILITIES[special].duration - 0.5,
        hands: [{ railCharge: 1 }, { motionCharge: 1 }],
      },
      m = makeMech(build);
    m.position.set(p.x * 0.1, p.altitude * 0.1, p.y * 0.1);
    m.updateMatrixWorld(true);
    models.set(p.id, m);
    return p;
  });
  const initial = impactMode();
  for (let mode = 0; mode < 2; mode++) {
    fx.update({ time: 1, players }, 1, models);
    for (const pool of fx.pools) {
      assert.ok(pool.count <= pool.instanceMatrix.count);
      assert.ok(pool.instanceMatrix.array.slice(0, pool.count * 16).every(Number.isFinite));
    }
    for (const index of [1, 3]) {
      const shell = fx.shells[index],
        p = players[index];
      assert.ok(shell.visible);
      assert.equal(shell.scale.x, ABILITIES.shield.radius * 0.1);
      assert.equal(shell.position.y, p.altitude * 0.1 + 0.15);
    }
    toggleImpactMode();
  }
  assert.equal(impactMode(), initial);
  fx.update({ players: [] }, 2, models);
  assert.ok(fx.shells.every((s) => !s.visible));
  assert.ok(fx.pools.every((p) => p.count === 0));
  for (const m of models.values()) disposeMech(m);
  fx.dispose();
});

test('real Cinderfall cell pickup, delivery, death and disconnect drive mounted cargo across chassis sizes', () => {
  for (const id of ['lark', 'citadel'])
    for (const outcome of ['delivery', 'death', 'disconnect']) {
      const w = newWorld(planetMission(38), [
          { id: 'p', build: chassisBlueprint(id) },
          { id: 'ally', build: chassisBlueprint('warden') },
        ]),
        p = w.players[0],
        model = makeMech(p.build),
        details = model.userData.itemDetails;
      const tick = () => {
        w.time += 0.05;
        stepOperation(w, 0.05, mechStats);
      };
      w.time = 86;
      w.kills = 100;
      tick();
      w.enemies = [];
      tick();
      w.enemies = [];
      const cell = w.operation.cells[0];
      Object.assign(p, { x: cell.x, y: cell.y, altitude: cell.z });
      tick();
      assert.equal(cell.state, 'carried');
      const visual = () => {
        const snap = JSON.parse(JSON.stringify(snapshot(w, false))),
          pilot = snap.players.find((a) => a.id === p.id);
        updateItemDetails(
          details,
          pilot || { hp: 0 },
          w.time,
          snap.operation.cells.some((c) => c.state === 'carried' && c.carrier === p.id),
        );
      };
      visual();
      assert.ok(details.cargo.visible);
      assert.equal(details.cargo.parent, model.userData.body);
      assert.equal(model.scale.x, CHASSIS[id].scale);
      if (outcome === 'delivery')
        Object.assign(p, { x: w.operation.crawler.x, y: w.operation.crawler.y, altitude: 0 });
      else if (outcome === 'death') p.hp = 0;
      else w.players.shift();
      tick();
      visual();
      assert.equal(details.cargo.visible, false);
      assert.equal(cell.state, outcome === 'delivery' ? 'delivered' : 'loose');
      disposeMech(model);
    }
});
