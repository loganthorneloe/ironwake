import { nearbyObstacles } from './collision.js?v=41';
import {
  structureBoxes,
  structureFor,
  fractureLayout,
  DESTRUCTION_LIMITS,
  DESTRUCTION_MATERIALS,
} from './destruction.js';

// Presentation-only chunk physics. Fixed timestep, terrain/AABB collision,
// restitution, friction and sleeping; deliberately no quadratic chunk pairs.
export function createChunkPhysics(m) {
  const body = () => ({
    active: false,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    hx: 1,
    hy: 1,
    hz: 1,
    rx: 0,
    ry: 0,
    rz: 0,
    wx: 0,
    wy: 0,
    wz: 0,
    age: 0,
    material: 'concrete',
    bounce: 0.2,
  });
  const awake = Array.from({ length: DESTRUCTION_LIMITS.awake }, body),
    sleeping = Array.from({ length: DESTRUCTION_LIMITS.rubble }, body);
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    activeLimit = reduced ? 24 : DESTRUCTION_LIMITS.awake;
  let nextBody = 0,
    nextSleep = 0,
    lastEvent = 0,
    accumulator = 0,
    sleepRevision = 0;
  function settle(b) {
    const target = sleeping[nextSleep++ % sleeping.length];
    Object.assign(target, b);
    target.active = true;
    b.active = false;
    sleepRevision++;
  }
  function spawn(e, c, j, o) {
    const b = awake[nextBody++ % activeLimit],
      seed = e.id * 2.399 + j * 4.71,
      fall = e.kind === 'collapse' || e.kind === 'crumble';
    const x = c.x + c.w / 2,
      y = c.y + c.h / 2,
      z = ((c.baseZ || 0) + c.height) / 2;
    const dx = x - e.origin.x,
      dy = y - e.origin.y,
      dz = z - (e.origin.z || 0),
      length = Math.hypot(dx, dy, dz) || 1;
    b.active = true;
    b.x = x;
    b.y = y;
    b.z = z;
    b.hx = Math.max(1, c.w * 0.44);
    b.hy = Math.max(1, c.h * 0.44);
    b.hz = Math.max(1, (c.height - (c.baseZ || 0)) * 0.44);
    b.vx = (fall ? 0 : e.ix * 80 + (dx / length) * 55) + Math.sin(seed) * (fall ? 10 : 30);
    b.vy = (fall ? 0 : e.iy * 80 + (dy / length) * 55) + Math.cos(seed) * (fall ? 10 : 30);
    b.vz = fall ? 0 : 35 + Math.abs(Math.sin(seed * 3)) * 65 + Math.max(0, e.iz || 0) * 80;
    b.rx = b.ry = b.rz = 0;
    b.wx = reduced ? 0 : Math.sin(seed) * 2;
    b.wy = reduced ? 0 : Math.cos(seed * 2) * 2;
    b.wz = reduced ? 0 : Math.sin(seed * 3) * 2;
    b.age = 0;
    b.material = o.material;
    b.bounce = DESTRUCTION_MATERIALS[o.material].bounce;
  }
  function moveAxis(b, axis, dt) {
    const velocity = 'v' + axis,
      half = 'h' + axis,
      old = b[axis];
    b[axis] += b[velocity] * dt;
    let hit = false;
    if (axis === 'z' && b.z < b.hz) {
      b.z = b.hz;
      if (Math.abs(b.vz) < 25) b.vz = 0;
      else b.vz = -b.vz * b.bounce;
      hit = true;
    }
    for (const o of nearbyObstacles(m, b.x, b.y, Math.max(b.hx, b.hy) + 1))
      for (const c of structureBoxes(m, o)) {
        if (
          b.x + b.hx <= c.x ||
          b.x - b.hx >= c.x + c.w ||
          b.y + b.hy <= c.y ||
          b.y - b.hy >= c.y + c.h ||
          b.z + b.hz <= (c.baseZ || 0) ||
          b.z - b.hz >= c.height
        )
          continue;
        const min = axis === 'x' ? c.x : axis === 'y' ? c.y : c.baseZ || 0,
          max = axis === 'x' ? c.x + c.w : axis === 'y' ? c.y + c.h : c.height;
        // Resolve only actual crossings, not initial overlap at a fracture seam.
        if (old + b[half] <= min + 0.1 && b[velocity] > 0) {
          b[axis] = min - b[half] - 0.05;
          b[velocity] *= -b.bounce;
          hit = true;
        } else if (old - b[half] >= max - 0.1 && b[velocity] < 0) {
          b[axis] = max + b[half] + 0.05;
          b[velocity] *= -b.bounce;
          hit = true;
        }
      }
    return hit;
  }
  return {
    awake,
    sleeping,
    get sleepRevision() {
      return sleepRevision;
    },
    update(w, dt) {
      for (const e of w.destruction.events) {
        if (e.id <= lastEvent) continue;
        lastEvent = e.id;
        if (w.time - e.at > 0.7) continue;
        const o = structureFor(m, e.piece),
          cells = e.cells || [-1],
          layout = fractureLayout(m, e.piece),
          limit = Math.min(cells.length, 8);
        for (let j = 0; j < limit; j++) {
          const id = cells[Math.floor((j * cells.length) / limit)];
          if (id < 0) {
            for (let k = 0; k < 6; k++) {
              const base = (o.height - (o.baseZ || 0)) / 3;
              spawn(
                e,
                {
                  x: o.x + ((k % 2) * o.w) / 2,
                  y: o.y,
                  w: o.w / 2,
                  h: o.h / 2,
                  baseZ: (o.baseZ || 0) + Math.floor(k / 2) * base,
                  height: (o.baseZ || 0) + (Math.floor(k / 2) + 1) * base,
                },
                k,
                o,
              );
            }
          } else spawn(e, layout.cells[id], j, o);
        }
      }
      accumulator = Math.min(0.05, accumulator + Math.max(0, dt));
      let steps = 0;
      while (accumulator >= 1 / 60 && steps++ < 3) {
        accumulator -= 1 / 60;
        for (const b of awake) {
          if (!b.active) continue;
          b.age += 1 / 60;
          b.vz -= 320 / 60;
          b.vx *= 0.99;
          b.vy *= 0.99;
          const floor = moveAxis(b, 'z', 1 / 60);
          moveAxis(b, 'x', 1 / 60);
          moveAxis(b, 'y', 1 / 60);
          if (floor) {
            b.vx *= 0.72;
            b.vy *= 0.72;
            b.wx *= 0.62;
            b.wy *= 0.62;
            b.wz *= 0.62;
            b.rx *= 0.8;
            b.ry *= 0.8;
          }
          b.rx += b.wx / 60;
          b.ry += b.wy / 60;
          b.rz += b.wz / 60;
          if (
            floor &&
            b.age > 0.35 &&
            ((Math.hypot(b.vx, b.vy, b.vz) < 12 && Math.hypot(b.wx, b.wy, b.wz) < 1) || b.age > 5)
          )
            settle(b);
          else if (b.age > 8 || b.x < 0 || b.y < 0 || b.x > m.width || b.y > m.height)
            b.active = false;
        }
      }
    },
  };
}
