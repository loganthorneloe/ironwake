// Each design inherits an established weight/stat tier. Silhouette is independent of balance.
export const PART_DESIGNS = {
  torso: [
    ['raptor', 'light', 'Raptor flight cage', 'Open ribs · swept intake fins'],
    ['spectre', 'light', 'Spectre shroud', 'Sloped stealth panels · offset sensor'],
    ['reactor', 'standard', 'Helios reactor', 'Exposed circular reactor · cooling ribs'],
    ['corsair', 'standard', 'Corsair harness', 'Cross braces · utility pouches'],
    ['citadel', 'heavy', 'Citadel bunker', 'Layered breastplate · raised collar'],
    ['furnace', 'heavy', 'Furnace crucible', 'Twin chimney stacks · vented boiler'],
  ],
  head: [
    ['cyclops', 'light', 'Cyclops optic', 'Single oversized camera lens'],
    ['mantis', 'light', 'Mantis sensor', 'Split insect eyes · swept feelers'],
    ['ronin', 'standard', 'Ronin kabuto', 'Crescent crest · armored cheek guards'],
    ['surveyor', 'standard', 'Surveyor array', 'Side radar dish · telescopic optic'],
    ['paladin', 'heavy', 'Paladin greathelm', 'Cruciform faceplate · tall crown'],
    ['anvil', 'heavy', 'Anvil command dome', 'Low armored dome · twin periscopes'],
  ],
  arms: [
    ['talon', 'light', 'Talon outriggers', 'Swept shoulder blades · wrist fins'],
    ['wire', 'light', 'Wire actuators', 'Exposed pistons · compact shoulder caps'],
    ['outrider', 'standard', 'Outrider mantles', 'Asymmetric tower shield · cartridge clips'],
    ['conduit', 'standard', 'Conduit coils', 'Circular shoulder coils · bright bus bars'],
    ['rampart', 'heavy', 'Rampart pauldrons', 'Battlement shoulders · stacked forearm armor'],
    ['riveter', 'heavy', 'Riveter presses', 'Industrial roll cages · hydraulic rams'],
  ],
  legs: [
    ['raptor', 'light', 'Raptor digitigrade', 'Rear hocks · pointed split toes'],
    ['skate', 'light', 'Skate runners', 'Long skate blades · ankle stabilizers'],
    ['piston', 'standard', 'Piston marchers', 'Exposed shin pistons · knee drums'],
    ['outrigger', 'standard', 'Outrigger walkers', 'Side stabilizers · broad knee shields'],
    ['crab', 'heavy', 'Crab anchors', 'Splayed toe claws · armored hips'],
    ['tread', 'heavy', 'Tread sabatons', 'Track pods · armored wheel hubs'],
  ],
  booster: [
    ['kite', 'light', 'Kite saildrive', 'High swept wings · wingtip lights'],
    ['wasp', 'light', 'Wasp vector pack', 'Four angled engine pods'],
    ['halo', 'standard', 'Halo induction ring', 'Circular dorsal induction ring'],
    ['gull', 'standard', 'Gull nacelles', 'Wide horizontal engine nacelles'],
    ['saturn', 'heavy', 'Saturn launch rack', 'Tall booster rockets · retaining bands'],
    ['foundry', 'heavy', 'Foundry heat bank', 'Layered radiator banks · armored exhausts'],
  ],
};
export function installPartDesigns(parts) {
  for (const [slot, designs] of Object.entries(PART_DESIGNS)) {
    for (const base of ['light', 'standard', 'heavy']) parts[slot][base].chassis = base;
    for (const [id, chassis, name, appearance] of designs)
      parts[slot][id] = {
        ...parts[slot][chassis],
        name,
        appearance,
        chassis,
        desc: parts[slot][chassis].desc,
      };
  }
}
export function partChassis(slot, id, fallback = 'standard') {
  return ['light', 'standard', 'heavy'].includes(id)
    ? id
    : PART_DESIGNS[slot]?.find((d) => d[0] === id)?.[1] || fallback;
}
