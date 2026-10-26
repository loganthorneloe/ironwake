import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, campaignRound, missionFor, missionTuning } from '../dist/mission-catalog.js';

test('mission extraction preserves campaign save order and lookup fallback', () => {
  assert.deepEqual(
    MISSIONS.map((mission) => mission.id),
    [
      'ashgate',
      'glasswater',
      'relay-nine',
      'iron-orchard',
      'gale-foundry',
      'blackrail',
      'halo-spire',
      'shatter-basin',
      'crown-engine',
    ],
  );
  assert.ok(Object.isFrozen(MISSIONS));

  for (const mission of MISSIONS) {
    assert.equal(missionFor(mission.id), mission);
    assert.equal(campaignRound(mission.id).spec, mission);
  }
  for (const id of [undefined, null, 'missing', 'constructor']) {
    assert.equal(missionFor(id), MISSIONS[0]);
    assert.deepEqual(campaignRound(id), campaignRound('ashgate'));
  }
});

test('parallel sorties own their runtime geometry and cannot change authored layouts', () => {
  for (const mission of MISSIONS) {
    const first = campaignRound(mission.id, 42);
    const second = campaignRound(mission.id, 42);
    const expected = structuredClone(second);

    first.entry.x = -1000;
    first.exit.y = -1000;
    first.points[0].x = -1000;
    first.obstacles[0].height = 1;
    first.obstacles.at(-1).x = -1000;
    first.obstacles.push({ x: 0, y: 0, w: 1, h: 1, height: 1 });
    first.portals[0].heading = 0;
    first.route[0].y = -1000;
    if (first.platforms.length) {
      first.platforms[0].z = -1000;
      first.ramps[0].h = -1000;
    }

    assert.deepEqual(second, expected, mission.id);
    assert.deepEqual(campaignRound(mission.id, 42), expected, mission.id);
  }
});

test('mission facade keeps seed coercion and encounter bounds consistent', () => {
  assert.equal(campaignRound('ashgate').seed, 38001);
  assert.equal(campaignRound('ashgate', -1).seed, 0xffffffff);
  assert.equal(campaignRound('ashgate', 0x100000001).seed, 1);

  assert.deepEqual(missionTuning(-100, -100), missionTuning(0, 1));
  assert.deepEqual(missionTuning(100, 100), missionTuning(8, 4));
  assert.deepEqual(missionTuning(8, 4), {
    level: 9,
    health: 1.96,
    damage: 1.44,
    speed: 1.2,
    cap: 48,
    batch: 16,
    hold: 16,
  });
});
