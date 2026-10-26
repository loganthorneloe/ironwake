// Chassis identity is independent of paint, replaceable parts, weapons and sortie upgrades.
// Keep this module free of core/render imports so future content can share the same contract.
export const CHASSIS_CLASSES = Object.freeze({
  scout: {
    name: 'Scout',
    scale: 0.76,
    armor: 0.78,
    speed: 1.25,
    lift: 1.25,
    output: 0.95,
    payload: 60,
    description: 'Small silhouette, rapid reconnaissance and precision harassment.',
  },
  light: {
    name: 'Light',
    scale: 0.9,
    armor: 0.94,
    speed: 1.12,
    lift: 1.12,
    output: 1.05,
    payload: 80,
    description: 'Fast skirmishers with room for a specialist weapon.',
  },
  medium: {
    name: 'Medium',
    scale: 1,
    armor: 1,
    speed: 1,
    lift: 1,
    output: 1.1,
    payload: 105,
    description: 'Flexible assault, precision and squad-support platforms.',
  },
  heavy: {
    name: 'Heavy',
    scale: 1.23,
    armor: 1.4,
    speed: 0.81,
    lift: 0.83,
    output: 1.45,
    payload: 150,
    description: 'Two heavy-rated hand mounts and substantial armor.',
  },
  giga: {
    name: 'Giga',
    scale: 1.68,
    armor: 2.55,
    speed: 0.58,
    lift: 0.6,
    output: 2.15,
    payload: 235,
    description: 'Towering platforms that exchange agility for armor and payload.',
  },
});
const tierParts = (tier) => ({ torso: tier, head: tier, arms: tier, legs: tier, booster: tier });
const rows = [
  [
    'lark',
    'Lark',
    'scout',
    'Recon runner',
    'recon',
    0,
    'light',
    ['claws', 'carbine', 'emp'],
    { speed: 1.08, armor: 0.9 },
    'Fastest ground chassis; light equipment and a small target.',
  ],
  [
    'needle',
    'Needle',
    'scout',
    'Scout sniper',
    'sniper',
    1,
    'light',
    ['blade', 'rail', 'emp'],
    { speed: 0.95, lift: 0.95, payload: 56 },
    'One reinforced mount carries a railgun on a fragile scout body.',
  ],
  [
    'wisp',
    'Wisp',
    'scout',
    'Aerial scout',
    'aerial',
    0,
    'light',
    ['claws', 'phaser', 'repair'],
    { lift: 1.45, speed: 0.98, payload: 55 },
    'High-output lift trades payload for aerial reconnaissance.',
  ],
  [
    'kestrel',
    'Kestrel',
    'light',
    'Mobile skirmisher',
    'skirmisher',
    1,
    'light',
    ['claws', 'scatter', 'emp'],
    { armor: 1.05 },
    'Close-range mobility with one heavy-rated weapon allowance.',
  ],
  [
    'ronin',
    'Ronin',
    'light',
    'Melee interceptor',
    'melee',
    0,
    'light',
    ['blade', 'lance', 'shield'],
    { armor: 1.1, speed: 1.03 },
    'Armor and acceleration for a dedicated light melee build.',
  ],
  [
    'harrier',
    'Harrier',
    'light',
    'Aerial interceptor',
    'aerial',
    1,
    'light',
    ['blade', 'plasma', 'emp'],
    { lift: 1.4, payload: 72 },
    'Strong lift and a single heavy energy mount.',
  ],
  [
    'vanguard',
    'Vanguard',
    'medium',
    'Balanced assault',
    'assault',
    1,
    'standard',
    ['blade', 'carbine', 'emp'],
    { output: 1 / 1.1 },
    'Balanced baseline, with freedom to swap parts and one heavy weapon.',
  ],
  [
    'longbow',
    'Longbow',
    'medium',
    'Precision fire support',
    'sniper',
    2,
    'standard',
    ['rail', 'dynamo', 'emp'],
    { speed: 0.94, armor: 0.9, output: 1.15, payload: 110 },
    'Two reinforced mounts support long-range and capacitor weapons.',
  ],
  [
    'warden',
    'Warden',
    'medium',
    'Squad support',
    'support',
    1,
    'standard',
    ['guard', 'phaser', 'repair'],
    { armor: 1.15, lift: 0.95 },
    'Extra hull reinforcement for shield and repair support.',
  ],
  [
    'bastion',
    'Bastion',
    'heavy',
    'Defensive anchor',
    'defense',
    2,
    'heavy',
    ['guard', 'carbine', 'repair'],
    { armor: 1.1 },
    'A heavily armored anchor with two heavy-rated hand mounts.',
  ],
  [
    'anvil',
    'Anvil',
    'heavy',
    'Siege artillery',
    'artillery',
    2,
    'heavy',
    ['launcher', 'dynamo', 'emp'],
    { speed: 0.92, output: 1.08 },
    'High-payload artillery platform for rockets and capacitor fire.',
  ],
  [
    'skyguard',
    'Skyguard',
    'heavy',
    'Aerial gunship',
    'aerial',
    2,
    'heavy',
    ['rotary', 'plasma', 'shield'],
    { lift: 1.6, armor: 0.9, payload: 142 },
    'Heavy aerial lift supported by two reinforced weapon mounts.',
  ],
  [
    'colossus',
    'Colossus',
    'giga',
    'Line breaker',
    'assault',
    2,
    'heavy',
    ['hammer', 'flamer', 'emp'],
    { armor: 1.08 },
    'A towering close-range platform with massive hull reserves.',
  ],
  [
    'leviathan',
    'Leviathan',
    'giga',
    'Siege platform',
    'artillery',
    2,
    'heavy',
    ['launcher', 'rotary', 'shield'],
    { speed: 0.92, output: 1.1, payload: 250 },
    'Maximum payload and twin heavy weapons at the cost of speed.',
  ],
  [
    'citadel',
    'Citadel',
    'giga',
    'Fortress support',
    'support',
    2,
    'heavy',
    ['guard', 'phaser', 'repair'],
    { armor: 1.18, lift: 0.9, speed: 0.95 },
    'The most durable chassis, built to hold ground for the squad.',
  ],
];
export const CHASSIS = Object.freeze(
  Object.fromEntries(
    rows.map(([id, name, size, role, specialty, heavy, tier, equipment, tuning, description]) => {
      const base = CHASSIS_CLASSES[size];
      return [
        id,
        Object.freeze({
          id,
          name,
          size,
          role,
          specialty,
          description,
          scale: base.scale,
          armor: base.armor * (tuning.armor || 1),
          speed: base.speed * (tuning.speed || 1),
          lift: base.lift * (tuning.lift || 1),
          output: base.output * (tuning.output || 1),
          payload: tuning.payload || base.payload,
          hardpoints: Object.freeze({ hands: 2, heavy, specials: 1 }),
          parts: Object.freeze(tierParts(tier)),
          equipment: Object.freeze(equipment),
        }),
      ];
    }),
  ),
);
const custom = Object.freeze({
  id: null,
  name: 'Custom frame',
  size: null,
  role: 'Modular legacy build',
  specialty: 'custom',
  scale: 1,
  armor: 1,
  speed: 1,
  lift: 1,
  output: 1,
  payload: Infinity,
  hardpoints: Object.freeze({ hands: 2, heavy: 2, specials: 1 }),
});
export const chassisIdFor = (build) =>
  Object.hasOwn(CHASSIS, build?.chassis) ? build.chassis : null;
export const chassisFor = (build) => CHASSIS[chassisIdFor(build)] || custom;
export const HEAVY_EQUIPMENT = Object.freeze([
  'dynamo',
  'rail',
  'launcher',
  'plasma',
  'rotary',
  'flamer',
  'hammer',
  'guard',
]);
export const heavyWeaponCount = (equipment) =>
  (equipment || []).slice(0, 2).filter((id) => HEAVY_EQUIPMENT.includes(id)).length;
export function chassisBlueprint(id) {
  const c = Object.hasOwn(CHASSIS, id) ? CHASSIS[id] : null;
  if (!c) return null;
  return { chassis: id, parts: { ...c.parts }, equipment: [...c.equipment] };
}
const boundsCache = new Map();
export function chassisBounds(build) {
  const scale = chassisFor(build).scale;
  if (!boundsCache.has(scale))
    boundsCache.set(
      scale,
      Object.freeze({
        scale,
        radius: 21 * scale,
        height: 62 * scale,
        clearance: 58 * scale,
        aimHeight: 32 * scale,
        muzzleHeight: 38 * scale,
      }),
    );
  return boundsCache.get(scale);
}
export function applyChassisStats(base, build, equipment) {
  const c = chassisFor(build),
    capacity = Math.min(c.payload, Math.round(base.capacity * c.output)),
    heavyUsed = heavyWeaponCount(equipment),
    issues = [];
  if (base.weight > capacity)
    issues.push(
      `${base.weight - capacity}t over payload capacity. Fit lighter parts or stronger boosters.`,
    );
  if (heavyUsed > c.hardpoints.heavy)
    issues.push(`${heavyUsed} heavy weapons fitted; ${c.name} supports ${c.hardpoints.heavy}.`);
  const speed = Math.round(base.speed * c.speed);
  return {
    ...base,
    hp: Math.round(base.hp * c.armor),
    speed,
    walkSpeed: Math.round(speed * 0.24),
    lift: Math.round(base.lift * c.lift),
    capacity,
    output: capacity,
    chassisId: c.id,
    chassisName: c.name,
    chassisClass: c.size,
    scale: c.scale,
    heavySlots: c.hardpoints.heavy,
    heavyUsed,
    weightClass: c.size ? c.size.toUpperCase() : base.weightClass,
    valid: issues.length === 0,
    issues,
  };
}
