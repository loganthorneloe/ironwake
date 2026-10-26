// Stable public API. Mission authors edit definitions or layouts in ./missions/;
// consumers keep importing this facade while generation and tuning stay isolated.
export { MISSIONS, missionFor } from './missions/catalog.js';
export { campaignRound } from './missions/generator.js';
export { missionTuning } from './missions/tuning.js';
