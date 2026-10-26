import * as T from './vendor/three.module.min.js';
import { chassisFor } from './chassis.js';
import { CHASSIS_ART } from './chassis-art.js';
import { partChassis } from './part-designs.js';

const round = new T.IcosahedronGeometry(1, 2),
  hoop = new T.TorusGeometry(1, 0.11, 6, 24),
  plates = new Map(),
  up = new T.Vector3(0, 1, 0);
// Replace structural shells, never the articulated rig, weapon mounts or live jets.
// Selected part tiers change shell bulk; equipment can add hardware after this pass.
export function buildChassisModel({ body, head, arms, legs, jets, build }, k) {
  const c = chassisFor(build),
    art = CHASSIS_ART[c.id];
  if (!art) return null;
  const { box, cyl, glow, mesh, mat } = k,
    dark = '#172732',
    steel = '#9eb1b9',
    black = '#0a141e',
    light = build.trailColor || '#80f7ff';
  const paint = (slot) => build.partColors?.[slot] || build.color || '#79b9bd';
  const bulk = (slot) =>
    ({ light: 0.86, standard: 1, heavy: 1.13 })[
      partChassis(slot, build.parts?.[slot], c.parts[slot])
    ];
  for (const root of [body, head, ...arms, ...arms.map((a) => a.userData.elbow), ...legs])
    for (const child of [...root.children]) if (child.isMesh) child.removeFromParent();
  const group = (parent, name) => {
    const g = new T.Group();
    g.name = 'chassis:' + name;
    parent.add(g);
    return g;
  };
  const hull = group(body, 'hull'),
    helmet = group(head, 'head'),
    pack = group(body, 'propulsion'),
    mounts = group(body, 'mounts');
  const shoulders = arms.map((a, i) => group(a, 'shoulder-' + i)),
    forearms = arms.map((a, i) => group(a.userData.elbow, 'forearm-' + i)),
    feet = legs.map((a, i) => group(a, 'undercarriage-' + i));
  head.position.set(...art.head);
  legs.forEach((leg, i) => (leg.position.x = (i ? 1 : -1) * art.stance));
  const orb = (p, x, y, z, a, b, d, color) => mesh(p, round, mat(color), x, y, z, a, b, d);
  const ring = (p, x, y, z, r, color, rx = 0, ry = 0) => {
    const o = mesh(p, hoop, mat(color), x, y, z, r, r, r);
    o.rotation.set(rx, ry, 0);
    return o;
  };
  const plate = (p, x, y, z, points, depth, color) => {
    const key = JSON.stringify(points);
    if (!plates.has(key)) {
      const shape = new T.Shape();
      points.forEach(([a, b], i) => (i ? shape.lineTo(a, b) : shape.moveTo(a, b)));
      shape.closePath();
      const geo = new T.ExtrudeGeometry(shape, {
        depth: 1,
        bevelEnabled: true,
        bevelThickness: 0.025,
        bevelSize: 0.025,
        bevelSegments: 1,
        steps: 1,
      });
      geo.translate(0, 0, -0.5);
      plates.set(key, geo);
    }
    return mesh(p, plates.get(key), mat(color), x, y, z, 1, 1, depth);
  };
  const strut = (p, a, b, r, color) => {
    const av = new T.Vector3(...a),
      bv = new T.Vector3(...b),
      delta = bv.sub(av),
      o = cyl(p, 0, 0, 0, r, delta.length(), color);
    o.position.copy(av.addScaledVector(delta, 0.5));
    o.quaternion.setFromUnitVectors(up, delta.normalize());
    return o;
  };
  const fin = (p, x, y, z, w, h, d, color, angle) => {
    const o = box(p, x, y, z, w, h, d, color);
    o.rotation.z = angle;
    return o;
  };
  const vent = (p, x, y, z, w, n = 4, facing = -1) => {
    box(p, x, y, z, w, 0.13 * n, 0.12, black);
    for (let i = 0; i < n; i++)
      box(p, x, y + (i - (n - 1) / 2) * 0.13, z + facing * 0.08, w * 0.86, 0.045, 0.05, steel);
  };
  const eye = (p, x, y, z, w = 0.7) => {
    box(p, x, y, z, w + 0.14, 0.23, 0.17, black);
    glow(p, x, y, z - 0.1, w, 0.075, 0.04, light);
  };
  const lens = (p, x, y, z, r) => {
    ring(p, x, y, z, r, steel);
    orb(p, x, y, z - 0.02, r * 0.78, r * 0.78, 0.12, black);
    mesh(p, round, mat(light, true), x, y, z - 0.15, r * 0.55, r * 0.55, 0.06);
  };
  const pelvis = (w = 0.65) => {
    cyl(hull, 0, 2.7, 0, 0.3, 0.55, dark);
    box(hull, 0, 2.45, 0, w * 2, 0.3, 0.75, dark);
  };
  const chest = (points, depth = 1.2) => plate(hull, 0, 3.65, 0, points, depth, paint('torso'));
  const brow = (style = 'knight') => {
    if (style === 'dome') {
      orb(helmet, 0, 0.05, 0, 0.62, 0.52, 0.6, paint('head'));
      eye(helmet, 0, 0, -0.56, 0.82);
      box(helmet, 0, -0.3, -0.52, 0.34, 0.18, 0.22, steel);
    } else if (style === 'beak') {
      plate(
        helmet,
        0,
        0.05,
        0,
        [
          [-0.5, 0.18],
          [0, 0.42],
          [0.5, 0.18],
          [0.3, -0.24],
          [0, -0.43],
          [-0.3, -0.24],
        ],
        0.85,
        paint('head'),
      );
      eye(helmet, 0, 0.03, -0.46, 0.65);
      plate(
        helmet,
        0,
        -0.23,
        -0.5,
        [
          [-0.18, 0.12],
          [0.18, 0.12],
          [0, -0.32],
        ],
        0.4,
        steel,
      );
    } else {
      plate(
        helmet,
        0,
        0,
        0,
        [
          [-0.53, 0.35],
          [0.53, 0.35],
          [0.61, -0.08],
          [0, -0.48],
          [-0.61, -0.08],
        ],
        0.9,
        paint('head'),
      );
      eye(helmet, 0, 0.04, -0.5, 0.78);
      box(helmet, 0, 0.05, -0.61, 0.09, 0.43, 0.09, steel);
    }
  };
  const armsFor = (style) =>
    arms.forEach((arm, i) => {
      const s = i ? 1 : -1,
        p = shoulders[i],
        f = forearms[i],
        color = paint('arms');
      p.scale.setScalar(bulk('arms'));
      f.scale.setScalar(bulk('arms'));
      cyl(p, 0, -0.4, 0, 0.17, 0.95, dark);
      orb(p, 0, 0, 0, 0.28, 0.28, 0.3, steel);
      box(f, 0, -0.44, 0, 0.28, 0.85, 0.34, dark);
      if (style === 'skeletal') {
        strut(p, [s * 0.22, 0.15, 0.2], [s * 0.16, -0.9, 0.2], 0.085, steel);
        box(f, s * 0.17, -0.4, 0, 0.13, 0.75, 0.5, color);
      } else if (style === 'blade') {
        plate(
          p,
          s * 0.15,
          0.2,
          -0.03,
          [
            [-0.48, 0.4],
            [0.48, 0.7],
            [0.3, -0.65],
            [-0.25, -0.24],
          ],
          0.7,
          color,
        );
        plate(
          f,
          0,
          -0.4,
          -0.12,
          [
            [-0.25, 0.4],
            [0.35, 0.2],
            [0, -0.7],
          ],
          0.55,
          color,
        );
      } else if (style === 'samurai') {
        for (let j = 0; j < 3; j++)
          box(p, s * (0.15 + j * 0.13), 0.12 - j * 0.29, 0, 1.2, 0.22, 1.05, color);
        box(f, 0, -0.45, -0.12, 0.72, 0.73, 0.72, color);
        for (let j = 0; j < 3; j++) box(f, 0, -0.2 - j * 0.22, -0.51, 0.66, 0.045, 0.04, steel);
      } else if (style === 'round' || style === 'brawler') {
        const b = style === 'brawler';
        orb(p, s * 0.18, -0.05, 0, b ? 0.95 : 0.72, b ? 0.73 : 0.6, b ? 0.86 : 0.7, color);
        orb(f, 0, -0.48, -0.08, b ? 0.79 : 0.51, b ? 0.75 : 0.55, b ? 0.72 : 0.5, color);
        if (b) {
          box(f, 0, -0.92, -0.48, 1.25, 0.35, 0.5, dark);
          for (let j = 0; j < 3; j++) box(f, (j - 1) * 0.38, -0.92, -0.77, 0.24, 0.21, 0.1, steel);
        } else eye(p, 0, 0, -0.7, 0.45);
      } else if (style === 'aero') {
        plate(
          p,
          s * 0.15,
          0.08,
          0,
          [
            [-0.62, 0.32],
            [0.62, 0.32],
            [0.72, -0.25],
            [-0.5, -0.58],
          ],
          1.45,
          color,
        );
        eye(p, 0, 0.05, -0.77, 0.6);
        cyl(f, 0, -0.45, 0, 0.4, 0.85, color);
        box(f, 0, -0.45, -0.44, 0.48, 0.5, 0.12, steel);
      } else if (style === 'bunker' || style === 'curtain') {
        box(p, s * 0.15, -0.1, 0, 1.22, style === 'curtain' ? 1.9 : 1.5, 1.7, color);
        box(p, s * 0.15, 0.75, 0, 1.35, 0.18, 1.8, steel);
        box(f, 0, -0.55, -0.05, 0.93, 1.15, 1.1, color);
        vent(p, s * 0.15, -0.1, -0.88, 0.8);
      } else if (style === 'industrial') {
        if (i === 0) {
          plate(
            p,
            0,
            -0.25,
            0,
            [
              [-0.8, 0.65],
              [0.8, 0.65],
              [0.7, -1],
              [-0.7, -1],
            ],
            1.2,
            color,
          );
          for (let j = 0; j < 4; j++)
            fin(p, -0.55 + j * 0.36, -0.15, -0.66, 0.11, 1.1, 0.05, steel, -0.4);
        } else {
          box(p, 0, 0.1, 0, 1.3, 0.55, 1.3, color);
          vent(p, 0, 0.1, -0.7, 0.9);
        }
        cyl(f, s * 0.25, -0.4, 0, 0.12, 0.85, steel);
        box(f, 0, -0.63, -0.3, 0.75, 0.45, 0.7, color);
      } else if (style === 'sniper') {
        box(p, 0, 0.16, 0, i ? 0.66 : 1.05, i ? 0.45 : 1.15, 0.9, color);
        strut(f, [s * 0.25, 0, 0.1], [s * 0.25, -0.85, 0.1], 0.09, steel);
        box(f, 0, -0.5, -0.22, 0.42, 0.7, 0.5, color);
      } else {
        plate(
          p,
          0,
          0,
          0,
          [
            [-0.65, 0.45],
            [0.65, 0.45],
            [0.75, -0.3],
            [0, -0.65],
            [-0.75, -0.3],
          ],
          1.15,
          color,
        );
        box(f, 0, -0.47, -0.12, 0.72, 0.9, 0.82, color);
        box(f, 0, -0.4, -0.56, 0.5, 0.58, 0.08, steel);
      }
    });
  const legsFor = (style) =>
    feet.forEach((p, i) => {
      const s = i ? 1 : -1,
        color = paint('legs');
      p.scale.x = bulk('legs');
      if (style === 'track') {
        box(p, 0, -1.5, 0, 1.12, 1.18, 2.8, black);
        box(p, 0, -0.82, 0, 1.25, 0.26, 2.65, color);
        for (const z of [-0.95, -0.32, 0.32, 0.95]) {
          const wheel = cyl(p, s * 0.59, -1.55, z, 0.4, 0.13, steel);
          wheel.rotation.z = Math.PI / 2;
          ring(p, s * 0.67, -1.55, z, 0.24, dark, 0, Math.PI / 2);
        }
        for (let j = 0; j < 11; j++)
          for (const y of [-2.08, -0.94]) box(p, 0, y, -1.22 + j * 0.245, 1.22, 0.1, 0.13, steel);
        for (const z of [-1.4, 1.4])
          for (let j = 0; j < 4; j++) box(p, 0, -1.85 + j * 0.23, z, 1.22, 0.12, 0.09, steel);
        strut(p, [0, 0, 0], [0, -0.8, 0], 0.22, dark);
        return;
      }
      if (style === 'quad') {
        for (const z of [-1, 1]) {
          strut(p, [0, -0.05, 0], [s * 0.63, -0.75, z * 0.85], 0.19, steel);
          orb(p, s * 0.63, -0.75, z * 0.85, 0.28, 0.28, 0.28, dark);
          strut(p, [s * 0.63, -0.75, z * 0.85], [s * 0.92, -1.92, z * 1.3], 0.18, color);
          plate(
            p,
            s * 0.92,
            -1.92,
            z * 1.3,
            [
              [-0.4, 0.15],
              [0.4, 0.15],
              [0.55, -0.18],
              [-0.55, -0.18],
            ],
            0.85,
            color,
          );
          box(p, s * 0.63, -0.75, z * 0.85, 0.57, 0.35, 0.6, color);
        }
        return;
      }
      const runner = style === 'runner',
        stilt = style === 'stilt' || style === 'clamp',
        knee = runner ? [s * 0.1, -0.92, -0.42] : [s * 0.06, -0.97, 0],
        ankle = runner ? [s * 0.15, -1.85, 0.35] : [0, -1.85, 0.02];
      strut(p, [0, 0, 0], knee, stilt ? 0.12 : 0.22, dark);
      strut(p, knee, ankle, stilt ? 0.095 : 0.2, steel);
      orb(p, ...knee, 0.25, 0.24, 0.24, dark);
      if (runner) {
        plate(
          p,
          0,
          -0.6,
          -0.28,
          [
            [-0.3, 0.42],
            [0.35, 0.2],
            [0.15, -0.5],
            [-0.16, -0.4],
          ],
          0.55,
          color,
        );
        box(p, s * 0.1, -1.5, 0.22, 0.3, 0.65, 0.3, color);
        for (const toe of [-1, 1])
          strut(p, [0, -1.94, 0.26], [toe * 0.26, -2.12, -0.65], 0.12, steel);
      } else if (stilt) {
        box(p, s * 0.1, -0.52, 0.13, 0.23, 0.75, 0.35, color);
        box(p, 0, -1.52, 0.13, 0.22, 0.7, 0.3, color);
        box(p, 0, -2.06, -0.2, style === 'clamp' ? 0.5 : 0.38, 0.17, 0.95, color);
        if (style === 'clamp')
          for (const z of [-0.65, 0.4]) box(p, 0, -1.96, z, 0.6, 0.28, 0.15, steel);
      } else if (style === 'rescue') {
        orb(p, 0, -0.55, 0, 0.43, 0.68, 0.43, color);
        orb(p, 0, -1.55, 0, 0.5, 0.55, 0.5, color);
        box(p, 0, -2.01, -0.23, 0.88, 0.28, 1.15, dark);
      } else if (style === 'industrial') {
        for (const x of [-0.3, 0.3]) strut(p, [x, -0.1, 0.15], [x, -1.86, 0.15], 0.09, steel);
        box(p, 0, -1.45, -0.18, 0.57, 0.77, 0.5, color);
        box(p, 0, -2, -0.1, 1.18, 0.3, 1.42, dark);
        for (const z of [-0.72, 0.52]) box(p, 0, -2.02, z, 1.3, 0.3, 0.18, steel);
      } else {
        const wide = style === 'bunker' || style === 'brawler';
        box(p, 0, -0.5, 0, wide ? 0.85 : 0.65, 0.95, 0.8, dark);
        plate(
          p,
          0,
          -1.4,
          -0.2,
          [
            [-(wide ? 0.55 : 0.38), 0.52],
            [wide ? 0.55 : 0.38, 0.52],
            [wide ? 0.48 : 0.3, -0.48],
            [-(wide ? 0.48 : 0.3), -0.48],
          ],
          wide ? 0.95 : 0.7,
          color,
        );
        box(p, 0, -2.02, -0.3, wide ? 1.25 : 0.85, 0.3, wide ? 1.7 : 1.25, color);
        if (style === 'brawler')
          for (let t = 0; t < 3; t++) box(p, (t - 1) * 0.36, -2.02, -1.15, 0.21, 0.18, 0.3, steel);
      }
    });
  const fan = (p, x, y, z, r) => {
    ring(p, x, y, z, r, paint('booster'));
    ring(p, x, y, z, r * 0.8, dark);
    orb(p, x, y, z, 0.15, 0.15, 0.13, steel);
    for (let j = 0; j < 4; j++) {
      const a = (j * Math.PI) / 2;
      const vane = box(
        p,
        x + Math.cos(a) * r * 0.35,
        y + Math.sin(a) * r * 0.35,
        z,
        0.55 * r,
        0.14 * r,
        0.12,
        steel,
      );
      vane.rotation.z = a + 0.45;
    }
  };
  const backPair = (style = 'slim', spread = 0.8) => {
    for (const s of [-1, 1]) {
      if (style === 'wing') {
        plate(
          pack,
          s * 1.35,
          4,
          1.12,
          [
            [0, 0.35],
            [s * 1.65, -0.35],
            [s * 1.8, -0.85],
            [0, -0.3],
          ],
          0.24,
          paint('booster'),
        );
        box(pack, s * 1.1, 3.4, 1.25, 0.45, 1.65, 0.58, dark);
      } else {
        box(
          pack,
          s * spread,
          3.6,
          1.15,
          style === 'pod' ? 0.8 : 0.4,
          style === 'pod' ? 1.75 : 1.4,
          0.75,
          paint('booster'),
        );
        vent(pack, s * spread, 3.8, 1.56, style === 'pod' ? 0.5 : 0.25, 4, 1);
      }
    }
  };
  pelvis(art.stance);
  switch (c.id) {
    case 'lark':
      for (const s of [-1, 1]) {
        strut(hull, [s * 0.7, 4.3, 0], [0, 2.95, 0], 0.13, steel);
        plate(
          hull,
          s * 0.38,
          3.8,
          -0.15,
          [
            [-0.21, 0.5],
            [0.21, 0.3],
            [0, -0.6],
          ],
          0.5,
          paint('torso'),
        );
        fin(pack, s * 0.7, 4, 1, 0.16, 1.4, 0.45, paint('booster'), -s * 0.3);
      }
      orb(hull, 0, 3.2, 0, 0.27, 0.32, 0.32, dark);
      eye(hull, 0, 3.6, -0.4, 0.35);
      brow('beak');
      for (const s of [-1, 1]) strut(helmet, [s * 0.3, 0.3, 0], [s * 0.7, 0.8, 0.15], 0.035, steel);
      armsFor('skeletal');
      legsFor('runner');
      box(pack, 0, 3.1, 1.35, 0.24, 0.22, 1.2, dark);
      break;
    case 'needle':
      box(hull, 0, 3.6, 0, 0.68, 1.85, 0.78, paint('torso'));
      vent(hull, 0, 3.5, -0.43, 0.45, 6);
      lens(helmet, 0, 0, -0.08, 0.47);
      box(helmet, 0, 0, 0.18, 0.68, 0.72, 0.65, paint('head'));
      box(pack, 0.58, 4.6, 0.8, 0.12, 2.45, 0.13, steel);
      glow(pack, 0.58, 5.8, 0.8, 0.18, 0.13, 0.16, light);
      for (const s of [-1, 1]) strut(pack, [s * 0.4, 4.3, 0.5], [s * 0.8, 2.65, 1.35], 0.08, steel);
      armsFor('sniper');
      legsFor('stilt');
      break;
    case 'wisp':
      ring(hull, 0, 3.65, 0, 0.86, paint('torso'));
      ring(hull, 0, 3.65, -0.04, 0.65, steel);
      orb(hull, 0, 3.65, 0, 0.31, 0.31, 0.32, dark);
      glow(hull, 0, 3.65, -0.32, 0.28, 0.28, 0.06, light);
      strut(hull, [0, 2.55, 0], [0, 2.95, 0], 0.16, steel);
      box(helmet, 0, 0, 0, 1.15, 0.32, 0.55, paint('head'));
      for (const x of [-0.36, 0, 0.36]) lens(helmet, x, 0, -0.3, 0.12);
      for (const s of [-1, 1])
        for (const y of [3.2, 4.65]) {
          strut(pack, [0, y, 0.65], [s * 1.35, y, 0.8], 0.1, steel);
          fan(pack, s * 1.35, y, 0.8, 0.59);
        }
      armsFor('skeletal');
      legsFor('clamp');
      break;
    case 'kestrel':
      chest(
        [
          [-1, 0.65],
          [0, 0.15],
          [1, 0.65],
          [0.62, -0.75],
          [0, -1],
          [-0.62, -0.75],
        ],
        0.95,
      );
      for (const s of [-1, 1]) fin(hull, s * 0.45, 3.7, -0.58, 0.13, 1, 0.14, steel, -s * 0.65);
      brow('beak');
      armsFor('blade');
      legsFor('runner');
      backPair('wing');
      break;
    case 'ronin':
      chest(
        [
          [-0.95, 0.65],
          [0.95, 0.65],
          [0.7, -0.75],
          [-0.7, -0.75],
        ],
        1.15,
      );
      for (let j = 0; j < 4; j++) box(hull, 0, 3.3 + j * 0.24, -0.62, 1.5, 0.07, 0.07, steel);
      brow();
      for (const s of [-1, 1]) {
        strut(helmet, [s * 0.25, 0.3, -0.13], [s * 0.73, 0.5, -0.13], 0.085, steel);
        strut(helmet, [s * 0.73, 0.5, -0.13], [s * 0.92, 1.03, -0.13], 0.07, steel);
        for (let j = 0; j < 3; j++)
          fin(hull, s * (0.46 + j * 0.28), 2.6, 0, 0.42, 0.85, 1.08, paint('torso'), s * 0.16);
      }
      armsFor('samurai');
      legsFor('knight');
      backPair();
      break;
    case 'harrier':
      chest(
        [
          [-0.55, 0.85],
          [0.55, 0.85],
          [0.8, -0.55],
          [0, -1.2],
          [-0.8, -0.55],
        ],
        1.5,
      );
      plate(
        hull,
        0,
        3.65,
        -0.82,
        [
          [-0.35, 0.6],
          [0.35, 0.6],
          [0, -0.8],
        ],
        0.55,
        dark,
      );
      brow('beak');
      backPair('wing');
      for (const s of [-1, 1]) {
        fin(pack, s * 0.7, 4.9, 1.05, 0.14, 1.5, 0.8, paint('booster'), -s * 0.6);
        cyl(pack, s * 1.15, 3.5, 1.25, 0.37, 2, steel);
      }
      armsFor('round');
      legsFor('stilt');
      break;
    case 'vanguard':
      chest(
        [
          [-1.04, 0.7],
          [1.04, 0.7],
          [1.15, -0.22],
          [0, -1],
          [-1.15, -0.22],
        ],
        1.4,
      );
      plate(
        hull,
        0,
        3.8,
        -0.78,
        [
          [-0.7, 0.35],
          [0.7, 0.35],
          [0, -0.6],
        ],
        0.13,
        steel,
      );
      eye(hull, 0, 4.15, -0.9, 0.8);
      brow();
      armsFor('knight');
      legsFor('knight');
      backPair('pod');
      break;
    case 'longbow':
      chest(
        [
          [-0.6, 0.85],
          [0.6, 0.85],
          [0.52, -1],
          [-0.52, -1],
        ],
        1.05,
      );
      box(hull, 0, 3.8, -0.58, 0.16, 1.25, 0.12, steel);
      box(helmet, -0.2, -0.05, 0, 0.6, 0.47, 0.7, paint('head'));
      eye(helmet, -0.2, 0, -0.4, 0.38);
      strut(helmet, [0.3, -0.2, 0.2], [0.3, 0.76, 0.2], 0.11, steel);
      box(helmet, 0.3, 0.72, -0.08, 0.45, 0.38, 0.85, paint('head'));
      lens(helmet, 0.3, 0.72, -0.54, 0.16);
      box(pack, -0.8, 4.6, 0.8, 0.14, 2.1, 0.2, dark);
      backPair('slim', 0.5);
      armsFor('sniper');
      legsFor('stilt');
      break;
    case 'warden':
      orb(hull, 0, 3.65, 0, 1.05, 1.2, 0.86, paint('torso'));
      ring(hull, 0, 3.8, -0.66, 0.58, steel);
      glow(hull, 0, 3.8, -0.88, 0.7, 0.16, 0.05, '#9dffc4');
      glow(hull, 0, 3.8, -0.89, 0.16, 0.7, 0.05, '#9dffc4');
      brow('dome');
      armsFor('round');
      legsFor('rescue');
      for (const x of [-0.75, 0, 0.75]) {
        cyl(pack, x, 3.6, 1.1, 0.27, 1.7, paint('booster'));
        ring(pack, x, 4.5, 1.1, 0.25, steel, Math.PI / 2);
        box(pack, x, 3.6, 1.39, 0.32, 0.18, 0.08, steel);
      }
      break;
    case 'bastion':
      chest(
        [
          [-1.35, 0.62],
          [1.35, 0.62],
          [1.05, -0.85],
          [-1.05, -0.85],
        ],
        1.7,
      );
      plate(
        hull,
        0,
        3.7,
        -0.94,
        [
          [-1.15, 0.45],
          [1.15, 0.45],
          [0.8, -0.55],
          [-0.8, -0.55],
        ],
        0.2,
        steel,
      );
      box(helmet, 0, 0, 0, 1.42, 0.53, 1.13, paint('head'));
      box(helmet, 0, 0.3, -0.08, 1.65, 0.22, 1.38, steel);
      eye(helmet, 0, -0.02, -0.63, 1.1);
      armsFor('bunker');
      legsFor('bunker');
      backPair('pod', 1);
      box(hull, 0, 2.65, -0.7, 2.1, 0.4, 0.5, paint('torso'));
      break;
    case 'anvil':
      chest(
        [
          [-1.1, 0.7],
          [0.85, 0.85],
          [1.17, -0.7],
          [-0.78, -0.9],
        ],
        1.5,
      );
      box(hull, 0, 3.65, -0.82, 1.25, 1.13, 0.14, black);
      for (let j = 0; j < 5; j++) {
        glow(hull, 0, 3.22 + j * 0.2, -0.91, 0.94, 0.07, 0.04, '#ff995b');
        box(hull, 0, 3.22 + j * 0.2, -0.96, 1.2, 0.035, 0.06, steel);
      }
      box(helmet, 0, 0, 0, 1, 0.65, 0.85, paint('head'));
      eye(helmet, 0, 0, -0.47, 0.68);
      for (const s of [-1, 1]) {
        cyl(pack, s * 0.85, 4.55, 1, 0.23, 2.4, dark);
        cyl(pack, s * 0.85, 5.65, 1, 0.3, 0.2, steel);
        orb(pack, s * 0.85, 5.78, 1, 0.18, 0.06, 0.18, black);
      }
      vent(hull, 0, 3.6, 0.85, 1.3, 6, 1);
      armsFor('industrial');
      legsFor('industrial');
      break;
    case 'skyguard':
      orb(hull, 0, 3.65, 0, 0.92, 1.05, 1.02, paint('torso'));
      plate(
        hull,
        0,
        3.5,
        -0.9,
        [
          [-0.45, 0.65],
          [0.45, 0.65],
          [0, -0.75],
        ],
        0.3,
        steel,
      );
      brow('dome');
      for (const s of [-1, 1]) {
        box(pack, s * 2.1, 4.65, 0.8, 2.7, 0.17, 0.85, paint('booster'));
        box(pack, s * 1.9, 3.85, 1, 2.3, 0.13, 0.7, steel);
        fan(pack, s * 3.15, 4.75, 0.85, 0.82);
        box(pack, s * 3.15, 4.1, 1.15, 0.85, 1.1, 0.8, paint('booster'));
      }
      vent(hull, 0, 3.7, 1.04, 0.7, 5, 1);
      armsFor('aero');
      legsFor('stilt');
      break;
    case 'colossus':
      chest(
        [
          [-1.35, 0.65],
          [1.35, 0.65],
          [1, -0.65],
          [0.5, -1],
          [-0.5, -1],
          [-1, -0.65],
        ],
        1.7,
      );
      ring(hull, 0, 3.8, -0.9, 0.62, steel);
      orb(hull, 0, 3.8, -0.98, 0.46, 0.46, 0.13, black);
      mesh(hull, round, mat(light, true), 0, 3.8, -1.12, 0.29, 0.29, 0.06);
      box(helmet, 0, 0, 0, 1.05, 0.6, 1.05, paint('head'));
      eye(helmet, 0, 0.05, -0.56, 0.76);
      box(helmet, 0, -0.25, -0.51, 0.65, 0.23, 0.25, steel);
      armsFor('brawler');
      legsFor('brawler');
      backPair('pod', 1.05);
      break;
    case 'leviathan':
      chest(
        [
          [-1.25, 0.55],
          [1.25, 0.55],
          [1.5, -0.3],
          [0, -1.05],
          [-1.5, -0.3],
        ],
        1.9,
      );
      plate(
        hull,
        0,
        3.6,
        -1.02,
        [
          [-1, 0.35],
          [1, 0.35],
          [0, -0.9],
        ],
        0.22,
        steel,
      );
      box(helmet, 0, -0.15, 0, 1.25, 0.42, 1.2, paint('head'));
      box(helmet, 0, 0.28, 0.1, 0.85, 0.44, 0.85, paint('head'));
      eye(helmet, 0, 0.28, -0.37, 0.7);
      strut(helmet, [0, 0.5, 0.3], [0, 1.12, 0.3], 0.05, steel);
      box(helmet, 0, 0.92, 0.3, 0.75, 0.06, 0.1, steel);
      for (const s of [-1, 1]) {
        box(pack, s * 1.2, 3.7, 1.1, 0.45, 0.8, 1.8, paint('booster'));
        vent(pack, s * 1.2, 3.75, 0.15, 0.3);
        fin(pack, s * 1.75, 3.65, 1.15, 0.85, 0.16, 1.7, steel, -s * 0.2);
      }
      armsFor('knight');
      legsFor('quad');
      break;
    case 'citadel':
      chest(
        [
          [-0.9, 0.75],
          [0.9, 0.75],
          [1.2, -0.9],
          [-1.2, -0.9],
        ],
        1.4,
      );
      box(hull, 0, 3.5, -0.82, 1.5, 0.9, 0.22, steel);
      box(hull, 0, 3.5, -0.97, 0.75, 0.57, 0.08, dark);
      eye(hull, 0, 3.65, -1.03, 0.57);
      box(helmet, 0, 0.02, 0, 1.05, 0.95, 1.05, paint('head'));
      box(helmet, 0, 0.54, 0, 1.45, 0.18, 1.4, steel);
      for (const x of [-0.55, 0, 0.55])
        for (const z of [-0.5, 0.5]) box(helmet, x, 0.76, z, 0.28, 0.32, 0.35, paint('head'));
      eye(helmet, 0, 0.05, -0.57, 0.75);
      armsFor('curtain');
      legsFor('track');
      box(pack, 0, 3.75, 1.15, 1.7, 1.8, 0.7, paint('booster'));
      vent(pack, 0, 3.75, 1.54, 1.3, 7, 1);
      break;
  }
  hull.scale.x = bulk('torso');
  helmet.scale.setScalar(bulk('head'));
  strut(mounts, [0, 4.15, 0], art.head, 0.15, dark);
  cyl(mounts, 0, 4.4, 0, 0.24, 0.15, steel);
  arms.forEach((arm, i) => {
    const s = i ? 1 : -1;
    for (const z of [-0.2, 0.2])
      strut(
        mounts,
        [s * (c.id === 'wisp' ? 0.68 : 0.25), 4.15, z],
        [arm.position.x, 4.15, z],
        0.095,
        steel,
      );
  });
  const mainJets = jets.filter((j) => j.parent === body);
  mainJets.forEach((jet, i) =>
    jet.position.set(
      (i ? 1 : -1) *
        (c.id === 'wisp' ? 1.35 : c.id === 'skyguard' ? 3.15 : c.size === 'scout' ? 0.6 : 0.85),
      c.id === 'wisp' ? 2.65 : c.id === 'skyguard' ? 3.25 : 2.7,
      c.id === 'skyguard' ? 1.15 : 1.3,
    ),
  );
  legs.forEach((leg, i) => {
    const heel = jets.find((j) => j.parent === leg);
    if (c.id === 'leviathan') heel.position.set((i ? 1 : -1) * 0.92, -1.94, -1.15);
    if (c.id === 'citadel') heel.position.set(0, -1.65, 0.7);
  });
  body.userData.chassisShells = { hull, helmet, pack, mounts, shoulders, forearms, feet };
  return {
    id: c.id,
    name: art.name,
    gait: art.gait,
    locomotion: c.id === 'citadel' ? 'tracks' : c.id === 'leviathan' ? 'quadruped' : 'biped',
  };
}
