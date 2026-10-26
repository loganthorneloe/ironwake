// Mission identity, briefing and encounter balance. Geometry lives in ../layouts/relay-nine.js.
export default {
  id: 'relay-nine',
  name: 'Relay Nine',
  act: 1,
  kind: 'uplink',
  theme: 'antenna',
  color: '#c8a8ef',
  floor: '#494552',
  sky: '#817c9e',
  minutes: 2,
  cell: '4-3',
  kills: 22,
  minimum: 35,
  wave: 5.5,
  mix: ['gunner', 'needle', 'drone', 'gunner'],
  brief:
    'Upload at three relays in sequence. Stay inside the ring while teammates clear the approaches.',
  lesson: 'Hold ground briefly, then rotate before the next swarm.',
  reward: 120,
  layout: 'triangle',
  points: [
    [650, 800],
    [1950, 800],
    [1350, 1550],
  ],
  height: 0,
};
