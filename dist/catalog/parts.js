// Frame hardware tiers and installed visual designs.
import { installPartDesigns } from '../part-designs.js';

export const PART_LABELS = {
  torso: 'Torso',
  head: 'Head',
  arms: 'Arms',
  legs: 'Legs',
  booster: 'Boosters',
};

export const PARTS = {
  torso: {
    light: { name: 'Kestrel shell', weight: 14, hp: 50, desc: '50 armor · 14t' },
    standard: { name: 'Atlas core', weight: 24, hp: 80, desc: '80 armor · 24t' },
    heavy: { name: 'Bastion hull', weight: 38, hp: 125, desc: '125 armor · 38t' },
  },
  head: {
    light: { name: 'Needle visor', weight: 3, hp: 6, desc: '6 armor · 3t' },
    standard: { name: 'Vector helm', weight: 5, hp: 10, desc: '10 armor · 5t' },
    heavy: { name: 'Bastion crown', weight: 9, hp: 18, desc: '18 armor · 9t' },
  },
  arms: {
    light: { name: 'Needle manipulators', weight: 4, hp: 8, desc: '8 armor · 4t' },
    standard: { name: 'Vector arms', weight: 7, hp: 13, desc: '13 armor · 7t' },
    heavy: { name: 'Forge gauntlets', weight: 11, hp: 20, desc: '20 armor · 11t' },
  },
  legs: {
    light: { name: 'Springstep', weight: 7, hp: 15, drive: 0, desc: '15 armor · 7t' },
    standard: { name: 'Stride biped', weight: 12, hp: 22, drive: 10, desc: '22 armor · 12t' },
    heavy: { name: 'Siege struts', weight: 19, hp: 30, drive: 20, desc: '30 armor · 19t' },
  },
  booster: {
    light: {
      name: 'Wisp jets',
      weight: 4,
      capacity: 58,
      force: 330,
      draw: 10,
      energy: 90,
      recharge: 36,
      desc: 'Fastest lift · Powers up to 58t · 4t',
    },
    standard: {
      name: 'Ion drive',
      weight: 7,
      capacity: 88,
      force: 300,
      draw: 12,
      energy: 100,
      recharge: 32,
      desc: 'Balanced lift · Powers up to 88t · 7t',
    },
    heavy: {
      name: 'Nova thrusters',
      weight: 11,
      capacity: 110,
      force: 270,
      draw: 14,
      energy: 125,
      recharge: 28,
      desc: 'Slower lift · Powers up to 110t · 11t',
    },
  },
};
installPartDesigns(PARTS);
