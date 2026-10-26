// Mission identity, briefing and encounter balance. Geometry lives in ../layouts/blackrail.js.
export default {
  id: 'blackrail',
  name: 'Blackrail Junction',
  act: 2,
  kind: 'escort',
  theme: 'rail',
  color: '#9dd69a',
  floor: '#3b4745',
  sky: '#718c87',
  minutes: 3,
  cell: '5-3',
  kills: 36,
  minimum: 45,
  wave: 4.6,
  mix: ['gunner', 'mender', 'tank', 'rammer'],
  brief:
    'Recover fuel and escort the crawler around the rail junction. One pilot nearby keeps it moving.',
  lesson: 'Divide fuel recovery, escort and crowd control duties.',
  reward: 175,
  layout: 'switchback',
  points: [
    [650, 650],
    [1950, 650],
    [1800, 1550],
  ],
  height: 0,
};
