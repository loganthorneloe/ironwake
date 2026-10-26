// Callsigns are cosmetic, not accounts or authentication credentials.
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const validCallsign = (value) =>
  typeof value === 'string' && /^PILOT-[A-HJ-NP-Z2-9]{8}$/.test(value);
export function createCallsign() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return 'PILOT-' + Array.from(bytes, (b) => alphabet[b & 31]).join('');
}
