// Player cooldowns, recovery, movement, specials and independent hand updates.
import { chassisBounds } from '../chassis.js';
import { COMBAT_MOVES } from '../catalog/combat-moves.js';
import { ABILITIES } from '../catalog/abilities.js';
import { WEAPONS, RANGED, MELEE } from '../catalog/weapons.js';
import { specialFor } from '../builds/loadout.js';
import { careerModifiers, combatStats, combatRecovery } from '../builds/combat-stats.js';
import { fieldModifiers } from '../sortie-progression.js';
import { fieldArea } from '../field-combat.js';
import { cancelEnemyAction } from '../enemy-behaviors.js';
import { nearbyObstacles } from '../collision.js?v=41';
import { structureBoxes } from '../destruction.js';
import { clamp, dist, spatialDist, inside } from './math.js';
import { surfaceAt, blocked, clearPath } from './geometry.js';
import { move } from './movement.js';
import { effect } from './effects.js';
import { damageEnemy, staggerEnemy } from './damage.js';
import { handState } from './hand-state.js';
import { stepHand } from './hand-weapons.js';

export function stepPlayers(w, dt) {
  for (const p of w.players) {
    const mods = fieldModifiers(p),
      career = careerModifiers(p),
      recovery = combatRecovery(p);
    p.shot = Math.max(0, p.shot - dt);
    p.meleeTime = Math.max(0, (p.meleeTime || 0) - dt);
    p.abilityCd = Math.max(0, p.abilityCd - dt * recovery.specialRate);
    p.dashCd = Math.max(0, (p.dashCd || 0) - dt * recovery.dashRate);
    p.active = Math.max(0, p.active - dt);
    p.energy = p.energy ?? 100;
    if (w.time - p.lastInput > 0.7) p.input = {};
    if (p.hp <= 0) {
      p.moveTime = 0;
      p.moveKind = null;
      p.guarding = false;
      for (const h of p.hands || []) {
        h.guarding = false;
        h.flame = h.beam = null;
        h.spin = 0;
        h.railCharge = 0;
        h.railCharging = false;
        h.triggerHeld = false;
        h.meleePending = h.slamDiving = false;
        h.meleeTime = 0;
      }
      p.flame = null;
      p.railCharge = 0;
      p.beam = null;
      const floor = surfaceAt(w.mission, p.x, p.y, p.altitude || 0);
      p.altitude = Math.max(floor, (p.altitude || 0) - 210 * dt);
      p.airborne = false;
      p.boosting = false;
      p.boostX = p.boostY = 0;
      const ally = w.players.some((a) => a !== p && a.hp > 0 && spatialDist(a, p) < 95);
      p.revive = ally ? p.revive + dt : Math.max(0, p.revive - dt);
      if (p.revive >= 3) {
        p.hp = combatStats(p).hp * 0.4;
        p.revive = 0;
        effect(w, p.x, p.y, 90, '#a7cbbd');
      }
      continue;
    }
    const input = p.input || {},
      f = combatStats(p),
      bounds = chassisBounds(p.build),
      motionStart = { x: p.x, y: p.y, z: p.altitude || 0 };
    if (w.time - (p.lastHurt ?? -10) > 7)
      p.hp = Math.min(
        f.hp,
        p.hp + ((w.operation ? 4 + (mods.recovery || 0) : 0) + career.repair) * dt,
      );
    if (!(p.moveTime > 0)) {
      p.moveKind = null;
      const kind = input.dash && p.dashCd <= 0 ? 'dash' : null;
      if (kind) {
        const action = COMBAT_MOVES[kind],
          moving = Math.hypot(input.x || 0, input.y || 0) > 0.1,
          direction = moving ? Math.atan2(input.y, input.x) : input.angle || 0;
        p.moveKind = kind;
        p.moveTime = action.duration;
        p[kind + 'Cd'] = action.cd;
        p.moveAngle = direction;
        p.movePitch = moving ? 0 : input.pitch || 0;
        p.moveCount = (p.moveCount || 0) + 1;
        p.dashHits = [];
      }
    }
    const special = specialFor(p),
      a = ABILITIES[special];
    p.hands ??= p.build.equipment.slice(0, 2).map(handState);
    p.guarding = false;
    let ix = input.x || 0,
      iy = input.y || 0;
    const l = Math.hypot(ix, iy);
    if (l > 1) {
      ix /= l;
      iy /= l;
    }
    p.boosting = l > 0;
    p.boostX = p.boosting ? ix : 0;
    p.boostY = p.boosting ? iy : 0;
    p.energy = clamp(
      p.energy +
        ((p.altitude || 0) > surfaceAt(w.mission, p.x, p.y, p.altitude || 0) + 0.5 || input.fly
          ? 0
          : f.recharge) *
          dt,
      0,
      f.energy,
    );
    const flying = !!input.fly;
    p.airborne = flying;
    p.altitude = p.altitude || 0;
    const surface = surfaceAt(w.mission, p.x, p.y, p.altitude);
    if (p.moveTime > 0) {
      p.airborne = p.altitude > 1;
    } else if (flying) {
      let next = Math.min(240, p.altitude + f.lift * dt);
      for (const originalRoof of nearbyObstacles(w.mission, p.x, p.y, bounds.radius))
        for (const roof of structureBoxes(w.mission, originalRoof))
          if (
            roof.baseZ &&
            inside(roof, p.x, p.y, bounds.radius) &&
            p.altitude + bounds.clearance <= roof.baseZ + 0.1 &&
            next + bounds.clearance > roof.baseZ
          )
            next = Math.min(next, roof.baseZ - bounds.clearance);
      for (const deck of w.mission.platforms || [])
        if (
          inside(deck, p.x, p.y, bounds.radius) &&
          p.altitude + bounds.clearance <= deck.z - 8 + 0.1 &&
          next + bounds.clearance > deck.z - 8
        )
          next = Math.min(next, deck.z - 8 - bounds.clearance);
      p.altitude = Math.max(p.altitude, next);
    } else p.altitude = Math.max(surface, p.altitude - 210 * dt);
    if (p.hands.some((h) => h.slamDiving)) {
      p.altitude = Math.max(surface, p.altitude - 650 * dt);
      p.airborne = false;
    }
    const speed = p.boosting ? f.speed * f.boost : f.walkSpeed;
    if (p.moveTime > 0) {
      const action = COMBAT_MOVES[p.moveKind],
        travel = action.speed * Math.min(dt, p.moveTime),
        steps = Math.max(1, Math.ceil(travel / 6)),
        dx = Math.cos(p.moveAngle) * Math.cos(p.movePitch || 0),
        dy = Math.sin(p.moveAngle) * Math.cos(p.movePitch || 0),
        dz = Math.sin(p.movePitch || 0);
      p.boosting = true;
      p.boostX = dx;
      p.boostY = dy;
      for (let i = 0; i < steps; i++) {
        move(w, p, (dx * travel) / steps, (dy * travel) / steps, 1, bounds.radius);
        const next = clamp(p.altitude + (dz * travel) / steps, 0, 240);
        if (!blocked(w, p.x, p.y, bounds.radius, next, bounds.clearance, 12 * bounds.scale))
          p.altitude = Math.max(surfaceAt(w.mission, p.x, p.y, p.altitude), next);
        if (p.moveKind === 'dash')
          for (const e of w.enemies)
            if (
              e.hp > 0 &&
              !p.dashHits.includes(e.id) &&
              dist(p, e) < e.r + 32 * bounds.scale &&
              Math.abs(p.altitude - (e.altitude || 0)) < bounds.clearance &&
              clearPath(w, p, e)
            ) {
              p.dashHits.push(e.id);
              damageEnemy(w, e, action.damage, p.id, 'dash');
              staggerEnemy(w, e, 0.45);
              p.hits++;
              p.hitTime = w.time;
            }
      }
      p.moveTime = Math.max(0, p.moveTime - dt);
    } else move(w, p, ix * speed, iy * speed, dt, bounds.radius);
    p.angle = input.angle || 0;
    p.pitch = input.pitch || 0;
    p.aimPoint = input.aimPoint || null;
    if (a && input.ability && p.abilityCd <= 0) {
      p.activeAbility = special;
      p.abilityCd = a.cd;
      p.active = a.duration;
      effect(
        w,
        p.x,
        p.y,
        a.radius * fieldArea(mods),
        p.activeAbility === 'emp' ? '#8bcde6' : '#b5e2be',
        1.1,
        'system',
      );
      if (p.activeAbility === 'emp')
        for (const e of w.enemies)
          if (spatialDist(p, e) < a.radius * fieldArea(mods)) {
            e.stun = 4;
            if (e.behavior) cancelEnemyAction(e);
            damageEnemy(w, e, 45, p.id, 'emp');
            e.windup = 0;
          }
    }
    if (p.active > 0 && (p.activeAbility || p.build.ability) === 'repair') {
      for (const target of w.players)
        if (target.hp > 0 && spatialDist(p, target) < ABILITIES.repair.radius * fieldArea(mods)) {
          const max = combatStats(target).hp;
          const overlaps = w.players.filter(
            (q) =>
              q.hp > 0 &&
              q.active > 0 &&
              (q.activeAbility || q.build.ability) === 'repair' &&
              spatialDist(q, target) < ABILITIES.repair.radius * fieldArea(fieldModifiers(q)),
          ).length;
          target.hp = Math.min(
            max,
            target.hp + (dt * 12 * (1 + (mods.specialPower || 0))) / Math.max(1, overlaps),
          );
        }
    }
    const poweredVertical =
        p.moveKind === 'dash'
          ? Math.abs((p.altitude || 0) - motionStart.z)
          : input.fly
            ? Math.max(0, (p.altitude || 0) - motionStart.z)
            : 0,
      travelled = Math.hypot(p.x - motionStart.x, p.y - motionStart.y, poweredVertical);
    for (const h of p.hands)
      if (WEAPONS[h.item]?.moveRecharge)
        h.motionCharge = Math.min(
          1,
          (h.motionCharge || 0) + travelled / WEAPONS[h.item].moveRecharge,
        );
    for (let index = 0; index < 2; index++)
      stepHand(w, p, index, index === 0 ? input.left : input.right, dt);
    input.leftPressed = input.rightPressed = false;
    p.guarding = p.hands.some((h) => h.guarding);
    const gun = p.hands.find((h) => RANGED[h.item]),
      melee = p.hands.find((h) => MELEE[h.item]);
    p.weapon = gun?.item || p.build.weapon;
    p.melee = melee?.item || p.build.melee;
    p.shot = gun?.shot || 0;
    p.railCharge = Math.max(...p.hands.map((h) => h.railCharge || 0));
    p.flame = p.hands.find((h) => h.flame)?.flame || null;
    p.beam = p.hands.find((h) => h.beam)?.beam || null;
    p.meleeTime = melee?.meleeTime || 0;
    p.shotCount = p.hands.reduce((n, h) => n + h.shotCount, 0);
    p.meleeCount = p.hands.reduce((n, h) => n + h.meleeCount, 0);
    p.meleeImpactCount = p.hands.reduce((n, h) => n + (h.meleeImpactCount || 0), 0);
  }
}
