// Mission identity, briefing and encounter balance. Geometry lives in ../layouts/glasswater.js.
export default {
  id: 'glasswater',
  name: 'Glasswater Spillway',
  act: 1,
  kind: 'salvage',
  theme: 'spillway',
  color: '#75d8dd',
  floor: '#3c565b',
  sky: '#7ca3aa',
  minutes: 2,
  cell: '3-3',
  kills: 16,
  minimum: 35,
  wave: 5.9,
  mix: ['drone', 'gunner', 'rammer', 'drone'],
  brief:
    'Crack three caches and carry their cells back to the pump station. Split pickups across the squad.',
  lesson: 'Fight while carrying salvage; regroup to deliver.',
  reward: 105,
  layout: 'islands',
  points: [
    [650, 650],
    [1950, 650],
    [1350, 1500],
  ],
  height: 90,
};
