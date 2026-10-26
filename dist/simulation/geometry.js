// Terrain surfaces, solid intersections and weapon line of sight.
import { obstacleSolid, structureBoxes, structureIntersects } from '../destruction.js';
import { nearbyObstacles, staticShotBlocked } from '../collision.js?v=41';
import { chassisBounds } from '../chassis.js';
import { muzzleOrigin } from '../weapon-origin.js?v=41';
import { inside, clamp, dist } from './math.js';

export function rampHeight(r, x, y) {
  const t = clamp((r.axis === 'x' ? x - r.x : y - r.y) / (r.axis === 'x' ? r.w : r.h), 0, 1);
  return r.z * (r.sign > 0 ? t : 1 - t);
}

export function surfaceAt(m, x, y, altitude = Infinity) {
  let z = 0;
  for (const original of m.obstacles)
    if (obstacleSolid(m, original))
      for (const o of structureBoxes(m, original))
        if (inside(o, x, y, 20) && (o.height || 100) <= altitude + 0.1)
          z = Math.max(z, o.height || 100);
  for (const p of m.platforms || [])
    if (inside(p, x, y) && p.z <= altitude + 12) z = Math.max(z, p.z);
  for (const r of m.ramps || [])
    if (inside(r, x, y)) {
      const h = rampHeight(r, x, y);
      if (h <= altitude + 12) z = Math.max(z, h);
    }
  return z;
}

export function blocked(w, x, y, r = 20, z = 0, height = 58, foot = 12) {
  return (
    nearbyObstacles(w.mission, x, y, r).some((o) =>
      structureIntersects(w.mission, o, x, y, z, r, height),
    ) ||
    (w.mission.platforms || []).some(
      (p) => inside(p, x, y, r) && z + foot < p.z && z + height > p.z - 8,
    ) ||
    (w.mission.ramps || []).some((p) => inside(p, x, y) && z + 12 < rampHeight(p, x, y))
  );
}

export function shotBlocked(m, x, y, z, r = 2) {
  return (
    nearbyObstacles(m, x, y, r).some((o) => structureIntersects(m, o, x, y, z, r)) ||
    (m.platforms || []).some((p) => inside(p, x, y, r) && z > p.z - 8 && z < p.z) ||
    (m.ramps || []).some((p) => inside(p, x, y, r) && z < rampHeight(p, x, y))
  );
}

export function launchPoint(w, p) {
  const end = muzzleOrigin(p),
    start = { x: p.x, y: p.y, z: chassisBounds(p.build).muzzleHeight + (p.altitude || 0) },
    steps = Math.max(
      1,
      Math.ceil(Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z) / 2),
    );
  for (let i = 0; i <= steps; i++) {
    const q = {
      x: start.x + ((end.x - start.x) * i) / steps,
      y: start.y + ((end.y - start.y) * i) / steps,
      z: start.z + ((end.z - start.z) * i) / steps,
    };
    if (shotBlocked(w.mission, q.x, q.y, q.z)) return { ...q, blocked: true };
  }
  return end;
}

export function clearPath(w, a, b, r = 2) {
  const m = w.mission,
    az = r <= 3 ? (a.z ?? (a.altitude || 0) + 32) : a.altitude || 0,
    bz = r <= 3 ? (b.z ?? (b.altitude || 0) + 32) : b.altitude || 0;
  if (r <= 3) {
    if (staticShotBlocked(m, { ...a, z: az }, { ...b, z: bz }, r)) return false;
    if (!m.ramps?.length) return true;
  }
  const n = Math.max(1, Math.ceil(dist(a, b) / (r <= 3 ? 4 : 22)));
  for (let i = 1; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n,
      y = a.y + ((b.y - a.y) * i) / n,
      z = az + ((bz - az) * i) / n;
    if (
      r <= 3
        ? (m.ramps || []).some((p) => inside(p, x, y, r) && z < rampHeight(p, x, y))
        : blocked(w, x, y, r, z)
    )
      return false;
  }
  return true;
}
