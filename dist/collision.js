import { obstacleSolid, destructionRevision, structureBoxes } from './destruction.js';
// Static mission geometry is indexed once, never serialized into co-op snapshots.
const grids = new WeakMap(),
  CELL = 256,
  EMPTY = [];
function liveCell(m, cached, key) {
  const list = cached.grid.get(key) || EMPTY;
  if (!m.destructible || !list.length) return list;
  const revision = destructionRevision(m);
  if (cached.revision !== revision) {
    cached.revision = revision;
    cached.live = new Map();
  }
  let live = cached.live.get(key);
  if (!live) {
    live = list.filter((o) => obstacleSolid(m, o));
    cached.live.set(key, live);
  }
  return live;
}
export function nearbyObstacles(m, x, y, r = 2) {
  let cached = grids.get(m),
    grid = cached?.grid;
  if (!cached || cached.source !== m.obstacles || cached.length !== m.obstacles.length) {
    grid = new Map();
    for (const o of m.obstacles) {
      for (let gy = Math.floor(o.y / CELL); gy <= Math.floor((o.y + o.h) / CELL); gy++)
        for (let gx = Math.floor(o.x / CELL); gx <= Math.floor((o.x + o.w) / CELL); gx++) {
          const k = gx + ',' + gy;
          let list = grid.get(k);
          if (!list) grid.set(k, (list = []));
          list.push(o);
        }
    }
    grids.set(m, { grid, source: m.obstacles, length: m.obstacles.length });
  }
  const x0 = Math.floor((x - r) / CELL),
    x1 = Math.floor((x + r) / CELL),
    y0 = Math.floor((y - r) / CELL),
    y1 = Math.floor((y + r) / CELL);
  cached = grids.get(m);
  if (x0 === x1 && y0 === y1) return liveCell(m, cached, x0 + ',' + y0);
  const found = [];
  for (let gy = y0; gy <= y1; gy++)
    for (let gx = x0; gx <= x1; gx++)
      for (const o of liveCell(m, cached, gx + ',' + gy)) if (!found.includes(o)) found.push(o);
  return found;
}
// Exact segment/AABB clipping prevents thin walls being skipped by fast projectiles.
export function segmentHitsBox(a, b, o, r = 2, minZ = -Infinity, maxZ = o.height || 100) {
  let enter = 0,
    leave = 1;
  for (const [start, end, min, max] of [
    [a.x, b.x, o.x - r, o.x + o.w + r],
    [a.y, b.y, o.y - r, o.y + o.h + r],
    [a.z, b.z, minZ, maxZ],
  ]) {
    const d = end - start;
    if (Math.abs(d) < 1e-9) {
      if (start < min || start > max) return false;
      continue;
    }
    let t0 = (min - start) / d,
      t1 = (max - start) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    enter = Math.max(enter, t0);
    leave = Math.min(leave, t1);
    if (enter > leave) return false;
  }
  return leave > 0 && enter <= 1;
}
export function staticShotBlocked(m, a, b, r = 2) {
  return (
    m.obstacles.some(
      (o) =>
        obstacleSolid(m, o) &&
        (m.destructible
          ? structureBoxes(m, o).some((c) => segmentHitsBox(a, b, c, r, c.baseZ ?? -Infinity))
          : segmentHitsBox(a, b, o, r, o.baseZ ?? -Infinity)),
    ) || (m.platforms || []).some((p) => segmentHitsBox(a, b, p, r, p.z - 8, p.z))
  );
}
