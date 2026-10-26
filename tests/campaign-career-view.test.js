import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaignView } from '../dist/campaign-view.js';
import { newCampaign, campaignMission } from '../dist/campaign.js';
import { chassisBlueprint } from '../dist/chassis.js';
import { newCareer, unlockCareer, deploymentProgression } from '../dist/career-progression.js';
import { mechStats, combatStats, newWorld } from '../dist/core.js';

test('Command shows the researched hull used at deployment while fitted gear still needs its license', (t) => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { activeElement: null },
  });
  t.after(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete globalThis.document;
  });
  const listeners = {},
    root = {
      innerHTML: '',
      addEventListener(type, listener) {
        listeners[type] = listener;
      },
      contains() {
        return false;
      },
      querySelectorAll() {
        return [];
      },
      querySelector() {
        return null;
      },
    },
    view = createCampaignView(root, {});
  const showLoadout = () => {
    const target = {
      dataset: { tab: 'loadout' },
      closest() {
        return this;
      },
    };
    listeners.click({ target });
  };
  let career = newCareer();
  career = unlockCareer(career, {
    kind: 'mech',
    key: 'vanguard',
    nodeId: 'vanguard.frame.1',
    revision: career.revision,
  });
  career = unlockCareer(career, {
    kind: 'pilot',
    key: 'Ace',
    nodeId: 'survival.1',
    revision: career.revision,
  });
  const build = chassisBlueprint('vanguard'),
    pilot = {
      id: 'local',
      name: 'Ace',
      build,
      progression: deploymentProgression(career, 'vanguard', 'Ace'),
      ready: false,
    },
    campaign = newCampaign(18);
  const state = {
    campaign,
    build,
    saved: [],
    members: [pilot],
    localId: pilot.id,
    room: '',
    isHost: false,
    connecting: false,
    canChoose: true,
    licensed: true,
  };
  const deploymentBlock = (html) => html.match(/<div data-deployment-stats>[\s\S]*?<\/div>/)?.[0];
  const deployButton = (html) => html.match(/<button\b[^>]*data-action="deploy"[^>]*>/)?.[0];

  view.render(state);
  showLoadout();
  const baseMarkup = deploymentBlock(root.innerHTML),
    baseHull = mechStats(build).hp;
  assert.ok(
    baseMarkup.includes(`${baseHull} armor`),
    'unresearched callers retain the workshop stat fallback',
  );
  assert.doesNotMatch(deployButton(root.innerHTML), /\bdisabled\b/);

  const trainedStats = combatStats(pilot),
    deployed = newWorld(campaignMission(campaign), [pilot]);
  assert.ok(trainedStats.hp > baseHull);
  assert.equal(
    trainedStats.hp,
    deployed.players[0].hp,
    'preview and actual deployment use the same researched maximum',
  );
  view.render({ ...state, deploymentStats: trainedStats });
  const trainedMarkup = deploymentBlock(root.innerHTML);
  assert.ok(
    trainedMarkup.includes(`${deployed.players[0].hp} armor`),
    'Command displays the hull the pilot will enter combat with',
  );
  assert.ok(
    !trainedMarkup.includes(`${baseHull} armor`),
    'the briefing no longer leaves the workshop hull on screen after research',
  );
  assert.doesNotMatch(deployButton(root.innerHTML), /\bdisabled\b/);

  view.render({ ...state, deploymentStats: trainedStats, licensed: false });
  assert.match(deploymentBlock(root.innerHTML), /License required/);
  assert.match(root.innerHTML, /License fitted gear at Anchorage vendors before deployment\./);
  assert.match(
    deployButton(root.innerHTML),
    /\bdisabled\b/,
    'career ranks cannot bypass the campaign armory gate',
  );
  assert.equal(
    mechStats(build).hp,
    baseHull,
    'rendering researched stats does not rewrite the equipped chassis',
  );
});
