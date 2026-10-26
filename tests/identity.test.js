import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanBuild, buildKey, RANGED, MELEE, ABILITIES } from '../dist/core.js';
test('generated mech names cover every equipment combination and ignore imported custom names', () => {
  const names = new Set();
  for (const gun of Object.keys(RANGED))
    for (const melee of Object.keys(MELEE))
      for (const special of Object.keys(ABILITIES)) {
        const b = cleanBuild({ name: 'HACKED', equipment: [gun, null, melee, special] });
        assert.notEqual(b.name, 'HACKED');
        names.add(b.name);
        assert.equal(cleanBuild(JSON.parse(JSON.stringify(b))).name, b.name);
      }
  assert.equal(
    names.size,
    Object.keys(RANGED).length * Object.keys(MELEE).length * Object.keys(ABILITIES).length,
  );
  const b = cleanBuild();
  assert.notEqual(cleanBuild({ ...b, equipment: ['rail', b.weapon, b.ability] }).name, b.name);
  assert.notEqual(buildKey({ ...b, parts: { ...b.parts, head: 'light' } }), buildKey(b));
});
