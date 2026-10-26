import * as T from './vendor/three.module.min.js';
const box = new T.BoxGeometry(1, 1, 1),
  stone = new T.IcosahedronGeometry(1, 0),
  tube = new T.CylinderGeometry(1, 1, 1, 8),
  cone = new T.ConeGeometry(1, 1, 8),
  palette = new Map();
function material(color, lit = false) {
  const key = color + lit;
  if (!palette.has(key))
    palette.set(key, lit ? new T.MeshBasicMaterial({ color }) : new T.MeshToonMaterial({ color }));
  return palette.get(key);
}
// Thousands of modular pieces share a few geometry/material draws, with no asset downloads.
function batches(parent) {
  const groups = new Map(),
    stamp = new T.Object3D();
  return {
    add(x, y, z, w, h, d, color, shape = box, lit = false, angle = 0, tilt = 0) {
      const key = shape.id + color + lit;
      let batch = groups.get(key);
      if (!batch)
        groups.set(key, (batch = { shape, material: material(color, lit), lit, matrices: [] }));
      stamp.position.set(x, y, z);
      stamp.scale.set(w, h, d);
      stamp.rotation.set(tilt, angle, 0);
      stamp.updateMatrix();
      batch.matrices.push(stamp.matrix.clone());
    },
    flush() {
      for (const b of groups.values()) {
        const mesh = new T.InstancedMesh(b.shape, b.material, b.matrices.length);
        b.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
        mesh.castShadow = !b.lit;
        mesh.receiveShadow = !b.lit;
        mesh.computeBoundingSphere();
        parent.add(mesh);
      }
    },
  };
}
function sign(parent, x, y, z, title, sub, angle = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const c = canvas.getContext('2d');
  c.fillStyle = '#152327';
  c.fillRect(0, 0, 512, 160);
  c.fillStyle = '#b6d4ac';
  c.fillRect(0, 0, 8, 160);
  c.font = '600 48px sans-serif';
  c.fillText(title, 28, 70);
  c.font = '22px monospace';
  c.fillStyle = '#7b968e';
  c.fillText(sub, 30, 116);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const mesh = new T.Mesh(
    new T.PlaneGeometry(16, 5),
    new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide }),
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = angle;
  mesh.userData.ownGeometry = mesh.userData.ownMaterial = mesh.userData.ownTexture = true;
  parent.add(mesh);
}
export function buildCinderAssets(parent, m, coverMeshes) {
  const b = batches(parent),
    road = m.spine,
    rand = (() => {
      let s = m.seed;
      return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
      };
    })();
  const collider = (x, y, z, w, h, d) => {
    const mesh = new T.Mesh(box, material('#29393b'));
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.visible = false;
    parent.add(mesh);
    coverMeshes.push(mesh);
  };
  const floor = new T.Mesh(box, material('#554b42'));
  floor.position.set(m.width * 0.05, -1, m.height * 0.05);
  floor.scale.set(m.width * 0.1 + 200, 2, m.height * 0.1 + 200);
  floor.receiveShadow = true;
  parent.add(floor);
  coverMeshes.push(floor);
  // Banded basalt escarpments form a continuous, readable flight corridor.
  for (const o of m.obstacles) {
    const x = (o.x + o.w / 2) * 0.1,
      z = (o.y + o.h / 2) * 0.1,
      w = o.w * 0.1,
      d = o.h * 0.1,
      h = o.height * 0.1;
    collider(x, h / 2, z, w, h, d);
    if (o.landmark) continue;
    if (o.cliff) {
      b.add(x, h * 0.5, z, w, h, d, '#493d3d');
      for (let k = 0; k < 3; k++) {
        const sy = h * (0.18 + k * 0.3);
        b.add(x, sy, z, w + 0.3, 1.4, d + 0.3, k === 1 ? '#70594c' : '#59493f');
      }
      for (let px = -w / 2 + 7; px < w / 2; px += 16) {
        b.add(
          x + px,
          h * 0.94,
          z,
          10 + rand() * 5,
          7 + rand() * 8,
          d * 0.7,
          '#68554c',
          stone,
          false,
          rand() * 3,
        );
        b.add(x + px, 2, z + d * 0.4, 7, 4, 4, '#6b5849', stone);
      }
    } else {
      b.add(x, h * 0.5, z, w, h, d, '#30494b');
      b.add(x, h * 0.75, z, w + 0.2, 0.5, d + 0.2, '#667a72');
      b.add(x, h, z, w + 0.3, 0.4, d + 0.3, '#84978a');
      for (const side of [-1, 1]) {
        b.add(x + side * w * 0.38, h * 0.45, z, 0.28, h * 0.9, d + 0.15, '#9b9c81');
        b.add(x, h * 0.6, z + side * (d / 2 + 0.04), w * 0.3, 0.3, 0.08, '#bfd7af', box, true);
      }
      for (let j = -3; j <= 3; j++)
        b.add(x + (j * w) / 9, h * 0.4, z + d * 0.5 + 0.03, 0.13, h * 0.54, 0.06, '#172e33');
    }
  }
  // The freight road, inset tracks, lane lights and overhead service gantries.
  for (let i = 1; i < road.length; i++) {
    const a = road[i - 1],
      q = road[i],
      dx = (q.x - a.x) * 0.1,
      dz = (q.y - a.y) * 0.1,
      len = Math.hypot(dx, dz),
      angle = -Math.atan2(dz, dx),
      nx = -dz / len,
      nz = dx / len,
      cx = (a.x + q.x) * 0.05,
      cz = (a.y + q.y) * 0.05;
    b.add(cx, 0.035, cz, len + 3, 0.07, 43, '#3a4140', box, false, angle);
    for (const side of [-1, 1]) {
      b.add(
        cx + nx * side * 20,
        0.09,
        cz + nz * side * 20,
        len,
        0.08,
        0.3,
        '#959b7a',
        box,
        false,
        angle,
      );
      b.add(
        cx + nx * side * 8,
        0.11,
        cz + nz * side * 8,
        len,
        0.12,
        0.38,
        '#637771',
        box,
        false,
        angle,
      );
    }
    for (let at = 8; at < len; at += 12) {
      const x = a.x * 0.1 + (dx * at) / len,
        z = a.y * 0.1 + (dz * at) / len;
      b.add(x, 0.13, z, 3, 0.1, 0.32, '#aec88b', box, true, angle);
      for (const side of [-1, 1]) {
        b.add(x + nx * side * 26, 0.6, z + nz * side * 26, 1.6, 1.2, 1.6, '#203538');
        b.add(x + nx * side * 26, 1.24, z + nz * side * 26, 0.65, 0.08, 0.65, '#b0e4b1', box, true);
      }
    }
    const gx = a.x * 0.1 + dx * 0.62,
      gz = a.y * 0.1 + dz * 0.62;
    for (const side of [-1, 1]) {
      b.add(gx + nx * side * 48, 22, gz + nz * side * 48, 3, 44, 4, '#34484b', box, false, angle);
      b.add(gx + nx * side * 48, 5, gz + nz * side * 48, 5, 10, 6, '#647568', box, false, angle);
    }
    b.add(gx, 43, gz, 5, 3, 101, '#526661', box, false, angle);
    b.add(gx, 42, gz, 5.1, 0.15, 78, '#a8d3ac', box, true, angle);
    for (const side of [-1, 1])
      b.add(
        cx + nx * side * 55,
        36,
        cz + nz * side * 55,
        1.3,
        len,
        1.3,
        '#394344',
        tube,
        false,
        angle + Math.PI / 2,
        Math.PI / 2,
      );
  }
  // Distinct industrial landmarks: silo banks, radiator fins, signal mast, and a reactor crown.
  for (const o of m.obstacles.filter((o) => o.landmark === 'silo')) {
    const x = (o.x + o.w / 2) * 0.1,
      z = (o.y + o.h / 2) * 0.1;
    b.add(x, 11, z, 7, 22, 7, '#37464a', tube);
    b.add(x, 20, z, 7.2, 1.2, 7.2, '#82927a', tube);
    b.add(x, 24, z, 6.8, 5, 6.8, '#556d64', cone);
    for (let k = 0; k < 5; k++) b.add(x, 6 + k * 3, z + 4, 6, 0.7, 1, '#9ca18b');
  }
  for (let i = 0; i < m.batteries.length; i++) {
    const p = m.batteries[i];
    sign(
      parent,
      p.x * 0.1 - 37,
      17,
      p.y * 0.1 - 18,
      '0' + (i + 1) + ' / BATTERY',
      'ORBITAL DEFENSE ARRAY',
      -Math.PI / 2,
    );
  }
  for (const p of m.platforms) {
    const x = (p.x + p.w / 2) * 0.1,
      z = (p.y + p.h / 2) * 0.1,
      h = p.z * 0.1;
    collider(x, h - 0.4, z, p.w * 0.1, 0.8, p.h * 0.1);
    b.add(x, h - 0.4, z, p.w * 0.1, 0.8, p.h * 0.1, '#46605a');
    for (const side of [-1, 1]) {
      b.add(x + side * 14, h / 2, z, 1.6, h, 1.6, '#2b4143');
      b.add(x, h + 0.05, z + side * 12.6, 31, 0.1, 0.4, '#b1e7bc', box, true);
    }
  }
  for (const r of m.ramps) {
    const hw = r.w * 0.05,
      hd = r.h * 0.05,
      y = r.z * 0.1,
      g = new T.BufferGeometry();
    g.setAttribute(
      'position',
      new T.Float32BufferAttribute(
        [-hw, y, -hd, hw, y, -hd, hw, 0, hd, -hw, y, -hd, hw, 0, hd, -hw, 0, hd],
        3,
      ),
    );
    g.computeVertexNormals();
    const mesh = new T.Mesh(g, new T.MeshToonMaterial({ color: '#53685c', side: T.DoubleSide }));
    mesh.position.set((r.x + r.w / 2) * 0.1, 0, (r.y + r.h / 2) * 0.1);
    mesh.userData.ownGeometry = mesh.userData.ownMaterial = true;
    parent.add(mesh);
    coverMeshes.push(mesh);
  }
  for (const [p, label] of [
    [m.entry, '01 / INSERTION'],
    [m.exit, '05 / EXTRACTION'],
  ]) {
    const x = p.x * 0.1,
      z = p.y * 0.1;
    b.add(x, 0.15, z, 44, 0.3, 44, '#253c3d');
    for (const side of [-1, 1]) {
      b.add(x + side * 21, 0.35, z, 0.4, 0.2, 42, '#b5e3ab', box, true);
      b.add(x, 0.35, z + side * 21, 42, 0.2, 0.4, '#b5e3ab', box, true);
    }
    b.add(x, 0.36, z, 12, 0.1, 1.2, '#a8be95');
    b.add(x, 0.36, z, 1.2, 0.1, 12, '#a8be95');
    sign(parent, x - 26, 9, z - 20, label, 'KEPLER-9 / FREIGHT DIVISION', -Math.PI / 2);
  }
  const rx = m.reactor.x * 0.1,
    rz = m.reactor.y * 0.1 + 48;
  for (const side of [-1, 1]) {
    b.add(rx + side * 48, 23, rz, 9, 46, 9, '#30464c', tube);
    for (let k = 0; k < 9; k++) b.add(rx + side * 48, 6 + k * 4, rz, 13, 0.8, 13, '#667b70', tube);
    b.add(rx + side * 48, 48, rz, 8, 5, 8, '#b3ddae', tube, true);
  }
  b.add(rx, 40, rz, 108, 6, 12, '#3e5453');
  b.add(rx, 38, rz - 6.1, 36, 0.7, 0.2, '#b8e8b7', box, true);
  sign(parent, rx, 41, rz - 6.2, '04 / REACTOR', 'THERMAL CORE / RESTRICTED');
  // Reinforcements emerge from recognizable freight gates, then drop onto the road.
  for (const [i, p] of m.portals.entries()) {
    if (i % 3) continue;
    const x = p.x * 0.1,
      z = p.y * 0.1,
      angle = -p.heading;
    b.add(x, 8, z, 9, 1.5, 6, '#253a3e', box, false, angle);
    for (const side of [-1, 1])
      b.add(
        x + Math.sin(angle) * side * 3.8,
        4.6,
        z + Math.cos(angle) * side * 3.8,
        1,
        9,
        1,
        '#688778',
      );
    b.add(x, 8.8, z, 9, 0.35, 6, '#bb9a73', box, true, angle);
  }
  // Small rubble and wind-scoured seams add scale without additional collision or draws.
  for (let i = 0; i < 1500; i++) {
    const seg = 1 + Math.floor(rand() * (road.length - 1)),
      a = road[seg - 1],
      q = road[seg],
      f = rand(),
      dx = q.x - a.x,
      dy = q.y - a.y,
      l = Math.hypot(dx, dy),
      side = (rand() > 0.5 ? 1 : -1) * (280 + rand() * 280),
      x = (a.x + dx * f - (dy / l) * side) * 0.1,
      z = (a.y + dy * f + (dx / l) * side) * 0.1;
    b.add(
      x,
      0.2,
      z,
      0.3 + rand() * 1.4,
      0.3 + rand() * 0.5,
      0.3 + rand() * 1.4,
      i % 2 ? '#76624f' : '#514840',
      stone,
      false,
      rand() * 6.28,
    );
  }
  b.flush();
  const ashGeometry = new T.BufferGeometry(),
    positions = new Float32Array(200 * 3);
  for (let i = 0; i < 200; i++) {
    positions[i * 3] = (rand() - 0.5) * 180;
    positions[i * 3 + 1] = rand() * 70;
    positions[i * 3 + 2] = (rand() - 0.5) * 180;
  }
  ashGeometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  const ash = new T.Points(
    ashGeometry,
    new T.PointsMaterial({
      color: '#c4b7a1',
      size: 0.12,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  ash.userData.ownGeometry = ash.userData.ownMaterial = true;
  parent.add(ash);
  parent.userData.ash = ash;
  return { sky: 0x928878 };
}
