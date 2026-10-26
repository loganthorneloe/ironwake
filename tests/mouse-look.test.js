import test from 'node:test';
import assert from 'node:assert/strict';
import { createMouseLook } from '../dist/mouse-look.js';
import {
  view,
  resetView,
  look,
  setStrafe,
  movementInput,
  mouseButtons,
} from '../dist/view-controls.js';
import { newWorld, testPlatform, setInput, step } from '../dist/core.js';

function surface() {
  const handlers = new Map();
  return {
    addEventListener(type, handler) {
      const list = handlers.get(type) || [];
      list.push(handler);
      handlers.set(type, list);
    },
    removeEventListener(type, handler) {
      handlers.set(
        type,
        (handlers.get(type) || []).filter((h) => h !== handler),
      );
    },
    emit(type, event = {}) {
      for (const handler of handlers.get(type) || []) handler({ target: this, ...event });
    },
  };
}
function harness() {
  const canvas = surface(),
    doc = surface(),
    win = surface(),
    moves = [],
    state = { active: true, releases: 0, fallbacks: 0, captures: 0 };
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 700 });
  canvas.setPointerCapture = () => {};
  canvas.requestPointerLock = () => {
    state.captures++;
  };
  const control = createMouseLook({
    canvas,
    doc,
    win,
    active: () => state.active,
    look: (x, y) => moves.push([x, y]),
    onRelease: () => state.releases++,
    onFallback: () => state.fallbacks++,
  });
  const move = (x, y, buttons = 0) =>
    doc.emit('mousemove', { target: canvas, clientX: x, clientY: y, buttons });
  return { canvas, doc, win, moves, state, control, move };
}

test('uncaptured mouse aims before any click and continues after both weapon buttons release', () => {
  const h = harness();
  h.move(400, 300);
  h.move(425, 310);
  assert.deepEqual(h.moves, [[25, 10]]);
  assert.equal(h.state.captures, 0);
  h.move(450, 320, 3);
  h.move(475, 330, 0);
  assert.deepEqual(h.moves.at(-1), [25, 10]);
  h.canvas.emit('mouseleave');
  h.move(800, 500);
  assert.equal(h.moves.length, 3, 're-entry seeds position instead of jumping');
  h.move(810, 500);
  assert.deepEqual(h.moves.at(-1), [10, 0]);
});

test('a rejected pointer lock keeps hover aiming, reports once and allows a later user gesture to retry', async () => {
  const h = harness();
  h.canvas.requestPointerLock = () => Promise.reject(Error('embedded browser'));
  h.control.capture();
  await Promise.resolve();
  h.doc.emit('pointerlockerror');
  assert.equal(h.state.fallbacks, 1);
  h.move(400, 300);
  h.move(500, 350);
  assert.deepEqual(h.moves, [[100, 50]]);
  assert.equal(h.control.paused, false);
  h.canvas.requestPointerLock = () => {
    h.state.captures++;
  };
  h.control.capture();
  assert.equal(h.state.captures, 1);
  h.doc.pointerLockElement = h.canvas;
  h.doc.emit('pointerlockchange');
  h.doc.emit('mousemove', { movementX: 4, movementY: 2 });
  assert.deepEqual(h.moves.at(-1), [4, 2]);
});

test('captured mouse aims with no buttons; releasing capture pauses until explicit resume', () => {
  const h = harness();
  h.control.capture();
  h.doc.pointerLockElement = h.canvas;
  h.doc.emit('pointerlockchange');
  h.doc.emit('mousemove', { movementX: 20, movementY: -10, buttons: 0 });
  assert.deepEqual(h.moves, [[20, -10]]);
  h.doc.pointerLockElement = null;
  h.doc.emit('pointerlockchange');
  assert.equal(h.state.releases, 1);
  assert.equal(h.control.paused, true);
  h.move(400, 300);
  h.move(500, 300);
  assert.equal(h.moves.length, 1);
  h.control.capture();
  h.move(500, 300);
  h.move(520, 300);
  assert.deepEqual(h.moves.at(-1), [20, 0]);
});

test('fallback turns at a stationary screen edge, then stops over menus, outside the canvas or after Escape', () => {
  const h = harness();
  h.move(1000, 350);
  h.control.update(0.1);
  assert.deepEqual(h.moves, [[42, 0]]);
  h.doc.emit('mousemove', { target: {} });
  h.control.update(0.1);
  assert.equal(h.moves.length, 1);
  h.move(1000, 350);
  h.state.active = false;
  h.control.update(0.1);
  h.move(900, 350);
  assert.equal(h.moves.length, 1);
  h.state.active = true;
  h.move(500, 350);
  h.move(510, 350);
  assert.deepEqual(h.moves.at(-1), [10, 0]);
  h.win.emit('keydown', { code: 'Escape' });
  h.move(600, 350);
  h.control.update(0.1);
  assert.equal(h.moves.length, 2);
  assert.equal(h.state.releases, 1);
});

test('focus loss, touch cancellation and disposal clear motion without a re-entry jump', () => {
  const h = harness();
  h.move(400, 300);
  h.move(410, 300);
  h.win.emit('blur');
  h.move(800, 300);
  assert.equal(h.moves.length, 1);
  h.canvas.emit('pointerdown', { pointerType: 'touch', pointerId: 2, clientX: 100, clientY: 100 });
  h.canvas.emit('pointermove', { pointerId: 3, clientX: 200, clientY: 200 });
  assert.equal(h.moves.length, 1);
  h.canvas.emit('pointermove', { pointerId: 2, clientX: 110, clientY: 120 });
  assert.deepEqual(h.moves.at(-1), [17, 34]);
  h.canvas.emit('pointercancel');
  h.canvas.emit('pointermove', { pointerId: 2, clientX: 200, clientY: 200 });
  assert.equal(h.moves.length, 2);
  h.control.dispose();
  h.move(900, 300);
  h.control.update(0.1);
  assert.equal(h.moves.length, 2);
});

test('strafe lock preserves world movement through mouse turns while actual mech aim and both weapons remain independent', () => {
  resetView();
  view.yaw = 0;
  setStrafe(true);
  look(160, 0);
  look(160, 0);
  setStrafe(true);
  const movement = movementInput({ KeyW: true, Space: true }),
    hands = mouseButtons(3);
  assert.equal(movement.x, 1);
  assert.equal(movement.y, 0);
  assert.equal(movement.fly, true);
  assert.notEqual(view.yaw, 0);
  const w = newWorld(testPlatform(), [
      { id: 'p', build: { equipment: ['carbine', 'carbine', 'emp'] } },
    ]),
    p = w.players[0],
    before = { x: p.x, y: p.y };
  setInput(w, 'p', { ...movement, ...hands, angle: view.yaw, pitch: view.pitch });
  step(w, 0.02);
  assert.ok(p.x > before.x);
  assert.equal(p.y, before.y);
  assert.equal(p.angle, view.yaw);
  assert.equal(p.shotCount, 2);
  setStrafe(false);
  const released = movementInput({ KeyW: true });
  assert.ok(released.y > 0);
  assert.equal(released.x, Math.cos(view.yaw));
  setStrafe(true);
  assert.equal(view.strafeYaw, view.yaw);
  resetView();
  assert.equal(view.strafing, false);
});
