// Validate host-authoritative player input and apply requested field interactions.
import { RANGED } from '../catalog/weapons.js';
import { RACK_SIZE } from '../catalog/equipment.js';
import { chooseFieldModule, interactField } from '../sortie-progression.js';
import { clamp } from './math.js';

export function setInput(w, id, data) {
  const p = w.players.find((p) => p.id === id);
  if (!p || !data || typeof data !== 'object') return;
  if (data.upgrade) chooseFieldModule(w, p, data.upgrade);
  if (data.fieldAction) interactField(w, p, data.fieldAction);
  p.input = {
    x: Number.isFinite(data.x) ? clamp(data.x, -1, 1) : 0,
    y: Number.isFinite(data.y) ? clamp(data.y, -1, 1) : 0,
    angle: Number.isFinite(data.angle) ? data.angle : 0,
    pitch: Number.isFinite(data.pitch) ? clamp(data.pitch, -1.2, 1.2) : 0,
    leftPressed: !!data.leftPressed || !!p.input?.leftPressed,
    rightPressed: !!data.rightPressed || !!p.input?.rightPressed,
    left:
      data.left === undefined && data.right === undefined
        ? !!(RANGED[p.build.equipment[0]] ? data.fire : data.melee)
        : !!data.left,
    right:
      data.left === undefined && data.right === undefined
        ? !!(RANGED[p.build.equipment[1]] ? data.fire : data.melee)
        : !!data.right,
    dash: !!data.dash,
    sprint: !!data.sprint,
    aiming: !!data.aiming,
    fly: !!data.fly,
    fire: !!data.fire,
    melee: !!data.melee,
    ability: !!data.ability,
    auto: !!data.auto,
    aimPoint:
      data.aimPoint && ['x', 'y', 'z'].every((k) => Number.isFinite(data.aimPoint[k]))
        ? {
            x: clamp(data.aimPoint.x, p.x - 3000, p.x + 3000),
            y: clamp(data.aimPoint.y, p.y - 3000, p.y + 3000),
            z: clamp(data.aimPoint.z, -3000, 3000),
          }
        : null,
    slot:
      Number.isInteger(data.slot) && data.slot >= 0 && data.slot < RACK_SIZE
        ? data.slot
        : undefined,
  };
  p.lastInput = w.time;
}
