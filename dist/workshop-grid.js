import { PARTS, PART_LABELS, WEAPONS, ABILITIES, cleanBuild, mechStats } from './core.js?v=41';
export const SOCKETS = [
  ...Object.entries(PART_LABELS).map(([id, label]) => ({ id, label, kind: id })),
  { id: 'equip0', label: 'Left hand', kind: 'hand' },
  { id: 'equip1', label: 'Right hand', kind: 'hand' },
  { id: 'equip2', label: 'Special', kind: 'special' },
];
export function socketOptions(slot) {
  const socket = SOCKETS.find((s) => s.id === slot);
  return socket?.kind === 'hand'
    ? WEAPONS
    : socket?.kind === 'special'
      ? ABILITIES
      : PARTS[slot] || {};
}
export function canFit(slot, payload) {
  const socket = SOCKETS.find((s) => s.id === slot);
  return (
    !!socket && socket.kind === payload?.kind && Object.hasOwn(socketOptions(slot), payload?.id)
  );
}
export function fitComponent(build, slot, payload) {
  if (!canFit(slot, payload)) return null;
  const b = cleanBuild(build);
  if (PARTS[slot]) b.parts[slot] = payload.id;
  else b.equipment[Number(slot.slice(5))] = payload.id;
  return cleanBuild(b);
}
export function gridState(build) {
  const b = cleanBuild(build),
    stats = mechStats(b);
  return {
    ...stats,
    sockets: SOCKETS.map((s) => {
      const selected = PARTS[s.id] ? b.parts[s.id] : b.equipment[Number(s.id.slice(5))],
        item = socketOptions(s.id)[selected];
      return { ...s, selected, item, weight: item.weight };
    }),
  };
}
