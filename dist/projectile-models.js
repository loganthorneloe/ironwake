import * as T from './vendor/three.module.min.js';
const box = new T.BoxGeometry(1, 1, 1),
  sphere = new T.IcosahedronGeometry(1, 1),
  cylinder = new T.CylinderGeometry(1, 1, 1, 10),
  cone = new T.ConeGeometry(1, 1, 10),
  zAxis = new T.Vector3(0, 0, 1),
  materials = new Map();
const material = (color, glow = false, opacity = 1) => {
  const key = [color, glow, opacity].join(':');
  if (!materials.has(key))
    materials.set(
      key,
      glow
        ? new T.MeshBasicMaterial({
            color,
            transparent: opacity < 1,
            opacity,
            depthWrite: opacity === 1,
            blending: opacity < 1 ? T.AdditiveBlending : T.NormalBlending,
          })
        : new T.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.6 }),
    );
  return materials.get(key);
};
function part(root, geometry, color, x, y, z, sx, sy, sz, glow = false, opacity = 1) {
  const mesh = new T.Mesh(geometry, material(color, glow, opacity));
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  root.add(mesh);
  return mesh;
}
let bladeGeometries;
export function makeProjectile(kind) {
  const root = new T.Group();
  root.userData.kind = kind;
  if (kind === 'bladeWave') {
    if (!bladeGeometries) {
      const path = new T.CatmullRomCurve3(
        Array.from({ length: 17 }, (_, i) => {
          const x = i - 8;
          return new T.Vector3(x, 0, 2.3 * (1 - (x * x) / 64));
        }),
      );
      bladeGeometries = [
        new T.TubeGeometry(path, 24, 0.12, 5, false),
        new T.TubeGeometry(path, 24, 0.35, 5, false),
      ];
    }
    root.add(
      new T.Mesh(bladeGeometries[0], material('#baffff', true)),
      new T.Mesh(bladeGeometries[1], material('#45dfff', true, 0.35)),
    );
  } else if (kind === 'launcher') {
    const body = part(root, cylinder, '#c3d2dd', 0, 0, 0, 0.24, 1.5, 0.24);
    body.rotation.x = Math.PI / 2;
    const nose = part(root, cone, '#ff7848', 0, 0, 1.02, 0.25, 0.64, 0.25);
    nose.rotation.x = Math.PI / 2;
    for (const z of [-0.5, 0.4]) {
      const band = part(root, cylinder, '#25394c', 0, 0, z, 0.255, 0.14, 0.255);
      band.rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 4; i++) {
      const fin = new T.Group();
      fin.rotation.z = (i * Math.PI) / 2;
      root.add(fin);
      part(fin, box, '#e2874b', 0.26, 0, -0.5, 0.45, 0.07, 0.55);
    }
    const nozzle = part(root, cylinder, '#182533', 0, 0, -0.85, 0.19, 0.25, 0.19);
    nozzle.rotation.x = Math.PI / 2;
    const exhaust = new T.Group();
    exhaust.position.z = -0.98;
    root.add(exhaust);
    root.userData.exhaust = exhaust;
    const fire = part(exhaust, cone, '#ff8d42', 0, 0, -0.8, 0.25, 1.6, 0.25, true, 0.65);
    fire.rotation.x = -Math.PI / 2;
    const white = part(exhaust, cone, '#fff2b0', 0, 0, -0.3, 0.12, 0.8, 0.12, true);
    white.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 5; i++)
      part(
        root,
        sphere,
        '#8fa4b5',
        0,
        0,
        -1.7 - i * 0.7,
        0.12 + i * 0.07,
        0.12 + i * 0.07,
        0.24 + i * 0.1,
        true,
        0.16,
      );
  } else if (kind === 'plasma') {
    part(root, sphere, '#e8c9ff', 0, 0, 0, 0.35, 0.35, 0.35, true);
    part(root, sphere, '#9e55ff', 0, 0, 0, 0.78, 0.78, 0.78, true, 0.32);
    for (let i = 0; i < 3; i++) {
      const arc = part(root, box, '#ddafff', 0, 0, 0, 0.09, 1.9, 0.14, true);
      arc.rotation.z = (i * Math.PI) / 3;
    }
    part(root, cone, '#9d5dff', 0, 0, -1, 0.45, 2, 0.45, true, 0.25).rotation.x = -Math.PI / 2;
  } else {
    const color =
        kind === 'dynamo'
          ? '#ffd257'
          : kind === 'rail'
            ? '#8eeeff'
            : kind === 'scatter'
              ? '#cf97ff'
              : kind === 'rotary'
                ? '#ff526d'
                : kind === 'enemy'
                  ? '#ff6c32'
                  : '#48dcff',
      length =
        kind === 'dynamo'
          ? 4.8
          : kind === 'rail'
            ? 7
            : kind === 'scatter'
              ? 1.5
              : kind === 'rotary'
                ? 1.6
                : 2.8,
      radius = kind === 'dynamo' ? 0.21 : kind === 'rail' ? 0.11 : kind === 'scatter' ? 0.12 : 0.07;
    root.userData.boltLength = length;
    part(root, box, color, 0, 0, 0, radius * 3, radius * 3, length, true, 0.45);
    part(root, box, '#efffff', 0, 0, 0.1, radius, radius, length * 0.8, true);
    if (kind === 'scatter') {
      const shard = part(root, sphere, color, 0, 0, 0.6, 0.2, 0.2, 0.4, true);
      shard.rotation.z = Math.PI / 4;
    }
  }
  if (['launcher', 'rail', 'dynamo'].includes(kind)) makeTrail(root, kind);
  return root;
}
export function updateProjectile(root, b, t) {
  root.position.set(b.x * 0.1, (b.z ?? 38) * 0.1, b.y * 0.1);
  root.quaternion.setFromUnitVectors(zAxis, new T.Vector3(b.vx, b.vz || 0, b.vy).normalize());
  if (root.userData.boltLength) {
    const distance = b.origin
        ? Math.hypot(b.x - b.origin.x, b.y - b.origin.y, b.z - b.origin.z) * 0.1
        : root.userData.boltLength,
      length = Math.min(root.userData.boltLength, distance);
    root.scale.z = Math.max(0.01, length / root.userData.boltLength);
    root.position.addScaledVector(new T.Vector3(b.vx, b.vz || 0, b.vy).normalize(), -length / 2);
  }
  if (root.userData.exhaust) root.userData.exhaust.scale.z = 0.85 + Math.sin(t * 60 + b.id) * 0.2;
  if (b.kind === 'plasma') root.rotateZ(t * 7 + b.id);
  updateTrail(root, b, t);
}
// A fixed-size world-space history follows curved rockets instead of faking a
// straight tail. It is independent of projectile collision and launch correction.
function makeTrail(root, kind) {
  const count = 14,
    geometry = new T.BufferGeometry(),
    positions = new Float32Array(count * 36),
    colors = new Float32Array(positions.length);
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
  geometry.setDrawRange(0, 0);
  const mesh = new T.Mesh(
    geometry,
    new T.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: kind === 'launcher' ? 0.5 : 0.65,
      side: T.DoubleSide,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }),
  );
  mesh.frustumCulled = false;
  root.add(mesh);
  root.userData.trail = {
    mesh,
    samples: Array.from({ length: count }, () => ({ point: new T.Vector3(), time: 0 })),
    index: 0,
    count: 0,
    id: null,
    tint: new T.Color(kind === 'launcher' ? '#ffc98d' : kind === 'dynamo' ? '#ffe48b' : '#9ef5ff'),
    inverse: new T.Matrix4(),
    a: new T.Vector3(),
    b: new T.Vector3(),
    point: new T.Vector3(),
  };
}
function updateTrail(root, b, t) {
  const trail = root.userData.trail;
  if (!trail) return;
  if (trail.id !== b.id || t < (trail.lastTime ?? t)) {
    trail.id = b.id;
    trail.count = 0;
    trail.index = 0;
  }
  trail.lastTime = t;
  const sample = trail.samples[trail.index];
  sample.point.set(b.x * 0.1, (b.z ?? 38) * 0.1, b.y * 0.1);
  sample.time = t;
  trail.index = (trail.index + 1) % trail.samples.length;
  trail.count = Math.min(trail.samples.length, trail.count + 1);
  root.updateWorldMatrix(true, false);
  trail.inverse.copy(root.matrixWorld).invert();
  const data = trail.mesh.geometry.attributes.position.array,
    colors = trail.mesh.geometry.attributes.color.array,
    duration = b.kind === 'launcher' ? 0.3 : 0.16,
    baseWidth = b.kind === 'launcher' ? 0.18 : b.kind === 'dynamo' ? 0.17 : 0.09;
  let index = 0;
  for (let i = 1; i < trail.count; i++) {
    const a = trail.samples[(trail.index - trail.count + i - 1 + 14) % 14],
      c = trail.samples[(trail.index - trail.count + i + 14) % 14],
      fade = Math.max(0, 1 - (t - a.time) / duration);
    if (!fade) continue;
    for (let plane = 0; plane < 2; plane++)
      for (const [entry, side] of [
        [a, -1],
        [a, 1],
        [c, 1],
        [a, -1],
        [c, 1],
        [c, -1],
      ]) {
        const f = Math.max(0, 1 - (t - entry.time) / duration),
          width = baseWidth * f;
        trail.point.copy(entry.point);
        if (plane) trail.point.x += width * side;
        else trail.point.y += width * side;
        trail.point.applyMatrix4(trail.inverse);
        data[index] = trail.point.x;
        data[index + 1] = trail.point.y;
        data[index + 2] = trail.point.z;
        colors[index] = trail.tint.r * f;
        colors[index + 1] = trail.tint.g * f;
        colors[index + 2] = trail.tint.b * f;
        index += 3;
      }
  }
  trail.mesh.geometry.setDrawRange(0, index / 3);
  trail.mesh.geometry.attributes.position.needsUpdate = true;
  trail.mesh.geometry.attributes.color.needsUpdate = true;
}
export function disposeProjectile(root) {
  const trail = root.userData.trail;
  if (trail) {
    trail.mesh.geometry.dispose();
    trail.mesh.material.dispose();
  }
}
