// Shared limits and report validation; never accept a repository or attachment URL from clients.
export const REPORT_REPO = 'loganthorneloe/ironwake';
export const MAX_SCREENSHOT = 1500000,
  MAX_AUDIO = 2000000,
  MAX_REQUEST = MAX_SCREENSHOT + MAX_AUDIO + 50000;
export const AUDIO_TYPES = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a' };
export const REPORT_FIELDS = {
  bug: [
    ['details', 'What went wrong?'],
    ['steps', 'Steps to reproduce'],
    ['expected', 'What should have happened?'],
    ['actual', 'What actually happened?'],
  ],
  suggestion: [
    ['details', 'What would you like to change?'],
    ['steps', 'Where or when would this help?'],
    ['expected', 'How should it work?'],
    ['actual', 'Why would this improve the game?'],
  ],
};
export function validateReport(value, hasAudio = false) {
  if (!value || !Object.hasOwn(REPORT_FIELDS, value.kind))
    throw new Error('Choose Bug or Suggestion.');
  const report = { kind: value.kind };
  for (const [key, max] of [
    ['title', 140],
    ['details', 4000],
    ['steps', 3000],
    ['expected', 2000],
    ['actual', 2000],
    ['frequency', 100],
    ['severity', 100],
  ]) {
    if (value[key] != null && typeof value[key] !== 'string')
      throw new Error('Invalid report field.');
    report[key] = (value[key] || '').trim();
    if (report[key].length > max) throw new Error(`${key} is too long.`);
  }
  if (report.title.length < 5) throw new Error('Add a short title (at least 5 characters).');
  if (!hasAudio)
    for (const [key, label] of REPORT_FIELDS[report.kind])
      if (report[key].length < 5)
        throw new Error(`${label}: add a few details, or cover this in a voice recording.`);
  // Context is a bounded, plain JSON snapshot, never an arbitrary world/save dump.
  const context = JSON.stringify(value.context || {});
  if (context.length > 12000) throw new Error('Game context is too large.');
  report.context = JSON.parse(context);
  return report;
}
