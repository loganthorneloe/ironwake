import * as T from './vendor/three.module.min.js';
import { impactLevel } from './impact-preferences.js';

const SHOT_KICK = {
  carbine: 0.13,
  rotary: 0.055,
  scatter: 0.65,
  rail: 0.75,
  dynamo: 0.8,
  launcher: 0.5,
  plasma: 0.24,
};
// Camera impulses are applied only AFTER the authoritative aiming ray is sampled.
// Save/restore the clean pose so presentation shake never feeds back into aiming.
export function createCombatFeel(canvas) {
  const overlay = document.createElement('div');
  overlay.className = 'impact-screen';
  overlay.setAttribute('aria-hidden', 'true');
  const paths = Array.from({ length: 26 }, (_, i) => {
    const angle = ((i + 0.3) * Math.PI * 2) / 26,
      x = Math.cos(angle),
      y = Math.sin(angle),
      start = 0.61 + (i % 4) * 0.055;
    return (
      '<path d="M' +
      (500 + x * 570 * start) +
      ' ' +
      (350 + y * 420 * start) +
      'L' +
      (500 + x * 680) +
      ' ' +
      (350 + y * 510) +
      '" stroke-width="' +
      (i % 3 ? 1.3 : 3) +
      '"/>'
    );
  }).join('');
  overlay.innerHTML =
    '<svg class="impact-speed-lines" viewBox="0 0 1000 700" preserveAspectRatio="none"><g>' +
    paths +
    '</g></svg><div class="impact-reticle"><i></i><i></i><i></i><i></i></div><div class="impact-damage-edge"></div><svg class="impact-armor-cracks" viewBox="0 0 1000 700" preserveAspectRatio="none"><path d="M0 130 82 180 38 205 146 269M0 550 120 510 83 479 167 443M1000 110 901 173 939 206 849 245M1000 590 882 539 919 510 843 475"/></svg><div class="impact-hit-direction"><i></i></div><div class="impact-armor-readout"></div>';
  canvas.parentElement.append(overlay);
  const speedLines = overlay.querySelector('svg'),
    reticle = overlay.querySelector('.impact-reticle'),
    edge = overlay.querySelector('.impact-damage-edge');
  const cracks = overlay.querySelector('.impact-armor-cracks'),
    indicator = overlay.querySelector('.impact-hit-direction'),
    readout = overlay.querySelector('.impact-armor-readout');
  const position = new T.Vector3(),
    quaternion = new T.Quaternion(),
    offset = new T.Vector3(),
    forward = new T.Vector3(),
    right = new T.Vector3();
  let saved = false,
    baseFov = 72,
    kick = 0,
    shake = 0,
    hit = 0,
    hurt = 0,
    speed = 0,
    heavy = false,
    precision = false,
    meleeHit = false,
    hurtPower = 0,
    hurtSide = 0,
    blocked = false;
  let shots = [],
    lastHp = null,
    lastHurt = null,
    lastMove = 0,
    lastBlast = 0,
    lastDamage = 0,
    initialized = false;
  function armorHit(amount, event, self, camera) {
    blocked = event?.weapon === 'guard';
    hurt = 0.55;
    hurtPower = Math.min(1.6, 0.5 + amount / 28) * (blocked ? 0.5 : 1);
    shake = Math.min(2.6, shake + hurtPower * 1.5);
    kick = Math.min(2.3, kick + hurtPower * 0.5);
    if (camera && event) {
      camera.getWorldDirection(forward);
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      const dx = event.sourceX - self.x,
        dz = event.sourceY - self.y,
        length = Math.hypot(dx, dz);
      hurtSide = length > 0.01 ? (dx * right.x + dz * right.z) / length : 0;
      indicator.style.transform =
        'rotate(' +
        Math.atan2(hurtSide, length > 0.01 ? (dx * forward.x + dz * forward.z) / length : 1) +
        'rad)';
    } else hurtSide = 0;
    overlay.dataset.blocked = String(blocked);
    readout.textContent =
      (blocked ? 'GUARD IMPACT' : 'ARMOR HIT') + ' −' + Math.max(1, Math.round(amount));
  }
  return {
    reset() {
      saved = false;
      kick = shake = hit = hurt = speed = hurtPower = hurtSide = 0;
      shots = [];
      lastHp = lastHurt = null;
      lastMove = lastBlast = lastDamage = 0;
      initialized = false;
      overlay.style.opacity = '0';
    },
    restore(camera) {
      if (!saved) return;
      camera.position.copy(position);
      camera.quaternion.copy(quaternion);
      camera.fov = baseFov;
      camera.updateProjectionMatrix();
      saved = false;
    },
    update(world, self, dt, t, camera) {
      const full = impactLevel() === 1;
      kick *= Math.exp(-dt * 16);
      shake *= Math.exp(-dt * 15);
      hurtPower *= Math.exp(-dt * 9);
      hit = Math.max(0, hit - dt);
      hurt = Math.max(0, hurt - dt);
      if (!hit) heavy = precision = meleeHit = false;
      const hands = self.hands || [self];
      hands.forEach((hand, i) => {
        const count = hand.shotCount || 0;
        if (initialized && count > (shots[i] || 0))
          kick = Math.min(1.6, kick + (SHOT_KICK[hand.item || self.weapon] || 0));
        shots[i] = count;
      });
      if (initialized && (self.moveCount || 0) > lastMove) {
        kick = Math.min(1.6, kick + 0.55);
        shake = Math.min(1, shake + 0.25);
      }
      lastMove = self.moveCount || 0;
      let received = false;
      for (const event of world.damageEvents || []) {
        if (event.id <= lastDamage) continue;
        lastDamage = event.id;
        if (!initialized || event.life < 0.75) continue;
        if (event.kind === 'incoming' && event.target === self.id) {
          armorHit(event.amount, event, self, camera);
          received = true;
          continue;
        }
        if (event.owner !== self.id || event.kind === 'burn' || event.kind === 'phaser') continue;
        const melee = ['melee', 'hammer', 'lance', 'claws', 'scythe', 'dash'].includes(event.kind);
        hit = 0.23;
        heavy = heavy || event.amount >= 120;
        precision = precision || event.kind === 'precision';
        meleeHit = meleeHit || melee;
        if (heavy || melee) {
          kick = Math.min(2.3, kick + (melee ? 0.55 : 0.35));
          shake = Math.min(1.2, shake + (melee ? 0.48 : 0.2));
        }
      }
      // Timestamp fallback covers snapshots where healing masks a net HP drop,
      // or where a busy co-op fight evicted the matching short-lived event.
      if (
        initialized &&
        !received &&
        ((lastHp !== null && self.hp < lastHp) || (lastHurt !== null && self.lastHurt > lastHurt))
      )
        armorHit(Math.max(1, (lastHp ?? self.hp) - self.hp), null, self, camera);
      lastHp = self.hp;
      lastHurt = self.lastHurt ?? -10;
      for (const event of world.effects || []) {
        if (event.id <= lastBlast || event.kind !== 'explosion') continue;
        lastBlast = event.id;
        if (!initialized || event.max - event.life > 0.16) continue;
        const distance = Math.hypot(
          event.x - self.x,
          event.y - self.y,
          (event.z || 0) - (self.altitude || 0),
        );
        const power = Math.max(0, 1 - distance / 950) * Math.min(1, (event.r || 100) / 180);
        shake = Math.min(2.6, shake + power * 1.25);
        kick = Math.min(2.3, kick + power * 0.4);
      }
      initialized = true;
      const throttle =
        self.hp > 0 ? (self.moveTime > 0 ? 1 : self.boosting ? 0.25 : self.airborne ? 0.12 : 0) : 0;
      speed = T.MathUtils.lerp(speed, throttle, 1 - Math.exp(-dt * 12));
      overlay.style.opacity = '1';
      overlay.dataset.reduced = String(!full);
      speedLines.style.opacity = String(
        full ? Math.min(0.7, speed * 0.48 + (meleeHit ? hit * 1.5 : 0)) : 0,
      );
      speedLines.style.transform = 'scale(' + (1 + ((t * 2) % 1) * 0.04) + ')';
      reticle.style.opacity = String(hit > 0 ? Math.min(1, hit / 0.07) : 0);
      reticle.style.transform = 'scale(' + (full ? 1 + hit * 1.8 : 1) + ')';
      reticle.dataset.heavy = String(heavy);
      reticle.dataset.precision = String(precision);
      edge.style.opacity = String(full ? Math.min(0.8, hurt * 1.4) : 0);
      cracks.style.opacity = String(full ? Math.min(0.75, hurtPower * 0.65) : 0);
      indicator.style.opacity = String(Math.min(1, hurt * 3));
      readout.style.opacity = String(Math.min(1, hurt * 3));
      readout.style.transform =
        'translateX(-50%) translateY(' + (full ? -hurtPower * 8 : 0) + 'px)';
    },
    apply(camera, t) {
      position.copy(camera.position);
      quaternion.copy(camera.quaternion);
      baseFov = camera.fov;
      saved = true;
      if (impactLevel() !== 1) return;
      offset
        .set(
          Math.sin(t * 49) * shake * 0.075 - hurtSide * hurtPower * 0.14,
          Math.cos(t * 61) * shake * 0.055,
          kick * 0.16,
        )
        .applyQuaternion(camera.quaternion);
      camera.position.add(offset);
      camera.rotateX(kick * 0.007 + Math.sin(t * 47) * shake * 0.003);
      camera.rotateZ(Math.sin(t * 33) * shake * 0.004 - hurtSide * hurtPower * 0.018);
      camera.fov += Math.min(4.5, kick * 2.3);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    },
  };
}
