import * as T from './vendor/three.module.min.js';
import { applyEnemyPose, locomotionStyle } from './enemy-motion.js';
import { impactLevel } from './impact-preferences.js';
const box = new T.BoxGeometry(1, 1, 1),
  ball = new T.IcosahedronGeometry(1, 0),
  tube = new T.CylinderGeometry(1, 1, 1, 8),
  ring = new T.TorusGeometry(1, 0.1, 5, 20),
  mats = new Map();
const gradient = new T.DataTexture(
  new Uint8Array([48, 48, 48, 255, 142, 142, 142, 255, 255, 255, 255, 255]),
  3,
  1,
  T.RGBAFormat,
);
gradient.minFilter = gradient.magFilter = T.NearestFilter;
gradient.generateMipmaps = false;
gradient.needsUpdate = true;
const ink = new T.MeshBasicMaterial({ color: '#101c29', side: T.BackSide });
function material(color, lit = false) {
  const k = color + lit;
  if (!mats.has(k))
    mats.set(
      k,
      lit
        ? new T.MeshBasicMaterial({ color })
        : new T.MeshToonMaterial({ color, gradientMap: gradient }),
    );
  return mats.get(k);
}
function piece(g, x, y, z, w, h, d, c, lit = false, geo = box) {
  const o = new T.Mesh(geo, material(c, lit));
  o.position.set(x, y, z);
  o.scale.set(w, h, d);
  o.castShadow = !lit;
  o.receiveShadow = true;
  o.userData.robotPart = true;
  g.add(o);
  return o;
}
function limb(g, x, z, index, kind) {
  const joint = new T.Group();
  joint.position.set(x, 2, z);
  g.add(joint);
  const side = Math.sign(x);
  piece(joint, side * 0.25, -0.35, 0, 0.45, 1.2, 0.5, '#6b737b').rotation.z = side * 0.4;
  const knee = new T.Group();
  knee.position.set(side * 0.25, -0.8, 0);
  joint.add(knee);
  piece(knee, side * 0.23, -0.4, 0.18, 0.35, 1.15, 0.4, '#28343d').rotation.x = -0.35;
  piece(
    knee,
    side * 0.25,
    -0.95,
    -0.2,
    0.65,
    0.25,
    0.95,
    kind === 'hunter' ? '#be8960' : '#82939d',
  );
  joint.userData.knee = knee;
  joint.userData.index = index;
  return joint;
}
export function makeRobot(kind) {
  const g = new T.Group(),
    body = new T.Group();
  g.add(body);
  g.userData.robot = true;
  g.userData.body = body;
  g.userData.legs = [];
  g.userData.phase = 0;
  if (kind === 'hunter') {
    piece(body, 0, 2.1, 0.15, 2.3, 1.35, 4.1, '#8f6b50');
    piece(body, 0, 2.85, 0.1, 1.5, 0.55, 3.7, '#d1a478');
    piece(body, 0, 2.4, -2, 1.8, 1.2, 1.7, '#3b454a');
    piece(body, 0, 2.15, -2.95, 1.5, 0.6, 0.7, '#b4a18a');
    piece(body, 0, 2.7, -2.88, 1.5, 0.18, 0.15, '#ff653a', true);
    for (const side of [-1, 1]) {
      piece(body, side * 0.65, 3.4, -1.8, 0.35, 0.9, 0.55, '#d4ac7f').rotation.z = side * 0.22;
      piece(body, side * 0.56, 1.8, -3.1, 0.18, 0.6, 0.22, '#c8d9de');
      for (let i = 0; i < 3; i++)
        piece(body, side * 1.17, 2.25, -0.9 + i * 0.8, 0.08, 0.45, 0.35, '#ff8050', true);
    }
    for (let i = 0; i < 4; i++)
      g.userData.legs.push(limb(body, i % 2 ? 1.1 : -1.1, i < 2 ? -1.3 : 1.6, i, kind));
    const tail = new T.Group();
    tail.position.set(0, 2.5, 2);
    body.add(tail);
    piece(tail, 0, 0.45, 0.7, 0.35, 0.35, 1.6, '#4a5660').rotation.x = -0.4;
    piece(tail, 0, 1, 1.5, 0.4, 0.4, 0.8, '#f19d66');
    g.userData.tail = tail;
  } else if (kind === 'wisp') {
    piece(body, 0, 1.8, 0, 1.8, 1.2, 1.7, '#517882', false, ball);
    piece(body, 0, 1.9, -1.5, 0.8, 0.55, 0.25, '#e8fbff', true);
    piece(body, 0, 1.9, -1.65, 0.28, 0.28, 0.1, '#ff6849', true);
    piece(body, 0, 0.55, -0.5, 0.4, 0.4, 1.7, '#293845');
    const rotor = new T.Group();
    rotor.position.y = 1.5;
    body.add(rotor);
    g.userData.rotor = rotor;
    for (const side of [-1, 1]) {
      piece(body, side * 2, 1.5, 0, 2.1, 0.3, 0.65, '#739ca2');
      const hoop = piece(rotor, side * 2.5, 0, 0, 1.05, 1.05, 1.05, '#68e6ec', true, ring);
      hoop.rotation.x = Math.PI / 2;
      piece(body, side * 2.5, 0.8, 0, 0.4, 0.9, 0.4, '#5bd5e9', true);
    }
    piece(body, 0, 3, 0, 0.13, 1, 0.13, '#d6e8e9');
  } else if (kind === 'rammer') {
    piece(body, 0, 2.25, 0.3, 3.6, 2.2, 4.2, '#975b42');
    piece(body, 0, 3.5, 0.5, 2.8, 0.5, 3.4, '#d68c5a');
    const plow = piece(body, 0, 1.8, -2.5, 4.6, 2.2, 0.65, '#d5b290');
    plow.rotation.x = -0.24;
    for (const side of [-1, 1]) {
      piece(body, side * 1.7, 2, -3, 0.35, 0.5, 1.5, '#e7d3b0');
      piece(body, side * 1.9, 2.7, 1.5, 0.7, 1.2, 1.8, '#303e46');
      piece(body, side * 1.9, 2.7, 2.45, 0.4, 0.6, 0.1, '#ff7949', true);
    }
    piece(body, 0, 3.2, -1.9, 1.6, 0.2, 0.15, '#ff693d', true);
    for (let i = 0; i < 4; i++)
      g.userData.legs.push(limb(body, i % 2 ? 1.5 : -1.5, i < 2 ? -1.3 : 1.6, i, kind));
  } else if (kind === 'needle') {
    piece(body, 0, 3.7, 0, 1.3, 2.5, 1.5, '#746c91');
    piece(body, 0, 5.25, -0.2, 0.9, 0.7, 1.3, '#bcb2d5');
    piece(body, 0, 5.3, -0.9, 0.55, 0.16, 0.1, '#e3a4ff', true);
    const turret = new T.Group();
    turret.position.set(0.6, 3.8, -0.5);
    body.add(turret);
    piece(turret, 0, 0, -2, 0.35, 0.45, 4, '#c4c9d8');
    piece(turret, 0, 0.35, -0.6, 0.4, 0.4, 0.8, '#302f47');
    piece(turret, 0, 0, -4.1, 0.2, 0.2, 0.1, '#e3a4ff', true);
    g.userData.turret = turret;
    for (let i = 0; i < 2; i++) {
      const leg = limb(body, i ? 0.65 : -0.65, 0, i, kind);
      leg.scale.y = 1.6;
      leg.position.y = 3;
      g.userData.legs.push(leg);
    }
    for (const side of [-1, 1])
      piece(body, side * 0.8, 3, 1, 0.3, 2, 1.5, '#3f405a').rotation.z = side * 0.3;
  } else if (kind === 'mortar') {
    piece(body, 0, 1.7, 0, 3.7, 2, 3.8, '#71634f');
    piece(body, 0, 2.8, 0.3, 3, 0.55, 3, '#b6a078');
    const turret = new T.Group();
    turret.position.set(0, 2.8, 0);
    body.add(turret);
    g.userData.turret = turret;
    for (const side of [-1, 1]) {
      piece(turret, side * 0.8, 0.5, -0.6, 0.9, 0.9, 3, '#343f46');
      piece(turret, side * 0.8, 0.5, -2.15, 0.7, 0.7, 0.12, '#ffc565', true);
      piece(body, side * 1.8, 2.3, 1.3, 0.5, 1.3, 1.5, '#d8af64');
    }
    for (let i = 0; i < 6; i++)
      g.userData.legs.push(limb(body, i % 2 ? 1.6 : -1.6, -1.3 + Math.floor(i / 2) * 1.3, i, kind));
  } else if (kind === 'mender') {
    piece(body, 0, 2.5, 0, 2.1, 2.5, 2.1, '#517a6d', false, ball);
    piece(body, 0, 3.8, -0.2, 1.2, 0.8, 1.2, '#b9d6bb');
    piece(body, 0, 3.8, -0.85, 0.6, 0.2, 0.1, '#80f2b5', true);
    piece(body, 0, 2.7, -1.15, 1, 0.2, 0.1, '#b4ffcd', true);
    piece(body, 0, 2.7, -1.16, 0.2, 1, 0.1, '#b4ffcd', true);
    g.userData.petals = [];
    for (let i = 0; i < 4; i++) {
      const petal = new T.Group();
      petal.position.set(Math.sin((i * Math.PI) / 2) * 0.9, 3.1, Math.cos((i * Math.PI) / 2) * 0.9);
      petal.rotation.y = (i * Math.PI) / 2;
      body.add(petal);
      piece(petal, 0, 0.6, 0.6, 0.9, 1.8, 0.3, '#a5c7b6');
      piece(petal, 0, 0.6, 0.8, 0.4, 1.2, 0.1, '#80f2b5', true);
      g.userData.petals.push(petal);
    }
    for (let i = 0; i < 4; i++)
      g.userData.legs.push(limb(body, i % 2 ? 1.1 : -1.1, i < 2 ? -0.8 : 0.8, i, kind));
  } else {
    piece(body, 0, 1.6, 0, 3.5, 1.5, 3.6, '#5b756c');
    piece(body, 0, 2.5, 0.3, 2.6, 0.8, 3, '#9cb5a0');
    for (const side of [-1, 1]) {
      piece(body, side * 1.3, 2.1, -1.9, 0.8, 0.7, 1, '#30434a');
      piece(body, side * 1.3, 2.1, -2.45, 0.45, 0.35, 0.12, '#ffd284', true);
    }
    const turret = new T.Group();
    turret.position.y = 2.65;
    body.add(turret);
    piece(turret, 0, 0.35, 0, 1.7, 0.7, 1.6, '#31484b');
    piece(turret, 0, 0.35, -1.5, 0.45, 0.45, 2.8, '#98aaa6');
    g.userData.turret = turret;
    for (let i = 0; i < 6; i++)
      g.userData.legs.push(
        limb(body, i % 2 ? 1.55 : -1.55, -1.25 + Math.floor(i / 2) * 1.3, i, kind),
      );
  }
  const antenna = new T.Group();
  antenna.position.set(
    0.55,
    kind === 'needle' ? 5.6 : kind === 'mender' ? 4.1 : 3.2,
    kind === 'hunter' ? 1.4 : 0.6,
  );
  body.add(antenna);
  piece(antenna, 0, 0.45, 0, 0.06, 0.9, 0.06, '#a9bfcb');
  piece(antenna, 0, 0.95, 0, 0.16, 0.18, 0.12, kind === 'mender' ? '#80f2b5' : '#ffab70', true);
  g.userData.antenna = antenna;
  return g;
}
export function animateRobot(g, p, dt, t, options = {}) {
  const u = g.userData,
    x = p.x * 0.1,
    z = p.y * 0.1,
    old = u.previous,
    speed = old ? Math.min(100, Math.hypot(x - old.x, z - old.z) / Math.max(0.001, dt)) : 0;
  u.previous = { x, z };
  const f = 1 - Math.exp(-dt * 25);
  g.position.x = T.MathUtils.lerp(g.position.x, x, f);
  g.position.z = T.MathUtils.lerp(g.position.z, z, f);
  g.position.y = (p.altitude || 0) * 0.1;
  const yaw = -p.angle - Math.PI / 2;
  g.rotation.y += Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y)) * f;
  const style = locomotionStyle(p),
    reduced = options.reduced ?? impactLevel() < 1,
    anime = (options.style || 'anime') === 'anime',
    cosmetic = reduced ? 0 : 1,
    pose = applyEnemyPose(g, p, { time: t, ...options, reduced }),
    stunned = p.stun > 0;
  u.phase += dt * Math.min(24, speed * style.cadence);
  const locomoting = !stunned && (!p.actionPhase || p.actionPhase === 'idle'),
    stride = Math.min(1, speed / 18),
    cycle = u.phase + style.phase;
  if (p.species === 'wisp') {
    u.body.position.y += Math.sin(t * 3 + style.phase) * (anime ? 0.55 : 0.3) * cosmetic;
    u.body.rotation.z +=
      (Math.sin(t * 4 + style.phase) * 0.08 + (locomoting ? Math.sin(cycle) * 0.1 * stride : 0)) *
      cosmetic;
    u.rotor.rotation.y = t * (stunned ? 1 : 8) * (reduced ? 0.35 : 1);
  } else {
    for (const leg of u.legs) {
      const gait =
          cycle + (leg.userData.index % 2 ? Math.PI : 0) + (leg.userData.index > 1 ? Math.PI : 0),
        swing = locomoting
          ? Math.sin(gait) * Math.min(style.stride * (anime ? 1.35 : 1), speed * 0.035)
          : 0;
      leg.rotation.x = swing + (anime ? pose.kick * (leg.userData.index < 2 ? -0.65 : 0.8) : 0);
      leg.rotation.z =
        pose.height < 0 ? Math.sign(leg.position.x) * Math.min(0.4, -pose.height * 0.4) : 0;
      leg.userData.knee.rotation.x = anime
        ? Math.max(0, Math.cos(gait)) * 0.45 * stride * (locomoting ? 1 : 0) + pose.kick * 0.75
        : 0;
    }
    const bounce = locomoting
      ? Math.abs(Math.sin(cycle)) * (anime ? style.bounce : 0.08) * stride * cosmetic
      : 0;
    u.body.position.y += bounce;
    u.body.rotation.z += locomoting ? Math.sin(cycle) * style.sway * stride * cosmetic : 0;
    if (u.tail) {
      u.tail.rotation.y = Math.sin(t * 5 + style.phase) * 0.28 * cosmetic + pose.secondary;
      u.tail.rotation.x = -pose.pitch * 0.55 - pose.secondary * 0.8;
    }
    if (u.turret) {
      u.turret.rotation.x = pose.turret + pose.secondary * 0.45;
      u.turret.position.z = pose.kick * 0.3;
    }
    for (let i = 0; i < (u.petals?.length || 0); i++)
      u.petals[i].rotation.x =
        -pose.petals * 1.25 + pose.secondary * Math.sin((i * Math.PI) / 2 + 0.6);
  }
  u.antenna.rotation.x =
    pose.secondary * -1.3 + (locomoting ? Math.sin(cycle - 1) * style.lag * stride * cosmetic : 0);
  u.antenna.rotation.z = pose.roll * -0.6;
}

// Animate ordinary robots normally, then submit their parts as shared instanced draws.
// Elite mechs remain separate, preserving their weapon and arrival animations.
export function createRobotBatch(parent) {
  const batches = new Map(),
    outlines = new Map(),
    matrix = new T.Matrix4(),
    inkScale = new T.Vector3(1.035, 1.035, 1.035);
  function collect(map, key, o, outline = false) {
    let b = map.get(key);
    if (!b)
      map.set(
        key,
        (b = {
          geometry: o.geometry,
          material: outline ? ink : o.material,
          shadow: !outline && o.castShadow,
          matrices: [],
          mesh: null,
          outline,
        }),
      );
    b.matrices.push(o.matrixWorld);
  }
  function submit(b) {
    const count = b.matrices.length;
    if (count && (!b.mesh || b.mesh.instanceMatrix.count < count)) {
      if (b.mesh) {
        parent.remove(b.mesh);
        b.mesh.dispose();
      }
      b.mesh = new T.InstancedMesh(
        b.geometry,
        b.material,
        Math.max(64, 2 ** Math.ceil(Math.log2(count))),
      );
      b.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      b.mesh.castShadow = b.shadow;
      b.mesh.receiveShadow = !b.outline;
      b.mesh.frustumCulled = false;
      parent.add(b.mesh);
    }
    if (!b.mesh) return;
    b.mesh.count = count;
    b.mesh.visible = count > 0;
    for (let i = 0; i < count; i++)
      b.mesh.setMatrixAt(i, b.outline ? matrix.copy(b.matrices[i]).scale(inkScale) : b.matrices[i]);
    b.mesh.instanceMatrix.needsUpdate = true;
  }
  return {
    update(models) {
      for (const map of [batches, outlines]) for (const b of map.values()) b.matrices.length = 0;
      for (const g of models.values()) {
        if (!g.userData.robot) continue;
        g.updateMatrixWorld(true);
        g.traverse((o) => {
          if (!o.userData.robotPart) return;
          o.visible = false;
          collect(batches, o.geometry.id + ':' + o.material.id, o);
          if (!o.material.isMeshBasicMaterial) collect(outlines, o.geometry.id, o, true);
        });
      }
      for (const b of outlines.values()) submit(b);
      for (const b of batches.values()) submit(b);
    },
    dispose() {
      for (const map of [batches, outlines]) {
        for (const b of map.values())
          if (b.mesh) {
            parent.remove(b.mesh);
            b.mesh.dispose();
          }
        map.clear();
      }
    },
  };
}
