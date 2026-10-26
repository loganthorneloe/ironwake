// Practice rival observation, tactics, movement and attacks.
import { MELEE } from '../catalog/weapons.js';
import { AI_ARM_TIME } from '../catalog/combat-moves.js';
import { muzzleOrigin, firingDirection } from '../weapon-origin.js?v=41';
import { clamp, dist, spatialDist, random } from './math.js';
import { clearPath } from './geometry.js';
import { move } from './movement.js';
import { hurt } from './damage.js';

export function rivalObserve(w, e) {
  const alive = w.players.filter((p) => p.hp > 0);
  e.observations ??= [];
  if (w.time >= (e.observeAt || 0)) {
    e.observeAt = w.time + 0.16;
    e.observations = alive.map((p) => {
      const old = e.observations.find((q) => q.id === p.id),
        elapsed = old ? w.time - old.at : 0;
      return {
        id: p.id,
        x: p.x,
        y: p.y,
        z: p.altitude + 30,
        at: w.time,
        vx: elapsed ? clamp((p.x - old.x) / elapsed, -750, 750) : 0,
        vy: elapsed ? clamp((p.y - old.y) / elapsed, -750, 750) : 0,
        vz: elapsed ? clamp((p.altitude + 30 - old.z) / elapsed, -210, 220) : 0,
      };
    });
    const score = (p) =>
      spatialDist(p, e) *
      (p.guarding ? 1.2 : 1) *
      (p.id === e.targetId ? 0.72 : 1) *
      (p.id === e.lastAttacker && w.time - e.lastDamaged < 2 ? 0.7 : 1);
    const committed = (e.windup > 0 || e.burst > 0) && alive.find((p) => p.id === e.targetId);
    const selected = committed || alive.sort((a, b) => score(a) - score(b))[0];
    e.targetId = selected?.id;
  }
  return alive.find((p) => p.id === e.targetId) || alive[0];
}

export function rivalAim(w, e, target) {
  const seen = e.observations.find((q) => q.id === target.id) || {
      x: target.x,
      y: target.y,
      z: target.altitude + 30,
      vx: 0,
      vy: 0,
      vz: 0,
      at: w.time,
    },
    age = Math.min(0.2, w.time - seen.at);
  const dx = seen.x + seen.vx * age - e.x,
    dy = seen.y + seen.vy * age - e.y,
    dz = seen.z + seen.vz * age - e.altitude - 38,
    a = seen.vx ** 2 + seen.vy ** 2 + seen.vz ** 2 - 1100 ** 2,
    b = 2 * (dx * seen.vx + dy * seen.vy + dz * seen.vz),
    c = dx * dx + dy * dy + dz * dz,
    disc = b * b - 4 * a * c;
  const intercept =
      Math.abs(a) > 1 && disc >= 0 ? (-b - Math.sqrt(disc)) / (2 * a) : Math.sqrt(c) / 1100,
    travel = clamp(intercept, 0, 0.9),
    lead = age + travel * 0.97;
  return {
    x: seen.x + seen.vx * lead,
    y: seen.y + seen.vy * lead,
    z: clamp(seen.z + seen.vz * lead, 20, 275),
  };
}

export function stepRival(w, e, dt) {
  e.shot = Math.max(0, e.shot - dt);
  e.meleeTime = Math.max(0, e.meleeTime - dt);
  e.stun = Math.max(0, e.stun - dt);
  e.dashTime = Math.max(0, (e.dashTime || 0) - dt);
  e.dashCd = Math.max(0, (e.dashCd || 0) - dt);
  if (e.hp <= 0 || e.stun > 0) {
    e.windup = 0;
    e.burst = 0;
    e.dashTime = 0;
    e.dodgeAt = 0;
    e.boosting = e.airborne = false;
    e.altitude = Math.max(0, e.altitude - 160 * dt);
    return;
  }
  const target = rivalObserve(w, e);
  if (!target) return;
  const d = dist(e, target),
    angle = Math.atan2(target.y - e.y, target.x - e.x);
  e.cd -= dt;
  e.boosting = false;

  if (w.time >= (e.tacticAt || 0)) {
    e.tacticAt = w.time + 0.8 + random(w) * 0.6;
    e.strafeSign = random(w) < 0.5 ? -1 : 1;
  }
  const shortRange = target.build.equipment
    .slice(0, 2)
    .every((id) => MELEE[id] || id === 'flamer' || id === 'scatter');
  const opening = target.hands.some((h) => h.shot > 0.45 || h.railCharge > 0.3),
    rush = !shortRange && !target.guarding && (opening || (e.hp / e.max > 0.45 && d < 190));
  e.intent = target.guarding
    ? 'FLANKING'
    : shortRange
      ? 'KEEPING RANGE'
      : rush
        ? 'PRESSING'
        : 'STRAFING';
  // React to a visible, approaching shot after 140ms; never dodge continuously.
  if (!e.dashCd && !e.dodgeAt && e.attackKind !== 'melee') {
    const threat = w.bullets.find((b) => {
      if (b.enemy || dist(b, e) > 750) return false;
      const vx = b.vx - (e.boostX || 0) * e.speed,
        vy = b.vy - (e.boostY || 0) * e.speed,
        vz = b.vz || 0,
        dx = e.x - b.x,
        dy = e.y - b.y,
        dz = e.altitude + 30 - (b.z || 0),
        t = (dx * vx + dy * vy + dz * vz) / (vx * vx + vy * vy + vz * vz || 1);
      return (
        t > 0.12 &&
        t < 0.65 &&
        Math.hypot(dx - vx * t, dy - vy * t, dz - vz * t) < 50 + (b.splash || 0) * 0.5
      );
    });
    if (threat) {
      e.dodgeAt = w.time + 0.14;
      e.dodgeAngle = Math.atan2(threat.vy, threat.vx) + (e.strafeSign * Math.PI) / 2;
    }
  }
  if (e.dodgeAt && w.time >= e.dodgeAt) {
    e.dodgeAt = 0;
    e.dashTime = 0.28;
    e.dashCd = 1.65;
    e.dashAngle = e.dodgeAngle;
  }
  const preferred = target.guarding ? 190 : shortRange ? 360 : rush ? 65 : 260,
    radial = clamp((d - preferred) / 110, -1, 1),
    side = e.strafeSign * (d < 100 && !target.guarding ? 0.15 : target.guarding ? 1.2 : 0.72),
    length = Math.max(1, Math.hypot(radial, side));
  let vx = (Math.cos(angle) * radial - Math.sin(angle) * side) / length,
    vy = (Math.sin(angle) * radial + Math.cos(angle) * side) / length,
    speed = e.speed;
  if (d > 600 && !e.dashCd && !e.windup && !e.burst) {
    e.dashTime = 0.38;
    e.dashCd = 1.65;
    e.dashAngle = angle;
  }
  if (e.dashTime > 0) {
    vx = Math.cos(e.dashAngle);
    vy = Math.sin(e.dashAngle);
    speed *= 1.65;
    e.intent = 'EVADING';
  }
  if (e.windup > 0 && e.attackKind === 'melee') {
    vx = Math.cos(e.attackAngle);
    vy = Math.sin(e.attackAngle);
    speed *= e.windup > 0.2 && d > 65 ? 1.35 : 0;
  } else if (e.meleeTime > 0) {
    speed *= 0.35;
    e.intent = 'RECOVERING';
  }
  e.boostX = vx;
  e.boostY = vy;
  e.boosting = speed * Math.hypot(vx, vy) > 10;
  move(w, e, vx * speed, vy * speed, dt, e.r);
  const desiredAltitude = clamp(
    target.altitude + (shortRange && d < 400 ? 60 : target.guarding ? 45 : 0),
    0,
    240,
  );
  e.altitude = clamp(e.altitude + clamp(desiredAltitude - e.altitude, -190 * dt, 190 * dt), 0, 240);
  e.airborne = e.altitude > 1 || desiredAltitude > 1;
  if (!e.windup && !e.burst && w.time >= AI_ARM_TIME && e.cd <= 0 && d < 1000) {
    e.attackTarget = target.id;
    e.attackAngle = angle;
    e.attackKind = d < 145 && Math.abs(target.altitude - e.altitude) < 55 ? 'melee' : 'ranged';
    e.windup = e.attackKind === 'melee' ? 0.46 : 0.44;
    e.attackPoint = rivalAim(w, e, target);
    if (e.attackKind === 'melee') {
      e.meleeTime = 0.8;
      e.meleeCount++;
    }
  }
  if (e.windup > 0) {
    if (e.attackKind === 'ranged' && e.windup > 0.16) e.attackPoint = rivalAim(w, e, target);
    e.windup = Math.max(0, e.windup - dt);
    if (e.windup === 0) {
      if (e.attackKind === 'melee') {
        const t = w.players.find((p) => p.id === e.attackTarget),
          delta = t ? Math.atan2(t.y - e.y, t.x - e.x) - e.attackAngle : Math.PI;
        if (
          t?.hp > 0 &&
          dist(e, t) < 145 &&
          Math.abs(t.altitude - e.altitude) < 60 &&
          Math.cos(delta) > 0.45 &&
          clearPath(w, e, t)
        )
          hurt(w, t, e.species ? 18 : 32, e, 'melee');
        e.cd = 0.85;
        e.attackKind = null;
      } else {
        e.burst = 4;
        e.burstTimer = 0;
        e.cd = 1.15;
      }
    }
  }
  if (e.burst) {
    e.burstTimer -= dt;
    if (e.burstTimer <= 0) {
      e.burst--;
      e.burstTimer = 0.18;
      e.shot = 0.12;
      e.shotCount++;
      e.attackPoint = rivalAim(w, e, target);
      e.angle = Math.atan2(e.attackPoint.y - e.y, e.attackPoint.x - e.x);
      e.pitch = Math.atan2(
        e.attackPoint.z - e.altitude - 38,
        Math.hypot(e.attackPoint.x - e.x, e.attackPoint.y - e.y),
      );
      const origin = muzzleOrigin({ ...e, hand: 1 }),
        direction = firingDirection({ ...e, aimPoint: e.attackPoint }, origin);
      w.bullets.push({
        id: w.id++,
        owner: e.id,
        hand: 1,
        kind: 'carbine',
        origin,
        ...origin,
        vx: direction.x * 1100,
        vy: direction.y * 1100,
        vz: direction.z * 1100,
        life: 1.25,
        enemy: true,
        damage: 18,
      });
    }
  }
  const aim =
    e.attackKind === 'melee' && e.windup > 0
      ? {
          x: e.x + Math.cos(e.attackAngle) * 100,
          y: e.y + Math.sin(e.attackAngle) * 100,
          z: target.altitude + 30,
        }
      : e.windup > 0 || e.burst
        ? e.attackPoint
        : rivalAim(w, e, target);
  e.angle = Math.atan2(aim.y - e.y, aim.x - e.x);
  e.pitch = Math.atan2(aim.z - e.altitude - 38, Math.hypot(aim.x - e.x, aim.y - e.y));
  e.attackAngle = e.attackKind === 'melee' && e.windup > 0 ? e.attackAngle : e.angle;
  e.attackPitch = e.pitch;
}
