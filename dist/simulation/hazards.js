// Schedule and resolve legacy encounter bombardment hazards.
import { dist, random } from './math.js';
import { effect } from './effects.js';
import { hurt } from './damage.js';

export function stepHazards(w, dt) {
  if (w.encounter && !w.operation && !w.siege) w.hazardTimer -= dt;
  if (w.hazardTimer <= 0 && w.encounter && !w.operation && !w.siege) {
    w.hazardTimer = 10;
    const p = w.players[Math.floor(random(w) * w.players.length)];
    w.hazards.push({ x: p.x, y: p.y, r: 110, time: 1.6 });
  }
  for (const h of w.hazards) {
    h.time -= dt;
    if (h.time <= 0) {
      for (const p of w.players)
        if (p.hp > 0 && (p.altitude || 0) < 90 && dist(p, h) < h.r) hurt(w, p, 75, h, 'blast');
      for (const e of w.enemies)
        if (!e.objective && (e.altitude || 0) < 90 && dist(e, h) < h.r) e.hp -= 200;
      effect(w, h.x, h.y, h.r, '#ff9166', 0.8);
    }
  }
  w.hazards = w.hazards.filter((h) => h.time > 0);
}
