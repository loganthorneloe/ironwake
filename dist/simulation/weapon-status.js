// Projectile impact traits and finite weapon status effects.
import { WEAPONS } from '../catalog/weapons.js';
import { fieldModifiers } from '../sortie-progression.js';
import { fieldArea } from '../field-combat.js';
import { dist } from './math.js';
import { clearPath } from './geometry.js';
import { move } from './movement.js';
import { damageEnemy, staggerEnemy } from './damage.js';

export function weaponHit(w, b, e) {
  const gun = WEAPONS[b.kind],
    height = e.bodyHeight ?? (e.type === 'boss' ? 108 : e.type === 'tank' ? 75 : 58),
    critical = gun?.precision && b.z >= (e.altitude || 0) + height * 0.78;
  damageEnemy(
    w,
    e,
    b.damage * (critical ? gun.precision : 1),
    b.owner,
    critical ? 'precision' : b.kind || 'hit',
  );
  if (b.kind === 'rail') staggerEnemy(w, e, 0.22);
  if (b.kind === 'scatter' && dist(b.origin || b, e) < 180 && e.scatterSalvo !== b.salvo) {
    e.scatterSalvo = b.salvo;
    staggerEnemy(w, e, 0.2);
    if (!e.training && !e.objective) {
      const d = Math.hypot(b.vx, b.vy) || 1;
      move(w, e, (b.vx / d) * 28, (b.vy / d) * 28, 1, e.r);
    }
  }
  if (b.kind === 'plasma') {
    e.plasmaHits = (w.time < (e.plasmaUntil || 0) ? e.plasmaHits || 0 : 0) + 1;
    e.plasmaUntil = w.time + 1.5;
    if (e.plasmaHits >= 4) {
      e.plasmaHits = 0;
      const at = { x: e.x, y: e.y, z: (e.altitude || 0) + 32 },
        radius = 150 * fieldArea(fieldModifiers(w.players.find((p) => p.id === b.owner)));
      w.effects.push({
        id: w.id++,
        ...at,
        r: radius,
        kind: 'explosion',
        weapon: 'plasma',
        life: 0.65,
        max: 0.65,
      });
      for (const other of w.enemies)
        if (
          other.hp > 0 &&
          Math.hypot(other.x - at.x, other.y - at.y, (other.altitude || 0) + 32 - at.z) < radius &&
          clearPath(w, at, other)
        ) {
          damageEnemy(w, other, 36, b.owner, 'overload');
          staggerEnemy(w, other, 0.3);
        }
    }
  }
}

export function stepWeaponStatus(w, e) {
  if (e.hp <= 0) {
    e.burnUntil = 0;
    e.burnNext = null;
    e.plasmaHits = 0;
    return;
  }
  if (w.time >= (e.plasmaUntil || 0)) e.plasmaHits = 0;
  while (
    e.burnNext != null &&
    e.burnNext <= w.time + 1e-9 &&
    e.burnNext <= (e.burnUntil || 0) + 1e-9 &&
    e.hp > 0
  ) {
    damageEnemy(w, e, 6, e.burnOwner, 'burn');
    e.burnNext += 0.25;
  }
  if (w.time >= (e.burnUntil || 0)) {
    e.burnUntil = 0;
    e.burnNext = null;
  }
}

export function bulletTouches(w, b, e) {
  if (b.kind !== 'bladeWave') return dist(e, b) < e.r + 4;
  const length = Math.hypot(b.vx, b.vy) || 1,
    dx = e.x - b.x,
    dy = e.y - b.y;
  return (
    Math.abs((dx * b.vx + dy * b.vy) / length) < e.r + 8 &&
    Math.abs((-dx * b.vy + dy * b.vx) / length) < e.r + b.width &&
    clearPath(w, b.origin, e)
  );
}
