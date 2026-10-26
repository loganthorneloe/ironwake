// Mission identity, briefing and encounter balance. Geometry lives in ../layouts/iron-orchard.js.
export default {
  id: 'iron-orchard',
  name: 'Iron Orchard',
  act: 2,
  kind: 'siege',
  theme: 'bunker',
  color: '#e4bd72',
  floor: '#484d45',
  sky: '#8f8b71',
  minutes: 2.5,
  cell: '4-2',
  kills: 28,
  minimum: 45,
  wave: 5.2,
  mix: ['tank', 'mender', 'gunner', 'drone'],
  brief:
    'Break the shield relays, then dismantle both siege batteries. Low bunkers interrupt firing lanes.',
  lesson: 'Use heavy weapons on structures; watch crossfire and bombardment.',
  reward: 140,
  layout: 'fortress',
  points: [
    [700, 750],
    [1900, 750],
    [1300, 1600],
  ],
  height: 0,
};
