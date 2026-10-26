// Legacy encounter spawning, defeat rewards, checkpoint recovery and extraction.
import { ENEMY_ROLES } from '../enemy-behaviors.js';
import { rewardDefeat } from '../sortie-progression.js';
import { combatStats } from '../builds/combat-stats.js';
import { random, dist } from './math.js';
import { effect } from './effects.js';

export function beginEncounter(w) {
  const zone = w.mission.zones[w.zoneIndex];
  w.encounter = true;
  w.encounterStarted = w.time;
  const count = 4 + w.zoneIndex + Math.round((w.players.length - 1) * 2);
  for (let i = 0; i < count; i++) {
    const type =
      i % 5 === 0 && w.zoneIndex > 0 ? 'tank' : (i + zone.variant) % 3 === 0 ? 'gunner' : 'drone';
    w.spawn.push({ time: w.time + i * 0.35, type, zone });
  }
  if (zone.boss) w.spawn.push({ time: w.time + 2.5, type: 'boss', zone });
}

export function spawnEnemy(w, type, zone) {
  const profile = ENEMY_ROLES[type],
    ordinary = profile && type !== 'siege',
    legacy = {
      hunter: 'drone',
      wisp: 'gunner',
      scarab: 'tank',
      rammer: 'tank',
      needle: 'gunner',
      mortar: 'tank',
      mender: 'gunner',
    },
    physical = ordinary ? legacy[type] : type;
  const slots = [
      [-70, -70],
      [70, 70],
      [-70, 70],
      [70, -70],
      [0, -140],
      [0, 140],
      [-140, 0],
      [140, 0],
    ],
    slot = slots[Math.floor(random(w) * slots.length)];
  let x = zone.x + (zone.exact ? 0 : slot[0]),
    y = zone.y + (zone.exact ? 0 : slot[1]);
  const species =
      zone.elite || type === 'boss'
        ? null
        : ordinary
          ? type
          : zone.operation
            ? { drone: 'hunter', gunner: 'wisp', tank: 'scarab' }[type]
            : null,
    role = species && ENEMY_ROLES[species],
    deck = w.mission.platforms?.find((p) => p.zone === zone.id && p.kind === 'deck');
  if (physical === 'gunner' && deck && !ordinary) {
    x = deck.x + deck.w * 0.72;
    y = deck.y + deck.h * 0.55;
  }
  const altitude = role?.hover || (!zone.operation && physical === 'gunner' && deck ? deck.z : 0),
    scale = 1 + (zone.operation ? 0.15 : 0.28) * (w.players.length - 1);
  const baseHp = zone.warden
    ? 16000 * (1 + 0.9 * (w.players.length - 1))
    : zone.elite
      ? 3600 * (1 + 0.65 * (w.players.length - 1))
      : (role?.hp ||
          (zone.operation
            ? { drone: 90, gunner: 65, tank: 160, boss: 16000 }
            : { drone: 70, gunner: 110, tank: 260, boss: 1500 })[physical]) * scale;
  const hp =
    (zone.health ? zone.health * (1 + 0.65 * (w.players.length - 1)) : baseHp) *
    (zone.difficulty?.health || 1);
  w.enemies.push({
    raidTarget: zone.raidTarget,
    id: zone.warden ? 'cinder-warden' : w.id++,
    type: physical,
    x,
    y,
    altitude: zone.elite ? 600 : altitude,
    elite: !!zone.elite,
    landing: !!zone.elite,
    species,
    bodyHeight: role?.height,
    hover: role?.hover || 0,
    hp,
    max: hp,
    angle: 0,
    stun: 0,
    windup: 0,
    attackAngle: 0,
    attackPitch: 0,
    attackTarget: null,
    actionPhase: 'idle',
    actionTime: 0,
    cd: 0.9 + random(w),
    speed:
      (zone.elite
        ? 175
        : role?.speed || { drone: 265, gunner: 175, tank: 110, boss: 110 }[physical]) *
      (zone.difficulty?.speed || 1),
    r: role?.r || (physical === 'boss' ? 46 : physical === 'tank' ? 28 : 18),
  });
}
export function stepSpawns(w, dt) {
  if (
    !w.operation &&
    !w.siege &&
    !w.encounter &&
    w.zoneIndex < w.mission.zones.length &&
    w.players.some((p) => p.hp > 0 && dist(p, w.mission.zones[w.zoneIndex]) < 290)
  )
    beginEncounter(w);
  if (w.spawn.length) {
    const due = w.spawn.filter((s) => s.time <= w.time);
    w.spawn = w.spawn.filter((s) => s.time > w.time);
    for (const s of due) spawnEnemy(w, s.type, s.zone);
  }
}
export function resolveDefeats(w, dt) {
  for (const e of w.enemies)
    if (e.hp <= 0 && (!e.training || e.respawn == null)) {
      w.kills++;
      rewardDefeat(w, e);
      effect(w, e.x, e.y, e.type === 'boss' ? 150 : 48, '#ff784b', 0.7);
      if (e.training) e.respawn = 2;
    }
  w.enemies = w.enemies.filter((e) => e.hp > 0 || e.training);
}
export function resolveEncounter(w, dt) {
  if (!w.operation && !w.siege && w.encounter && w.enemies.length === 0 && w.spawn.length === 0) {
    w.encounter = false;
    w.zoneIndex++;
    w.cleared = w.zoneIndex;
    for (const p of w.players)
      if (p.hp > 0) {
        const f = combatStats(p);
        p.hp = Math.min(f.hp, p.hp + f.hp * 0.2);
        p.energy = Math.min(f.energy, p.energy + 35);
      }
    w.hazards = [];
    w.hazardTimer = 10;
  }
  const survivors = w.players.filter((p) => p.hp > 0);
  if (
    !w.operation &&
    !w.siege &&
    !['sandbox', 'trial'].includes(w.mission.mode) &&
    w.cleared === w.mission.zones.length &&
    survivors.length &&
    survivors.every((p) => dist(p, w.mission.exit) < 160 && (p.altitude || 0) < 20)
  )
    w.extractTime += dt;
  else if (!w.operation && !w.siege) w.extractTime = 0;
  if (
    (!w.operation && !w.siege && w.extractTime >= 2) ||
    (w.mission.mode === 'trial' && !w.enemies.length)
  )
    w.status = 'won';
  if (!w.operation && !w.siege && !survivors.length) w.status = 'lost';
}
