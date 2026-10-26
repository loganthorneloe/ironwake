import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { analyzeArchitecture, formatHotspotReport } from '../scripts/check-architecture.mjs';

async function fixture(t, files) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ironwake-architecture-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [name, source] of Object.entries(files)) {
    const filename = path.join(root, name);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, source);
  }
  return analyzeArchitecture(root, { sourceRoots: ['dist'] });
}

test('architecture checker follows nested imports, re-exports and literal lazy imports with URL suffixes', async (t) => {
  const result = await fixture(t, {
    'dist/app/entry.js': `
      import { value } from '../catalog/values.js?v=41#values';
      export { value } from '../catalog/values.js';
      export * from '../catalog/values.js';
      const lazy = import('./nested/lazy.js?version=1');
      const example = "import './not-a-module.js'";
      // import './not-a-module-either.js';
    `,
    'dist/app/nested/lazy.js': 'export const lazy = true;',
    'dist/catalog/values.js': 'export const value = 1;',
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.architectureModules, 3);
  assert.deepEqual(
    [...result.modules.get('dist/app/entry.js').imports],
    ['dist/catalog/values.js', 'dist/app/nested/lazy.js'],
  );
});

test('architecture checker catches missing imports, re-exports and lazy modules', async (t) => {
  const result = await fixture(t, {
    'dist/app/nested/entry.js': `
      import './missing.js?v=2';
      export * from './missing-export.js';
      const lazy = import('./missing-lazy.js');
      const variable = import(globalThis.optionalModule);
    `,
  });
  assert.equal(result.errors.length, 3);
  assert.ok(result.errors.every((error) => error.includes('missing relative import')));
  assert.match(result.errors[0], /dist\/app\/nested\/entry\.js:2/);
});

test('catalog and builds cannot reach the simulation, application or compatibility core', async (t) => {
  const result = await fixture(t, {
    'dist/catalog/values.js': `
      import '../core.js';
      import '../app.js';
      import '../app/hud.js';
    `,
    'dist/builds/stats.js': "export * from '../simulation/world.js?v=41';",
    'dist/core.js': 'export const compatibility = true;',
    'dist/app.js': 'export const application = true;',
    'dist/app/hud.js': 'export const hud = true;',
    'dist/simulation/world.js': 'export const world = true;',
  });
  assert.equal(result.errors.length, 4);
  assert.ok(result.errors.every((error) => error.includes('independent of runtime module')));
});

test('build and catalog leaves may share existing pure legacy modules', async (t) => {
  const result = await fixture(t, {
    'dist/catalog/values.js': "import '../part-designs.js'; export const value = 1;",
    'dist/builds/stats.js': "import '../chassis.js'; import '../catalog/values.js';",
    'dist/part-designs.js': 'export const designs = {};',
    'dist/chassis.js': 'export const chassis = {};',
  });
  assert.deepEqual(result.errors, []);
});

test('cycles are rejected across the extracted folders, including self imports', async (t) => {
  const result = await fixture(t, {
    'dist/missions/generator.js': "import '../simulation/world.js';",
    'dist/simulation/world.js': "export * from '../missions/generator.js';",
    'dist/app/self.js': "import './self.js';",
  });
  assert.equal(result.errors.length, 2);
  assert.ok(
    result.errors.every((error) => error.includes('Module cycle in extracted architecture')),
  );
  assert.ok(result.errors.some((error) => error.includes('dist/app/self.js -> dist/app/self.js')));
});

test('legacy cycles remain outside the incremental cycle boundary', async (t) => {
  const result = await fixture(t, {
    'dist/old-a.js': "import './old-b.js';",
    'dist/old-b.js': "import './old-a.js';",
    'dist/app/hud.js': "import '../old-a.js';",
  });
  assert.deepEqual(result.errors, []);
});

test('legacy intermediary modules cannot bypass the runtime dependency direction', async (t) => {
  const result = await fixture(t, {
    'dist/catalog/values.js': "import '../legacy-helper.js';",
    'dist/legacy-helper.js': "export * from './core.js?v=41';",
    'dist/core.js': 'export const compatibility = true;',
  });
  assert.equal(result.errors.length, 1);
  assert.match(
    result.errors[0],
    /catalog must remain independent of runtime module dist\/core\.js/,
  );
  assert.match(
    result.errors[0],
    /dist\/catalog\/values\.js -> dist\/legacy-helper\.js -> dist\/core\.js/,
  );
});

test('cycles involving extracted modules remain visible through legacy intermediaries', async (t) => {
  const result = await fixture(t, {
    'dist/app/hud.js': "import '../legacy-helper.js';",
    'dist/legacy-helper.js': "import './app/hud.js';",
  });
  assert.equal(result.errors.length, 1);
  assert.match(
    result.errors[0],
    /dist\/app\/hud\.js -> dist\/legacy-helper\.js -> dist\/app\/hud\.js/,
  );
});

test('syntax errors fail the architecture check with a filename', async (t) => {
  const result = await fixture(t, { 'dist/app/broken.js': 'export const value = ;' });
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /^dist\/app\/broken\.js:/);
});

test('hotspot report exposes line count and direct importers without claiming measured conflicts', async (t) => {
  const result = await fixture(t, {
    'dist/catalog/values.js': 'export const value = 1;\n',
    'dist/app/first.js': "import '../catalog/values.js';",
    'dist/app/second.js': "import '../catalog/values.js';",
  });
  const report = formatHotspotReport(result.modules);
  assert.match(report, /2  dist\/catalog\/values\.js/);
  assert.match(report, /not conflict counts/);
});

test('versioned compatibility imports share extracted catalogs and simulation functions', async () => {
  const [core, versionedCore, frames, parts, equipment, loadout, world] = await Promise.all([
    import('../dist/core.js'),
    import('../dist/core.js?v=41'),
    import('../dist/catalog/frames.js'),
    import('../dist/catalog/parts.js'),
    import('../dist/catalog/equipment.js'),
    import('../dist/builds/loadout.js'),
    import('../dist/simulation/world.js'),
  ]);
  assert.equal(core.FRAMES, frames.FRAMES);
  assert.equal(versionedCore.FRAMES, frames.FRAMES);
  assert.equal(core.PARTS, parts.PARTS);
  assert.equal(versionedCore.PARTS, parts.PARTS);
  assert.equal(core.EQUIPMENT, equipment.EQUIPMENT);
  assert.equal(versionedCore.EQUIPMENT, equipment.EQUIPMENT);
  assert.equal(core.cleanBuild, loadout.cleanBuild);
  assert.equal(versionedCore.cleanBuild, loadout.cleanBuild);
  assert.equal(core.newWorld, world.newWorld);
  assert.equal(versionedCore.newWorld, world.newWorld);
  assert.equal(core.EQUIPMENT.emp, core.ABILITIES.emp);
  assert.equal(core.EQUIPMENT.carbine, core.WEAPONS.carbine);
});
