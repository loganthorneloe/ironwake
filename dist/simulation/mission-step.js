// Advance operation directors and apply demolition fuel explosions.
import { stepOperation } from '../planet-mission.js?v=41';
import { stepDestructionMission } from '../destruction-mission.js';
import { statsForPlayer } from '../builds/combat-stats.js';
import { clearPath } from './geometry.js';
import { damageEnemy, hurt } from './damage.js';

export function stepMission(w, dt) {
  if (w.operation) stepOperation(w, dt, statsForPlayer);
  if (w.siege)
    stepDestructionMission(w, dt, statsForPlayer, (event) => {
      for (const e of w.enemies) {
        const d = Math.hypot(e.x - event.x, e.y - event.y, (e.altitude || 0) + 32 - event.z);
        if (e.hp > 0 && d < event.r && clearPath(w, event, e))
          damageEnemy(w, e, 180 * (1 - d / event.r), null, 'fuel');
      }
      if (w.mission.variant === 'level')
        for (const p of w.players) {
          const d = Math.hypot(p.x - event.x, p.y - event.y, (p.altitude || 0) + 32 - event.z);
          if (p.hp > 0 && d < event.r && clearPath(w, event, p)) hurt(w, p, 65 * (1 - d / event.r));
        }
    });
}
