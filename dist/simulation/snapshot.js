// Replicate authoritative state while removing host-only input, queues and AI caches.

export function snapshot(w, includeMission = true) {
  return {
    ...w,
    mission: includeMission ? w.mission : undefined,
    players: w.players.map(({ input, lastInput, ...p }) => p),
    pendingSpawns: w.spawn.length,
    pendingDrops: w.operation ? w.spawn.map((s) => ({ time: s.time, zone: s.zone })) : [],
    spawn: [],
    enemies: w.enemies.map(
      ({
        route,
        routeUntil,
        observations,
        observeAt,
        tacticAt,
        perception,
        actionHits,
        teamHits,
        comboReadyAt,
        comboFinished,
        ...e
      }) => e,
    ),
    bullets: w.bullets.map(({ hit, ...b }) => b),
  };
}
