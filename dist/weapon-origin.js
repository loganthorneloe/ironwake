import { chassisBounds, chassisFor } from './chassis.js';
import { Vector3, Matrix4, Quaternion, Euler } from './vendor/three.module.min.js';
import { partChassis } from './part-designs.js';
// Barrel endpoints are shared by weapon meshes and authoritative firing.
export const MUZZLES = {
  dynamo: [0, 0.1, -3.15],
  flamer: [0, 0.1, -2.85],
  carbine: [0, 0.05, -2.76],
  scatter: [0, 0.12, -2.98],
  rail: [0, 0.1, -4.3],
  launcher: [0, 0.25, -2.5],
  plasma: [0, 0.1, -2.7],
  rotary: [0, 0.1, -3.2],
  phaser: [0, 0.1, -2.6],
};
const one = new Vector3(1, 1, 1);
const transform = (position, rotation, scale = 1) =>
  new Matrix4().compose(
    new Vector3(...position),
    new Quaternion().setFromEuler(new Euler(...rotation)),
    one.clone().multiplyScalar(scale),
  );
export function muzzleOrigin(p, weapon = p.weapon || p.build?.weapon) {
  const parts = p.build?.parts || {},
    preset =
      p.build?.frame === 'scout' ? 'light' : p.build?.frame === 'bulwark' ? 'heavy' : 'standard',
    torso = partChassis('torso', parts.torso, chassisFor(p.build).parts?.torso || preset),
    arms = partChassis('arms', parts.arms, chassisFor(p.build).parts?.arms || preset),
    width = torso === 'heavy' ? 1.65 : torso === 'light' ? 1.1 : 1.35,
    scale = arms === 'heavy' ? 1.1 : arms === 'light' ? 0.78 : 1;
  const root = transform(
    [p.x * 0.1, (p.altitude || 0) * 0.1 + (p.boosting || p.airborne ? 0.65 : 0), p.y * 0.1],
    [0, -(p.angle || 0) - Math.PI / 2, 0],
    chassisBounds(p.build).scale,
  );
  const side = p.hand === 0 ? -1 : 1;
  const mount = root
    .clone()
    .multiply(transform([side * (width + 0.1), 4.15, 0], [0.35, 0, side * 0.12], scale))
    .multiply(transform([0, -0.95, 0], [0.85, 0, 0]));
  const gun = mount.clone().multiply(transform([0, -0.85, -0.4], [-1.2 + (p.pitch || 0), 0, 0]));
  const q = new Vector3(...(MUZZLES[weapon] || MUZZLES.carbine)).applyMatrix4(gun);
  return { x: q.x * 10, y: q.z * 10, z: q.y * 10 };
}
export function firingDirection(p, origin) {
  const target = p.aimPoint;
  if (target) {
    const dx = target.x - origin.x,
      dy = target.y - origin.y,
      dz = target.z - origin.z,
      length = Math.hypot(dx, dy, dz);
    if (length > 1) return { x: dx / length, y: dy / length, z: dz / length };
  }
  const pitch = p.pitch || 0;
  return {
    x: Math.cos(p.angle || 0) * Math.cos(pitch),
    y: Math.sin(p.angle || 0) * Math.cos(pitch),
    z: Math.sin(pitch),
  };
}
// Freeze a launch correction once. It must never follow the moving shooter or a switched gun.
export function launchCorrection(muzzle, bullet) {
  return bullet.origin
    ? {
        x: muzzle.x - bullet.origin.x,
        y: muzzle.y - bullet.origin.y,
        z: muzzle.z - bullet.origin.z,
      }
    : { x: 0, y: 0, z: 0 };
}
export function correctedProjectile(b, offset) {
  const travelled = b.origin
      ? Math.hypot(b.x - b.origin.x, b.y - b.origin.y, (b.z || 0) - b.origin.z)
      : 160,
    blend = Math.max(0, 1 - travelled / 160);
  return {
    x: b.x + (offset?.x || 0) * blend,
    y: b.y + (offset?.y || 0) * blend,
    z: (b.z ?? 38) + (offset?.z || 0) * blend,
  };
}
