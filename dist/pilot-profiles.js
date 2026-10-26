export const PILOT_PROFILES = [
  { id: 'rook', name: 'Rook', description: 'Bright female voice · American accent' },
  { id: 'flint', name: 'Flint', description: 'Low male voice · American accent' },
  { id: 'echo', name: 'Echo', description: 'Clear female voice · British accent' },
];
export function pilotProfile(id) {
  return PILOT_PROFILES.find((profile) => profile.id === id) || PILOT_PROFILES[0];
}
export function createPilotPreference(storage) {
  let selected = 'rook';
  try {
    selected = pilotProfile(storage?.getItem('iw-pilot-voice-id')).id;
  } catch {}
  return {
    get id() {
      return selected;
    },
    set(id) {
      if (!PILOT_PROFILES.some((profile) => profile.id === id)) return false;
      selected = id;
      try {
        storage?.setItem('iw-pilot-voice-id', id);
      } catch {}
      return true;
    },
  };
}
