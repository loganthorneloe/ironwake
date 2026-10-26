// Shared deterministic simulation math. Random state belongs to the supplied world.

export function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function random(w) {
  w.seed = (Math.imul(w.seed, 1664525) + 1013904223) >>> 0;
  return w.seed / 4294967296;
}

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const spatialDist = (a, b) =>
  Math.hypot(a.x - b.x, a.y - b.y, (a.altitude || 0) - (b.altitude || 0));

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const inside = (o, x, y, r = 0) =>
  x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h;
