import { chassisFor } from './chassis.js';
// Camera coordinates are render units (one tenth of simulation units).
export function thirdPersonView(p, view, aspect = 16 / 9) {
  const scale = chassisFor(p.build).scale,
    yaw = view.yaw,
    pitch = view.pitch,
    distance = (view.aiming ? 9 : 14) * scale,
    side = (view.aiming ? 1.8 : 3.3) * scale * Math.min(1, Math.max(0.3, aspect / 1.4));
  const pivot = { x: p.x * 0.1, y: (p.altitude || 0) * 0.1 + 4.8 * scale, z: p.y * 0.1 };
  const position = {
    x: pivot.x - Math.cos(yaw) * Math.cos(pitch) * distance - Math.sin(yaw) * side,
    y: Math.max(1.4 * scale, pivot.y + 2 * scale - Math.sin(pitch) * distance),
    z: pivot.z - Math.sin(yaw) * Math.cos(pitch) * distance + Math.cos(yaw) * side,
  };
  return {
    pivot,
    position,
    direction: {
      x: Math.cos(yaw) * Math.cos(pitch),
      y: Math.sin(pitch),
      z: Math.sin(yaw) * Math.cos(pitch),
    },
    fov: view.aiming ? 44 : p.boosting ? 80 : 72,
  };
}
