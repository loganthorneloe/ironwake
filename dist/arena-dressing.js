// Bounded, instanced art dressing. Geometry stays outside traversable lanes.
export function dressArena(add, m, box, tube, shard) {
  const w = m.width * 0.1,
    d = m.height * 0.1,
    accent = m.spec.color,
    steel = '#415862',
    dark = '#243a45',
    pale = '#8b9b9c',
    warm = '#d6aa70';
  // Thin cladding sits on the existing wall's inner face, rather than disappearing inside it.
  for (const z of [0, d])
    for (let x = 10; x < w; x += 20) {
      const inside = z === 0 ? 6.52 : d - 6.52;
      add(x, 16, inside, 1.8, 32, 0.06, steel);
      add(x, 31, inside, 4.2, 0.8, 0.08, pale);
      add(x, 23, inside + (z === 0 ? 0.06 : -0.06), 2.7, 0.5, 0.12, warm, box, true);
      add(x + 8, 7, inside, 8, 0.3, 0.08, '#687b80');
    }
  for (const x of [0, w])
    for (let z = 15; z < d; z += 20) {
      const inside = x === 0 ? 6.52 : w - 6.52;
      add(inside, 16, z, 0.06, 32, 1.8, steel);
      add(inside, 31, z, 0.08, 0.8, 4.2, pale);
    }
  // Service lanes, sparse wear panels and landing-pad markings replace a uniform test grid.
  for (let z = 12; z < d - 10; z += 24)
    for (const x of [w * 0.28, w * 0.72]) {
      add(x, 0.041, z, 2.2, 0.03, 7, '#8b846d');
      add(x + 2, 0.045, z, 0.3, 0.03, 7, '#b5a785');
    }
  for (let i = 0; i < 22; i++) {
    const x = 12 + ((i * 43) % (w - 24)),
      z = 12 + ((i * 71) % (d - 24));
    add(x, 0.035, z, 8, 0.025, 5, i % 3 ? '#4a5555' : '#57625f');
  }
  const pad = m.exit;
  for (const side of [-1, 1])
    for (let i = 0; i < 4; i++)
      add(pad.x * 0.1 + side * 15, 0.13, pad.y * 0.1 - 9 + i * 6, 3, 0.08, 1.4, warm, box, true);
  // Distant infrastructure breaks the horizon while leaving combat and aim collision intact.
  for (const side of [-1, 1])
    for (let i = 0; i < 7; i++) {
      const x = side < 0 ? -30 - (i % 2) * 13 : w + 30 + (i % 2) * 13,
        z = 12 + i * 34,
        h = 36 + ((i * 13) % 30);
      add(x, h / 2 - 3, z, 15, h, 19, '#2b414d');
      add(x, h - 2, z, 17, 2, 21, '#455967');
      add(x, h * 0.7, z + 9.6, 8, 0.8, 0.12, '#69919b');
      if (i % 2 === 0) {
        add(x, h + 9, z, 1, 20, 1, steel);
        add(x, h + 18, z, 1.5, 1, 1.5, warm, box, true);
      }
    }
  for (let i = 0; i < 8; i++) {
    const x = 16 + i * 32,
      h = 40 + ((i * 17) % 36),
      theme = m.spec.theme;
    if (theme === 'crystal') {
      add(x, h * 0.65, -25, 13, h * 0.65, 11, '#655e80', shard, false, i * 0.4);
      add(x + 8, h * 0.35, -17, 8, h * 0.35, 8, accent, shard, false, -i * 0.3);
      continue;
    }
    if (theme === 'spillway') {
      add(x, h / 2, -25, 11, h, 11, steel, tube);
      for (const y of [12, h - 3]) add(x, y, -25, 12, 1.4, 12, pale, tube);
      add(x, h + 1, -25, 10, 1, 10, '#7ba7ac', tube);
      continue;
    }
    if (theme === 'foundry') {
      add(x, h / 2, -25, 5, h, 5, dark, tube);
      for (let y = 14; y < h; y += 10) add(x, y, -25, 5.5, 1, 5.5, pale, tube);
      add(x, h, -25, 4.8, 1, 4.8, accent, tube, true);
      continue;
    }
    if (['antenna', 'spire'].includes(theme)) {
      add(x, 17, -25, 14, 34, 18, '#304650');
      add(x, h / 2 + 25, -25, 1.1, h, 1.1, pale);
      add(x, h * 0.7 + 25, -25, 12, 0.5, 1, steel);
      add(x, h + 25, -25, 1.7, 1.4, 1.7, warm, box, true);
      continue;
    }
    if (theme === 'reactor') {
      add(x, h / 2, -25, 9, h, 9, steel, tube);
      for (let y = 10; y < h; y += 9) add(x, y, -25, 11, 0.6, 11, accent, tube, true);
      continue;
    }
    const height = theme === 'bunker' ? 34 + (i % 3) * 6 : theme === 'rail' ? 38 + (i % 2) * 8 : h;
    add(x, height / 2, -25, 22, height, 28, '#304650');
    add(x, height + 1, -25, 24, 2, 30, steel);
    add(x, height * 0.7, -10.8, 12, 1, 0.12, '#789b9d');
    if (i % 3 === 0) {
      add(x, height + 8, -25, 3, 16, 3, dark, tube);
      add(x, height + 16, -25, 3.3, 0.4, 3.3, warm, tube, true);
    }
  }
  // Gantry silhouette and hanging service rig belong to the scrapyard/foundry vocabulary.
  if (['scrapyard', 'foundry', 'rail'].includes(m.spec.theme))
    for (const x of [33, w - 33]) {
      add(x, 25, 4, 2.8, 50, 3, steel);
      add(x + 10, 48, 4, 28, 2, 3, warm);
      add(x + 17, 39, 4, 0.18, 18, 0.18, dark);
      add(x + 17, 29.5, 4, 3, 2, 2.6, pale);
    }
}
