import { createCombatHud } from './app/combat-hud.js';
import { createWorldLabels } from './app/world-labels.js';
import { createManual } from './app/manual.js';
import { installPreviewOrbit } from './app/preview-orbit.js';
import { createDeploymentController } from './app/deployment-controller.js';
import { roomProtocol } from './network/protocol.js';
import { createFrameCapture, installFeedback } from './feedback.js';
import { prepareDialog } from './interface-ux.js?v=ui-stack-1';
import { updateWorkshopWorkbench, getWorkshopPreview } from './workshop-ux.js?v=hangar-3';
import { ENEMY_ROLES } from './enemy-behaviors.js';
import {
  cleanCareer,
  awardCareerForWorld,
  deploymentProgression,
  cleanDeploymentProgression,
  availablePoints,
} from './career-progression.js';
import { mutateCareerAtHub } from './career-hub.js';
import { destructionMission, destructionMarkers } from './destruction-mission.js';
import { createDestructionLab, destructionLabEnabled } from './destruction-lab.js';
import { createSceneFlow } from './scene-flow.js';
import { createDeploymentGate, MIN_LOADING_SECONDS, deploymentIntro } from './cinematic.js';
import { campaignRound } from './mission-catalog.js';
// Both endpoints require matching field, career, hub and deployment catalogs.
import {
  HUB_PROTOCOL,
  HUB_CATALOG,
  newHubSave,
  cleanHubSave,
  inheritArmory,
  ownsLicense,
  missingLicenses,
  purchaseAtStation,
  rewardHub,
  syncHubPlayers,
  setHubInput,
  stepHub,
  nearStation,
  hubSnapshot,
} from './hub-state.js';
import { createHubView } from './hub-view.js';
const ROOM_PROTOCOL = roomProtocol(destructionLabEnabled);
import { chassisFor, chassisBlueprint } from './chassis.js';
import { chassisPickerMarkup, chassisIcon } from './chassis-view.js';
import { CONTRACTS, sortieReport } from './sortie-progression.js';
import { createSortieHud, debriefMarkup } from './sortie-view.js?v=ui-stack-1';
import { impactMode, toggleImpactMode, impactLevel } from './impact-preferences.js';
import {
  newCampaign,
  cleanCampaign,
  LANDINGS,
  campaignMission,
  recordSortie,
  installRefit,
  registerPilot,
} from './campaign.js';
import { createCampaignView, CAMPAIGN_MECHS } from './campaign-view.js';
import { createCallsign, validCallsign } from './pilot.js';
import { receiveLegacyMechs } from './migration.js';
await receiveLegacyMechs();
import { hullStatus } from './hud-status.js?v=ui-stack-1';
import { operationMarkers } from './planet-mission.js?v=41';
import { itemIcon } from './workshop-icons.js?v=41';
import { SOCKETS, socketOptions, fitComponent, gridState } from './workshop-grid.js?v=41';
import { taskStatus, objectiveStatus, ultimateStatus } from './hud-status.js?v=41';
import { drawNearbyMap } from './nearby-map.js?v=41';
import { squadStatus } from './squad-status.js?v=41';
import {
  buildKey,
  EQUIPMENT,
  RACK_SIZE,
  equipmentFor,
  activeItem,
  specialFor,
  COMBAT_MOVES,
  PARTS,
  PART_LABELS,
  partsFor,
  mechStats,
  combatStats,
  combatRecovery,
  validBuild,
  WEAPONS,
  RANGED,
  MELEE,
  ABILITIES,
  COLORS,
  TRAIL_COLORS,
  DEFAULT_BUILD,
  cost,
  cleanBuild,
  testPlatform,
  combatTrial,
  planetMission,
  newWorld,
  setInput,
  step,
  snapshot,
} from './core.js?v=41';
import { drawMap } from './render.js?v=41';
import {
  destructionGraphics,
  drawHomeBattle3D,
  rotatePreview,
  zoomPreview,
  resetPreviewOrbit,
  drawPreview3D,
  drawBattle3D,
  initBattle,
  prepareBattle,
  graphicsError,
  resetBattle,
  getAim,
  projectWorld,
} from './three-view.js?v=ui-stack-1';
import {
  view,
  look,
  resetView,
  setStrafe,
  movementInput,
  mouseButtons,
} from './view-controls.js?v=41';
import { createMouseLook } from './mouse-look.js';
import { installPilotVoicePicker } from './pilot-voice-picker.js';
import {
  playTransitionSound,
  initAudio,
  resetSound,
  updateSound,
  toggleSound,
  updateBoostSound,
  updateChargeSound,
  updatePreviewSound,
  togglePilotVoice,
  pilotVoiceEnabled,
  selectedPilotVoice,
  selectPilotVoice,
  previewPilotVoice,
  stopPilotVoice,
} from './audio.js?v=pilot-career-cinematic-3';
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)],
  escape = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
const read = (k, f) => {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? f;
    } catch {
      return f;
    }
  },
  write = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch {
      toast(
        k === 'iw-career-v1'
          ? 'Career progress could not be saved. Allow browser storage or free space, then try again.'
          : 'Storage unavailable. Export your mech to keep a copy.',
      );
      return false;
    }
  };
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
let build = cleanBuild(read('iw-active', chassisBlueprint('vanguard'))),
  saved = read('iw-builds', []);
if (!Array.isArray(saved)) saved = [];
saved = saved.slice(0, 12).map(cleanBuild);
let pilot = read('iw-callsign', null),
  m = planetMission(randomSeed()),
  localId = 'local',
  peer = null,
  hostConn = null,
  isHost = false,
  room = '',
  roster = [],
  connections = new Map(),
  world = null,
  playing = false,
  endShown = false,
  connecting = false,
  joinTimeout = null,
  lastSnapshot = 0,
  receivedAt = 0,
  netFrames = 0,
  toastTimeout;
let soloCampaign = cleanCampaign(read('iw-campaign', null)),
  campaign = soloCampaign,
  campaignMissionActive = false;
let career = cleanCareer(read('iw-career-v1', null));
const storedArmory = read('iw-hub-armory', null);
let soloArmory = storedArmory
  ? cleanHubSave(storedArmory)
  : inheritArmory({ ...newHubSave(), bestLevel: soloCampaign?.level || 0 }, [build, ...saved]);
let armory = soloArmory,
  hubState = syncHubPlayers(null, []),
  lastHubSnapshot = 0,
  lastHubInput = 0;
if (!storedArmory) write('iw-hub-armory', soloArmory);
if (!validCallsign(pilot)) {
  pilot = createCallsign();
  write('iw-callsign', pilot);
}
let homePaused = false,
  homeTime = 0,
  homeTick = 0;
let activeSlot = 'torso',
  equipmentFilter = 'all',
  thrusterPreview = false,
  equipmentPreview = false;
const reportCapture = createFrameCapture();
let feedback = null;
let keys = {},
  mouse = { x: 0, y: 0, melee: false, fire: false, moved: false },
  touch = { x: 0, y: 0, fire: false },
  pressAbility = false,
  pressMelee = false,
  pressDash = false;
let handPress = { left: false, right: false };
const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
const sortieHud = createSortieHud($('#game'));
const sceneFlow = createSceneFlow($('#sceneFlow'));
let deployment = null;
function toast(msg) {
  $('#toast').textContent = msg;
  $('#toast').classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $('#toast').classList.remove('show'), 4200);
}
function modal(html) {
  if (document.pointerLockElement) document.exitPointerLock();
  clearInputs();
  $('#modalBody').innerHTML = html;
  prepareDialog($('#modalBody'));
  if (!$('#modal').open) $('#modal').showModal();
}
$('#closeModal').onclick = () => {
  if (playing && world?.status !== 'playing') {
    if (isHost || !room) returnToHangar();
    else {
      $('#modal').close();
      resetNetwork();
    }
  } else $('#modal').close();
};
$('#modal').addEventListener('click', (e) => {
  if (e.target === $('#modal') && (!playing || world?.status === 'playing')) $('#modal').close();
});
$('#modal').addEventListener('cancel', (e) => {
  if (playing && world?.status !== 'playing') e.preventDefault();
});
function progressionForBuild() {
  return deploymentProgression(career, build.chassis || 'custom', pilot);
}
function me() {
  return {
    id: localId,
    name: pilot,
    build: cleanBuild(build),
    progression: progressionForBuild(),
    ready: false,
  };
}
function localPlayer() {
  return roster.find((p) => p.id === localId);
}
function settleCareer() {
  if (!campaignMissionActive || world?.status !== 'won' || !world.mission.campaign) return false;
  const next = awardCareerForWorld(career, world, localId, pilot);
  if (next === career) return false;
  if (!write('iw-career-v1', next)) return false;
  const chassis = world.players.find((p) => p.id === localId)?.build.chassis || 'custom';
  const mechPoints =
      availablePoints(next, 'mech', chassis) - availablePoints(career, 'mech', chassis),
    pilotPoints = availablePoints(next, 'pilot', pilot) - availablePoints(career, 'pilot', pilot);
  career = next;
  return mechPoints || pilotPoints
    ? `Career earned: +${mechPoints} chassis research · +${pilotPoints} pilot points. Visit Rook at Parts foundry and Echo at Signal archive.`
    : 'Career trees are fully funded. Respec freely at Parts foundry or Signal archive.';
}
function safeSend(conn, data) {
  if (conn?.open) {
    try {
      if (conn.bufferSize < 12) conn.send(data);
    } catch {}
  }
}
function broadcast(data) {
  for (const conn of connections.values()) safeSend(conn, data);
}
function broadcastLobby() {
  hubState = syncHubPlayers(hubState, roster);
  broadcast({
    type: 'lobby',
    roster,
    mission: m,
    room,
    campaign,
    armory,
    hub: hubSnapshot(hubState),
  });
  updateSquad();
}
function buildChanged() {
  build = cleanBuild(build);
  write('iw-active', build);
  if (room) {
    if (isHost) {
      const p = localPlayer();
      if (p) {
        p.build = cleanBuild(build);
        p.progression = progressionForBuild();
        p.ready = false;
      }
      broadcastLobby();
    } else {
      const p = localPlayer();
      if (p) {
        p.build = cleanBuild(build);
        p.progression = progressionForBuild();
        p.ready = false;
      }
      safeSend(hostConn, {
        type: 'loadout',
        build,
        name: pilot,
        progression: progressionForBuild(),
      });
    }
  }
  updateBuild();
  updateSquad();
}
const slotHints = {};
function fitInto(slot, payload) {
  const next = fitComponent(build, slot, payload);
  if (!next) return;
  build = next;
  activeSlot = slot;
  buildChanged();
  document.querySelector(`[data-slot="${slot}"]`)?.focus({ preventScroll: true });
}
function chooseChassis(size = chassisFor(build).size || 'medium') {
  modal(chassisPickerMarkup(build, size));
  document
    .querySelectorAll('[data-chassis-class]')
    .forEach((el) => (el.onclick = () => chooseChassis(el.dataset.chassisClass)));
  document.querySelectorAll('[data-chassis-fit]').forEach(
    (el) =>
      (el.onclick = () => {
        build = cleanBuild({ ...build, chassis: el.dataset.chassisFit });
        $('#modal').close();
        buildChanged();
      }),
  );
  document.querySelectorAll('[data-chassis-factory]').forEach(
    (el) =>
      (el.onclick = () => {
        build = cleanBuild(chassisBlueprint(el.dataset.chassisFactory));
        $('#modal').close();
        buildChanged();
      }),
  );
}
$('#chooseChassis').onclick = () => chooseChassis();
function updateBuild() {
  const base = gridState(build),
    stats = combatStats(me()),
    f = { ...base, hp: stats.hp, speed: stats.speed, lift: stats.lift },
    valid = f.valid,
    isPart = !!PARTS[activeSlot],
    slot = Number(activeSlot.replace('equip', '')) || 0,
    current = isPart ? build.parts[activeSlot] : build.equipment[slot],
    selectedSocket = SOCKETS.find((s) => s.id === activeSlot);
  $('#mechName').textContent = build.name;
  $('#homeMachineName').textContent = build.name;
  $('#previewName').textContent = build.name;
  $('#frameRole').textContent = '';
  const chassis = chassisFor(build);
  $('#chooseChassis').textContent =
    chassis.name + (chassis.size ? ' · ' + chassis.size : '') + ' ↗';
  $('#chassisSummary').textContent =
    `${chassis.role} · ${f.heavyUsed}/${f.heavySlots} heavy mounts · ${chassis.scale.toFixed(2)}× size`;
  $('#frameDescription').textContent = build.equipment
    .map((id) => EQUIPMENT[id].name.split(' / ').at(-1))
    .join(' · ');
  $('#modelCode').textContent = f.weightClass + ' MECH';
  const socketHTML = (s) =>
    `<button class="grid-socket" aria-pressed="${s.id === activeSlot}" aria-label="${s.label}: ${s.item.name.split(' / ').at(-1)}, ${s.weight} tonnes" data-slot="${s.id}" style="--socket-color:${build.partColors[s.id] || '#a1d9c2'}"><span class="socket-label">${s.label}</span><span class="socket-icon">${itemIcon(s.id, s.selected, s.item)}</span><strong>${s.item.name.split(' / ').at(-1)}</strong><small>${s.weight}t</small></button>`;
  $('#partTabs').innerHTML = f.sockets.slice(0, 5).map(socketHTML).join('');
  $('#equipmentTabs').innerHTML = f.sockets.slice(5).map(socketHTML).join('');
  $$('[data-slot]').forEach(
    (el) =>
      (el.onclick = () => {
        activeSlot = el.dataset.slot;
        const hand = WEAPONS[build.equipment[Number(activeSlot.slice(5))]];
        equipmentFilter = hand
          ? hand.guard
            ? 'defensive'
            : hand.melee
              ? 'melee'
              : 'ranged'
          : 'all';
        updateBuild();
        document.querySelector(`[data-slot="${activeSlot}"]`)?.focus({ preventScroll: true });
      }),
  );
  $('#previewPower').hidden = valid;
  $('#previewPowerDetail').textContent = f.issues.join(' ');
  document.body.classList.toggle('mech-offline', !valid);
  for (const id of ['testWeapons', 'testThrusters']) $('#' + id).disabled = !valid;
  if (!valid) {
    thrusterPreview = false;
    equipmentPreview = false;
    $('#testWeapons').textContent = 'Test equipment';
    $('#testThrusters').textContent = 'Test boosters';
    $('#testWeapons').setAttribute('aria-pressed', 'false');
    $('#testThrusters').setAttribute('aria-pressed', 'false');
  }
  $('#workshopStatus').textContent = valid ? 'READY TO TEST' : 'POWER OFFLINE';
  $('#assemblyStatus').textContent = valid ? 'Online' : 'Needs refit';
  $('#assemblyStatus').classList.toggle('offline', !valid);
  $('#assemblyStats').innerHTML = `${f.weight}<span> / ${f.capacity}t</span>`;
  $('#assemblyPerformance').textContent =
    `${f.hp} armor · ${Math.round(f.speed * f.boost)} boost speed`;
  $('#assemblyLoad').style.width = Math.min(100, (f.weight / f.capacity) * 100) + '%';
  const meter = $('#powerSegments');
  meter.setAttribute('aria-valuemin', '0');
  meter.setAttribute('aria-valuemax', f.capacity);
  meter.setAttribute('aria-valuenow', Math.min(f.weight, f.capacity));
  meter.setAttribute(
    'aria-valuetext',
    `${f.weight} of ${f.capacity} tonnes. ${valid ? 'Power online' : 'Overloaded'}`,
  );
  meter.innerHTML = f.sockets
    .map(
      (s) =>
        `<i class="${s.id === activeSlot ? 'selected' : ''}" style="flex-basis:${(s.weight / Math.max(f.weight, f.capacity)) * 100}%" title="${s.label}: ${s.weight}t"></i>`,
    )
    .join('');
  $('#powerRemaining').textContent = valid
    ? f.capacity - f.weight + 't available'
    : f.weight > f.capacity
      ? f.weight - f.capacity + 't over capacity'
      : f.heavyUsed + '/' + f.heavySlots + ' heavy mounts';
  $('#selectionTitle').textContent = selectedSocket.label;
  $('#parts').classList.toggle('frame-choices', isPart);
  const filters = $('#equipmentFilters');
  filters.hidden = isPart || slot === 2;
  filters.innerHTML = ['all', 'ranged', 'melee', 'defensive']
    .map(
      (type) =>
        `<button data-filter="${type}" aria-pressed="${type === equipmentFilter}">${type[0].toUpperCase() + type.slice(1)}</button>`,
    )
    .join('');
  $$('[data-filter]').forEach(
    (el) =>
      (el.onclick = () => {
        equipmentFilter = el.dataset.filter;
        updateBuild();
      }),
  );
  const options = Object.entries(socketOptions(activeSlot)).filter(
    ([id, v]) =>
      isPart ||
      slot === 2 ||
      equipmentFilter === 'all' ||
      (equipmentFilter === 'defensive'
        ? v.guard
        : equipmentFilter === 'melee'
          ? v.melee && !v.guard
          : !v.melee),
  );
  $('#paintRow').hidden = !isPart;
  $('#paintLabel').textContent = (PART_LABELS[activeSlot] || 'Part') + ' paint';
  $('#colors').innerHTML = COLORS.map(
    ([c, n]) =>
      `<button class="swatch ${build.partColors[activeSlot] === c ? 'selected' : ''}" style="--swatch:${c}" data-color="${c}" aria-label="${n}" title="${n}" aria-pressed="${build.partColors[activeSlot] === c}"></button>`,
  ).join('');
  $$('[data-color]').forEach(
    (el) =>
      (el.onclick = () => {
        if (isPart) {
          build.partColors[activeSlot] = el.dataset.color;
          buildChanged();
        }
      }),
  );
  $('#trailRow').hidden = activeSlot !== 'booster';
  $('#trailColors').innerHTML = TRAIL_COLORS.map(
    ([c, n]) =>
      `<button class="swatch ${build.trailColor === c ? 'selected' : ''}" style="--swatch:${c}" data-trail="${c}" aria-label="${n} exhaust" aria-pressed="${build.trailColor === c}"></button>`,
  ).join('');
  $$('[data-trail]').forEach(
    (el) =>
      (el.onclick = () => {
        build.trailColor = el.dataset.trail;
        thrusterPreview = true;
        $('#testThrusters').textContent = 'Stop boosters';
        $('#testThrusters').setAttribute('aria-pressed', 'true');
        buildChanged();
      }),
  );
  $('#weightBudget').textContent = f.weight + ' / ' + f.capacity + ' t';
  $('#weightBar').style.width = Math.min(100, (f.weight / f.capacity) * 100) + '%';
  $('#weaponDesc').textContent = `Frame ${f.frameWeight}t + equipment ${f.equipmentWeight}t.`;
  $('#abilityDesc').textContent = '';
  $('#buildHint').textContent = f.issues.join(' ');
  $('#buildHint').classList.toggle('error', !valid);
  for (const id of ['saveMech', 'testBuildTop', 'startTrial', 'startMission'])
    $('#' + id).disabled = !valid;
  $('#armorStat').textContent = f.hp;
  $('#speedStat').textContent = f.speed;
  $('#damageStat').textContent = build.equipment.filter((id) => WEAPONS[id]).length;
  $('#armorBar').style.width = Math.min(100, (f.hp / 600) * 100) + '%';
  $('#speedBar').style.width = Math.min(100, (f.speed / 450) * 100) + '%';
  $('#damageBar').style.width = '0%';
  $('#engineering').textContent =
    `Unlimited thrust · ${f.lift} lift/sec · ${Math.round(f.speed * f.boost)} boost speed`;
  updateWorkshopWorkbench({
    build,
    activeSlot,
    current,
    options,
    selectedSocket,
    socketItems: socketOptions(activeSlot),
    onSlot: (id) => document.querySelector('button[data-slot=' + id + ']')?.click(),
    onFit: (id) => fitInto(activeSlot, { kind: selectedSocket.kind, id }),
  });
  renderCampaign();
}

function menuScreen(screen) {
  if (screen === 'campaign') screen = 'hub';
  if (document.body.dataset.screen !== screen && !deployment) sceneFlow.cut();
  hubView.stop();
  hubView.close();
  document.body.dataset.screen = screen;
  renderCampaign();
  $('#mechPreview').setAttribute(
    'aria-label',
    screen === 'garage'
      ? 'Mech viewer. Drag to rotate, scroll to zoom, or use arrow keys.'
      : 'Your fitted mech in the service hangar',
  );
  window.scrollTo(0, 0);
  $('#mainContent').scrollTop = 0;
  thrusterPreview = false;
  equipmentPreview = false;
  $('#testWeapons').textContent = 'Test equipment';
  $('#testWeapons').setAttribute('aria-pressed', 'false');
  $('#testThrusters').textContent = 'Test boosters';
  $('#testThrusters').setAttribute('aria-pressed', 'false');
}
$('#homeNav').onclick = () => menuScreen('home');
$('#garageNav').onclick = $('#startGarage').onclick = () => menuScreen('garage');
$('#garageBack').onclick = () => menuScreen(campaign ? 'campaign' : 'home');
$('#campaignNav').onclick = $('#continueCampaign').onclick = () => openCampaign();
const campaignView = createCampaignView($('#campaignScreen'), {
  newRun: () => $('#startMission').click(),
  refit: (request) => {
    if (room && !isHost) safeSend(hostConn, { type: 'refit', request });
    else applyRefit(localPlayer()?.name || pilot, request);
  },
  drill: (id) => startDrill(id),
  legacy: () => startDrill('cinderfall'),
  home: () => menuScreen('home'),
  supply: () => hubView.walkTo('supply'),
  workshop: () => menuScreen('garage'),
  host: () => {
    openCampaign();
    hostRoom();
  },
  join: () => showJoin(),
  invite: () => copyRoom(),
  leave: () => resetNetwork('Left the squad.'),
  ready: () => toggleReady(),
  contract: (id) => {
    if (room && !isHost) return;
    if (!CONTRACTS.some((c) => c.id === id) || campaign.contract === id) return;
    campaign = { ...campaign, contract: id, revision: campaign.revision + 1 };
    persistCampaign();
    m = campaignMission(campaign, planetMission);
    roster.forEach((p) => (p.ready = false));
    if (room) broadcastLobby();
    updateMission();
    updateSquad();
  },
  landing: (id) => {
    if (room && !isHost) return;
    if (!LANDINGS.some((p) => p.id === id) || campaign.landing === id) return;
    campaign = { ...campaign, landing: id, revision: campaign.revision + 1 };
    persistCampaign();
    m = campaignMission(campaign, planetMission);
    roster.forEach((p) => (p.ready = false));
    campaignView.focusLanding(campaign);
    if (room) broadcastLobby();
    updateMission();
    updateSquad();
  },
  mech: (value) => {
    const [kind, index] = value.split('-'),
      chosen =
        kind === 'preset'
          ? CAMPAIGN_MECHS[Number(index)]?.build
          : kind === 'saved'
            ? saved[Number(index)]
            : null;
    if (!chosen) return;
    build = cleanBuild({
      ...chosen,
      equipment: [...chosen.equipment.slice(0, 2), build.equipment[2]],
    });
    buildChanged();
  },
  special: (id) => {
    if (!Object.hasOwn(ABILITIES, id)) return;
    build = cleanBuild({ ...build, equipment: [...build.equipment.slice(0, 2), id] });
    buildChanged();
  },
  deploy: () => {
    if (!hubDeployable() || !nearStation(hubState, localId, 'mission')) return;
    if (room && (!isHost || !roster.every((p) => p.ready && validBuild(p.build)))) return;
    if (!campaign || campaign.runState !== 'active' || !validBuild(build) || connecting) return;
    if (m.mode !== 'operation' || m.campaign?.id !== campaign.id)
      m = campaignMission(campaign, planetMission);
    $('#deploy').click();
  },
});

const hubView = createHubView($('#hubScreen'), $('#campaignScreen'), {
  inputBlocked: () => !!feedback?.isOpen() || $('#interfaceMenu').open,
  command: () => renderCampaign(),
  host: () => hostRoom(),
  join: () => showJoin(),
  invite: () => copyRoom(),
  leave: () => resetNetwork('Left the squad.'),
  ready: () => toggleReady(),
  workshop: () => menuScreen('garage'),
  buy: (request) => {
    if (room && !isHost) safeSend(hostConn, { type: 'hubPurchase', request });
    else applyHubPurchase(localId, request);
  },
  fit: (id, hand) => {
    const item = HUB_CATALOG.find((item) => item.id === id);
    if (!item || !ownsLicense(armory, id) || !nearStation(hubState, localId, item.vendor)) return;
    if (item.vendor === 'parts') fitInto(item.slot, { kind: item.slot, id: item.item });
    else
      fitInto('equip' + (item.slot === 'equip2' ? 2 : hand), {
        kind: item.slot === 'equip2' ? 'special' : 'hand',
        id: item.item,
      });
  },
  refit: (request) => {
    if (room && !isHost) safeSend(hostConn, { type: 'refit', request });
    else applyRefit(localPlayer()?.name || pilot, request);
  },
  careerUnlock: (request) => applyCareerAtStation(request),
  careerReset: (request) => applyCareerAtStation(request, true),
});
function updateHub() {
  const members = room ? roster : [me()];
  if (!room || isHost) hubState = syncHubPlayers(hubState, members);
  hubView.update({
    state: hubState,
    save: armory,
    campaign,
    build,
    members,
    localId,
    room,
    isHost,
    connecting,
    career,
    pilot,
  });
}
function persistArmory() {
  if (room && !isHost) return;
  soloArmory = armory;
  write('iw-hub-armory', armory);
}
function applyCareerAtStation(request, reset = false) {
  if (document.body.dataset.screen !== 'hub')
    return 'Visit the station at Wake Anchorage to continue.';
  const next = mutateCareerAtHub(
    career,
    { state: hubState, playerId: localId, pilot, playing, connecting, world },
    request,
    reset,
  );
  if (next === career)
    return 'Upgrade unavailable. Check your points, prerequisites and station access.';
  if (!write('iw-career-v1', next))
    return 'Progress could not be saved. Allow browser storage and try again.';
  career = next;
  buildChanged();
  return reset
    ? 'Certifications reset. All spent points refunded.'
    : 'Certification installed. Your next deployment uses this training.';
}
function applyHubPurchase(playerId, request) {
  if (playing || world || (room && !isHost)) return;
  const item = HUB_CATALOG.find((item) => item.id === request?.id);
  if (!item || !nearStation(hubState, playerId, item.vendor)) return;
  const next = purchaseAtStation(armory, hubState, playerId, request);
  if (next === armory) {
    if (playerId === localId) toast('Stock changed. Check credits and campaign requirements.');
    return;
  }
  armory = next;
  persistArmory();
  if (room) broadcastLobby();
  else updateHub();
  toast(item.name + ' licensed for the squad.');
}
function hubDeployable(members = room ? roster : [me()]) {
  if (members.some((p) => missingLicenses(armory, p.build).length)) {
    toast(
      'Visit Parts foundry / The arsenal to license fitted gear, or fit owned items before deployment.',
    );
    return false;
  }
  return true;
}
function tickHub(now, dt) {
  updateHub();
  const input = hubView.input();
  if (isHost || !room) {
    setHubInput(hubState, localId, input);
    for (const p of hubState.players)
      if (p.id !== localId && now - (p.inputAt || 0) > 600)
        setHubInput(hubState, p.id, { x: 0, z: 0 });
    stepHub(hubState, dt);
    if (room && now - lastHubSnapshot >= 80) {
      lastHubSnapshot = now;
      broadcast({ type: 'hubState', hub: hubSnapshot(hubState) });
    }
  } else if (now - lastHubInput >= 50) {
    lastHubInput = now;
    safeSend(hostConn, { type: 'hubInput', input });
  }
}
function registerRunPilot(name) {
  if (!campaign) return;
  const next = registerPilot(
    campaign,
    name,
    roster.map((p) => p.name),
  );
  if (next === campaign) return;
  campaign = next;
  persistCampaign();
  if (!m.practice && !m.destructible) m = campaignMission(campaign);
  roster.forEach((p) => (p.ready = false));
}
function applyRefit(name, request, playerId = localId) {
  if (
    playing ||
    deployment ||
    world ||
    !campaign ||
    (room && !isHost) ||
    !nearStation(hubState, playerId, 'supply')
  )
    return;
  const next = installRefit(campaign, name, request);
  if (next === campaign) return;
  campaign = next;
  persistCampaign();
  m = campaignMission(campaign);
  roster.forEach((p) => (p.ready = false));
  if (room) broadcastLobby();
  updateSquad();
}
function startDrill(id) {
  if (room && !isHost) return;
  m = id === 'cinderfall' ? planetMission(randomSeed()) : campaignRound(id, randomSeed());
  m.practice = true;
  m.contract = campaign?.contract || 'frontline';
  roster.forEach((p) => (p.ready = false));
  if (room) {
    broadcastLobby();
    menuScreen('home');
    toast('Mission drill selected. Ready up in the squad lobby.');
  } else $('#deploy').click();
}
function persistCampaign() {
  if (room && !isHost) return;
  soloCampaign = campaign;
  write('iw-campaign', campaign);
}
function renderCampaign() {
  $('#continueCampaign').hidden = !campaign;
  $('#continueCampaign .js-continue-label').textContent = room ? 'Rejoin squad' : 'Continue';
  $('#homeResumeDetail').textContent =
    campaign?.runState === 'active'
      ? 'Mission ' +
        String(Math.min(9, campaign.level + 1)).padStart(2, '0') +
        ' / 09 · Pick up where you left off.'
      : 'Your campaign report is ready.';
  $('#startMission').classList.toggle('primary', !campaign);
  $('#startMission').classList.toggle('secondary', !!campaign);
  $('#startMission').disabled = !!room && !isHost;
  updateHub();
  if (document.body.dataset.screen === 'hub' && hubView.station === 'mission')
    campaignView.render({
      campaign,
      build,
      saved,
      members: room ? roster : [me()],
      localId,
      room,
      isHost,
      connecting,
      canChoose: !room || isHost,
      licensed: missingLicenses(armory, build).length === 0,
      deploymentStats: combatStats(me()),
    });
}
function openCampaign() {
  if (!campaign) {
    if (room && !isHost) {
      toast('Waiting for the host to create a campaign.');
      return;
    }
    campaign = newCampaign(randomSeed());
    persistCampaign();
  }
  if (!room || isHost) {
    const revision = campaign.revision,
      changed = m.mode !== 'operation' || m.campaign?.id !== campaign.id;
    if (changed) {
      m = campaignMission(campaign, planetMission);
      roster.forEach((p) => (p.ready = false));
    }
    for (const member of room ? roster : [me()]) registerRunPilot(member.name);
    if (room && (changed || revision !== campaign.revision)) broadcastLobby();
  }
  campaignView.focusLanding(campaign);
  menuScreen('campaign');
  updateMission();
  updateSquad();
}
function beginCampaign() {
  if (room && !isHost) return;
  const records = campaign?.records || {};
  campaign = { ...newCampaign(randomSeed()), records };
  persistCampaign();
  m = campaignMission(campaign, planetMission);
  for (const member of room ? roster : [me()]) registerRunPilot(member.name);
  roster.forEach((p) => (p.ready = false));
  hubState = syncHubPlayers(null, room ? roster : [me()]);
  if (room) broadcastLobby();
  openCampaign();
}
function toggleReady() {
  if (
    !room ||
    playing ||
    deployment ||
    world ||
    connecting ||
    (m.campaign && campaign?.runState !== 'active')
  )
    return;
  const p = localPlayer();
  if (!p || (!p.ready && (!validBuild(build) || !hubDeployable([p])))) return;
  if (isHost) {
    p.ready = !p.ready;
    broadcastLobby();
  } else
    safeSend(hostConn, {
      type: 'ready',
      ready: !p.ready,
      campaignId: campaign?.id,
      revision: campaign?.revision,
    });
}
function settleCampaign(outcome) {
  if (
    !campaignMissionActive ||
    !campaign ||
    world?.mission.campaign?.id !== campaign.id ||
    (room && !isHost)
  )
    return;
  campaignMissionActive = false;
  campaign = recordSortie(campaign, outcome, sortieReport(world, outcome));
  persistCampaign();
  armory = rewardHub(armory, campaign);
  persistArmory();
  m = campaignMission(campaign, planetMission);
}
function selectMode(mode, variant = 'level') {
  if (room && !isHost) return;
  m =
    mode === 'destruction'
      ? destructionMission(variant)
      : mode === 'operation' && campaign
        ? campaignMission(campaign, planetMission)
        : mode === 'operation'
          ? planetMission(randomSeed())
          : mode === 'trial'
            ? combatTrial()
            : testPlatform();
  if (room) {
    roster.forEach((p) => (p.ready = false));
    broadcastLobby();
  }
  updateMission();
  updateSquad();
}
$('#startMission').onclick = () => {
  if (!campaign) {
    beginCampaign();
    return;
  }
  modal(
    '<h2>Start a new front?</h2><p>This resets the campaign saved in this browser. Your mechs and career upgrade trees stay in the armory.' +
      (room ? ' Your squad will share the new board and ready up again.' : '') +
      '</p><div class="dialog-actions"><button class="button primary" id="confirmCampaign">NEW CAMPAIGN</button><button class="button secondary" id="keepCampaign">CONTINUE CURRENT</button></div>',
  );
  $('#confirmCampaign').onclick = () => {
    $('#modal').close();
    beginCampaign();
  };
  $('#keepCampaign').onclick = () => {
    $('#modal').close();
    openCampaign();
  };
};
function practice(mode) {
  if (room && !isHost) {
    menuScreen('campaign');
    toast('The host chooses the practice mode. Mark ready when your squad is set.');
    return;
  }
  selectMode(mode);
  if (room) {
    menuScreen('home');
    toast('Practice selected. Mark ready in the squad lobby.');
    return;
  }
  $('#deploy').click();
}
$('#trialMode').onchange = () => selectMode($('#trialMode').value);
$('#startTrial').onclick = () => practice('trial');
$('#testBuildTop').onclick = () => practice('sandbox');
$('#startHost').onclick = () => {
  if (!destructionLabEnabled) openCampaign();
  hostRoom();
};
$('#startJoin').onclick = () => showJoin();
$('#testThrusters').onclick = () => {
  initAudio();
  thrusterPreview = !thrusterPreview;
  $('#testThrusters').textContent = thrusterPreview ? 'Stop boosters' : 'Test boosters';
  $('#testThrusters').setAttribute('aria-pressed', String(thrusterPreview));
};
$('#weapon').innerHTML = Object.entries(RANGED)
  .map(([id, v]) => `<option value="${id}">${v.name}</option>`)
  .join('');
$('#ability').innerHTML = Object.entries(ABILITIES)
  .map(([id, v]) => `<option value="${id}">${v.name.toUpperCase()}</option>`)
  .join('');
function updateMission() {
  $('#trialMode').value = m.destructible
    ? 'destruction'
    : m.mode === 'operation'
      ? 'operation'
      : m.mode === 'trial'
        ? 'trial'
        : 'sandbox';
  $('#trialMode').disabled = !!room && !isHost;
  $('#missionTitle').textContent = m.name;
  $('#missionNumber').textContent = '';
  $('#sectorLabel').textContent = m.destructible
    ? 'EXPERIMENTAL 02 · DESTRUCTION'
    : m.mode === 'operation'
      ? `LEVEL ${m.sector} / ${m.estimatedMinutes || 15} MIN${m.practice ? ' / DRILL' : ''}`
      : 'MECH WORKSHOP';
  $('#reroll').hidden = true;
}
function updateSquad() {
  const members = room ? roster : [me()];
  $('#squadCount').textContent = `0${members.length} / 04`;
  $('#squadSlots').innerHTML = Array.from({ length: 4 }, (_, i) => {
    const p = members[i];
    return p
      ? `<div class="squad-slot filled"><span class="slot-icon" style="color:${escape(p.build.color)}">◈</span><span>${escape(p.name)}${p.id === localId ? ' / YOU' : ''}</span><em>${room ? (p.ready ? 'READY' : 'IN HANGAR') : 'AWAITING DEPLOYMENT'}</em></div>`
      : `<button class="squad-slot" data-invite="1" aria-label="Invite a pilot"><span class="slot-icon">＋</span><span>OPEN SLOT</span></button>`;
  }).join('');
  $$('[data-invite]').forEach((b) => (b.onclick = () => (room ? copyRoom() : showHostInfo())));
  $('#connectActions').hidden = !!room;
  $('#roomActions').hidden = !room;
  $('#host').disabled = connecting;
  $('#join').disabled = connecting;
  $('#networkStatus').textContent = connecting
    ? 'Establishing squad connection…'
    : room
      ? `ROOM ${room} · ${isHost ? 'You are host' : 'Connected to host'} · ${members.filter((p) => p.ready).length}/${members.length} ready`
      : 'Ready for a solo sortie or online co-op.';
  const p = localPlayer(),
    everyone = members.every((p) => p.ready);
  $('#deploy').innerHTML = !room
    ? m.destructible
      ? 'DEPLOY ' + escape(m.name) + ' <span>↗</span>'
      : m.mode === 'operation'
        ? 'DEPLOY CINDERFALL <span>↗</span>'
        : m.mode === 'trial'
          ? 'START AI DUEL <span>↗</span>'
          : 'ENTER TARGET RANGE <span>↗</span>'
    : isHost
      ? everyone
        ? m.mode === 'operation'
          ? 'DEPLOY SQUAD <span>↗</span>'
          : m.mode === 'trial'
            ? 'START COMBAT TRIAL <span>↗</span>'
            : 'ENTER PLATFORM <span>↗</span>'
        : p?.ready
          ? 'WAITING FOR SQUAD'
          : 'MARK READY <span>✓</span>'
      : p?.ready
        ? 'UNREADY'
        : 'MARK READY <span>✓</span>';
  $('#deploy').disabled =
    connecting || !validBuild(build) || (!!room && isHost && p?.ready && !everyone);
  $('#pilotLabel').textContent = room && p ? p.name : pilot;
  document.body.dataset.room = room ? 'true' : 'false';
  renderCampaign();
}
function showHostInfo() {
  modal(
    '<h2>Host a squad</h2><p>Create a room, share its invite, and choose your mechs. Everyone marks ready before the host deploys. No account needed.</p><p>Keep the host’s tab open during the mission. Direct browser connections may be blocked by restrictive networks; try a different network if a connection fails.</p><button class="button primary" id="confirmHost">Create squad ↗</button>',
  );
  $('#confirmHost').onclick = () => {
    $('#modal').close();
    hostRoom();
  };
}
function createPeer(id) {
  return new Peer(id, {
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    },
  });
}
function resetNetwork(message) {
  cancelDeployment();
  resetSound();
  $('#modal').close();
  if (document.pointerLockElement) document.exitPointerLock();
  clearTimeout(joinTimeout);
  const old = peer;
  peer = null;
  hostConn = null;
  connections.clear();
  room = '';
  isHost = false;
  connecting = false;
  localId = 'local';
  roster = [];
  old?.destroy();
  campaignMissionActive = false;
  campaign = soloCampaign;
  armory = soloArmory;
  hubState = syncHubPlayers(null, [me()]);
  hubView.stop();
  hubView.close();
  if (campaign) m = campaignMission(campaign, planetMission);
  if (playing || world) {
    playing = false;
    world = null;
    $('#game').hidden = true;
    $('#hangar').hidden = false;
    sceneFlow.cut();
  }
  if (document.body.dataset.screen === 'hub' && !campaign) menuScreen('home');
  updateSquad();
  updateMission();
  if (message) toast(message);
}
function networkError(error) {
  if (!peer) return;
  if (error.type === 'peer-unavailable')
    resetNetwork('Room not found. Check the code and that the host is online.');
  else if (connecting) resetNetwork('Could not connect. Check your network and try again.');
  else if (error.type === 'unavailable-id')
    resetNetwork('Room code in use. Please create a new room.');
  else toast('Connection warning. If your squad disconnects, create a new room.');
}
async function hostRoom() {
  if (connecting || room) return;
  if (!campaign && !destructionLabEnabled) openCampaign();
  if (!window.Peer) {
    toast('Online library did not load. Reload the page to try again.');
    return;
  }
  connecting = true;
  updateSquad();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
    bytes = crypto.getRandomValues(new Uint8Array(6)),
    code = [...bytes].map((b) => chars[b % chars.length]).join('');
  try {
    peer = createPeer(ROOM_PROTOCOL + code);
  } catch {
    resetNetwork('This browser cannot establish an online connection.');
    return;
  }
  const p = peer;
  p.on('error', networkError);
  joinTimeout = setTimeout(() => {
    if (connecting) resetNetwork('Signaling server unavailable. Try again or deploy solo.');
  }, 15000);
  p.on('open', (id) => {
    if (peer !== p) return;
    clearTimeout(joinTimeout);
    if (room && isHost) {
      connecting = false;
      updateSquad();
      return;
    }
    isHost = true;
    room = code;
    localId = id;
    connecting = false;
    roster = [me()];
    registerRunPilot(pilot);
    menuScreen(m.destructible ? 'home' : 'campaign');
    updateSquad();
    updateMission();
    toast('Room ' + room + ' ready. Copy an invite for your squad.');
  });
  p.on('disconnected', () => {
    if (peer === p && !p.destroyed) {
      toast('Room discovery interrupted. Reconnecting…');
      p.reconnect();
    }
  });
  p.on('connection', (conn) => {
    let accepted = false,
      verifying = false,
      rate = 0,
      rateAt = Date.now();
    conn.on('open', () => {
      if (world || playing || roster.length >= 4) {
        safeSend(conn, {
          type: 'reject',
          reason: playing
            ? 'Mission in progress. Join after the squad returns.'
            : 'This squad is full (4 pilots).',
        });
        setTimeout(() => conn.close(), 500);
        return;
      }
      const timeout = setTimeout(() => {
        if (!accepted) conn.close();
      }, 8000);
      conn.on('data', async (data) => {
        if (!data || typeof data !== 'object') return;
        if (Date.now() - rateAt > 1000) {
          rate = 0;
          rateAt = Date.now();
        }
        if (++rate > 100) return;
        if (data.type === 'hello' && !accepted && !verifying) {
          verifying = true;
          const assigned = {
            callsign: validCallsign(data.callsign) ? data.callsign : createCallsign(),
          };
          if (roster.some((member) => member.name === assigned.callsign))
            assigned.callsign = createCallsign();
          if (peer !== p || !conn.open) return;
          if (world || playing || roster.length >= 4) {
            safeSend(conn, { type: 'reject', reason: 'The squad is full or is already testing.' });
            setTimeout(() => conn.close(), 500);
            return;
          }
          accepted = true;
          clearTimeout(timeout);
          connections.set(conn.peer, conn);
          const memberBuild = cleanBuild(data.build);
          roster.push({
            id: conn.peer,
            name: assigned.callsign,
            build: memberBuild,
            progression: cleanDeploymentProgression(data.progression, memberBuild.chassis),
            ready: false,
          });
          registerRunPilot(assigned.callsign);
          broadcastLobby();
          toast('A pilot joined your squad.');
          return;
        }
        if (!accepted) return;
        const member = roster.find((x) => x.id === conn.peer);
        if (!member) return;
        if (data.type === 'deployment-ready') {
          if (deployment?.gate?.acknowledge(conn.peer, data.ticket)) tryLaunchDeployment();
          return;
        }
        if (data.type === 'deployment-failed' && data.ticket === deployment?.ticket) {
          abortDeployment('A squad member could not prepare the battlefield. Try deploying again.');
          return;
        }
        if (data.type === 'input' && playing) {
          setInput(world, conn.peer, data.input);
        } else if (data.type === 'hubInput' && !world) {
          setHubInput(hubState, conn.peer, data.input);
          const hp = hubState.players.find((p) => p.id === conn.peer);
          if (hp) hp.inputAt = performance.now();
        } else if (data.type === 'hubPurchase' && !world) {
          applyHubPurchase(conn.peer, data.request);
        } else if (data.type === 'ready' && !world) {
          member.ready =
            !!data.ready &&
            data.campaignId === campaign?.id &&
            data.revision === campaign?.revision &&
            validBuild(member.build) &&
            (!m.campaign || missingLicenses(armory, member.build).length === 0);
          broadcastLobby();
        } else if (data.type === 'refit' && !world) {
          applyRefit(member.name, data.request, conn.peer);
        } else if (data.type === 'loadout' && !world) {
          member.build = cleanBuild(data.build);
          member.progression = cleanDeploymentProgression(data.progression, member.build.chassis);
          member.ready = false;
          broadcastLobby();
        }
      });
    });
    const gone = () => {
      if (!accepted || peer !== p) return;
      accepted = false;
      connections.delete(conn.peer);
      roster = roster.filter((x) => x.id !== conn.peer);
      if (world) world.players = world.players.filter((x) => x.id !== conn.peer);
      if (deployment)
        abortDeployment('Squad link changed during loading. Ready up and deploy again.');
      broadcastLobby();
      toast('A pilot disconnected.');
    };
    conn.on('close', gone);
    conn.on('error', gone);
  });
}
async function joinRoom(code) {
  code = code.trim().toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(code)) {
    toast('Enter the six-character room code.');
    return;
  }
  if (connecting || room) return;
  if (!window.Peer) {
    toast('Online library did not load. Reload the page.');
    return;
  }
  connecting = true;
  updateSquad();
  try {
    peer = createPeer();
  } catch {
    resetNetwork('This browser does not support online connections.');
    return;
  }
  const p = peer;
  p.on('error', networkError);
  joinTimeout = setTimeout(() => {
    if (connecting)
      resetNetwork('Connection timed out. Check the room code or try another network.');
  }, 18000);
  p.on('open', (id) => {
    if (peer !== p) return;
    localId = id;
    hostConn = p.connect(ROOM_PROTOCOL + code, { reliable: true, serialization: 'binary' });
    const conn = hostConn;
    conn.on('open', () =>
      safeSend(conn, {
        type: 'hello',
        callsign: pilot,
        build: cleanBuild(build),
        progression: progressionForBuild(),
      }),
    );
    conn.on('data', (data) => {
      if (peer !== p || !data || typeof data !== 'object') return;
      if (data.type === 'reject') {
        resetNetwork(data.reason);
        return;
      }
      if (data.type === 'lobby') {
        clearTimeout(joinTimeout);
        const firstJoin = !room,
          previousMode = m.mode,
          previousPractice = !!m.practice;
        room = code;
        connecting = false;
        roster = data.roster;
        m = data.mission;
        campaign = cleanCampaign(data.campaign);
        armory = cleanHubSave(data.armory);
        if (data.hub) hubState = data.hub;
        if (
          !playing &&
          !deployment &&
          (firstJoin || previousMode !== m.mode || previousPractice !== !!m.practice)
        ) {
          campaignView.focusLanding(campaign);
          menuScreen(m.mode === 'operation' && !m.practice ? 'campaign' : 'home');
        }
        receivedAt = performance.now();
        updateSquad();
        updateMission();
        if (($('#modal').open || feedback?.isOpen()) && $('#joinCode')) $('#modal').close();
      }
      if (data.type === 'hubState' && !world) {
        hubState = data.hub;
        receivedAt = performance.now();
      }
      if (data.type === 'start' && typeof data.ticket === 'string') {
        world = data.world;
        m = world.mission;
        receivedAt = performance.now();
        startView(data.ticket);
      }
      if (data.type === 'combat-live') enterCombat(data.ticket);
      if (data.type === 'state' && playing) {
        world = { ...data.world, mission: world.mission };
        receivedAt = performance.now();
        if (world.status !== 'playing') finish();
      }
      if (data.type === 'return') {
        returnToHangar(false);
        m = data.mission;
        roster = data.roster;
        campaign = cleanCampaign(data.campaign);
        armory = cleanHubSave(data.armory);
        hubState = data.hub || syncHubPlayers(null, roster);
        campaignView.focusLanding(campaign);
        menuScreen(m.destructible ? 'home' : campaign ? 'campaign' : 'home');
        updateSquad();
        updateMission();
        toast('Squad returned to Wake Anchorage.');
      }
    });
    conn.on('close', () => {
      if (peer === p)
        resetNetwork('Host disconnected. Your saved mechs are safe; create or join another room.');
    });
    conn.on('error', () => {
      if (peer === p) resetNetwork('Squad connection lost. Try another network or room.');
    });
  });
}
function showJoin(code = '') {
  modal(
    `<h2>Join a squad</h2><p>Enter your host’s six-character room code. Join the host’s campaign board, choose your mech and special, then mark ready. Everyone deploys to the same battlefield.</p><label class="small-label" for="joinCode">Room code</label><input class="join-code" id="joinCode" maxlength="6" autocomplete="off" spellcheck="false" value="${escape(code)}" placeholder="ABC234"><button class="button primary full" id="confirmJoin">Join squad ↗</button>`,
  );
  $('#joinCode').focus();
  $('#confirmJoin').onclick = () => {
    joinRoom($('#joinCode').value);
  };
  $('#joinCode').onkeydown = (e) => {
    if (e.key === 'Enter') $('#confirmJoin').click();
  };
}
async function copyRoom() {
  if (!room) return;
  const link = new URL(location.href);
  link.search = '';
  link.searchParams.set('room', room);
  if (destructionLabEnabled) link.searchParams.set('lab', 'destruction');
  link.hash = '';
  try {
    await navigator.clipboard.writeText(link.href);
    toast('Invite copied. Room code: ' + room);
  } catch {
    modal(
      `<h2>INVITE YOUR SQUAD</h2><p>Room code: <strong>${room}</strong></p><input aria-label="Room invite URL" value="${escape(link.href)}" readonly id="inviteUrl"><p>Select and copy this invite link.</p>`,
    );
    $('#inviteUrl').select();
  }
}
$('#host').onclick = hostRoom;
$('#join').onclick = () => showJoin();
$('#copyRoom').onclick = copyRoom;
$('#leave').onclick = () => resetNetwork('Left the squad.');
$('#reroll').onclick = () => {
  if (room && !isHost) return;
  m = testPlatform();
  if (room) {
    roster.forEach((p) => (p.ready = false));
    broadcastLobby();
  }
  updateMission();
  toast('New operation generated: ' + m.name);
};
$('#deploy').onclick = async () => {
  if (playing || deployment) return;
  if (m.campaign && (!hubDeployable() || !nearStation(hubState, localId, 'mission'))) return;
  if (m.campaign && campaign?.runState !== 'active') return;
  if (connecting || !validBuild(build) || (room && isHost && !roster.length)) return;
  if (!initBattle($('#battle'))) {
    toast(graphicsError());
    return;
  }
  initAudio();
  if (!room) {
    localId = 'local';
    if (campaign && m.mode === 'operation' && !m.practice)
      m = campaignMission(campaign, planetMission);
    world = newWorld(m, [me()]);
    startView();
    return;
  }
  const p = localPlayer();
  if (!p) return;
  if (isHost) {
    if (roster.every((p) => p.ready && validBuild(p.build))) {
      if (campaign && m.mode === 'operation' && !m.practice)
        m = campaignMission(campaign, planetMission);
      world = newWorld(m, roster);
      startView();
    } else {
      p.ready = true;
      broadcastLobby();
    }
  } else
    safeSend(hostConn, {
      type: 'ready',
      ready: !p.ready,
      campaignId: campaign?.id,
      revision: campaign?.revision,
    });
};
const {
  cancelDeployment,
  abortDeployment,
  enterCombat,
  tryLaunchDeployment,
  startView,
  updateInsertion,
} = createDeploymentController({
  readSession: () => ({ world, localId, isHost, room }),
  readPending: () => deployment,
  writePending: (value) => {
    deployment = value;
  },
  onBegin() {
    hubView.stop();
    hubView.close();
    playing = false;
    campaignMissionActive = false;
    endShown = false;
    thrusterPreview = false;
  },
  onCombat(current) {
    campaignMissionActive = !!current.mission.campaign;
    lastTick = receivedAt = performance.now();
    lastSnapshot = 0;
    playing = true;
  },
  clearInputs,
  captureMouse() {
    if (!feedback?.isOpen() && matchMedia('(pointer:fine)').matches) mouseLook.capture();
  },
  stopPreviewSound: () => updatePreviewSound(previewBuild(), performance.now() / 1000, false),
  sendToHost: (data) => safeSend(hostConn, data),
  broadcast,
  resetNetwork,
  returnToHangar,
  toast,
  sceneFlow,
});
$('.deployment-cancel').onclick = () => abortDeployment();
window.addEventListener('keydown', (event) => {
  if (!deployment || feedback?.isOpen()) return;
  if (event.code === 'Escape') {
    event.preventDefault();
    abortDeployment();
  }
});

function returnToHangar(send = true) {
  resetSound();
  cancelDeployment();
  sceneFlow.cut();
  settleCareer();
  const destructionExit = !!world?.siege;
  if (document.pointerLockElement) document.exitPointerLock();
  if (campaignMissionActive)
    settleCampaign(
      world?.status === 'won' ? 'victory' : world?.status === 'lost' ? 'defeat' : 'withdrawal',
    );
  campaignMissionActive = false;
  playing = false;
  world = null;
  clearInputs();
  $('#game').hidden = true;
  $('#hangar').hidden = false;
  menuScreen(destructionExit ? 'home' : campaign ? 'campaign' : room ? 'home' : 'garage');
  $('#modal').close();
  if (isHost || !room) {
    roster.forEach((p) => (p.ready = false));
  }
  hubState = syncHubPlayers(null, room ? roster : [me()]);
  hubView.stop();
  hubView.close();
  if (isHost && send)
    broadcast({ type: 'return', mission: m, roster, campaign, armory, hub: hubSnapshot(hubState) });
  updateMission();
  updateSquad();
}
function finish() {
  if (endShown || !world) return;
  endShown = true;
  if (isHost) broadcast({ type: 'state', world: snapshot(world, false) });
  const won = world.status === 'won';
  const careerReward = settleCareer();
  settleCampaign(won ? 'victory' : 'defeat');
  if (world.mission.mode === 'trial') {
    modal(
      `<p class="eyebrow orange">COMBAT TRIAL</p><h2>${won ? 'HOSTILE NEUTRALIZED.' : 'MECH DISABLED.'}</h2><p>${won ? 'The AI mech is down. Try another loadout or run the trial again.' : 'Boost through its firing line, close in between bursts, or equip a shield or repair system.'}</p><div class="end-stats"><div><b>${world.kills} / 1</b><span>HOSTILE DEFEATED</span></div><div><b>${Math.floor(world.time)}s</b><span>COMBAT TIME</span></div></div>${isHost || !room ? '<div class="dialog-actions"><button class="button primary" id="retryTrial">FIGHT AGAIN</button><button class="button secondary" id="trialWorkshop">WORKSHOP</button></div>' : '<p>Waiting for the host to restart or return.</p><button class="button secondary" id="leaveResult">LEAVE SQUAD</button>'}`,
    );
    if ($('#retryTrial'))
      $('#retryTrial').onclick = () => {
        world = newWorld(m, room ? roster : [me()]);
        startView();
      };
    if ($('#trialWorkshop'))
      $('#trialWorkshop').onclick = () => {
        returnToHangar();
        menuScreen('garage');
      };
    if ($('#leaveResult')) $('#leaveResult').onclick = () => resetNetwork();
    return;
  }
  if (world.sortie) {
    modal(
      debriefMarkup(sortieReport(world, won ? 'victory' : 'defeat')) +
        (careerReward ? `<p class="career-reward" role="status">${escape(careerReward)}</p>` : '') +
        (isHost || !room
          ? '<button class="button primary" id="returnHangar">RETURN TO ANCHORAGE ↗</button>'
          : '<p>Waiting for the host to return the squad.</p><button class="button secondary" id="leaveResult">LEAVE SQUAD</button>'),
    );
    if ($('#returnHangar')) $('#returnHangar').onclick = () => returnToHangar();
    if ($('#leaveResult')) $('#leaveResult').onclick = () => resetNetwork();
    return;
  }
  modal(
    `<p class="eyebrow orange">OPERATION ${escape(world.mission.name)}</p><h2>${won ? 'EXTRACTION COMPLETE.' : 'SQUAD LOST. REGROUP.'}</h2><p>${won ? (world.siege ? 'Breakwater breached. Refinery ruptured. Command collapsed. Squad extracted.' : 'Reactor destroyed. Squad extracted. Cinderfall is complete.') : 'Your loadouts are safe. Try cover, a repair system, or a different squad composition.'}</p><div class="end-stats"><div><b>${world.kills}</b><span>HOSTILES CLEARED</span></div><div><b>${world.cleared}/${world.mission.zones.length}</b><span>OBJECTIVES COMPLETE</span></div><div><b>${Math.floor(world.time / 60)}:${String(Math.floor(world.time % 60)).padStart(2, '0')}</b><span>MISSION TIME</span></div></div>${isHost || !room ? '<button class="button primary" id="returnHangar">RETURN TO ANCHORAGE ↗</button>' : '<p>Waiting for the host to return the squad to Wake Anchorage.</p><button class="button secondary" id="leaveResult">LEAVE SQUAD</button>'}`,
  );
  if ($('#returnHangar')) $('#returnHangar').onclick = () => returnToHangar();
  if ($('#leaveResult'))
    $('#leaveResult').onclick = () => {
      $('#modal').close();
      resetNetwork();
    };
}
$('#exitGame').onclick = () => {
  if (world?.mission.mode === 'sandbox' && !room) {
    returnToHangar();
    menuScreen('garage');
    return;
  }
  const destination = world?.siege ? 'HANGAR' : 'ANCHORAGE',
    place = world?.siege ? 'the lab lobby' : 'Wake Anchorage';
  modal(
    `<h2>RETURN TO ${destination}?</h2><p>${isHost ? 'The whole squad will return to ' + place + '.' : room ? 'You will leave the squad. The other pilots can continue.' : world?.siege ? 'Return to the lab lobby. Your campaign progress is unchanged.' : 'Withdraw to the campaign board. Your mechs and campaign progress are saved.'}</p><div class="dialog-actions"><button id="confirmExit" class="button primary">RETURN TO ${destination}</button><button id="stay" class="button secondary">KEEP PLAYING</button></div>`,
  );
  $('#stay').onclick = () => $('#modal').close();
  $('#confirmExit').onclick = () => {
    if (room && !isHost) {
      $('#modal').close();
      resetNetwork();
    } else {
      returnToHangar();
    }
  };
};
$('#saveMech').onclick = () => {
  if (!validBuild(build)) return;
  const index = saved.findIndex((b) => buildKey(b) === buildKey(build));
  if (index >= 0) saved[index] = cleanBuild(build);
  else if (saved.length < 12) saved.push(cleanBuild(build));
  else {
    toast('12 save slots used. Delete a mech in Saved Mechs first.');
    return;
  }
  if (write('iw-builds', saved)) toast(build.name + ' saved to this browser.');
};
function downloadBuilds() {
  const blob = new Blob(
      [
        JSON.stringify(
          { game: 'IRONWAKE', version: 6, mechs: saved.length ? saved : [cleanBuild(build)] },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = 'ironwake-mechs.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function showBuilds() {
  modal(
    `<div class="armory-heading"><div><h2>Saved machines</h2></div><span><b>${String(saved.length).padStart(2, '0')}</b> of 12</span></div><p class="armory-intro">Your designs, ready for the next drop. Loading a build clears squad readiness.</p><div class="armory-grid">${
      saved.length
        ? saved
            .map((b, i) => {
              const stats = mechStats(b),
                frame = chassisFor(b);
              return `<article class="build-card"><span class="armory-machine" style="--frame-paint:${b.color}">${chassisIcon(frame)}</span><div class="armory-card-meta"><small>${frame.name} / ${frame.size || stats.weightClass}</small><h3>${escape(b.name)}</h3><p>${b.equipment
                .filter(Boolean)
                .map((id) => EQUIPMENT[id].name.split(' / ').at(-1))
                .join(
                  ' · ',
                )}</p></div><div class="armory-stats"><span><b>${stats.hp}</b> Armor</span><span><b>${stats.weight}<small>t</small></b> Mass</span><span><b>${Math.round(stats.speed * stats.boost)}</b> Boost</span></div><div class="armory-actions"><button class="button primary" data-load="${i}">Load machine ↗</button><button class="armory-delete text-button" data-delete="${i}" aria-label="Delete ${escape(b.name)}">Delete</button></div></article>`;
            })
            .join('')
        : `<div class="armory-empty"><span>${chassisIcon(chassisFor(build))}</span><h3>No saved machines</h3><p>Save a machine in Assembly to keep it here.</p><button class="button primary" id="armoryWorkshop">Open assembly ↗</button></div>`
    }</div><div class="armory-footer"><span>Stored on this device. Export a backup to take your designs with you.</span><div class="dialog-actions"><button id="exportBuilds" class="button secondary">Export ↓</button><button id="importBuilds" class="button secondary">Import ↑</button><input type="file" id="importFile" accept="application/json,.json" hidden></div></div>`,
  );
  if ($('#armoryWorkshop'))
    $('#armoryWorkshop').onclick = () => {
      $('#modal').close();
      menuScreen('garage');
    };
  $$('[data-load]').forEach(
    (b) =>
      (b.onclick = () => {
        build = cleanBuild(saved[+b.dataset.load]);
        $('#mechName').textContent = build.name;
        buildChanged();
        $('#modal').close();
        toast('Loaded ' + build.name);
      }),
  );
  $$('[data-delete]').forEach(
    (b) =>
      (b.onclick = () => {
        b.textContent = 'Confirm delete';
        b.setAttribute('aria-label', 'Confirm deletion of ' + saved[+b.dataset.delete].name);
        b.classList.add('confirm-delete');
        b.onclick = () => {
          saved.splice(+b.dataset.delete, 1);
          write('iw-builds', saved);
          showBuilds();
        };
      }),
  );
  $('#exportBuilds').onclick = downloadBuilds;
  $('#importBuilds').onclick = () => $('#importFile').click();
  $('#importFile').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100000) {
      toast('File too large. Import an Ironwake mech backup.');
      return;
    }
    try {
      const data = JSON.parse(await file.text());
      if (
        data.game !== 'IRONWAKE' ||
        !Array.isArray(data.mechs) ||
        !data.mechs.every((b) => b && typeof b === 'object')
      )
        throw Error();
      const incoming = data.mechs.slice(0, 12 - saved.length).map(cleanBuild);
      saved.push(...incoming);
      write('iw-builds', saved);
      showBuilds();
      toast(incoming.length + ' mechs imported.');
    } catch {
      toast('Invalid file. Choose an exported Ironwake mech backup.');
    }
  };
}
const showManual = createManual({ modal, syncImpactMode });
$$('[data-view]').forEach(
  (b) =>
    (b.onclick = () => {
      if (b.dataset.view === 'builds') showBuilds();
      else if (b.dataset.view === 'manual') showManual();
      else $('#modal').close();
    }),
);
$('#controlsLink').onclick = showManual;
$('#gameHelp').onclick = showManual;
function syncImpactMode() {
  const full = impactMode() === 'full';
  $('#impactMode').textContent = 'FX: ' + (full ? 'Full' : 'Reduced');
  $('#impactMode').setAttribute('aria-pressed', String(full));
  $('#impactMode').setAttribute(
    'aria-label',
    'Impact effects: ' + impactMode() + '. Click to switch.',
  );
  if ($('#manualImpactMode'))
    $('#manualImpactMode').textContent = 'IMPACT EFFECTS: ' + impactMode().toUpperCase() + ' [V]';
}
$('#impactMode').onclick = () => {
  toggleImpactMode();
  syncImpactMode();
  toast('Impact effects: ' + impactMode());
};
syncImpactMode();
const gameKeys = [
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyQ',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'KeyE',
  'ShiftLeft',
  'ShiftRight',
  'Tab',
  'KeyU',
  'KeyF',
  'KeyB',
  'Digit1',
  'Digit2',
  'Digit3',
  'Numpad1',
  'Numpad2',
  'Numpad3',
];
function toggleFieldInventory() {
  if (!playing || $('#modal').open || feedback?.isOpen() || !sortieHud.key('KeyB')) return false;
  if (document.pointerLockElement) document.exitPointerLock();
  clearInputs();
  $('#combatMenu').open = false;
  $('#gameFieldInventory').setAttribute('aria-expanded', String(sortieHud.inventoryOpen));
  $('#battle').focus({ preventScroll: true });
  return true;
}
$('#gameFieldInventory').onclick = toggleFieldInventory;
$('#combatMenu').addEventListener('toggle', () => {
  if ($('#combatMenu').open) {
    if (document.pointerLockElement) document.exitPointerLock();
    clearInputs();
  }
});
window.addEventListener('keydown', (e) => {
  if (
    !playing ||
    $('#modal').open ||
    feedback?.isOpen() ||
    $('#combatMenu').open ||
    e.target.closest('button,summary,input,select,textarea,a,[contenteditable]')
  )
    return;
  if (e.code === 'Tab' && e.target !== $('#battle')) return;
  if (gameKeys.includes(e.code)) e.preventDefault();
  if (!e.repeat && sortieHud.key(e.code)) {
    if (['KeyB', 'KeyU'].includes(e.code)) {
      if (document.pointerLockElement) document.exitPointerLock();
      clearInputs();
    }
    return;
  }
  keys[e.code] = true;
  syncStrafe();
  if (!e.repeat && e.code === 'KeyH') {
    showManual();
    return;
  }
  if (!e.repeat && e.code === 'KeyE') pressAbility = true;
  if (!e.repeat && ['ShiftLeft', 'ShiftRight'].includes(e.code)) pressDash = true;
  if (e.code === 'Tab' && !['sandbox', 'trial'].includes(world?.mission.mode))
    $('#levelMapPanel').hidden = false;
  if (!e.repeat && e.code === 'KeyV') $('#impactMode').click();
  if (!e.repeat && e.code === 'KeyM') $('#soundToggle').click();
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  syncStrafe();
  if (e.code === 'Tab') $('#levelMapPanel').hidden = true;
});
function clearInputs() {
  keys = {};
  mouse.strafe = false;
  setStrafe(false);
  mouseLook.reset();
  $('#levelMapPanel').hidden = true;
  mouse.left = false;
  mouse.right = false;
  view.aiming = false;
  touch.left = false;
  touch.right = false;
  touch.fly = false;
  touch.x = touch.y = 0;
  pressAbility = pressMelee = pressDash = false;
  handPress.left = handPress.right = false;
}
window.addEventListener('blur', clearInputs);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearInputs();
});
const mouseLook = createMouseLook({
  canvas: $('#battle'),
  active: () =>
    playing &&
    !($('#modal').open || feedback?.isOpen()) &&
    !$('#combatMenu').open &&
    $('#levelMapPanel').hidden,
  look,
  onLock: (locked) => (view.locked = locked),
  onRelease: clearInputs,
  onFallback: () => toast('Mouse aims without clicking. Move to the screen edge to keep turning.'),
});
function syncStrafe() {
  setStrafe(!!keys.KeyQ || !!mouse.strafe);
}
function syncMouse(e) {
  Object.assign(mouse, mouseButtons(e.buttons));
  mouse.strafe = !!(e.buttons & 4);
  view.aiming = false;
  syncStrafe();
}
$('#battle').addEventListener('mousedown', (e) => {
  if (!playing || $('#modal').open || feedback?.isOpen()) return;
  initAudio();
  if (e.button < 0 || e.button > 2) return;
  e.preventDefault();
  syncMouse(e);
  if (e.button === 0 || e.button === 2) handPress[e.button === 0 ? 'left' : 'right'] = true;
  mouseLook.capture();
});
window.addEventListener('mouseup', (e) => {
  if (playing) syncMouse(e);
});
$('#battle').addEventListener('auxclick', (e) => {
  if (e.button === 1) e.preventDefault();
});
$('#battle').addEventListener('pointercancel', clearInputs);
$('#battle').addEventListener('contextmenu', (e) => e.preventDefault());
$('#abilityButton').onclick = () => (pressAbility = true);
$('#dashButton').onclick = () => (pressDash = true);
$('#mapToggle').onclick = () => {
  if (!['sandbox', 'trial'].includes(world?.mission.mode))
    $('#levelMapPanel').hidden = !$('#levelMapPanel').hidden;
};
$('#flightButton').addEventListener('pointerdown', (e) => {
  e.target.setPointerCapture(e.pointerId);
  touch.fly = true;
});
$('#flightButton').addEventListener('pointerup', () => (touch.fly = false));
$('#flightButton').addEventListener('pointercancel', () => (touch.fly = false));
function syncPilotVoice() {
  const on = pilotVoiceEnabled();
  $('#voiceToggle').textContent = 'VOICE ' + (on ? 'ON' : 'OFF');
  $('#voiceToggle').setAttribute('aria-pressed', String(on));
}
$('#voiceToggle').onclick = () => {
  initAudio();
  togglePilotVoice();
  syncPilotVoice();
};
syncPilotVoice();
installPilotVoicePicker({
  openModal: modal,
  selected: selectedPilotVoice,
  select: selectPilotVoice,
  preview: previewPilotVoice,
  stop: stopPilotVoice,
  enabled: pilotVoiceEnabled,
});
$('#soundToggle').onclick = () => {
  $('#soundToggle').textContent = toggleSound() ? 'SOUND OFF [M]' : 'SOUND ON [M]';
};
let joystickPointer = null;
$('#joystick').addEventListener('pointerdown', (e) => {
  joystickPointer = e.pointerId;
  e.target.setPointerCapture(e.pointerId);
  updateStick(e);
});
$('#joystick').addEventListener('pointermove', (e) => {
  if (joystickPointer === e.pointerId) updateStick(e);
});
function updateStick(e) {
  const r = $('#joystick').getBoundingClientRect(),
    x = e.clientX - r.left - r.width / 2,
    y = e.clientY - r.top - r.height / 2,
    l = Math.max(40, Math.hypot(x, y));
  touch.x = x / l;
  touch.y = y / l;
  $('#joystick i').style.transform = `translate(${touch.x * 32}px,${touch.y * 32}px)`;
}
function releaseStick() {
  joystickPointer = null;
  touch.x = touch.y = 0;
  $('#joystick i').style.transform = '';
}
$('#joystick').addEventListener('pointerup', releaseStick);
$('#joystick').addEventListener('pointercancel', releaseStick);
for (const [id, hand] of [
  ['touchFire', 'left'],
  ['touchMelee', 'right'],
  ['leftHandButton', 'left'],
  ['rightHandButton', 'right'],
]) {
  const button = $('#' + id);
  button.addEventListener('contextmenu', (e) => e.preventDefault());
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    initAudio();
    button.setPointerCapture(e.pointerId);
    touch[hand] = true;
    handPress[hand] = true;
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
    button.addEventListener(event, () => (touch[hand] = false));
}

function getInput() {
  const p = world?.players.find((p) => p.id === localId);
  if (!p || $('#modal').open || feedback?.isOpen() || $('#combatMenu').open)
    return { x: 0, y: 0, fire: false };
  if (keys.ArrowLeft) view.yaw -= 0.055;
  if (keys.ArrowRight) view.yaw += 0.055;
  const movement = movementInput(keys, touch),
    aim = getAim(p),
    input = {
      ...movement,
      ...aim,
      left: mouse.left || touch.left,
      right: mouse.right || touch.right,
      leftPressed: handPress.left,
      rightPressed: handPress.right,
      ability: pressAbility,
      dash: pressDash,
      auto: false,
      ...sortieHud.consumeInput(),
    };
  pressAbility = pressMelee = pressDash = false;
  handPress.left = handPress.right = false;
  return input;
}
feedback = installFeedback({
  capture: () => reportCapture.request(),
  context: () => {
    const p = world?.players.find((p) => p.id === localId);
    return {
      capturedAt: new Date().toISOString(),
      client: 'in-game-feedback-v1',
      build: document.querySelector('#buildLabel')?.title || 'Development build',
      page: location.pathname,
      screen: deployment ? 'deployment' : playing ? 'battle' : document.body.dataset.screen,
      browser: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio },
      effects: impactMode(),
      session: room ? (isHost ? 'co-op host' : 'co-op guest') : 'solo',
      players: world?.players.length || 1,
      mission: { name: m.name, mode: m.mode, seed: m.seed, id: m.id },
      round: world
        ? {
            time: Math.round(world.time * 10) / 10,
            status: world.status,
            zone: world.zoneIndex,
            kills: world.kills,
          }
        : null,
      player: p
        ? {
            x: Math.round(p.x),
            y: Math.round(p.y),
            altitude: Math.round(p.altitude),
            hp: Math.round(p.hp),
          }
        : null,
      loadout: cleanBuild(build),
    };
  },
  onOpen: () => {
    if (document.pointerLockElement) document.exitPointerLock();
    clearInputs();
    hubView.stop();
  },
  onClose: () => {
    clearInputs();
    lastTick = performance.now();
  },
});
let lastTick = performance.now();
setInterval(() => {
  const now = performance.now(),
    dt = Math.min(0.05, (now - lastTick) / 1000);
  lastTick = now;
  if (!playing || !world) {
    if (!world) tickHub(now, dt);
    return;
  }
  if (!room && feedback?.isOpen()) return;
  mouseLook.update(dt);
  const input = getInput();
  if (isHost || !room) {
    setInput(world, localId, input);
    step(world, dt);
    if (now - lastSnapshot >= 33) {
      lastSnapshot = now;
      if (room) broadcast({ type: 'state', world: snapshot(world, false) });
    }
    if (world.status !== 'playing') finish();
  } else {
    safeSend(hostConn, { type: 'input', input });
    if (now - receivedAt > 10000) {
      resetNetwork('Host stopped responding. Create or join a new room.');
    }
  }
}, 1000 / 60);
let hudAt = 0;
const updateHud = createCombatHud({
  readState: () => ({ world, localId }),
  sortieHud,
  mouseLook,
  beforeUpdate: (current) => destructionLab.update(current),
});
const updateLabels = createWorldLabels({ readState: () => ({ world, localId }), projectWorld });
function drawRadar() {
  const p = world.players.find((p) => p.id === localId);
  if (p) drawNearbyMap($('#radar'), world, p, view.yaw);
}
function frame(t) {
  const homeDelta = homeTick ? Math.min(0.05, (t - homeTick) / 1000) : 0;
  homeTick = t;
  try {
    if (deployment && world) {
      updateInsertion(t);
    } else if (playing && world) {
      drawBattle3D($('#battle'), world, localId, t / 1000);
      updateSound(world, localId);
      if (t - hudAt > 65) {
        updateHud();
        updateLabels();
        drawRadar();
        if (!$('#levelMapPanel').hidden) drawMap($('#levelMap'), world.mission, world, localId);
        hudAt = t;
      }
    } else if (document.body.dataset.screen === 'hub') {
      updateBoostSound(0);
      updatePreviewSound(previewBuild(), t / 1000, false);
      hubView.draw(t / 1000, impactMode() === 'reduced');
    } else if (document.body.dataset.screen === 'home') {
      updatePreviewSound(previewBuild(), t / 1000, false);
      updateBoostSound(0);
      if (!homePaused) homeTime = reduced ? 2 : homeTime + homeDelta;
      drawHomeBattle3D($('#mechPreview'), build, homeTime);
    } else if (document.body.dataset.screen === 'garage') {
      updatePreviewSound(previewBuild(), t / 1000, equipmentPreview);
      updateBoostSound(thrusterPreview ? 0.8 : 0, build.parts.booster);
      drawPreview3D(
        $('#mechPreview'),
        previewBuild(),
        reduced ? 0 : t / 1000,
        thrusterPreview,
        equipmentPreview,
      );
    } else {
      updateBoostSound(0);
      updatePreviewSound(previewBuild(), t / 1000, false);
    }
    reportCapture.frame(
      playing || deployment?.insertionAt != null
        ? $('#battle')
        : deployment
          ? null
          : document.body.dataset.screen === 'hub'
            ? $('#hubCanvas')
            : ['home', 'garage'].includes(document.body.dataset.screen)
              ? $('#mechPreview')
              : null,
    );
  } catch (e) {
    console.error(e);
    if (deployment) abortDeployment('Graphics interrupted during deployment. Try again or reload.');
    else toast('Graphics interrupted. Return to the workshop and reload.');
  }
  requestAnimationFrame(frame);
}
updateBuild();
updateSquad();
updateMission();
requestAnimationFrame(frame);
window.addEventListener('resize', () => {
  if (!playing) drawMap($('#missionMap'), m);
});
const invite = new URLSearchParams(location.search).get('room');
if (invite && /^[A-Z2-9]{6}$/i.test(invite)) showJoin(invite.toUpperCase());

$('#testWeapons').onclick = () => {
  initAudio();
  equipmentPreview = !equipmentPreview;
  $('#testWeapons').textContent = equipmentPreview ? 'Stop equipment' : 'Test equipment';
  $('#testWeapons').setAttribute('aria-pressed', String(equipmentPreview));
};

function previewBuild() {
  const inspected = getWorkshopPreview(build),
    slot = activeSlot.startsWith('equip')
      ? Number(activeSlot.slice(5))
      : Math.max(0, inspected.equipment.findIndex(Boolean)),
    item = inspected.equipment[slot];
  return {
    ...inspected,
    selectedSlot: slot,
    weapon: RANGED[item] ? item : inspected.weapon,
    melee: MELEE[item] ? item : inspected.melee,
  };
}
$('#battle').addEventListener(
  'wheel',
  (e) => {
    if (playing) e.preventDefault();
  },
  { passive: false },
);

installPreviewOrbit({
  canvas: $('#mechPreview'),
  isActive: () => document.body.dataset.screen === 'garage',
  rotatePreview,
  zoomPreview,
  resetButton: $('#resetOrbit'),
  resetPreviewOrbit,
});
$('#pauseBattle').onclick = () => {
  homePaused = !homePaused;
  $('#pauseBattle').textContent = homePaused ? 'Resume battle' : 'Pause battle';
  $('#pauseBattle').setAttribute('aria-pressed', String(homePaused));
};

if (destructionLabEnabled) {
  const option = document.createElement('option');
  option.value = 'destruction';
  option.textContent = 'Experimental 02 / Breakwater';
  $('#trialMode').append(option);
}
const destructionLab = createDestructionLab({
  open: modal,
  graphics: destructionGraphics,
  canControl: () => !room || isHost,
  choose(variant) {
    if (room && !isHost) {
      toast('The host selects the destruction run.');
      return;
    }
    selectMode('destruction', variant);
    $('#modal').close();
    if (room) {
      menuScreen('home');
      toast(m.name + ' selected. Mark ready to deploy together.');
    } else $('#deploy').click();
  },
  fitKit() {
    build = cleanBuild({
      ...build,
      chassis: 'anvil',
      parts: {
        torso: 'standard',
        head: 'standard',
        arms: 'standard',
        legs: 'standard',
        booster: 'standard',
      },
      equipment: ['hammer', 'launcher', 'repair'],
    });
    buildChanged();
    toast('Demolition kit fitted: hammer, rockets and repair.');
  },
  restart() {
    if (room && !isHost) {
      toast('Only the host can reset a run.');
      return;
    }
    world = newWorld(m, room ? roster : [me()]);
    startView();
  },
});
