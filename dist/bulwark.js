import { chassisFor } from './chassis.js';
// An actively raised front plate covers 33.48 of 62 body-height units (54%).
export const BULWARK = {
  scale: 0.9,
  bottom: 13.86,
  top: 47.34,
  center: 30.6,
  width: 41.4,
  reduction: 0.8,
};
export function blocksBullet(p, b) {
  if (p.hp <= 0 || !p.guarding) return false;
  const scale = chassisFor(p.build).scale,
    angle = p.angle || 0,
    dx = (b.x - p.x) / scale,
    dy = (b.y - p.y) / scale,
    height = ((b.z ?? 38) - (p.altitude || 0)) / scale,
    length = Math.hypot(b.vx, b.vy, b.vz || 0);
  if (length < 0.001 || height < BULWARK.bottom || height > BULWARK.top) return false;
  const forward = dx * Math.cos(angle) + dy * Math.sin(angle),
    side = -dx * Math.sin(angle) + dy * Math.cos(angle),
    incoming = -(b.vx * Math.cos(angle) + b.vy * Math.sin(angle)) / length;
  return forward >= 15 && forward <= 36 && Math.abs(side) <= BULWARK.width / 2 && incoming > 0.25;
}
