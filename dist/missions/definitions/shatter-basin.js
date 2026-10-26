// Mission identity, briefing and encounter balance. Geometry lives in ../layouts/shatter-basin.js.
export default {
  id: 'shatter-basin',
  name: 'Shatter Basin',
  act: 3,
  kind: 'hunt',
  theme: 'crystal',
  color: '#b99bff',
  floor: '#4b4159',
  sky: '#7b6995',
  minutes: 3,
  cell: '6-4',
  kills: 48,
  minimum: 50,
  wave: 4,
  mix: ['rammer', 'tank', 'mender', 'needle', 'mortar'],
  brief:
    'Hunt three marked siege leaders across broken crystal fields. Avoid artillery while focusing one leader at a time.',
  lesson: 'Focus armored threats without letting the swarm surround you.',
  reward: 215,
  layout: 'shards',
  points: [
    [700, 700],
    [1900, 750],
    [1350, 1600],
  ],
  height: 0,
};
