// Append a presentation event to the authoritative world.

export function effect(w, x, y, r, color, life = 0.5, kind = 'impact') {
  w.effects.push({ x, y, r, color, life, max: life, kind });
}
