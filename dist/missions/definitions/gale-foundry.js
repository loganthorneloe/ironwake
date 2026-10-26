// Mission identity, briefing and encounter balance. Geometry lives in ../layouts/gale-foundry.js.
export default {
  id: 'gale-foundry',
  name: 'Gale Foundry',
  act: 2,
  kind: 'sabotage',
  theme: 'foundry',
  color: '#ff9567',
  floor: '#4b3b39',
  sky: '#885e59',
  minutes: 2.5,
  cell: '5-2',
  kills: 32,
  minimum: 45,
  wave: 4.9,
  mix: ['rammer', 'mortar', 'drone', 'gunner'],
  brief:
    'Destroy three elevated heat exchangers. Telegraphs mark furnace discharges; boost between gantries.',
  lesson: 'Use flight for attack angles and escape the marked blast zones.',
  reward: 155,
  layout: 'gantries',
  points: [
    [650, 700],
    [1950, 700],
    [1300, 1550],
  ],
  height: 110,
};
