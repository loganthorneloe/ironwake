// Presentation only. Explicit player choice overrides the system motion preference.
const motionQuery = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
let chosen = null;
try {
  const saved = globalThis.localStorage?.getItem('iw-impact-mode');
  if (saved === 'full' || saved === 'reduced') chosen = saved;
} catch {}
export const impactMode = () => chosen || (motionQuery?.matches ? 'reduced' : 'full');
export const impactLevel = () => (impactMode() === 'full' ? 1 : 0.35);
export function toggleImpactMode() {
  chosen = impactMode() === 'full' ? 'reduced' : 'full';
  try {
    globalThis.localStorage?.setItem('iw-impact-mode', chosen);
  } catch {}
  return chosen;
}
