import { partChassis } from './part-designs.js';
// Layered procedural Foley. Short transients, body and mechanical tails are separate voices.
const noiseBuffers = new WeakMap();
function noiseBuffer(ctx) {
  if (!noiseBuffers.has(ctx)) {
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate),
      d = b.getChannelData(0);
    let seed = 9347;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      d[i] = seed / 2147483648 - 1;
    }
    noiseBuffers.set(ctx, b);
  }
  return noiseBuffers.get(ctx);
}
export function createSoundBus(ctx) {
  const bus = ctx.createGain(),
    compress = ctx.createDynamicsCompressor();
  bus.gain.value = 0.21;
  compress.threshold.value = -18;
  compress.knee.value = 12;
  compress.ratio.value = 5;
  compress.attack.value = 0.003;
  compress.release.value = 0.15;
  bus.connect(compress);
  compress.connect(ctx.destination);
  return bus;
}
// Two short layers per cue. Stereo/distance come from the listener's real view.
export const ENEMY_TELLS = {
  hunter: [180, 420, 0.13, 'sawtooth', 1400],
  wisp: [760, 1120, 0.09, 'sine', 3800],
  scarab: [210, 140, 0.17, 'triangle', 1000],
  rammer: [95, 320, 0.23, 'sawtooth', 750],
  needle: [1350, 2200, 0.16, 'sine', 5000],
  mortar: [340, 160, 0.2, 'square', 1600],
  mender: [520, 780, 0.18, 'sine', 3000],
  siege: [80, 190, 0.25, 'sawtooth', 650],
  rush: [390, 650, 0.14, 'triangle', 2200],
  teamBreak: [1850, 540, 0.16, 'triangle', 4200],
  teamFinish: [660, 1320, 0.24, 'sine', 5200],
  bite: [280, 110, 0.08, 'sawtooth', 1800],
  sweep: [420, 880, 0.18, 'triangle', 2500],
  stomp: [75, 45, 0.22, 'triangle', 550],
  siegeBarrage: [240, 720, 0.24, 'square', 1900],
};
export function playEnemyTell(ctx, bus, event) {
  const p = ENEMY_TELLS[event.cue];
  if (!p || ctx.state !== 'running') return;
  const [frequency, end, duration, type, cutoff] = p,
    gain = Math.max(0, Math.min(1, event.gain ?? 1)),
    pan = Math.max(-1, Math.min(1, event.pan || 0));
  voice(ctx, bus, {
    frequency,
    end,
    duration,
    type,
    cutoff,
    to: Math.min(end * 2, 6000),
    gain: 0.2 * gain,
    pan,
    attack: 0.007,
  });
  if (event.cue === 'mender' || event.cue === 'rush' || event.cue === 'teamFinish')
    voice(ctx, bus, {
      frequency: frequency * 1.5,
      end: end * 1.5,
      duration: duration * 0.75,
      type: 'sine',
      cutoff: 6000,
      to: 2000,
      gain: 0.12 * gain,
      pan,
      delay: 0.055,
    });
  else
    voice(ctx, bus, {
      noise: true,
      duration: 0.055,
      gain: 0.13 * gain,
      cutoff,
      to: 280,
      filter: 'bandpass',
      pan,
    });
}
function voice(
  ctx,
  bus,
  {
    frequency = 100,
    end = 45,
    duration = 0.15,
    gain = 0.3,
    type = 'triangle',
    delay = 0,
    noise = false,
    filter = 'lowpass',
    cutoff = 2400,
    to = 180,
    pan = 0,
    attack = 0.003,
  },
) {
  const now = ctx.currentTime + delay,
    source = noise ? ctx.createBufferSource() : ctx.createOscillator(),
    amp = ctx.createGain(),
    eq = ctx.createBiquadFilter(),
    stereo = ctx.createStereoPanner();
  if (noise) {
    source.buffer = noiseBuffer(ctx);
  } else {
    source.type = type;
    source.frequency.setValueAtTime(frequency, now);
    source.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
  }
  eq.type = filter;
  eq.frequency.setValueAtTime(cutoff, now);
  eq.frequency.exponentialRampToValueAtTime(Math.max(30, to), now + duration);
  eq.Q.value = filter === 'bandpass' ? 1.6 : 0.65;
  stereo.pan.value = pan;
  amp.gain.setValueAtTime(0, now);
  amp.gain.linearRampToValueAtTime(gain, now + Math.min(attack, duration * 0.2));
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(eq);
  eq.connect(amp);
  amp.connect(stereo);
  stereo.connect(bus);
  if (noise) source.start(now, Math.random());
  else source.start(now);
  source.stop(now + duration + 0.015);
  source.onended = () => {
    source.disconnect();
    eq.disconnect();
    amp.disconnect();
    stereo.disconnect();
  };
}
export function playWeaponSound(ctx, bus, id, variation = 0) {
  const tune = 1 + Math.sin(variation * 2.399) * 0.035,
    pan = Math.sin(variation * 1.7) * 0.09;
  const tone = (frequency, end, duration, gain, type = 'triangle', delay = 0) =>
    voice(ctx, bus, {
      frequency: frequency * tune,
      end: end * tune,
      duration,
      gain,
      type,
      delay,
      pan,
      cutoff: 6000,
      to: 1200,
    });
  const hit = (duration, gain, cutoff, to = 150, delay = 0, filter = 'lowpass') =>
    voice(ctx, bus, { noise: true, duration, gain, cutoff, to, delay, filter, pan });
  switch (id) {
    case 'scatter':
      tone(720, 110, 0.19, 0.45, 'triangle');
      tone(1080, 180, 0.16, 0.22, 'sine');
      hit(0.19, 1.25, 7800, 650);
      tone(94, 30, 0.26, 1.15);
      hit(0.055, 0.38, 2200, 700, 0.21, 'bandpass');
      hit(0.045, 0.46, 3900, 1200, 0.32);
      tone(220, 110, 0.055, 0.18, 'square', 0.31);
      break;
    case 'dynamo':
      tone(160, 42, 0.3, 0.8, 'triangle');
      tone(1600, 420, 0.18, 0.3, 'sawtooth');
      hit(0.12, 0.4, 6500, 800);
      tone(660, 330, 0.2, 0.13, 'sine', 0.06);
      break;
    case 'rail':
      hit(0.035, 0.95, 11000, 3500);
      tone(58, 25, 0.36, 1.1);
      tone(2700, 850, 0.09, 0.22, 'sawtooth');
      hit(0.3, 0.34, 5200, 800, 0.035, 'bandpass');
      tone(930, 640, 0.22, 0.11, 'sine', 0.06);
      hit(0.05, 0.23, 1700, 450, 0.38);
      break;
    case 'launcher':
      hit(0.055, 0.55, 1900, 450);
      tone(68, 28, 0.38, 1.2);
      hit(0.48, 0.8, 900, 180, 0.04);
      hit(0.09, 0.24, 3000, 350, 0.18);
      break;
    case 'plasma':
      tone(125, 50, 0.4, 0.8, 'sine');
      tone(520, 120, 0.32, 0.35, 'sine');
      tone(730, 190, 0.26, 0.18, 'triangle', 0.025);
      hit(0.24, 0.26, 1400, 220, 0, 'bandpass');
      tone(180, 90, 0.36, 0.22, 'sine', 0.09);
      break;
    case 'rotary':
      tone(1600, 550, 0.04, 0.18, 'sine');
      hit(0.04, 0.52, 6800, 1300);
      tone(110, 55, 0.055, 0.35);
      hit(0.025, 0.2, 2400, 900, 0.028);
      break;
    default:
      hit(0.055, 0.68, 8200, 1800);
      tone(175, 65, 0.085, 0.55);
      hit(0.032, 0.3, 3100, 800, 0.055, 'bandpass');
      tone(410, 230, 0.045, 0.08, 'square', 0.045);
      break;
  }
}
export function playMeleeSound(ctx, bus, id, impact = false) {
  const heavy = id === 'hammer',
    pierce = id === 'lance';
  voice(ctx, bus, {
    noise: true,
    duration: impact ? (heavy ? 0.28 : 0.11) : heavy ? 0.32 : id === 'claws' ? 0.08 : 0.23,
    gain: impact ? 0.75 : 0.3,
    filter: impact ? 'lowpass' : 'bandpass',
    cutoff: impact ? (heavy ? 1200 : 4800) : 2800,
    to: impact ? 160 : 700,
    attack: impact ? 0.002 : 0.025,
  });
  voice(ctx, bus, {
    frequency: impact ? (heavy ? 85 : pierce ? 180 : 440) : heavy ? 150 : pierce ? 240 : 700,
    end: impact ? 35 : 120,
    duration: impact ? 0.22 : 0.18,
    gain: impact ? 0.7 : 0.17,
    type: impact ? 'triangle' : 'sine',
  });
  if (pierce)
    voice(ctx, bus, {
      noise: true,
      duration: 0.065,
      gain: 0.25,
      cutoff: 3500,
      to: 900,
      delay: impact ? 0.08 : 0.04,
    });
}
export function playMechanicalSound(ctx, bus, kind) {
  if (kind === 'start')
    voice(ctx, bus, {
      noise: true,
      duration: 0.18,
      gain: 0.32,
      filter: 'bandpass',
      cutoff: 1900,
      to: 600,
    });
  else if (kind === 'stop')
    voice(ctx, bus, { noise: true, duration: 0.25, gain: 0.28, cutoff: 2800, to: 220 });
  else if (kind === 'land') {
    voice(ctx, bus, { frequency: 65, end: 27, duration: 0.25, gain: 0.65 });
    voice(ctx, bus, { noise: true, duration: 0.12, gain: 0.4, cutoff: 1600, to: 200 });
  } else {
    voice(ctx, bus, { noise: true, duration: 0.045, gain: 0.17, cutoff: 2200, to: 600 });
  }
}
export function createThrusterSound(ctx, bus) {
  const gain = ctx.createGain(),
    eq = ctx.createBiquadFilter(),
    noise = ctx.createBufferSource(),
    rotor = ctx.createOscillator(),
    whine = ctx.createOscillator(),
    rg = ctx.createGain(),
    wg = ctx.createGain();
  gain.gain.value = 0;
  eq.type = 'lowpass';
  eq.frequency.value = 650;
  noise.buffer = noiseBuffer(ctx);
  noise.loop = true;
  rotor.type = 'triangle';
  rotor.frequency.value = 48;
  whine.type = 'sine';
  whine.frequency.value = 170;
  rg.gain.value = 0.35;
  wg.gain.value = 0.045;
  noise.connect(eq);
  eq.connect(gain);
  rotor.connect(rg);
  rg.connect(gain);
  whine.connect(wg);
  wg.connect(gain);
  gain.connect(bus);
  noise.start();
  rotor.start();
  whine.start();
  return {
    update(throttle, style = 'standard') {
      const chassis = partChassis('booster', style),
        factor = chassis === 'light' ? 1.3 : chassis === 'heavy' ? 0.72 : 1,
        now = ctx.currentTime;
      gain.gain.setTargetAtTime(throttle * 0.14, now, throttle ? 0.065 : 0.14);
      eq.frequency.setTargetAtTime((420 + throttle * 750) * factor, now, 0.12);
      rotor.frequency.setTargetAtTime((42 + throttle * 39) * factor, now, 0.1);
      whine.frequency.setTargetAtTime((170 + throttle * 190) * factor, now, 0.12);
    },
  };
}
export function createBeamSound(ctx, bus) {
  const gain = ctx.createGain(),
    a = ctx.createOscillator(),
    b = ctx.createOscillator(),
    second = ctx.createGain();
  gain.gain.value = 0;
  a.type = 'sine';
  b.type = 'triangle';
  a.frequency.value = 118;
  b.frequency.value = 238;
  second.gain.value = 0.2;
  a.connect(gain);
  b.connect(second);
  second.connect(gain);
  gain.connect(bus);
  a.start();
  b.start();
  return {
    update(active, hit) {
      const now = ctx.currentTime;
      gain.gain.setTargetAtTime(active ? (hit ? 0.16 : 0.11) : 0, now, 0.045);
      a.frequency.setTargetAtTime(hit ? 143 : 118, now, 0.08);
      b.frequency.setTargetAtTime(hit ? 287 : 238, now, 0.08);
    },
  };
}
// Short armor cracks sit above the body of a shot; the bus limits dense volleys.
export function playImpactAccent(ctx, bus, kind, power = 1) {
  const precision = kind === 'precision',
    heavy = power > 0.65;
  voice(ctx, bus, {
    noise: true,
    duration: heavy ? 0.075 : 0.035,
    gain: 0.17 + power * 0.14,
    filter: 'bandpass',
    cutoff: precision ? 6500 : 3800,
    to: 700,
    attack: 0.001,
  });
  voice(ctx, bus, {
    frequency: precision ? 1900 : heavy ? 170 : 800,
    end: precision ? 950 : heavy ? 55 : 330,
    duration: heavy ? 0.12 : 0.045,
    gain: 0.08 + power * 0.14,
    type: heavy ? 'triangle' : 'sine',
    delay: 0.007,
  });
  if (kind === 'melee' || kind === 'hammer' || kind === 'dash') {
    voice(ctx, bus, {
      frequency: 95,
      end: 28,
      duration: 0.25,
      gain: 0.5 + power * 0.35,
      type: 'triangle',
    });
    voice(ctx, bus, {
      noise: true,
      duration: 0.12,
      gain: 0.35,
      cutoff: 6500,
      to: 400,
      delay: 0.018,
    });
  }
}
// A distinct cockpit crunch, rather than another outgoing hit-confirm chirp.
export function playArmorImpact(ctx, bus, amount = 10, blocked = false) {
  const power = Math.min(1, amount / 35);
  voice(ctx, bus, {
    noise: true,
    duration: 0.065,
    gain: 0.65 + power * 0.3,
    filter: 'highpass',
    cutoff: 1700,
    to: 700,
    attack: 0.001,
  });
  voice(ctx, bus, {
    frequency: blocked ? 420 : 105,
    end: blocked ? 170 : 29,
    duration: 0.24,
    gain: 0.6 + power * 0.45,
    type: 'triangle',
  });
  voice(ctx, bus, {
    noise: true,
    duration: 0.27,
    gain: 0.3 + power * 0.2,
    filter: 'bandpass',
    cutoff: blocked ? 3400 : 1900,
    to: 250,
    delay: 0.035,
  });
  voice(ctx, bus, {
    frequency: blocked ? 1600 : 760,
    end: blocked ? 600 : 180,
    duration: 0.14,
    gain: 0.11,
    type: 'sine',
    delay: 0.018,
  });
}
