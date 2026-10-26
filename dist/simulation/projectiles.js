// Advance projectile collision and apply direct impacts and blast damage.
import { chassisBounds } from '../chassis.js';
import { blocksBullet, BULWARK } from '../bulwark.js?v=41';
import { fieldModifiers } from '../sortie-progression.js';
import { damageStructureAt, damageStructureArea } from '../destruction.js';
import { dist } from './math.js';
import { shotBlocked, clearPath } from './geometry.js';
import { effect } from './effects.js';
import { structureDamage, damageEnemy, staggerEnemy, hurt } from './damage.js';
import { guideRocket } from './missile-guidance.js';
import { weaponHit, bulletTouches } from './weapon-status.js';

export function stepProjectiles(w, dt) {
  for (const b of w.bullets) {
    if (b.kind === 'launcher') guideRocket(w, b, dt);
    if (b.blockedAtLaunch) {
      b.life = 0;
      continue;
    }
    const steps = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy, b.vz || 0) * dt) / 6));
    for (let i = 0; i < steps && b.life > 0; i++) {
      b.x += (b.vx * dt) / steps;
      b.y += (b.vy * dt) / steps;
      b.z = (b.z ?? 38) + ((b.vz || 0) * dt) / steps;
      b.life -= dt / steps;
      if (b.z < 0 || shotBlocked(w.mission, b.x, b.y, b.z)) {
        if (!b.splash && b.z >= 0)
          damageStructureAt(
            w,
            b,
            structureDamage(w, b.owner, b.damage, b.kind),
            b.kind || 'bullet',
          );
        b.life = 0;
        effect(w, b.x, b.y, 12, '#a7cbbd', 0.13);
        break;
      }
      if (b.enemy) {
        for (const p of w.players)
          if (
            p.hp > 0 &&
            b.z >= (p.altitude || 0) &&
            b.z < (p.altitude || 0) + chassisBounds(p.build).height &&
            (dist(p, b) < chassisBounds(p.build).radius || blocksBullet(p, b))
          ) {
            const blocked = p.guarding && blocksBullet(p, b);
            hurt(
              w,
              p,
              b.damage *
                (blocked
                  ? Math.max(
                      0.08,
                      1 - BULWARK.reduction - (fieldModifiers(p).shieldPower || 0) * 0.5,
                    )
                  : 1),
              b,
              blocked ? 'guard' : 'bullet',
            );
            if (blocked) p.guardHitTime = w.time;
            b.life = 0;
            effect(w, b.x, b.y, 18, '#ee7950', 0.2);
            break;
          }
      } else {
        for (const e of w.enemies)
          if (
            e.hp > 0 &&
            b.z >= (e.altitude || 0) &&
            b.z <
              (e.altitude || 0) +
                (e.bodyHeight ?? (e.type === 'boss' ? 108 : e.type === 'tank' ? 75 : 58)) &&
            !b.hit.includes(e.id) &&
            bulletTouches(w, b, e)
          ) {
            if (!b.splash) weaponHit(w, b, e);
            const owner = w.players.find((p) => p.id === b.owner);
            if (owner) {
              owner.hits = (owner.hits || 0) + 1;
              owner.hitTime = w.time;
            }
            b.hit.push(e.id);
            b.pierce--;
            effect(w, b.x, b.y, 18, e.stun > 0 ? '#90d8ed' : '#ffad7b', 0.2);
            if (b.pierce <= 0) {
              b.life = 0;
              break;
            }
          }
      }
    }
  }
  for (const b of w.bullets)
    if (b.splash && b.life <= 0) {
      damageStructureArea(
        w,
        b,
        b.splash,
        structureDamage(w, b.owner, b.damage, b.kind),
        b.kind || 'blast',
      );
      w.effects.push({
        id: w.id++,
        x: b.x,
        y: b.y,
        z: b.z,
        r: b.splash,
        color: b.kind === 'plasma' ? '#b38aff' : '#ffc46b',
        kind: 'explosion',
        weapon: b.kind,
        life: b.kind === 'plasma' ? 0.95 : 0.8,
        max: b.kind === 'plasma' ? 0.95 : 0.8,
      });
      for (const e of w.enemies) {
        const d = Math.hypot(e.x - b.x, e.y - b.y, (e.altitude || 0) + 32 - b.z);
        if (e.hp > 0 && d < b.splash && clearPath(w, b, e)) {
          damageEnemy(
            w,
            e,
            b.damage * (b.hit?.includes(e.id) ? 1 : 1 - (0.65 * d) / b.splash),
            b.owner,
            b.kind || 'blast',
          );
          if (b.stun) staggerEnemy(w, e, b.stun);
          const p = w.players.find((p) => p.id === b.owner);
          if (p) {
            p.hits++;
            p.hitTime = w.time;
          }
        }
      }
    }
  w.bullets = w.bullets.filter((b) => b.life > 0);
}
