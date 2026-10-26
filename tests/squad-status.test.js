import test from 'node:test';
import assert from 'node:assert/strict';
import { squadStatus } from '../dist/squad-status.js';
import { mechStats } from '../dist/core.js';
test('cockpit squad channels follow live health, actions, disconnects and revive state', () => {
  const build = {},
    max = mechStats(build).hp,
    pilots = [
      { id: 'self', name: 'PILOT-1', build, hp: max },
      { id: 'wing', name: 'PILOT-2', build, hp: max * 0.5, airborne: true },
      { id: 'down', name: 'PILOT-3', build, hp: 0, active: 1 },
    ];
  let rows = squadStatus(pilots, 'self');
  assert.equal(rows[0].self, true);
  assert.equal(rows[1].health, 0.5);
  assert.equal(rows[1].status, 'ASCENDING');
  assert.equal(rows[2].status, 'DOWNED');
  assert.equal(rows[3].empty, true);
  pilots[2].hp = max * 0.4;
  pilots[2].active = 0;
  pilots[2].boosting = true;
  assert.equal(squadStatus(pilots, 'self')[2].status, 'BOOSTING');
  rows = squadStatus([pilots[0]], 'self');
  assert.equal(rows.filter((r) => r.empty).length, 3);
});
