import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as T from '../dist/vendor/three.module.min.js';
import {
  PARTS,
  WEAPONS,
  ABILITIES,
  cleanBuild,
  mechStats,
  buildKey,
  newWorld,
  testPlatform,
  snapshot,
} from '../dist/core.js';
import { fitComponent } from '../dist/workshop-grid.js';
import { itemIcon, itemWeightClass } from '../dist/workshop-icons.js';
import { muzzleOrigin } from '../dist/weapon-origin.js';
import { makeMech, disposeMech } from '../dist/three-view.js';
import { updateItemDetails } from '../dist/item-models.js';
import { createEquipmentFX } from '../dist/equipment-effects.js';
import { toggleImpactMode, impactMode } from '../dist/impact-preferences.js';

test('all 45 frame designs fit, survive saves and snapshots, and preserve their chassis balance and firing origins', () => {
  for (const [slot, items] of Object.entries(PARTS)) {
    assert.equal(Object.keys(items).length, 9);
    for (const [id, item] of Object.entries(items)) {
      const b = fitComponent(cleanBuild({ parts: { booster: 'heavy' } }), slot, { kind: slot, id });
      assert.equal(b.parts[slot], id);
      assert.deepEqual(cleanBuild(JSON.parse(JSON.stringify(b))), b);
      const base = cleanBuild({ ...b, parts: { ...b.parts, [slot]: item.chassis } });
      assert.deepEqual(mechStats(b), mechStats(base));
      for (const hand of [0, 1])
        assert.deepEqual(
          muzzleOrigin({ x: 12, y: 30, altitude: 150, angle: 1.2, build: b, hand }),
          muzzleOrigin({ x: 12, y: 30, altitude: 150, angle: 1.2, build: base, hand }),
        );
      assert.equal(
        itemWeightClass(slot, id, item),
        item.chassis === 'standard' ? 'medium' : item.chassis,
      );
      if (mechStats(b).valid) {
        const w = newWorld(testPlatform(), [{ id: 'p', build: b }]);
        assert.deepEqual(snapshot(w, false).players[0].build, b);
      }
    }
  }
});

test('every part has a distinct mesh assembly and inventory silhouette, rather than only a different name', () => {
  for (const [slot, items] of Object.entries(PARTS)) {
    const meshes = new Set(),
      icons = new Set();
    for (const [id, item] of Object.entries(items)) {
      const build = cleanBuild({ parts: { [slot]: id } }),
        model = makeMech(build),
        hash = createHash('sha256');
      model.traverse((o) => {
        if (o.isMesh) {
          hash.update(Buffer.from(o.geometry.attributes.position.array.buffer));
          hash.update(JSON.stringify(o.scale.toArray()));
          hash.update(JSON.stringify(o.position.toArray()));
        }
      });
      const signature = hash.digest('hex');
      assert.ok(!meshes.has(signature), slot + ':' + id);
      meshes.add(signature);
      const icon = itemIcon(slot, id, item);
      assert.ok(!icons.has(icon), slot + ':' + id);
      icons.add(icon);
      disposeMech(model);
    }
  }
});

test('every weapon has support hardware in either hand, including duplicates, and every special has a dorsal emitter', () => {
  for (const id of Object.keys(WEAPONS))
    for (const special of Object.keys(ABILITIES)) {
      const model = makeMech(cleanBuild({ equipment: [id, id, special] }));
      assert.equal(model.userData.kits.length, 2);
      assert.equal(model.userData.kits[0].item, id);
      assert.equal(model.userData.kits[1].item, id);
      assert.equal(model.userData.itemDetails.special, special);
      assert.ok(model.userData.itemDetails.beacon);
      disposeMech(model);
    }
});

test('visual identity changes for frame, special, paint, exhaust and either hand while cosmetic paint preserves stats', () => {
  const base = cleanBuild({});
  for (const patch of [
    { parts: { ...base.parts, head: 'ronin' } },
    { equipment: ['guard', base.equipment[1], 'emp'] },
    { equipment: [base.equipment[0], 'rail', 'emp'] },
    { equipment: [...base.equipment.slice(0, 2), 'repair'] },
    { partColors: { ...base.partColors, arms: '#74adca' } },
    { trailColor: '#ffd06a' },
  ]) {
    const changed = cleanBuild({ ...base, ...patch });
    assert.notEqual(buildKey(changed), buildKey(base));
    if (patch.partColors || patch.trailColor) assert.deepEqual(mechStats(changed), mechStats(base));
  }
});

test('carried cell bolts onto the mech and disappears on delivery or death', () => {
  const model = makeMech(cleanBuild({})),
    details = model.userData.itemDetails,
    p = { hp: 100, active: 0 };
  updateItemDetails(details, p, 1, true);
  assert.equal(details.cargo.visible, true);
  assert.equal(details.cargo.parent, model.userData.body);
  updateItemDetails(details, p, 2, false);
  assert.equal(details.cargo.visible, false);
  updateItemDetails(details, { ...p, hp: 0 }, 3, true);
  assert.equal(details.cargo.visible, false);
  disposeMech(model);
});

function pilot(special, index = 0) {
  return {
    id: 'p' + index,
    x: index * 50,
    y: 0,
    altitude: index * 20,
    hp: 100,
    build: cleanBuild({ equipment: ['rail', 'dynamo', special] }),
    active: ABILITIES[special].duration - 0.35,
    activeAbility: special,
  };
}
function finitePools(fx) {
  for (const pool of fx.pools) {
    assert.ok(pool.count <= pool.instanceMatrix.count);
    for (const value of pool.instanceMatrix.array.slice(0, pool.count * 16))
      assert.ok(Number.isFinite(value));
  }
}
test('EMP, Aegis and repair have different finite field effects that follow altitude and stop at expiry, death or disconnect', () => {
  const parent = new T.Group(),
    fx = createEquipmentFX(parent),
    signatures = new Set();
  for (const special of Object.keys(ABILITIES)) {
    const p = pilot(special, 1);
    fx.update({ time: 0.35, players: [p] }, 0.35);
    finitePools(fx);
    signatures.add(JSON.stringify(fx.pools.map((p) => p.count)));
    assert.equal(fx.shells[0].visible, special === 'shield');
    if (special === 'shield') assert.equal(fx.shells[0].position.y, 2.15);
    p.active = 0;
    fx.update({ players: [p] }, 1);
    assert.ok(fx.pools.every((p) => p.count === 0));
    assert.ok(fx.shells.every((s) => !s.visible));
    p.active = 2;
    p.hp = 0;
    fx.update({ players: [p] }, 2);
    assert.ok(fx.pools.every((p) => p.count === 0));
  }
  assert.equal(signatures.size, 3);
  fx.update({ players: [] }, 3);
  assert.ok(fx.shells.every((s) => !s.visible));
  fx.dispose();
  assert.equal(parent.children.length, 0);
});

test('four simultaneous specials and eight charged hands keep fixed pool capacity; Reduced removes spinning and lowers particle counts', () => {
  const fx = createEquipmentFX(new T.Group()),
    players = ['emp', 'shield', 'repair', 'repair'].map(pilot),
    models = new Map();
  for (const p of players) {
    const m = makeMech(p.build);
    models.set(p.id, m);
    p.hands = [{ railCharge: 1 }, { motionCharge: 1 }];
  }
  if (impactMode() !== 'full') toggleImpactMode();
  fx.update({ time: 1, players }, 1, models);
  finitePools(fx);
  const fullCount = fx.pools[1].count;
  toggleImpactMode();
  fx.update({ time: 1, players }, 1, models);
  finitePools(fx);
  assert.ok(fx.pools[1].count < fullCount);
  assert.equal(fx.shells[1].material.uniforms.motion.value, 0);
  toggleImpactMode();
  for (const model of models.values()) disposeMech(model);
  fx.dispose();
});

test('every weapon usage effect has finite transforms, including phaser preview endpoints and blocked beams', () => {
  const fx = createEquipmentFX(new T.Group());
  for (const [id, weapon] of Object.entries(WEAPONS)) {
    const build = cleanBuild({ equipment: [id, id, 'emp'] }),
      model = makeMech(build),
      p = {
        id: 'p',
        build,
        x: 0,
        y: 0,
        hp: 100,
        active: 0,
        hands: [0, 1].map(() => ({
          railCharge: 1,
          motionCharge: 1,
          spin: 1,
          shot: weapon.rate * 0.5,
          meleeTime: weapon.rate * 0.5,
          guarding: true,
          flame: true,
          beam: { x: 30, y: -150, z: 40, hit: true },
        })),
      };
    fx.update({ time: 1, players: [p] }, 1, new Map([['p', model]]));
    finitePools(fx);
    for (const o of fx.root.children)
      if (o.isLineSegments) {
        assert.ok(o.geometry.drawRange.count <= 1024);
        for (const value of o.geometry.attributes.position.array.slice(
          0,
          o.geometry.drawRange.count * 3,
        ))
          assert.ok(Number.isFinite(value));
      }
    p.hands.forEach((h) => (h.beam = { blocked: true }));
    fx.update({ time: 1, players: [p] }, 1, new Map([['p', model]]));
    finitePools(fx);
    disposeMech(model);
  }
  fx.dispose();
});
