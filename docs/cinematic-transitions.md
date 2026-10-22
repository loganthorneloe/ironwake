# Cinematic transitions foundation

This pass adds fast scene cuts and a shared deployment lifecycle for solo and co-op. Home, campaign, workshop and return navigation use a 220 ms diagonal shutter. Deployment shows the actual terrain, system assembly and shader preparation stages, then reveals the battlefield with a mission title, letterbox and a 0.82 second elevated rear-quarter camera move into the chase view. The intro shows only the mission name. Loading holds for at least 1.5 seconds, followed by a 1.4 second gray battlefield reveal, the camera move, and a 1.8 second title hold. The full intro finishes before squad readiness, spawning, input or combat begin. Scene cuts use graphics without fleeting text; loading uses a stable status line rather than rapidly changing sentences. Insert and engage accents use the existing synthesized sound bus and mute setting.

The minimum loading hold provides deliberate reading time; actual preparation can take longer. Preparation yields browser frames between expensive stages and warms materials with Three.js `compileAsync` before revealing the first rendered frame. Terrain construction still runs on the main thread; this is a foundation for progressively splitting larger scenes, rather than a background streaming system.

## Lifecycle and ownership

`dist/scene-flow.js` owns the single overlay and cancellation tokens. `dist/cinematic.js` contains renderer-independent camera sampling and the host's deployment readiness gate. `dist/three-view.js` accepts an optional presentation pose; camera obstruction handling still applies, and the final pose/FOV matches the chase camera. The simulation and damage rules remain in `core.js`.

The application runs **prepare/minimum load hold → gray reveal → insertion → title hold → squad wait → spawn/combat**. It holds simulation, player input, HUD and pointer capture until combat. Player/enemy models, projectiles and effects stay hidden throughout the intro. The full sequence is required; Space cannot skip it. Cancel/Escape returns to command; a guest cancelling leaves the squad. Cancelling, disconnecting, or timing out during deployment does not count as campaign withdrawal. Once combat starts, the existing withdrawal rules apply.

The host includes a fresh ticket with each `start` packet. Every pilot acknowledges only after preparing and completing their entire intro. The host sends `combat-live` only when every member of that drop has acknowledged. Unknown, duplicate and stale acknowledgements cannot bypass the barrier. A loading failure, changed squad link or 30 second deadline unwinds the drop. Lobby refit/readiness changes and late joins are blocked during deployment.

The room namespace is now `ironwake-cinematic-v2`, because older clients start simulation immediately and cannot participate in the barrier. All squad members must use this build.

Reduced impact effects (including the default system reduced-motion preference) use a short opacity cut and the stable chase camera throughout insertion. The same gray reveal and title reading holds still run in that mode. Loading progress and mission information remain available, with keyboard focus and live status announcements. No flash frames or combat-time camera takeover are introduced.

## Verification and capture

- `node --test tests/*.test.js` includes camera endpoints across chassis, headings and portrait/landscape aspects, Reduced mode and ticketed squad readiness.
- `node scripts/check-cinematics.mjs` requires Playwright and installed Chrome. It starts and stops its own local preview server. Set `PLAYWRIGHT_MODULE` to an ESM entry point when using an external Playwright installation, or `CINEMATIC_URL` to check an existing preview server.
- The browser check exercises real app rendering and packets with a local mock of PeerJS transport: staged loading, cancellation, stale asynchronous completion, retry, portrait Reduced mode, a slow guest, stale readiness messages, combat release and guest cancellation. Public signaling and real WAN latency still need a human squad playtest.
- Add `--capture` to write screenshots and 64 timestamped frames of a normal solo campaign launch to `.openai/cinematics/`. This capture uses the implemented game without slowing or replacing the camera sequence. Raw frames are ignored by Git.

Future passes can use the overlay and camera sampler for extraction, objective introductions and encounter reveals. Combat-time sequences will need a separate policy for retaining player control and synchronizing the squad; this pass intentionally establishes that ownership at deployment first.
