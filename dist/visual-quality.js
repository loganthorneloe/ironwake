// Presentation budgets only. Missing hardware hints retain the current desktop ceiling.
export function visualBudget({ coarse = false, cores = 8, memory = 8 } = {}) {
  const compact = coarse || (cores > 0 && cores <= 4) || (memory > 0 && memory <= 4);
  return Object.freeze({
    tier: compact ? 'compact' : 'standard',
    pixelRatio: compact ? 1 : 1.35,
    shadowSize: compact ? 512 : 1024,
    motes: compact ? 32 : 96,
    scorch: compact ? 8 : 24,
  });
}

export function deviceVisualBudget() {
  return visualBudget({
    coarse: globalThis.matchMedia?.('(pointer: coarse)')?.matches,
    cores: globalThis.navigator?.hardwareConcurrency,
    memory: globalThis.navigator?.deviceMemory,
  });
}

// Snap in the light's view plane, rather than world X/Z, to avoid shadow-map swimming.
// This basis matches the existing directional light offset (-50,85,-45).
const length = Math.hypot(50, 85, 45),
  horizontal = Math.hypot(50, 45),
  right = [-45 / horizontal, 0, 50 / horizontal],
  up = [(50 * 85) / (length * horizontal), horizontal / length, (45 * 85) / (length * horizontal)];
export function shadowAnchor(x, z, size = 1024) {
  const r = x * right[0] + z * right[2],
    u = x * up[0] + z * up[2],
    stepR = 230 / size,
    stepU = 170 / size,
    dr = Math.round(r / stepR) * stepR - r,
    du = Math.round(u / stepU) * stepU - u;
  return { x: x + dr * right[0] + du * up[0], y: du * up[1], z: z + dr * right[2] + du * up[2] };
}

const warm = Object.freeze({ key: '#ffe0b7', sky: '#b9d3df', ground: '#29373c', dust: '#c5b49a' }),
  cool = Object.freeze({ key: '#e1edee', sky: '#b8d8ed', ground: '#253c46', dust: '#accad2' }),
  furnace = Object.freeze({ key: '#ffd0a0', sky: '#b6c9de', ground: '#3d3035', dust: '#dfad72' });
export function environmentPalette(theme) {
  if (['spillway', 'antenna', 'spire', 'crystal'].includes(theme)) return cool;
  if (['foundry', 'reactor'].includes(theme)) return furnace;
  return warm;
}
