import { pilotProfile } from './pilot-profiles.js';
const catalogUrl = new URL('./audio/pilot/callouts.json', import.meta.url);

// Cache each voice independently; old loads never replace the current selection.
export function createPilotVoice(
  ctx,
  bus,
  { fetcher = globalThis.fetch, url = catalogUrl, profile = 'rook' } = {},
) {
  const packs = new Map(),
    cooldowns = new Map(),
    variants = new Map();
  let selected = pilotProfile(profile).id,
    catalog = null,
    catalogLoading = null;
  let current = null,
    active = null,
    nextAt = 0;
  function stop() {
    if (!active) return;
    const voice = active;
    active = null;
    voice.source.stop();
  }
  function reset() {
    stop();
    cooldowns.clear();
    variants.clear();
    nextAt = 0;
  }
  async function loadCatalog() {
    if (!catalogLoading)
      catalogLoading = (async () => {
        const response = await fetcher(url);
        if (!response.ok) throw new Error('Pilot voice catalog unavailable');
        catalog = await response.json();
        return catalog;
      })().catch((error) => {
        catalogLoading = null;
        throw error;
      });
    return catalogLoading;
  }
  async function preload() {
    const id = selected;
    try {
      await loadCatalog();
      if (!packs.has(id))
        packs.set(
          id,
          (async () => {
            const buffers = new Map();
            await Promise.all(
              Object.values(catalog.events)
                .flatMap((event) => event.lines)
                .map(async (line) => {
                  try {
                    const clip = await fetcher(new URL(id + '/' + line.id + '.wav', url));
                    if (clip.ok)
                      buffers.set(line.id, await ctx.decodeAudioData(await clip.arrayBuffer()));
                  } catch {
                    /* Optional voice assets must never interrupt combat. */
                  }
                }),
            );
            return buffers;
          })(),
        );
      const pack = await packs.get(id);
      if (!pack.size) packs.delete(id);
      if (selected === id) current = pack.size ? pack : null;
    } catch {
      /* Procedural audio and gameplay remain available offline. */
    }
  }
  return {
    get ready() {
      return current !== null;
    },
    get profile() {
      return selected;
    },
    preload,
    setProfile(id) {
      const next = pilotProfile(id).id;
      if (next !== selected) {
        selected = next;
        current = null;
        reset();
      }
      return preload();
    },
    reset,
    stop,
    play(events, enabled = true) {
      if (!enabled || ctx.state !== 'running') {
        stop();
        return null;
      }
      if (!catalog || !current) return null;
      const time = ctx.currentTime;
      const candidates = [...new Set(events)]
        .filter((key) => {
          const event = catalog.events[key];
          return (
            event &&
            time >= (cooldowns.get(key) ?? -Infinity) &&
            event.lines.some((line) => current.has(line.id))
          );
        })
        .sort((a, b) => catalog.events[b].priority - catalog.events[a].priority);
      for (const key of candidates) {
        const event = catalog.events[key],
          urgent = event.priority >= 70;
        if (active && (!urgent || event.priority <= active.priority)) continue;
        if (!urgent && time < nextAt) continue;
        const available = event.lines.filter((line) => current.has(line.id));
        const index = (variants.get(key) || 0) % available.length,
          line = available[index];
        stop();
        const source = ctx.createBufferSource(),
          gain = ctx.createGain();
        source.buffer = current.get(line.id);
        gain.gain.value = 1.5;
        source.connect(gain);
        gain.connect(bus);
        const voice = { source, priority: event.priority };
        active = voice;
        source.onended = () => {
          source.disconnect();
          gain.disconnect();
          if (active === voice) active = null;
        };
        source.start();
        variants.set(key, index + 1);
        cooldowns.set(key, time + event.cooldown);
        nextAt = time + Math.max(3.2, source.buffer.duration + 0.6);
        return line.id;
      }
      return null;
    },
  };
}
