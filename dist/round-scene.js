import * as T from './vendor/three.module.min.js';
import { dressArena } from './arena-dressing.js';
import { createPracticalPools } from './ground-contact.js';
const box = new T.BoxGeometry(1, 1, 1),
  tube = new T.CylinderGeometry(1, 1, 1, 10),
  shard = new T.OctahedronGeometry(1, 0),
  torus = new T.TorusGeometry(1, 0.035, 4, 48),
  materials = new Map(),
  batchToon = new T.MeshToonMaterial({ color: '#ffffff' }),
  batchGlow = new T.MeshBasicMaterial({ color: '#ffffff' });
const mat = (color, lit = false) => {
  const key = color + lit;
  if (!materials.has(key))
    materials.set(
      key,
      lit ? new T.MeshBasicMaterial({ color }) : new T.MeshToonMaterial({ color }),
    );
  return materials.get(key);
};
const part = (parent, x, y, z, w, h, d, color, geo = box, lit = false) => {
  const o = new T.Mesh(geo, mat(color, lit));
  o.position.set(x, y, z);
  o.scale.set(w, h, d);
  o.castShadow = !lit;
  o.receiveShadow = true;
  parent.add(o);
  return o;
};
export function roundSky(parent, m) {
  const material = new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { tint: { value: new T.Color(m.spec.sky) } },
      vertexShader:
        'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'uniform vec3 tint;varying vec3 p;void main(){float y=normalize(p).y;vec3 c=mix(tint*.9,vec3(.08,.13,.2),smoothstep(-.2,.85,y));gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    }),
    shell = new T.Mesh(new T.SphereGeometry(850, 20, 12), material);
  shell.userData.ownGeometry = shell.userData.ownMaterial = true;
  parent.add(shell);
  const moon = part(parent, -260, 185, 420, 55, 55, 55, m.spec.color, shard, true);
  moon.material.fog = false;
}
export function buildRoundScene(parent, m, coverMeshes) {
  const spec = m.spec,
    floor = part(
      parent,
      m.width * 0.05,
      -1,
      m.height * 0.05,
      m.width * 0.1,
      2,
      m.height * 0.1,
      spec.floor,
    );
  coverMeshes.push(floor);
  const batches = new Map(),
    stamp = new T.Object3D();
  const add = (x, y, z, w, h, d, color, geo = box, lit = false, angle = 0) => {
    // Instance color preserves the authored palette without a draw call for every paint color.
    const key = geo.id + ':' + lit;
    if (!batches.has(key))
      batches.set(key, { geo, material: lit ? batchGlow : batchToon, matrices: [], colors: [] });
    stamp.position.set(x, y, z);
    stamp.scale.set(w, h, d);
    stamp.rotation.set(0, angle, 0);
    stamp.updateMatrix();
    batches.get(key).matrices.push(stamp.matrix.clone());
    batches.get(key).colors.push(new T.Color(color));
  };
  for (let x = 100; x < m.width; x += 400)
    add(x * 0.1, 0.02, m.height * 0.05, 0.035, 0.04, m.height * 0.1, '#536261');
  for (let y = 100; y < m.height; y += 400)
    add(m.width * 0.05, 0.025, y * 0.1, m.width * 0.1, 0.04, 0.035, '#536261');
  for (const o of m.obstacles) {
    const x = (o.x + o.w / 2) * 0.1,
      z = (o.y + o.h / 2) * 0.1,
      w = o.w * 0.1,
      d = o.h * 0.1,
      h = o.height * 0.1;
    const collider = part(
      parent,
      x,
      h / 2,
      z,
      w,
      h,
      d,
      spec.theme === 'crystal' ? '#675778' : '#263c42',
    );
    coverMeshes.push(collider);
    if (o.landmark) {
      collider.visible = false;
      continue;
    }
    add(x, h + 0.08, z, w + 0.3, 0.2, d + 0.3, spec.color);
    for (let k = 0; k < 3; k++)
      add(x, h * (0.2 + k * 0.25), z, w + 0.08, 0.15, d + 0.08, '#8c9f98');
  }
  for (const p of m.platforms) {
    const x = (p.x + p.w / 2) * 0.1,
      z = (p.y + p.h / 2) * 0.1,
      h = p.z * 0.1;
    const deck = part(parent, x, h - 0.4, z, p.w * 0.1, 0.8, p.h * 0.1, '#52676b');
    coverMeshes.push(deck);
    for (const side of [-1, 1]) {
      add(x + side * 14, h / 2, z, 1.3, h, 1.3, '#30404c');
      add(x, h + 0.04, z + side * 14.5, 34, 0.08, 0.2, spec.color, box, true);
    }
  }
  for (const r of m.ramps) {
    const hw = r.w * 0.05,
      hd = r.h * 0.05,
      h = r.z * 0.1,
      geo = new T.BufferGeometry();
    geo.setAttribute(
      'position',
      new T.Float32BufferAttribute(
        [-hw, h, -hd, hw, h, -hd, hw, 0, hd, -hw, h, -hd, hw, 0, hd, -hw, 0, hd],
        3,
      ),
    );
    geo.computeVertexNormals();
    const material = new T.MeshToonMaterial({ color: '#6b7b7e', side: T.DoubleSide }),
      mesh = new T.Mesh(geo, material);
    mesh.position.set((r.x + r.w / 2) * 0.1, 0, (r.y + r.h / 2) * 0.1);
    mesh.userData.ownGeometry = mesh.userData.ownMaterial = true;
    parent.add(mesh);
    coverMeshes.push(mesh);
  }
  // Nine structural landmarks establish the arena identity beyond a palette swap.
  for (const side of [-1, 1])
    for (let j = 0; j < 4; j++) {
      const x = side < 0 ? 13 : 247,
        z = 43 + j * 43;
      if (spec.theme === 'scrapyard') {
        for (let k = 0; k < 3; k++)
          add(x, k * 3 + 1.5, z + (k % 2) * 3, 10, 3, 12, ['#95765c', '#677d70', '#b5a47d'][k]);
        add(x, 10, z, 12, 0.4, 14, spec.color);
      }
      if (spec.theme === 'spillway') {
        add(x, 4, z, 7, 8, 16, '#4e747c', tube);
        for (let k = 0; k < 3; k++) add(x, 2 + k * 2.5, z, 7.5, 0.3, 16.5, spec.color, tube);
        add(x + side * 5, 2, z, 12, 1.4, 1.4, '#aac2c2');
      }
      if (spec.theme === 'antenna' || spec.theme === 'spire') {
        add(x, 15, z, 1.2, 30, 1.2, '#7d8c98');
        add(x, 24, z, 12, 0.6, 2, spec.color);
        add(x, 20, z, 2, 0.6, 12, spec.color);
        add(x, 31, z, 1.6, 1.6, 1.6, spec.color, shard, true);
      }
      if (spec.theme === 'bunker') {
        add(x, 5, z, 18, 10, 20, '#4c5a4d');
        add(x, 11, z, 20, 2, 22, '#9a9c7f');
        add(x - side * 9.1, 6, z, 0.1, 1.5, 12, spec.color, box, true);
      }
      if (spec.theme === 'foundry') {
        add(x, 12, z, 6, 24, 6, '#493c3d', tube);
        for (let k = 0; k < 5; k++) add(x, 5 + k * 4, z, 7, 0.5, 7, '#9f8376', tube);
        add(x, 24.1, z, 4.5, 0.2, 4.5, '#ff9b60', tube, true);
      }
      if (spec.theme === 'rail') {
        add(x, 3, z, 14, 6, 25, '#3c5c53');
        add(x, 6.2, z, 14, 0.5, 25, spec.color);
        for (const q of [-1, 1]) add(x + q * 5, 1, z, 2, 2, 28, '#192a2d');
      }
      if (spec.theme === 'crystal') {
        add(x, 9, z, 5, 9, 4.5, spec.color, shard, false, j * 0.6);
        add(x - side * 5, 3, z + 4, 3, 3, 3, '#766b9a', shard, false, j);
      }
      if (spec.theme === 'reactor') {
        add(x, 14, z, 9, 28, 9, '#485565', tube);
        for (let k = 0; k < 6; k++) add(x, 5 + k * 4, z, 11, 0.6, 11, spec.color, tube);
      }
    }
  if (spec.theme === 'spillway') {
    add(130, 0.04, 112, 220, 0.08, 11, '#67a4b4');
    for (const x of [64, 130, 195]) add(x, 0.12, 112, 15, 0.15, 18, '#83999b');
  }
  if (spec.theme === 'rail')
    for (const x of [115, 145]) add(x, 0.05, 115, 0.5, 0.1, 190, '#b6a67d');
  if (spec.theme === 'spire') {
    add(130, 25, 107, 12, 50, 12, '#566a7e', tube);
    add(130, 50, 107, 18, 2, 18, spec.color, tube, true);
  }
  if (spec.theme === 'reactor') {
    add(130, 30, 104, 18, 60, 18, '#4b465b', tube);
    for (let k = 0; k < 5; k++) add(130, 14 + k * 10, 104, 20, 1, 20, spec.color, tube, true);
  }
  for (const port of m.portals) {
    add(port.x * 0.1, 0.08, port.y * 0.1, 7, 0.15, 7, '#a5745d', tube);
    add(port.x * 0.1, 0.18, port.y * 0.1, 4, 0.15, 4, spec.color, tube, true);
  }
  const pad = m.exit;
  add(pad.x * 0.1, 0.08, pad.y * 0.1, 28, 0.15, 28, '#344a48', tube);
  for (const side of [-1, 1])
    add(pad.x * 0.1 + side * 12, 0.3, pad.y * 0.1, 0.6, 0.6, 20, '#a9efbe', box, true);
  dressArena(add, m, box, tube, shard);
  const practical = createPracticalPools(parent, [
    { x: 33, z: 11, radius: 6, strength: 0.1 },
    { x: m.width * 0.1 - 33, z: 11, radius: 6, strength: 0.1 },
  ]);
  practical.mesh.userData.disposeVisual = () => practical.dispose();
  for (const b of batches.values()) {
    const mesh = new T.InstancedMesh(b.geo, b.material, b.matrices.length);
    b.matrices.forEach((matrix, i) => {
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, b.colors[i]);
    });
    mesh.castShadow = !b.material.isMeshBasicMaterial;
    mesh.receiveShadow = true;
    parent.add(mesh);
  }
  const dynamic = new T.Group();
  parent.add(dynamic);
  parent.userData.roundFX = { dynamic, cells: [], rings: [] };
  for (let i = 0; i < 4; i++) {
    const cargo = new T.Group();
    dynamic.add(cargo);
    part(cargo, 0, 0, 0, 1.2, 1.8, 1, '#20383d');
    part(cargo, 0, 0, 0.54, 0.85, 1.3, 0.1, '#abffd0', box, true);
    parent.userData.roundFX.cells.push(cargo);
    const ring = part(dynamic, 0, 0.1, 0, 19, 19, 19, spec.color, torus, true);
    ring.rotation.x = -Math.PI / 2;
    parent.userData.roundFX.rings.push(ring);
  }
  const crawler = new T.Group();
  dynamic.add(crawler);
  part(crawler, 0, 2, 0, 12, 4, 17, '#3a5753');
  part(crawler, 0, 4.5, -4, 8, 3, 6, '#81968c');
  part(crawler, 0, 4.5, -7.1, 6, 1.2, 0.1, '#95efc1', box, true);
  parent.userData.roundFX.crawler = crawler;
  const ship = new T.Group();
  dynamic.add(ship);
  part(ship, 0, 0, 0, 10, 3, 18, '#394d5a');
  part(ship, 0, 0, 0, 30, 1, 8, '#758c96');
  for (const side of [-1, 1]) part(ship, side * 12, -2, 0, 2, 4, 3, spec.color, tube, true);
  parent.userData.roundFX.ship = ship;
  return { sky: spec.sky, fog: spec.sky };
}
export function updateRoundScene(parent, w, t) {
  const fx = parent.userData.roundFX;
  if (!fx) return;
  const o = w.operation,
    m = w.mission;
  fx.cells.forEach((mesh, i) => {
    const cell = o.cells[i];
    mesh.visible = !!cell && cell.state === 'loose';
    if (mesh.visible) {
      mesh.position.set(
        cell.x * 0.1,
        (cell.z || 0) * 0.1 + 2 + Math.sin(t * 2 + i) * 0.2,
        cell.y * 0.1,
      );
      mesh.rotation.y = t;
    }
  });
  fx.rings.forEach((ring, i) => {
    const p = m.points[i];
    ring.visible = m.spec.kind === 'uplink' && i === o.terminal && o.phase === 0;
    if (p) ring.position.set(p.x * 0.1, (p.z || 0) * 0.1 + 0.15, p.y * 0.1);
  });
  fx.crawler.visible = o.cells.length > 0;
  fx.crawler.position.set(o.crawler.x * 0.1, 0, o.crawler.y * 0.1);
  const next = m.route[Math.min(o.crawler.segment + 1, m.route.length - 1)];
  fx.crawler.rotation.y = -Math.atan2(next.y - o.crawler.y, next.x - o.crawler.x) - Math.PI / 2;
  fx.ship.visible = o.phase === 1;
  fx.ship.position.set(
    m.exit.x * 0.1,
    7 + Math.max(0, (o.shipAt || 0) - w.time) * 7,
    m.exit.y * 0.1,
  );
}
