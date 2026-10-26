// Mission identity, briefing and encounter balance. Geometry lives in ../layouts/halo-spire.js.
export default {
  id: 'halo-spire',
  name: 'Halo Spire',
  act: 3,
  kind: 'uplink',
  theme: 'spire',
  color: '#93d6ff',
  floor: '#3f4a5a',
  sky: '#697b9d',
  minutes: 3,
  cell: '6-3',
  kills: 44,
  minimum: 50,
  wave: 4.3,
  mix: ['needle', 'gunner', 'mortar', 'drone', 'tank'],
  brief:
    'Capture a chain of four uplinks around the spire. Elevated pads and aerial enemies demand vertical awareness.',
  lesson: 'Rotate as a team and save specials for exposed upload windows.',
  reward: 195,
  layout: 'rings',
  points: [
    [700, 700],
    [1900, 700],
    [1900, 1500],
    [700, 1500],
  ],
  height: 100,
};
