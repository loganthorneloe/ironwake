import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import { createDashEffect } from '../dist/dash-effects.js';
test('dash turns the whole model red, keeps trails bounded, restores materials and cleans up', () => {
  const root = new T.Group(),
    geometry = new T.BoxGeometry(),
    material = new T.MeshToonMaterial({ color: 0xabcdef }),
    ink = new T.LineBasicMaterial({ color: 0x123456 });
  for (let i = 0; i < 3; i++) {
    const part = new T.Mesh(geometry, material);
    part.position.set(i, 2 + i, 0);
    part.add(new T.LineSegments(new T.EdgesGeometry(geometry), ink));
    root.add(part);
  }
  const originals = [...root.children],
    fx = createDashEffect(root),
    p = { hp: 100, moveKind: 'dash', moveTime: 0.2 };
  for (let i = 0; i < 120; i++) {
    root.position.z -= 1;
    fx.update(p, 1 / 60);
  }
  assert.ok(originals.every((m) => m.children.find((c) => c.isLineSegments).material !== ink));
  assert.ok(originals.every((m) => m.children.some((c) => c.isMesh && c.visible)));
  const ribbon = root.children.find((m) => m.geometry?.attributes.color);
  assert.ok(ribbon.geometry.drawRange.count > 0);
  assert.ok(ribbon.geometry.drawRange.count <= ribbon.geometry.attributes.position.count);
  for (let i = 0; i < 60; i++) fx.update({ ...p, moveTime: 0 }, 1 / 60);
  assert.ok(originals.every((m) => m.children.find((c) => c.isLineSegments).material === ink));
  assert.equal(ribbon.visible, false);
  fx.dispose();
  assert.deepEqual(root.children, originals);
  assert.ok(originals.every((m) => m.material === material && m.geometry === geometry));
});
