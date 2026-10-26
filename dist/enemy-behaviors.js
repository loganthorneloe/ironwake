// Host-only decisions; the resulting action/phase/aim also drive guest animation.
// Seconds and world units. No animation or browser dependency in the simulation.
import { squadDestination } from './enemy-coordination.js';
export const ENEMY_ROLES = {
  hunter: {
    name: 'Hunter',
    role: 'PACK FLANKER',
    hp: 90,
    speed: 265,
    r: 18,
    height: 40,
    range: 105,
    color: '#ff7955',
    counter: 'Sidestep the crouch, punish its landing.',
  },
  wisp: {
    name: 'Wisp',
    role: 'AERIAL SKIRMISHER',
    hp: 65,
    speed: 175,
    r: 18,
    height: 34,
    hover: 100,
    range: 440,
    color: '#69dfed',
    counter: 'Close the orbit; bursts lock their aim.',
  },
  scarab: {
    name: 'Scarab',
    role: 'SUPPRESSOR',
    hp: 160,
    speed: 110,
    r: 28,
    height: 38,
    range: 360,
    color: '#ffd284',
    counter: 'Flank its braced fan or sweeping fire.',
  },
  rammer: {
    name: 'Rammer',
    role: 'LINE BREAKER',
    hp: 230,
    speed: 155,
    r: 27,
    height: 48,
    range: 290,
    color: '#ff9260',
    counter: 'Leave the charge lane; attack during the skid.',
  },
  needle: {
    name: 'Needle',
    role: 'MARKSMAN',
    hp: 85,
    speed: 155,
    r: 17,
    height: 58,
    range: 760,
    color: '#e2b1ff',
    counter: 'Break the laser sight or rush the long reload.',
  },
  mortar: {
    name: 'Bellows',
    role: 'AREA DENIAL',
    hp: 150,
    speed: 95,
    r: 27,
    height: 46,
    range: 620,
    color: '#ffc767',
    counter: 'Leave the marked impact circle or fly above it.',
  },
  mender: {
    name: 'Mender',
    role: 'FIELD SUPPORT',
    hp: 105,
    speed: 170,
    r: 20,
    height: 44,
    range: 400,
    color: '#80f2b5',
    counter: 'Interrupt the open repair petals; it cannot heal itself.',
  },
  siege: { name: 'Siege frame', role: 'HEAVY ASSAULT', range: 360, color: '#ff7955' },
};
const attack = (windup, active, recovery, extra = {}) => ({ windup, active, recovery, ...extra });
export const ENEMY_ATTACKS = {
  pounce: attack(0.46, 0.24, 0.52, { reach: 70, damage: 20, travel: 380, arc: 0.7 }),
  bite: attack(0.32, 0.12, 0.38, { reach: 78, damage: 16, arc: 1 }),
  burst: attack(0.4, 0.34, 0.45, { shots: 3, interval: 0.14, speed: 650, damage: 14 }),
  fan: attack(0.55, 0.12, 0.7, { shots: 3, spread: 0.16, speed: 550, damage: 20 }),
  sweep: attack(0.62, 0.65, 0.7, {
    shots: 5,
    interval: 0.14,
    spread: 0.14,
    speed: 570,
    damage: 18,
  }),
  charge: attack(0.66, 0.56, 0.85, { reach: 75, damage: 34, travel: 650, arc: 0.8 }),
  stomp: attack(0.58, 0.12, 0.68, { reach: 165, damage: 30, arc: Math.PI }),
  snipe: attack(0.82, 0.1, 0.95, { shots: 1, speed: 1500, damage: 38 }),
  bombard: attack(0.72, 0.12, 1.15, { radius: 120, damage: 38, flight: 0.9 }),
  mend: attack(0.6, 0.1, 1, { heal: 32, radius: 340 }),
  siegeFan: attack(0.7, 0.12, 0.75, { shots: 7, spread: 0.12, speed: 540, damage: 32 }),
  siegeBarrage: attack(0.86, 0.64, 1, {
    shots: 3,
    interval: 0.28,
    radius: 135,
    damage: 40,
    flight: 1,
  }),
  siegeStomp: attack(0.72, 0.15, 0.9, { reach: 205, damage: 48, arc: Math.PI }),
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function enemySeed(id) {
  let h = 2166136261;
  for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}
export function enemyRole(e) {
  return e.elite || e.type === 'boss'
    ? 'siege'
    : e.species || { drone: 'hunter', gunner: 'wisp', tank: 'scarab' }[e.type] || 'hunter';
}
export function cancelEnemyAction(e) {
  e.windup = 0;
  e.actionPhase = 'idle';
  e.actionTime = 0;
  e.attackKind = null;
  e.attackPoint = null;
  e.actionHits = [];
  e.cd = Math.max(e.cd || 0, 0.55);
}
function phase(e, name) {
  e.actionPhase = name;
  e.actionTime = 0;
}
// More living pilots allow overlapping crossfire, rather than taking turns.
export const enemyAttackSlots = (w) =>
  Math.min(5, Math.max(2, w.players.filter((p) => p.hp > 0).length + 1));
function damagedAlly(w, e) {
  return w.enemies
    .filter(
      (a) =>
        a !== e &&
        a.hp > 0 &&
        a.hp < a.max &&
        a.species &&
        !a.objective &&
        !a.landing &&
        distance(a, e) < 340,
    )
    .sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
}
function selectAttack(w, e, target, role) {
  const d = distance(e, target),
    n = e.actionCount || 0;
  if (role === 'siege')
    return d < 200 && Math.abs((target.altitude || 0) - (e.altitude || 0)) < 80
      ? 'siegeStomp'
      : n % 3 === 2 || (e.hp < e.max * 0.5 && n % 2)
        ? 'siegeBarrage'
        : 'siegeFan';
  if (role === 'hunter') return d < 65 ? 'bite' : 'pounce';
  if (role === 'rammer') return d < 120 ? 'stomp' : 'charge';
  if (role === 'needle') return d < 230 ? 'fan' : 'snipe';
  if (role === 'mortar') return d < 240 ? 'fan' : 'bombard';
  if (role === 'mender')
    return w.time >= (e.healReadyAt || 0) && damagedAlly(w, e) ? 'mend' : 'burst';
  if (role === 'scarab') return n % 2 ? 'sweep' : 'fan';
  return 'burst';
}
function begin(w, e, target, kind, api) {
  const a = ENEMY_ATTACKS[kind];
  e.attackKind = kind;
  e.actionCount = (e.actionCount || 0) + 1;
  e.attackTarget = target.id;
  e.actionHits = [];
  e.fired = 0;
  e.attackOrigin = { x: e.x, y: e.y };
  // Modest prediction, sampled once. Never follow input or retarget a committed attack.
  const observation = e.perception,
    lead = ['snipe', 'bombard', 'siegeBarrage'].includes(kind) ? 0.22 : 0.09;
  const vx =
    observation?.id === target.id
      ? Math.max(
          -380,
          Math.min(380, (target.x - observation.x) / Math.max(0.01, w.time - observation.time)),
        )
      : 0;
  const vy =
    observation?.id === target.id
      ? Math.max(
          -380,
          Math.min(380, (target.y - observation.y) / Math.max(0.01, w.time - observation.time)),
        )
      : 0;
  e.attackPoint = {
    x: target.x + vx * lead,
    y: target.y + vy * lead,
    z: (target.altitude || 0) + api.aimHeight(target),
  };
  if (a.radius && !a.heal)
    e.attackPoint.z = api.floor(w, e.attackPoint.x, e.attackPoint.y, target.altitude || 0);
  if (kind === 'mend') {
    const ally = damagedAlly(w, e);
    e.healTarget = ally?.id;
    e.attackPoint = ally ? { x: ally.x, y: ally.y, z: (ally.altitude || 0) + 20 } : e.attackPoint;
  }
  e.attackAngle = Math.atan2(e.attackPoint.y - e.y, e.attackPoint.x - e.x);
  e.attackPitch = Math.atan2(
    e.attackPoint.z - ((e.altitude || 0) + (e.bodyHeight || 65) * 0.6),
    distance(e, e.attackPoint),
  );
  e.angle = e.attackAngle;
  phase(e, 'windup');
  e.windup = a.windup;
  e.intent = kind.toUpperCase();
}
function projectile(w, e, a, offset, api) {
  const angle = e.attackAngle + offset,
    z = (e.altitude || 0) + (e.bodyHeight || 65) * 0.6;
  const origin = { x: e.x + Math.cos(angle) * (e.r + 5), y: e.y + Math.sin(angle) * (e.r + 5), z };
  if (!api.clear(w, { x: e.x, y: e.y, z }, origin)) return;
  const horizontal = a.speed * Math.cos(e.attackPitch);
  w.bullets.push({
    id: w.id++,
    owner: e.id,
    kind: 'enemy',
    ...origin,
    origin: { ...origin },
    vx: Math.cos(angle) * horizontal,
    vy: Math.sin(angle) * horizontal,
    vz: Math.sin(e.attackPitch) * a.speed,
    life: 2,
    enemy: true,
    damage: a.damage,
  });
  e.lastShot = w.time;
}
function execute(w, e, a, dt, api) {
  if (a.travel) {
    const length = Math.max(1, Math.ceil((a.travel * dt) / 6));
    for (let i = 0; i < length; i++)
      api.move(
        w,
        e,
        Math.cos(e.attackAngle) * a.travel,
        Math.sin(e.attackAngle) * a.travel,
        dt / length,
        e.r,
      );
    e.lastLunge = w.time;
  }
  if (a.reach) {
    for (const p of w.players) {
      const d = distance(e, p),
        delta = Math.atan2(p.y - e.y, p.x - e.x) - e.attackAngle;
      if (
        p.hp <= 0 ||
        e.actionHits.includes(p.id) ||
        d > a.reach ||
        Math.abs((p.altitude || 0) - (e.altitude || 0)) > (a.arc === Math.PI ? 75 : 50) ||
        Math.cos(delta) < Math.cos(a.arc) ||
        !api.clear(w, e, p)
      )
        continue;
      e.actionHits.push(p.id);
      api.hurt(w, p, a.damage, e, 'melee');
    }
    e.lastStrike = w.time;
  }
  if (a.heal && e.fired === 0) {
    const ally = w.enemies.find(
      (p) => p.id === e.healTarget && p.hp > 0 && !p.objective && p !== e,
    );
    if (ally && distance(e, ally) <= a.radius && api.clear(w, e, ally)) {
      ally.hp = Math.min(ally.max, ally.hp + a.heal);
      ally.healedAt = w.time;
      e.healedAt = w.time;
    }
    e.healReadyAt = w.time + 5;
    e.fired = 1;
  } else if (a.radius && !a.heal) {
    const shots = a.shots || 1;
    while (e.fired < shots && e.actionTime + 1e-8 >= e.fired * (a.interval || 0)) {
      const offset = (e.fired - (shots - 1) / 2) * 100,
        point = {
          x: e.attackPoint.x + Math.cos(e.attackAngle + Math.PI / 2) * offset,
          y: e.attackPoint.y + Math.sin(e.attackAngle + Math.PI / 2) * offset,
          z: e.attackPoint.z,
        };
      w.enemyHazards ??= [];
      if (w.enemyHazards.length < 32)
        w.enemyHazards.push({
          id: w.id++,
          owner: e.id,
          ...point,
          r: a.radius,
          damage: a.damage,
          time: a.flight,
          max: a.flight,
        });
      e.fired++;
      e.lastShot = w.time;
    }
  } else if (a.shots) {
    if (!a.interval && e.fired === 0) {
      for (let i = 0; i < a.shots; i++)
        projectile(w, e, a, (i - (a.shots - 1) / 2) * (a.spread || 0), api);
      e.fired = a.shots;
    } else
      while (e.fired < a.shots && e.actionTime + 1e-8 >= e.fired * a.interval) {
        projectile(w, e, a, (e.fired - (a.shots - 1) / 2) * (a.spread || 0), api);
        e.fired++;
      }
  }
}
function steer(w, e, target, role, dt, api) {
  const d = distance(e, target),
    angle = Math.atan2(target.y - e.y, target.x - e.x),
    profile = ENEMY_ROLES[role],
    side = enemySeed(e.id) > 0.5 ? 1 : -1;
  let destination = target,
    velocity = 1;
  const maneuver = squadDestination(w, e, target);
  if (role === 'mender') {
    const ally = damagedAlly(w, e);
    if (ally) destination = ally;
  }
  const visible = api.clear(w, e, destination),
    legacyGunner = !e.species && e.type === 'gunner',
    desired = destination === target ? (legacyGunner ? 330 : profile.range) : 220;
  // Station sentries stand on authored perches; do not backpedal off those decks.
  if (maneuver) {
    destination = maneuver;
    velocity = maneuver.speed;
    e.intent = maneuver.intent;
  } else if (legacyGunner && visible && d <= desired) {
    e.intent = 'HOLDING';
    return;
  } else if (visible && d < desired * 0.72 && role !== 'hunter' && role !== 'rammer') {
    destination = {
      x: e.x - Math.cos(angle) * 200,
      y: e.y - Math.sin(angle) * 200,
      altitude: e.altitude,
    };
    e.intent = 'WITHDRAWING';
  } else if (visible && d < desired * 1.15) {
    if (!legacyGunner && ['wisp', 'hunter', 'mender'].includes(role)) {
      const orbit = angle + side * (role === 'hunter' ? 0.85 : Math.PI / 2);
      destination = {
        x: e.x + Math.cos(orbit) * 180,
        y: e.y + Math.sin(orbit) * 180,
        altitude: e.altitude,
      };
      velocity = role === 'hunter' ? 0.85 : 0.55;
      e.intent = 'FLANKING';
    } else {
      e.intent = 'HOLDING';
      return;
    }
  } else e.intent = role === 'hunter' ? 'STALKING' : 'REPOSITIONING';
  const way = api.waypoint(w, e, destination),
    a = Math.atan2(way.y - e.y, way.x - e.x),
    x = e.x,
    y = e.y;
  api.move(w, e, Math.cos(a) * e.speed * velocity, Math.sin(a) * e.speed * velocity, dt, e.r);
  if (distance(e, { x, y }) < e.speed * dt * 0.25)
    api.move(w, e, Math.cos(a + side * 1.2) * e.speed, Math.sin(a + side * 1.2) * e.speed, dt, e.r);
  e.angle = angle;
}
export function stepEnemy(w, e, dt, api) {
  const role = enemyRole(e);
  e.behavior = role;
  e.altitude =
    e.hover || Math.max(api.floor(w, e.x, e.y, e.altitude || 0), (e.altitude || 0) - 210 * dt);
  e.stun = Math.max(0, (e.stun || 0) - dt);
  if (e.hp <= 0 || e.stun > 0) {
    cancelEnemyAction(e);
    e.intent = 'STAGGERED';
    return;
  }
  e.cd = Math.max(0, (e.cd || 0) - dt);
  if (e.actionPhase && e.actionPhase !== 'idle') {
    const a = ENEMY_ATTACKS[e.attackKind];
    if (!a) {
      cancelEnemyAction(e);
      return;
    }
    e.actionTime += dt;
    e.angle = e.attackAngle;
    // Wisps keep strafing through bursts and the back half of recovery. Only
    // their local body pose is stepped; world movement and collision stay smooth.
    if (
      role === 'wisp' &&
      (e.actionPhase === 'active' || (e.actionPhase === 'recovery' && e.actionTime > 0.16))
    ) {
      const side = enemySeed(e.id) > 0.5 ? 1 : -1,
        angle = e.attackAngle + (side * Math.PI) / 2;
      api.move(w, e, Math.cos(angle) * e.speed * 0.5, Math.sin(angle) * e.speed * 0.5, dt, e.r);
    }
    if (e.actionPhase === 'windup') {
      e.windup = Math.max(0, a.windup - e.actionTime);
      if (e.windup <= 1e-8) {
        e.windup = 0;
        phase(e, 'active');
        execute(w, e, a, 0, api);
      }
    } else if (e.actionPhase === 'active') {
      execute(w, e, a, dt, api);
      if (e.actionTime + 1e-8 >= a.active) {
        phase(e, 'recovery');
        e.intent = 'RECOVERING';
      }
    } else if (e.actionTime + 1e-8 >= a.recovery) {
      phase(e, 'idle');
      e.cd = 0.12 + enemySeed(e.id) * 0.2;
    }
    return;
  }
  const living = w.players.filter((p) => p.hp > 0);
  if (!living.length) {
    cancelEnemyAction(e);
    return;
  }
  // Hysteresis prevents nearest-player oscillation; each enemy favors a different flank.
  const nearest = [...living].sort((a, b) => distance(a, e) - distance(b, e))[0],
    previous = living.find((p) => p.id === e.targetId),
    ordered = living.find((p) => p.id === e.squadOrder?.targetId),
    target =
      ordered && distance(e, ordered) < 1200
        ? ordered
        : previous && distance(previous, e) < distance(nearest, e) * 1.3 + 100
          ? previous
          : nearest;
  e.targetId = target.id;
  const d = distance(e, target),
    kind = selectAttack(w, e, target, role),
    a = ENEMY_ATTACKS[kind],
    inRange =
      kind === 'mend' ||
      d < (role === 'hunter' ? 145 : role === 'rammer' ? 440 : role === 'needle' ? 1150 : 950);
  const vertical = !a.reach || Math.abs((target.altitude || 0) - (e.altitude || 0)) < 60;
  // Count committed actions only: bullets already in flight still overlap.
  const committed = w.enemies.filter(
    (other) =>
      other !== e &&
      other.hp > 0 &&
      other.attackTarget === target.id &&
      ['windup', 'active'].includes(other.actionPhase) &&
      other.attackKind !== 'mend',
  ).length;
  const sightTarget = kind === 'mend' ? damagedAlly(w, e) : target;
  const order = e.squadOrder,
    maneuver = squadDestination(w, e, target);
  const ready =
    !order || order.until <= w.time
      ? true
      : order.kind === 'rush'
        ? w.time >= order.rushAt
        : !maneuver || w.time - order.start >= 0.65;
  if (
    ready &&
    e.cd === 0 &&
    inRange &&
    vertical &&
    sightTarget &&
    api.clear(w, e, sightTarget) &&
    (kind === 'mend' || committed < enemyAttackSlots(w))
  ) {
    begin(w, e, target, kind, api);
    return;
  }
  steer(w, e, target, role, dt, api);
  // Bounded separation is locomotion only: never displace a planted warning or active attack.
  let sx = 0,
    sy = 0;
  for (const other of w.enemies) {
    if (
      other === e ||
      other.hp <= 0 ||
      other.objective ||
      Math.abs((other.altitude || 0) - (e.altitude || 0)) > 40
    )
      continue;
    const apart = distance(e, other),
      radius = e.r + other.r + 10;
    if (apart < radius) {
      const angle =
          apart > 0.01 ? Math.atan2(e.y - other.y, e.x - other.x) : enemySeed(e.id) * Math.PI * 2,
        force = (1 - apart / radius) * 100;
      sx += Math.cos(angle) * force;
      sy += Math.sin(angle) * force;
    }
  }
  const norm = Math.max(1, Math.hypot(sx, sy) / 120);
  api.move(w, e, sx / norm, sy / norm, dt, e.r);
  if (!e.perception || w.time - e.perception.time >= 0.16)
    e.perception = { id: target.id, x: target.x, y: target.y, time: w.time };
}
export function stepEnemyHazards(w, dt, api) {
  for (const h of w.enemyHazards || []) {
    h.time -= dt;
    if (h.time > 0) continue;
    for (const p of w.players)
      if (
        p.hp > 0 &&
        distance(p, h) < h.r &&
        Math.abs((p.altitude || 0) - h.z) < 75 &&
        api.clear(w, { ...h, z: h.z + 8 }, p)
      )
        api.hurt(w, p, h.damage, h, 'blast');
    w.effects.push({
      id: w.id++,
      x: h.x,
      y: h.y,
      z: h.z + 3,
      r: h.r,
      kind: 'explosion',
      weapon: 'landing',
      life: 0.65,
      max: 0.65,
    });
  }
  w.enemyHazards = (w.enemyHazards || []).filter((h) => h.time > 0);
}
