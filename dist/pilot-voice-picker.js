import { PILOT_PROFILES, pilotProfile } from './pilot-profiles.js';

export function installPilotVoicePicker({ openModal, selected, select, preview, stop, enabled }) {
  const menu = document.querySelector('#pilotVoiceSettings'),
    combat = document.querySelector('#voiceSettings');
  function sync() {
    const profile = pilotProfile(selected());
    menu.textContent = 'Voice: ' + profile.name;
    combat.textContent = profile.name.toUpperCase() + ' ▾';
    for (const button of [menu, combat])
      button.setAttribute('aria-label', 'Choose pilot voice. Current voice: ' + profile.name);
  }
  function show() {
    stop();
    openModal(
      `<p class="overline">PILOT COMMS</p><h2>Choose your voice</h2><p>Your pilot voice is saved on this browser and used with every mech.</p><fieldset class="pilot-voice-options"><legend>Base pilot voice</legend>${PILOT_PROFILES.map((p) => `<label><input type="radio" name="pilotVoice" value="${p.id}" ${selected() === p.id ? 'checked' : ''}><span><strong>${p.name}</strong><small>${p.description}</small></span></label>`).join('')}</fieldset><p id="pilotVoicePreviewStatus" role="status" aria-live="polite">${enabled() ? 'Choose a voice, then preview its callout.' : 'Callouts are off. Enable VOICE in combat to hear them during play.'}</p><div class="dialog-actions"><button id="previewPilotVoice" class="button secondary">Preview voice</button><button id="closePilotVoices" class="button primary">Done</button></div>`,
    );
    const status = document.querySelector('#pilotVoicePreviewStatus');
    let request = 0;
    document.querySelectorAll('[name=pilotVoice]').forEach(
      (input) =>
        (input.onchange = () => {
          request++;
          select(input.value);
          sync();
          status.textContent = pilotProfile(input.value).name + ' selected.';
        }),
    );
    document.querySelector('#previewPilotVoice').onclick = async () => {
      const version = ++request;
      status.textContent = 'Loading voice preview…';
      const result = await preview();
      if (version === request && status.isConnected)
        status.textContent = result
          ? pilotProfile(selected()).name + ' preview.'
          : 'Preview unavailable. Check sound is on and try again.';
    };
    document.querySelector('#closePilotVoices').onclick = () =>
      document.querySelector('#modal').close();
  }
  menu.onclick = combat.onclick = show;
  document.querySelector('#modal').addEventListener('close', stop);
  sync();
}
