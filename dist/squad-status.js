import { mechStats } from './core.js?v=41';
export function squadStatus(players, selfId) {
  return Array.from({ length: 4 }, (_, i) => {
    const p = players[i];
    if (!p) return { channel: i + 1, empty: true };
    const health = Math.max(0, Math.min(1, p.hp / mechStats(p.build).hp));
    return {
      channel: i + 1,
      name: p.name || 'PILOT',
      self: p.id === selfId,
      health,
      downed: p.hp <= 0,
      status:
        p.hp <= 0
          ? 'DOWNED'
          : p.active > 0
            ? 'SYSTEM ACTIVE'
            : p.airborne
              ? 'ASCENDING'
              : p.boosting
                ? 'BOOSTING'
                : 'ONLINE',
    };
  });
}
