// Continuous desktop look, with a hover/edge-turn fallback for embedded browsers.
export function createMouseLook({
  canvas,
  doc = document,
  win = window,
  active,
  look,
  onLock = () => {},
  onRelease = () => {},
  onFallback = () => {},
}) {
  let last = null,
    edge = { x: 0, y: 0 },
    touch = null,
    locked = false,
    suspended = false,
    pending = false,
    fallbackShown = false;
  const listeners = [];
  const listen = (target, name, handler) => {
    target.addEventListener(name, handler);
    listeners.push(() => target.removeEventListener(name, handler));
  };
  function reset() {
    last = null;
    edge = { x: 0, y: 0 };
    touch = null;
  }
  function fallback() {
    pending = false;
    reset();
    if (!fallbackShown) {
      fallbackShown = true;
      onFallback();
    }
  }
  function capture() {
    suspended = false;
    reset();
    if (pending || doc.pointerLockElement === canvas || !canvas.requestPointerLock) return;
    pending = true;
    try {
      const request = canvas.requestPointerLock();
      request?.catch?.(fallback);
    } catch {
      fallback();
    }
  }
  listen(doc, 'pointerlockchange', () => {
    const previous = locked;
    locked = doc.pointerLockElement === canvas;
    pending = false;
    reset();
    onLock(locked);
    if (previous && !locked) {
      suspended = true;
      onRelease();
    }
  });
  listen(doc, 'pointerlockerror', fallback);
  listen(canvas, 'mouseenter', (e) => {
    if (!locked && active() && !suspended) last = { x: e.clientX, y: e.clientY };
  });
  listen(canvas, 'mouseleave', () => {
    if (!locked) reset();
  });
  listen(doc, 'mousemove', (e) => {
    if (!active() || suspended) {
      reset();
      return;
    }
    if (locked) {
      look(e.movementX, e.movementY);
      return;
    }
    if (e.target !== canvas) {
      reset();
      return;
    }
    if (last) look(e.clientX - last.x, e.clientY - last.y);
    last = { x: e.clientX, y: e.clientY };
    const r = canvas.getBoundingClientRect(),
      band = Math.min(48, r.width * 0.06, r.height * 0.08);
    const pressure = (p, size) =>
      band > 0 ? (p < band ? -(1 - p / band) : p > size - band ? 1 - (size - p) / band : 0) : 0;
    edge = { x: pressure(e.clientX - r.left, r.width), y: pressure(e.clientY - r.top, r.height) };
  });
  listen(canvas, 'pointerdown', (e) => {
    if (e.pointerType !== 'touch' || !active()) return;
    touch = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  listen(canvas, 'pointermove', (e) => {
    if (e.pointerId !== touch?.id || !active()) return;
    look((e.clientX - touch.x) * 1.7, (e.clientY - touch.y) * 1.7);
    touch = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  listen(win, 'pointerup', (e) => {
    if (e.pointerId === touch?.id) touch = null;
  });
  listen(canvas, 'pointercancel', reset);
  listen(win, 'blur', reset);
  listen(doc, 'visibilitychange', () => {
    if (doc.hidden) reset();
  });
  listen(win, 'keydown', (e) => {
    if (e.code === 'Escape' && active()) {
      suspended = true;
      reset();
      onRelease();
    }
  });
  return {
    capture,
    reset,
    get paused() {
      return suspended;
    },
    update(dt) {
      if (!active() || locked || suspended) {
        reset();
        return;
      }
      if (edge.x || edge.y) look(edge.x * 420 * dt, edge.y * 420 * dt);
    },
    dispose() {
      listeners.forEach((remove) => remove());
      reset();
    },
  };
}
