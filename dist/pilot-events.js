// Observe authoritative counters on this pilot, including replicated co-op snapshots.
// Keep copies: the simulation mutates the same player object between frames.
export function createPilotEvents() {
  let previous = null;
  return {
    reset() { previous = null; },
    update(world, id, maxHp) {
      const p = world.players.find(p => p.id === id);
      if (!p) return [];
      const now = {
        id, time: world.time, hp: p.hp, status: world.status,
        move: p.moveCount || 0, airborne: !!p.airborne, ability: p.abilityCd || 0, kills: p.field?.kills || 0,
        heavy: world.operation?.heavyAlert?.id,
        hands: (p.hands || []).map(h => ({
          item: h.item, shots: h.shotCount || 0, swings: h.meleeCount || 0, guard: !!h.guarding
        }))
      };
      const old = previous;
      previous = now;
      // Baseline counters on entry/restart: do not replay old snapshot attacks.
      if (!old || old.id !== id || now.time < old.time) {
        return now.status === 'playing' && now.hp > 0 ? ['deploy'] : [];
      }
      if (now.status !== old.status && ['won', 'lost'].includes(now.status)) return [now.status];
      if (now.status !== 'playing') return [];
      if (now.hp <= 0) return old.hp > 0 ? ['downed'] : [];
      const events = [];
      if (old.hp <= 0) events.push('revived');
      if (maxHp > 0 && now.hp / maxHp <= .25 && old.hp / maxHp > .25) events.push('critical');
      if (now.heavy != null && now.heavy !== old.heavy && world.time < world.operation.heavyAlert.landingAt) events.push('heavy');
      if (now.ability > old.ability + .5) events.push(p.activeAbility || p.build.ability);
      if (now.move > old.move) events.push('dash');
      if (now.airborne && !old.airborne) events.push('flight');
      now.hands.forEach((hand, i) => {
        const before = old.hands[i];
        if (!before || before.item !== hand.item) return;
        if (hand.shots > before.shots || hand.swings > before.swings || hand.guard && !before.guard) events.push(hand.item);
      });
      // A kill reaction belongs to this pilot, never to a teammate's kill.
      if (now.kills > old.kills) events.push('kill');
      return [...new Set(events)];
    }
  };
}
