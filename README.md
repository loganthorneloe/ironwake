# IRONWAKE

A browser mech-combat prototype for 1–4 players. **[Play at thorneloe.ai/ironwake](https://thorneloe.ai/ironwake/).**

Start a **New campaign** for a nine-mission co-op run across three acts. Earn shared salvage in combat, extract, install personal upgrades during refit, then deploy to a harder mission. **Continue campaign** restores the current run. The workshop, target range and AI duel remain available.

## Nine-mission campaign

| Act | Missions | Combat focus |
| --- | --- | --- |
| I / Breach | Ashgate Depot, Glasswater Spillway, Relay Nine | Swarms, cell recovery, sequential uplinks |
| II / Disrupt | Iron Orchard, Gale Foundry, Blackrail Junction | Shielded batteries, elevated sabotage, fueled escort |
| III / Overload | Halo Spire, Shatter Basin, The Crown Engine | Vertical captures, siege-leader hunts, final warden |

Rounds target roughly 2–3½ minutes, plus refit time. Each arena has authored cover, landmarks, objective positions and spawn lanes. Later missions shorten reinforcement intervals, introduce more armored enemies, raise damage and hull pressure, and add telegraphed artillery. Co-op increases encounter capacity and objective durability; combatants remain capped at 48.

Campaign missions advance in order. Every layout also has a **Practice** drill that gives no campaign upgrades. The original long Cinderfall operation remains available through **Classic operation**. See [mission design and tuning](docs/campaign-missions.md) for layouts, economy, difficulty and testing notes.

## Build your mech during the sortie

Combat now offers **18 field upgrades, 18 salvage tech components, and 18 resonance relays**. Every living pilot earns XP from defeated machines and installs one of three personal upgrades with **1 / 2 / 3** while the fight continues. Press **F** near a cache to buy tech with shared salvage, or link a resonance relay for a tactical calibration. Free combat drops collect automatically at close range. Press **B** for your field inventory and timers; **U** releases the cursor for card selection.

**Permanent upgrade trees live at Wake Anchorage.** Start or continue a campaign to enter the existing walkable 3D harbor. Visit **Chief Rook at Parts foundry** for chassis research and fitting, or **Echo at Signal archive** for pilot training. Walk with WASD/arrows, press E nearby, or select a station marker to navigate there; touch controls are available. The station panel keeps the world visible. Each chassis has three paths, nine upgrades and its own point balance; pilot skills follow your callsign across mechs. Successful campaign extraction earns one chassis point and one pilot point, with free station respecs. Career progress survives reloads and new campaigns, using separate points from run modules and in-mission upgrades. See [career progression, hub dependency and campaign flow](docs/career-progression.md).

**Command → mission → Anchorage:** choose your next drop and ready up at Command, deploy, then return to the arrival berths after results. Extraction saves career rewards, personal run refit tokens and permanent armory credits through their separate systems. Visit Run supplies for run modules, the foundry/arsenal for owned gear, and Command for the next mission. Continue restores the campaign and saved progression; a failed run requires a fresh run while retaining career and armory progress.

Destroy enemies and objectives for shared salvage. Successful extraction grants each present pilot one personal upgrade choice, plus a second when enough salvage was earned. Spend those choices in the campaign refit screen or bank them for later. Choose weapon damage, heavy-target damage, damage reduction, recovery, mobility or special recharge. Run modules are installed at Run supplies between sorties, can stack up to three times, and have eighteen slots.

Successful extraction carries installed upgrades, salvage tech, XP, and unused level choices into the next campaign mission. Timed and sortie-long relay calibrations reset on deployment. Each pilot also earns the existing refit choices between missions, including the extra choice for enough total earned salvage; spending in the field does not reduce that earnings threshold. Defeat or withdrawal ends the run. Saved workshop builds remain independent.

Field technology affects both hands, precision hits, melee, dash, flight, burns, chain arcs, specials, shields, healing, salvage, XP, objectives, and destructible terrain. World hardware has unique procedural models, map markers, and Full/Reduced presentation. The host validates choices and cache purchases, including revision, range, obstruction, cost, and stack limits. Co-op rooms use **ironwake-anchorage-career-cinematic-field-v4**; every pilot must run this build.

The host owns progress, contracts and reward validation. Each pilot chooses upgrades independently. Refit, contract and insertion changes clear squad readiness. Duplicate or stale upgrade requests cannot consume another choice. Campaign saves migrate from the earlier outline. Rooms use the isolated **ironwake-anchorage-career-cinematic-field-v4** protocol; no host migration or mid-mission joining is supported.

See [the full 54-entry technology catalog, balance rules, and playtest routes](docs/field-progression.md). Run **node scripts/preview-server.mjs 4190** and open **http://127.0.0.1:4190/ironwake/** to start a campaign, or **http://127.0.0.1:4190/tests/field-lab.html** for the live field-systems proving ground.

## Play

Enemies now use authored windup, attack and recovery phases. Hunters flank and pounce, Wisps orbit and burst, and Scarabs alternate fans and sweeps. Four new specialists add charging Rammers, Needle snipers, Bellows artillery and Mender repair units. Siege frames choose wide volleys, ground stomps and delayed barrages. Leave marked lanes/circles, interrupt with EMP or stagger weapons, and punish the pale recovery rings. Specialists enter progressively across the campaign and classic Cinderfall.

Anime animation adds deeper anticipation, fast pose releases, spring recovery, bouncy light robots, articulated knees and secondary motion. Shared ink outlines, cel bands, speed strokes and eye glints sharpen the look. Shorter attack cycles and two-to-five simultaneous attackers per target keep co-op pressure high as living squad size grows. Wisps keep strafing through their bursts. Reduced effects preserve essential warnings and remove the extra deformation and accents.

Small enemy packs now coordinate short rushes, opposite flanks and suppression. Distinct directional audio warns of each attack family. Two pilots landing 60 direct damage within 0.9 seconds trigger **Cross Break**, with a brief protected stagger and anime impact reaction; cooperative kills get **Team Finish**. The lab includes audio previews, a team combo drill and a four-pilot pressure drill with sparring partners. Combat continues at full speed through all feedback.

See [enemy behavior design, research and tuning](docs/enemy-behaviors.md). Run `node scripts/preview-server.mjs 4181` and open **http://127.0.0.1:4181/tests/enemy-lab.html** to inspect every attack or fight individual/mixed enemies. Co-op rooms use **ironwake-anchorage-career-cinematic-field-v4** so all pilots share the new warning and artillery state.

- **WASD:** horizontal thrust. **Space:** fly upward; release to descend.
- **Mouse:** aim continuously, without holding a weapon button. If capture is unavailable, hover over the battlefield and move to its edge to keep turning. **Esc:** release the cursor / pause aim; click the battlefield to resume.
- **Hold Q or middle mouse:** lock your movement heading while aiming freely. Release to make movement follow your current aim again. Both weapon buttons remain independent.
- **Left / right mouse:** use the corresponding hand. Hold to repeat fire; railguns charge automatically, fire, recover and repeat.
- **Shift:** directional damaging dash. **E:** rechargeable special.
- **M:** sound. **H:** controls. Arrow keys turn if mouse capture is unavailable.
- **V:** switch between Full and Reduced impact effects. The same control is available in the menu and controls dialog.
- **1 / 2 / 3:** select a field upgrade. **F:** open nearby salvage cache or link resonance relay. **B:** field inventory. **U:** release cursor for upgrade cards.
- Install additional earned modules on the **campaign refit screen between missions**.
- Mechs and random callsigns persist in browser storage. Saved mechs can be exported and imported as JSON.

Five frame components trade armor against movement speed and booster capacity. Both hand mounts accept ranged, melee or defensive equipment. Overweight mechs remain editable but cannot deploy. Damage, cooldowns, range, area effects and utility vary across weapons.

## Base chassis roster

The workshop and campaign offer **15 chassis in five size classes**, three per class. Open the chassis selector beside the Workshop heading. **Fit chassis** keeps your parts, paint and weapons; **Factory build** loads that platform's starting kit. Parts remain independently replaceable and painted.

| Class | Starting chassis | Heavy-rated hand mounts | Relative size |
| --- | --- | --- | --- |
| Scout | Lark (recon), Needle (sniper), Wisp (aerial) | 0 / 1 / 0 | 0.76× |
| Light | Kestrel (skirmish), Ronin (melee), Harrier (aerial) | 1 / 0 / 1 | 0.90× |
| Medium | Vanguard (assault), Longbow (sniper), Warden (support) | 1 / 2 / 1 | 1.00× |
| Heavy | Bastion (defense), Anvil (artillery), Skyguard (aerial) | 2 each | 1.23× |
| Giga | Colossus (assault), Leviathan (siege), Citadel (support) | 2 each | 1.68× |

All chassis currently have two independently controlled hand mounts and one special. A heavy-rated item occupies one of those hands and consumes one heavy allowance. Railguns, Dynamo, rocket/plasma launchers, Gatling, flamethrowers, hammers and Bulwark shields require heavy-rated mounts. Payload and mount limits are validated separately, and an invalid build remains editable but cannot deploy.

Chassis change assembled armor, ground speed, lift and effective booster capacity. Sniper and aerial variants trade those attributes against their role's factory equipment. Physical scale also changes incoming hitboxes, cover/deck clearance, shield coverage, melee reach, muzzle positions and the chase camera. Damage and special ability radii retain their existing rules. Legacy custom saves keep their original stats and size.

Each chassis has an authored structural model: Scouts include a skeletal runner and four-fan drone; Lights include a layered samurai and aircraft frame; Mediums include a knight, optical-mast sniper and rounded rescue capsule; Heavies include a bunker, furnace rig and VTOL gunship; Gigas include a reactor brawler, four-legged dreadnought and tracked fortress. Heads, hulls, limbs, stance and propulsion change with chassis identity. Replaceable part tiers still affect bulk and component paint.

Chassis data lives in `dist/chassis.js`; visual identities and icons live in `dist/chassis-art.js`, and rigid shells are built by `dist/chassis-models.js`. Equipment retains the shared articulated hand mounts. See [chassis integration notes](docs/chassis-integration.md) for the merge contract with destruction, sortie progression and equipment/special art. The destruction branch now integrates main, including chassis, campaign refits, equipment effects and continuous mouse aim. Breakwater remains a separate opt-in lab mission.

Run `node scripts/preview-server.mjs 4177`, then open **http://127.0.0.1:4177/tests/chassis-preview.html** for the true-size roster gallery or **http://127.0.0.1:4177/ironwake/** for the game. The gallery includes class close-ups, front/side/rear angles, bare frames, matching paint, silhouettes, alternate part kits, carried cells, Full/Reduced special effects, walking and flight. Use **Play combined build** to enter normal gameplay. Initial chassis balance still needs full campaign playtesting.

## Visible equipment and part catalog

The workshop offers **45 frame designs**: nine choices for each of the five sockets, including 30 new alternatives. Each has a distinct mesh silhouette and matching inventory icon. Raptor ribs, Spectre panels, circular Helios reactors, Ronin crests, radar dishes, hydraulic arms, skate runners, track sabatons, wing packs and induction halos can be mixed and painted independently. New designs inherit the established light, medium or heavy tier's stats and firing geometry.

All **15 hand weapons** add matching support hardware to the equipped side: shell clips, ammunition drums, missile racks, fuel tanks, capacitors, scabbards and shield generators. EMP, Aegis and Repair have different dorsal emitters and active beacons. A recovered Cinderfall cell bolts onto the lower backpack and disappears on delivery or drop; loose cells use the same armored canister design. Frame, equipment, paint and exhaust changes rebuild live models, including replicated allies.

Specials have different usage effects: EMP launches staggered electric waves and branching lightning, with electrical crowns on stunned targets; Aegis grows a patterned dome with field boundaries and incoming-hit ripples; Repair sends rising cross particles and flowing motes toward living allies in range. Rail and Dynamo charge rings, plasma/rocket discharge rings, Gatling spin arcs, flame nozzle wakes, phaser flow particles and melee sweeps reinforce weapon identity. Workshop **Test equipment** also previews the selected special.

The added usage effects use three fixed instanced pools, a bounded lightning buffer and at most four shield shells. Reduced mode decreases particles and removes their continuous spin, scans and orbiting motion. Effects consume existing simulation state. Damage, cooldowns and ability radii retain their existing rules.

Run `node scripts/preview-server.mjs 4177` and open **http://127.0.0.1:4177/tests/item-gallery.html** for a rotating gallery of every frame, weapon and special, with Full/Reduced, cast timing and carried-cell controls. The server also serves the game at **http://127.0.0.1:4177/ironwake/**. This development gallery is excluded from deployed assets.

## Impact art pass

Combat uses ink-edged muzzle flashes and hit bursts, white-edged melee smears, sharper recoil and strike holds, stepped smoke, blast pressure arcs, and persistent rocket/rail/Dynamo trails. Nearby explosions and heavy hits add brief camera punches; dashes add peripheral speed lines and stronger afterimages. Larger damage numbers and layered armor cracks reinforce successful contact.

Full is the default unless the operating system requests reduced motion. Reduced removes the added camera shake, speed lines, afterimages and armor flashes, and tones down sparks, smoke and recoil. The choice is saved in this browser. There are no full-screen flash frames or simulation pauses. Camera effects are applied after the aiming ray is sampled and restored before the next frame, preserving the original aiming and combat rules.

Hit bursts share three instanced draw calls (28 hits maximum); explosions share five (18 bursts maximum). Trails use fixed histories and clean up when a battlefield resets. The effects consume existing replicated events and require no protocol change or remote art assets.

## Pilot voice callouts

Choose **Rook**, **Flint** or **Echo** from the menu's **Voice** button or the combat pilot-name button, then preview the voice before deploying. Each has 32 original English anime-style callouts generated with [OmniVoice](https://github.com/k2-fsa/OmniVoice): weapon attacks, specials, movement and squad reactions. The selected base voice persists across sessions and loadouts. **VOICE ON/OFF** saves a separate speech preference; **SOUND [M]** mutes all audio. Priority and cooldowns keep callouts from overlapping or repeating on every shot. See [pilot callouts](docs/pilot-callouts.md) for the audition page, line catalog and generation workflow.

## Develop

The [cinematic transitions foundation](docs/cinematic-transitions.md) adds fast menu cuts, staged deployment loading and a brief camera insertion. Spawning and co-op combat wait for every pilot to finish the entire intro; Escape cancels deployment. Reduced impact effects keep the chase camera stable. Rooms use `ironwake-anchorage-career-cinematic-field-v4`, so squad members must run the same build.

Press **F8** or **Report** to submit a bug or suggestion with an automatic game
screenshot, optional voice recording and game context. See [reporting setup and
testing](docs/in-game-feedback.md) for the required server secret and storage.

Requires Node.js 22.13+ (24 recommended).

```sh
npm ci
npm test
npm run dev
```

Open **http://localhost:4174/ironwake/**. `dist/` contains the source ES modules and public assets; no frontend compilation is necessary. `worker/index.js` handles the subpath and serves those assets. Local browser harnesses under `tests/` are development-only and can be served with `python3 -m http.server 4175` from the project root.

```sh
npm run build  # Cloudflare dry-run bundle
npm run deploy
```

Deployments use Wrangler authentication stored outside this repository. The checked-in route targets `thorneloe.ai/ironwake*`; change the route and zone for another domain. Workers.dev and preview URLs are disabled. There are **no database bindings, API secrets or account credentials** required by the game. Never commit `.env`, `.dev.vars`, Wrangler state or database exports.

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs `npm ci`, all Node tests, and the Cloudflare dry-run build on Node.js 24 for PRs targeting `main` and pushes to `main`. You can also run checks manually from **Actions → CI → Run workflow**. New runs cancel superseded checks for the same branch or PR.

Configure a branch rule for `main` requiring **Test and build** before merging. CI does not deploy, reference GitHub secrets, or require Cloudflare credentials or a GitHub deployment environment. The build command uses Wrangler's `--dry-run` option and does not publish the Worker or assets.

Production deployment remains manual: after reviewing and merging changes, update your local `main`, run `npm ci`, `npm test`, and `npm run build`, then run `npm run deploy` using your local Wrangler authentication.

## Version and build identity

The bottom-left label stays visible across menus, dialogs, deployment and combat. `package.json` is the version source; this release is **0.1.1**. For example, `v0.1.1 · local.12 · a1b2c3d` identifies local build 12 and its source commit. `+dirty` means the checkout had uncommitted changes when the build was prepared.

`npm run dev`, `npm run build`, `npm run deploy`, and `npm run preview -- 4178` automatically generate `dist/build-info.json`. Starting `node scripts/preview-server.mjs 4178` directly does the same. Each invocation increments this checkout's `.local-build-number`; both generated files are ignored by Git. `npm run build:info` refreshes the identity when using another static server. A raw source checkout served without generation displays **Development build**.

GitHub Actions uses `github.<run number>.<attempt>` instead, such as `github.42.2` for the second attempt of CI run 42. The run number advances automatically, and reruns have distinct attempt numbers. CI records the identity and full source SHA in the job summary and uploads `build-info.json` as an artifact. Local and GitHub counters are separate; version numbers advance deliberately when preparing a release.

To increment the release version and keep the lockfile synchronized, run one of:

```sh
npm version patch --no-git-tag-version # 0.1.1 -> 0.1.2
npm version minor --no-git-tag-version # 0.1.1 -> 0.2.0
npm version major --no-git-tag-version # 0.1.1 -> 1.0.0
```

Commit `package.json` and `package-lock.json` with the release change. The npm version lifecycle also refreshes the local label. Build/deploy hooks embed the current version automatically; deployment remains the manual command described above.
## Experimental destruction branch

Open `http://localhost:4174/ironwake/?lab=destruction` to opt into the destruction
console. The ordinary home screen, Cinderfall and campaign flow do not select
these levels. **Breakwater** is a standalone second operation: breach customs,
rupture three refinery pumps, collapse the command roof, then extract together.
The **Breach range** has no hostiles; the **Stress yard** adds dense cargo and
fuel arrays. The optional demolition kit fits hammer, rockets and repair.

Objects now fracture locally: small per-object grids let bullets punch holes
without deleting an entire wall or crate. The remaining chunks share exact bounds
with movement, projectiles, sightlines and camera rays. Disconnected islands
crumble; severing load-bearing columns cascades the roof. This is not arbitrary
mesh cutting or a voxelized terrain world. Fuel chains also damage combatants.
Detached chunks use gravity, tumble, terrain/structure collisions, restitution,
friction and sleeping. They remain nonblocking and non-damaging to pilots.

`fracture-layout.js` defines shared cell bounds and adjacency;
`destruction.js` owns the opt-in spatial index, cell HP and support state;
`destruction-mission.js` authors levels and directs objectives;
`destruction-scene.js` batches panels, debris and rubble;
`chunk-physics.js` owns the capped, presentation-only debris simulation;
`destruction-lab.js` owns the opt-in console and live counters. Definitions stay
in the initial mission; panel HP, revision, pending work and recent events travel
in normal host snapshots. Lab invites use an isolated PeerJS protocol prefix.
Budgets are 64 awake physics chunks, 160 sleeping chunks, 48 recent fracture
events, 128 pending jobs and 12 structural jobs per simulation step. Chunk physics
runs at 60 Hz with at most three substeps per rendered frame and no chunk-to-chunk
collision pairs. Reduced motion lowers the awake budget to 24 and removes tumble.
Intact objects stay single instances; only damaged objects activate fracture
cells. Geometry stays instanced and shared; sleeping transforms upload only when
the sleeping pool changes. Only host hole/support state replicates, not cosmetic
physics transforms. Counters expose awake/settled chunks, draw calls and renderer
geometry/texture counts. These are not frame-rate guarantees; low-end/mobile
hardware still needs measurement.


## Multiplayer

PeerJS provides public room discovery; WebRTC carries game traffic directly between browsers. The squad host runs the authoritative simulation and sends snapshots. PeerJS binary serialization chunks large level and horde messages before transmission; the JSON channel’s 16 KB limit is not suitable for these snapshots. Players join and ready up before deployment. Keep the host tab active.

Public PeerJS signaling and Google STUN require internet. There is no TURN relay, dedicated game server, host migration or mid-mission joining. Restrictive NAT/firewalls can prevent connections. Callsigns are random cosmetic identifiers, not authenticated accounts. The combined chassis/item room protocol separates this release from either earlier branch.

## Project layout

- `dist/core.js`, `planet-mission.js`: simulation, combat and mission progression.
- `dist/three-view.js`, scene/model/effect modules: cel-shaded Three.js rendering.
- `dist/app.js`: workshop, HUD, input and room lifecycle.
- `dist/campaign.js`, `campaign-view.js`, `campaign.css`: campaign state, territory board, insertion choices and deployment loadouts.
- `dist/sortie-progression.js`, `sortie-view.js`, `sortie.css`: shared salvage, field modules, contract selection and sortie reports.
- `dist/audio.js`, `sound-design.js`: synthesized sound effects.
- `tests/`: simulation, controls, rendering fixtures and hosting checks.
- `worker/`: Cloudflare asset routing; only `dist/` is published as static files.

Cinderfall follows a continuous, walled freight canyon through five stages: insertion, battery ridge, a crawler escort, the reactor, and extraction. Seeded cargo cover, raised decks, gantries, silo banks, route lights, windblown ash and industrial signage give each section a readable path. Reinforcements arrive at freight gates near the squad; distant ordinary robots recycle while elites and objectives persist. Enemy caps scale from 32 solo to 56 with four pilots, with short arrival telegraphs and roughly 5.5 seconds between reinforcement waves.

The menus and HUD share a monochrome green visual system inspired by the Even G2 display: thin outlines, subdued secondary text and brighter active states. Static scenery and ordinary robot parts use instanced rendering; a spatial collision index and analytic sight-line checks keep larger encounters practical. No new image/model downloads or remote font requests are needed.

Cinderfall scales objectives and enemies for 1–4 pilots. Two rare siege-mech arrivals and the reactor warden have warning, descent and impact phases. The deterministic pacing model estimates 13.2–14.8 minutes for 1–4 pilots. This is not a complete human playtest; difficulty remains a work in progress. `tests/planet-preview.html` walks through the route and `tests/cinder-stress.html` exercises four pilots against 56 robots.

The old site provides a one-time browser-to-browser transfer of saved mech builds. It does not transfer old pilot tokens or database records. The receiver accepts messages only from the exact legacy origin and opening window, sanitizes builds, and retains at most 12 saves.

## Third-party code

Three.js and PeerJS are vendored under `dist/vendor/`. Their license notices are included alongside them. No private design-kit source, hosting credentials or player data is included in this repository.
