import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planetMission,
  initOperation,
  stepOperation,
  operationEnemyCap,
} from '../dist/planet-mission.js';
import { newWorld, cleanBuild, mechStats } from '../dist/core.js';
import { nearbyObstacles, segmentHitsBox, staticShotBlocked } from '../dist/collision.js';
const touches = (p, o, r = 25) =>
  p.x > o.x - r && p.x < o.x + o.w + r && p.y > o.y - r && p.y < o.y + o.h + r;
test('the freight road and every objective remain inside a continuous navigable canyon', () => {
  for (const seed of [1, 38, 39, 1001, 63872]) {
    const m = planetMission(seed);
    assert.ok(m.obstacles.some((o) => o.cliff));
    for (let i = 1; i < m.spine.length; i++) {
      const a = m.spine[i - 1],
        b = m.spine[i];
      for (let t = 0; t <= 1; t += 0.01) {
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        assert.ok(!m.obstacles.some((o) => touches(p, o, 40)), `road blocked: ${seed} / ${i}`);
      }
    }
    for (const p of [...m.batteries, ...m.cells, m.entry, m.exit, m.reactor])
      assert.ok(!m.obstacles.some((o) => touches(p, o, 50)));
    for (const p of m.portals)
      assert.ok(!m.obstacles.some((o) => touches(p, o, 70)), 'spawn gate must be unobstructed');
    for (const a of m.spine)
      assert.ok(
        m.portals.some(
          (p) => Math.hypot(a.x - p.x, a.y - p.y) > 330 && Math.hypot(a.x - p.x, a.y - p.y) < 1100,
        ),
        'encounter must have nearby gates',
      );
  }
});
for (const n of [1, 2, 3, 4])
  test(`${n} pilots get early reinforcements and a bounded horde`, () => {
    const w = newWorld(
      planetMission(38),
      Array.from({ length: n }, (_, i) => ({ id: 'p' + i, build: cleanBuild({}) })),
    );
    w.time = 1.6;
    stepOperation(w, 0.05, mechStats);
    assert.ok(w.spawn.length >= 9);
    assert.ok(w.spawn.every((s) => s.time > 3.9 && s.time < 7));
    for (let i = 0; i < 30; i++) {
      w.time += 6;
      stepOperation(w, 0.05, mechStats);
    }
    assert.equal(w.spawn.length, operationEnemyCap(n));
    const elite = { id: 'elite', elite: true, hp: 100, x: 8000, y: 5800 };
    w.enemies = [elite, { id: 'stale', hp: 1, x: 8000, y: 5800 }];
    w.spawn = [];
    w.time += 6;
    stepOperation(w, 0.05, mechStats);
    assert.ok(w.enemies.includes(elite));
    assert.ok(!w.enemies.some((e) => e.id === 'stale'));
  });
test('spatial lookup refreshes when an obstacle array is replaced or expanded', () => {
  const m = { obstacles: [] };
  assert.equal(nearbyObstacles(m, 20, 20).length, 0);
  const wall = { x: 0, y: 0, w: 50, h: 50, height: 100 };
  m.obstacles.push(wall);
  assert.ok(nearbyObstacles(m, 20, 20).includes(wall));
  m.obstacles = [{ ...wall, x: 500 }];
  assert.equal(nearbyObstacles(m, 20, 20).length, 0);
});
test('exact ray clipping blocks thin walls but allows shots above cover and beneath decks', () => {
  const wall = { x: 100, y: 0, w: 1, h: 100, height: 75 },
    m = { obstacles: [wall], platforms: [] };
  assert.ok(segmentHitsBox({ x: 0, y: 50, z: 32 }, { x: 1000, y: 50, z: 32 }, wall));
  assert.ok(!staticShotBlocked(m, { x: 0, y: 50, z: 80 }, { x: 1000, y: 50, z: 80 }));
  assert.ok(staticShotBlocked(m, { x: 0, y: 50, z: 150 }, { x: 200, y: 50, z: 0 }));
  m.obstacles = [];
  m.platforms = [{ x: 100, y: 0, w: 100, h: 100, z: 110 }];
  assert.ok(!staticShotBlocked(m, { x: 0, y: 50, z: 32 }, { x: 500, y: 50, z: 32 }));
  assert.ok(staticShotBlocked(m, { x: 150, y: 50, z: 0 }, { x: 150, y: 50, z: 150 }));
});
