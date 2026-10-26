// Independent hand cycling, ranged fire, melee impacts and native weapon repair.
import { RANGED, MELEE } from '../catalog/weapons.js';
import { chassisFor } from '../chassis.js';
import { combatStats, combatRecovery } from '../builds/combat-stats.js';
import { fieldModifiers } from '../sortie-progression.js';
import { fieldArea } from '../field-combat.js';
import { damageStructureAt, damageStructureArea } from '../destruction.js';
import { firingDirection } from '../weapon-origin.js?v=41';
import { STRIKES } from '../combat-motion.js?v=41';
import { clamp, dist } from './math.js';
import { launchPoint, shotBlocked, surfaceAt, clearPath } from './geometry.js';
import { move } from './movement.js';
import { damageEnemy, staggerEnemy, structureDamage } from './damage.js';
import { handState } from './hand-state.js';
import { rocketTarget } from './missile-guidance.js';

export function stepHand(w, owner, index, held, dt) {
  let h = owner.hands[index];
  const item = owner.build.equipment[index];
  if (h.item !== item) h = owner.hands[index] = handState(item);
  const blocked = owner.moveKind === 'dash' && owner.moveTime > 0,
    pressed = !!owner.input?.[index ? 'rightPressed' : 'leftPressed'] || (held && !h.triggerHeld);
  const handHull = owner.hp,
    mods = fieldModifiers(owner),
    rate = combatRecovery(owner).weaponRate,
    area = fieldArea(mods);
  const p = { ...owner, ...h, weapon: item, melee: item, hand: index, triggerHeld: held },
    selected = item,
    input = { fire: !blocked && (held || pressed), melee: !blocked && (held || pressed) },
    f = combatStats(owner);
  p.shot = p.shot > 0 ? p.shot - dt * rate : 0;
  p.meleeTime = p.meleeTime > 0 ? p.meleeTime - dt * rate : 0;
  p.guarding = item === 'guard' && held && !blocked;
  p.beam = p.flame = null;
  p.spin =
    selected === 'rotary' ? clamp((p.spin || 0) + (input.fire ? dt / 0.6 : -dt / 0.25), 0, 1) : 0;
  // Click commits one charge; holding repeats after recovery. Dash/death cancel a charge.
  if (selected !== 'rail' || blocked) {
    p.railCharge = 0;
    p.railCharging = false;
  }
  let railReady = false;
  if (selected === 'rail' && !blocked) {
    if ((pressed || held) && p.shot <= 1e-6 && !p.railCharging) {
      p.railCharging = true;
      p.railCharge = 0;
    }
    if (p.railCharging) {
      p.railCharge = Math.min(1, p.railCharge + (dt * rate) / RANGED.rail.charge);
      railReady = p.railCharge >= 1 - 1e-9;
    }
  }
  while (
    (selected === 'rail' ? railReady : input.fire) &&
    RANGED[selected] &&
    selected !== 'phaser' &&
    selected !== 'flamer' &&
    p.shot <= 1e-6 &&
    (!RANGED[selected].moveRecharge || p.motionCharge >= 1 - 1e-9)
  ) {
    if (RANGED[selected].moveRecharge) p.motionCharge = 0;
    p.railCharge = 0;
    p.railCharging = false;
    const g = RANGED[p.weapon],
      origin = launchPoint(w, p),
      direction = firingDirection(p, origin),
      baseAngle = Math.atan2(direction.y, direction.x),
      basePitch = Math.asin(direction.z),
      salvo = w.id,
      seekTarget = g.seeker ? rocketTarget(w, origin, direction, g.range) : null;
    p.shot =
      (selected === 'rail' ? 0 : p.shot) +
      g.rate * (selected === 'rotary' ? 1 + (1 - p.spin) * 0.5 : 1);
    p.shotCount = (p.shotCount || 0) + 1;
    for (let j = 0; j < g.pellets; j++) {
      const angle =
          baseAngle +
          (g.pellets > 1
            ? [-0.014, -0.007, 0, 0.007, 0.014, -0.18, -0.09, 0.09, 0.18][j]
            : Math.sin(p.shotCount * 2.4) *
              (g.spread || 0) *
              (selected === 'rotary' ? 1 - 0.78 * p.spin : 1)),
        pitch = basePitch + (g.pellets > 1 ? (j < 5 ? 0 : j % 2 ? -0.04 : 0.04) : 0),
        projectileSpeed = g.speed * (1 + Math.min(1, mods.projectileSpeed || 0)),
        horizontal = projectileSpeed * Math.cos(pitch);
      w.bullets.push({
        id: w.id++,
        owner: p.id,
        hand: index,
        kind: p.weapon,
        salvo,
        seekTarget,
        x: origin.x,
        y: origin.y,
        z: origin.z,
        origin: { x: origin.x, y: origin.y, z: origin.z },
        born: w.time,
        blockedAtLaunch: !!origin.blocked,
        splash: (g.splash || 0) * area,
        stun: g.stun || 0,
        vx: Math.cos(angle) * horizontal,
        vy: Math.sin(angle) * horizontal,
        vz: Math.sin(pitch) * projectileSpeed,
        life: g.range / projectileSpeed,
        damage: g.damage,
        enemy: false,
        rail: p.weapon === 'rail',
        pierce: g.pierce || 1,
        hit: [],
      });
    }
  }
  p.beam = null;
  if (selected === 'phaser' && input.fire) {
    const weapon = RANGED.phaser,
      origin = launchPoint(w, p),
      direction = firingDirection(p, origin),
      dx = direction.x,
      dy = direction.y,
      dz = direction.z;
    let target = null,
      end = { ...origin };
    for (let d = 0; d <= weapon.range; d += 5) {
      end = { x: origin.x + dx * d, y: origin.y + dy * d, z: origin.z + dz * d };
      if (origin.blocked || end.z < 0 || shotBlocked(w.mission, end.x, end.y, end.z)) break;
      target = w.enemies.find(
        (e) =>
          e.hp > 0 &&
          Math.hypot(e.x - end.x, e.y - end.y) < e.r + 2 &&
          end.z >= (e.altitude || 0) &&
          end.z <
            (e.altitude || 0) +
              (e.bodyHeight ?? (e.type === 'boss' ? 108 : e.type === 'tank' ? 75 : 58)),
      );
      if (target) break;
    }
    p.beam = {
      ...end,
      origin: { x: origin.x, y: origin.y, z: origin.z },
      blocked: !!origin.blocked,
      hit: !!target,
    };
    if (p.shot <= 1e-6) {
      p.shot += weapon.rate;
      p.shotCount++;
      if (!target && !origin.blocked)
        damageStructureAt(w, end, structureDamage(w, p, weapon.damage, 'phaser'), 'phaser');
      if (target) {
        const dealt = damageEnemy(w, target, weapon.damage, p.id, 'phaser');
        p.hp = Math.min(f.hp, p.hp + dealt * weapon.leech);
        p.hits++;
        p.hitTime = w.time;
      }
    }
  }
  p.flame = null;
  if (selected === 'flamer' && input.fire) {
    const g = RANGED.flamer,
      origin = launchPoint(w, p),
      direction = firingDirection(p, origin);
    let length = g.range;
    for (let d = 0; d <= g.range; d += 4) {
      if (
        origin.blocked ||
        origin.z + direction.z * d < 0 ||
        shotBlocked(
          w.mission,
          origin.x + direction.x * d,
          origin.y + direction.y * d,
          origin.z + direction.z * d,
        )
      ) {
        length = d;
        break;
      }
    }
    p.flame = { origin, direction, length, hit: false };
    if (p.shot <= 1e-6) {
      p.shot = (selected === 'rail' ? 0 : p.shot) + g.rate;
      p.shotCount++;
      if (!origin.blocked)
        damageStructureArea(
          w,
          { ...origin, z: origin.z },
          length,
          structureDamage(w, p, g.damage, 'flamer'),
          'flamer',
          p.angle,
          0.3,
        );
      if (!origin.blocked)
        for (const e of w.enemies) {
          const dx = e.x - origin.x,
            dy = e.y - origin.y,
            dz = (e.altitude || 0) + 30 - origin.z,
            along = dx * direction.x + dy * direction.y + dz * direction.z,
            radial = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - along * along));
          if (
            e.hp > 0 &&
            along > 0 &&
            along <= g.range &&
            radial < 8 + along * 0.22 + e.r &&
            clearPath(w, origin, e)
          ) {
            damageEnemy(
              w,
              e,
              g.damage * (1 - 0.45 * Math.max(0, (along - 80) / 100)),
              p.id,
              'flamer',
            );
            if (e.hp > 0) {
              e.burnUntil = Math.max(e.burnUntil || 0, w.time + 1.25);
              e.burnOwner = p.id;
              e.burnNext ??= w.time + 0.25;
            }
            p.hits++;
            p.hitTime = w.time;
            p.flame.hit = true;
          }
        }
    }
  }

  if (input.melee && MELEE[item] && item !== 'guard' && p.meleeTime <= 1e-6) {
    p.meleeTime += MELEE[item].rate;
    p.meleeCount++;
    p.meleePending = true;
  }
  const g = MELEE[item];
  if (g && p.meleePending && p.meleeTime <= g.rate * (1 - STRIKES[item])) {
    const floor = surfaceAt(w.mission, p.x, p.y, p.altitude || 0);
    if (item === 'hammer' && (p.altitude || 0) > floor + 8) {
      p.slamDiving = true;
      p.meleeTime = g.rate * (1 - STRIKES[item]);
    } else {
      p.slamDiving = false;
      p.meleePending = false;
      p.meleeImpactCount++;
      const direct = [];
      if (w.destruction)
        damageStructureArea(
          w,
          { x: p.x, y: p.y, z: (p.altitude || 0) + 32 },
          (item === 'hammer' ? 220 : g.range) * area,
          structureDamage(w, p, g.damage, 'melee'),
          item,
          p.angle,
          item === 'hammer' ? Math.PI : g.arc,
        );
      for (const e of w.enemies) {
        const angle = Math.atan2(e.y - p.y, e.x - p.x) - p.angle,
          delta = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
        if (
          e.hp > 0 &&
          dist(p, e) < g.range * chassisFor(p.build).scale * area + e.r &&
          delta <= g.arc &&
          Math.abs((p.altitude || 0) - (e.altitude || 0)) <
            Math.max(e.type === 'boss' ? 108 : 65, 65 * chassisFor(p.build).scale) &&
          clearPath(w, p, e)
        ) {
          damageEnemy(w, e, g.damage, p.id, 'melee');
          direct.push(e.id);
          p.hits++;
          p.hitTime = w.time;
          if (item === 'lance') staggerEnemy(w, e, 0.4);
          if (item === 'scythe' && !e.training && !e.objective) {
            const d = dist(p, e),
              pull = Math.min(70, Math.max(0, d - 45));
            move(w, e, ((p.x - e.x) / d) * pull, ((p.y - e.y) / d) * pull, 1, e.r);
          }
        }
      }
      if (item === 'claws' && direct.length) p.hp = Math.min(f.hp, p.hp + 3);
      if (item === 'blade') {
        const origin = {
            x: p.x + Math.cos(p.angle) * 35,
            y: p.y + Math.sin(p.angle) * 35,
            z: (p.altitude || 0) + 32,
          },
          direction = firingDirection(p, origin);
        w.bullets.push({
          id: w.id++,
          owner: p.id,
          hand: index,
          kind: 'bladeWave',
          ...origin,
          origin: { ...origin },
          vx: direction.x * 1000 * (1 + Math.min(1, mods.projectileSpeed || 0)),
          vy: direction.y * 1000 * (1 + Math.min(1, mods.projectileSpeed || 0)),
          vz: direction.z * 1000 * (1 + Math.min(1, mods.projectileSpeed || 0)),
          life: 0.5 / (1 + Math.min(1, mods.projectileSpeed || 0)),
          damage: 90,
          enemy: false,
          pierce: 12,
          width: 80 * area,
          hit: direct,
        });
      }
      if (item === 'hammer') {
        w.effects.push({
          id: w.id++,
          x: p.x,
          y: p.y,
          z: floor + 3,
          r: 220 * area,
          kind: 'plasmaSlam',
          life: 0.65,
          max: 0.65,
        });
        for (const e of w.enemies) {
          const distance = dist(p, e);
          if (
            e.hp > 0 &&
            distance < 220 * area &&
            Math.abs((e.altitude || 0) - floor) < 60 &&
            clearPath(w, p, e)
          ) {
            if (!direct.includes(e.id))
              damageEnemy(w, e, 160 * (1 - (0.35 * distance) / (220 * area)), p.id, 'hammer');
            staggerEnemy(w, e, 0.55);
            p.hits++;
            p.hitTime = w.time;
          }
        }
      }
    }
  }
  owner.hp = Math.min(f.hp, owner.hp + p.hp - handHull);
  owner.hits = p.hits;
  owner.hitTime = p.hitTime;
  for (const key of [
    'shot',
    'shotCount',
    'spin',
    'motionCharge',
    'railCharge',
    'railCharging',
    'triggerHeld',
    'meleeTime',
    'meleeCount',
    'meleeImpactCount',
    'meleePending',
    'slamDiving',
    'guarding',
    'beam',
    'flame',
  ])
    h[key] = p[key];
}
