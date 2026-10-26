import * as T from './vendor/three.module.min.js';
import { surfaceAt, rampHeight } from './simulation/geometry.js';
import { chassisFor } from './chassis.js';
import { obstacleSolid, structureBoxes } from './destruction.js';
import { createSurfacePool, surfaceMask } from './surface-pool.js';

export const GROUND_CONTACT_LIMIT = 52; // Four pilots and the existing 48-combatant ceiling.
const inside = (o, x, y) => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h;
export function contactSample(m, x, y, altitude = 0, radius = 2) {
  let height = 0;
  const normal = new T.Vector3(0, 1, 0),
    supports = [];
  // Exact footprints avoid projecting onto the movement system's padded cover edges.
  for (const original of m.obstacles || [])
    if (obstacleSolid(m, original)) {
      for (const o of structureBoxes(m, original))
        if (inside(o, x, y) && o.height <= altitude + 0.1) {
          height = Math.max(height, o.height);
          supports.push(o);
        }
    }
  for (const p of m.platforms || [])
    if (inside(p, x, y) && p.z <= altitude + 12) {
      height = Math.max(height, p.z);
      supports.push(p);
    }
  for (const r of m.ramps || [])
    if (inside(r, x, y) && rampHeight(r, x, y) <= altitude + 12)
      height = Math.max(height, rampHeight(r, x, y));
  let clearance = Infinity;
  for (const p of supports) {
    if (!inside(p, x, y) || Math.abs((p.z ?? p.height) - height) > 0.1) continue;
    clearance = Math.min(clearance, x - p.x, p.x + p.w - x, y - p.y, p.y + p.h - y);
  }
  for (const ramp of m.ramps || [])
    if (inside(ramp, x, y) && Math.abs(rampHeight(ramp, x, y) - height) < 0.1) {
      const slope = (ramp.z * (ramp.sign > 0 ? 1 : -1)) / (ramp.axis === 'x' ? ramp.w : ramp.h);
      normal.set(ramp.axis === 'x' ? -slope : 0, 1, ramp.axis === 'x' ? 0 : -slope).normalize();
      clearance = Math.min(
        clearance,
        x - ramp.x,
        ramp.x + ramp.w - x,
        y - ramp.y,
        ramp.y + ramp.h - y,
      );
    }
  const lift = Math.max(0, altitude - height) * 0.1;
  return {
    height,
    normal,
    radius: Math.min(radius * (1 + lift * 0.035), clearance * 0.1),
    strength: 0.3 * Math.exp(-lift / 13),
  };
}

export function createGroundContact(parent, budget) {
  const root = new T.Group();
  root.name = 'surface response';
  parent.add(root);
  const soft = surfaceMask(),
    burn = surfaceMask(true),
    contacts = createSurfacePool(root, GROUND_CONTACT_LIMIT, soft, '#101c24'),
    scorch = createSurfacePool(root, budget.scorch, burn, '#251e22'),
    marks = [],
    seen = new Map();
  let previous = -Infinity;
  return {
    root,
    contacts: contacts.mesh,
    scorch: scorch.mesh,
    update(w, reduced = false) {
      if (w.time < previous) {
        marks.length = 0;
        seen.clear();
      }
      previous = w.time;
      contacts.begin();
      for (const list of [w.players || [], w.enemies || []])
        for (const p of list) {
          if (p.hp <= 0) continue;
          const radius = p.build
            ? 2.2 * chassisFor(p.build).scale
            : Math.max(0.8, Math.min(6, (p.r || 18) * 0.1));
          const s = contactSample(w.mission, p.x, p.y, p.altitude || 0, radius);
          contacts.put(
            p.x * 0.1,
            s.height * 0.1 + 0.055,
            p.y * 0.1,
            s.radius,
            s.strength,
            0,
            s.normal,
          );
        }
      contacts.end();
      for (const [id, at] of seen) if (w.time - at > 15) seen.delete(id);
      for (const e of w.effects || []) {
        if (e.kind !== 'explosion' || e.weapon === 'landing' || e.id == null) continue;
        if (seen.has(e.id)) continue;
        seen.set(e.id, w.time);
        if (seen.size > 128) seen.delete(seen.keys().next().value);
        const radius = Math.min(6, Math.max(0.8, (e.r || 12) * 0.045)),
          z = e.z || 0;
        const s = contactSample(w.mission, e.x, e.y, z, radius);
        // Restrict broad marks to clear, flat floors. Never float a quad over a ramp/cover edge.
        if (
          s.height !== 0 ||
          z > Math.min(60, Math.max(18, (e.r || 12) * 0.6)) ||
          s.normal.y < 0.999
        )
          continue;
        const footprint = radius * 10;
        if (
          (w.mission.obstacles || []).some(
            (o) =>
              obstacleSolid(w.mission, o) &&
              structureBoxes(w.mission, o).some(
                (b) =>
                  e.x + footprint >= b.x &&
                  e.x - footprint <= b.x + b.w &&
                  e.y + footprint >= b.y &&
                  e.y - footprint <= b.y + b.h,
              ),
          )
        )
          continue;
        const corners = [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ];
        if (
          corners.some(
            ([x, y]) => surfaceAt(w.mission, e.x + x * radius * 10, e.y + y * radius * 10) !== 0,
          )
        )
          continue;
        marks.push({
          x: e.x * 0.1,
          z: e.y * 0.1,
          radius,
          at: w.time,
          angle: (Number(e.id) || 0) * 2.4,
        });
        if (marks.length > budget.scorch) marks.shift();
      }
      while (marks.length && w.time - marks[0].at > 14) marks.shift();
      scorch.begin();
      // Reduced keeps brief, quiet grounding without extra moving combat accents.
      for (const mark of marks.slice(-(reduced ? 4 : budget.scorch))) {
        const age = w.time - mark.at,
          fade = Math.min(1, age / 0.35) * Math.min(1, (14 - age) / 4);
        scorch.put(
          mark.x,
          0.065,
          mark.z,
          mark.radius,
          Math.max(0, fade) * (reduced ? 0.16 : 0.28),
          mark.angle,
        );
      }
      scorch.end();
    },
    stats() {
      return {
        contacts: contacts.mesh.count,
        scorch: scorch.mesh.count,
        marks: marks.length,
        seen: seen.size,
      };
    },
    dispose() {
      contacts.dispose();
      scorch.dispose();
      soft.dispose();
      burn.dispose();
      root.removeFromParent();
      marks.length = 0;
      seen.clear();
    },
  };
}

export function createPracticalPools(parent, lights) {
  const mask = surfaceMask(),
    pool = createSurfacePool(parent, lights.length, mask, '#ffd6a0', true);
  pool.begin();
  for (const light of lights)
    pool.put(light.x, light.y || 0.09, light.z, light.radius || 4, light.strength || 0.12);
  pool.end();
  return {
    mesh: pool.mesh,
    dispose() {
      pool.dispose();
      mask.dispose();
    },
  };
}
