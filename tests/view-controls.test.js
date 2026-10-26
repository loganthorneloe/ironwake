import test from 'node:test';
import assert from 'node:assert/strict';
import {
  relativeMovement,
  movementInput,
  view,
  look,
  resetView,
  mouseButtons,
} from '../dist/view-controls.js';
test('movement follows camera forward and right at cardinal headings', () => {
  let p = relativeMovement(0, 1, -Math.PI / 2);
  assert.ok(Math.abs(p.x) < 1e-9);
  assert.equal(p.y, -1);
  p = relativeMovement(1, 0, -Math.PI / 2);
  assert.equal(p.x, 1);
  p = relativeMovement(0, 1, 0);
  assert.equal(p.x, 1);
  assert.equal(p.y, 0);
});
test('mouse pitch stays bounded and resetting camera clears focus aim', () => {
  look(200, 10000);
  assert.equal(view.pitch, -1.25);
  look(0, -10000);
  assert.equal(view.pitch, 1.25);
  view.aiming = true;
  resetView();
  assert.equal(view.aiming, false);
  assert.equal(view.yaw, -Math.PI / 2);
});

test('Space flies independently and Shift alone never moves the mech', () => {
  resetView();
  view.yaw = 0;
  assert.deepEqual(movementInput({ Space: true }), { x: 0, y: 0, sprint: false, fly: true });
  assert.equal(movementInput({ KeyQ: true }).fly, false);
  for (const shift of ['ShiftLeft', 'ShiftRight']) {
    const m = movementInput({ [shift]: true, Space: true });
    assert.equal(m.x, 0);
    assert.equal(m.y, 0);
    assert.equal(m.fly, true);
    assert.equal(m.sprint, false);
  }
  assert.equal(movementInput({}).sprint, false);
});

test('boost respects all eight movement directions at every camera heading', () => {
  for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI, 0.83]) {
    view.yaw = yaw;
    for (const [keys, strafe, forward] of [
      [{ KeyA: true }, -1, 0],
      [{ KeyD: true }, 1, 0],
      [{ KeyS: true }, 0, -1],
      [{ KeyW: true }, 0, 1],
      [{ KeyW: true, KeyA: true }, -1, 1],
      [{ KeyW: true, KeyD: true }, 1, 1],
      [{ KeyS: true, KeyA: true }, -1, -1],
      [{ KeyS: true, KeyD: true }, 1, -1],
    ]) {
      const expected = relativeMovement(strafe, forward, yaw);
      for (const fly of [false, true]) {
        const actual = movementInput({ ...keys, Space: fly });
        assert.ok(Math.abs(actual.x - expected.x) < 1e-9);
        assert.ok(Math.abs(actual.y - expected.y) < 1e-9);
        assert.equal(actual.sprint, true);
        assert.equal(actual.fly, fly);
      }
    }
  }
  resetView();
});
test('directional touch input and opposing keys never force forward boost', () => {
  view.yaw = 0;
  assert.equal(movementInput({ ShiftRight: true }, { x: -1 }).x, 0);
  assert.equal(movementInput({ ShiftRight: true }, { x: -1 }).y, -1);
  const stopped = movementInput({ ShiftLeft: true, KeyW: true, KeyS: true });
  assert.equal(stopped.x, 0);
  assert.equal(stopped.y, 0);
  resetView();
});

test('mouse chord independently holds either hand, both hands and either release order', () => {
  assert.deepEqual(mouseButtons(2), { left: false, right: true });
  assert.deepEqual(mouseButtons(3), { left: true, right: true });
  assert.deepEqual(mouseButtons(1), { left: true, right: false });
  assert.deepEqual(mouseButtons(3), { left: true, right: true });
  assert.deepEqual(mouseButtons(2), { left: false, right: true });
  assert.deepEqual(mouseButtons(0), { left: false, right: false });
});
