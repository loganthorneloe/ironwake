// Workshop hardware statistics and deployment fit checks. Progression never changes build validity.
import { applyChassisStats } from '../chassis.js';
import { PARTS } from '../catalog/parts.js';
import { EQUIPMENT } from '../catalog/equipment.js';
import { partsFor, equipmentFor } from './loadout.js';

export function mechStats(b = {}) {
  const parts = partsFor(b),
    p = Object.fromEntries(Object.keys(parts).map((slot) => [slot, PARTS[slot][parts[slot]]]));
  const frameWeight = Object.values(p).reduce((n, v) => n + v.weight, 0),
    equipmentWeight = equipmentFor(b).reduce((n, id) => n + (EQUIPMENT[id]?.weight || 0), 0),
    weight = frameWeight + equipmentWeight,
    capacity = p.booster.capacity;
  const hp = Object.values(p).reduce((n, v) => n + (v.hp || 0), 0),
    speed = Math.round(Math.max(200, Math.min(370, 390 + p.legs.drive - weight * 1.8))),
    lift = Math.round(Math.max(100, p.booster.force - weight * 1.65));
  return applyChassisStats(
    {
      hp,
      speed,
      walkSpeed: Math.round(speed * 0.24),
      lift,
      weight,
      frameWeight,
      equipmentWeight,
      power: weight,
      capacity,
      output: capacity,
      energy: p.booster.energy,
      recharge: p.booster.recharge,
      boost: 1.45 + p.booster.force / 1000,
      flightCost: 0,
      boostCost: 0,
      dodge: Math.max(2.8, 3.8 - weight / 120),
      weightClass: weight <= 42 ? 'LIGHT' : weight <= 70 ? 'MEDIUM' : 'HEAVY',
      valid: weight <= capacity,
    },
    b,
    equipmentFor(b),
  );
}

export const cost = (b) => mechStats(b).power;

export const validBuild = (b) => mechStats(b).valid;
