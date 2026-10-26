import test from 'node:test';
import assert from 'node:assert/strict';
import { thirdPersonView } from '../dist/third-person-view.js';
import { blocksBullet } from '../dist/core.js';
test('third-person camera stays behind the mech across headings and follows flight altitude', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const p = { x: 120, y: -80, altitude: 95, hp: 100 },
      eye = thirdPersonView(p, { yaw, pitch: 0 });
    const dx = eye.position.x - 12,
      dz = eye.position.z + 8;
    assert.ok(Math.abs(dx * Math.cos(yaw) + dz * Math.sin(yaw) + 14) < 1e-9);
    assert.ok(Math.abs(eye.position.y - 16.3) < 1e-9);
    assert.ok(Math.abs(Math.hypot(eye.direction.x, eye.direction.y, eye.direction.z) - 1) < 1e-9);
  }
});
test('zoom moves closer while preserving look direction and altitude; extreme pitch stays finite above ground', () => {
  const p = { x: 0, y: 0, altitude: 0, hp: 100 },
    v = { yaw: 0.7, pitch: 0.4 },
    normal = thirdPersonView(p, v),
    zoom = thirdPersonView(p, { ...v, aiming: true });
  assert.deepEqual(zoom.direction, normal.direction);
  assert.ok(zoom.fov < normal.fov);
  assert.ok(
    Math.hypot(zoom.position.x, zoom.position.z) < Math.hypot(normal.position.x, normal.position.z),
  );
  for (const pitch of [-1.25, 1.25]) {
    const eye = thirdPersonView(p, { ...v, pitch });
    assert.ok(eye.position.y >= 1.4);
    assert.ok(Number.isFinite(eye.position.x));
  }
});
test('held frontal armor coverage rotates with the mech and follows altitude, leaving uncovered regions exposed', () => {
  for (const angle of [0, 0.7, Math.PI / 2, Math.PI]) {
    const p = { x: 100, y: 200, altitude: 80, hp: 100, melee: 'guard', guarding: true, angle };
    const b = {
      x: p.x + Math.cos(angle) * 25,
      y: p.y + Math.sin(angle) * 25,
      z: 111,
      vx: -Math.cos(angle) * 300,
      vy: -Math.sin(angle) * 300,
      vz: 0,
    };
    assert.equal(blocksBullet(p, b), true);
    assert.equal(blocksBullet(p, { ...b, z: 90 }), false);
    assert.equal(blocksBullet(p, { ...b, z: 135 }), false);
    assert.equal(blocksBullet({ ...p, guarding: false }, b), false);
    assert.equal(blocksBullet({ ...p, hp: 0 }, b), false);
  }
});

test('network aim preserves view yaw, pitch and the crosshair world target', async () => {
  const { getAim } = await import('../dist/three-view.js');
  const { view } = await import('../dist/view-controls.js?v=41');
  view.yaw = 0.83;
  view.pitch = 0.51;
  const a = getAim({ x: 100, y: -300, altitude: 200 });
  assert.equal(a.angle, view.yaw);
  assert.equal(a.pitch, view.pitch);
  assert.ok(a.aimPoint);
});
test('portrait camera keeps the mech visible by reducing shoulder offset', () => {
  const p = { x: 0, y: 0 },
    v = { yaw: 0, pitch: 0 };
  assert.ok(
    thirdPersonView(p, v, 390 / 844).position.z < thirdPersonView(p, v, 16 / 9).position.z * 0.4,
  );
});
