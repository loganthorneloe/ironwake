import {
  hubRoute,
  HUB_STATIONS,
  HUB_CATALOG,
  HUB_STORIES,
  HUB_RADIUS,
  ownsLicense,
  nearStation,
  missingLicenses,
} from './hub-state.js';
import { createHubScene } from './hub-scene.js';
import { careerStationMarkup } from './career-view.js';
import { profileFor, refitOffer } from './campaign.js';
import { FIELD_MODULES } from './sortie-progression.js';
import { PART_LABELS, validBuild } from './core.js?v=41';
import { itemIcon } from './workshop-icons.js?v=41';
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

// Campaign lifecycle changes can enable readiness without changing the roster.
export function hubTeamKey({ members, room, isHost, connecting, build, save, campaign }) {
  return JSON.stringify([
    members.map((p) => [p.id, p.name, p.ready]),
    room,
    isHost,
    connecting,
    validBuild(build),
    missingLicenses(save, build).length,
    campaign?.id,
    campaign?.revision,
    campaign?.runState,
  ]);
}

export function createHubView(root, campaignRoot, actions) {
  root.innerHTML = `<canvas id="hubCanvas" tabindex="0" aria-label="Wake Anchorage. WASD or arrow keys to walk. E to interact. Choose a station marker to walk there."></canvas>
    <div class="hub-vignette"></div><header class="hub-heading"><span class="hub-eyebrow">KEPLER-9 / SAFE HARBOR</span><h1>Wake Anchorage<span>YOUR SQUAD. YOUR WAY HOME.</span></h1><p id="hubRunStatus"></p></header>
    <aside class="hub-account"><span>SHARED ARMORY CREDITS</span><strong id="hubCredits">360 <small>CR</small></strong><p>Licenses stay. Run modules reset.</p><div id="hubTeam"></div><div class="hub-network"><button data-hub-action="host">Host friends</button><button data-hub-action="join">Join squad</button><button data-hub-action="invite" hidden>Copy invite</button><button data-hub-action="leave" hidden>Leave squad</button></div></aside>
    <div id="hubMarkers"></div><nav class="hub-directory" aria-label="Hub stations">${HUB_STATIONS.map((s) => `<button data-walk="${s.id}" style="--station:${s.color}"><b>${s.number}</b><span>${s.name}<small>${s.role}</small></span><i>↗</i></button>`).join('')}</nav>
    <div class="hub-interact"><button id="hubInteract" disabled><kbd>E</kbd><span>Approach a station</span></button><p id="hubWalkHint">WASD / ARROWS to walk · Select a station to navigate · Scroll to zoom</p></div>
    <div class="hub-touch" aria-label="Hub movement"><button data-move="0,-1" aria-label="Walk north">↑</button><button data-move="-1,0" aria-label="Walk west">←</button><button data-move="0,1" aria-label="Walk south">↓</button><button data-move="1,0" aria-label="Walk east">→</button></div>
    <section id="hubVendor" class="hub-vendor" hidden aria-label="Vendor"><button data-hub-close class="hub-close" aria-label="Close station">×</button><div id="hubVendorBody"></div></section>
    <section id="hubCommand" class="hub-command" hidden aria-label="Mission command"><button data-hub-close class="hub-command-close">← Return to Anchorage</button><div id="hubCommandBody"></div></section>
    <div id="hubGraphicsError" class="hub-error" hidden role="alert"></div>`;
  root.querySelector('#hubCommandBody').append(campaignRoot);
  const $ = (s) => root.querySelector(s),
    canvas = $('#hubCanvas'),
    pressed = new Set(),
    markerNodes = new Map(),
    pilotNodes = new Map();
  let station = null,
    latest,
    scene,
    route = [],
    destination = null,
    partSlot = 'torso',
    hand = 0,
    touch = { x: 0, z: 0 },
    signature = '',
    errorShown = false,
    careerFeedback = '';
  const stationModes = { parts: 'career', story: 'career' },
    careerSelection = { mech: { chassisId: null, branchId: null }, pilot: { branchId: null } };
  const visible = () =>
    document.body.dataset.screen === 'hub' && !document.querySelector('#hangar').hidden;
  const active = () =>
    visible() && !actions.inputBlocked?.() && !document.querySelector('#modal').open;
  function close() {
    station = null;
    careerFeedback = '';
    $('#hubVendor').hidden = true;
    $('#hubCommand').hidden = true;
    pressed.clear();
    touch = { x: 0, z: 0 };
    signature = '';
    canvas.focus({ preventScroll: true });
  }
  function open(id) {
    if (!latest || !nearStation(latest.state, latest.localId, id)) return;
    if (station !== id) $('#hubVendorBody').scrollTop = 0;
    station = id;
    careerFeedback = '';
    route = [];
    destination = null;
    pressed.clear();
    touch = { x: 0, z: 0 };
    signature = '';
    $('#hubCommand').hidden = id !== 'mission';
    $('#hubVendor').hidden = id === 'mission';
    if (id === 'mission') actions.command();
    else renderVendor();
    (id === 'mission' ? $('#hubCommand button') : $('#hubVendor button'))?.focus({
      preventScroll: true,
    });
  }
  function walkTo(id) {
    if (!latest) return;
    close();
    const s = HUB_STATIONS.find((s) => s.id === id),
      p = latest.state.players.find((p) => p.id === latest.localId);
    if (!s || !p) return;
    if (nearStation(latest.state, p.id, id)) {
      open(id);
      return;
    }
    route = hubRoute(p, s);
    destination = route.length ? id : null;
  }
  root.addEventListener('click', (event) => {
    const el = event.target.closest('button');
    if (!el || el.disabled) return;
    if (el.hasAttribute('data-hub-close')) close();
    if (el.dataset.walk) walkTo(el.dataset.walk);
    if (el.dataset.hubAction) actions[el.dataset.hubAction]?.();
    if (el.dataset.hubMode && ['parts', 'story'].includes(station)) {
      const allowed = station === 'parts' ? ['career', 'licenses'] : ['career', 'signals'];
      if (allowed.includes(el.dataset.hubMode)) {
        stationModes[station] = el.dataset.hubMode;
        careerFeedback = '';
        signature = '';
        renderVendor();
      }
    }
    if (el.dataset.careerBranch) {
      const kind = station === 'parts' ? 'mech' : 'pilot';
      careerSelection[kind].branchId = el.dataset.careerBranch;
      careerFeedback = '';
      signature = '';
      renderVendor();
    }
    if (el.hasAttribute('data-career-unlock') || el.hasAttribute('data-career-reset')) {
      const panel = el.closest('.career-station');
      if (panel && latest && nearStation(latest.state, latest.localId, station)) {
        const request = {
          kind: panel.dataset.careerKind,
          key: panel.dataset.careerKey,
          revision: Number(panel.dataset.careerRevision),
        };
        const message = el.hasAttribute('data-career-unlock')
          ? actions.careerUnlock?.({ ...request, nodeId: el.dataset.careerUnlock })
          : actions.careerReset?.(request);
        careerFeedback = typeof message === 'string' ? message : 'Career progress updated.';
        signature = '';
        renderVendor(true);
      }
    }
    if (el.dataset.partSlot) {
      partSlot = el.dataset.partSlot;
      signature = '';
      renderVendor();
    }
    if (el.dataset.hubHand) {
      hand = Number(el.dataset.hubHand);
      signature = '';
      renderVendor();
    }
    if (el.dataset.buy) actions.buy({ id: el.dataset.buy, revision: latest.save.revision });
    if (el.dataset.fit) actions.fit(el.dataset.fit, hand);
    if (el.dataset.hubRefit)
      actions.refit({ id: el.dataset.hubRefit, revision: latest.campaign.revision });
    if (el.dataset.hubAction === 'ready') pressed.clear();
    if (el.id === 'hubInteract') {
      const nearest = nearestStation();
      if (nearest) open(nearest.id);
    }
  });
  root.addEventListener('change', (event) => {
    if (event.target.matches('[data-career-chassis]')) {
      careerSelection.mech.chassisId = event.target.value;
      careerFeedback = '';
      signature = '';
      renderVendor();
    }
  });
  for (const button of root.querySelectorAll('[data-move]')) {
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      const [x, z] = button.dataset.move.split(',').map(Number);
      touch = { x, z };
      route = [];
      destination = null;
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
      button.addEventListener(name, () => (touch = { x: 0, z: 0 }));
  }
  window.addEventListener('keydown', (e) => {
    if (!active() || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      close();
      route = [];
      destination = null;
      return;
    }
    if (station) return;
    if (
      [
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'KeyE',
      ].includes(e.code)
    ) {
      e.preventDefault();
      if (e.code === 'KeyE') {
        if (!e.repeat) {
          const s = nearestStation();
          if (s) open(s.id);
        }
      } else {
        pressed.add(e.code);
        route = [];
        destination = null;
      }
    }
  });
  window.addEventListener('keyup', (e) => pressed.delete(e.code));
  function stop() {
    pressed.clear();
    touch = { x: 0, z: 0 };
    route = [];
    destination = null;
  }
  window.addEventListener('blur', stop);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (active()) {
        e.preventDefault();
        scene?.zoom(e.deltaY);
      }
    },
    { passive: false },
  );
  function nearestStation() {
    const p = latest?.state.players.find((p) => p.id === latest.localId);
    return p
      ? HUB_STATIONS.filter((s) => Math.hypot(p.x - s.x, p.z - s.z) <= HUB_RADIUS).sort(
          (a, b) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(p.x - b.x, p.z - b.z),
        )[0]
      : null;
  }
  function renderVendor(focusFeedback = false) {
    if (!latest || !station || station === 'mission') return;
    const { save, campaign, build, members, localId, career, pilot } = latest,
      s = HUB_STATIONS.find((s) => s.id === station),
      self = members.find((p) => p.id === localId) || members[0],
      profile = profileFor(campaign, self.name);
    const careerKind = station === 'parts' ? 'mech' : 'pilot',
      selection = careerSelection[careerKind],
      mode = stationModes[station];
    const key = JSON.stringify([
      station,
      save.revision,
      campaign?.revision,
      build.parts,
      build.equipment,
      build.chassis,
      partSlot,
      hand,
      career?.revision,
      pilot,
      mode,
      selection.chassisId,
      selection.branchId,
      careerFeedback,
    ]);
    if (key === signature) return;
    signature = key;
    const body = $('#hubVendorBody'),
      scroll = body.scrollTop,
      focused = document.activeElement;
    const focusAttribute = body.contains(focused)
      ? [
          'data-career-unlock',
          'data-career-reset',
          'data-career-branch',
          'data-career-chassis',
          'data-hub-mode',
          'data-part-slot',
          'data-hub-hand',
          'data-buy',
          'data-fit',
        ].find((name) => focused.hasAttribute(name))
      : null;
    const focusValue = focusAttribute ? focused.getAttribute(focusAttribute) : null;
    let html = `<header style="--station:${s.color}"><span class="hub-eyebrow">${s.number} / ${s.role}</span><h2>${s.name}</h2><p>${s.keeper} <i>● ONLINE</i></p></header>`;
    if (['parts', 'story'].includes(station))
      html += `<nav class="hub-station-modes" aria-label="${station === 'parts' ? 'Foundry services' : 'Archive services'}"><button data-hub-mode="career" aria-pressed="${mode === 'career'}">${station === 'parts' ? 'Chassis research' : 'Pilot training'}</button><button data-hub-mode="${station === 'parts' ? 'licenses' : 'signals'}" aria-pressed="${mode !== 'career'}">${station === 'parts' ? 'Part licenses' : 'Recovered signals'}</button></nav>`;
    if (['parts', 'story'].includes(station) && mode === 'career') {
      html += careerStationMarkup({
        career,
        build,
        pilot: pilot || self.name,
        kind: careerKind,
        ...selection,
      });
    } else if (station === 'supply') {
      const offers = campaign ? refitOffer(campaign, self.name) : [];
      html += `<div class="hub-vendor-balance"><b>${profile.credits} <small>REFIT TOKENS</small></b><span>Earn 1–2 after extracting.<br>Personal to this run.</span></div><p class="hub-vendor-note">“Salvage gets you home. The right module gets you through the next wave.”</p>`;
      if (!offers.length)
        html += `<div class="hub-empty">${campaign?.runState === 'active' ? 'Your next shipment is in the field.' : 'Start a new run at Command.'}<small>Extract successfully to earn refit tokens. Your armory credits buy permanent gear at the other vendors.</small></div>`;
      html += Object.entries(FIELD_MODULES)
        .map(([id, m]) => {
          const count = profile.modules.filter((v) => v === id).length,
            offer = offers.includes(id);
          return `<article class="hub-stock ${offer ? 'available' : ''}"><span class="hub-stock-tag">${count ? `INSTALLED ${count}/3` : 'RUN MODULE'}${offer ? ' · OFFERED' : ''}</span><h3>${m.name}</h3><p>${m.detail}</p><button data-hub-refit="${id}" ${offer ? '' : 'disabled'}>${offer ? 'Install · 1 refit token' : count >= 3 ? 'Maximum installed' : profile.credits ? 'Not in this shipment' : 'Extract to earn tokens'}</button></article>`;
        })
        .join('');
    } else if (station === 'story') {
      html += `<p class="hub-vendor-note">“A place is only home if someone remembers the way back.”</p><div class="hub-vendor-balance"><b>${HUB_STORIES.filter((s) => s.level <= save.bestLevel).length} / ${HUB_STORIES.length}</b><span>SIGNALS RECOVERED<br>Saved across runs.</span></div>`;
      html += HUB_STORIES.map(
        (entry) =>
          `<article class="hub-story ${entry.level <= save.bestLevel ? '' : 'locked'}"><span>${entry.level <= save.bestLevel ? '● RECOVERED SIGNAL' : '◇ CLEAR ' + entry.level + ' MISSIONS'}</span><h3>${entry.title}</h3><p>${entry.level <= save.bestLevel ? entry.text : 'This transmission is still behind the front. Push farther through the campaign to recover it.'}</p></article>`,
      ).join('');
    } else {
      const catalog = HUB_CATALOG.filter((item) => item.vendor === station),
        owned = catalog.filter((item) => ownsLicense(save, item.id)).length;
      html += `<div class="hub-vendor-balance"><b>${save.credits.toLocaleString()} <small>CR</small></b><span>${owned} / ${catalog.length} LICENSES OWNED<br>Shared with your squad. Keep forever.</span></div>`;
      if (station === 'parts')
        html += `<div class="hub-tabs" aria-label="Part socket">${Object.entries(PART_LABELS)
          .map(
            ([id, name]) =>
              `<button data-part-slot="${id}" aria-pressed="${partSlot === id}">${name}</button>`,
          )
          .join('')}</div>`;
      else
        html += `<div class="hub-tabs" aria-label="Equipment mount">${['Left hand', 'Right hand', 'Special'].map((name, i) => `<button data-hub-hand="${i}" aria-pressed="${hand === i}">${name}</button>`).join('')}</div>`;
      html += catalog
        .filter((item) =>
          station === 'parts'
            ? item.slot === partSlot
            : hand === 2
              ? item.slot === 'equip2'
              : item.slot === 'hand',
        )
        .map((item) => {
          const owned = ownsLicense(save, item.id),
            locked = save.bestLevel < item.level,
            fitted =
              station === 'parts'
                ? build.parts[item.slot] === item.item
                : build.equipment[hand] === item.item;
          return `<article class="hub-stock ${owned ? 'owned' : locked ? 'locked' : 'available'}"><div class="hub-stock-heading"><span class="hub-item-icon">${itemIcon(station === 'parts' ? item.slot : 'equip' + hand, item.item, { weight: item.weight })}</span><div><span class="hub-stock-tag">${owned ? '● LICENSE OWNED' : locked ? '◇ CLEAR ' + item.level + ' MISSIONS' : '◇ AVAILABLE TO UNLOCK'}</span><h3>${esc(item.name)}</h3></div><b>${item.weight}t</b></div><p>${esc(item.detail)}</p>${owned ? `<button data-fit="${item.id}" ${fitted ? 'disabled' : ''}>${fitted ? 'Fitted' : `Fit to ${station === 'parts' ? PART_LABELS[item.slot] : hand === 2 ? 'special' : hand ? 'right hand' : 'left hand'}`}</button>` : `<button data-buy="${item.id}" ${locked || save.credits < item.price ? 'disabled' : ''}>${locked ? 'Unlock after ' + item.level + ' missions · ' + item.price + ' CR' : save.credits < item.price ? 'Need ' + (item.price - save.credits) + ' more CR' : 'Unlock · ' + item.price + ' CR'}</button>`}</article>`;
        })
        .join('');
      html += `<p class="hub-vendor-note">Fit licensed gear for campaign deployment. Chassis, paint and free practice are available in the Workshop.</p><button class="hub-workshop" data-hub-action="workshop">Open full workshop ↗</button>`;
    }
    body.innerHTML = html;
    const feedback = body.querySelector('.career-feedback');
    if (feedback && careerFeedback) feedback.textContent = careerFeedback;
    if (focusFeedback) feedback?.focus({ preventScroll: true });
    else if (focusAttribute) {
      const target = [...body.querySelectorAll('[' + focusAttribute + ']')].find(
        (node) => node.getAttribute(focusAttribute) === focusValue,
      );
      if (target && !target.disabled) target.focus({ preventScroll: true });
      else feedback?.focus({ preventScroll: true });
    }
    body.scrollTop = scroll;
  }
  return {
    get station() {
      return station;
    },
    close,
    stop,
    open,
    walkTo,
    update(value) {
      latest = value;
      if (station && !nearStation(value.state, value.localId, station)) close();
      renderVendor();
    },
    input() {
      if (!active() || station) return { x: 0, z: 0 };
      if (route.length) {
        const p = latest?.state.players.find((p) => p.id === latest.localId);
        if (p) {
          while (route.length && Math.hypot(route[0].x - p.x, route[0].z - p.z) < 1) route.shift();
          if (!route.length) {
            const id = destination;
            destination = null;
            if (id) open(id);
            return { x: 0, z: 0 };
          }
          const dx = route[0].x - p.x,
            dz = route[0].z - p.z,
            length = Math.hypot(dx, dz);
          return { x: dx / length, z: dz / length };
        }
      }
      return {
        x:
          touch.x +
          Number(pressed.has('KeyD') || pressed.has('ArrowRight')) -
          Number(pressed.has('KeyA') || pressed.has('ArrowLeft')),
        z:
          touch.z +
          Number(pressed.has('KeyS') || pressed.has('ArrowDown')) -
          Number(pressed.has('KeyW') || pressed.has('ArrowUp')),
      };
    },
    draw(time, reduced) {
      if (!latest || !visible()) return;
      if (!scene && !errorShown) {
        try {
          scene = createHubScene(canvas);
        } catch (error) {
          errorShown = true;
          $('#hubGraphicsError').hidden = false;
          $('#hubGraphicsError').textContent =
            'The hub needs WebGL 2. Enable hardware acceleration and reload. ' + error.message;
        }
      }
      if (!scene) return;
      try {
        scene.render(
          latest.state,
          latest.members,
          latest.localId,
          time,
          latest.save.bestLevel,
          reduced,
          station && station !== 'mission'
            ? {
                station,
                occlusion: {
                  right: canvas.clientWidth > 760 ? $('#hubVendor').offsetWidth : 0,
                  bottom: canvas.clientWidth <= 760 ? $('#hubVendor').offsetHeight : 0,
                },
              }
            : null,
        );
      } catch (error) {
        if (!errorShown) {
          errorShown = true;
          $('#hubGraphicsError').hidden = false;
          $('#hubGraphicsError').textContent = error.message;
        }
        return;
      }
      const { save, campaign, members, localId, room, isHost, connecting, build } = latest,
        self = members.find((p) => p.id === localId),
        nearest = nearestStation();
      $('#hubCredits').innerHTML = save.credits.toLocaleString() + ' <small>CR</small>';
      $('#hubRunStatus').textContent =
        campaign?.runState === 'active'
          ? `MISSION ${Math.min(9, campaign.level + 1)} / 09 · ${campaign.level ? 'BETWEEN SORTIES' : 'PREPARING FIRST DROP'}`
          : campaign?.runState === 'won'
            ? 'FRONT SECURED · YOUR NEXT RUN STARTS HERE'
            : 'REGROUP · START A FRESH RUN AT COMMAND';
      const teamKey = hubTeamKey(latest);
      if ($('#hubTeam').dataset.key !== teamKey) {
        $('#hubTeam').dataset.key = teamKey;
        $('#hubTeam').innerHTML =
          `<span class="hub-squad-label">${connecting ? 'CONNECTING…' : room ? 'ROOM ' + esc(room) : 'SOLO / ONLINE CO-OP'} · ${members.length}/4</span>` +
          members
            .map(
              (p) =>
                `<div><i style="background:${esc(p.build.color)}"></i><span>${esc(p.name)}${p.id === localId ? ' / YOU' : ''}</span><b>${p.ready ? 'READY' : 'IN HUB'}</b></div>`,
            )
            .join('') +
          (room
            ? `<button data-hub-action="ready" ${connecting || campaign?.runState !== 'active' || !validBuild(build) || missingLicenses(save, build).length ? 'disabled' : ''}>${self?.ready ? 'Unready' : 'Mark ready'}</button>`
            : '');
      }
      for (const name of ['host', 'join']) $(`[data-hub-action="${name}"]`).hidden = !!room;
      for (const name of ['invite', 'leave']) $(`[data-hub-action="${name}"]`).hidden = !room;
      $('#hubInteract').disabled = !nearest || !!station;
      $('#hubInteract span').textContent = nearest ? 'Visit ' + nearest.name : 'Approach a station';
      $('#hubWalkHint').textContent = destination
        ? 'Walking to ' +
          HUB_STATIONS.find((s) => s.id === destination)?.name +
          ' · WASD cancels navigation'
        : 'WASD / ARROWS to walk · Select a station to navigate · Scroll to zoom';
      for (const s of HUB_STATIONS) {
        let node = markerNodes.get(s.id);
        if (!node) {
          node = document.createElement('button');
          node.className = 'hub-world-marker';
          node.dataset.walk = s.id;
          node.style.setProperty('--station', s.color);
          $('#hubMarkers').append(node);
          markerNodes.set(s.id, node);
        }
        const q = scene.project(s.x, s.z, 1);
        node.style.transform = `translate(${q.x}px,${q.y}px) translate(-50%,-100%)`;
        node.hidden = !q.visible || !!station;
        node.classList.toggle('near', nearest?.id === s.id);
        node.setAttribute('aria-label', 'Walk to ' + s.name);
        node.innerHTML = `<span>${s.number}</span><b>${s.name}</b><small>${nearest?.id === s.id ? 'E / INTERACT' : 'WALK TO STATION'}</small>`;
      }
      for (const [id, node] of pilotNodes)
        if (!members.some((p) => p.id === id)) {
          node.remove();
          pilotNodes.delete(id);
        }
      for (const p of latest.state.players) {
        const member = members.find((m) => m.id === p.id);
        if (!member) continue;
        let node = pilotNodes.get(p.id);
        if (!node) {
          node = document.createElement('span');
          node.className = 'hub-pilot-label';
          $('#hubMarkers').append(node);
          pilotNodes.set(p.id, node);
        }
        const q = scene.project(p.x, p.z, 7);
        node.hidden = !q.visible || !!station;
        node.textContent =
          (p.id === localId ? '▼ YOU' : member.name) + (member.ready ? ' / READY' : '');
        node.style.transform = `translate(${q.x}px,${q.y}px) translate(-50%,-100%)`;
      }
    },
    stats() {
      return scene?.stats();
    },
  };
}
