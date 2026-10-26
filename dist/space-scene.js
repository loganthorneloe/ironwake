import * as T from './vendor/three.module.min.js';
import { rng } from './core.js?v=41';
const cube = new T.BoxGeometry(1, 1, 1),
  sphere = new T.SphereGeometry(1, 48, 32),
  ring = new T.RingGeometry(1.25, 1.9, 96),
  materials = new Map();
const palette = [
  { deck: '#263950', edge: '#78e9f1', accent: '#f4a77c', planet: '#4e9abe', sky: 0x060c20 },
  { deck: '#303c59', edge: '#a8caff', accent: '#c5b5ff', planet: '#9a8ccc', sky: 0x080b23 },
  { deck: '#3c314b', edge: '#f3a5cb', accent: '#ffc58c', planet: '#cb8f69', sky: 0x140c20 },
];
function material(color, basic = false) {
  const key = color + basic;
  if (!materials.has(key))
    materials.set(
      key,
      basic
        ? new T.MeshBasicMaterial({ color })
        : new T.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.25 }),
    );
  return materials.get(key);
}
function box(group, x, y, z, w, h, d, color, basic = false) {
  const o = new T.Mesh(cube, material(color, basic));
  o.position.set(x, y, z);
  o.scale.set(w, h, d);
  o.receiveShadow = true;
  group.add(o);
  return o;
}
function instances(group, color, items, basic = false, custom = null) {
  if (!items.length) return;
  const o = new T.InstancedMesh(cube, custom || material(color, basic), items.length),
    matrix = new T.Matrix4();
  items.forEach((a, i) => {
    matrix.compose(
      new T.Vector3(a[0], a[1], a[2]),
      new T.Quaternion(),
      new T.Vector3(a[3], a[4], a[5]),
    );
    o.setMatrixAt(i, matrix);
  });
  o.receiveShadow = !basic;
  group.add(o);
  return o;
}
export function clearSpace(group) {
  group.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
    if (o.userData.ownGeometry) o.geometry.dispose();
    if (o.userData.ownTexture) o.material.map?.dispose();
    if (o.userData.ownMaterial) o.material.dispose();
  });
  group.clear();
}
export function createSky(group, m) {
  clearSpace(group);
  const p = palette[m.biome],
    random = rng(m.seed + 3456),
    stars = [],
    colors = [];
  for (let i = 0; i < 1900; i++) {
    const y = random() * 2 - 1,
      a = random() * Math.PI * 2,
      r = 720 * Math.sqrt(1 - y * y);
    stars.push(Math.cos(a) * r, y * 720, Math.sin(a) * r);
    const c = new T.Color().setHSL(
      0.5 + random() * 0.2,
      0.2 + random() * 0.3,
      0.55 + random() * 0.4,
    );
    colors.push(c.r, c.g, c.b);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(stars, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  const points = new T.Points(
    geo,
    new T.PointsMaterial({ size: 1.1, vertexColors: true, sizeAttenuation: true, fog: false }),
  );
  points.userData.ownGeometry = points.userData.ownMaterial = true;
  group.add(points);
  const planetMat = new T.ShaderMaterial({
    uniforms: { tint: { value: new T.Color(p.planet) } },
    vertexShader:
      'varying vec3 n;varying vec3 pos;void main(){n=normal;pos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:
      'uniform vec3 tint;varying vec3 n;varying vec3 pos;void main(){float bands=sin(pos.y*35.+sin(pos.x*13.)*.6+sin(pos.z*11.)*.6)*.08;float light=max(.08,dot(normalize(n),normalize(vec3(-.7,.7,1.))));vec3 col=mix(tint*.35,tint*1.5,light)+bands;float cloud=smoothstep(.72,.97,sin(pos.y*21.+sin(pos.x*7.)*1.4));col=mix(col,vec3(.82,.88,.96),cloud*.22*light);gl_FragColor=vec4(col,1.);\n#include <colorspace_fragment>\n}',
    fog: false,
  });
  const planet = new T.Mesh(sphere, planetMat);
  const a = m.heading + 0.32;
  planet.position.set(Math.cos(a) * 380, 145, Math.sin(a) * 380);
  planet.scale.setScalar(112);
  planet.rotation.z = 0.3;
  planet.userData.ownMaterial = true;
  group.add(planet);
  const atmosphere = new T.Mesh(
    sphere,
    new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { tint: { value: new T.Color('#94bcff') } },
      vertexShader:
        'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
      fragmentShader:
        'uniform vec3 tint;varying vec3 n;varying vec3 v;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(tint,rim*.6);}',
      fog: false,
    }),
  );
  atmosphere.position.copy(planet.position);
  atmosphere.scale.setScalar(114);
  atmosphere.userData.ownMaterial = true;
  group.add(atmosphere);
  const rings = new T.Mesh(
    ring,
    new T.MeshBasicMaterial({
      color: p.accent,
      side: T.DoubleSide,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      fog: false,
    }),
  );
  rings.position.copy(planet.position);
  rings.scale.setScalar(112);
  rings.rotation.set(1.15, 0.2, -0.25);
  rings.userData.ownMaterial = true;
  group.add(rings);
  const moon = new T.Mesh(sphere, new T.MeshBasicMaterial({ color: 0x9cb8ce, fog: false }));
  moon.scale.setScalar(15);
  moon.position.set(Math.cos(a - 0.55) * 470, 70, Math.sin(a - 0.55) * 470);
  moon.userData.ownMaterial = true;
  group.add(moon);
  // A sparse violet haze gives depth without an atmospheric daytime sky.
  const nebula = new T.Mesh(
    new T.SphereGeometry(830, 24, 16),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      vertexShader:
        'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'varying vec3 v;void main(){vec3 d=normalize(v);float band=exp(-pow((d.y-.12+sin(d.x*4.)*.12)*4.,2.));float cloud=.5+.25*sin(d.x*12.+d.z*8.)+.25*sin(d.z*19.-d.y*13.);vec3 c=vec3(.012,.018,.055)+vec3(.075,.035,.12)*band*cloud;gl_FragColor=vec4(c,1.);}',
      fog: false,
    }),
  );
  nebula.userData.ownGeometry = nebula.userData.ownMaterial = true;
  nebula.renderOrder = -10;
  group.add(nebula);
}
export function buildStation(group, m, coverMeshes) {
  clearSpace(group);
  const p = palette[m.biome],
    random = rng(m.seed),
    tiles = [],
    seams = [],
    wallCollider = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    plateThickness = 0.65;
  // Only traversable cells have deck plating; the station hangs over open space.
  for (let y = 30; y < m.height; y += 60)
    for (let x = 30; x < m.width; x += 60)
      if (
        !m.obstacles.some((o) => o.wall && x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h)
      ) {
        tiles.push([x * 0.1, -plateThickness / 2, y * 0.1, 5.94, plateThickness, 5.94]);
        seams.push([x * 0.1, 0.012, y * 0.1 - 2.7, 4.8, 0.025, 0.035]);
      }
  instances(group, p.deck, tiles);
  instances(group, '#4a6074', seams);
  const ground = new T.Mesh(new T.PlaneGeometry(m.width * 0.1, m.height * 0.1), wallCollider);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(m.width * 0.05, -0.01, m.height * 0.05);
  ground.userData.ownGeometry = true;
  group.add(ground);
  coverMeshes.push(ground);
  for (const o of m.obstacles) {
    const x = (o.x + o.w / 2) * 0.1,
      z = (o.y + o.h / 2) * 0.1,
      h = (o.height || 90) * 0.1;
    if (o.wall) {
      const collision = new T.Mesh(cube, wallCollider);
      collision.position.set(x, h / 2, z);
      collision.scale.set(o.w * 0.1, h, o.h * 0.1);
      group.add(collision);
      coverMeshes.push(collision);
    } else {
      const body = box(group, x, h / 2, z, o.w * 0.1, h, o.h * 0.1, '#435368');
      body.castShadow = true;
      coverMeshes.push(body);
      box(group, x, h + 0.12, z, o.w * 0.1 + 0.15, 0.24, o.h * 0.1 + 0.15, '#8193a4');
      box(group, x, h * 0.7, z - o.h * 0.05 - 0.02, o.w * 0.07, 0.16, 0.04, p.edge, true);
      box(group, x, h * 0.25, z - o.h * 0.05 - 0.03, o.w * 0.065, 0.55, 0.06, '#202e40');
    }
  }
  // The low rails and translucent containment field leave the planetary skyline visible.
  const trim = m.boundaries || [];
  instances(
    group,
    '#263348',
    trim.map((b) => [b.x * 0.1, 0.6, b.y * 0.1, b.nx ? 0.45 : 6, 1.2, b.nx ? 6 : 0.45]),
  );
  instances(
    group,
    '#5b7089',
    trim.filter((_, i) => i % 2 === 0).map((b) => [b.x * 0.1, 2.2, b.y * 0.1, 0.5, 4.4, 0.5]),
  );
  instances(
    group,
    p.edge,
    trim.map((b) => [
      b.x * 0.1 - b.nx * 0.08,
      1.28,
      b.y * 0.1 - b.ny * 0.08,
      b.nx ? 0.06 : 5.5,
      0.075,
      b.nx ? 5.5 : 0.06,
    ]),
    true,
  );
  const fieldMat = new T.MeshBasicMaterial({
    color: p.edge,
    transparent: true,
    opacity: 0.025,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const field = instances(
    group,
    p.edge,
    trim.map((b) => [b.x * 0.1, 18, b.y * 0.1, b.nx ? 0.035 : 6, 36, b.nx ? 6 : 0.035]),
    true,
    fieldMat,
  );
  if (field) field.userData.ownMaterial = true;
  const beamMat = new T.MeshBasicMaterial({
    color: p.edge,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const beams = instances(
    group,
    p.edge,
    trim.filter((_, i) => i % 6 === 0).map((b) => [b.x * 0.1, 18, b.y * 0.1, 0.025, 36, 0.025]),
    true,
    beamMat,
  );
  if (beams) beams.userData.ownMaterial = true;
  // Raised decks have a real slab, supports, a walkable ramp, and a jet-only lookout.
  for (const platform of m.platforms || []) {
    const x = (platform.x + platform.w / 2) * 0.1,
      z = (platform.y + platform.h / 2) * 0.1,
      h = platform.z * 0.1;
    const slab = box(group, x, h - 0.4, z, platform.w * 0.1, 0.8, platform.h * 0.1, '#344b66');
    slab.castShadow = true;
    coverMeshes.push(slab);
    for (const side of [-1, 1]) {
      box(group, x + side * (platform.w * 0.05 - 0.5), h * 0.5, z, 0.75, h, 0.75, '#233144');
      box(
        group,
        x,
        h + 0.04,
        z + side * (platform.h * 0.05 - 0.16),
        platform.w * 0.1 - 0.3,
        0.08,
        0.16,
        platform.kind === 'perch' ? p.accent : p.edge,
        true,
      );
    }
    box(group, x, h + 0.015, z, platform.w * 0.08, 0.025, 0.06, '#a4b7c6');
  }
  for (const r of m.ramps || []) {
    const y0 = r.sign > 0 ? 0 : r.z * 0.1,
      y1 = r.sign > 0 ? r.z * 0.1 : 0,
      hw = r.w * 0.05,
      hd = r.h * 0.05,
      positions = [-hw, y0, -hd, hw, y0, -hd, hw, y1, hd, -hw, y0, -hd, hw, y1, hd, -hw, y1, hd],
      g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    const ramp = new T.Mesh(
      g,
      new T.MeshStandardMaterial({ color: '#465c76', roughness: 0.8, side: T.DoubleSide }),
    );
    ramp.position.set((r.x + r.w / 2) * 0.1, 0, (r.y + r.h / 2) * 0.1);
    ramp.userData.ownGeometry = ramp.userData.ownMaterial = true;
    ramp.receiveShadow = true;
    group.add(ramp);
    coverMeshes.push(ramp);
    for (let i = 0; i < 8; i++) {
      const f = (i + 0.5) / 8;
      box(
        group,
        ramp.position.x,
        y0 + (y1 - y0) * f + 0.04,
        r.y * 0.1 + r.h * 0.1 * f,
        r.w * 0.075,
        0.05,
        0.15,
        p.edge,
        true,
      );
    }
  }
  for (const path of m.paths)
    for (let j = 1; j < path.length; j++) {
      const a = path[j - 1],
        b = path[j],
        length = Math.hypot(a.x - b.x, a.y - b.y);
      for (let d = 0; d < length; d += 130) {
        const f = d / length;
        box(
          group,
          (a.x + (b.x - a.x) * f) * 0.1,
          0.03,
          (a.y + (b.y - a.y) * f) * 0.1,
          0.7,
          0.06,
          0.7,
          p.edge,
          true,
        );
      }
    }
  for (const [i, room] of m.rooms.entries()) {
    const x = room.x * 0.1,
      z = room.y * 0.1,
      c = i === 6 ? '#94f8d0' : i === 5 ? '#ff936d' : p.edge;
    const r = new T.Mesh(
      new T.RingGeometry(i === 6 ? 14.8 : 4.8, i === 6 ? 15 : 5, 64),
      material(c, true),
    );
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 0.025, z);
    r.userData.ownGeometry = true;
    group.add(r);
    if (i === 0 || i === 6) {
      for (const side of [-1, 1]) {
        box(group, x + side * 19, 5, z, 1.3, 10, 1.3, '#4a6280');
        box(group, x + side * 19, 5, z - 0.7, 0.23, 8, 0.08, c, true);
      }
      box(group, x, 10.2, z, 39, 1.2, 1.5, '#4a6280');
      box(group, x, 10.2, z - 0.8, 32, 0.15, 0.06, c, true);
    }
  }
  // Satellite gantries in non-traversable space provide scale and a varied horizon.
  for (const o of m.obstacles.filter((o) => o.wall && o.w > 240 && o.h > 240).slice(0, 14)) {
    const x = (o.x + o.w * 0.5) * 0.1,
      z = (o.y + o.h * 0.5) * 0.1,
      h = 18 + random() * 30;
    box(group, x, h * 0.5 - 6, z, 7, h, 7, '#24354e');
    box(group, x, h - 6, z, 11, 2, 11, '#536b86');
    box(group, x, h - 5, z, 0.6, 10, 0.6, p.edge, true);
    for (const side of [-1, 1]) {
      box(group, x + side * 15, h * 0.65 - 6, z, 22, 0.3, 9, '#273a70');
      for (let j = -3; j <= 3; j++)
        box(group, x + side * 15, h * 0.65 - 5.8, z + j * 1.2, 21, 0.05, 0.08, '#6687b4');
      box(group, x + side * 7, h * 0.65 - 7, z, 14, 0.4, 0.4, '#6d8398');
    }
  }
  wallCollider.userData = {};
  ground.userData.ownMaterial = true;
  return p;
}

// A camera-centered deck avoids finite edges without allocating world-sized geometry.
export function buildTestPlatform(group, coverMeshes) {
  clearSpace(group);
  const p = palette[0];
  const floor = new T.Mesh(
    new T.PlaneGeometry(2400, 2400),
    new T.MeshStandardMaterial({ color: '#263747', roughness: 0.88, metalness: 0.2 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.ownGeometry = floor.userData.ownMaterial = true;
  group.add(floor);
  coverMeshes.push(floor);
  const grid = new T.GridHelper(2400, 240, '#55728b', '#3d546b');
  grid.position.y = 0.015;
  grid.userData.ownGeometry = grid.userData.ownMaterial = true;
  group.add(grid);
  return p;
}
