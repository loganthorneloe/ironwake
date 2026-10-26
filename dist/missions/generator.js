import { MISSIONS, missionFor } from './catalog.js';
import { layoutFor } from './layouts/index.js';

// Runtime arena objects are rebuilt per sortie; authored layout data is read-only.
export function campaignRound(id, seed = 38001) {
  const spec = missionFor(id),
    index = MISSIONS.indexOf(spec),
    entry = { x: 1300, y: 1950 },
    exit = { x: 1300, y: 1900 },
    width = 2600,
    height = 2300;
  const geometry = layoutFor(spec.id);
  const points = spec.points.map(([x, y], i) => ({
    x,
    y,
    z: spec.height && i % 2 === 0 ? spec.height : 0,
  }));
  const platforms = points
    .filter((p) => p.z)
    .map((p, i) => ({ x: p.x - 180, y: p.y - 150, w: 360, h: 300, z: p.z, kind: 'deck', zone: i }));
  const ramps = platforms.map((p) => ({
    x: p.x + 20,
    y: p.y + p.h,
    w: 130,
    h: 270,
    z: p.z,
    axis: 'y',
    sign: -1,
  }));
  const obstacles = [
    { x: 0, y: 0, w: width, h: 65, height: 340 },
    { x: 0, y: height - 65, w: width, h: 65, height: 340 },
    { x: 0, y: 65, w: 65, h: height - 130, height: 340 },
    { x: width - 65, y: 65, w: 65, h: height - 130, height: 340 },
  ];
  for (const [i, [x, y, w, h]] of geometry.cargo.entries())
    obstacles.push({ x, y, w, h, height: 45 + (i % 2) * 40, cargo: true });
  for (const landmark of geometry.landmarks) obstacles.push({ ...landmark });
  const edge = geometry.edge;
  for (const x of [130, 2470])
    for (let j = 0; j < 4; j++)
      obstacles.push({
        x: x - edge[0] / 2,
        y: 430 + j * 430 - edge[1] / 2,
        w: edge[0],
        h: edge[1],
        height: edge[2],
        landmark: 'edge',
      });
  const portals = [
    [300, 350],
    [1300, 220],
    [2300, 350],
    [2300, 1150],
    [2200, 2000],
    [400, 2000],
    [300, 1150],
  ].map(([x, y]) => ({ x, y, heading: Math.atan2(1100 - y, 1300 - x) }));
  const route = [
      { x: 1600, y: 1800 },
      { x: 600, y: 1750 },
      { x: 600, y: 450 },
      { x: 2300, y: 450 },
      { x: 2300, y: 1750 },
    ],
    zones = [
      { ...entry, id: 0, name: 'ENGAGE' },
      { x: 1300, y: 1100, id: 1, name: spec.name.toUpperCase() },
      { ...exit, id: 2, name: 'EXTRACT' },
    ];
  return {
    mode: 'operation',
    raid: true,
    missionId: spec.id,
    spec,
    seed: seed >>> 0,
    name: spec.name.toUpperCase(),
    terrain: spec.theme.toUpperCase(),
    sector: index + 1,
    biome: index % 3,
    width,
    height,
    entry,
    exit,
    heading: -Math.PI / 2,
    rooms: [{ x: 1300, y: 1150, w: width, h: height }],
    zones,
    paths: [[entry, ...points, exit]],
    spine: [entry, { x: 1300, y: 1100 }, exit],
    boundaries: [],
    platforms,
    ramps,
    obstacles,
    portals,
    points,
    batteries: [],
    cells: points,
    route,
    reactor: { x: 1300, y: 1650 },
    estimatedMinutes: spec.minutes,
  };
}
