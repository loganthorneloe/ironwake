// Explicit imports keep browser loading deterministic without a build step.
import ashgate from './ashgate.js';
import glasswater from './glasswater.js';
import relayNine from './relay-nine.js';
import ironOrchard from './iron-orchard.js';
import galeFoundry from './gale-foundry.js';
import blackrail from './blackrail.js';
import haloSpire from './halo-spire.js';
import shatterBasin from './shatter-basin.js';
import crownEngine from './crown-engine.js';

const layouts = Object.freeze({
  ashgate: ashgate,
  glasswater: glasswater,
  'relay-nine': relayNine,
  'iron-orchard': ironOrchard,
  'gale-foundry': galeFoundry,
  blackrail: blackrail,
  'halo-spire': haloSpire,
  'shatter-basin': shatterBasin,
  'crown-engine': crownEngine,
});

export const layoutFor = (id) => layouts[id];
