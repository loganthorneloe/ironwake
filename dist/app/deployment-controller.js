import { select as $ } from './dom.js';
import { createDeploymentGate, MIN_LOADING_SECONDS, deploymentIntro } from '../cinematic.js';
import { snapshot } from '../core.js?v=41';
import { drawBattle3D, prepareBattle, resetBattle } from '../three-view.js?v=ui-stack-1';
import { view, resetView } from '../view-controls.js?v=41';
import {
  resetSound,
  updateBoostSound,
  playTransitionSound,
} from '../audio.js?v=pilot-career-cinematic-3';
import { impactMode } from '../impact-preferences.js';

// Ticket gates, loading and stale async completion stay independent from session settlement.
export function createDeploymentController({
  readSession,
  readPending,
  writePending,
  onBegin,
  onCombat,
  clearInputs,
  captureMouse,
  stopPreviewSound,
  sendToHost,
  broadcast,
  resetNetwork,
  returnToHangar,
  toast,
  sceneFlow,
}) {
  function cancelDeployment() {
    const deployment = readPending();
    if (deployment) clearTimeout(deployment.timeout);
    writePending(null);
    sceneFlow.cancel();
    $('#game').removeAttribute('data-arrival');
    $('#game').inert = false;
    $('#hangar').inert = false;
  }
  function abortDeployment(message = 'Deployment cancelled.') {
    const deployment = readPending();
    const { room, isHost } = readSession();
    if (!deployment) return;
    if (room && !isHost) {
      sendToHost({ type: 'deployment-failed', ticket: deployment.ticket });
      resetNetwork(message);
      return;
    }
    returnToHangar();
    toast(message);
  }
  function enterCombat(ticket) {
    const deployment = readPending();
    const { world } = readSession();
    if (!deployment || deployment.ticket !== ticket || !deployment.localReady || !world) return;
    clearTimeout(deployment.timeout);
    writePending(null);
    sceneFlow.launch();
    playTransitionSound('engage');
    $('#game').removeAttribute('data-arrival');
    $('#game').inert = false;
    $('#hangar').inert = false;
    onCombat(world);
    clearInputs();
    $('#battle').focus({ preventScroll: true });
    captureMouse();
  }
  function tryLaunchDeployment() {
    const deployment = readPending();
    const { room } = readSession();
    if (!deployment?.gate?.complete) return;
    const ticket = deployment.ticket;
    if (room) broadcast({ type: 'combat-live', ticket });
    enterCombat(ticket);
  }
  async function startView(ticket = crypto.randomUUID()) {
    const { world, localId, isHost, room } = readSession();
    cancelDeployment();
    onBegin();
    const token = sceneFlow.begin(world.mission, world.players.length);
    const pending = {
      ticket,
      token,
      startedAt: performance.now(),
      prepared: false,
      insertionAt: null,
      localReady: false,
      gate:
        isHost || !room
          ? createDeploymentGate(
              ticket,
              world.players.map((p) => p.id),
            )
          : null,
    };
    writePending(pending);
    pending.timeout = setTimeout(() => {
      if (readPending() === pending)
        abortDeployment('Deployment timed out. The squad returned safely; ready up to retry.');
    }, 30000);
    if (isHost) broadcast({ type: 'start', ticket, world: snapshot(world) });
    if (document.pointerLockElement) document.exitPointerLock();
    $('#modal').close();
    $('#combatMenu').open = false;
    clearInputs();
    resetView();
    view.yaw = world.mission.heading;
    resetBattle();
    resetSound();
    updateBoostSound(0);
    stopPreviewSound();
    $('#hangar').hidden = true;
    $('#hangar').inert = true;
    $('#game').hidden = false;
    $('#game').inert = true;
    $('#game').dataset.arrival = 'true';
    $('#gameOperation').textContent = world.mission.name;
    $('#exitGame').textContent = world.siege
      ? 'HANGAR'
      : world.mission.campaign || world.mission.raid
        ? 'CAMPAIGN'
        : 'WORKSHOP';
    $('#game').classList.toggle('sandbox', ['sandbox', 'trial'].includes(world.mission.mode));
    $('#levelMapPanel').hidden = true;
    $('.deployment-cancel').focus({ preventScroll: true });
    const current = () => readPending() === pending && sceneFlow.current(token);
    try {
      const ready = await prepareBattle($('#battle'), world, localId, {
        stage: (index, detail) => {
          if (current()) sceneFlow.stage(index, detail);
        },
        current,
      });
      if (!ready || !current()) return;
      pending.prepared = true;
    } catch (error) {
      if (current()) {
        console.error(error);
        abortDeployment(error.message || 'Battlefield preparation failed. Try deploying again.');
      }
    }
  }
  function updateInsertion(t) {
    const deployment = readPending();
    const { world, localId } = readSession();
    const pending = deployment;
    if (!pending || !pending.prepared) return;
    if (pending.insertionAt === null) {
      if (t - pending.startedAt < MIN_LOADING_SECONDS * 1000) return;
      pending.insertionAt = t;
      playTransitionSound('insert');
    }
    const intro = deploymentIntro((t - pending.insertionAt) / 1000, impactMode() === 'reduced');
    if (!pending.localReady && !intro.complete) sceneFlow.intro(intro.phase);
    drawBattle3D($('#battle'), world, localId, t / 1000, {
      insertion: intro.progress,
      deployment: true,
    });
    if (intro.complete && !pending.localReady) {
      clearInputs();
      pending.localReady = true;
      sceneFlow.wait();
      if (pending.gate) {
        pending.gate.acknowledge(localId, pending.ticket);
        tryLaunchDeployment();
      } else sendToHost({ type: 'deployment-ready', ticket: pending.ticket });
    }
  }

  return {
    cancelDeployment,
    abortDeployment,
    enterCombat,
    tryLaunchDeployment,
    startView,
    updateInsertion,
  };
}
