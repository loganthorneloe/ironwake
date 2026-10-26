import { ENEMY_ATTACKS, enemySeed, enemyRole } from './enemy-behaviors.js';
// Authored keys: crouch, pitch, roll, turret, petals. Animation never changes
// simulation clocks or actor position. Only body articulation uses held frames.
const poses = {
  pounce: [
    [-0.65, -0.28, 0, 0, 0],
    [0.9, 0.35, 0, 0, 0],
    [-0.5, 0.2, 0, 0, 0],
  ],
  bite: [
    [-0.15, -0.2, 0.1, 0, 0],
    [0.1, 0.38, -0.12, 0, 0],
    [0, 0.1, 0, 0, 0],
  ],
  burst: [
    [0.35, -0.15, -0.2, -0.12, 0],
    [0.1, 0.12, 0.15, 0.14, 0],
    [0, 0.08, 0, 0.08, 0],
  ],
  fan: [
    [-0.3, -0.15, 0, -0.18, 0],
    [-0.45, 0.22, 0, 0.28, 0],
    [-0.2, 0.12, 0, 0.12, 0],
  ],
  sweep: [
    [-0.4, -0.12, -0.12, -0.35, 0],
    [-0.3, 0.15, 0.12, 0.2, 0],
    [-0.15, 0.08, 0.08, 0.15, 0],
  ],
  charge: [
    [-0.55, -0.36, 0, 0, 0],
    [-0.25, 0.48, 0, 0, 0],
    [-0.65, 0.3, 0, 0, 0],
  ],
  stomp: [
    [-0.6, -0.4, 0, 0, 0],
    [-0.8, 0.5, 0, 0, 0],
    [-0.4, 0.2, 0, 0, 0],
  ],
  snipe: [
    [-0.18, -0.04, 0, -0.15, 0],
    [-0.28, 0.16, 0, 0.4, 0],
    [-0.12, 0.1, 0, 0.22, 0],
  ],
  bombard: [
    [-0.5, -0.18, 0, 0.9, 0],
    [-0.65, 0.28, 0, 0.35, 0],
    [-0.3, 0.14, 0, 0.55, 0],
  ],
  mend: [
    [0.45, -0.08, 0, 0, 1],
    [0.65, -0.1, 0, 0, 1],
    [0.15, 0.08, 0, 0, 0.4],
  ],
  siegeFan: [
    [-0.4, -0.22, 0, -0.15, 0],
    [-0.6, 0.28, 0, 0.4, 0],
    [-0.25, 0.12, 0, 0.15, 0],
  ],
  siegeBarrage: [
    [-0.45, -0.3, 0, -0.8, 0],
    [-0.6, 0.25, 0, -0.3, 0],
    [-0.2, 0.15, 0, -0.4, 0],
  ],
  siegeStomp: [
    [-0.8, -0.5, 0, 0, 0],
    [-1, 0.55, 0, 0, 0],
    [-0.5, 0.2, 0, 0, 0],
  ],
};
const clamp = (t) => Math.max(0, Math.min(1, t));
const smooth = (t) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a.map((n, i) => n + (b[i] - n) * t),
  zero = [0, 0, 0, 0, 0];
export const ENEMY_MOTION = {
  hunter: { energy: 1.45, elastic: 1, bounce: 0.42, sway: 0.07, lag: 0.42 },
  wisp: { energy: 1.25, elastic: 0.85, bounce: 0.55, sway: 0.2, lag: 0.32 },
  scarab: { energy: 1.15, elastic: 0.3, bounce: 0.12, sway: 0.035, lag: 0.16 },
  rammer: { energy: 1.4, elastic: 0.4, bounce: 0.2, sway: 0.055, lag: 0.2 },
  needle: { energy: 1.18, elastic: 0.5, bounce: 0.24, sway: 0.07, lag: 0.32 },
  mortar: { energy: 1.15, elastic: 0.25, bounce: 0.1, sway: 0.03, lag: 0.17 },
  mender: { energy: 1.25, elastic: 0.9, bounce: 0.35, sway: 0.12, lag: 0.5 },
  siege: { energy: 1.3, elastic: 0.2, bounce: 0.1, sway: 0.025, lag: 0.14 },
};
const heldTime = (time, fps, end) => (time >= end ? end : Math.floor(time * fps + 1e-7) / fps);
function spring(time, duration, elastic) {
  const t = clamp(time / Math.max(0.001, duration));
  return Math.sin(t * Math.PI * (elastic > 0.6 ? 5 : 3)) * Math.exp(-t * 3.5) * (1 - smooth(t));
}
export function enemyPose(p, { style = 'anime', reduced = false, time = 0 } = {}) {
  const a = ENEMY_ATTACKS[p.attackKind],
    keys = poses[p.attackKind],
    profile = ENEMY_MOTION[enemyRole(p)];
  const anime = style === 'anime',
    extras = anime && !reduced,
    elapsed = Math.max(0, p.actionTime || 0);
  let pose = zero,
    forward = 0,
    twist = 0,
    squash = 0,
    stretch = 0,
    kick = 0,
    secondary = 0,
    smear = 0,
    brace = 0;
  if (a && keys && p.hp !== 0) {
    if (p.actionPhase === 'windup') {
      const time = extras ? heldTime(elapsed, 12, a.windup) : elapsed;
      pose = mix(zero, keys[0], smooth(time / (a.windup * (anime ? 0.5 : 0.65))));
      if (anime) {
        const load = smooth(time / (a.windup * 0.5));
        forward = (a.travel ? -0.5 : -0.12) * load;
        brace = 0.15 * load;
        if (extras) {
          squash = 0.055 * profile.elastic * load;
          twist =
            (p.attackKind === 'bite' ? -0.16 : p.attackKind === 'sweep' ? -0.12 : 0.035) * load;
        }
      }
    } else if (p.actionPhase === 'active') {
      pose = mix(keys[0], keys[1], smooth(elapsed / (anime ? 0.035 : 0.065)));
      if (anime) {
        const pop = smooth(elapsed / 0.035);
        forward = (a.travel ? 0.65 : a.heal ? 0 : -0.2) * pop;
        brace = 0.25 * pop;
        if (extras) {
          stretch =
            (a.travel ? 0.12 : 0.065) * profile.elastic * Math.sin(clamp(elapsed / 0.13) * Math.PI);
          kick = Math.sin(clamp(elapsed / 0.14) * Math.PI);
          secondary = kick * profile.lag;
          smear = a.travel
            ? 0.7 + 0.3 * Math.sin(clamp(elapsed / a.active) * Math.PI)
            : a.reach
              ? Math.sin(clamp(elapsed / 0.11) * Math.PI)
              : 0;
        }
      }
    } else if (p.actionPhase === 'recovery') {
      const time = extras ? heldTime(elapsed, 18, a.recovery) : elapsed,
        brake = anime ? 0.1 : 0.16;
      pose =
        time < brake
          ? mix(keys[1], keys[2], smooth(time / brake))
          : mix(keys[2], zero, smooth((time - brake) / Math.max(0.01, a.recovery - brake)));
      if (anime) {
        const settle = 1 - smooth(time / a.recovery);
        forward = (a.travel ? -0.25 : 0.12) * settle;
        brace = 0.18 * settle;
        if (extras) {
          const rebound = spring(Math.max(0, time - brake), a.recovery - brake, profile.elastic);
          pose[0] += rebound * 0.55 * profile.elastic;
          pose[1] += rebound * 0.16;
          secondary = rebound * profile.lag;
          twist = rebound * 0.09;
          squash = Math.max(0, -rebound) * 0.04 * profile.elastic;
        }
      }
    }
    if (anime) {
      pose = [
        pose[0] * (1 + 0.35 * profile.energy),
        pose[1] * (1 + 0.35 * profile.energy),
        pose[2] * 1.45,
        pose[3],
        pose[4],
      ];
    }
  }
  if (p.stun > 0) {
    pose = [-0.35, 0.22, 0.12, 0, 0];
    forward = twist = squash = stretch = kick = secondary = smear = brace = 0;
  }
  const comboAge = time - (p.comboAt ?? -10);
  if (anime && !reduced && comboAge >= 0 && comboAge < 0.42) {
    const reaction = Math.sin((comboAge / 0.42) * Math.PI) * (1 - comboAge / 0.42);
    pose[1] -= reaction * 0.5;
    pose[2] += reaction * 0.28;
    secondary += reaction * 0.4;
    brace += reaction * 0.25;
  }
  return {
    height: pose[0],
    pitch: pose[1],
    roll: pose[2],
    turret: pose[3],
    petals: pose[4],
    forward,
    twist,
    squash,
    stretch,
    kick,
    secondary,
    smear,
    brace,
  };
}
// Shared by actual siege rendering and the lab, so previews cannot drift from play.
export function applyEnemyPose(g, p, options = {}) {
  const pose = enemyPose(p, options),
    u = g.userData;
  u.body.position.set(0, pose.height, -pose.forward);
  u.body.rotation.set(pose.pitch, pose.twist, pose.roll);
  // Mild silhouette deformation. Rigid/heavy roles receive much less than scouts.
  u.body.scale.set(
    1 + pose.squash - pose.stretch * 0.3,
    1 - pose.squash + pose.stretch,
    1 + pose.squash * 0.4 - pose.stretch * 0.25,
  );
  if (!u.robot)
    for (let i = 0; i < (u.arms?.length || 0); i++) {
      u.arms[i].rotation.z += (i ? 1 : -1) * pose.brace;
      u.arms[i].rotation.x -= pose.brace * 0.4;
    }
  return pose;
}
export function locomotionStyle(p) {
  const role = enemyRole(p),
    variation = 0.92 + enemySeed(p.id) * 0.16,
    profile = ENEMY_MOTION[role];
  return {
    stride:
      ({ hunter: 0.65, scarab: 0.32, rammer: 0.45, needle: 0.48, mortar: 0.23, mender: 0.35 }[
        role
      ] || 0.45) * variation,
    cadence:
      ({ hunter: 1.6, scarab: 1.1, rammer: 1.25, needle: 1.4, mortar: 0.85, mender: 1.2 }[role] ||
        1) * variation,
    phase: enemySeed(p.id) * Math.PI * 2,
    ...profile,
  };
}
