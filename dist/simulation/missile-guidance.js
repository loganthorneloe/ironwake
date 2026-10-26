// Target selection and bounded steering for seeking projectiles.
import { clamp } from './math.js';
import { clearPath } from './geometry.js';

export function rocketTarget(w, origin, dir, range) {
  let target = null,
    best = 0.975;
  for (const e of w.enemies) {
    const dx = e.x - origin.x,
      dy = e.y - origin.y,
      dz = (e.altitude || 0) + 32 - origin.z,
      d = Math.hypot(dx, dy, dz),
      dot = (dx * dir.x + dy * dir.y + dz * dir.z) / (d || 1);
    if (e.hp > 0 && d < range && dot > best && clearPath(w, origin, e)) {
      target = e.id;
      best = dot;
    }
  }
  return target;
}

export function guideRocket(w, b, dt) {
  if (b.seekTarget == null) return;
  const e = w.enemies.find((e) => e.id === b.seekTarget && e.hp > 0);
  if (!e || !clearPath(w, b, e)) {
    b.seekTarget = null;
    return;
  }
  const speed = Math.hypot(b.vx, b.vy, b.vz || 0),
    dx = e.x - b.x,
    dy = e.y - b.y,
    dz = (e.altitude || 0) + 32 - b.z,
    d = Math.hypot(dx, dy, dz),
    dot = (dx * b.vx + dy * b.vy + dz * (b.vz || 0)) / (d * speed || 1);
  if (dot < 0.5) {
    b.seekTarget = null;
    return;
  }
  const angle = Math.acos(clamp(dot, -1, 1)),
    mix = Math.min(1, (dt * 1.2) / Math.max(angle, 0.0001)),
    vx = (b.vx / speed) * (1 - mix) + (dx / d) * mix,
    vy = (b.vy / speed) * (1 - mix) + (dy / d) * mix,
    vz = ((b.vz || 0) / speed) * (1 - mix) + (dz / d) * mix,
    n = Math.hypot(vx, vy, vz);
  b.vx = (vx / n) * speed;
  b.vy = (vy / n) * speed;
  b.vz = (vz / n) * speed;
}
