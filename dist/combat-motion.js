// Shared strike timing keeps authoritative damage aligned with the animated contact.
export const STRIKES = { blade: 0.26, lance: 0.34, hammer: 0.43, claws: 0.25, scythe: 0.38 };
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
// Shoulder XYZ, elbow X, wrist XYZ, torso yaw, torso lean, piston extension.
const idle = [0.15, 0, -0.12, 0.4, -0.85, 0, 0, 0, 0, 0];
const poses = {
  blade: [
    [0.45, 1.05, -0.45, 0.9, -0.55, 0.3, -0.4, 0.38, -0.06, 0],
    [0.9, -1.15, -0.2, 0.22, -0.9, -0.2, 0.3, -0.38, 0.12, 0],
  ],
  lance: [
    [-0.25, 0.1, -0.3, 1.15, -0.9, 0, 0, 0.2, -0.1, 0],
    [1.2, -0.1, -0.12, 0.08, -1.28, 0, 0, -0.12, 0.22, 1.5],
  ],
  hammer: [
    [2.6, 0.1, -0.3, 0.45, -0.55, 0, 0, 0.16, -0.18, 0],
    [0.8, -0.1, -0.12, 0.35, -1.55, 0, 0, -0.14, 0.32, 0],
  ],
  claws: [
    [0.15, 0.5, -0.4, 0.9, -0.9, 0, -0.4, 0.2, -0.05, 0],
    [1.2, -0.35, -0.1, 0.1, -1.4, 0, 0.4, -0.22, 0.12, 0],
  ],
  scythe: [
    [0.6, 1.65, -0.35, 0.65, -0.55, 0, -0.25, 0.65, -0.08, 0],
    [0.85, -1.65, -0.2, 0.18, -0.9, 0, 0.2, -0.65, 0.1, 0],
  ],
};
export function meleePose(id, progress, count = 1) {
  const pair = poses[id] || poses.blade,
    hit = STRIKES[id] || 0.26;
  let values = idle.slice(),
    trail = false;
  if (progress >= 0 && progress < 1) {
    const start = hit * 0.72,
      end = hit + 0.055;
    let a, b, u;
    if (progress < start) {
      a = idle;
      b = pair[0];
      u = smooth(progress / start);
    }
    // Accelerate into the SAME authoritative contact frame, hold the silhouette,
    // then recover slowly. Neither strike times nor weapon cadence change.
    else if (progress < hit) {
      a = pair[0];
      b = pair[1];
      u = 1 - Math.pow(1 - (progress - start) / (hit - start), 3);
      trail = true;
    } else if (progress < end) {
      a = pair[1];
      b = pair[1];
      u = 1;
      trail = true;
    } else {
      a = pair[1];
      b = idle;
      u = smooth((progress - end) / (1 - end));
    }
    values = a.map((v, i) => mix(v, b[i], u));
    if ((id === 'blade' || id === 'claws') && count % 2 === 0) {
      values[1] *= -1;
      values[5] *= -1;
      values[6] *= -1;
      values[7] *= -1;
    }
  }
  return { values, trail };
}
export const recoilFor = {
  dynamo: 0.78,
  carbine: 0.27,
  scatter: 0.95,
  rail: 0.8,
  launcher: 0.6,
  plasma: 0.4,
  rotary: 0.13,
};
// Immediate attack, brief overshoot, spring return; independent of frame rate.
export const recoilEnvelope = (age) =>
  age >= 0 && age < 0.45 ? Math.exp(-age * 16) * Math.cos(age * 26) : 0;
