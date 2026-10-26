import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { newWorld, combatStats, mechStats, RANGED } from '../dist/core.js';
import { chassisBlueprint } from '../dist/chassis.js';
import { campaignRound } from '../dist/mission-catalog.js';
import { interactField, fieldOffer, chooseFieldModule } from '../dist/sortie-progression.js';
import { createCombatAudioTracker } from '../dist/combat-audio.js';
import { createPilotPreference } from '../dist/pilot-profiles.js';
import { createPilotEvents } from '../dist/pilot-events.js';
import { createPilotVoice } from '../dist/pilot-voice.js';
import * as soundDesign from '../dist/sound-design.js';
import { evaluateModule } from './helpers/source-vm.js';

const source = await readFile(new URL('../dist/audio.js', import.meta.url), 'utf8');
function audioHarness() {
  const played = [],
    voiceSink = {
      ready: true,
      play(events, enabled) {
        if (enabled) played.push(...events);
      },
      stop() {},
      reset() {},
    };
  // Execute the production audio module with its real tracker/stats dependencies.
  // Only the output voice is inert; no AudioContext, fetch, timers or sockets run.
  const context = vm.createContext({
    ...soundDesign,
    RANGED,
    combatStats,
    createCombatAudioTracker,
    createPilotPreference,
    createPilotEvents,
    createPilotVoice,
    voiceSink,
  });
  const api = evaluateModule(source, context, ['updateSound', 'resetSound'], {
    filename: 'dist/audio.js',
  });
  vm.runInContext('pilotVoice=voiceSink;pilotIntroPending=false;', context);
  return { played, update: api.updateSound };
}
function sortie() {
  const w = newWorld(campaignRound('ashgate', 42), [
    {
      id: 'self',
      name: 'Pilot',
      build: chassisBlueprint('vanguard'),
      progression: { mech: ['vanguard.frame.1'], pilot: ['survival.1'] },
    },
  ]);
  w.mission.obstacles = [];
  w.field.nodes = [];
  return { w, p: w.players[0] };
}
function acquire(w, p, kind, id) {
  const node = {
    id: 'audio-fixture',
    kind,
    x: p.x,
    y: p.y,
    z: p.altitude,
    state: 'ready',
    revision: 0,
    cost: 0,
    claimed: [],
    [kind === 'cache' ? 'itemId' : 'relayId']: id,
  };
  w.field.nodes = [node];
  assert.equal(interactField(w, p, { id: node.id, revision: 0 }), true);
}
function hullUpgrade(w, p) {
  p.field.pending = 1;
  for (let seed = 0; seed < 1000; seed++) {
    p.field.seed = seed;
    const offered = fieldOffer(w, p).find((entry) => entry.id === 'hull');
    if (offered) {
      assert.equal(chooseFieldModule(w, p, { id: offered.id, revision: offered.revision }), true);
      return;
    }
  }
  assert.fail('Fixture must offer a real hull upgrade.');
}

for (const [label, install] of [
  ['a field hull upgrade', hullUpgrade],
  ['a Spall liner cache', (w, p) => acquire(w, p, 'cache', 'spall')],
  ['a Bulkhead relay', (w, p) => acquire(w, p, 'relay', 'colossus')],
])
  test(`updateSound uses the current career-plus-field critical threshold after ${label}`, () => {
    const { w, p } = sortie(),
      audio = audioHarness(),
      build = p.build,
      before = combatStats(p).hp;
    assert.ok(
      before > mechStats(p.build).hp,
      'Permanent hull training contributes before field effects.',
    );
    audio.update(w, p.id);
    install(w, p);
    const after = combatStats(p).hp;
    assert.equal(p.build, build, 'Field acquisition keeps the workshop build object.');
    assert.ok(after > before);
    w.time++;
    audio.update(w, p.id);
    p.hp = (before + after) * 0.125; // Between 25% of the old maximum and 25% of the new maximum.
    assert.ok(p.hp > before * 0.25 && p.hp < after * 0.25);
    w.time++;
    audio.update(w, p.id);
    assert.equal(
      audio.played.filter((event) => event === 'critical').length,
      1,
      'Crossing the real current hull threshold produces the critical callout.',
    );
    w.time++;
    audio.update(w, p.id);
    assert.equal(
      audio.played.filter((event) => event === 'critical').length,
      1,
      'Repeated frames do not replay the callout.',
    );
  });

test('updateSound lowers the critical threshold after a Redline governor without a build change', () => {
  const { w, p } = sortie(),
    audio = audioHarness(),
    build = p.build,
    before = combatStats(p).hp;
  audio.update(w, p.id);
  acquire(w, p, 'cache', 'redline');
  const after = combatStats(p).hp;
  assert.equal(p.build, build);
  assert.ok(after < before);
  w.time++;
  audio.update(w, p.id);
  p.hp = (before + after) * 0.125;
  assert.ok(p.hp > after * 0.25 && p.hp < before * 0.25);
  w.time++;
  audio.update(w, p.id);
  assert.equal(
    audio.played.filter((event) => event === 'critical').length,
    0,
    'Damage above the new 25% threshold must not announce critical hull.',
  );
  p.hp = after * 0.24;
  w.time++;
  audio.update(w, p.id);
  assert.equal(
    audio.played.filter((event) => event === 'critical').length,
    1,
    'Crossing the lower current threshold still announces critical hull.',
  );
});
