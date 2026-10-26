import { impactLevel } from './impact-preferences.js';
import * as T from './vendor/three.module.min.js';
import { equipmentFor } from './core.js?v=41';

export const ITEM_TINTS = {
  carbine: '#80f7ff',
  scatter: '#c596ff',
  rail: '#80f7ff',
  launcher: '#ffae64',
  plasma: '#c596ff',
  rotary: '#ff526d',
  phaser: '#7bffc4',
  flamer: '#ff9d54',
  dynamo: '#ffda68',
  blade: '#80f7ff',
  lance: '#80f7ff',
  hammer: '#c596ff',
  claws: '#ff9d54',
  scythe: '#c596ff',
  guard: '#80f7ff',
  emp: '#87dcff',
  shield: '#78afff',
  repair: '#8dffb7',
};
const ringGeometry = new T.TorusGeometry(1, 0.1, 6, 24),
  orbGeometry = new T.IcosahedronGeometry(1, 1);

// These details join the existing rigid-part batches; they do not add one draw call per plate.
export function addItemDetails(rig, k) {
  const { body, head, arms, legs, parts, build, width } = rig,
    { box, cyl, glow, mesh, mat } = k;
  const dark = '#17283c',
    steel = '#abbfd1',
    paint = (s) => build.partColors?.[s] || build.color || '#ee7950',
    light = build.trailColor || '#80f7ff';
  const group = (parent, x = 0, y = 0, z = 0) => {
    const g = new T.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const ring = (p, x, y, z, r, c, rx = 0, ry = 0) => {
    const m = mesh(p, ringGeometry, mat(c), x, y, z, r, r, r);
    m.rotation.set(rx, ry, 0);
    return m;
  };
  const orb = (p, x, y, z, r, c) => mesh(p, orbGeometry, mat(c, true), x, y, z, r, r, r);
  const fin = (p, x, y, z, w, h, d, c, angle) => {
    const m = box(p, x, y, z, w, h, d, c);
    m.rotation.z = angle;
    return m;
  };
  const bars = (p, x, y, z, count, step, w, h, d, c) => {
    for (let i = 0; i < count; i++) box(p, x, y + i * step, z, w, h, d, c);
  };
  switch (parts.torso) {
    case 'raptor':
      for (const s of [-1, 1]) {
        bars(body, s * 0.85, 3, -0.67, 4, 0.3, 0.25, 0.12, 0.45, steel);
        fin(body, s * 1.25, 4.25, 0.1, 0.2, 1.5, 1, paint('torso'), -s * 0.6);
      }
      break;
    case 'spectre':
      for (const s of [-1, 1])
        fin(body, s * 0.7, 3.8, -0.8, 1.15, 1.7, 0.22, paint('torso'), s * 0.4);
      orb(body, 0.75, 4.3, -1, 0.14, light);
      break;
    case 'reactor':
      ring(body, 0, 3.8, -1.05, 0.75, steel);
      orb(body, 0, 3.8, -1.09, 0.46, '#ffda68');
      for (const s of [-1, 1])
        bars(body, s * 1.25, 3.1, -0.2, 5, 0.25, 0.4, 0.12, 1, paint('torso'));
      break;
    case 'corsair':
      for (const s of [-1, 1]) {
        fin(body, 0, 3.75, -1, 2.7, 0.14, 0.16, steel, s * 0.6);
        box(body, s * 1.1, 2.85, -0.5, 0.65, 0.65, 0.6, paint('torso'));
        box(body, s * 0.75, 4.6, 0, 0.5, 0.45, 1.2, dark);
      }
      break;
    case 'citadel':
      for (let i = 0; i < 3; i++)
        box(body, 0, 3.1 + i * 0.5, -1.18 - i * 0.08, 2.9 - i * 0.2, 0.38, 0.3, paint('torso'));
      for (const s of [-1, 1]) box(body, s * 1.35, 4.8, 0, 0.5, 1.2, 1.7, steel);
      break;
    case 'furnace':
      for (const s of [-1, 1]) {
        cyl(body, s * 0.95, 5, 1.05, 0.26, 2.2, dark);
        cyl(body, s * 0.95, 6.12, 1.05, 0.36, 0.18, steel);
        bars(body, s * 0.8, 3, -1.15, 5, 0.28, 0.75, 0.12, 0.24, steel);
      }
      orb(body, 0, 3.8, -1.2, 0.4, '#ff9d54');
      break;
    case 'light':
      fin(body, 0, 3.8, -0.85, 0.18, 1.3, 0.28, steel, 0.4);
      break;
    case 'standard':
      for (const s of [-1, 1]) box(body, s * 0.9, 4.35, -0.85, 0.3, 0.25, 0.2, paint('torso'));
      break;
    case 'heavy':
      for (const s of [-1, 1]) bars(body, s * 1.3, 3.1, -1.04, 3, 0.34, 0.4, 0.16, 0.2, dark);
      break;
  }
  switch (parts.head) {
    case 'cyclops':
      box(head, 0, 0, -0.68, 0.85, 0.55, 0.2, dark);
      ring(head, 0, 0, -0.84, 0.38, steel);
      orb(head, 0, 0, -0.85, 0.26, light);
      break;
    case 'mantis':
      for (const s of [-1, 1]) {
        orb(head, s * 0.43, 0.05, -0.62, 0.2, '#b5ff8b');
        fin(head, s * 0.55, 0.55, 0, 0.06, 1, 0.06, steel, -s * 0.8);
      }
      break;
    case 'ronin':
      for (const s of [-1, 1]) {
        fin(head, s * 0.75, 0.5, -0.1, 0.15, 1.4, 0.18, '#ffd06a', -s * 1.05);
        box(head, s * 0.53, -0.25, 0, 0.25, 0.75, 0.85, paint('head'));
      }
      break;
    case 'surveyor':
      ring(head, -0.83, 0.3, 0, 0.55, steel, 0, Math.PI / 2);
      cyl(head, -0.82, 0.3, 0, 0.3, 0.15, paint('head')).rotation.z = Math.PI / 2;
      box(head, 0.65, 0.05, -0.3, 0.35, 0.35, 0.9, dark);
      orb(head, 0.65, 0.05, -0.8, 0.16, light);
      break;
    case 'paladin':
      box(head, 0, 0, -0.73, 1.25, 0.15, 0.16, steel);
      box(head, 0, 0.02, -0.75, 0.16, 0.9, 0.18, steel);
      fin(head, 0, 0.65, 0.05, 0.2, 0.85, 0.7, paint('head'), 0);
      break;
    case 'anvil':
      mesh(head, orbGeometry, mat(paint('head')), 0, 0.34, 0.05, 0.85, 0.45, 0.75);
      for (const s of [-1, 1]) {
        box(head, s * 0.65, 0.6, 0.1, 0.24, 0.6, 0.36, dark);
        glow(head, s * 0.65, 0.72, -0.1, 0.18, 0.15, 0.06, light);
      }
      break;
  }
  for (let i = 0; i < 2; i++) {
    const s = i ? -1 : 1,
      arm = arms[i],
      leg = legs[i],
      elbow = arm.userData.elbow;
    switch (parts.arms) {
      case 'talon':
        fin(arm, -s * 0.6, 0.4, 0.15, 0.18, 1.9, 1.05, paint('arms'), s * 0.65);
        fin(elbow, -s * 0.45, -0.4, -0.2, 0.12, 0.9, 0.65, steel, s * 0.3);
        break;
      case 'wire':
        for (const z of [-0.38, 0.38]) cyl(arm, -s * 0.3, -0.65, z, 0.09, 1.25, steel);
        box(arm, 0, 0.4, 0, 0.65, 0.15, 1.3, dark);
        break;
      case 'outrider':
        box(arm, -s * 0.6, i ? 0 : -0.35, 0, 0.35, i ? 1.3 : 2.2, 1.6, paint('arms'));
        bars(elbow, -s * 0.4, -0.7, -0.6, 3, 0.23, 0.3, 0.12, 0.22, '#ffd06a');
        break;
      case 'conduit':
        ring(arm, -s * 0.66, 0, 0, 0.72, steel, 0, Math.PI / 2);
        for (const z of [-0.4, 0, 0.4]) glow(elbow, -s * 0.45, -0.4, z, 0.12, 0.7, 0.12, light);
        break;
      case 'rampart':
        for (const z of [-0.5, 0, 0.5]) box(arm, 0, 0.78, z, 1.6, 0.45, 0.26, paint('arms'));
        bars(elbow, 0, -0.9, -0.65, 3, 0.3, 1.15, 0.2, 0.25, steel);
        break;
      case 'riveter':
        for (const z of [-0.7, 0.7]) {
          cyl(arm, -s * 0.63, -0.5, z, 0.18, 1.8, steel);
          box(arm, 0, 0.6, z, 1.8, 0.2, 0.2, '#ffd06a');
        }
        break;
    }
    switch (parts.legs) {
      case 'raptor':
        fin(leg, 0, -1.2, 0.85, 0.18, 1.25, 0.3, steel, s * 0.15);
        for (const x of [-0.2, 0.2]) fin(leg, x, -2.13, -0.95, 0.18, 0.22, 1.1, paint('legs'), 0);
        break;
      case 'skate':
        box(leg, 0, -2.25, -0.35, 0.2, 0.22, 2.6, steel);
        fin(leg, -s * 0.5, -1.65, 0.2, 0.12, 0.8, 0.8, paint('legs'), s * 0.7);
        break;
      case 'piston':
        cyl(leg, -s * 0.47, -1.5, -0.25, 0.12, 1.5, steel);
        ring(leg, 0, -1.2, -0.64, 0.4, paint('legs'));
        break;
      case 'outrigger':
        fin(leg, -s * 0.63, -1.8, 0.2, 0.2, 0.9, 1.2, paint('legs'), -s * 0.7);
        box(leg, 0, -1, -0.7, 1.2, 0.8, 0.3, steel);
        break;
      case 'crab':
        for (const x of [-0.45, 0.45]) {
          const toe = box(leg, x, -2.1, -1.1, 0.3, 0.3, 1.4, steel);
          toe.rotation.y = x * 0.8;
        }
        box(leg, -s * 0.62, -0.4, 0, 0.6, 1.2, 1.35, paint('legs'));
        break;
      case 'tread':
        for (const x of [-0.6, 0.6]) {
          box(leg, x, -1.95, 0, 0.4, 0.65, 2.2, dark);
          for (let z = -0.7; z <= 0.71; z += 0.7) {
            const wheel = cyl(leg, x, -1.95, z, 0.27, 0.44, steel);
            wheel.rotation.z = Math.PI / 2;
          }
          for (let z = -0.95; z < 1; z += 0.32)
            box(leg, x, -2.3, z, 0.48, 0.1, 0.15, paint('legs'));
        }
        break;
    }
  }
  switch (parts.booster) {
    case 'kite':
      for (const s of [-1, 1]) {
        fin(body, s * 2, 4.9, 1.4, 0.22, 3.5, 1.45, paint('booster'), -s * 0.8);
        glow(body, s * 3.2, 6.05, 1.4, 0.18, 0.25, 0.3, light);
      }
      break;
    case 'wasp':
      for (const s of [-1, 1])
        for (const y of [3.3, 4.8]) {
          const pod = group(body, s * 1.8, y, 1.5);
          pod.rotation.z = -s * 0.5;
          cyl(pod, 0, 0, 0, 0.4, 1.2, paint('booster'));
          ring(pod, 0, -0.6, 0, 0.4, steel, Math.PI / 2);
          glow(pod, 0, -0.65, 0, 0.4, 0.08, 0.4, light);
        }
      break;
    case 'halo':
      ring(body, 0, 4.65, 1.9, 2.1, paint('booster'));
      ring(body, 0, 4.65, 1.94, 1.78, light);
      for (const s of [-1, 1]) box(body, s * 1.1, 4.5, 1.5, 0.2, 1, 0.9, steel);
      break;
    case 'gull':
      for (const s of [-1, 1]) {
        box(body, s * 1.9, 4, 1.4, 2.2, 0.3, 1.1, paint('booster'));
        const pod = cyl(body, s * 2.75, 4, 1.4, 0.57, 2.3, steel);
        pod.rotation.x = Math.PI / 2;
        ring(body, s * 2.75, 4, 2.6, 0.44, light);
      }
      break;
    case 'saturn':
      for (const s of [-1, 1]) {
        cyl(body, s * 1.5, 4.55, 1.6, 0.62, 3.5, paint('booster'));
        for (const y of [3.3, 4.7, 5.8]) cyl(body, s * 1.5, y, 1.6, 0.67, 0.18, steel);
        orb(body, s * 1.5, 6.35, 1.6, 0.6, paint('booster'));
      }
      break;
    case 'foundry':
      for (const s of [-1, 1]) {
        bars(body, s * 1.65, 3.6, 1.8, 7, 0.32, 1.6, 0.12, 1.3, steel);
        box(body, s * 1.65, 4.55, 1.3, 0.24, 2.3, 1, paint('booster'));
      }
      break;
  }
  const equipment = equipmentFor(build);
  equipment.slice(0, 2).forEach((id, i) => {
    const s = i ? 1 : -1,
      p = group(body, s * (width + 0.55), 3.6, 1.1),
      tint = ITEM_TINTS[id];
    p.name = 'attachment:' + i + ':' + id;
    box(p, 0, 0, 0, 0.35, 0.55, 0.3, dark);
    switch (id) {
      case 'carbine':
        for (let j = 0; j < 3; j++) box(p, s * j * 0.21, -0.4, 0.22, 0.15, 0.9, 0.32, steel);
        glow(p, 0, 0.2, 0.4, 0.5, 0.08, 0.08, tint);
        break;
      case 'scatter':
        for (let j = 0; j < 5; j++) {
          cyl(p, s * j * 0.13, -0.2, 0.3, 0.09, 0.65, tint);
          cyl(p, s * j * 0.13, 0.15, 0.3, 0.1, 0.12, steel);
        }
        break;
      case 'rail':
        for (const x of [-0.2, 0.2]) {
          box(p, x, 0.25, 0.3, 0.12, 1.8, 0.4, steel);
          glow(p, x, 0.25, 0.53, 0.06, 1.5, 0.06, tint);
        }
        break;
      case 'launcher':
        for (const x of [-0.24, 0.24])
          for (const y of [-0.3, 0.3]) {
            const tube = cyl(p, x, y, 0.35, 0.2, 0.8, dark);
            tube.rotation.x = Math.PI / 2;
            orb(p, x, y, 0.8, 0.13, tint);
          }
        break;
      case 'plasma':
        orb(p, 0, 0, 0.45, 0.45, tint);
        for (const y of [-0.5, 0.5]) ring(p, 0, y, 0.4, 0.5, steel, Math.PI / 2);
        break;
      case 'rotary':
        cyl(p, 0, -0.1, 0.35, 0.55, 0.9, steel);
        for (let j = 0; j < 5; j++)
          box(p, s * (0.2 + j * 0.12), -0.5 - j * 0.09, 0.45, 0.13, 0.3, 0.22, tint);
        break;
      case 'phaser':
        ring(p, 0, 0.1, 0.4, 0.5, steel);
        glow(p, 0, 0.1, 0.45, 0.25, 0.7, 0.2, tint);
        break;
      case 'flamer':
        for (const x of [-0.3, 0.3]) {
          cyl(p, x, 0, 0.3, 0.25, 1.5, '#be5335');
          cyl(p, x, 0.55, 0.3, 0.27, 0.12, steel);
        }
        box(p, 0, -0.7, 0.3, 0.75, 0.12, 0.4, dark);
        break;
      case 'dynamo':
        for (let j = 0; j < 3; j++) {
          cyl(p, 0, -0.4 + j * 0.42, 0.3, 0.32, 0.28, steel);
          glow(p, 0, -0.4 + j * 0.42, 0.3, 0.66, 0.08, 0.55, tint);
        }
        break;
      case 'blade':
        box(p, 0, -0.3, 0.3, 0.25, 1.65, 0.35, dark);
        glow(p, 0, -0.2, 0.5, 0.08, 1.2, 0.05, tint);
        break;
      case 'lance':
        cyl(p, 0, -0.2, 0.3, 0.26, 1.6, steel);
        fin(p, 0, 0.8, 0.3, 0.12, 0.65, 0.2, tint, 0);
        break;
      case 'hammer':
        box(p, 0, 0, 0.35, 0.75, 0.95, 0.65, steel);
        glow(p, 0, 0, 0.7, 0.5, 0.15, 0.05, tint);
        break;
      case 'claws':
        for (let j = 0; j < 3; j++)
          fin(p, s * (j - 1) * 0.22, 0.3, 0.3, 0.12, 1, 0.3, tint, -s * 0.25);
        break;
      case 'scythe':
        ring(p, 0, 0.2, 0.4, 0.55, steel);
        fin(p, s * 0.5, 0.35, 0.4, 0.2, 1.3, 0.25, tint, -s * 0.8);
        break;
      case 'guard':
        box(p, 0, 0, 0.4, 0.85, 1.2, 0.3, steel);
        glow(p, 0, 0, 0.6, 0.12, 0.85, 0.08, tint);
        break;
    }
  });
  const special = equipment[2],
    tint = ITEM_TINTS[special],
    mount = group(body, 0, 4.15, 2.05);
  mount.name = 'special:' + special;
  box(mount, 0, 0, 0, 1.1, 1.3, 0.45, dark);
  if (special === 'emp') {
    for (const s of [-1, 1]) {
      cyl(mount, s * 0.5, 0.6, 0, 0.17, 1.8, steel);
      for (let j = 0; j < 4; j++) ring(mount, s * 0.5, 0.1 + j * 0.28, 0, 0.24, tint, Math.PI / 2);
    }
    ring(mount, 0, 0, 0.3, 0.46, steel);
  }
  if (special === 'shield') {
    for (const s of [-1, 1]) fin(mount, s * 0.8, 0.4, 0, 0.25, 1.9, 0.45, steel, -s * 0.5);
    ring(mount, 0, 0, 0.3, 0.58, tint);
  }
  if (special === 'repair') {
    for (const s of [-1, 1]) {
      cyl(mount, s * 0.65, 0, 0, 0.22, 1.3, steel);
      glow(mount, s * 0.65, 0, 0.23, 0.17, 0.8, 0.08, tint);
    }
    box(mount, 0, 0, 0.31, 0.75, 0.25, 0.16, tint);
    box(mount, 0, 0, 0.32, 0.25, 0.75, 0.16, tint);
  }
  const beacon = orb(body, 0, 4.15, 2.45, 0.22, tint);
  beacon.name = 'special-beacon';
  const cargo = group(body, 0, 2.1, 2.25);
  cargo.name = 'carried-cell';
  cargo.visible = false;
  box(cargo, 0, 0, 0, 1.25, 1.8, 1.05, dark);
  for (const y of [-0.85, 0.85]) box(cargo, 0, y, 0, 1.5, 0.18, 1.25, steel);
  glow(cargo, 0, 0, 0.57, 0.9, 1.2, 0.1, '#abffd0');
  for (const x of [-0.55, 0.55]) box(cargo, x, 0, 0.65, 0.12, 1.65, 0.15, steel);
  return { beacon, cargo, special };
}

export function updateItemDetails(details, p, t, carrying = false) {
  if (!details) return;
  details.cargo.visible = p.hp > 0 && carrying;
  details.beacon.scale.setScalar(
    0.22 *
      (p.hp <= 0
        ? 0.2
        : p.active > 0
          ? 1.4 + (impactLevel() === 1 ? Math.sin(t * 5) * 0.15 : 0)
          : 1),
  );
}
