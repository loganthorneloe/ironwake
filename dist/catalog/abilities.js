// Authored special systems and their workshop weights.

export const ABILITIES = {
  emp: {
    role: 'SPECIAL · CROWD CONTROL',
    name: 'EMP shockwave',
    cost: 3,
    cd: 14,
    duration: 4,
    radius: 320,
    desc: '320m shockwave · 45 damage + 4s stun · 14s cooldown',
  },
  shield: {
    role: 'SPECIAL · DEFENSIVE',
    name: 'Aegis dome',
    cost: 2,
    cd: 18,
    duration: 8,
    radius: 220,
    desc: '220m moving dome · 60% damage reduction for 8s · 18s cooldown',
  },
  repair: {
    role: 'SPECIAL · SUPPORT',
    name: 'Repair field',
    cost: 3,
    cd: 20,
    duration: 8,
    radius: 240,
    desc: '240m field · Restore 12 armor/sec for 8s · 20s cooldown',
  },
};
for (const [id, weight] of Object.entries({ emp: 5, shield: 4, repair: 6 }))
  ABILITIES[id].weight = weight;
