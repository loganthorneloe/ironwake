import { WEAPONS, newWorld, testPlatform, setInput, step } from '../dist/core.js';
export function measure(id, distance = 80, dt = 1 / 60, stun = 0) {
  const w = newWorld(testPlatform(), [
      { id: 'p', build: { equipment: [id, 'guard', 'emp'], parts: { booster: 'heavy' } } },
    ]),
    p = w.players[0];
  p.x = p.y = 0;
  const e = {
    id: 'test',
    type: 'target',
    training: true,
    x: distance,
    y: 0,
    altitude: 0,
    hp: 1e8,
    max: 1e8,
    stun,
    r: 22,
  };
  w.enemies = [e];
  const frames = Math.round(24 / dt),
    warm = Math.round(4 / dt);
  let start = 0;
  for (let i = 0; i < frames; i++) {
    if (WEAPONS[id].moveRecharge) e.x = p.x + distance;
    setInput(w, 'p', {
      x: WEAPONS[id].moveRecharge ? 1 : 0,
      left: id !== 'rail' || (p.hands[0].shot <= 0 && !p.hands[0].railCharging),
      angle: 0,
      aimPoint: { x: e.x, y: 0, z: 32 },
    });
    step(w, dt);
    if (i === warm - 1) start = e.hp;
  }
  return (start - e.hp) / ((frames - warm) * dt);
}
if (process.argv[1]?.endsWith('weapon-balance.mjs'))
  console.table(
    Object.keys(WEAPONS)
      .filter((k) => k !== 'guard')
      .map((id) => ({
        weapon: id,
        closeDps: Math.round(measure(id)),
        at400m: Math.round(measure(id, 400)),
        at30Hz: Math.round(measure(id, 80, 1 / 30)),
        at20Hz: Math.round(measure(id, 80, 0.05)),
      })),
  );
