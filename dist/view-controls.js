export const view = {
  yaw: -Math.PI / 2,
  pitch: -0.06,
  aiming: false,
  locked: false,
  strafing: false,
  strafeYaw: -Math.PI / 2,
};
export function resetView() {
  view.yaw = -Math.PI / 2;
  view.pitch = -0.06;
  view.aiming = false;
  setStrafe(false);
  view.strafeYaw = view.yaw;
}
export function setStrafe(held) {
  if (held && !view.strafing) view.strafeYaw = view.yaw;
  view.strafing = !!held;
}
export function look(dx, dy) {
  view.yaw += Math.max(-160, Math.min(160, dx)) * 0.0024 * (view.aiming ? 0.55 : 1);
  view.pitch = Math.max(-1.25, Math.min(1.25, view.pitch - dy * 0.002 * (view.aiming ? 0.55 : 1)));
}
export function relativeMovement(strafe, forward, yaw = view.yaw) {
  return {
    x: Math.cos(yaw) * forward - Math.sin(yaw) * strafe,
    y: Math.sin(yaw) * forward + Math.cos(yaw) * strafe,
  };
}

export function movementInput(keys = {}, touch = {}) {
  const strafe = +!!keys.KeyD - +!!keys.KeyA + (touch.x || 0),
    forward = +!!(keys.KeyW || keys.ArrowUp) - +!!(keys.KeyS || keys.ArrowDown) - (touch.y || 0);
  return {
    ...relativeMovement(strafe, forward, view.strafing ? view.strafeYaw : view.yaw),
    sprint: Math.hypot(strafe, forward) > 0,
    fly: !!keys.Space || !!touch.fly,
  };
}
// Mouse events report every button transition; pointerdown only reports the first held button.
export function mouseButtons(buttons) {
  return { left: !!(buttons & 1), right: !!(buttons & 2) };
}
