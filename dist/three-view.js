import { createEnemyCues } from './enemy-cues.js';
import { applyEnemyPose } from './enemy-motion.js';
import { createEnemyFlair } from './enemy-flair.js';
import { buildDestructionScene } from './destruction-scene.js';
import { bindDestruction } from './destruction.js';
import { insertionView } from './cinematic.js';
import { impactMode } from './impact-preferences.js';
import { chassisFor } from './chassis.js';
import { buildChassisModel } from './chassis-models.js';
import { createEquipmentFX } from './equipment-effects.js';
import { createFieldScene } from './field-scene.js';
import { addItemDetails, updateItemDetails } from './item-models.js';
import { createImpactPool } from './impact-effects.js';
import { createCombatFeel } from './combat-feel.js';
import { impactLevel } from './impact-preferences.js';
import { makeRobot, animateRobot, createRobotBatch } from './robot-models.js?v=41';
import {
  buildPlanet,
  planetSky,
  makeMissionObjective,
  updateMissionObjective,
  updatePlanet,
} from './planet-scene.js?v=41';
import { createDashEffect } from './dash-effects.js?v=impact-1';
import { thirdPersonView } from './third-person-view.js?v=41';
import {
  createHomeBattle,
  createHangarEnvironment,
  finishHangarMech,
  restHangarMech,
} from './home-battle.js?v=hangar-1';
import { makeFlameEffect } from './flame-effects.js?v=impact-1';
import { createExplosionPool } from './explosion-effects.js?v=impact-1';
import { correctedProjectile, launchCorrection } from './weapon-origin.js?v=41';
import {
  makeProjectile,
  updateProjectile,
  disposeProjectile,
} from './projectile-models.js?v=impact-1';
import { makeWeapons } from './weapon-models.js?v=impact-1';
import { meleePose, recoilFor, recoilEnvelope } from './combat-motion.js?v=impact-1';
import { buildStation, buildTestPlatform, createSky, clearSpace } from './space-scene.js?v=41';
import * as T from './vendor/three.module.min.js';
import {
  equipmentFor,
  partsFor,
  mechStats,
  WEAPONS,
  RANGED,
  MELEE,
  ABILITIES,
  PARTS,
  buildKey,
  rng,
  cleanBuild,
} from './core.js?v=41';
import { view } from './view-controls.js?v=41';
const S = 0.1,
  UP = new T.Vector3(0, 1, 0),
  boxGeometry = new T.BoxGeometry(1, 1, 1),
  sphereGeometry = new T.IcosahedronGeometry(1, 1),
  cylinderGeometry = new T.CylinderGeometry(1, 1, 1, 8),
  coneGeometry = new T.ConeGeometry(1, 1, 8),
  ringGeometry = new T.TorusGeometry(1, 0.018, 4, 64);
const gradient = new T.DataTexture(
  new Uint8Array([48, 48, 48, 255, 142, 142, 142, 255, 255, 255, 255, 255]),
  3,
  1,
  T.RGBAFormat,
);
gradient.minFilter = T.NearestFilter;
gradient.magFilter = T.NearestFilter;
gradient.generateMipmaps = false;
gradient.needsUpdate = true;
const ink = new T.LineBasicMaterial({ color: 0x13212b, transparent: true, opacity: 0.85 });
const edgeCache = new Map();
function outline(g) {
  if (!edgeCache.has(g.uuid)) edgeCache.set(g.uuid, new T.EdgesGeometry(g, 24));
  const edge = new T.LineSegments(edgeCache.get(g.uuid), ink);
  edge.raycast = () => {};
  return edge;
}
const materials = new Map();
function mat(color, emissive = false) {
  const key = color + ':' + emissive;
  if (!materials.has(key))
    materials.set(
      key,
      emissive
        ? new T.MeshBasicMaterial({ color })
        : new T.MeshToonMaterial({ color, gradientMap: gradient }),
    );
  return materials.get(key);
}
function mesh(parent, g, m, x, y, z, sx, sy, sz) {
  const o = new T.Mesh(g, m);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  o.castShadow = true;
  o.receiveShadow = true;
  if (!m.isMeshBasicMaterial) o.add(outline(g));
  parent.add(o);
  return o;
}
function box(parent, x, y, z, w, h, d, color) {
  return mesh(
    parent,
    armorMode ? armorGeometry : boxGeometry,
    typeof color === 'object' ? color : mat(color),
    x,
    y,
    z,
    w,
    h,
    d,
  );
}
function cyl(parent, x, y, z, r, h, color) {
  return mesh(parent, cylinderGeometry, mat(color), x, y, z, r, h, r);
}
function glow(parent, x, y, z, w, h, d, color) {
  const o = box(parent, x, y, z, w, h, d, mat(color, true));
  o.castShadow = false;
  return o;
}
const armorShape = new T.Shape();
armorShape.moveTo(-0.42, -0.42);
armorShape.lineTo(0.42, -0.42);
armorShape.lineTo(0.42, 0.42);
armorShape.lineTo(-0.42, 0.42);
armorShape.closePath();
const armorGeometry = new T.ExtrudeGeometry(armorShape, {
  depth: 0.84,
  bevelEnabled: true,
  bevelSegments: 1,
  steps: 1,
  bevelSize: 0.08,
  bevelThickness: 0.08,
});
armorGeometry.translate(0, 0, -0.42);
let armorMode = false;
const batchCache = new Map(),
  toonVertex = new T.MeshToonMaterial({ vertexColors: true, gradientMap: gradient }),
  basicVertex = new T.MeshBasicMaterial({ vertexColors: true });
function batchParts(root, excluded, key) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert(),
    entries = [];
  function visit(node) {
    if (excluded.has(node)) return;
    if (node.isMesh) {
      entries.push(node);
      return;
    }
    for (const child of [...node.children]) visit(child);
  }
  for (const child of [...root.children]) visit(child);
  let cached = batchCache.get(key);
  if (!cached) {
    cached = [];
    for (const basic of [false, true]) {
      const positions = [],
        normals = [],
        colors = [];
      for (const part of entries) {
        if (!!part.material.isMeshBasicMaterial !== basic) continue;
        const geo = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry,
          transform = inverse.clone().multiply(part.matrixWorld),
          normalTransform = new T.Matrix3().getNormalMatrix(transform),
          pa = geo.attributes.position,
          na = geo.attributes.normal,
          color = part.material.color,
          v = new T.Vector3(),
          n = new T.Vector3();
        for (let i = 0; i < pa.count; i++) {
          v.fromBufferAttribute(pa, i).applyMatrix4(transform);
          n.fromBufferAttribute(na, i).applyMatrix3(normalTransform).normalize();
          positions.push(v.x, v.y, v.z);
          normals.push(n.x, n.y, n.z);
          colors.push(color.r, color.g, color.b);
        }
        if (geo !== part.geometry) geo.dispose();
      }
      if (positions.length) {
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
        geometry.computeBoundingSphere();
        cached.push({ geometry, basic });
      }
    }
    batchCache.set(key, cached);
  }
  for (const part of entries) part.removeFromParent();
  for (const entry of cached) {
    const combined = new T.Mesh(entry.geometry, entry.basic ? basicVertex : toonVertex);
    combined.castShadow = !entry.basic;
    combined.receiveShadow = true;
    if (!entry.basic) combined.add(outline(entry.geometry));
    root.add(combined);
  }
}
const flameMaterials = new Map();
function flameFor(tint) {
  if (!flameMaterials.has(tint))
    flameMaterials.set(
      tint,
      new T.MeshBasicMaterial({
        color: tint,
        transparent: true,
        opacity: 0.38,
        blending: T.AdditiveBlending,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    );
  return flameMaterials.get(tint);
}
const flameCore = new T.MeshBasicMaterial({
  color: 0xdbffff,
  transparent: true,
  opacity: 0.95,
  blending: T.AdditiveBlending,
  depthWrite: false,
});
function makeJet(parent, x, y, z, size, style = 'standard', tint = '#56bfff') {
  const root = new T.Group(),
    exhaust = new T.Group();
  root.position.set(x, y, z);
  root.scale.setScalar(size);
  parent.add(root);
  root.userData = { size, style, exhaust, petals: [], sparks: [] };
  cyl(root, 0, 0.25, 0, 0.5, 0.7, '#172331');
  cyl(root, 0, -0.04, 0, 0.58, 0.17, '#a9bdcc');
  cyl(root, 0, -0.15, 0, 0.43, 0.1, '#080f18');
  const throat = cyl(root, 0, -0.19, 0, 0.33, 0.035, tint);
  throat.material = mat(tint, true);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3,
      petal = new T.Group();
    petal.position.set(Math.cos(a) * 0.48, -0.09, Math.sin(a) * 0.48);
    petal.rotation.y = -a;
    root.add(petal);
    box(petal, 0.06, -0.21, 0, 0.14, 0.5, 0.25, '#6a8396');
    box(petal, 0.14, -0.04, 0, 0.05, 0.13, 0.19, '#efa45e');
    root.userData.petals.push(petal);
    const brace = box(
      root,
      Math.cos(a) * 0.52,
      0.3,
      Math.sin(a) * 0.52,
      0.08,
      0.4,
      0.09,
      '#344759',
    );
  }
  root.add(exhaust);
  exhaust.position.y = -0.26;
  const outer = new T.Mesh(coneGeometry, flameFor(tint));
  outer.rotation.x = Math.PI;
  outer.position.y = -1.4;
  outer.scale.set(style === 'heavy' ? 0.48 : 0.32, 2.8, style === 'heavy' ? 0.48 : 0.32);
  exhaust.add(outer);
  const core = new T.Mesh(coneGeometry, flameCore);
  core.rotation.x = Math.PI;
  core.position.y = -0.58;
  core.scale.set(0.19, 1.35, 0.19);
  exhaust.add(core);
  for (let i = 0; i < 6; i++) {
    const spark = new T.Mesh(sphereGeometry, flameCore);
    spark.userData.phase = i / 6;
    exhaust.add(spark);
    root.userData.sparks.push(spark);
  }
  exhaust.visible = false;
  batchParts(root, new Set([exhaust, ...root.userData.petals]), 'nozzle:' + style + ':' + tint);
  return root;
}
function driveJets(g, p, dt, t) {
  const u = g.userData,
    active = p.hp > 0 && (p.airborne || p.boosting || p.moveTime > 0),
    target = active ? (p.moveTime > 0 ? 2.2 : p.boosting ? 1.3 : 1) : 0;
  u.throttle = T.MathUtils.lerp(u.throttle || 0, target, 1 - Math.exp(-dt * 16));
  const forward =
      (p.boostX || 0) * Math.cos(p.angle || 0) + (p.boostY || 0) * Math.sin(p.angle || 0),
    strafe = -(p.boostX || 0) * Math.sin(p.angle || 0) + (p.boostY || 0) * Math.cos(p.angle || 0);
  for (const j of u.jets) {
    const { exhaust, petals, sparks, style } = j.userData;
    exhaust.visible = u.throttle > 0.02;
    const pulse =
      1 +
      Math.sin(t * (style === 'light' ? 70 : style === 'heavy' ? 31 : 48) + j.position.x) * 0.09;
    exhaust.scale.set(1, Math.max(0.01, u.throttle) * pulse, 1);
    j.rotation.x = T.MathUtils.lerp(j.rotation.x, -forward * 1.05, Math.min(1, dt * 10));
    j.rotation.z = T.MathUtils.lerp(j.rotation.z, -strafe * 1.05, Math.min(1, dt * 10));
    for (const petal of petals) petal.rotation.z = -0.12 - u.throttle * 0.25;
    for (let i = 0; i < sparks.length; i++) {
      const spark = sparks[i],
        phase = (t * 3.8 + spark.userData.phase) % 1;
      spark.position.set(
        Math.sin(i * 12 + t * 3) * phase * 0.28,
        -0.8 - phase * 3.5,
        Math.cos(i * 7 + t * 3) * phase * 0.28,
      );
      spark.scale.set(0.06 * (1 - phase), 0.24 * (1 - phase), 0.06 * (1 - phase));
    }
  }
  if (!u.enemy) {
    if (!u.contrails) {
      u.contrails = u.jets.map((jet) => {
        const geometry = new T.BufferGeometry();
        geometry.setAttribute(
          'position',
          new T.Float32BufferAttribute(new Float32Array(16 * 18), 3),
        );
        geometry.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(16 * 18), 3));
        geometry.setDrawRange(0, 0);
        const ribbon = new T.Mesh(
          geometry,
          new T.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.65,
            side: T.DoubleSide,
            depthWrite: false,
            blending: T.AdditiveBlending,
          }),
        );
        ribbon.frustumCulled = false;
        g.add(ribbon);
        return { jet, ribbon, samples: [] };
      });
    }
    g.updateWorldMatrix(true, true);
    const tint = new T.Color(u.build.trailColor || '#56bfff');
    for (const trail of u.contrails) {
      for (const sample of trail.samples) sample.life -= dt;
      while (trail.samples[0]?.life <= 0) trail.samples.shift();
      const position = trail.jet.localToWorld(new T.Vector3(0, -0.4, 0));
      if (
        active &&
        (!trail.samples.length || trail.samples.at(-1).position.distanceTo(position) > 0.08)
      )
        trail.samples.push({ position, life: 0.28 });
      while (trail.samples.length > 17) trail.samples.shift();
      const pa = trail.ribbon.geometry.attributes.position.array,
        ca = trail.ribbon.geometry.attributes.color.array;
      let index = 0;
      for (let i = 1; i < trail.samples.length; i++) {
        const a = trail.samples[i - 1],
          b = trail.samples[i],
          av = g.worldToLocal(a.position.clone()),
          bv = g.worldToLocal(b.position.clone()),
          width = 0.12;
        for (const [pt, side, life] of [
          [av, -1, a.life],
          [av, 1, a.life],
          [bv, 1, b.life],
          [av, -1, a.life],
          [bv, 1, b.life],
          [bv, -1, b.life],
        ]) {
          pa[index] = pt.x + width * side;
          pa[index + 1] = pt.y;
          pa[index + 2] = pt.z;
          const fade = Math.max(0, life / 0.28);
          ca[index] = tint.r * fade;
          ca[index + 1] = tint.g * fade;
          ca[index + 2] = tint.b * fade;
          index += 3;
        }
      }
      trail.ribbon.geometry.setDrawRange(0, index / 3);
      trail.ribbon.geometry.attributes.position.needsUpdate = true;
      trail.ribbon.geometry.attributes.color.needsUpdate = true;
    }
  }
  if (!u.enemy && !u.engineLight) {
    u.engineLight = new T.PointLight(u.build.trailColor || 0x4bbfff, 0, 12, 2);
    u.engineLight.position.set(0, 1.5, 2);
    g.add(u.engineLight);
  }
  if (u.engineLight) u.engineLight.intensity = u.throttle * 8;
  const air = p.airborne || (p.altitude || 0) > 8,
    lean = (p.boosting ? -forward * 0.42 : air ? -0.12 : 0) + (u.combatLean || 0);
  u.body.rotation.x = T.MathUtils.lerp(u.body.rotation.x, lean, Math.min(1, dt * 12));
  u.body.rotation.z = T.MathUtils.lerp(u.body.rotation.z, -strafe * 0.3, Math.min(1, dt * 12));
  if (p.stun > 0) u.body.rotation.z += Math.sin(t * 45) * 0.025;
  for (let i = 0; i < 2; i++) {
    const leg = u.legs[i],
      gait = u.chassisPose?.gait ?? 1,
      pose =
        gait === 0
          ? 0
          : air
            ? 0.45 + (i === 0 ? 0.15 : -0.1)
            : Math.sin(u.phase + i * Math.PI) * Math.min(0.6, (u.motion || 0) * 0.04) * gait;
    leg.rotation.x = T.MathUtils.lerp(leg.rotation.x, pose, Math.min(1, dt * 14));
    leg.rotation.z = T.MathUtils.lerp(
      leg.rotation.z,
      air && gait > 0 ? (i === 0 ? -0.1 : 0.1) : 0,
      Math.min(1, dt * 10),
    );
  }
  if (!u.dust) {
    u.dust = new T.Mesh(
      ringGeometry,
      new T.MeshBasicMaterial({
        color: 0xcbe9ec,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    u.dust.rotation.x = -Math.PI / 2;
    g.add(u.dust);
  }
  if (u.wasAir && !air) u.landing = 1;
  u.wasAir = air;
  u.landing = Math.max(0, (u.landing || 0) - dt * 2.5);
  u.dust.visible = u.landing > 0 || (active && (p.altitude || 0) < 25);
  u.dust.position.y = (-(p.altitude || 0) * S) / g.scale.y + 0.08;
  u.dust.scale.setScalar(u.landing ? 1 + (1 - u.landing) * 5 : 2 + (Math.sin(t * 8) + 1) * 0.4);
  u.dust.material.opacity = u.landing * 0.45 + (active && !air ? 0.2 : 0);
}
export function makeMech(build, enemy = false, type = '') {
  armorMode = true;
  const g = new T.Group(),
    body = new T.Group();
  g.add(body);
  if (!enemy) g.scale.setScalar(chassisFor(build).scale);
  const color = enemy
      ? type === 'boss'
        ? '#a54332'
        : type === 'tank'
          ? '#786553'
          : '#bd614b'
      : build.color,
    dark = '#17283c',
    steel = '#abbfd1',
    light = enemy ? '#ff5b32' : '#8beee5';
  const paint = (slot) => (enemy ? color : build.partColors?.[slot] || color);
  const designParts = partsFor(build),
    parts = Object.fromEntries(
      Object.entries(designParts).map(([slot, id]) => [slot, PARTS[slot][id].chassis]),
    ),
    heavy = parts.torso === 'heavy',
    scout = parts.torso === 'light',
    width = heavy ? 1.65 : scout ? 1.1 : 1.35;
  box(
    body,
    0,
    3.6,
    0,
    width * (scout ? 1.35 : heavy ? 2.05 : 1.75),
    scout ? 1.35 : heavy ? 2.2 : 1.9,
    scout ? 0.9 : heavy ? 1.9 : 1.25,
    paint('torso'),
  );
  const prow = box(body, 0, 4.24, -0.68, width * 1.7, 0.35, 0.55, paint('torso'));
  prow.rotation.x = -0.28;
  const chest = box(body, 0, 3.95, -0.7, width * 1.5, 0.75, 0.25, steel);
  chest.rotation.x = -0.2;
  box(body, 0, 3.55, -0.76, width * 0.9, 0.55, 0.2, dark);
  glow(body, 0, 3.67, -0.89, 0.65, 0.13, 0.05, light);
  box(body, 0, 2.55, 0, 1.3, 0.6, 0.9, dark);
  box(body, 0, 2.6, -0.6, 0.9, 0.4, 0.25, paint('torso'));
  const head = new T.Group();
  head.position.set(0, heavy ? 4.8 : 5.03, -0.1);
  body.add(head);
  if (parts.head === 'heavy') {
    box(head, 0, 0, 0, 1.4, 0.65, 1.15, dark);
    const eye = cyl(head, 0, 0, -0.63, 0.24, 0.12, steel);
    eye.rotation.x = Math.PI / 2;
    glow(head, 0, 0, -0.72, 0.24, 0.2, 0.06, light);
    box(head, 0, 0.35, 0, 1.5, 0.2, 0.9, paint('head'));
  } else if (parts.head === 'light') {
    const helmet = box(head, 0, 0, 0, 0.66, 0.65, 1.2, paint('head'));
    helmet.rotation.x = -0.2;
    glow(head, 0, -0.07, -0.64, 0.56, 0.12, 0.06, light);
    const fin = box(head, 0, 0.5, 0.1, 0.11, 0.9, 0.7, steel);
    fin.rotation.x = 0.4;
  } else {
    box(head, 0, 0, 0, 0.95, 0.75, 0.8, paint('head'));
    box(head, 0, -0.08, -0.45, 0.85, 0.3, 0.14, dark);
    glow(head, 0, -0.04, -0.54, 0.66, 0.12, 0.04, light);
    for (const side of [-1, 1]) {
      const horn = box(head, side * 0.6, 0.44, -0.1, 0.09, 0.9, 0.09, paint('head'));
      horn.rotation.z = -side * 0.65;
    }
  }
  const legHeavy = parts.legs === 'heavy',
    legLight = parts.legs === 'light';
  const legs = [],
    arms = [];
  for (const side of [-1, 1]) {
    const leg = new T.Group();
    leg.position.set(side * (legHeavy ? 0.93 : legLight ? 0.5 : 0.63), 2.35, 0);
    g.add(leg);
    legs.push(leg);
    box(
      leg,
      0,
      -0.65,
      legLight ? 0.25 : 0,
      legLight ? 0.45 : legHeavy ? 1 : 0.7,
      1.15,
      legLight ? 0.6 : legHeavy ? 1.1 : 0.8,
      paint('legs'),
    );
    box(leg, 0, -1.21, -0.1, 0.78, 0.38, 0.9, steel);
    box(
      leg,
      0,
      -1.67,
      legLight ? 0.45 : 0.1,
      legLight ? 0.42 : legHeavy ? 1.2 : 0.78,
      0.85,
      legLight ? 0.55 : legHeavy ? 1.2 : 0.8,
      paint('legs'),
    );
    box(
      leg,
      0,
      -2.08,
      -0.25,
      legLight ? 0.65 : legHeavy ? 1.4 : 0.95,
      0.35,
      legHeavy ? 1.85 : 1.4,
      dark,
    );
    box(leg, 0, -2.02, -0.88, 0.83, 0.2, 0.17, paint('legs'));
    box(leg, side * 0.3, -1.6, -0.35, 0.17, 0.5, 0.2, steel);
    const arm = new T.Group();
    arm.position.set(side * (width + 0.1), 4.15, 0);
    body.add(arm);
    arms.push(arm);
    arm.scale.setScalar(parts.arms === 'heavy' ? 1.1 : parts.arms === 'light' ? 0.78 : 1);
    const pauldron = box(
      arm,
      0,
      0,
      0,
      parts.arms === 'heavy' ? 1.35 : parts.arms === 'light' ? 0.7 : 1.05,
      parts.arms === 'heavy' ? 1.25 : parts.arms === 'light' ? 0.55 : 0.85,
      parts.arms === 'heavy' ? 1.5 : 1.4,
      paint('arms'),
    );
    pauldron.rotation.z = -side * 0.13;
    box(arm, side * 0.48, -0.28, 0, 0.18, 0.85, 1.3, paint('arms'));
    box(arm, side * 0.02, -0.8, 0.02, 0.58, 1.0, 0.65, steel);
    const elbow = new T.Group();
    elbow.position.set(0, -0.95, 0);
    arm.add(elbow);
    arm.userData.elbow = elbow;
    box(elbow, 0, -0.54, -0.15, 0.8, 0.8, 0.8, paint('arms'));
    box(elbow, 0, -0.89, -0.3, 0.55, 0.35, 0.6, dark);
    cyl(arm, 0, -0.95, 0, 0.34, 0.72, dark).rotation.z = Math.PI / 2;
    box(arm, 0, 0.05, -0.74, 0.55, 0.12, 0.06, dark);
    glow(arm, 0, -0.15, -0.74, 0.5, 0.05, 0.05, light);
    // Articulated backpack and heel nozzles keep the exhaust visible from the chase camera.
    const jet = makeJet(
      body,
      side * 0.92,
      2.6,
      1.5,
      parts.booster === 'heavy' ? 1.12 : parts.booster === 'light' ? 0.8 : 1,
      parts.booster,
      build.trailColor,
    );
    g.userData.jets ??= [];
    g.userData.jets.push(jet);
    const heel = makeJet(leg, 0, -2.15, 0.4, 0.38, parts.booster, build.trailColor);
    g.userData.jets.push(heel);
  }
  const reactorSize = parts.torso === 'heavy' ? 1.45 : parts.torso === 'light' ? 0.75 : 1;
  box(body, 0, 3.65, 0.86, 1.15 * reactorSize, 1.4 * reactorSize, 0.6 * reactorSize, dark);
  for (let i = 0; i < 4; i++) glow(body, -0.32 + i * 0.21, 3.9, 1.18, 0.07, 0.5, 0.04, light);
  const antenna = box(body, -0.7, 5.05, 0.65, 0.055, 1.6, 0.055, steel);
  antenna.rotation.z = 0.15;
  const items = enemy ? ['blade', build.weapon || 'carbine'] : equipmentFor(build).slice(0, 2),
    kits = items.map((item, i) => {
      const kit = makeWeapons(
        { ...build, weapon: item, melee: item },
        { box, cyl, glow, mesh, mat, sphereGeometry },
      );
      kit.item = item;
      kit.hand = i;
      kit.root = RANGED[item] ? kit.gun : kit.meleeRig;
      kit.root.position.set(0, -0.85, -0.4);
      arms[i].userData.elbow.add(kit.root);
      return kit;
    });
  const weapons = kits.find((k) => RANGED[k.item]) || kits[1],
    { gun, meleeRig, muzzle } = weapons;
  if (parts.booster === 'light') {
    for (const side of [-1, 1]) {
      const wing = box(body, side * 1.55, 4.3, 1.25, 0.28, 2.6, 1.8, paint('booster'));
      wing.rotation.z = side * -0.55;
      wing.rotation.x = 0.3;
      const flap = box(body, side * 2.15, 3.4, 1.1, 0.17, 1.3, 0.8, steel);
      flap.rotation.z = side * -0.7;
      glow(body, side * 0.95, 4.7, 1.38, 0.12, 0.6, 0.12, light);
    }
    box(body, 0, 3.5, -0.86, 0.35, 1, 0.14, steel);
  } else if (parts.booster === 'heavy') {
    for (const side of [-1, 1]) {
      box(body, side * 1.4, 4.7, 1.1, 1.1, 1.8, 1.7, paint('booster'));
      for (let i = 0; i < 3; i++)
        glow(body, side * 1.4 + (i - 1) * 0.24, 5.65, 1.1, 0.12, 0.06, 0.65, light);
      const guard = box(body, side * 0.9, 2.5, -0.7, 1.2, 0.9, 0.3, paint('booster'));
      guard.rotation.z = side * 0.12;
      box(body, side * 2.15, 3.5, -0.8, 0.45, 1.9, 0.35, steel);
    }
    box(body, 0, 3.25, -1.1, 2, 0.9, 0.3, steel);
  } else {
    for (const side of [-1, 1]) {
      const blade = box(body, side * 1.05, 4.3, 1.08, 0.5, 2, 0.5, paint('booster'));
      blade.rotation.z = side * 0.2;
      box(body, side * 1.4, 4.6, -0.75, 0.7, 0.2, 0.1, steel);
    }
  }
  if (parts.torso !== 'light') {
    const plate = parts.torso === 'heavy' ? 1.3 : 0.75;
    box(body, 0, 3.55, -1.05, width * 1.4, 0.65 * plate, 0.22 * plate, steel);
    for (const side of [-1, 1]) {
      box(body, side * width, 3.65, -0.82, 0.45 * plate, 1.1 * plate, 0.24 * plate, paint('torso'));
      box(legs[side === -1 ? 0 : 1], 0, -1.55, -0.45, 0.7 * plate, 0.65, 0.18, steel);
    }
  }
  if (!enemy)
    g.userData.chassisPose = buildChassisModel(
      { body, head, arms, legs, jets: g.userData.jets, build },
      { box, cyl, glow, mesh, mat },
    );
  const itemDetails = enemy
    ? null
    : addItemDetails(
        { body, head, arms, legs, parts: designParts, build, width },
        { box, cyl, glow, mesh, mat },
      );
  const modelKey = [buildKey(build), enemy, type].join(':');
  for (const kit of kits) {
    batchParts(
      kit.root,
      new Set(
        [
          kit.muzzle,
          kit.barrels,
          kit.slide,
          kit.core,
          kit.detailFX,
          kit.pile,
          kit.hammerHead,
          kit.shieldFX,
        ].filter(Boolean),
      ),
      modelKey + ':hand:' + kit.hand + ':' + kit.item,
    );
  }
  for (let i = 0; i < arms.length; i++) {
    const arm = arms[i],
      elbow = arm.userData.elbow;
    batchParts(elbow, new Set(kits.map((k) => k.root)), modelKey + ':forearm' + i);
    batchParts(arm, new Set([elbow]), modelKey + ':arm' + i);
  }
  if (itemDetails) batchParts(itemDetails.cargo, new Set(), 'carried-cell');
  batchParts(head, new Set(), modelKey + ':head');
  batchParts(
    body,
    new Set(
      [head, ...arms, ...g.userData.jets, itemDetails?.beacon, itemDetails?.cargo].filter(Boolean),
    ),
    modelKey + ':body',
  );
  legs.forEach((leg, i) => batchParts(leg, new Set(g.userData.jets), modelKey + ':leg' + i));
  for (const kit of kits) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(16 * 18), 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(16 * 18), 3));
    geometry.setDrawRange(0, 0);
    kit.trailTint = new T.Color(kit.trailColor);
    kit.trail = new T.Mesh(
      geometry,
      new T.MeshBasicMaterial({
        vertexColors: true,
        color: '#ffffff',
        transparent: true,
        opacity: 0.85,
        side: T.DoubleSide,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    kit.trail.frustumCulled = false;
    g.add(kit.trail);
    kit.trailSamples = [];
  }
  g.userData = {
    ...g.userData,
    ...weapons,
    kits,
    body,
    head,
    legs,
    arms,
    itemDetails,
    build,
    enemy,
    previous: null,
    phase: 0,
  };
  if (enemy) {
    if (type === 'boss') g.scale.setScalar(1.85);
    else if (type === 'tank') g.scale.setScalar(1.25);
    else if (type === 'drone') g.scale.setScalar(0.82);
  }
  armorMode = false;
  poseWeapons(g, { shot: 0, meleeTime: 0 }, 0.016, 0);
  return g;
}
function poseWeapons(g, p, dt, t) {
  const u = g.userData;
  let lean = 0,
    yaw = 0;
  for (const k of u.kits) {
    const i = k.hand,
      side = i === 0 ? -1 : 1,
      id = k.item,
      h = p.hands?.[i] || p,
      arm = u.arms[i],
      ranged = !!RANGED[id];
    k.root.visible = true;
    if (ranged) {
      if ((h.shotCount || 0) !== (k.shotCount || 0)) {
        k.shotCount = h.shotCount;
        k.flashTime = t;
        k.kick = 1;
      }
      k.kick = recoilEnvelope(t - (k.flashTime ?? -10)) * impactLevel();
      const kick = k.kick * (recoilFor[id] || 0.2);
      arm.rotation.set(0.35 - kick * 0.2, 0, side * 0.12);
      arm.userData.elbow.rotation.x = 0.85 + kick * 0.3;
      k.gun.position.set(0, -0.85, -0.4 + kick * 0.6);
      k.gun.rotation.set(
        -arm.rotation.x - arm.userData.elbow.rotation.x + (p.pitch || 0) + kick * 0.3,
        0,
        0,
      );
      const age = t - (k.flashTime ?? -10);
      k.muzzle.visible =
        id === 'flamer'
          ? !!h.flame
          : id === 'phaser'
            ? !!h.beam
            : !!h.shotCount && age < (id === 'launcher' ? 0.14 : 0.07);
      const burst = Math.max(0.15, 1 - age / (id === 'rail' || id === 'dynamo' ? 0.12 : 0.08));
      k.muzzle.scale.setScalar(
        (id === 'rail' || id === 'dynamo'
          ? 1.6
          : id === 'scatter'
            ? 1.35
            : id === 'rotary'
              ? 0.55
              : 0.85) *
          burst *
          (0.65 + 0.35 * impactLevel()),
      );
      k.muzzle.rotation.z = (k.shotCount || 0) * 2.399;
      if (k.slide)
        k.slide.position.z =
          id === 'scatter' && age > 0.13 && age < 0.42
            ? Math.sin(((age - 0.13) / 0.29) * Math.PI) * 0.65
            : kick * 0.75;
      if (k.barrels) {
        k.spin = T.MathUtils.lerp(
          k.spin || 0,
          h.spin != null ? (h.spin > 0 ? 8 + 32 * h.spin : 0) : h.shot > 0 ? 32 : 0,
          Math.min(1, dt * 6),
        );
        k.barrels.rotation.z += dt * k.spin;
      }
      for (const cell of k.detailFX.children) {
        if (cell.userData.charge !== undefined) {
          cell.visible =
            (id === 'dynamo' ? (h.motionCharge ?? 1) : h.railCharge || 0) > cell.userData.charge;
          cell.scale.y = 0.7 + Math.sin(t * 40) * 0.3;
        }
        if (cell.userData.vent)
          cell.rotation.z = cell.userData.side * (0.08 + kick * 0.5 + (h.railCharge || 0) * 0.25);
      }
      if (k.core) {
        const charge =
          id === 'dynamo'
            ? (h.motionCharge ?? 1)
            : id === 'rail'
              ? h.railCharge || 0
              : 1 - Math.min(1, (h.shot || 0) / 1.1);
        k.core.visible = id !== 'rail' || charge > 0;
        k.core.scale.setScalar(
          (id === 'phaser' ? 0.16 : 0.28) + charge * 0.19 + Math.sin(t * 14) * 0.025,
        );
        k.core.rotation.y = t * 3;
      }
      g.updateWorldMatrix(true, true);
      if (!u.enemy && p.aimPoint) {
        const base = new T.Vector3();
        k.gun.getWorldPosition(base);
        const target = new T.Vector3(p.aimPoint.x * S, p.aimPoint.z * S, p.aimPoint.y * S),
          worldQ = new T.Quaternion().setFromRotationMatrix(
            new T.Matrix4().lookAt(base, target, UP),
          ),
          parentQ = new T.Quaternion();
        k.gun.parent.getWorldQuaternion(parentQ);
        k.gun.quaternion.copy(parentQ.invert().multiply(worldQ));
        k.gun.rotateX(kick * 0.13);
      }
    } else {
      const progress = h.meleeTime > 0 ? 1 - h.meleeTime / MELEE[id].rate : -1,
        pose = meleePose(id, progress, h.meleeCount || 1),
        v = pose.values;
      arm.rotation.set(v[0], v[1] * -side, v[2] * -side);
      arm.userData.elbow.rotation.x = v[3];
      k.meleeRig.position.set(0, -0.85, -0.4);
      k.meleeRig.rotation.set(v[4], v[5] * -side, v[6] * -side);
      lean += v[8] * 0.5;
      yaw += v[7] * -side * 0.5;
      if (k.pile) k.pile.position.z = -v[9];
      if (id === 'guard') {
        k.guardBlend = T.MathUtils.lerp(
          k.guardBlend || 0,
          h.guarding ? 1 : 0,
          1 - Math.exp(-dt * 22),
        );
        const blend = k.guardBlend;
        arm.rotation.set(0.08 + blend * 0.6, 0, side * 0.12);
        arm.userData.elbow.rotation.x = 0.35 + blend * 0.7;
        g.updateWorldMatrix(true, true);
        const center = g.localToWorld(
          new T.Vector3(side * (2.1 - 1.9 * blend), 3.06, -2.4 * blend),
        );
        k.meleeRig.position.copy(k.meleeRig.parent.worldToLocal(center));
        const parentQ = new T.Quaternion(),
          rootQ = new T.Quaternion();
        k.meleeRig.parent.getWorldQuaternion(parentQ);
        g.getWorldQuaternion(rootQ);
        k.meleeRig.quaternion.copy(
          parentQ
            .invert()
            .multiply(rootQ)
            .multiply(
              new T.Quaternion().setFromEuler(
                new T.Euler(0, ((-side * Math.PI) / 2) * (1 - blend), 0),
              ),
            ),
        );
        if (k.shieldFX) k.shieldFX.visible = !!p.guardFlash || !!h.guarding;
      }
      if (k.hammerHead) k.hammerHead.rotation.x = 0;
      if (id === 'hammer' && progress >= 0) {
        g.updateWorldMatrix(true, true);
        const baseWorld = new T.Vector3();
        k.meleeRig.getWorldPosition(baseWorld);
        const local = g.worldToLocal(baseWorld.clone()),
          hit = 0.43,
          start = hit * 0.66,
          down = -Math.asin(Math.min(0.98, Math.max(0.1, (local.y - 1.55) / 3.4))),
          smooth = (x) => x * x * (3 - 2 * x),
          angle =
            progress < start
              ? T.MathUtils.lerp(-0.85, 1.65, smooth(progress / start))
              : progress < hit
                ? T.MathUtils.lerp(1.65, down, smooth((progress - start) / (hit - start)))
                : progress < hit + 0.05
                  ? down
                  : T.MathUtils.lerp(
                      down,
                      -0.85,
                      smooth((progress - hit - 0.05) / (1 - hit - 0.05)),
                    );
        const parentQ = new T.Quaternion(),
          rootQ = new T.Quaternion();
        k.meleeRig.parent.getWorldQuaternion(parentQ);
        g.getWorldQuaternion(rootQ);
        k.meleeRig.quaternion.copy(
          parentQ
            .invert()
            .multiply(rootQ)
            .multiply(new T.Quaternion().setFromEuler(new T.Euler(angle, 0, 0))),
        );
        const settle =
          progress < hit
            ? smooth(Math.max(0, (progress - start) / (hit - start)))
            : 1 - smooth((progress - hit) / (1 - hit));
        k.hammerHead.rotation.x = -angle * settle;
      }
      g.updateWorldMatrix(true, true);
      for (const sample of k.trailSamples) sample.life -= dt;
      while (k.trailSamples[0]?.life <= 0) k.trailSamples.shift();
      if (pose.trail && id !== 'guard') {
        k.trailSamples.push({
          base: g.worldToLocal(k.meleeRig.localToWorld(k.base.clone())),
          tip: g.worldToLocal(k.meleeRig.localToWorld(k.tip.clone())),
          life: 0.26,
        });
        if (k.trailSamples.length > 16) k.trailSamples.shift();
      }
      const data = k.trail.geometry.attributes.position.array,
        colors = k.trail.geometry.attributes.color.array;
      let n = 0;
      for (let j = 1; j < k.trailSamples.length; j++) {
        const a = k.trailSamples[j - 1],
          b = k.trailSamples[j];
        for (const [q, life, edge] of [
          [a.base, a.life, false],
          [a.tip, a.life, true],
          [b.tip, b.life, true],
          [a.base, a.life, false],
          [b.tip, b.life, true],
          [b.base, b.life, false],
        ]) {
          const fade = Math.max(0, life / 0.26);
          data[n] = q.x;
          colors[n++] = (edge ? 1 : k.trailTint.r * 0.5) * fade;
          data[n] = q.y;
          colors[n++] = (edge ? 1 : k.trailTint.g * 0.5) * fade;
          data[n] = q.z;
          colors[n++] = (edge ? 1 : k.trailTint.b * 0.5) * fade;
        }
      }
      k.trail.geometry.setDrawRange(0, n / 3);
      k.trail.geometry.attributes.position.needsUpdate = true;
      k.trail.geometry.attributes.color.needsUpdate = true;
      k.trail.visible = n > 0;
      k.trail.material.opacity = 0.4 + impactLevel() * 0.45;
    }
  }
  u.combatLean = lean;
  u.body.rotation.y = yaw;
  g.updateWorldMatrix(true, true);
}
export function disposeMech(g) {
  g.userData.dashFX?.dispose();
  for (const k of g.userData.kits || []) {
    k.flameFX?.dispose();
    k.muzzle?.userData.disposeBurst?.();
    k.trail?.geometry.dispose();
    k.trail?.material.dispose();
  }
  for (const t of g.userData.contrails || []) {
    t.ribbon.geometry.dispose();
    t.ribbon.material.dispose();
  }
  g.userData.trail?.geometry.dispose();
  g.userData.trail?.material.dispose();
  g.userData.dust?.material.dispose();
}
export function animateMech(g, p, dt, t) {
  const u = g.userData,
    px = p.x * S,
    pz = p.y * S,
    previous = u.previous,
    moving = previous ? Math.hypot(px - previous.x, pz - previous.z) / Math.max(dt, 0.001) : 0;
  u.previous = { x: px, z: pz };
  const blend = 1 - Math.exp(-dt * 28);
  g.position.x = T.MathUtils.lerp(g.position.x, px, blend);
  g.position.z = T.MathUtils.lerp(g.position.z, pz, blend);
  const angle = -p.angle - Math.PI / 2;
  g.rotation.y +=
    Math.atan2(Math.sin(angle - g.rotation.y), Math.cos(angle - g.rotation.y)) *
    Math.min(1, dt * 22);
  if (p.hp <= 0) {
    u.dashFX?.update(p, dt);
    driveJets(g, p, dt, t);
    g.rotation.z = T.MathUtils.lerp(g.rotation.z, 1.4, blend);
    g.position.y = (p.altitude || 0) * S + 0.1;
    return;
  }
  g.rotation.z = 0;
  u.phase +=
    dt *
    Math.min(
      mechStats(u.build).weightClass === 'LIGHT'
        ? 22
        : ['HEAVY', 'GIGA'].includes(mechStats(u.build).weightClass)
          ? 11
          : 18,
      Math.max(0, moving * 1.2),
    );
  const boosting = p.boosting || p.airborne;
  g.position.y =
    (p.altitude || 0) * S +
    (boosting
      ? 0.65
      : Math.abs(Math.sin(u.phase)) * Math.min(0.1, moving * 0.006) * (u.chassisPose?.gait ?? 1));
  u.motion = moving;
  driveJets(g, p, dt, t);
  poseWeapons(g, p, dt, t);
  if (!u.enemy) {
    if (!u.dashFX && p.moveTime > 0) u.dashFX = createDashEffect(g);
    u.dashFX?.update(p, dt);
  }
}

const biome = [
  { sky: 0x9b8a7d, fog: 0x96877b, floor: '#54574d', wall: '#595d58', sun: 0xffd5a8 },
  { sky: 0x869da8, fog: 0x879da5, floor: '#66777d', wall: '#52636d', sun: 0xc3e8ff },
  { sky: 0xad8c6e, fog: 0xb59b7a, floor: '#6c6151', wall: '#615b52', sun: 0xffc999 },
];
let destructionScene = null,
  fieldScene = null;
export function destructionGraphics() {
  return {
    calls: renderer?.info.render.calls || 0,
    geometries: renderer?.info.memory.geometries || 0,
    textures: renderer?.info.memory.textures || 0,
    ...destructionScene?.stats(),
  };
}
let equipmentFX,
  previewEquipmentFX,
  hitBursts,
  combatFeel,
  explosions,
  renderer,
  scene,
  camera,
  skyGroup,
  mapGroup,
  actors,
  projectiles,
  effectsGroup,
  worldSeed = null,
  enemyModels = new Map(),
  playerModels = new Map(),
  coverMeshes = [],
  aimMeshes = [],
  lastFrame = 0,
  aim = { x: 0, y: 0, z: 38 },
  drawError = null,
  bulletPool = new Map(),
  effectPool = [],
  hazardPool = [],
  warningLines = new Map(),
  beamPool = new Map(),
  launchOffsets = new Map(),
  lastKills = 0;
let firstCamera = true,
  robotBatch = null,
  enemyCues = null,
  enemyFlair = null;
const cameraRay = new T.Raycaster(),
  desired = new T.Vector3(),
  pivot = new T.Vector3();
const ray = new T.Raycaster(),
  target = new T.Vector3(),
  lookTarget = new T.Vector3(),
  point = new T.Vector3();
function makeRenderer(canvas) {
  const r = new T.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.65));
  r.outputColorSpace = T.SRGBColorSpace;
  r.toneMapping = T.NoToneMapping;
  r.toneMappingExposure = 1;
  r.shadowMap.enabled = true;
  r.shadowMap.type = T.PCFSoftShadowMap;
  return r;
}
function lighting(s) {
  s.add(new T.HemisphereLight(0xaacaff, 0x18243f, 1.5));
  const sun = new T.DirectionalLight(0xe5edff, 2.4);
  sun.position.set(-50, 85, -45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -115,
    right: 115,
    top: 85,
    bottom: -85,
    near: 1,
    far: 250,
  });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.08;
  s.add(sun);
  s.add(sun.target);
  return sun;
}
export function initBattle(canvas) {
  if (renderer) return true;
  if (drawError) return false;
  try {
    renderer = makeRenderer(canvas);
    scene = new T.Scene();
    scene.add(new T.AmbientLight(0xffffff, 0.15));
    const battleSun = lighting(scene);
    battleSun.shadow.mapSize.set(1024, 1024);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.35));
    camera = new T.PerspectiveCamera(72, 1, 0.15, 1000);
    skyGroup = new T.Group();
    scene.add(skyGroup);
    mapGroup = new T.Group();
    actors = new T.Group();
    projectiles = new T.Group();
    effectsGroup = new T.Group();
    scene.add(mapGroup, actors, projectiles, effectsGroup);
    combatFeel = createCombatFeel(canvas);
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      drawError = 'Graphics context lost. Reload the page to restore 3D.';
    });
    return true;
  } catch (e) {
    drawError = '3D needs WebGL 2. Try a browser with hardware acceleration enabled.';
    return false;
  }
}
export function graphicsError() {
  return drawError;
}
export function resetBattle() {
  combatFeel?.restore(camera);
  combatFeel?.reset();
  fieldScene?.dispose();
  fieldScene = null;
  worldSeed = null;
  lastFrame = 0;
  lastKills = 0;
  firstCamera = true;
}
function removeAll(group) {
  while (group.children.length) {
    const child = group.children[0];
    if (child.isInstancedMesh) child.dispose();
    group.remove(child);
  }
}
function buildWorld(m) {
  fieldScene?.dispose();
  fieldScene = null;
  enemyFlair?.dispose();
  enemyCues?.dispose();
  destructionScene?.dispose();
  destructionScene = null;
  equipmentFX?.dispose();
  robotBatch?.dispose();
  explosions?.dispose();
  hitBursts?.dispose();
  worldSeed = m.seed;
  for (const o of [...effectPool, ...hazardPool]) o.material.dispose();
  clearSpace(mapGroup);
  for (const g of [...playerModels.values(), ...enemyModels.values()])
    if (g.userData.jets) disposeMech(g);
  removeAll(actors);
  robotBatch = createRobotBatch(actors);
  enemyCues = createEnemyCues(actors);
  enemyFlair = createEnemyFlair(actors);
  removeAll(effectsGroup);
  equipmentFX = createEquipmentFX(effectsGroup);
  fieldScene = createFieldScene(effectsGroup);
  explosions = createExplosionPool(effectsGroup);
  hitBursts = createImpactPool(effectsGroup);
  for (const projectile of projectiles.children) disposeProjectile(projectile);
  removeAll(projectiles);
  enemyModels.clear();
  playerModels.clear();
  for (const l of warningLines.values()) {
    scene.remove(l);
    l.geometry.dispose();
    l.material.dispose();
  }
  warningLines.clear();
  beamPool.clear();
  launchOffsets.clear();
  bulletPool.clear();
  effectPool = [];
  hazardPool = [];
  coverMeshes = [];
  mapGroup.position.set(0, 0, 0);
  const p = m.destructible
    ? ((destructionScene = buildDestructionScene(mapGroup, m, coverMeshes)), { sky: 0x7e9594 })
    : m.mode === 'operation'
      ? buildPlanet(mapGroup, m, coverMeshes)
      : ['sandbox', 'trial'].includes(m.mode)
        ? buildTestPlatform(mapGroup, coverMeshes)
        : buildStation(mapGroup, m, coverMeshes);
  if (m.mode === 'operation' || m.destructible) {
    clearSpace(skyGroup);
    planetSky(skyGroup, m);
  } else createSky(skyGroup, m);
  scene.background = new T.Color(p.sky);
  scene.fog = new T.Fog(p.sky, 160, 650);
}
function makeTarget() {
  const g = new T.Group();
  box(g, 0, 0.3, 0, 4, 0.6, 3, '#23364a');
  box(g, 0, 2, 0, 0.7, 3.5, 0.7, '#64768b');
  box(g, 0, 4.1, 0, 3.8, 3.5, 1, '#e58250');
  for (const side of [-1, 1]) {
    glow(g, 0, 4.1, side * 0.53, 2.5, 2.5, 0.05, '#e8e9d9');
    glow(g, 0, 4.1, side * 0.57, 1.6, 1.6, 0.05, '#e87950');
    glow(g, 0, 4.1, side * 0.6, 0.65, 0.65, 0.05, '#f8f7ee');
    glow(g, 0, 5.15, side * 0.62, 2.6, 0.18, 0.05, '#ffda72');
  }
  return g;
}
function weaponStatusFX(g, p, w, t) {
  let fx = g.userData.weaponStatus;
  if (!fx) {
    fx = new T.Group();
    for (let i = 0; i < 9; i++) {
      const mote = new T.Mesh(sphereGeometry, mat(i < 3 ? '#dcadff' : '#ff8a35', true));
      fx.add(mote);
    }
    g.add(fx);
    g.userData.weaponStatus = fx;
  }
  fx.visible = p.hp > 0;
  fx.children.forEach((o, i) => {
    if (i < 3) {
      o.visible = (p.plasmaUntil || 0) > w.time && i < (p.plasmaHits || 0);
      o.position.set((i - 1) * 0.75, 5.9, 0);
      o.scale.setScalar(0.17 + 0.04 * Math.sin(t * 12));
    } else {
      o.visible = (p.burnUntil || 0) > w.time;
      const phase = (t * 2 + i * 0.17) % 1;
      o.position.set(Math.cos(i * 2.4) * 1.5, 1.3 + phase * 4, Math.sin(i * 2.4) * 1.1);
      o.scale.set(0.12 * (1 - phase), 0.4 * (1 - phase), 0.12 * (1 - phase));
    }
  });
}
// Flash material references only on the struck model, preserving shared armor.
function hitReaction(g, p, t) {
  const u = g.userData;
  if (
    u.visualHp !== undefined &&
    (p.hp < u.visualHp || (p.lastHurt ?? -10) > (u.visualHurt ?? -10))
  )
    u.struckAt = t;
  u.visualHp = p.hp;
  u.visualHurt = p.lastHurt ?? -10;
  const age = t - (u.struckAt ?? -10),
    full = impactLevel() === 1,
    flash = full && age < 0.09;
  if (flash !== !!u.hitFlash) {
    u.hitFlash = flash;
    if (flash) {
      u.hitMaterials = [];
      g.traverse((o) => {
        if (o.isMesh && o.material?.isMeshToonMaterial) {
          u.hitMaterials.push([o, o.material]);
          o.material = mat(u.enemy || u.robot ? '#f3ffff' : '#fff0cf', true);
        }
      });
    } else {
      for (const [node, material] of u.hitMaterials || []) node.material = material;
      u.hitMaterials = null;
    }
  }
  const recoil = full ? Math.max(0, 1 - age / 0.3) : 0;
  if (u.robot) u.body.rotation.x += Math.sin(Math.max(0, age) * 28) * recoil * 0.24;
  else if (u.jets && p.hp > 0) g.rotation.z += Math.sin(Math.max(0, age) * 32) * recoil * 0.12;
}
function updateActors(w, dt, t, selfId) {
  aimMeshes = [...coverMeshes];
  for (const [map, list, isEnemy] of [
    [playerModels, w.players, false],
    [enemyModels, w.enemies, true],
  ]) {
    const ids = new Set(list.map((p) => p.id));
    for (const [id, g] of map)
      if (!ids.has(id)) {
        actors.remove(g);
        if (g.userData.jets) disposeMech(g);
        map.delete(id);
      }
    for (const p of list) {
      let g = map.get(p.id);
      const signature = isEnemy ? 'enemy' : buildKey(p.build);
      if (g && g.userData.signature !== signature && !p.training) {
        actors.remove(g);
        disposeMech(g);
        map.delete(p.id);
        g = null;
      }
      if (!g) {
        g = p.objective
          ? makeMissionObjective(p)
          : p.species
            ? makeRobot(p.species)
            : p.training
              ? makeTarget()
              : makeMech(
                  isEnemy
                    ? {
                        color: '#bd614b',
                        frame: p.type === 'tank' || p.type === 'boss' ? 'bulwark' : 'striker',
                        weapon: p.type === 'boss' ? 'scatter' : 'carbine',
                        ability: 'emp',
                      }
                    : {
                        ...p.build,
                        weapon: p.weapon || p.build.weapon,
                        melee: p.melee || p.build.melee,
                        selectedSlot: p.activeSlot,
                      },
                  isEnemy,
                  p.type,
                );
        g.userData.signature = signature;
        g.position.set(p.x * S, 0, p.y * S);
        actors.add(g);
        map.set(p.id, g);
      }
      if (p.objective) {
        updateMissionObjective(g, p, t);
      } else if (p.species) {
        animateRobot(g, p, dt, w.time);
      } else if (p.training) {
        g.position.set(p.x * S, (p.altitude || 0) * S, p.y * S);
        g.scale.y = p.hp <= 0 ? 0.25 : 1;
        const hit = w.damageEvents?.find((e) => e.x === p.x && e.y === p.y);
        g.rotation.x = hit ? Math.sin((1 - hit.life) * 40) * hit.life * 0.12 : 0;
      } else {
        if (!isEnemy) {
          g.userData.build.selectedSlot = p.activeSlot;
          updateItemDetails(
            g.userData.itemDetails,
            p,
            t,
            w.operation?.cells?.some((c) => c.state === 'carried' && c.carrier === p.id),
          );
        }
        animateMech(
          g,
          {
            ...p,
            airborne: p.landing || p.airborne,
            guardFlash: w.time - (p.guardHitTime ?? -10) < 0.12,
          },
          dt,
          t,
        );
        if (isEnemy && p.behavior)
          applyEnemyPose(g, p, { time: w.time, reduced: impactLevel() < 1 });
      }
      hitReaction(g, p, t);
      if (isEnemy) weaponStatusFX(g, p, w, t);
      if (isEnemy && p.hp > 0) {
        const hull = (g.userData.aimHull ??= new T.Mesh(boxGeometry, mat('#ffffff')));
        const height = p.bodyHeight ?? (p.type === 'boss' ? 108 : p.type === 'tank' ? 75 : 58);
        hull.position.set(g.position.x, (p.altitude + height / 2) * S, g.position.z);
        hull.scale.set(p.r * 2 * S, height * S, p.r * 2 * S);
        hull.updateMatrixWorld();
        aimMeshes.push(hull);
      }
    }
  }
  for (const e of w.enemies) {
    let l = warningLines.get(e.id);
    if (!l) {
      const g = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]);
      l = new T.Line(
        g,
        new T.LineBasicMaterial({ color: 0xff4422, transparent: true, opacity: 0.8 }),
      );
      scene.add(l);
      warningLines.set(e.id, l);
    }
    l.visible =
      !e.behavior &&
      e.windup > 0 &&
      e.species !== 'wisp' &&
      e.type !== 'drone' &&
      e.attackKind !== 'melee';
    if (l.visible) {
      const data = l.geometry.attributes.position.array;
      data.set([
        e.x * S,
        ((e.altitude || 0) + (e.bodyHeight ? e.bodyHeight * 0.6 : e.type === 'boss' ? 64 : 36)) * S,
        e.y * S,
        (e.x + Math.cos(e.attackAngle) * 900) * S,
        ((e.altitude || 0) +
          (e.bodyHeight ? e.bodyHeight * 0.6 : e.type === 'boss' ? 64 : 36) +
          Math.tan(e.attackPitch || 0) * 900) *
          S,
        (e.y + Math.sin(e.attackAngle) * 900) * S,
      ]);
      l.geometry.attributes.position.needsUpdate = true;
      l.geometry.computeBoundingSphere();
    }
  }
  for (const [id, l] of warningLines)
    if (!w.enemies.some((e) => e.id === id)) {
      scene.remove(l);
      l.geometry.dispose();
      l.material.dispose();
      warningLines.delete(id);
    }
}
function ringPool(pool, count, parent, color) {
  while (pool.length < count) {
    const material = new T.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        side: T.DoubleSide,
      }),
      o = new T.Mesh(ringGeometry, material);
    parent.add(o);
    pool.push(o);
  }
  pool.forEach((o, i) => (o.visible = i < count));
}
function updateEffects(w, t) {
  const shooters = w.players.flatMap((p) =>
    (p.hands || [p]).map((h, i) => ({ ...p, ...h, id: p.id + ':' + i, ownerId: p.id, hand: i })),
  );
  for (const [id, beam] of beamPool)
    if (!shooters.some((p) => p.id === id)) {
      effectsGroup.remove(beam);
      beamPool.delete(id);
    }
  for (const p of shooters) {
    let beam = beamPool.get(p.id);
    if (!beam) {
      beam = new T.Group();
      const shell = new T.Mesh(cylinderGeometry, mat('#35dca5', true)),
        core = new T.Mesh(cylinderGeometry, mat('#d5fff0', true));
      beam.add(shell, core);
      for (let i = 0; i < 5; i++) {
        const spark = new T.Mesh(sphereGeometry, mat('#a1ffd7', true));
        beam.add(spark);
      }
      effectsGroup.add(beam);
      beamPool.set(p.id, beam);
    }
    beam.visible = !!p.beam && !p.beam.blocked && p.hp > 0;
    if (!beam.visible) continue;
    const model = playerModels.get(p.ownerId),
      kit = model?.userData.kits?.[p.hand],
      start = new T.Vector3(p.x * S, (38 + (p.altitude || 0)) * S, p.y * S);
    if (kit?.muzzle) kit.muzzle.getWorldPosition(start);
    const end = new T.Vector3(p.beam.x * S, p.beam.z * S, p.beam.y * S),
      length = start.distanceTo(end),
      direction = end.clone().sub(start).normalize();
    beam.position.copy(start).add(end).multiplyScalar(0.5);
    beam.quaternion.setFromUnitVectors(UP, direction);
    beam.children[0].scale.set(0.075 + Math.sin(t * 35) * 0.014, length, 0.075);
    beam.children[1].scale.set(0.028, length, 0.028);
    for (let i = 2; i < 7; i++) {
      const mote = beam.children[i],
        phase = (t * 1.5 + i / 5) % 1;
      mote.visible = p.beam.hit;
      mote.position.set(
        Math.sin(t * 10 + i) * 0.1,
        (0.5 - phase) * length,
        Math.cos(t * 10 + i) * 0.1,
      );
      mote.scale.setScalar(0.1);
    }
  }
  const used = new Map();
  for (const b of w.bullets) {
    const kind = b.enemy ? 'enemy' : b.kind,
      index = used.get(kind) || 0;
    used.set(kind, index + 1);
    let pool = bulletPool.get(kind);
    if (!pool) {
      pool = [];
      bulletPool.set(kind, pool);
    }
    let o = pool[index];
    if (!o) {
      o = makeProjectile(kind);
      projectiles.add(o);
      pool.push(o);
    }
    o.visible = true;
    if (!launchOffsets.has(b.id)) {
      const model = b.enemy ? enemyModels.get(b.owner) : playerModels.get(b.owner);
      let offset = { x: 0, y: 0, z: 0 };
      const kit = model?.userData.kits?.[b.hand ?? 1];
      if (kit && kit.item === b.kind && b.origin) {
        const muzzle = new T.Vector3();
        kit.muzzle.getWorldPosition(muzzle);
        offset = launchCorrection({ x: muzzle.x / S, y: muzzle.z / S, z: muzzle.y / S }, b);
      }
      launchOffsets.set(b.id, offset);
    }
    const visible = correctedProjectile(b, launchOffsets.get(b.id));
    updateProjectile(o, { ...b, ...visible }, t);
  }
  for (const [kind, pool] of bulletPool)
    for (let i = used.get(kind) || 0; i < pool.length; i++) pool[i].visible = false;
  const ids = new Set(w.bullets.map((b) => b.id));
  for (const id of launchOffsets.keys()) if (!ids.has(id)) launchOffsets.delete(id);
  // Hit bursts are drawn after the stable camera pose is calculated.
  // Destruction events already replicate; only their presentation changes.
  explosions.update(
    w.effects.map((e) =>
      e.kind === 'plasmaSlam'
        ? { ...e, kind: 'explosion', weapon: 'slam' }
        : e.kind === 'impact' && e.color === '#ff784b' && e.max === 0.7
          ? {
              ...e,
              id: Math.floor(e.x * 3 + e.y * 7),
              kind: 'explosion',
              weapon: 'destruction',
              r: e.r * 1.65,
              z: 18,
            }
          : e,
    ),
    camera,
  );
  for (const p of shooters) {
    const g = playerModels.get(p.ownerId);
    if (!g) continue;
    const u = g.userData.kits[p.hand];
    if (p.flame && !u.flameFX) u.flameFX = makeFlameEffect(effectsGroup);
    if (u.flameFX) {
      const start = new T.Vector3();
      u.muzzle.getWorldPosition(start);
      const f = p.flame,
        end = f
          ? new T.Vector3(
              (f.origin.x + f.direction.x * f.length) * S,
              (f.origin.z + f.direction.z * f.length) * S,
              (f.origin.y + f.direction.y * f.length) * S,
            )
          : start;
      u.flameFX.update(start, end, t, !!f && f.length > 0);
    }
  }
  const rings = w.effects.filter((e) => e.kind === 'dodge' || e.kind === 'plasmaSlam');
  ringPool(effectPool, rings.length, effectsGroup, 0xff9d5c);
  effectPool.forEach((o, i) => {
    const e = rings[i];
    if (!e) return;
    const progress = 1 - e.life / e.max;
    o.position.set(e.x * S, (e.z ?? 11) * S + progress * 0.6, e.y * S);
    o.rotation.x = -Math.PI / 2;
    o.scale.setScalar(Math.max(0.1, e.r * S * progress));
    o.material.color.set(e.kind === 'plasmaSlam' ? '#b49aff' : e.color);
    o.material.opacity = e.life / e.max;
    o.scale.z = e.kind === 'plasmaSlam' ? 4 : 1;
  });
  ringPool(hazardPool, w.hazards.length, effectsGroup, 0xff4422);
  hazardPool.forEach((o, i) => {
    const h = w.hazards[i];
    if (!h) return;
    o.position.set(h.x * S, 0.14, h.y * S);
    o.rotation.x = -Math.PI / 2;
    o.scale.setScalar(h.r * S);
    o.material.opacity = 0.55 + Math.sin(t * 22) * 0.4;
  });
  equipmentFX.update(w, t, playerModels);
}

const paintFrame = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
export async function prepareBattle(
  canvas,
  w,
  id,
  { stage = () => {}, current = () => true } = {},
) {
  if (!initBattle(canvas)) throw Error(graphicsError());
  stage(0, 'Constructing terrain and launch corridor');
  await paintFrame();
  if (!current()) return false;
  buildWorld(w.mission);
  stage(1, 'Assembling squad, weapons and combat systems');
  await paintFrame();
  if (!current()) return false;
  drawBattle3D(canvas, w, id, performance.now() / 1000, { insertion: 0, render: false });
  stage(2, 'Warming shaders and first combat frame');
  await paintFrame();
  if (!current()) return false;
  await renderer.compileAsync(scene, camera);
  if (!current()) return false;
  drawBattle3D(canvas, w, id, performance.now() / 1000, { insertion: 0, deployment: true });
  if (drawError) throw Error(drawError);
  stage(3, 'Launch corridor clear');
  await paintFrame();
  return current();
}
export function getAim(p) {
  return { aimPoint: { ...aim }, angle: view.yaw, pitch: view.pitch };
}
export function projectWorld(x, y, z) {
  point.set(x * S, z * S, y * S).project(camera);
  return {
    x: (point.x * 0.5 + 0.5) * innerWidth,
    y: (-0.5 * point.y + 0.5) * innerHeight,
    visible: point.z < 1 && point.z > 0 && Math.abs(point.x) < 1.2 && Math.abs(point.y) < 1.2,
  };
}
export function drawBattle3D(canvas, w, id, t, presentation = {}) {
  if (!initBattle(canvas)) return;
  const self = w.players.find((p) => p.id === id) || w.players[0];
  if (!self) return;
  combatFeel.restore(camera);
  bindDestruction(w.mission, w.destruction);
  if (worldSeed !== w.mission.seed) buildWorld(w.mission);
  const dt = Math.min(0.06, lastFrame ? t - lastFrame : 0.016);
  lastFrame = t;
  const width = canvas.clientWidth,
    height = canvas.clientHeight;
  if (
    renderer.domElement.width !== Math.round(width * renderer.getPixelRatio()) ||
    renderer.domElement.height !== Math.round(height * renderer.getPixelRatio())
  ) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  actors.visible = !presentation.deployment;
  projectiles.visible = !presentation.deployment;
  effectsGroup.visible = !presentation.deployment;
  destructionScene?.update(w, dt);
  if (fieldScene) {
    fieldScene.root.visible = !presentation.deployment;
    fieldScene.update(w, t, id);
  }
  if (w.operation) updatePlanet(mapGroup, w, t);
  if (['sandbox', 'trial'].includes(w.mission.mode))
    mapGroup.position.set(
      Math.round((self.x * S) / 10) * 10,
      0,
      Math.round((self.y * S) / 10) * 10,
    );
  updateActors(w, dt, t, id);
  robotBatch.update(enemyModels);
  enemyCues.update(w);
  enemyFlair.update(w);
  updateEffects(w, t);
  const sun = scene.children.find((o) => o.isDirectionalLight);
  sun.position.set(self.x * S - 50, 85, self.y * S - 45);
  sun.target.position.set(self.x * S, 0, self.y * S);
  scene.updateMatrixWorld(true);
  const eye = thirdPersonView(self, view, camera.aspect);
  const cinematic =
    presentation.insertion !== undefined
      ? insertionView(
          eye,
          presentation.insertion,
          chassisFor(self.build).scale,
          impactMode() === 'reduced',
        )
      : null;
  const pose = cinematic || eye;
  desired.set(pose.position.x, pose.position.y, pose.position.z);
  pivot.set(eye.pivot.x, eye.pivot.y, eye.pivot.z);
  cameraRay.set(pivot, desired.clone().sub(pivot).normalize());
  cameraRay.far = pivot.distanceTo(desired);
  const obstruction = cameraRay.intersectObjects(coverMeshes, false)[0];
  if (obstruction)
    desired
      .copy(pivot)
      .addScaledVector(cameraRay.ray.direction, Math.max(0.6, obstruction.distance - 0.5));
  if (firstCamera || obstruction || cinematic) {
    camera.position.copy(desired);
    firstCamera = false;
  } else camera.position.lerp(desired, 1 - Math.exp(-dt * 22));
  lookTarget
    .copy(camera.position)
    .add(new T.Vector3(eye.direction.x, eye.direction.y, eye.direction.z).multiplyScalar(100));
  if (cinematic)
    lookTarget.set(
      cinematic.target.x + (camera.position.x - cinematic.position.x) * cinematic.chaseWeight,
      cinematic.target.y + (camera.position.y - cinematic.position.y) * cinematic.chaseWeight,
      cinematic.target.z + (camera.position.z - cinematic.position.z) * cinematic.chaseWeight,
    );
  camera.lookAt(lookTarget);
  camera.fov = cinematic
    ? cinematic.fov
    : T.MathUtils.lerp(camera.fov, eye.fov, Math.min(1, dt * 12));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  ray.setFromCamera(new T.Vector2(0, 0), camera);
  ray.far = 160;
  const hit = ray.intersectObjects(aimMeshes, true).find((h) => h.distance > 2);
  if (hit) target.copy(hit.point);
  else ray.ray.at(140, target);
  aim = { x: target.x / S, y: target.z / S, z: Math.max(0, target.y / S) };
  hitBursts.update(w.damageEvents || [], camera);
  combatFeel.update(w, self, dt, t, camera);
  combatFeel.apply(camera, t);
  skyGroup.position.copy(camera.position);
  if (presentation.render !== false) renderer.render(scene, camera);
}
const orbit = { yaw: 0.48, pitch: 0.04, distance: 13.5 };
export function rotatePreview(x, y) {
  orbit.yaw += x;
  orbit.pitch = T.MathUtils.clamp(orbit.pitch + y, -0.18, 0.9);
}
export function zoomPreview(delta) {
  orbit.distance = T.MathUtils.clamp(orbit.distance + delta, 9, 34);
}
export function resetPreviewOrbit() {
  Object.assign(orbit, { yaw: 0.48, pitch: 0.04, distance: 13.5 });
}
// Swap material references only on this model; cached materials shared with gameplay stay untouched.
function workshopPowerPose(g, powered) {
  const u = g.userData;
  if (u.workshopPowered !== powered) {
    u.workshopPowered = powered;
    g.traverse((o) => {
      if (!o.isMesh) return;
      if (!powered && o.material?.isMeshBasicMaterial) {
        o.userData.powerMaterial = o.material;
        o.material = mat('#13202a');
      } else if (powered && o.userData.powerMaterial) {
        o.material = o.userData.powerMaterial;
        delete o.userData.powerMaterial;
      }
    });
  }
  if (powered) return;
  u.body.rotation.set(0.12, 0, 0);
  u.head.rotation.x = 0.32;
  for (let i = 0; i < u.arms.length; i++) {
    const arm = u.arms[i],
      kit = u.kits[i];
    arm.rotation.set(-0.08, 0, i ? 0.06 : -0.06);
    arm.userData.elbow.rotation.x = 0.12;
    kit.root.rotation.set(kit.item === 'guard' ? -0.15 : -1.3, 0, 0);
    kit.muzzle.visible = false;
    kit.trail.visible = false;
    if (kit.shieldFX) kit.shieldFX.visible = false;
  }
  for (const jet of u.jets) jet.userData.exhaust.visible = false;
  if (u.engineLight) u.engineLight.intensity = 0;
}
function workshopLighting(powered) {
  const u = previewScene.userData;
  if (u.powered === powered) return;
  u.powered = powered;
  // Inspection lights and luminous bay strips switch off. Only dim ambient remains for a silhouette.
  for (const { light, intensity } of u.bayLights)
    light.intensity = powered ? intensity : light.isHemisphereLight ? 0.07 : 0;
  for (const strip of u.bayStrips) strip.visible = powered;
  const background = powered ? 0x080d11 : 0x030609;
  previewRenderer.setClearColor(background);
  previewScene.fog.color.setHex(background);
}
let previewRenderer,
  previewScene,
  previewCamera,
  previewModel,
  previewBay,
  previewKey = '',
  previewLast = 0;
export function drawPreview3D(canvas, build, t, thrusters = false, equipment = false) {
  const powered = mechStats(build).valid;
  thrusters = thrusters && powered;
  equipment = equipment && powered;
  if (!previewRenderer) {
    try {
      previewRenderer = makeRenderer(canvas);
      previewRenderer.setClearColor(0x080d11);
      previewScene = new T.Scene();
      previewScene.fog = new T.Fog(0x080d11, 23, 65);
      previewCamera = new T.PerspectiveCamera(34, 1, 0.1, 120);
      previewBay = createHangarEnvironment({ T, scene: previewScene });
    } catch {
      return;
    }
  }
  workshopLighting(powered);
  const key = JSON.stringify(build);
  if (key !== previewKey) {
    previewKey = key;
    if (previewModel) {
      previewScene.remove(previewModel);
      disposeMech(previewModel);
    }
    previewModel = makeMech(build);
    finishHangarMech({ T, model: previewModel });
    previewScene.add(previewModel);
  }
  const width = canvas.clientWidth,
    height = canvas.clientHeight;
  if (!width || !height) return;
  if (
    previewRenderer.domElement.width !== Math.round(width * previewRenderer.getPixelRatio()) ||
    previewRenderer.domElement.height !== Math.round(height * previewRenderer.getPixelRatio())
  )
    previewRenderer.setSize(width, height, false);
  previewCamera.aspect = width / height;
  previewCamera.updateProjectionMatrix();
  const dt = Math.min(0.05, previewLast ? Math.max(0.001, t - previewLast) : 0.016);
  previewLast = t;
  const scale = chassisFor(build).scale,
    distance = orbit.distance * scale * Math.max(1, 0.78 / previewCamera.aspect);
  previewScene.fog.near = 22 * Math.max(1, scale);
  previewScene.fog.far = 55 * Math.max(1, scale);
  previewCamera.position.set(
    Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * distance,
    2.7 * scale + Math.sin(orbit.pitch) * distance,
    -Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * distance,
  );
  previewCamera.lookAt(0, 2.7 * scale, 0);
  previewModel.rotation.y = 0;
  previewModel.position.y = T.MathUtils.lerp(
    previewModel.position.y,
    thrusters ? 1.4 + Math.sin(t * 3) * 0.08 : 0,
    Math.min(1, dt * 5),
  );
  previewModel.userData.phase = t;
  previewModel.userData.motion = 0;
  if (!equipment) previewModel.userData.previewStart = t;
  const cycle = (t - (previewModel.userData.previewStart ??= t)) % 4,
    hands = build.equipment.slice(0, 2).map((item, i) => {
      const active = equipment && i === build.selectedSlot,
        w = WEAPONS[item],
        fire =
          active &&
          RANGED[item] &&
          (item === 'rail' ? cycle >= w.charge && cycle < w.charge + 0.1 : cycle < 1.2);
      return {
        item,
        guarding: active && item === 'guard',
        flame: fire && item === 'flamer',
        beam: fire && item === 'phaser',
        railCharge: active && item === 'rail' && cycle < w.charge ? cycle / w.charge : 0,
        shot: fire ? w.rate : 0,
        shotCount: fire ? Math.floor(t / w.rate) : previewModel.userData.kits[i].shotCount || 0,
        meleeTime:
          active && MELEE[item] && item !== 'guard' && cycle >= 1.6 && cycle < 1.6 + w.rate
            ? w.rate - (cycle - 1.6)
            : 0,
        meleeCount: Math.floor(t / 4) + 1,
      };
    });
  poseWeapons(previewModel, { hands }, dt, t);
  driveJets(
    previewModel,
    { hp: powered ? 1 : 0, airborne: thrusters, altitude: previewModel.position.y * 10 },
    dt,
    t,
  );
  for (const kit of previewModel.userData.kits) {
    if (kit.item !== 'flamer') continue;
    kit.flameFX ??= makeFlameEffect(previewScene);
    const start = new T.Vector3();
    kit.muzzle.getWorldPosition(start);
    const end = kit.gun.localToWorld(new T.Vector3(0, 0.1, -18));
    kit.flameFX.update(start, end, t, !!hands[kit.hand].flame);
  }
  updatePreviewEquipment(previewModel, build, hands, t, powered, equipment);
  if (!equipment) restHangarMech(previewModel);
  workshopPowerPose(previewModel, powered);
  previewBay.update(t, powered);
  previewRenderer.render(previewScene, previewCamera);
}
function updatePreviewEquipment(model, build, hands, t, powered, equipment) {
  const u = model.userData,
    special = equipmentFor(build)[2],
    ability = ABILITIES[special],
    age = Math.max(0, t - (u.previewStart ?? t)) % (ability.duration + 2),
    active =
      equipment && build.selectedSlot === 2 && age < ability.duration ? ability.duration - age : 0;
  for (const kit of u.kits)
    if (hands[kit.hand].beam) {
      const end = kit.gun.localToWorld(new T.Vector3(0, 0.1, -14));
      hands[kit.hand].beam = { x: end.x * 10, y: end.z * 10, z: end.y * 10, hit: false };
    }
  updateItemDetails(u.itemDetails, { hp: powered ? 1 : 0, active }, t);
  previewEquipmentFX ??= createEquipmentFX(previewScene, { fieldScale: 0.3 });
  previewEquipmentFX.update(
    {
      time: t,
      players: [
        {
          id: 'preview',
          x: 0,
          y: 0,
          altitude: model.position.y * 10,
          hp: powered ? 1 : 0,
          build,
          hands,
          active,
          activeAbility: special,
        },
      ],
    },
    t,
    new Map([['preview', model]]),
  );
}
function selectedPreview(build) {
  return build.equipment?.[build.selectedSlot];
}

let homeBattle;
export function drawHomeBattle3D(canvas, build, t) {
  if (!previewRenderer) drawPreview3D(canvas, build, 0);
  if (!previewRenderer) return;
  homeBattle ??= createHomeBattle({ T, makeMech, disposeMech, animateMech, chassisFor, mechStats });
  homeBattle(previewRenderer, canvas, t, build);
}

export function renderingStats() {
  return renderer
    ? {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        ...fieldScene?.stats(),
      }
    : null;
}
