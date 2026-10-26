// Enemy route selection and obstacle-aware waypoint search.
import { clamp, dist } from './math.js';
import { blocked, clearPath } from './geometry.js';

export function routeWaypoint(m, e, target) {
  const spine = m.spine;
  if (!spine) return target;
  const project = (p) => {
    let best = Infinity,
      index = 0;
    for (let i = 1; i < spine.length; i++) {
      const a = spine[i - 1],
        b = spine[i],
        dx = b.x - a.x,
        dy = b.y - a.y,
        t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy), 0, 1),
        d = Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
      if (d < best) {
        best = d;
        index = i - 1;
      }
    }
    return index;
  };
  const from = project(e),
    to = project(target);
  if (from === to) return target;
  return spine[from + (to > from ? 1 : 0)];
}

export function waypoint(w, e, target) {
  if (w.mission.mode === 'operation') {
    if (clearPath(w, e, target, e.r + 2)) return target;
    const route = routeWaypoint(w.mission, e, target);
    if (dist(e, route) > 70 && clearPath(w, e, route, e.r + 2)) return route;
    const a = Math.atan2(target.y - e.y, target.x - e.x);
    for (const sign of [1, -1]) {
      const p = {
        x: e.x + Math.cos(a + sign * 1.2) * 140,
        y: e.y + Math.sin(a + sign * 1.2) * 140,
        altitude: e.altitude,
      };
      if (clearPath(w, e, p, e.r + 2)) return p;
    }
    return { x: e.x, y: e.y };
  }
  if (clearPath(w, e, target, e.r + 2)) return target;
  if (e.routeUntil > w.time && e.route?.length) {
    while (e.route.length > 1 && dist(e, e.route[0]) < 20) e.route.shift();
    return e.route[0];
  }
  e.routeUntil = w.time + 1;
  const size = 60,
    cols = Math.ceil(w.mission.width / size),
    rows = Math.ceil(w.mission.height / size),
    sx = clamp(Math.floor(e.x / size), 0, cols - 1),
    sy = clamp(Math.floor(e.y / size), 0, rows - 1),
    goal = {
      x: clamp(Math.floor(target.x / size), 0, cols - 1),
      y: clamp(Math.floor(target.y / size), 0, rows - 1),
    },
    start = sy * cols + sx,
    open = [{ x: sx, y: sy, g: 0, f: 0, id: start }],
    seen = new Map([[start, { g: 0, parent: -1 }]]);
  let end = -1,
    tries = 0;
  while (open.length && tries++ < cols * rows) {
    open.sort((a, b) => b.f - a.f);
    const a = open.pop();
    if (a.x === goal.x && a.y === goal.y) {
      end = a.id;
      break;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const x = a.x + dx,
        y = a.y + dy,
        id = y * cols + x;
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const pt = { x: x * size + 30, y: y * size + 30 },
        from = { x: a.x * size + 30, y: a.y * size + 30 };
      if (blocked(w, pt.x, pt.y, e.r + 3) || !clearPath(w, from, pt, e.r + 3)) continue;
      const g = a.g + Math.hypot(dx, dy);
      if (seen.has(id) && seen.get(id).g <= g) continue;
      seen.set(id, { g, parent: a.id });
      open.push({ x, y, id, g, f: g + Math.hypot(goal.x - x, goal.y - y) });
    }
  }
  if (end >= 0) {
    const route = [];
    let id = end;
    while (id !== start && id >= 0) {
      route.unshift({ x: (id % cols) * size + 30, y: Math.floor(id / cols) * size + 30 });
      id = seen.get(id).parent;
    }
    while (route.length > 1 && clearPath(w, e, route[1], e.r + 3)) route.shift();
    e.route = route;
    return route[0] || target;
  }
  e.route = null;
  return target;
}
