// Campaign order is part of save compatibility. Existing missions can be edited
// independently; adding a mission requires an explicit entry here.
import ashgate from './definitions/ashgate.js';
import glasswater from './definitions/glasswater.js';
import relayNine from './definitions/relay-nine.js';
import ironOrchard from './definitions/iron-orchard.js';
import galeFoundry from './definitions/gale-foundry.js';
import blackrail from './definitions/blackrail.js';
import haloSpire from './definitions/halo-spire.js';
import shatterBasin from './definitions/shatter-basin.js';
import crownEngine from './definitions/crown-engine.js';

export const MISSIONS = Object.freeze([
  ashgate,
  glasswater,
  relayNine,
  ironOrchard,
  galeFoundry,
  blackrail,
  haloSpire,
  shatterBasin,
  crownEngine,
]);

export const missionFor = (id) => MISSIONS.find((mission) => mission.id === id) || MISSIONS[0];
