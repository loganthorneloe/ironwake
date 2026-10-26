import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import { visualBudget, shadowAnchor } from '../dist/visual-quality.js';
import {
  createGroundContact,
  contactSample,
  createPracticalPools,
} from '../dist/ground-contact.js';
import { createAmbientAir } from '../dist/ambient-air.js';
import { createSurfacePool, surfaceMask } from '../dist/surface-pool.js';
import { createBattleLighting } from '../dist/battle-lighting.js';
import { dressArena } from '../dist/arena-dressing.js';
import { buildRoundScene, roundSky } from '../dist/round-scene.js';
import { clearSpace } from '../dist/space-scene.js';
import { MISSIONS, campaignRound } from '../dist/mission-catalog.js';
import { newWorld, DEFAULT_BUILD, step } from '../dist/core.js';

const budget = visualBudget(),
  floor = () => ({ obstacles: [], platforms: [], ramps: [] });
function world() {
  return {
    time: 0,
    mission: floor(),
    players: [{ id: 'pilot', x: 100, y: 100, hp: 100, altitude: 0 }],
    enemies: [],
    effects: [],
  };
}
const blast = (id, extra = {}) => ({
  id,
  kind: 'explosion',
  x: 100,
  y: 100,
  z: 0,
  r: 90,
  life: 0.8,
  max: 0.8,
  ...extra,
});

test('coarse-pointer and constrained devices use smaller fixed budgets without exceeding existing desktop pixel ratio', () => {
  for (const hints of [{ coarse: true }, { cores: 4 }, { memory: 4 }]) {
    const small = visualBudget(hints);
    assert.equal(small.shadowSize, 512);
    assert.equal(small.pixelRatio, 1);
    assert.ok(small.motes < budget.motes && small.scorch < budget.scorch);
  }
  assert.equal(visualBudget({ cores: undefined, memory: undefined }).tier, 'standard');
  assert.equal(budget.pixelRatio, 1.35);
});

test('directional shadow anchor stays on the light-plane texel grid throughout translation and negative coordinates', () => {
  const h = Math.hypot(50, 45),
    length = Math.hypot(h, 85),
    right = new T.Vector3(-45 / h, 0, 50 / h),
    up = new T.Vector3((50 * 85) / (length * h), h / length, (45 * 85) / (length * h));
  for (const size of [512, 1024])
    for (let x = -80; x < 80; x += 0.7) {
      const p = shadowAnchor(x, x * 0.31, size),
        v = new T.Vector3(p.x, p.y, p.z),
        a = v.dot(right) / (230 / size),
        b = v.dot(up) / (170 / size);
      assert.ok(Math.abs(a - Math.round(a)) < 1e-9);
      assert.ok(Math.abs(b - Math.round(b)) < 1e-9);
      assert.ok(v.distanceTo(new T.Vector3(x, 0, x * 0.31)) < 0.3);
    }
});

test('contact follows decks, cover and sloping ramps, clips at edges, and fades with flight altitude', () => {
  const m = floor();
  m.platforms.push({ x: 0, y: 0, w: 200, h: 200, z: 80 });
  assert.equal(contactSample(m, 100, 100, 80).height, 80);
  assert.equal(contactSample(m, 100, 100, 0).height, 0, 'below a deck remains on ground');
  assert.ok(contactSample(m, 1, 100, 80, 4).radius <= 0.1);
  m.obstacles.push({ x: 300, y: 0, w: 100, h: 100, height: 40 });
  assert.equal(contactSample(m, 350, 50, 40).height, 40);
  assert.equal(
    contactSample(m, 299, 50, 40).height,
    0,
    'no movement-clearance padding in projected shadows',
  );
  m.ramps.push({ x: 500, y: 0, w: 200, h: 100, z: 80, axis: 'x', sign: 1 });
  const ramp = contactSample(m, 600, 50, 40);
  assert.equal(ramp.height, 40);
  assert.ok(ramp.normal.x < 0 && ramp.normal.y < 1);
  const grounded = contactSample(m, 800, 800, 0),
    flight = contactSample(m, 800, 800, 160);
  assert.ok(flight.radius > grounded.radius && flight.strength < grounded.strength / 2);
});

test('persistent scorch consumes replicated events once across missing and repeated frames and expires without changing world state', () => {
  const parent = new T.Group(),
    fx = createGroundContact(parent, budget),
    w = world();
  w.effects = [blast(1, { z: 32 })];
  const before = JSON.stringify(w);
  fx.update(w);
  fx.update(w);
  assert.equal(fx.stats().marks, 1);
  assert.equal(JSON.stringify(w), before);
  w.time = 0.5;
  w.effects = [];
  fx.update(w);
  assert.equal(fx.scorch.count, 1);
  w.effects = [blast(1, { z: 32 })];
  fx.update(w);
  assert.equal(fx.stats().marks, 1);
  w.time = 16;
  w.effects = [];
  fx.update(w);
  assert.equal(fx.stats().marks, 0);
  assert.equal(fx.stats().seen, 0);
  fx.dispose();
  assert.equal(parent.children.length, 0);
});

test('airbursts, landings, platform edges and thin cover never leave floating scorch quads', () => {
  const fx = createGroundContact(new T.Group(), budget),
    w = world();
  w.mission.platforms = [{ x: 500, y: 0, w: 200, h: 200, z: 80 }];
  w.mission.obstacles = [{ x: 102, y: 50, w: 2, h: 100, height: 30 }];
  w.effects = [
    blast(1),
    blast(2, { x: 600, y: 100, z: 85 }),
    blast(3, { x: 900, z: 150 }),
    blast(4, { x: 900, weapon: 'landing' }),
  ];
  fx.update(w);
  assert.equal(fx.stats().marks, 0);
  fx.dispose();
});

test('stress, Reduced toggles, clock rewind and repeated disposal keep fixed resources and pool caps', () => {
  const parent = new T.Group(),
    fx = createGroundContact(parent, visualBudget({ coarse: true })),
    w = world();
  w.enemies = Array.from({ length: 150 }, (_, i) => ({
    id: i,
    x: 300 + i,
    y: 300,
    hp: 100,
    r: 18,
  }));
  const geometry = fx.contacts.geometry,
    matrix = fx.contacts.instanceMatrix.array,
    textures = [fx.contacts.material.map, fx.scorch.material.map];
  for (let i = 0; i < 300; i++) {
    w.time = i / 60;
    w.effects = Array.from({ length: 20 }, (_, j) => blast(i * 20 + j, { x: 100 + j * 10 }));
    fx.update(w, i % 2 === 0);
    assert.ok(fx.contacts.count <= 52 && fx.scorch.count <= 8 && fx.stats().seen <= 128);
  }
  assert.equal(fx.contacts.geometry, geometry);
  assert.equal(fx.contacts.instanceMatrix.array, matrix);
  assert.equal(fx.contacts.material.map, textures[0]);
  assert.equal(fx.scorch.material.map, textures[1]);
  w.time = 0;
  w.effects = [];
  fx.update(w);
  assert.equal(fx.stats().marks, 0);
  let released = 0;
  for (const texture of textures) texture.addEventListener('dispose', () => released++);
  fx.dispose();
  assert.equal(released, 2);
  assert.equal(parent.children.length, 0);
});

test('Reduced hides ambient motion, buffers stay fixed, and peripheral air cannot intercept aiming', () => {
  const parent = new T.Group(),
    air = createAmbientAir(parent, budget),
    array = air.points.geometry.attributes.position.array;
  air.update(2, 100, 200);
  for (let i = 0; i < array.length; i += 3)
    assert.ok(Math.hypot(array[i] - 100, array[i + 2] - 200) >= 21.99);
  const before = array.slice();
  air.update(50, 100, 200, true);
  assert.equal(air.points.visible, false);
  assert.deepEqual(array, before);
  air.update(51);
  assert.equal(air.points.visible, true);
  assert.equal(air.points.geometry.attributes.position.array, array);
  const hits = [];
  air.points.raycast(new T.Raycaster(), hits);
  assert.equal(hits.length, 0);
  air.dispose();
  assert.equal(parent.children.length, 0);
});

test('surface material preserves the standard map, fog and output pipeline and ignores rays', () => {
  const parent = new T.Group(),
    mask = surfaceMask(),
    pool = createSurfacePool(parent, 2, mask, '#000000'),
    shader = {
      vertexShader: T.ShaderLib.basic.vertexShader,
      fragmentShader: T.ShaderLib.basic.fragmentShader,
    };
  pool.mesh.material.onBeforeCompile(shader);
  for (const chunk of ['map_fragment', 'fog_fragment', 'colorspace_fragment'])
    assert.ok(shader.fragmentShader.includes('#include <' + chunk + '>'));
  assert.ok(shader.vertexShader.includes('vSurfaceOpacity = surfaceOpacity'));
  assert.ok(shader.fragmentShader.includes('diffuseColor.a *= vSurfaceOpacity'));
  pool.begin();
  pool.put(0, 0.1, 0, 2, 0.3);
  pool.end();
  const hits = [];
  pool.mesh.raycast(new T.Raycaster(), hits);
  assert.deepEqual(hits, []);
  assert.equal(pool.mesh.material.depthWrite, false);
  assert.equal(pool.mesh.castShadow, false);
  pool.dispose();
  mask.dispose();
  assert.equal(parent.children.length, 0);
});

test('arena dressing places substantial architecture inside existing solid rims or outside playable bounds', () => {
  for (const spec of MISSIONS) {
    const m = campaignRound(spec.id),
      before = JSON.stringify(m),
      entries = [];
    dressArena((...a) => entries.push(a), m, 'box', 'tube', 'shard');
    assert.ok(entries.length < 450);
    for (const [x, y, z, w, h, d] of entries.filter((a) => a[4] > 2)) {
      const trim = Math.min(w, d) <= 0.15,
        edge = trim ? 6.7 : 6.5;
      const outside =
        x + w / 2 <= edge ||
        x - w / 2 >= m.width * 0.1 - edge ||
        z + d / 2 <= edge ||
        z - d / 2 >= m.height * 0.1 - edge;
      assert.ok(outside, `${spec.id}: art should not create a ghost blocker at ${x},${z}`);
    }
    const faceCladding = entries.filter((a) => a[4] === 32);
    assert.ok(
      faceCladding.every(
        ([x, , z, w, , d]) =>
          (d <= 0.08 &&
            Math.min(Math.abs(z - 6.5), Math.abs(z - (m.height * 0.1 - 6.5))) <= 0.04) ||
          (w <= 0.08 && Math.min(Math.abs(x - 6.5), Math.abs(x - (m.width * 0.1 - 6.5))) <= 0.04),
      ),
      'cladding is exposed at the existing wall face',
    );
    assert.equal(JSON.stringify(m), before);
  }
});

test('all nine arenas retain collision meshes and bounded batched dressing through repeated clear/rebuild', () => {
  const parent = new T.Group();
  for (const spec of MISSIONS)
    for (let replay = 0; replay < 2; replay++) {
      const m = campaignRound(spec.id),
        before = JSON.stringify(m),
        colliders = [];
      buildRoundScene(parent, m, colliders);
      assert.equal(colliders.length, 1 + m.obstacles.length + m.platforms.length + m.ramps.length);
      assert.equal(JSON.stringify(m), before);
      assert.ok(parent.children.filter((o) => o.isInstancedMesh).length < 32);
      const painted = parent.children.filter((o) => o.isInstancedMesh && o.instanceColor);
      assert.ok(
        painted.length >= 2 && painted.length <= 6,
        'paint colors share geometry/light batches',
      );
      assert.ok(
        painted.some(
          (o) => new Set(Array.from(o.instanceColor.array).map((v) => v.toFixed(4))).size > 3,
        ),
      );
      assert.ok(painted.filter((o) => o.material.isMeshBasicMaterial).every((o) => !o.castShadow));
      const sky = new T.Group();
      roundSky(sky, m);
      assert.ok(sky.children[0].material.fragmentShader.includes('colorspace_fragment'));
      clearSpace(sky);
      let disposed = 0;
      const pool = parent.children.find((o) => o.userData.disposeVisual);
      pool.material.map.addEventListener('dispose', () => disposed++);
      clearSpace(parent);
      assert.equal(parent.children.length, 0);
      assert.equal(disposed, 1);
    }
});

test('lighting budgets preserve the single shadow caster, and presentation leaves real simulation deterministic', () => {
  const scene = new T.Scene(),
    sun = new T.DirectionalLight(),
    hemisphere = new T.HemisphereLight();
  sun.castShadow = true;
  scene.add(sun, hemisphere, sun.target);
  const rig = createBattleLighting(scene, sun, budget);
  rig.setMission(campaignRound('ashgate'));
  rig.update(1, 2);
  assert.equal(scene.children.filter((o) => o.isLight && o.castShadow).length, 1);
  assert.equal(sun.shadow.mapSize.x, 1024);
  const m = campaignRound('ashgate', 814),
    roster = [{ id: 'p', build: DEFAULT_BUILD }],
    a = newWorld(structuredClone(m), roster),
    b = newWorld(structuredClone(m), roster),
    fx = createGroundContact(new T.Group(), budget);
  for (let i = 0; i < 180; i++) {
    step(a, {}, 1 / 60);
    fx.update(a, i % 2 === 0);
    step(b, {}, 1 / 60);
  }
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  fx.dispose();
  const lights = createPracticalPools(scene, [{ x: 0, z: 0 }]);
  lights.dispose();
});
