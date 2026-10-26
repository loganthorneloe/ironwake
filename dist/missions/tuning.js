import { MISSIONS } from './catalog.js';

// Shared encounter pressure remains independent of authored mission geometry.
export function missionTuning(index, players = 1) {
  const level = Math.max(0, Math.min(MISSIONS.length - 1, index)),
    team = Math.max(1, Math.min(4, players));
  return {
    level: level + 1,
    health: 1 + level * 0.12,
    damage: 1 + level * 0.055,
    speed: 1 + level * 0.025,
    cap: Math.min(48, 16 + level * 2 + team * 5),
    batch: 4 + Math.floor(level / 2) + team * 2,
    hold: 12 + Math.floor(level / 3) * 2,
  };
}
