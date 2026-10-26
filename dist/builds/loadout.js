// Build normalization, legacy save migration and build identity. No world or renderer dependency.
import { chassisFor, chassisIdFor } from '../chassis.js';
import { WEAPONS, RANGED, MELEE } from '../catalog/weapons.js';
import { ABILITIES } from '../catalog/abilities.js';
import { PARTS } from '../catalog/parts.js';
import { COLORS, TRAIL_COLORS } from '../catalog/palette.js';

export function equipmentFor(b = {}) {
  const a = Array.isArray(b.equipment)
      ? b.equipment
      : !b.weapon && !b.melee && !b.ability
        ? chassisFor(b).equipment || []
        : [],
    ok = (id) => Object.hasOwn(WEAPONS, id),
    ability =
      a.find((id) => Object.hasOwn(ABILITIES, id)) ||
      (Object.hasOwn(ABILITIES, b.ability) ? b.ability : 'emp');
  if (a.length === 3 && ok(a[0]) && ok(a[1])) return [a[0], a[1], ability];
  if (a.length === 2 && ok(a[0]) && ok(a[1])) return [a[0], a[1], ability];
  const gun =
      a.find((id) => Object.hasOwn(RANGED, id)) ||
      (Object.hasOwn(RANGED, b.weapon) ? b.weapon : 'carbine'),
    melee =
      a.find((id) => Object.hasOwn(MELEE, id)) ||
      (Object.hasOwn(MELEE, b.melee)
        ? b.melee
        : Object.hasOwn(MELEE, b.weapon)
          ? b.weapon
          : 'blade');
  return [melee, gun, ability];
}

export function activeItem(p) {
  return equipmentFor(p.build).find((id) => Object.hasOwn(RANGED, id)) || equipmentFor(p.build)[0];
}

export function specialFor(p) {
  return equipmentFor(p.build)[2];
}

export function partsFor(b = {}) {
  const preset = b.frame === 'scout' ? 'light' : b.frame === 'bulwark' ? 'heavy' : 'standard';
  return Object.fromEntries(
    Object.keys(PARTS).map((slot) => [
      slot,
      Object.hasOwn(PARTS[slot], b.parts?.[slot])
        ? b.parts[slot]
        : chassisFor(b).parts?.[slot] || preset,
    ]),
  );
}

export function mechName(b = {}) {
  const [left, right, special] = equipmentFor(b),
    names = {
      dynamo: 'Dynamo',
      carbine: 'Pulse',
      scatter: 'Prism',
      rail: 'Volt',
      launcher: 'Inferno',
      plasma: 'Nova',
      rotary: 'Tempest',
      phaser: 'Revenant',
      flamer: 'Cinder',
      blade: 'Ronin',
      lance: 'Lancer',
      hammer: 'Titan',
      claws: 'Raptor',
      scythe: 'Reaper',
      guard: 'Bastion',
    };
  return `${names[left]} ${names[right]} / ${{ emp: 'E', shield: 'A', repair: 'R' }[special]}`.toUpperCase();
}

export function buildKey(b) {
  const c = cleanBuild(b);
  return JSON.stringify([c.chassis, c.parts, c.equipment, c.partColors, c.trailColor]);
}

export const DEFAULT_BUILD = {
  name: 'VANGUARD-01',
  frame: 'striker',
  weapon: 'carbine',
  melee: 'blade',
  ability: 'emp',
  color: COLORS[0][0],
};

export function cleanBuild(b = {}) {
  if (!b || typeof b !== 'object') b = {};
  const parts = partsFor(b),
    equipment = equipmentFor(b),
    color = COLORS.some((c) => c[0] === b.color) ? b.color : COLORS[0][0],
    partColors = Object.fromEntries(
      Object.keys(PARTS).map((slot) => [
        slot,
        COLORS.some((c) => c[0] === b.partColors?.[slot]) ? b.partColors[slot] : color,
      ]),
    );
  return {
    chassis: chassisIdFor(b),
    trailColor: TRAIL_COLORS.some((c) => c[0] === b.trailColor) ? b.trailColor : TRAIL_COLORS[0][0],
    name: chassisFor(b).id
      ? `${chassisFor(b).name.toUpperCase()} / ${mechName({ equipment })}`
      : mechName({ equipment }),
    parts,
    equipment,
    partColors,
    weapon: equipment.find((id) => Object.hasOwn(RANGED, id)) || 'carbine',
    melee: equipment.find((id) => Object.hasOwn(MELEE, id)) || 'blade',
    ability: equipment.find((id) => Object.hasOwn(ABILITIES, id)) || 'emp',
    color: partColors.torso,
  };
}
