import { select as $, escapeHtml as escape } from './dom.js';
import {
  WEAPONS,
  ABILITIES,
  COMBAT_MOVES,
  specialFor,
  combatStats,
  combatRecovery,
} from '../core.js?v=41';
import {
  hullStatus,
  taskStatus,
  objectiveStatus,
  ultimateStatus,
} from '../hud-status.js?v=ui-stack-1';
import { squadStatus } from '../squad-status.js?v=41';
import { itemIcon } from '../workshop-icons.js?v=41';
import { view } from '../view-controls.js?v=41';

// Read live session state; hull and cooldown seconds share authoritative calculations.
export function createCombatHud({ readState, sortieHud, mouseLook, beforeUpdate }) {
  function updateMotionReticle(p) {
    const hands = (p.hands || [])
        .map((h, i) => ({ ...h, index: i }))
        .filter((h) => WEAPONS[h.item]?.moveRecharge),
      panel = $('#motionReticle');
    panel.hidden = !hands.length;
    if (!hands.length) return;
    const dual = hands.length === 2;
    $('#motionRightTrack').style.display = dual ? '' : 'none';
    for (let i = 0; i < 2; i++) {
      const ring = $(i ? '#motionRight' : '#motionLeft'),
        h = hands[i];
      ring.style.display = h ? '' : 'none';
      if (h) ring.style.strokeDashoffset = 100 - Math.min(100, (h.motionCharge || 0) * 100);
    }
    const ready = hands.every((h) => h.motionCharge >= 1 && h.shot <= 0);
    panel.dataset.ready = String(ready);
    $('#motionChargeText').textContent = hands
      .map(
        (h) =>
          (h.index ? 'R ' : 'L ') +
          (h.motionCharge >= 1
            ? h.shot > 0
              ? 'CYCLING'
              : 'READY'
            : Math.floor(h.motionCharge * 100) + '%'),
      )
      .join(' · ');
    $('#motionChargeHint').textContent = ready
      ? 'DYNAMO'
      : hands.some((h) => h.motionCharge < 1)
        ? 'MOVE TO RECHARGE'
        : 'RECOVERING';
    panel.setAttribute(
      'aria-label',
      hands
        .map(
          (h) =>
            (h.index ? 'Right' : 'Left') +
            ' Dynamo charge ' +
            Math.round(h.motionCharge * 100) +
            ' percent',
        )
        .join('. '),
    );
  }
  // Render the same recovery intervals that drive each hand in stepHand.
  function updateWeaponHud(p, index) {
    const hand = index ? 'right' : 'left',
      id = p.build.equipment[index],
      weapon = WEAPONS[id],
      name = weapon.name.split(' / ').at(-1),
      h = p.hands?.[index] || {},
      button = $('#' + hand + 'HandButton');
    const remaining = Math.max(0, weapon.melee ? h.meleeTime || 0 : h.shot || 0),
      rate = weapon.rate * (id === 'rotary' ? 1 + (1 - (h.spin || 0)) * 0.5 : 1),
      movement = !!weapon.moveRecharge && (h.motionCharge || 0) < 1,
      seconds = remaining / combatRecovery(p).weaponRate;
    const charging = !!h.railCharging || h.railCharge > 0,
      firing =
        !!h.flame ||
        !!h.beam ||
        !!h.slamDiving ||
        (remaining > 0 && (!!h.triggerHeld || weapon.melee)),
      blocked = p.hp <= 0 || (p.moveKind === 'dash' && p.moveTime > 0);
    let recovery = Math.max(0, Math.min(1, 1 - remaining / rate));
    if (movement) recovery = Math.min(recovery, Math.max(0, h.motionCharge || 0));
    if (charging) recovery = Math.max(0, Math.min(1, h.railCharge || 0));
    const activity =
      p.hp <= 0
        ? 'offline'
        : blocked
          ? 'disabled'
          : h.guarding
            ? 'blocking'
            : charging
              ? 'charging'
              : firing
                ? 'firing'
                : movement
                  ? 'movement-recharge'
                  : remaining > 0
                    ? 'recovering'
                    : 'ready';
    const state =
      activity === 'blocking' || activity === 'firing'
        ? 'active'
        : activity === 'movement-recharge' || activity === 'charging'
          ? 'charging'
          : activity;
    const detail =
      activity === 'offline'
        ? 'OFFLINE'
        : activity === 'disabled'
          ? 'DASHING'
          : h.guarding
            ? 'BLOCKING'
            : h.slamDiving
              ? 'DIVING'
              : h.meleeTime > 0
                ? 'SWINGING'
                : charging
                  ? 'CHARGE ' + Math.round((h.railCharge || 0) * 100) + '%'
                  : h.flame
                    ? 'FLAME ACTIVE'
                    : h.beam
                      ? 'BEAM ACTIVE'
                      : movement
                        ? 'MOVE ' + Math.floor((h.motionCharge || 0) * 100) + '%'
                        : remaining > 0
                          ? id === 'rail'
                            ? 'RECOVERING'
                            : 'CYCLING'
                          : 'READY';
    $('#' + hand + 'HandName').textContent = name;
    $('#' + hand + 'HandState').textContent = detail;
    $('#' + hand + 'HandCooldown').textContent =
      !blocked && !firing && remaining > 0 ? seconds.toFixed(1) + 's' : '';
    const icon = $('#' + hand + 'HandIcon');
    if (icon.dataset.item !== id) {
      icon.innerHTML = itemIcon('equip' + index, id, weapon);
      icon.dataset.item = id;
    }
    button.dataset.state = state;
    button.dataset.activity = activity;
    button.style.setProperty('--recovery', Math.round(recovery * 1000) / 10 + '%');
    button.classList.toggle('active', activity === 'firing' || activity === 'blocking');
    const status =
      activity === 'movement-recharge'
        ? Math.round((h.motionCharge || 0) * 100) + ' percent, move to recharge'
        : activity === 'recovering'
          ? seconds.toFixed(1) + ' seconds to recover'
          : activity === 'charging'
            ? Math.round((h.railCharge || 0) * 100) + ' percent charged'
            : activity;
    const label = (index ? 'Right' : 'Left') + ' hand, ' + name + ': ' + status;
    button.setAttribute('aria-label', label);
    button.title = name + ' — ' + status;
    $(index ? '#activeEquipment' : '#diagramMelee').textContent = name;
  }

  function updateHud() {
    const { world, localId } = readState();
    beforeUpdate(world);
    const p = world.players.find((p) => p.id === localId);
    if (!p) return;
    sortieHud.update(world, p);
    $('#gameFieldInventory').disabled = !world.sortie || !p.field;
    $('#gameFieldInventory').setAttribute('aria-expanded', String(sortieHud.inventoryOpen));
    $('#game').classList.toggle('boosting', !!p.boosting);
    $('#flightButton').classList.toggle('engaged', !!p.airborne);
    const task = taskStatus(world, p, view.yaw),
      objectives = objectiveStatus(world, p);
    const repeatedNotice =
      !!task.notice && task.label.toLowerCase().includes(objectives.personal.toLowerCase());
    $('#taskBanner').hidden = !task.warning && (!task.notice || repeatedNotice);
    $('#objectivesPanel').classList.toggle(
      'objectives-duplicate',
      objectives.personal.trim().toLowerCase() === objectives.team.trim().toLowerCase(),
    );
    for (const [id, key] of [
      ['personalObjective', 'personal'],
      ['personalObjectiveDetail', 'personalDetail'],
      ['teamObjective', 'team'],
      ['teamObjectiveDetail', 'teamDetail'],
    ]) {
      if ($('#' + id).textContent !== objectives[key]) $('#' + id).textContent = objectives[key];
    }
    $('#objectiveMode').textContent =
      world.mission.mode === 'sandbox'
        ? 'TEST BAY'
        : world.mission.mode === 'trial'
          ? 'COMBAT TRIAL'
          : world.operation
            ? world.mission.name
            : world.siege
              ? 'PROTOTYPE 02'
              : 'MISSION';
    $('#teamProgress').hidden = objectives.progress === null;
    $('#teamProgressFill').style.width = (objectives.progress || 0) + '%';
    if ($('#levelLabel').textContent !== task.label) $('#levelLabel').textContent = task.label;
    if ($('#objectiveText').textContent !== task.detail)
      $('#objectiveText').textContent = task.detail;
    $('#taskKind').textContent = task.warning
      ? '! WARNING'
      : task.notice
        ? 'MISSION UPDATE'
        : 'TASK / ' + String(world.zoneIndex + 1).padStart(2, '0');
    $('#taskBanner').classList.toggle('warning', !!task.warning);
    $('#taskBanner').classList.toggle('heavy-arrival', !!task.heavy);
    $('#progressBar').style.width =
      (world.mission.zones.length ? (world.cleared / world.mission.zones.length) * 100 : 0) + '%';
    $('#hudName').textContent = p.build.name;
    const recovery = combatRecovery(p),
      hull = hullStatus(p, combatStats(p).hp);
    $('#hullHealth').dataset.state = hull.state;
    $('#hullValue').textContent = String(hull.current);
    $('#hullFill').style.width = hull.percent + '%';
    $('#hullMeter').setAttribute('aria-valuenow', String(hull.percent));
    $('#hullMeter').setAttribute(
      'aria-valuetext',
      `${hull.current} of ${hull.max} hull health, ${hull.state}`,
    );
    $('#hullCondition').textContent =
      hull.state === 'offline' ? 'OFFLINE' : hull.state === 'critical' ? 'CRITICAL' : 'HULL';
    $('#game').classList.toggle('guarding', !!p.guarding);
    const special = specialFor(p);
    $('#abilityLabel').textContent = special ? ABILITIES[special].name.toUpperCase() : 'NO SPECIAL';
    const abilityIcon = $('#abilityIcon');
    if (abilityIcon.dataset.item !== special) {
      abilityIcon.innerHTML = special ? itemIcon('equip2', special, ABILITIES[special]) : '';
      abilityIcon.dataset.item = special || '';
    }
    for (const kind of ['dash']) {
      const remaining = p[kind + 'Cd'] || 0,
        seconds = remaining / recovery.dashRate,
        active = p.moveKind === kind && p.moveTime > 0,
        ready = p.hp > 0 && remaining <= 0 && !(p.moveTime > 0);
      $('#' + kind + 'Cd').textContent = active
        ? 'ACTIVE'
        : remaining > 0
          ? seconds.toFixed(1) + 's'
          : p.moveTime > 0
            ? 'WAIT'
            : 'READY';
      $('#' + kind + 'Button').disabled = !ready;
      $('#' + kind + 'Button').classList.toggle('active', active);
      $('#' + kind + 'Button').dataset.state =
        p.hp <= 0 ? 'offline' : active ? 'active' : ready ? 'ready' : 'charging';
      $('#' + kind + 'Button').style.setProperty(
        '--charge',
        Math.max(0, 100 * (1 - remaining / COMBAT_MOVES[kind].cd)) + '%',
      );
      $('#' + kind + 'Button').setAttribute(
        'aria-label',
        COMBAT_MOVES[kind].name +
          ': ' +
          (active
            ? 'active'
            : ready
              ? 'ready'
              : remaining > 0
                ? seconds.toFixed(1) + ' seconds'
                : 'finish current move'),
      );
      $('#' + kind + 'Fill').style.width =
        Math.max(0, 100 * (1 - remaining / COMBAT_MOVES[kind].cd)) + '%';
    }
    const ultimate = ultimateStatus(p, ABILITIES[special], recovery.specialRate);
    $('#abilityCd').textContent = ultimate.counter;
    $('#abilityStatus').textContent = ultimate.detail;
    $('#abilityButton').dataset.state = ultimate.state;
    $('#abilityButton').style.setProperty('--charge', ultimate.percent + '%');
    $('#abilityButton').disabled = !ultimate.ready;
    $('#abilityButton').setAttribute(
      'aria-label',
      `${ABILITIES[special]?.name || 'Ultimate'}: ${ultimate.ready ? 'ready, press E' : ultimate.detail + ', ' + ultimate.counter + ' to recharge'}`,
    );
    $('#ultimateFill').style.width = ultimate.percent + '%';
    $('#ultimateMeter').setAttribute('aria-valuenow', String(ultimate.percent));
    $('#ultimateMeter').setAttribute(
      'aria-valuetext',
      ultimate.ready
        ? 'Ready'
        : p.hp <= 0
          ? 'Mech disabled'
          : `${((p.abilityCd || 0) / recovery.specialRate).toFixed(1)} seconds remaining`,
    );
    $('#abilityButton').classList.toggle('engaged', p.active > 0);
    for (let i = 0; i < 2; i++) updateWeaponHud(p, i);
    updateMotionReticle(p);
    $('#equipmentState').textContent = 'INDEPENDENT HAND CONTROLS';
    $('#zoomState').textContent = p.build.equipment.includes('rail')
      ? 'RAIL: CLICK / HOLD'
      : 'HOLD TO USE';
    $('#crosshair').classList.toggle('hit', world.time - p.hitTime < 0.12);
    $('#viewHint').hidden = !mouseLook.paused;
    $('#viewHint').textContent = 'Click to resume aiming';
    $('#damageVignette').style.opacity =
      world.mission.mode === 'trial' || world.operation
        ? Math.max(0, 1 - (world.time - (p.lastHurt ?? -10)) / 0.3) * 0.45
        : 0;
    $('#squadLinkState').textContent = world.players.length + ' / 4';
    $('#game').style.setProperty(
      '--squad-extra',
      Math.max(0, world.players.length - 1) * 14 + 'px',
    );
    const squadMarkup = squadStatus(world.players, localId)
      .filter((q) => !q.empty)
      .map(
        (q) =>
          `<div class="squad-channel ${q.downed ? 'downed' : ''}"><span>0${q.channel}</span><b>${escape(q.name)}${q.self ? ' · YOU' : ''}</b><small>${q.status}</small></div>`,
      )
      .join('');
    if ($('#squadHud').innerHTML !== squadMarkup) $('#squadHud').innerHTML = squadMarkup;
  }

  return updateHud;
}
