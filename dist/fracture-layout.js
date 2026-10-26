// Small per-object grids, not a voxelized world. Shared by authority and visuals.
export function createFractureLayout(o) {
  const base = o.baseZ || 0,
    height = o.height - base,
    nx = Math.max(1, Math.min(4, Math.ceil(o.w / 28))),
    ny = Math.max(1, Math.min(4, Math.ceil(o.h / 28))),
    nz = Math.max(1, Math.min(8, Math.ceil(height / 28)));
  const cells = [],
    neighbors = [],
    dx = o.w / nx,
    dy = o.h / ny,
    dz = height / nz;
  for (let z = 0; z < nz; z++)
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const id = x + nx * (y + ny * z),
          links = [];
        cells.push({
          x: o.x + x * dx,
          y: o.y + y * dy,
          w: dx,
          h: dy,
          baseZ: base + z * dz,
          height: base + (z + 1) * dz,
          id,
          cx: x,
          cy: y,
          cz: z,
        });
        if (x) links.push(id - 1);
        if (x + 1 < nx) links.push(id + 1);
        if (y) links.push(id - nx);
        if (y + 1 < ny) links.push(id + nx);
        if (z) links.push(id - nx * ny);
        if (z + 1 < nz) links.push(id + nx * ny);
        neighbors.push(links);
      }
  return { cells, neighbors, nx, ny, nz, whole: [o] };
}
export const boxTouches = (o, x, y, z, r = 0, height = 0) =>
  x + r > o.x &&
  x - r < o.x + o.w &&
  y + r > o.y &&
  y - r < o.y + o.h &&
  z < (o.height || 100) &&
  z + height >= (o.baseZ || 0);
