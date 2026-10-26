import { select as $ } from './dom.js';
import { destructionMarkers } from '../destruction-mission.js';
import { operationMarkers } from '../planet-mission.js?v=41';
import { objectiveStatus } from '../hud-status.js?v=ui-stack-1';
import { impactLevel } from '../impact-preferences.js';

export function createWorldLabels({ readState, projectWorld }) {
  const labelNodes = new Map();
  function updateLabels() {
    const { world, localId } = readState();
    const player = world.players.find((p) => p.id === localId);
    if (!player) return;
    const personal = objectiveStatus(world, player).personal;
    const goal = world.mission.zones[world.zoneIndex] || world.mission.exit;
    const entries = [
      ...(world.damageEvents || [])
        .filter((e) => e.kind !== 'incoming')
        .map((e) => ({
          ...e,
          id: 'damage-' + e.id,
          z: e.z + (1 - e.life) * 28,
          offset: ((e.id % 5) - 2) * 19,
          name: String(e.amount) + (e.kind === 'precision' ? '!' : ''),
          color:
            e.kind === 'melee'
              ? '#a4f4ff'
              : e.kind === 'phaser'
                ? '#9fffd0'
                : e.kind === 'plasma'
                  ? '#d7b6ff'
                  : '#ffe7a3',
          damage: true,
        })),
      ...(world.teamCombos || []).slice(-4).map((c) => ({
        ...c,
        id: 'combo-' + c.id,
        z: c.z + 65 + (world.time - c.at) * 35,
        name: c.label,
        combo: true,
        life: 0.7 - (world.time - c.at),
      })),
      ...(world.operation || world.siege
        ? (world.siege
            ? destructionMarkers(world)
            : operationMarkers(
                world,
                world.players.find((p) => p.id === localId),
              )
          )
            .sort((a, b) => {
              const p = world.players.find((q) => q.id === localId);
              return Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y);
            })
            .slice(0, 3)
            .map((v, i) => ({ ...v, id: 'operation-' + i, waypoint: true, color: '#aaffc5' }))
        : ['sandbox', 'trial'].includes(world.mission.mode)
          ? []
          : [
              {
                id: 'waypoint',
                x: goal.x,
                y: goal.y,
                z: 100,
                name: world.mission.zones[world.zoneIndex] ? goal.name : 'EXTRACTION',
                color: '#c8f6d6',
              },
            ]),
      ...world.players
        .filter((p) => p.id !== localId)
        .map((p) => ({
          ...p,
          z: 80 + (p.altitude || 0),
          name: p.name + (p.hp <= 0 ? ' / DOWN' : ''),
          color: p.build.color,
        })),
    ];
    const ids = new Set(entries.map((e) => e.id));
    for (const [id, node] of labelNodes)
      if (!ids.has(id)) {
        node.remove();
        labelNodes.delete(id);
      }
    const occupied = [];
    for (const e of entries) {
      let node = labelNodes.get(e.id);
      if (!node) {
        node = document.createElement('div');
        node.className = 'world-label';
        $('#worldLabels').append(node);
        labelNodes.set(e.id, node);
      }
      const q = projectWorld(e.x, e.y, e.z);
      node.hidden = !q.visible;
      const repeatingGoal =
        e.waypoint && e.name.trim().toLowerCase() === personal.trim().toLowerCase();
      node.textContent = repeatingGoal
        ? Math.round(Math.hypot(e.x - player.x, e.y - player.y)) + ' m'
        : e.name;
      node.classList.toggle('target-marker', repeatingGoal);
      node.classList.toggle('damage-number', !!e.damage);
      node.classList.toggle('combo-label', !!e.combo);
      node.classList.toggle('heavy-hit', !!e.damage && e.amount >= 120);
      node.classList.toggle('precision-hit', e.kind === 'precision');
      node.style.opacity = e.combo
        ? Math.min(1, e.life * 4)
        : e.damage
          ? Math.min(1, e.life * 3)
          : 1;
      node.style.color = e.combo
        ? e.kind === 'finish'
          ? '#fff0b8'
          : '#b6fbff'
        : e.damage
          ? e.kind === 'precision'
            ? '#fff1a6'
            : e.kind === 'burn'
              ? '#ffb16e'
              : e.kind === 'overload'
                ? '#dcb5ff'
                : '#caffd5'
          : '#95ffb0';
      q.x += e.offset || 0;
      if (e.damage && q.visible)
        occupied.push({ x: q.x, y: q.y, width: node.offsetWidth, height: node.offsetHeight });
      if (!e.damage && q.visible) {
        const width = node.offsetWidth,
          height = node.offsetHeight;
        let attempts = 0;
        while (
          occupied.some(
            (r) =>
              Math.abs(q.x - r.x) < (width + r.width) / 2 + 8 &&
              Math.abs(q.y - r.y) < Math.max(height, r.height) + 6,
          ) &&
          attempts++ < 8
        )
          q.y -= height + 8;
        occupied.push({ x: q.x, y: q.y, width, height });
      }
      node.style.transform = `translate(${q.x}px,${q.y}px) translate(-50%,-100%) scale(${e.damage ? 1 + Math.max(0, 1 - (1 - e.life) / 0.15) * 0.55 * impactLevel() : 1})`;
    }
  }

  return updateLabels;
}
