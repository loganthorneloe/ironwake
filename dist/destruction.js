import { createFractureLayout, boxTouches } from './fracture-layout.js';
// Authoritative holes and support; only bounded local debris uses physics.
export const DESTRUCTION_LIMITS = {
  events: 48,
  queue: 128,
  workPerStep: 12,
  awake: 64,
  rubble: 160,
};
export const DESTRUCTION_MATERIALS = {
  concrete: { hp: 144, color: '#a49b83', heat: 0.15, bounce: 0.22 },
  steel: { hp: 216, color: '#627f81', heat: 0.1, bounce: 0.35 },
  glass: { hp: 36, color: '#7cdad8', heat: 1, bounce: 0.12 },
  cargo: { hp: 96, color: '#bf8c56', heat: 0.5, bounce: 0.18 },
  fuel: { hp: 72, color: '#d86c42', heat: 1, bounce: 0.2 },
  support: { hp: 240, color: '#e6b05d', heat: 0.1, bounce: 0.25 },
};
const missions = new WeakMap(),
  wholeBoxes = new WeakMap(),
  CELL = 180,
  EMPTY = [];
const center = (o) => ({ x: o.x + o.w / 2, y: o.y + o.h / 2, z: ((o.baseZ || 0) + o.height) / 2 });
function indexFor(m) {
  let data = missions.get(m);
  if (data) return data;
  data = {
    state: null,
    grid: new Map(),
    dependents: new Map(),
    pieces: [],
    layouts: [],
    boxes: [],
    parents: [],
  };
  for (const o of m.obstacles) {
    if (o.breakable === undefined) continue;
    const id = o.breakable;
    data.pieces[id] = o;
    data.layouts[id] = createFractureLayout(o);
    for (let y = Math.floor(o.y / CELL); y <= Math.floor((o.y + o.h) / CELL); y++)
      for (let x = Math.floor(o.x / CELL); x <= Math.floor((o.x + o.w) / CELL); x++) {
        const key = x + ',' + y;
        if (!data.grid.has(key)) data.grid.set(key, []);
        data.grid.get(key).push(o);
      }
    for (const support of o.supports || []) {
      if (!data.dependents.has(support)) data.dependents.set(support, []);
      data.dependents.get(support).push(o);
    }
  }
  for (const o of data.pieces) {
    const parents =
      o.baseZ && !o.supports
        ? data.pieces.filter(
            (p) =>
              p !== o &&
              Math.abs(p.height - o.baseZ) < 0.1 &&
              p.x < o.x + o.w &&
              p.x + p.w > o.x &&
              p.y < o.y + o.h &&
              p.y + p.h > o.y,
          )
        : [];
    data.parents[o.breakable] = parents;
    for (const p of parents) {
      if (!data.dependents.has(p.breakable)) data.dependents.set(p.breakable, []);
      data.dependents.get(p.breakable).push(o);
    }
  }
  missions.set(m, data);
  return data;
}
export function bindDestruction(m, state) {
  if (m.destructible) indexFor(m).state = state;
}
export function destructionRevision(m) {
  return m.destructible ? indexFor(m).state?.revision || 0 : 0;
}
export function structureFor(m, id) {
  return indexFor(m).pieces[id];
}
export function fractureLayout(m, id) {
  return indexFor(m).layouts[id];
}
export function obstacleSolid(m, o) {
  return o.breakable === undefined || (indexFor(m).state?.hp[o.breakable] ?? 1) > 0;
}
export function structureBoxes(m, o) {
  if (!m.destructible || o.breakable === undefined) {
    let boxes = wholeBoxes.get(o);
    if (!boxes) wholeBoxes.set(o, (boxes = [o]));
    return boxes;
  }
  const data = indexFor(m),
    s = data.state,
    id = o.breakable;
  if (s?.hp[id] <= 0) return EMPTY;
  const cells = s?.cells[id];
  if (!cells) return data.layouts[id].whole;
  const cached = data.boxes[id];
  if (cached?.revision === s.revision && cached.state === s) return cached.boxes;
  const boxes = data.layouts[id].cells.filter((_, i) => cells[i] > 0);
  data.boxes[id] = { revision: s.revision, state: s, boxes };
  return boxes;
}
export function structureIntersects(m, o, x, y, z, r = 0, height = 0) {
  if (!m.destructible || o.breakable === undefined) return boxTouches(o, x, y, z, r, height);
  return structureBoxes(m, o).some((b) => boxTouches(b, x, y, z, r, height));
}
export function structureHasOpening(m, o) {
  const data = indexFor(m),
    s = data.state,
    cells = s?.cells[o.breakable];
  if (!cells) return s?.hp[o.breakable] <= 0;
  const thinX = o.w < o.h;
  for (const c of data.layouts[o.breakable].cells) {
    if (cells[c.id] > 0) continue;
    for (const f of [0.5, 1]) {
      const x = thinX ? o.x + o.w / 2 : c.x + c.w * f,
        y = thinX ? c.y + c.h * f : o.y + o.h / 2;
      if (
        (thinX ? y - o.y : x - o.x) < 21 ||
        (thinX ? o.y + o.h - y : o.x + o.w - x) < 21 ||
        c.baseZ + 58 > o.height
      )
        continue;
      if (!structureIntersects(m, o, x, y, c.baseZ + 0.1, 21, 58)) return true;
    }
  }
  return false;
}
export function initDestruction(w) {
  const pieces = indexFor(w.mission).pieces;
  w.destruction = {
    hp: pieces.map((o) => o.durability || DESTRUCTION_MATERIALS[o.material].hp),
    cells: {},
    severed: {},
    unstable: {},
    fractures: 0,
    revision: 0,
    destroyed: 0,
    events: [],
    pending: [],
    chains: 0,
    collapses: 0,
  };
  bindDestruction(w.mission, w.destruction);
}
export function nearbyStructures(m, x, y, r = 2) {
  if (!m.destructible) return EMPTY;
  const grid = indexFor(m).grid,
    found = new Set();
  for (let gy = Math.floor((y - r) / CELL); gy <= Math.floor((y + r) / CELL); gy++)
    for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++)
      for (const o of grid.get(gx + ',' + gy) || EMPTY) found.add(o);
  return [...found];
}
function queue(w, job) {
  if (w.destruction.pending.length >= DESTRUCTION_LIMITS.queue) return false;
  w.destruction.pending.push(job);
  return true;
}
const cellMax = (o) =>
  Math.max(12, Math.ceil((o.durability || DESTRUCTION_MATERIALS[o.material].hp) * 0.22));
function cellState(w, o) {
  return (w.destruction.cells[o.breakable] ??= fractureLayout(w.mission, o.breakable).cells.map(
    () => cellMax(o),
  ));
}
function emit(w, o, broken, kind, p) {
  const s = w.destruction;
  if (!broken.length) return;
  s.fractures += broken.length;
  const at = p || center(o),
    length = Math.hypot(at.vx || 0, at.vy || 0, at.vz || 0) || 1;
  s.events.push({
    id: w.id++,
    piece: o.breakable,
    ...center(o),
    at: w.time,
    kind,
    cells: broken,
    ix: (at.vx || 0) / length,
    iy: (at.vy || 0) / length,
    iz: (at.vz || 0) / length,
    origin: { x: at.x, y: at.y, z: at.z },
  });
  if (s.events.length > DESTRUCTION_LIMITS.events) s.events.shift();
}
function syncIntegrity(w, o) {
  const s = w.destruction,
    id = o.breakable,
    old = s.hp[id],
    cells = s.cells[id],
    max = o.durability || DESTRUCTION_MATERIALS[o.material].hp;
  s.hp[id] = Math.ceil((max * cells.reduce((sum, h) => sum + h, 0)) / (cells.length * cellMax(o)));
  s.revision++;
  if (old > 0 && s.hp[id] === 0) s.destroyed++;
}
function connected(w, o) {
  const data = indexFor(w.mission),
    s = w.destruction,
    id = o.breakable,
    layout = data.layouts[id],
    hp = cellState(w, o),
    seen = new Uint8Array(hp.length),
    todo = [];
  for (const c of layout.cells) {
    if (hp[c.id] <= 0) continue;
    const anchored = o.supports
      ? (c.cx === 0 || c.cy === 0 || c.cx === layout.nx - 1 || c.cy === layout.ny - 1) &&
        o.supports.some((i) => s.hp[i] > 0 && !s.severed[i])
      : c.cz === 0 &&
        (!o.baseZ ||
          data.parents[id].some((p) =>
            structureIntersects(w.mission, p, c.x + c.w / 2, c.y + c.h / 2, c.baseZ - 0.2),
          ));
    if (anchored) {
      seen[c.id] = 1;
      todo.push(c.id);
    }
  }
  for (let n = 0; n < todo.length; n++)
    for (const link of layout.neighbors[todo[n]])
      if (hp[link] > 0 && !seen[link]) {
        seen[link] = 1;
        todo.push(link);
      }
  return seen;
}
function supportCheck(w, o) {
  const s = w.destruction,
    id = o.breakable;
  if (o.explosive || s.hp[id] <= 0) return;
  const layout = fractureLayout(w.mission, id),
    hp = cellState(w, o),
    seen = connected(w, o);
  if (o.material === 'support' && !layout.cells.some((c) => c.cz === layout.nz - 1 && seen[c.id]))
    s.severed[id] = true;
  if (hp.some((h, i) => h > 0 && !seen[i])) s.unstable[id] = true;
}
function notifyDependents(w, o) {
  const s = w.destruction;
  for (const next of indexFor(w.mission).dependents.get(o.breakable) || EMPTY) {
    if (s.hp[next.breakable] <= 0) continue;
    if (next.supports && next.supports.every((i) => s.hp[i] <= 0 || s.severed[i])) {
      if (
        !s.pending.some((j) => j.piece === next.breakable) &&
        !queue(w, {
          at: w.time + 0.16 + (next.breakable % 4) * 0.03,
          kind: 'collapse',
          piece: next.breakable,
        })
      )
        s.unstable[next.breakable] = true;
    } else supportCheck(w, next);
  }
}
function afterDamage(w, o, broken, kind, p) {
  syncIntegrity(w, o);
  emit(w, o, broken, kind, p);
  if (broken.length) {
    supportCheck(w, o);
    notifyDependents(w, o);
  }
}
function atomicDamage(w, o, amount, kind, p) {
  const s = w.destruction,
    id = o.breakable;
  if (s.hp[id] <= 0) return 0;
  const applied = Math.min(s.hp[id], Math.max(0, Math.round(amount)));
  if (!applied) return 0;
  s.hp[id] -= applied;
  s.revision++;
  if (s.hp[id] > 0) return applied;
  s.destroyed++;
  emit(w, o, [-1], o.explosive ? 'fuel' : kind, p);
  if (o.explosive)
    queue(w, { at: w.time + 0.12, kind: 'blast', ...center(o), r: o.explosive, amount: 270 });
  notifyDependents(w, o);
  return applied;
}
export function damageStructureAt(w, p, amount, kind = 'hit') {
  if (!w.destruction) return 0;
  const o = nearbyStructures(w.mission, p.x, p.y, 3).find(
    (o) => obstacleSolid(w.mission, o) && structureIntersects(w.mission, o, p.x, p.y, p.z, 3),
  );
  if (!o) return 0;
  if (o.explosive) return atomicDamage(w, o, amount, kind, p);
  const hp = cellState(w, o),
    c = fractureLayout(w.mission, o.breakable).cells.find(
      (c) => hp[c.id] > 0 && boxTouches(c, p.x, p.y, p.z, 3),
    );
  if (!c) return 0;
  const hit = Math.min(
    hp[c.id],
    Math.max(
      0,
      Math.round(amount * (kind === 'flamer' ? DESTRUCTION_MATERIALS[o.material].heat : 1)),
    ),
  );
  if (!hit) return 0;
  hp[c.id] -= hit;
  afterDamage(w, o, hp[c.id] === 0 ? [c.id] : [], kind, p);
  return hit;
}
export function damageStructureArea(w, p, r, amount, kind = 'blast', angle = null, arc = Math.PI) {
  if (!w.destruction) return 0;
  let hits = 0;
  for (const o of nearbyStructures(w.mission, p.x, p.y, r)) {
    if (!obstacleSolid(w.mission, o)) continue;
    if (angle !== null) {
      const c = center(o),
        delta = Math.atan2(c.y - p.y, c.x - p.x) - angle;
      if (Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta))) > arc) continue;
    }
    const dist = (b) =>
      Math.hypot(
        Math.max(b.x - p.x, 0, p.x - b.x - b.w),
        Math.max(b.y - p.y, 0, p.y - b.y - b.h),
        Math.max((b.baseZ || 0) - (p.z || 0), 0, (p.z || 0) - b.height),
      );
    if (dist(o) > r) continue;
    if (o.explosive) {
      if (atomicDamage(w, o, amount * (1 - (0.55 * dist(o)) / Math.max(1, r)), kind, p)) hits++;
      continue;
    }
    const hp = cellState(w, o),
      broken = [];
    let applied = 0;
    for (const c of fractureLayout(w.mission, o.breakable).cells) {
      if (hp[c.id] <= 0) continue;
      const distance = dist(c);
      if (distance > r) continue;
      const hit = Math.min(
        hp[c.id],
        Math.max(
          0,
          Math.round(
            amount *
              (1 - (0.55 * distance) / Math.max(1, r)) *
              (kind === 'flamer' ? DESTRUCTION_MATERIALS[o.material].heat : 1),
          ),
        ),
      );
      if (!hit) continue;
      hp[c.id] -= hit;
      applied += hit;
      if (hp[c.id] === 0) broken.push(c.id);
    }
    if (applied) {
      hits++;
      afterDamage(w, o, broken, kind, p);
    }
  }
  return hits;
}
export function stepDestruction(w, onBlast = () => {}) {
  if (!w.destruction) return;
  bindDestruction(w.mission, w.destruction);
  const s = w.destruction;
  s.events = s.events.filter((e) => w.time - e.at < 2.4);
  let queued = 0;
  for (const id of Object.keys(s.unstable)) {
    if (queued >= DESTRUCTION_LIMITS.workPerStep) break;
    if (s.pending.some((j) => j.piece === Number(id))) continue;
    if (queue(w, { at: w.time + 0.06, kind: 'crumble', piece: Number(id) })) {
      delete s.unstable[id];
      queued++;
    }
  }
  let budget = DESTRUCTION_LIMITS.workPerStep;
  while (budget--) {
    const index = s.pending.findIndex((j) => j.at <= w.time);
    if (index < 0) break;
    const [job] = s.pending.splice(index, 1);
    if (job.kind === 'collapse' || job.kind === 'crumble') {
      const o = structureFor(w.mission, job.piece);
      if (!o || s.hp[job.piece] <= 0) continue;
      const hp = cellState(w, o),
        seen = job.kind === 'crumble' ? connected(w, o) : null,
        broken = [];
      for (let i = 0; i < hp.length; i++)
        if (hp[i] > 0 && (!seen || !seen[i])) {
          hp[i] = 0;
          broken.push(i);
        }
      if (broken.length) {
        afterDamage(w, o, broken, job.kind, null);
        s.collapses++;
      }
    } else {
      s.chains++;
      damageStructureArea(w, job, job.r, job.amount, 'blast');
      onBlast(job);
      w.effects.push({
        id: w.id++,
        x: job.x,
        y: job.y,
        z: job.z,
        r: job.r,
        kind: 'explosion',
        weapon: 'fuel',
        life: 0.8,
        max: 0.8,
      });
    }
  }
}
