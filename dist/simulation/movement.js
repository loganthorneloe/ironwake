// World movement preserves grounded steps, live fragment collision and flying clearance.
import { chassisBounds } from '../chassis.js';
import { nearbyObstacles } from '../collision.js?v=41';
import { inside, clamp } from './math.js';
import { surfaceAt, blocked } from './geometry.js';

export function move(w, p, vx, vy, dt, r) {
  const bounds = chassisBounds(p.build);
  if (['sandbox', 'trial'].includes(w.mission.mode)) {
    p.x += vx * dt;
    p.y += vy * dt;
    return;
  }
  const grounded = (p.altitude || 0) <= surfaceAt(w.mission, p.x, p.y, p.altitude || 0) + 0.5;
  const attempt = (x, y) => {
    const current = p.altitude || 0,
      surface = surfaceAt(w.mission, x, y, current),
      z = grounded && Math.abs(surface - current) <= 14 ? surface : current;
    if (!blocked(w, x, y, r, z, bounds.clearance, 12 * bounds.scale)) {
      p.x = x;
      p.y = y;
      p.altitude = z;
    }
  };
  attempt(clamp(p.x + vx * dt, r, w.mission.width - r), p.y);
  attempt(p.x, clamp(p.y + vy * dt, r, w.mission.height - r));
}

export function moveEnemy(w, e, vx, vy, dt, r) {
  const crosses = (x, y) =>
    !e.hover &&
    !w.mission.destructible &&
    nearbyObstacles(w.mission, x, y, r).some((o) => inside(o, x, y, r) && !inside(o, e.x, e.y, r));
  if (!crosses(e.x + vx * dt, e.y)) move(w, e, vx, 0, dt, r);
  if (!crosses(e.x, e.y + vy * dt)) move(w, e, 0, vy, dt, r);
}
