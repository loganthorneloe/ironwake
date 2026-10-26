import { CHASSIS, CHASSIS_CLASSES, chassisFor, chassisBlueprint } from './chassis.js';
import { CHASSIS_ART } from './chassis-art.js';
import { cleanBuild, mechStats } from './core.js?v=41';
export function chassisIcon(c) {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="${CHASSIS_ART[c.id]?.icon || ''}"/></svg>`;
}
export function chassisPickerMarkup(build, size = 'all') {
  const current = chassisFor(build),
    roles = {
      scout: 'Recon & speed',
      light: 'Agile specialists',
      medium: 'Balanced assault',
      heavy: 'Armor & firepower',
      giga: 'Maximum presence',
    };
  const cards = Object.values(CHASSIS)
    .filter((c) => size === 'all' || c.size === size)
    .map((c, i) => {
      const stats = mechStats(cleanBuild(chassisBlueprint(c.id))),
        fitted = current.id === c.id;
      return `<article class="chassis-card ${fitted ? 'selected' : ''}"><div class="platform-index">${fitted ? '<b>Fitted</b>' : ''}</div><div class="chassis-silhouette">${chassisIcon(c)}</div><div class="chassis-card-title"><div><small>${c.size} / ${c.role}</small><h3>${c.name}</h3></div></div><p class="platform-description">${c.description}</p><dl><div><dt>Armor</dt><dd>${stats.hp}</dd></div><div><dt>Boost</dt><dd>${Math.round(stats.speed * stats.boost)}</dd></div><div><dt>Lift / sec</dt><dd>${stats.lift}</dd></div><div><dt>Payload</dt><dd>${stats.capacity}<small>t</small></dd></div></dl><p class="chassis-mounts">${c.hardpoints.heavy} heavy-rated hand mount${c.hardpoints.heavy === 1 ? '' : 's'} · ${c.scale.toFixed(2)}× size</p><div class="chassis-card-actions"><button class="button primary" data-chassis-fit="${c.id}">Fit this frame <span>↗</span></button><button class="text-button" data-chassis-factory="${c.id}">Use factory loadout ＋</button></div></article>`;
    })
    .join('');
  return `<div class="chassis-picker"><div class="registry-heading"><div><h2>Chassis registry</h2></div></div><nav aria-label="Chassis class" class="chassis-filters">${Object.entries(
    CHASSIS_CLASSES,
  )
    .map(
      ([id, c]) =>
        `<button data-chassis-class="${id}" aria-pressed="${id === size}"><strong>${c.name}</strong><small>${roles[id]}</small></button>`,
    )
    .join(
      '',
    )}<button data-chassis-class="all" aria-pressed="${size === 'all'}"><strong>All 15</strong><small>Full registry</small></button></nav><div class="registry-guidance"><span><i></i> Fit frame keeps your components & paint.</span><span>Factory loadout replaces the equipment too.</span></div><div class="chassis-cards">${cards}</div></div>`;
}
