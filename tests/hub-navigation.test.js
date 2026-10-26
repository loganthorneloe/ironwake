import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HUB_SOLIDS,
  HUB_STATIONS,
  hubRoute,
  hubSnapshot,
  syncHubPlayers,
  setHubInput,
  stepHub,
  nearStation,
} from '../dist/hub-state.js';

const json = (value) => JSON.parse(JSON.stringify(value));
const fresh = () => syncHubPlayers(null, [{ id: 'pilot' }]);
function assertWalkable(p) {
  assert.ok(p.x >= -40 && p.x <= 40 && p.z >= -22 && p.z <= 27, 'pilot stays on the deck');
  assert.ok(
    !HUB_SOLIDS.some(
      (o) => p.x > o.x - 0.9 && p.x < o.x + o.w + 0.9 && p.z > o.z - 0.9 && p.z < o.z + o.d + 0.9,
    ),
    `pilot entered a solid at ${p.x},${p.z}`,
  );
}
// Match the view's normalized input and <1m waypoint consumption, then use the
// host's real movement rather than teleporting between graph nodes.
function follow(state, points, { dt = 1 / 60, transport = false } = {}) {
  const route = points.map((p) => ({ x: p.x, z: p.z })),
    p = state.players[0];
  let remote = json(hubSnapshot(state)).players[0],
    input = { x: 0, z: 0 };
  for (let frame = 0; frame < 50 / dt; frame++) {
    if (transport && frame % 5 === 0) remote = json(hubSnapshot(state)).players[0];
    const observed = transport ? remote : p;
    while (route.length && Math.hypot(route[0].x - observed.x, route[0].z - observed.z) < 1)
      route.shift();
    if (!route.length) {
      setHubInput(state, p.id, { x: 0, z: 0 });
      assertWalkable(p);
      return;
    }
    const dx = route[0].x - observed.x,
      dz = route[0].z - observed.z,
      length = Math.hypot(dx, dz);
    if (!transport || frame % 3 === 0) input = json({ x: dx / length, z: dz / length });
    setHubInput(state, p.id, input);
    stepHub(state, dt);
    assertWalkable(p);
  }
  assert.fail(`route stalled at ${p.x},${p.z} with ${route.length} waypoints left`);
}
function navigate(state, station, options) {
  const route = hubRoute(state.players[0], station);
  assert.ok(route.length, `route exists to ${station.id}`);
  follow(state, route, options);
  assert.ok(
    nearStation(state, 'pilot', station.id),
    `arrived within interaction range of ${station.id}`,
  );
}

test('station markers escape the reachable rear strip behind Command at normal and capped frame steps', () => {
  for (const dt of [1 / 60, 0.05])
    for (const station of HUB_STATIONS) {
      const state = fresh();
      follow(
        state,
        [
          { x: 10, z: 19 },
          { x: 10, z: -22 },
          { x: 0, z: -22 },
        ],
        { dt },
      );
      assert.ok(state.players[0].z < -21, 'manual movement really reached behind Command');
      navigate(state, station, { dt });
    }
});

test('ordinary spawn, both outer aisles and repeated station visits stay navigable', () => {
  const approaches = [
    [],
    [
      { x: 10, z: 19 },
      { x: 40, z: 19 },
      { x: 40, z: -22 },
    ],
    [
      { x: -10, z: 19 },
      { x: -40, z: 19 },
      { x: -40, z: -22 },
    ],
  ];
  for (const approach of approaches)
    for (const station of HUB_STATIONS) {
      const state = fresh();
      follow(state, approach);
      navigate(state, station);
      // Visiting the other four vendors must not depend on returning to arrival.
      for (const next of HUB_STATIONS) navigate(state, next);
    }
});

test('guest marker routes survive the existing 80ms poses and 50ms input transport cadence', () => {
  for (const station of HUB_STATIONS) {
    const state = fresh();
    follow(state, [
      { x: 10, z: 19 },
      { x: 10, z: -22 },
      { x: 0, z: -22 },
    ]);
    navigate(state, station, { transport: true });
  }
});

test('routing rejects invalid or solid endpoints without mutating players, stations or prior routes', () => {
  const state = fresh(),
    p = state.players[0],
    station = HUB_STATIONS[0],
    before = json({ state, station });
  const first = hubRoute(p, station);
  assert.ok(first.length);
  first[0].x = 999;
  assert.deepEqual({ state, station }, before);
  assert.notEqual(hubRoute(p, station)[0].x, 999);
  const invalid = [
    null,
    {},
    { x: NaN, z: 0 },
    { x: 0, z: Infinity },
    { x: 0, z: -12 },
    { x: 0, z: -23 },
    { x: 41, z: 0 },
  ];
  for (const value of invalid) {
    assert.deepEqual(hubRoute(p, value), []);
    assert.deepEqual(hubRoute(value, station), []);
  }
  assert.deepEqual({ state, station }, before);
});
