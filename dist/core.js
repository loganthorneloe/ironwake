// Public compatibility API. Add feature behavior in the owning module below.
// Tick ordering is intentionally explicit: directors, spawns, players, enemies,
// projectiles, defeat rewards, hazards, then encounter/extraction resolution.
export { FRAMES } from './catalog/frames.js';
export { WEAPONS, RANGED, MELEE } from './catalog/weapons.js';
export { ABILITIES } from './catalog/abilities.js';
export { COMBAT_MOVES, AI_ARM_TIME } from './catalog/combat-moves.js';
export { COLORS, TRAIL_COLORS } from './catalog/palette.js';
export { PARTS, PART_LABELS } from './catalog/parts.js';
export { EQUIPMENT, RACK_SIZE } from './catalog/equipment.js';
export {
  equipmentFor,
  activeItem,
  specialFor,
  partsFor,
  mechName,
  buildKey,
  DEFAULT_BUILD,
  cleanBuild,
} from './builds/loadout.js';
export { mechStats, cost, validBuild } from './builds/stats.js';
export { combatStats, combatRecovery, statsForPlayer } from './builds/combat-stats.js';
export { planetMission } from './planet-mission.js?v=41';
export { blocksBullet } from './bulwark.js?v=41';
export { rng } from './simulation/math.js';
export { testPlatform, combatTrial, mission } from './simulation/procedural-missions.js';
export { newWorld } from './simulation/world.js';
export { rampHeight, surfaceAt } from './simulation/geometry.js';
export { setInput } from './simulation/input.js';
export { snapshot } from './simulation/snapshot.js';

import { clamp } from './simulation/math.js';
import { stepField } from './sortie-progression.js';
import { stepTeamCombos } from './team-combos.js';
import { stepMission } from './simulation/mission-step.js';
import { stepSpawns, resolveDefeats, resolveEncounter } from './simulation/encounters.js';
import { stepPlayers } from './simulation/players.js';
import { stepEnemies } from './simulation/enemies.js';
import { stepProjectiles } from './simulation/projectiles.js';
import { stepHazards } from './simulation/hazards.js';

export function step(w, dt) {
  if (w.status !== 'playing') return;
  dt = clamp(dt, 0, 0.05);
  w.time += dt;
  stepField(w, dt);
  stepTeamCombos(w);
  w.damageEvents = (w.damageEvents || []).filter((e) => (e.life -= dt) > 0);
  w.effects = w.effects.filter((e) => (e.life -= dt) > 0);
  stepMission(w, dt);
  if (w.status !== 'playing') return;
  stepSpawns(w, dt);
  stepPlayers(w, dt);
  stepEnemies(w, dt);
  stepProjectiles(w, dt);
  resolveDefeats(w, dt);
  stepHazards(w, dt);
  resolveEncounter(w, dt);
}
