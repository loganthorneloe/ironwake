// Coordinate enemies, finish landings, update practice rivals and advance role behavior.
import { coordinateEnemies } from '../enemy-coordination.js';
import { stepEnemy, stepEnemyHazards } from '../enemy-behaviors.js';
import { chassisBounds } from '../chassis.js';
import { dist } from './math.js';
import { surfaceAt, clearPath } from './geometry.js';
import { moveEnemy } from './movement.js';
import { waypoint } from './navigation.js';
import { hurt } from './damage.js';
import { stepWeaponStatus } from './weapon-status.js';
import { stepRival } from './rival.js';

const enemyAPI = {
  move: moveEnemy,
  waypoint,
  clear: clearPath,
  hurt,
  floor: (w, x, y, z) => surfaceAt(w.mission, x, y, z),
  aimHeight: (p) => chassisBounds(p.build).aimHeight,
};
export function stepEnemies(w, dt) {
  coordinateEnemies(w);
  for (const e of w.enemies) {
    stepWeaponStatus(w, e);
    if (e.objective) continue;
    if (e.landing) {
      e.altitude = Math.max(surfaceAt(w.mission, e.x, e.y, e.altitude), e.altitude - 340 * dt);
      if (e.altitude <= surfaceAt(w.mission, e.x, e.y, e.altitude) + 0.1) {
        e.landing = false;
        e.landedAt = w.time;
        e.cd = 1.4;
        w.effects.push({
          id: w.id++,
          kind: 'explosion',
          weapon: 'landing',
          x: e.x,
          y: e.y,
          z: e.altitude + 3,
          r: 200,
          life: 1.2,
          max: 1.2,
        });
        for (const p of w.players)
          if (p.hp > 0 && dist(p, e) < 170 && Math.abs((p.altitude || 0) - e.altitude) < 70)
            hurt(w, p, 70, e, 'blast');
      }
      continue;
    }
    if (e.type === 'rival') {
      stepRival(w, e, dt);
      continue;
    }
    if (e.training) {
      e.stun = Math.max(0, e.stun - dt);
      if (e.hp <= 0 && e.respawn != null) {
        e.respawn = Math.max(0, e.respawn - dt);
        if (e.respawn === 0) {
          e.hp = e.max;
          e.respawn = null;
        }
      }
      continue;
    }
    stepEnemy(w, e, dt, enemyAPI);
  }
  stepEnemyHazards(w, dt, enemyAPI);
}
