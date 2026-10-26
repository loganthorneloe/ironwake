import { createCombatAudioTracker } from './combat-audio.js';
import { playEnemyTell } from './sound-design.js?v=impact-1';
const combatAudio = createCombatAudioTracker();
import { createPilotPreference } from './pilot-profiles.js';
import { createPilotEvents } from './pilot-events.js';
import { createPilotVoice } from './pilot-voice.js';
import { RANGED, combatStats } from './core.js?v=41';
import {
  createSoundBus,
  playWeaponSound,
  playMeleeSound,
  playMechanicalSound,
  createThrusterSound,
  createBeamSound,
  playImpactAccent,
  playArmorImpact,
} from './sound-design.js?v=impact-1';
let ctx = null,
  master = null,
  muted = false,
  shots = 0,
  meleeShots = 0,
  meleeImpacts = 0,
  kills = 0,
  hp = null,
  hits = 0,
  energy = 100,
  abilityCooldown = 0,
  lastMoveCount = 0,
  lastImpactId = 0,
  lastBlastId = 0,
  lastArmorHit = -10,
  lastHeavyAlert = 0,
  lastSirenBeat = -1;
let pilotVoice = null,
  pilotEnabled = true;
const pilotEvents = createPilotEvents();
let pilotStorage;
try {
  pilotStorage = localStorage;
} catch {}
const pilotPreference = createPilotPreference(pilotStorage);
let previewRequest = 0,
  pilotPreviewActive = false,
  pilotIntroPending = true;
export function selectedPilotVoice() {
  return pilotPreference.id;
}
export function stopPilotVoice() {
  previewRequest++;
  pilotPreviewActive = false;
  pilotVoice?.stop();
}
export function selectPilotVoice(id) {
  if (!pilotPreference.set(id)) return;
  stopPilotVoice();
  void pilotVoice?.setProfile(id);
}
export async function previewPilotVoice() {
  initAudio();
  if (!pilotVoice) return null;
  const request = ++previewRequest,
    id = pilotPreference.id;
  pilotPreviewActive = true;
  await pilotVoice.preload();
  if (request !== previewRequest || id !== pilotPreference.id) return null;
  pilotVoice.reset();
  const result = pilotVoice.play(['deploy'], !muted);
  if (!result) pilotPreviewActive = false;
  return result;
}
try {
  pilotEnabled = localStorage.getItem('iw-pilot-voice') !== 'off';
} catch {}
export function pilotVoiceEnabled() {
  return pilotEnabled;
}
export function togglePilotVoice() {
  pilotEnabled = !pilotEnabled;
  try {
    localStorage.setItem('iw-pilot-voice', pilotEnabled ? 'on' : 'off');
  } catch {}
  if (!pilotEnabled) stopPilotVoice();
  return pilotEnabled;
}
export function initAudio() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (!master) {
      master = createSoundBus(ctx);
      pilotVoice = createPilotVoice(ctx, master, { profile: pilotPreference.id });
    }
    void pilotVoice.preload();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch {}
}
function tone(freq, end, duration, type = 'sine', gain = 1) {
  if (!ctx || ctx.state !== 'running' || muted) return;
  const o = ctx.createOscillator(),
    g = ctx.createGain(),
    now = ctx.currentTime;
  o.type = type;
  o.frequency.setValueAtTime(freq, now);
  o.frequency.exponentialRampToValueAtTime(Math.max(10, end), now + duration);
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  o.connect(g);
  g.connect(master);
  o.start();
  o.stop(now + duration + 0.01);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}
export function toggleSound() {
  muted = !muted;
  if (muted) stopPilotVoice();
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.21, ctx.currentTime, 0.03);
  return muted;
}
export function resetSound() {
  combatAudio.reset();
  stopPilotVoice();
  pilotIntroPending = true;
  pilotEvents.reset();
  pilotVoice?.reset();
  lastArmorHit = -10;
  lastHeavyAlert = 0;
  lastSirenBeat = -1;
  lastBlastId = 0;
  lastImpactId = 0;
  rivalAudio.clear();
  lastMoveCount = 0;
  handAudio = [];
  updateChargeSound(0);
  updateFlameSound(false);
  updatePhaserSound(false);
  lastAir = false;
  lastSlot = null;
  shots = 0;
  meleeShots = 0;
  meleeImpacts = 0;
  kills = 0;
  hp = null;
  hits = 0;
  energy = 100;
  abilityCooldown = 0;
}
// Brief synthesized launch accents share the combat bus and respect the sound toggle.
export function playTransitionSound(phase) {
  if (phase === 'insert') {
    tone(110, 620, 0.24, 'triangle', 0.18);
    noise(0.2, 0.13, 1800);
  } else if (phase === 'engage') {
    tone(72, 30, 0.2, 'sine', 0.55);
    tone(660, 990, 0.1, 'triangle', 0.1);
    noise(0.12, 0.16, 2400);
  }
}
let impactNoise = null;
function noise(duration = 0.1, gain = 0.3, frequency = 1500) {
  if (!ctx || ctx.state !== 'running' || muted) return;
  if (!impactNoise) {
    impactNoise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = impactNoise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource(),
    filter = ctx.createBiquadFilter(),
    amp = ctx.createGain(),
    now = ctx.currentTime;
  source.buffer = impactNoise;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(frequency, now);
  filter.frequency.exponentialRampToValueAtTime(80, now + duration);
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.001, now + duration);
  source.connect(filter);
  filter.connect(amp);
  amp.connect(master);
  source.start();
  source.stop(now + duration);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    amp.disconnect();
  };
}
function gunSound(id) {
  if (id === 'phaser' || id === 'flamer' || id === 'guard') return;
  if (ctx?.state === 'running' && !muted) playWeaponSound(ctx, master, id, shots);
}
function meleeSound(id) {
  if (id === 'guard') return;
  if (ctx?.state === 'running' && !muted) playMeleeSound(ctx, master, id);
}
let lastAir = false,
  lastSlot = null,
  handAudio = [];
const rivalAudio = new Map();
export function updateSound(w, id) {
  const p = w.players.find((p) => p.id === id);
  if (!p) return;
  for (const cue of combatAudio.collect(w, p, !!ctx && ctx.state === 'running' && !muted))
    playEnemyTell(ctx, master, cue);
  const pilotBarks = pilotEvents.update(w, id, combatStats(p).hp);
  if (pilotVoice?.ready) {
    if (pilotIntroPending && w.status === 'playing' && p.hp > 0) {
      pilotBarks.push('deploy');
      pilotIntroPending = false;
    }
    if (!pilotPreviewActive) pilotVoice.play(pilotBarks, pilotEnabled && !muted);
  }
  const alert = w.operation?.heavyAlert;
  if (alert && w.time < alert.landingAt) {
    if (alert.id !== lastHeavyAlert) {
      lastHeavyAlert = alert.id;
      lastSirenBeat = -1;
    }
    const beat = Math.floor((w.time - alert.start) * 2);
    if (beat !== lastSirenBeat) {
      lastSirenBeat = beat;
      tone(beat % 2 ? 260 : 520, beat % 2 ? 220 : 420, 0.24, 'square', 0.15);
    }
  }
  let impactVoices = 0;
  for (const e of w.damageEvents || []) {
    if (e.id <= lastImpactId) continue;
    lastImpactId = e.id;
    if (
      e.owner === id &&
      e.life > 0.75 &&
      e.kind !== 'burn' &&
      e.kind !== 'phaser' &&
      impactVoices++ < 3 &&
      ctx?.state === 'running' &&
      !muted
    )
      playImpactAccent(ctx, master, e.kind, Math.min(1, (e.amount || 0) / 200));
  }
  let burstVoices = 0;
  for (const e of w.effects || [])
    if (e.kind === 'explosion' && e.id > lastBlastId) {
      lastBlastId = e.id;
      if (burstVoices++ >= 3) continue;
      const volume = Math.max(0, 1 - Math.hypot(e.x - p.x, e.y - p.y) / 1200);
      if (e.weapon === 'landing') {
        tone(65, 18, 0.85, 'sine', 1 * volume);
        noise(0.9, 0.8 * volume, 650);
      } else if (e.weapon === 'plasma') {
        tone(420, 80, 0.25, 'triangle', 0.32 * volume);
        noise(0.2, 0.24 * volume, 3600);
      } else {
        tone(95, 25, 0.35, 'sine', 0.6 * volume);
        noise(0.3, 0.6 * volume, 1200);
      }
    }
  if ((p.moveCount || 0) !== lastMoveCount) {
    lastMoveCount = p.moveCount;
    tone(90, 600, 0.3, 'sawtooth', 0.22);
    noise(0.3, 0.3, 950);
  }
  for (const e of w.enemies) {
    if (e.type !== 'rival') continue;
    const old = rivalAudio.get(e.id) || { shotCount: 0, meleeCount: 0 },
      volume = Math.max(0, 1 - Math.hypot(e.x - p.x, e.y - p.y) / 1100);
    if (e.shotCount !== old.shotCount) {
      tone(480, 1250, 0.09, 'sawtooth', 0.12 * volume);
      noise(0.06, 0.09 * volume, 2400);
    }
    if (e.meleeCount !== old.meleeCount) {
      tone(900, 180, 0.3, 'triangle', 0.2 * volume);
      noise(0.2, 0.15 * volume, 1800);
    }
    rivalAudio.set(e.id, { shotCount: e.shotCount, meleeCount: e.meleeCount });
  }
  updateFlameSound(p.hp > 0 && !!p.flame);
  updatePhaserSound(p.hp > 0 && !!p.beam, p.beam?.hit);
  updateChargeSound(p.hp > 0 ? p.railCharge || 0 : 0);
  updateBoostSound(p.hp > 0 ? (p.boosting ? 1 : p.airborne ? 0.8 : 0) : 0, p.build.parts?.booster);
  if (ctx?.state === 'running' && !muted) {
    if (lastAir && !p.airborne && (p.altitude || 0) < 5) playMechanicalSound(ctx, master, 'land');
    if (lastSlot !== null && p.activeSlot !== lastSlot) playMechanicalSound(ctx, master, 'switch');
  }
  lastAir = !!p.airborne;
  lastSlot = p.activeSlot;
  for (const [i, h] of (p.hands || [p]).entries()) {
    const old = handAudio[i] || { shotCount: 0, meleeCount: 0, meleeImpactCount: 0 };
    if (h.shotCount !== old.shotCount) {
      shots = h.shotCount;
      gunSound(h.item || p.weapon);
    }
    if (h.meleeCount !== old.meleeCount) meleeSound(h.item || p.melee);
    if (h.meleeImpactCount !== old.meleeImpactCount && ctx?.state === 'running' && !muted)
      playMeleeSound(ctx, master, h.item || p.melee, true);
    handAudio[i] = {
      shotCount: h.shotCount,
      meleeCount: h.meleeCount,
      meleeImpactCount: h.meleeImpactCount,
    };
  }
  if (p.abilityCd > abilityCooldown + 0.5) {
    if ((p.activeAbility || p.build.ability) === 'shield') {
      tone(140, 600, 0.6, 'sine', 0.6);
      tone(280, 1200, 0.6, 'triangle', 0.22);
    } else if ((p.activeAbility || p.build.ability) === 'repair') {
      tone(440, 660, 0.5, 'sine', 0.4);
      tone(660, 880, 0.6, 'sine', 0.25);
    } else {
      noise(0.5, 0.75, 1800);
      tone(65, 800, 0.35, 'sawtooth', 0.4);
    }
  }
  abilityCooldown = p.abilityCd;
  if (w.kills > kills) {
    kills = w.kills;
    noise(0.35, 0.6, 650);
    tone(85, 18, 0.4, 'sine', 0.7);
  }
  if (
    hp !== null &&
    (p.hp < hp || (p.lastHurt ?? -10) > lastArmorHit) &&
    ctx?.state === 'running' &&
    !muted
  )
    playArmorImpact(ctx, master, Math.max(1, hp - p.hp), w.time - (p.guardHitTime ?? -10) < 0.12);
  lastArmorHit = p.lastHurt ?? -10;
  if (p.hits > hits) {
    hits = p.hits;
    if (p.weapon !== 'phaser') {
      tone(1250, 850, 0.035, 'triangle', 0.15);
      noise(0.04, 0.1, 3200);
    }
  }
  if (energy - p.energy > 25) tone(120, 440, 0.13, 'sawtooth', 0.2);
  energy = p.energy;
  hp = p.hp;
}

let engine = null,
  lastThrottle = 0;
export function updateBoostSound(throttle = 0, style = 'standard') {
  if (!ctx || !master) return;
  engine ??= createThrusterSound(ctx, master);
  engine.update(muted ? 0 : throttle, style);
  if (!muted && ctx.state === 'running') {
    if (throttle > 0 && lastThrottle === 0) playMechanicalSound(ctx, master, 'start');
    if (!throttle && lastThrottle > 0) playMechanicalSound(ctx, master, 'stop');
  }
  lastThrottle = throttle;
}

let chargeOsc = null,
  chargeGain = null;
export function updateChargeSound(charge) {
  if (!ctx || !master) return;
  if (!chargeOsc) {
    chargeOsc = ctx.createOscillator();
    chargeOsc.type = 'triangle';
    chargeGain = ctx.createGain();
    chargeGain.gain.value = 0;
    chargeOsc.connect(chargeGain);
    chargeGain.connect(master);
    chargeOsc.start();
  }
  chargeOsc.frequency.setTargetAtTime(180 + charge * 1100, ctx.currentTime, 0.025);
  chargeGain.gain.setTargetAtTime(
    muted || !charge ? 0 : 0.08 + charge * 0.16,
    ctx.currentTime,
    0.025,
  );
}

let previewKey = '',
  previewStart = 0,
  previewShot = -1,
  previewStrike = -1;
export function updatePreviewSound(build, t, enabled) {
  updateFlameSound(enabled && build.equipment[build.selectedSlot] === 'flamer');
  updatePhaserSound(enabled && build.equipment[build.selectedSlot] === 'phaser', false);
  const key = JSON.stringify([build.weapon, build.melee, build.selectedSlot]);
  if (!enabled || key !== previewKey) {
    previewStart = t;
    previewShot = previewStrike = -1;
    previewKey = key;
    updateChargeSound(0);
    if (!enabled) return;
  }
  const cycle = (t - previewStart) % 4,
    item = build.equipment[build.selectedSlot];
  if (item === build.weapon) {
    const weapon = RANGED[item],
      charge = weapon?.charge || 0,
      rate = weapon?.rate || 0.1,
      firing = item === 'rail' ? cycle >= charge && cycle < charge + 0.1 : cycle < 1.2,
      index = Math.floor((t - previewStart) / 4) * 100 + Math.floor(cycle / rate);
    updateChargeSound(item === 'rail' && cycle < charge ? cycle / charge : 0);
    if (firing && index !== previewShot) {
      previewShot = index;
      gunSound(item);
    }
  } else if (item === build.melee && cycle >= 1.6) {
    const index = Math.floor((t - previewStart) / 4);
    if (index !== previewStrike) {
      previewStrike = index;
      meleeSound(item);
    }
  }
}

let phaserLoop = null;
function updatePhaserSound(active, hit = false) {
  if (!ctx || !master) return;
  phaserLoop ??= createBeamSound(ctx, master);
  phaserLoop.update(!muted && active, hit);
}

let flameLoop = null;
function updateFlameSound(active) {
  if (!ctx || !master) return;
  if (!flameLoop) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate),
      data = buffer.getChannelData(0);
    let low = 0;
    for (let i = 0; i < data.length; i++) {
      low = (low + (Math.random() * 2 - 1) * 0.12) / 1.12;
      data[i] = low * 3;
    }
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = 1600;
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
    flameLoop = { gain };
  }
  flameLoop.gain.gain.setTargetAtTime(active && !muted ? 0.7 : 0, ctx.currentTime, 0.045);
}
