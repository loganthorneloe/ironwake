// Shared damage, mitigation, repair procs and combat presentation events.
import { cancelEnemyAction } from '../enemy-behaviors.js';
import { recordTeamHit } from '../team-combos.js';
import { missionTuning } from '../mission-catalog.js';
import { ABILITIES } from '../catalog/abilities.js';
import { careerModifiers, combatStats } from '../builds/combat-stats.js';
import { fieldModifiers } from '../sortie-progression.js';
import { fieldHitMultiplier, fieldArea, fieldMitigation } from '../field-combat.js';
import { random, dist, spatialDist } from './math.js';
import { clearPath } from './geometry.js';

export function staggerEnemy(w, e, duration) {
  if (w.time < (e.staggerReadyAt || 0)) return;
  e.stun = Math.max(e.stun, duration);
  if (e.behavior) cancelEnemyAction(e);
  e.windup = 0;
  e.staggerReadyAt = w.time + duration + 0.9;
}

export function damageEnemy(w, e, amount, owner, kind = 'hit') {
  if (e.hp <= 0 || e.locked) return 0;
  const attacker = w.players.find((p) => p.id === owner),
    m = fieldModifiers(attacker),
    proc = ['chain', 'thorns', 'burn'].includes(kind);
  // Arcs inherit an already amplified primary hit and have a final per-proc cap.
  if (kind === 'chain') amount = Math.min(120, amount);
  if (attacker) {
    if (kind !== 'chain') {
      const career = careerModifiers(attacker);
      amount *=
        career.damage *
        (e.objective || e.elite || e.type === 'tank' ? career.heavyDamage : 1) *
        fieldHitMultiplier(attacker, e, kind, m);
    }
    e.lastHitBy = owner;
    if (!proc && m.critChance > 0 && random(w) < Math.min(0.75, m.critChance)) {
      amount *= 1.5 + (m.critDamage || 0);
      kind = 'precision';
    }
  }
  const applied = Math.min(e.hp, amount);
  e.hp -= applied;
  const combo = recordTeamHit(w, e, applied, owner, kind);
  if (combo?.kind === 'break') staggerEnemy(w, e, 0.28);
  if (attacker?.field) {
    attacker.field.damage += applied;
    if (attacker.hp > 0) {
      const max = combatStats(attacker).hp;
      // Repair procs have a per-pilot budget, so rapid and multi-target weapons stay bounded.
      if (w.time >= (attacker.field.leechAt || 0)) {
        attacker.field.leechAt = w.time;
        attacker.field.leechBudget = Math.min(
          24,
          (attacker.field.leechBudget || 0) +
            24 * Math.max(0, w.time - (attacker.field.leechTick ?? w.time)),
        );
        attacker.field.leechTick = w.time;
        const heal = Math.min(applied * (m.lifesteal || 0), attacker.field.leechBudget);
        attacker.hp = Math.min(max, attacker.hp + heal);
        attacker.field.leechBudget -= heal;
      }
      if (e.hp <= 0) attacker.hp = Math.min(max, attacker.hp + (m.killHeal || 0));
    }
    if (!proc && e.hp > 0 && m.burnChance > 0 && random(w) < Math.min(1, m.burnChance)) {
      e.burnOwner = owner;
      e.burnUntil = w.time + 2;
      e.burnNext ??= w.time + 0.25;
    }
    if (
      !proc &&
      m.chainDamage > 0 &&
      w.time >= (attacker.field.chainAt || 0) &&
      random(w) < Math.min(0.75, m.chainChance || 0)
    ) {
      const other = w.enemies
        .filter(
          (q) =>
            q !== e &&
            q.hp > 0 &&
            !q.locked &&
            Math.hypot(q.x - e.x, q.y - e.y, (q.altitude || 0) - (e.altitude || 0)) <
              220 * fieldArea(m) &&
            clearPath(w, e, q),
        )
        .sort((a, b) => dist(e, a) - dist(e, b))[0];
      if (other) {
        attacker.field.chainAt = w.time + 0.4;
        damageEnemy(w, other, Math.min(120, applied * m.chainDamage), owner, 'chain');
        w.effects.push({
          id: w.id++,
          kind: 'system',
          x: other.x,
          y: other.y,
          z: (other.altitude || 0) + 30,
          r: 40,
          color: '#8bcde6',
          life: 0.3,
          max: 0.3,
        });
      }
    }
  }
  if (e.type === 'rival') {
    e.lastAttacker = owner;
    e.lastDamaged = w.time;
  }
  w.damageEvents ??= [];
  w.damageEvents.push({
    id: w.id++,
    x: e.x,
    y: e.y,
    z: (e.altitude || 0) + 65,
    amount: Math.round(applied),
    owner,
    kind,
    life: 1,
  });
  if (w.damageEvents.length > 64) w.damageEvents.shift();
  return applied;
}

export function structureDamage(w, owner, amount, kind) {
  const p = typeof owner === 'object' ? owner : w.players.find((p) => p.id === owner);
  if (!p) return amount;
  const career = careerModifiers(p);
  return (
    amount *
    career.damage *
    career.heavyDamage *
    fieldHitMultiplier(p, { objective: true, hp: 1, max: 1 }, kind, fieldModifiers(p))
  );
}

export function shieldFactor(p) {
  const m = fieldModifiers(p);
  return Math.max(0.15, 0.4 - (m.shieldPower || 0) - (m.specialPower || 0) * 0.2);
}

export function shielded(w, t) {
  return w.players
    .filter(
      (p) =>
        p.hp > 0 &&
        (p.activeAbility || p.build.ability) === 'shield' &&
        p.active > 0 &&
        spatialDist(p, t) < ABILITIES.shield.radius * fieldArea(fieldModifiers(p)),
    )
    .sort((a, b) => shieldFactor(a) - shieldFactor(b))[0];
}

export function hurt(w, t, d, source = t, weapon = 'hit') {
  if (w.mission.raid) d *= missionTuning(w.mission.sector - 1, w.players.length).damage;
  if (w.time < (t.recoverUntil || 0)) return;
  const before = t.hp,
    mods = fieldModifiers(t),
    shield = shielded(w, t);
  t.hp = Math.max(
    0,
    t.hp -
      d *
        0.6 *
        (shield ? shieldFactor(shield) : 1) *
        careerModifiers(t).damageReduction *
        fieldMitigation(mods),
  );
  t.recoverUntil = w.time + 0.3;
  t.lastHurt = w.time;
  // Replicated presentation event: no changes to damage, shielding or recovery.
  if (before > t.hp) {
    if (mods.thorns > 0 && t.hp > 0) {
      const target = w.enemies
        .filter(
          (e) =>
            e.hp > 0 &&
            !e.objective &&
            Math.hypot(e.x - t.x, e.y - t.y, (e.altitude || 0) - (t.altitude || 0)) < 260 &&
            clearPath(w, t, e),
        )
        .sort((a, b) => dist(t, a) - dist(t, b))[0];
      if (target) damageEnemy(w, target, Math.min(120, mods.thorns), t.id, 'thorns');
    }
    w.damageEvents ??= [];
    w.damageEvents.push({
      id: w.id++,
      x: t.x,
      y: t.y,
      z: Math.max(
        (t.altitude || 0) + 12,
        Math.min((t.altitude || 0) + 54, source.z ?? (t.altitude || 0) + 35),
      ),
      amount: Math.round((before - t.hp) * 10) / 10,
      target: t.id,
      kind: 'incoming',
      weapon,
      sourceX: source.x - (source.vx || 0) * 0.08,
      sourceY: source.y - (source.vy || 0) * 0.08,
      life: 1,
    });
    if (w.damageEvents.length > 64) w.damageEvents.shift();
  }
}
