# Selectable pilot callouts

Three original English mecha pilots are generated with [OmniVoice](https://github.com/k2-fsa/OmniVoice): **Rook** (bright female, American), **Flint** (low male, American) and **Echo** (clear female, British). Each has a full 32-line pack, for 96 baked clips. The style comes from short, emphatic English attack names and determined squad reactions. No actor, anime character, or existing performance was cloned.

Use **Voice: Rook/Flint/Echo** in the menu or the pilot-name button beside combat sound controls to choose a base voice. The picker has accessible radio choices and a **Preview voice** button. Selection is saved separately as `iw-pilot-voice-id`, applies to every mech, and remains local to each player in co-op. A preview works while callouts are disabled, but respects the global sound mute. Closing the picker cancels the preview and any pending playback. Rook is the default for new or invalid saved selections.

`dist/audio/pilot/callouts.json` is the editable line catalog. Every hand weapon, all three specials, dash, flight, low armor, downing, revival, heavy arrivals, personal campaign kills, deployment, victory and defeat have lines. Rail, blade, dash and EMP have alternate takes. Attack names are flavor; equipment names and combat rules stay the same.

## Playback

`pilot-events.js` observes the local pilot's successful action counters and state transitions. It works with host state and guest snapshots; held input, teammate attacks and old snapshot counters do not trigger barks. Personal kill reactions use the campaign's existing `field.kills` counter.

`pilot-voice.js` fetches same-origin baked WAVs from `audio/pilot/<voice-id>/` after audio initialization. Only the selected pack loads, and previously decoded packs are cached for switching back. Switching stops the current line and clears its cooldowns; a late load of an older selection never replaces the current voice. The browser needs no TTS model, Python runtime, API key, or remote speech service. Audio failures leave procedural sound and gameplay usable.

Only one line plays at a time. Ordinary callouts have a 3.2-second minimum gap and 8–60-second event cooldowns. Specials and danger alerts interrupt lower-priority lines; victory/defeat take highest priority. Equal-priority specials never talk over one another. Dropped events are not queued. Alternate takes rotate when an event is actually spoken.

**VOICE ON/OFF** independently enables callouts and saves `iw-pilot-voice` in browser storage. **SOUND [M]** mutes speech with all other combat audio. Leaving a battle, disconnecting or restarting stops the current line and clears speech state.

## Audition

From the repository root:

```sh
node scripts/preview-server.mjs 4182
```

Open [the voice audition page](http://127.0.0.1:4182/tests/pilot-voice.html) to hear every take, or [the game](http://127.0.0.1:4182/ironwake/) to test callouts with combat sounds. The audition page lives under `tests/` and is excluded from deployment.

## Regenerate or extend

Requires Python 3.10+ and a separate environment. For the tested Windows/NVIDIA setup, from PowerShell:

```powershell
python -m venv .voicegen
.\.voicegen\Scripts\python.exe -m pip install torch==2.8.0 torchaudio==2.8.0 --index-url https://download.pytorch.org/whl/cu128
.\.voicegen\Scripts\python.exe -m pip install -r scripts/voice/requirements.txt
.\.voicegen\Scripts\python.exe scripts/generate-pilot-callouts.py
```

Original references are checked in at `scripts/voice/<voice-id>-reference.wav`, with transcripts and voice-design attributes in the catalog. Rook was designed using the official OmniVoice demo; Flint and Echo were designed locally. Each reference is reused as that pilot's voice-cloning prompt. Model weights, raw takes and Python dependencies remain in ignored `.voicegen/`. Packs use 32 diffusion steps, per-line deterministic seeds, profile-specific speed, light comms EQ, short edge fades and bounded peak/RMS gain. Outputs are mono 24 kHz PCM16 WAVs. Lines can include `{pilot}` to substitute the selected profile's name.

The generator keeps codec encoding/decoding on CPU and uses float32 eager attention. GPU codec inference produced unusable waveforms on the tested Windows/RTX 4070 SUPER setup. CPU decoding resolved this; the speech model can still use CUDA. `--device cpu` supports full CPU generation.

Add a line with a unique lowercase hyphenated `id` and `text` to the appropriate event's `lines` array, then run the generator. A line can override `speed` for clearer pronunciation. Model revision and Python package versions are pinned. The generator skips existing WAVs. To replace selected takes:

```powershell
.\.voicegen\Scripts\python.exe scripts/generate-pilot-callouts.py --voice flint --only rail-piercer radiant-slash --force
```

Keep text short; do not add unsupported emotion tags to the voice attributes. Listen to new takes before shipping, especially invented attack names. A new event also needs an observation in `pilot-events.js`. Run `node --test tests/*.test.js` after editing the pack; the audio checks verify complete coverage, WAV format, duration, audibility and peak limits, plus gameplay-event and playback behavior. Audio quality and performance style still need human audition.
