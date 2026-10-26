// Construct a validated deployed world and initialize its selected mission systems.
import { chassisBounds } from '../chassis.js';
import { AI_ARM_TIME } from '../catalog/combat-moves.js';
import { cleanBuild } from '../builds/loadout.js';
import { validBuild, mechStats } from '../builds/stats.js';
import {
  freezeDeploymentProgression,
  combatStats,
  statsForPlayer,
} from '../builds/combat-stats.js';
import { applyProgressionStats, progressionModifiers } from '../career-progression.js';
import { initOperation } from '../planet-mission.js?v=41';
import { initSortie } from '../sortie-progression.js';
import { initDestructionMission } from '../destruction-mission.js';
import { handState } from './hand-state.js';

export function newWorld(m, roster) {
  const spacing = Math.max(50, ...roster.map((p) => chassisBounds(p.build).radius * 2 + 8));
  const w = {
    mission: m,
    players: roster.map((p, i) => {
      const b = cleanBuild(p.build);
      if (!validBuild(b)) throw new Error('Mech cannot deploy: ' + mechStats(b).issues.join(' '));
      const progression = freezeDeploymentProgression(p.progression, b.chassis),
        stats = applyProgressionStats(mechStats(b), progressionModifiers(progression, b.chassis));
      return {
        id: p.id,
        name: String(p.name || 'Pilot').slice(0, 16),
        build: b,
        progression,
        activeSlot: 0,
        hands: b.equipment.slice(0, 2).map(handState),
        weapon: b.weapon,
        melee: b.melee,
        activeAbility: null,
        x: m.entry.x + (i % 2) * spacing - spacing / 2,
        y: m.entry.y + Math.floor(i / 2) * spacing - spacing / 2,
        altitude: 0,
        hp: stats.hp,
        angle: m.heading,
        pitch: 0,
        shot: 0,
        railCharge: 0,
        chargeSlot: null,
        meleeTime: 0,
        meleeCount: 0,
        energy: stats.energy,
        dashCd: 0,
        moveTime: 0,
        moveKind: null,
        moveCount: 0,
        dashHits: [],
        boosting: false,
        boostX: 0,
        boostY: 0,
        shotCount: 0,
        hits: 0,
        hitTime: -10,
        abilityCd: 0,
        active: 0,
        revive: 0,
        input: {},
        lastInput: 0,
      };
    }),
    enemies:
      m.mode === 'sandbox'
        ? trainingTargets()
        : m.mode === 'trial'
          ? [trialOpponent(roster.length)]
          : [],
    damageEvents: [],
    bullets: [],
    effects: [],
    hazards: [],
    time: 0,
    zoneIndex: 0,
    encounter: false,
    encounterStarted: -100,
    cleared: 0,
    extractTime: 0,
    kills: 0,
    status: 'playing',
    id: 1,
    spawn: [],
    hazardTimer: 10,
    seed: m.seed,
    hadBoss: false,
  };
  if (m.mode === 'operation') {
    initOperation(w);
    initSortie(w, statsForPlayer);
    for (const p of w.players) p.hp = combatStats(p).hp;
  }
  if (m.destructible) initDestructionMission(w);
  return w;
}

export function trainingTargets() {
  return [
    [-25, -140, 'MELEE'],
    [0, -550, 'RANGED'],
    [230, -650, 'RANGED'],
    [-230, -480, 'SPLASH'],
    [-295, -500, 'SPLASH'],
    [-260, -565, 'SPLASH'],
  ].map(([x, y, label], i) => ({
    id: 'target-' + i,
    type: 'target',
    training: true,
    label,
    x,
    y,
    altitude: 0,
    hp: 2000,
    max: 2000,
    angle: Math.PI / 2,
    stun: 0,
    windup: 0,
    cd: 99,
    speed: 0,
    r: 22,
  }));
}

export function trialOpponent(count) {
  const hp = 900 * (1 + 0.55 * (count - 1));
  return {
    id: 'rival',
    type: 'rival',
    x: 0,
    y: -520,
    altitude: 0,
    hp,
    max: hp,
    angle: Math.PI / 2,
    stun: 0,
    windup: 0,
    cd: AI_ARM_TIME,
    shot: 0,
    shotCount: 0,
    meleeTime: 0,
    meleeCount: 0,
    burst: 0,
    burstTimer: 0,
    r: 21,
    speed: 430,
    weapon: 'carbine',
    melee: 'blade',
  };
}
