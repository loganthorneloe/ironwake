// Mission identity, briefing and encounter balance. Geometry lives in ../layouts/crown-engine.js.
export default {
  id: 'crown-engine',
  name: 'The Crown Engine',
  act: 3,
  kind: 'core',
  theme: 'reactor',
  color: '#ffcd74',
  floor: '#43434b',
  sky: '#73677e',
  minutes: 3.5,
  cell: '7-4',
  kills: 55,
  minimum: 60,
  wave: 3.7,
  mix: ['tank', 'mender', 'rammer', 'mortar', 'needle', 'gunner'],
  brief:
    'Sever the engine shields, destroy its coolant feeds and defeat the Crown Warden. Extract together to finish the run.',
  lesson: 'Combine the upgrades earned across the run against the final siege mech.',
  reward: 260,
  layout: 'crown',
  points: [
    [700, 750],
    [1900, 750],
    [1300, 1550],
  ],
  height: 120,
};
