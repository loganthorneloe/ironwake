// Independent runtime state for one equipped hand.

export function handState(item) {
  return {
    item,
    motionCharge: item === 'dynamo' ? 1 : 0,
    spin: 0,
    shot: 0,
    shotCount: 0,
    railCharge: 0,
    railCharging: false,
    triggerHeld: false,
    meleeTime: 0,
    meleeCount: 0,
    meleeImpactCount: 0,
    meleePending: false,
    guarding: false,
    beam: null,
    flame: null,
  };
}
