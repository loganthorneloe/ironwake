import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import * as core from '../dist/core.js';
import * as versionedCore from '../dist/core.js?v=41';
import { WEAPONS, RANGED, MELEE } from '../dist/catalog/weapons.js';
import { ABILITIES } from '../dist/catalog/abilities.js';
import { EQUIPMENT } from '../dist/catalog/equipment.js';
import { PARTS } from '../dist/catalog/parts.js';
import { cleanBuild } from '../dist/builds/loadout.js';
import { mechStats } from '../dist/builds/stats.js';
import { combatStats, combatRecovery } from '../dist/builds/combat-stats.js';
import { newWorld } from '../dist/simulation/world.js';
import { setInput } from '../dist/simulation/input.js';
import { surfaceAt } from '../dist/simulation/geometry.js';

test('core preserves its public API and shares canonical definitions across versioned browser imports', () => {
  const exports = [
    'ABILITIES',
    'AI_ARM_TIME',
    'COLORS',
    'COMBAT_MOVES',
    'DEFAULT_BUILD',
    'EQUIPMENT',
    'FRAMES',
    'MELEE',
    'PARTS',
    'PART_LABELS',
    'RACK_SIZE',
    'RANGED',
    'TRAIL_COLORS',
    'WEAPONS',
    'activeItem',
    'blocksBullet',
    'buildKey',
    'cleanBuild',
    'combatRecovery',
    'combatStats',
    'combatTrial',
    'cost',
    'equipmentFor',
    'mechName',
    'mechStats',
    'mission',
    'newWorld',
    'partsFor',
    'planetMission',
    'rampHeight',
    'rng',
    'setInput',
    'snapshot',
    'specialFor',
    'statsForPlayer',
    'step',
    'surfaceAt',
    'testPlatform',
    'validBuild',
  ];
  assert.deepEqual(Object.keys(core).sort(), exports.sort());
  for (const [name, value] of Object.entries({
    WEAPONS,
    RANGED,
    MELEE,
    ABILITIES,
    EQUIPMENT,
    PARTS,
    cleanBuild,
    mechStats,
    combatRecovery,
    combatStats,
    newWorld,
    setInput,
    surfaceAt,
  })) {
    assert.equal(core[name], value, `${name} must be a compatibility export`);
    assert.equal(versionedCore[name], value, `${name} must use the same native module instance`);
  }
  for (const [id, weapon] of Object.entries(WEAPONS)) assert.equal(EQUIPMENT[id], weapon);
  for (const [id, ability] of Object.entries(ABILITIES)) assert.equal(EQUIPMENT[id], ability);
  assert.equal(ABILITIES.repair.weight, 6);
  assert.ok(PARTS.torso.raptor, 'visual hardware designs remain installed');
});

test('catalog, build and simulation modules keep one-way dependencies and no import cycles', async () => {
  const root = new URL('../dist/', import.meta.url);
  const sources = new Map();
  for (const layer of ['catalog', 'builds', 'simulation']) {
    const directory = new URL(`${layer}/`, root);
    for (const name of await readdir(directory)) {
      if (name.endsWith('.js'))
        sources.set(
          new URL(name, directory).href,
          await readFile(new URL(name, directory), 'utf8'),
        );
    }
  }
  const dependencies = new Map();
  for (const [url, source] of sources) {
    const ownLayer = new URL(url).pathname.split('/').at(-2);
    const imports = [...source.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)].map(
      (match) => new URL(match[1], url),
    );
    const edges = [];
    for (const dependency of imports) {
      assert.ok(
        dependency.pathname.endsWith('.js'),
        `${url} must use browser-native JavaScript imports`,
      );
      assert.notEqual(
        dependency.pathname,
        new URL('core.js', root).pathname,
        `${url} must not import the compatibility facade`,
      );
      const relative = dependency.pathname.slice(root.pathname.length);
      if (ownLayer === 'catalog')
        assert.ok(
          !/^(builds|simulation)\//.test(relative),
          `${url} may not depend on higher layers`,
        );
      if (ownLayer === 'builds')
        assert.ok(!relative.startsWith('simulation/'), `${url} may not depend on the simulation`);
      if (sources.has(dependency.href)) edges.push(dependency.href);
    }
    dependencies.set(url, edges);
  }
  const visiting = new Set(),
    visited = new Set();
  function visit(url, trail = []) {
    assert.ok(!visiting.has(url), `native module cycle: ${[...trail, url].join(' -> ')}`);
    if (visited.has(url)) return;
    visiting.add(url);
    for (const dependency of dependencies.get(url) || []) visit(dependency, [...trail, url]);
    visiting.delete(url);
    visited.add(url);
  }
  for (const url of sources.keys()) visit(url);
});
