import { buildRoundScene, updateRoundScene, roundSky } from './round-scene.js';
import { buildCinderAssets } from './cinder-assets.js?v=41';
import * as T from './vendor/three.module.min.js';
const cube = new T.BoxGeometry(1, 1, 1),
  rock = new T.IcosahedronGeometry(1, 0),
  cylinder = new T.CylinderGeometry(1, 1, 1, 8),
  cone = new T.ConeGeometry(1, 1, 9),
  materials = new Map();
const mat = (color, glow = false, opacity = 1) => {
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
          })
        : new T.MeshToonMaterial({ color }),
    );
  return materials.get(key);
};
function part(g, x, y, z, w, h, d, c, glow = false, geo = cube, opacity = 1) {
  const o = new T.Mesh(geo, mat(c, glow, opacity));
  o.position.set(x, y, z);
  o.scale.set(w, h, d);
  o.castShadow = !glow;
  o.receiveShadow = true;
  g.add(o);
  return o;
}
export function buildPlanet(group, m, coverMeshes) {
  if (m.raid) return buildRoundScene(group, m, coverMeshes);
  const palette = buildCinderAssets(group, m, coverMeshes);
  const dynamic = new T.Group();
  group.add(dynamic);
  group.userData.operationFX = dynamic;
  return palette;
}
export function planetSky(group, m) {
  if (m.raid) return roundSky(group, m);
  const shell = new T.Mesh(
    new T.SphereGeometry(850, 24, 16),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader:
        'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'varying vec3 p;void main(){float y=normalize(p).y;vec3 c=mix(vec3(.57,.53,.46),vec3(.12,.21,.25),smoothstep(-.1,.8,y));gl_FragColor=vec4(c,1.);}',
    }),
  );
  shell.userData.ownGeometry = shell.userData.ownMaterial = true;
  group.add(shell);
  const moon = part(group, -220, 155, 420, 70, 70, 70, '#cbb5ae', true, rock);
  moon.material.fog = false;
  const sun = part(group, 330, 160, -470, 18, 18, 18, '#ffe0a2', true, rock);
  sun.material.fog = false;
}
export function makeMissionObjective(e) {
  const g = new T.Group(),
    kind = e.objectiveKind,
    color = kind === 'cache' ? '#95efc1' : kind === 'coolant' ? '#65d7e4' : '#ffc88a';
  part(g, 0, 0.3, 0, 7, 0.6, 7, '#23373b');
  if (kind === 'battery') {
    part(g, 0, 1.2, 0, 3.5, 1.8, 3.5, '#354b50', false, cylinder);
    part(g, 0, 2.6, 0, 7.6, 2.2, 6.5, '#657a6d');
    part(g, 0, 4.2, 0, 6.7, 1.2, 5.7, '#394f53');
    for (const side of [-1, 1]) {
      part(g, side * 3.2, 3.3, -0.2, 1.5, 4, 6.8, '#91a28b');
      const cannon = new T.Group();
      cannon.position.set(side * 1.7, 4.6, -1);
      cannon.rotation.x = -0.55;
      g.add(cannon);
      part(cannon, 0, 0, -4, 1.15, 1.15, 10, '#283b43');
      for (let i = 0; i < 5; i++) part(cannon, 0, 0, -i * 1.5, 1.6, 1.6, 0.3, '#789588');
      part(cannon, 0, 0, -9.1, 0.7, 0.7, 0.1, color, true);
    }
  } else if (kind === 'cache') {
    part(g, 0, 1.8, 0, 5, 3, 4, '#3b5b50');
    for (const side of [-1, 1]) part(g, side * 1.9, 2, 0, 0.45, 4, 4.3, '#93ae8a');
    part(g, 0, 3.7, 0, 5.2, 0.6, 4.4, '#587965');
    for (let i = -1; i <= 1; i++) part(g, i * 1.1, 2, -2.05, 0.7, 1.6, 0.1, color, true);
  } else if (kind === 'coolant') {
    part(g, 0, 3.1, 0, 1.6, 5.5, 1.6, '#2c4953', false, cylinder);
    for (let i = 0; i < 6; i++)
      part(g, 0, 1 + i * 0.8, 0, 2.1, 0.3, 2.1, '#789c9e', false, cylinder);
    part(g, 0, 6.3, 0, 1.8, 0.9, 1.8, color, true, cylinder);
  } else {
    part(g, 0, 1.6, 0, 3.5, 2.4, 3.5, '#3a5155');
    for (const side of [-1, 1]) part(g, side * 1.8, 3, 0, 0.5, 5, 0.7, '#92a395');
    part(g, 0, 4.7, 0, 3.8, 0.6, 2.8, '#6d887b');
  }
  const core = part(
    g,
    0,
    kind === 'battery' ? 4.9 : 3.2,
    0,
    kind === 'battery' ? 0.8 : 0.65,
    0.5,
    0.65,
    color,
    true,
    rock,
  );
  g.userData.core = core;
  const shield = part(
    g,
    0,
    3,
    0,
    kind === 'battery' ? 6 : 3,
    kind === 'battery' ? 5 : 3,
    kind === 'battery' ? 6 : 3,
    '#8ccaff',
    true,
    rock,
    0.12,
  );
  g.userData.shield = shield;
  return g;
}
export function updateMissionObjective(g, e, t) {
  g.position.set(e.x * 0.1, (e.altitude || 0) * 0.1, e.y * 0.1);
  g.userData.shield.visible = !!e.locked;
  g.userData.core.rotation.y = t * 0.8;
}
function ship(g) {
  const s = new T.Group();
  g.add(s);
  part(s, 0, 0, 0, 10, 4, 20, '#28363e');
  part(s, 0, 1, -8, 7, 3, 7, '#68838d');
  part(s, 0, 1.4, -11.6, 5, 1, 0.1, '#85edcd', true);
  for (const side of [-1, 1]) {
    part(s, side * 9, -0.4, 1, 13, 1.2, 10, '#405661');
    part(s, side * 12, -1, 1, 4, 3, 7, '#26323e');
    part(s, side * 12, -3, 1, 2.2, 5, 2.2, '#91edff', true, cone, 0.55);
  }
  return s;
}
export function updatePlanet(group, w, t) {
  if (w.mission.raid) return updateRoundScene(group, w, t);
  const g = group.userData.operationFX;
  if (!g) return;
  const o = w.operation;
  const ash = group.userData.ash;
  if (ash) {
    const p = w.players.find((p) => p.hp > 0) || w.players[0];
    ash.position.set(p.x * 0.1 + Math.sin(t * 0.06) * 8, -(t * 1.2) % 15, p.y * 0.1);
    ash.rotation.y = t * 0.008;
  }
  if (!g.userData.ship) {
    g.userData.ship = ship(g);
    const c = new T.Group();
    g.add(c);
    part(c, 0, 2, 0, 12, 4, 18, '#34444a');
    part(c, 0, 5, -4, 8, 4, 8, '#698386');
    part(c, 0, 5, -8.1, 6, 1.5, 0.1, '#acffc7', true);
    for (const side of [-1, 1])
      for (let j = 0; j < 3; j++) part(c, side * 7, 1, -6 + j * 6, 2.5, 3, 4, '#202c32');
    g.userData.crawler = c;
    g.userData.cells = Array.from({ length: 6 }, () => {
      const p = new T.Group();
      g.add(p);
      part(p, 0, 0, 0, 1.25, 1.8, 1.05, '#17283c');
      for (const y of [-0.85, 0.85]) part(p, 0, y, 0, 1.5, 0.18, 1.25, '#abbfd1');
      for (const z of [-0.57, 0.57]) part(p, 0, 0, z, 0.9, 1.2, 0.1, '#abffd0', true);
      for (const x of [-0.55, 0.55]) part(p, x, 0, 0.65, 0.12, 1.65, 0.15, '#abbfd1');
      return p;
    });
    g.userData.drops = Array.from({ length: 64 }, () => {
      const p = part(g, 0, 0, 0, 0.4, 25, 0.4, '#ffb582', true);
      return p;
    });
  }
  if (!g.userData.heavyZone) {
    const zone = new T.Group();
    g.add(zone);
    for (const side of [-1, 1]) {
      part(zone, side * 17, 0.12, 0, 0.45, 0.2, 34, '#ffc49a', true);
      part(zone, 0, 0.12, side * 17, 34, 0.2, 0.45, '#ffc49a', true);
      part(zone, side * 17, 8, side * 17, 0.35, 16, 0.35, '#ff9d70', true);
    }
    g.userData.heavyZone = zone;
  }
  const alert = o.heavyAlert,
    zone = g.userData.heavyZone;
  zone.visible = !!alert && w.time < alert.landingAt;
  if (zone.visible) {
    zone.position.set(alert.x * 0.1, 0, alert.y * 0.1);
    zone.scale.setScalar(1 + Math.sin(t * 8) * 0.025);
  }
  const s = g.userData.ship;
  s.visible = w.time < 9 || o.phase === 4;
  const pad = o.phase === 4 ? w.mission.exit : w.mission.entry,
    remaining = o.phase === 4 ? o.shipAt - w.time : 0;
  if (o.phase === 4)
    s.position.set(pad.x * 0.1, remaining > 0 ? Math.min(100, 8 + remaining * 7) : 8, pad.y * 0.1);
  else s.position.set(pad.x * 0.1 + w.time * 12, 55 + w.time * 6, pad.y * 0.1);
  s.rotation.y = o.phase === 4 ? 0.3 : -Math.PI / 2;

  const c = g.userData.crawler;
  c.visible = o.phase >= 2;
  c.position.set(o.crawler.x * 0.1, 0, o.crawler.y * 0.1);
  const next = w.mission.route[Math.min(o.crawler.segment + 1, w.mission.route.length - 1)];
  c.rotation.y = -Math.atan2(next.y - o.crawler.y, next.x - o.crawler.x) - Math.PI / 2;
  g.userData.cells.forEach((p, i) => {
    const cell = o.cells[i];
    p.visible = !!cell && cell.state === 'loose';
    if (!p.visible) return;
    p.position.set(cell.x * 0.1, (cell.z + 25) * 0.1 + Math.sin(t * 2 + i) * 0.25, cell.y * 0.1);
    p.rotation.y = t * 2;
  });
  g.userData.drops.forEach((p, i) => {
    const event = (w.spawn?.length ? w.spawn : w.pendingDrops)?.[i];
    p.visible = !!event;
    if (event) p.position.set(event.zone.x * 0.1, 13, event.zone.y * 0.1);
  });
}
