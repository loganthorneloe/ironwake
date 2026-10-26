// Equipment lookup derived from the weapon and special catalogues.
import { WEAPONS } from './weapons.js';
import { ABILITIES } from './abilities.js';

export const EQUIPMENT = { ...WEAPONS, ...ABILITIES };

export const RACK_SIZE = 3;
