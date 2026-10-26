// Practice maps and seeded legacy mission generation.
import { rng, clamp } from './math.js';

export function testPlatform() {
  return {
    mode: 'sandbox',
    seed: 84901,
    name: 'TEST PLATFORM',
    sector: 0,
    terrain: 'OPEN DECK',
    biome: 0,
    heading: -Math.PI / 2,
    width: 4200,
    height: 3000,
    entry: { x: 0, y: 0 },
    exit: { x: 0, y: 0 },
    rooms: [{ x: 0, y: 0, w: 480, h: 480 }],
    paths: [],
    zones: [],
    obstacles: [],
    platforms: [],
    ramps: [],
    boundaries: [],
  };
}

export function combatTrial() {
  return { ...testPlatform(), mode: 'trial', seed: 84902, name: 'COMBAT TRIAL' };
}

export function mission(seed) {
  const r = rng(seed),
    biome = Math.floor(r() * 3),
    names = [
      ['CINDER', 'EMBER', 'ASHEN'],
      ['SILENT', 'FROZEN', 'PALE'],
      ['DUST', 'RUST', 'HOLLOW'],
    ],
    suffix = ['FALL', 'REACH', 'RIFT', 'HORIZON', 'WATCH'];
  const width = 4200,
    height = 3000,
    cell = 60,
    cols = width / cell,
    rows = height / cell,
    tiles = Array(cols * rows).fill(0),
    rooms = [],
    paths = [];
  const carve = (x, y, w, h) => {
    for (
      let j = Math.max(0, Math.floor(y / cell));
      j < Math.min(rows, Math.ceil((y + h) / cell));
      j++
    )
      for (
        let i = Math.max(0, Math.floor(x / cell));
        i < Math.min(cols, Math.ceil((x + w) / cell));
        i++
      )
        tiles[j * cols + i] = 1;
  };
  let row = 1 + Math.floor(r() * 3);
  for (let i = 0; i < 7; i++) {
    if (i) row = clamp(row + (r() < 0.5 ? -1 : 1), 0, 4);
    const room = { x: 300 + i * 600, y: 300 + row * 600, w: 480, h: 480 };
    rooms.push(room);
    carve(room.x - 240, room.y - 240, 480, 480);
    if (i) {
      const prev = rooms[i - 1],
        bend = r() < 0.5 ? { x: room.x, y: prev.y } : { x: prev.x, y: room.y };
      const path = [{ x: prev.x, y: prev.y }, bend, { x: room.x, y: room.y }];
      paths.push(path);
      for (let j = 1; j < path.length; j++) {
        const a = path[j - 1],
          b = path[j];
        carve(
          Math.min(a.x, b.x) - 120,
          Math.min(a.y, b.y) - 120,
          Math.abs(a.x - b.x) + 240,
          Math.abs(a.y - b.y) + 240,
        );
      }
    }
  }
  // Merge solid cells into large wall rectangles; routes are at least 240 units wide.
  const obstacles = [],
    used = new Set();
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const id = y * cols + x;
      if (tiles[id] || used.has(id)) continue;
      let w = 1;
      while (x + w < cols && !tiles[id + w] && !used.has(id + w)) w++;
      let h = 1;
      outer: while (y + h < rows) {
        for (let i = 0; i < w; i++)
          if (tiles[(y + h) * cols + x + i] || used.has((y + h) * cols + x + i)) break outer;
        h++;
      }
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) used.add((y + j) * cols + x + i);
      obstacles.push({
        x: x * cell,
        y: y * cell,
        w: w * cell,
        h: h * cell,
        height: 360,
        wall: true,
      });
    }
  // Offset cover leaves room centers and corridor entrances clear.
  for (const room of rooms.slice(1, -1))
    for (const dx of [-1, 1]) {
      const dy = r() < 0.5 ? -1 : 1;
      obstacles.push({
        x: room.x + dx * 155 - 35,
        y: room.y + dy * 155 - 35,
        w: 70,
        h: 70,
        height: 50 + Math.floor(r() * 45),
      });
    }
  const boundaries = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      if (tiles[y * cols + x])
        for (const [nx, ny] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const xx = x + nx,
            yy = y + ny;
          if (xx >= 0 && yy >= 0 && xx < cols && yy < rows && !tiles[yy * cols + xx])
            boundaries.push({ x: x * cell + 30 + nx * 29, y: y * cell + 30 + ny * 29, nx, ny });
        }
  const zones = rooms.slice(1, -1).map((p, i) => ({
    ...p,
    id: i,
    name:
      i === 4
        ? 'WARDEN DECK'
        : ['DOCKING ARRAY', 'REACTOR SPINE', 'TRANSIT BRIDGE', 'ORBITAL FOUNDRY'][i],
    boss: i === 4,
    variant: Math.floor(r() * 3),
  }));
  const platforms = [],
    ramps = [];
  for (const zone of zones) {
    const sign = zone.variant % 2 ? 1 : -1,
      z = 90 + (zone.id % 2) * 15;
    platforms.push({
      x: zone.x - 210,
      y: zone.y + (sign > 0 ? 95 : -215),
      w: 420,
      h: 120,
      z,
      zone: zone.id,
      kind: 'deck',
    });
    platforms.push({
      x: zone.x + 70,
      y: zone.y + (sign > 0 ? -205 : 105),
      w: 115,
      h: 100,
      z: z + 65,
      zone: zone.id,
      kind: 'perch',
    });
    ramps.push({
      x: zone.x - 205,
      y: zone.y + (sign > 0 ? -175 : -95),
      w: 100,
      h: 270,
      z,
      axis: 'y',
      sign,
      zone: zone.id,
    });
  }
  for (let i = obstacles.length - 1; i >= 0; i--)
    if (
      !obstacles[i].wall &&
      ramps.some(
        (r) =>
          obstacles[i].x < r.x + r.w + 25 &&
          obstacles[i].x + obstacles[i].w > r.x - 25 &&
          obstacles[i].y < r.y + r.h + 25 &&
          obstacles[i].y + obstacles[i].h > r.y - 25,
      )
    )
      obstacles.splice(i, 1);
  return {
    seed,
    biome,
    name: names[biome][Math.floor(r() * 3)] + ' ' + suffix[Math.floor(r() * suffix.length)],
    sector: Math.floor(r() * 88) + 10,
    terrain: ['HELIOS SHIPYARD', 'EUROPA ARRAY', 'VESPER RING'][biome],
    obstacles,
    width,
    height,
    rooms,
    paths,
    zones,
    boundaries,
    platforms,
    ramps,
    entry: rooms[0],
    exit: rooms[6],
    heading: Math.atan2(paths[0][1].y - rooms[0].y, paths[0][1].x - rooms[0].x),
  };
}
