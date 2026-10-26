// Permanent career training composes with temporary field hardware after workshop statistics.
import { chassisIdFor } from '../chassis.js';
import {
  cleanDeploymentProgression,
  progressionModifiers,
  applyProgressionStats,
} from '../career-progression.js';
import { fieldModifiers } from '../sortie-progression.js';
import { fieldRate } from '../field-combat.js';
import { mechStats } from './stats.js';

const careerModifierCache = new WeakMap();

export function freezeDeploymentProgression(value, chassisId) {
  const clean = cleanDeploymentProgression(value, chassisId);
  Object.freeze(clean.mech);
  Object.freeze(clean.pilot);
  return Object.freeze(clean);
}

export function careerModifiers(p) {
  const progression = p?.progression,
    chassis = chassisIdFor(p?.build);
  // Only immutable host-sanitized ranks can be cached; mutable snapshots are validated again.
  if (
    progression &&
    Object.isFrozen(progression) &&
    Object.isFrozen(progression.mech) &&
    Object.isFrozen(progression.pilot)
  ) {
    const cached = careerModifierCache.get(progression);
    if (cached?.chassis === chassis) return cached.modifiers;
    const modifiers = Object.freeze(progressionModifiers(progression, chassis));
    careerModifierCache.set(progression, { chassis, modifiers });
    return modifiers;
  }
  return progressionModifiers(progression, chassis);
}

export function combatStats(p) {
  const base = applyProgressionStats(mechStats(p.build), careerModifiers(p)),
    m = fieldModifiers(p);
  return {
    ...base,
    hp: base.hp * (1 + (m.maxHull || 0)),
    speed: base.speed * (1 + Math.min(1, m.moveSpeed || 0)),
    walkSpeed: base.walkSpeed * (1 + Math.min(1, m.moveSpeed || 0)),
    lift: base.lift * (1 + Math.min(1, m.lift || 0)),
  };
}

// Cooldown units advance at these rates; HUD seconds use the same live modifiers.
export function combatRecovery(p) {
  const m = fieldModifiers(p),
    career = careerModifiers(p);
  return {
    weaponRate: fieldRate(m),
    dashRate: career.dashRecharge * (1 + Math.min(2, m.dashRecharge || 0)),
    specialRate: career.specialRecharge * (1 + Math.min(2, m.specialRecharge || 0)),
  };
}

export const statsForPlayer = (build, p) => (p ? combatStats(p) : mechStats(build));
