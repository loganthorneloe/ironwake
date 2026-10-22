# Campaign mission first pass

The campaign expansion is on `feature/campaign-mission-roster`, based on the combined chassis/item branch. It includes PR #4's combat module effects, rewards and contracts. Installation timing is changed to the requested **earn during a round, apply between missions** loop. The original 15-minute Cinderfall remains a standalone drill. PR #3's destruction work is not merged.

## Run structure

Nine rounds form three acts. Target combat time is 2–3½ minutes per round, around 24 minutes total before refits. Objectives can finish faster with coordinated play. Timings are initial targets rather than enforced countdowns. Completing a goal starts an eight-second extraction arrival, followed by a three-second grounded hold by every surviving pilot. Each round allows one four-second emergency squad redeploy; normal ally revives remain available. Defeat or withdrawal ends the run.

| Level | Mission / identity | Goal and movement problem | Squad roles | Initial target |
| --- | --- | --- | --- | --- |
| 1 | Ashgate Depot / scrap loading yard | Clear a hunter-heavy swarm quota around short crossing lanes; a minimum fifty-second engagement establishes the loop | Frontline kiter, ranged cleanup | ~2 min |
| 2 | Glasswater Spillway / pumps and raised islands | Break three caches and deliver cells to a stationary pump station; two caches have elevated approaches | Multiple carriers, route clearing, cover at delivery | ~2 min |
| 3 | Relay Nine / antenna triangle | Upload at three ground relays in sequence; upload progress persists when the squad rotates away | Ring holder, aerial enemy control, flank coverage | ~2 min |
| 4 | Iron Orchard / paired fortified batteries | Destroy shield relays before their batteries; first regular artillery pressure | Relay flanker, heavy structure damage, protective special | ~2½ min |
| 5 | Gale Foundry / heat banks and gantries | Destroy three heat exchangers, including elevated targets, while avoiding furnace bombardments | Vertical assault, ground crowd control, repair support | ~2½ min |
| 6 | Blackrail Junction / rail switchback | Recover three fuel cells and keep a pilot near the crawler to escort it along its route | Fuel runners, escort anchor, rear guard | ~3 min |
| 7 | Halo Spire / central mast and outer pads | Upload at four relays, including elevated pads; shorter waves bring more armor | Fast rotation, aerial cover, timed Aegis/EMP windows | ~3 min |
| 8 | Shatter Basin / crystal fields | Hunt three marked siege leaders while artillery and mixed swarms continue | Focus fire, armor breaking, special rotation | ~3 min |
| 9 | The Crown Engine / reactor crown | Destroy coolant feeds, defeat the Crown Warden and extract together | Heavy burst, swarm control, sustain and revive coverage | ~3½ min |

## Difficulty and fairness

`mission-catalog.js` owns authored content, geometry and tuning. Every subsequent level increases enemy hull by 12%, incoming damage by 5.5% and ordinary enemy speed by 2.5% of the initial values. Reinforcement intervals descend from 6.2 to 3.7 seconds before contract modifiers. Enemy mixes introduce armored scarabs in Act II and emphasize them in Act III. Live combatants plus queued reinforcements are bounded at 48. Objective and leader health also scale with deployment squad size.

Artillery starts in Act II, uses a 2.6-second visible warning, and accelerates in later missions. Normal spawn points stay outside a 260m exclusion radius around all living pilots; if every spawn lane is occupied, spawning waits. Overtime shortens wave intervals after the target duration plus 45 seconds, without an instant-fail timer. Final/elite arrivals reserve capacity by retiring queued or ordinary fodder rather than exceeding the cap.

Objective and spawn clearances are checked against Giga body radius. All elevated objectives remain below the existing 240m flight ceiling and have platforms and ramps. Terrain collision and aim cover come from the same authored bounds. Edge structures and central landmarks have explicit colliders; thin ornamental details remain cosmetic. Scenery is a first geometry pass, with environmental hazards represented by the existing marked artillery system.

## Reward and refit economy

Enemy and objective kills grant shared salvage through the integrated sortie reward code. Each mission adds a completion award, rising from 90 to 260 salvage. Contracts retain their bonuses: Overrun awards +25% and shortens wave intervals; Siegebreaker awards +35% and inserts additional armored enemies.

Extraction gives each present pilot one choice. A second choice requires at least `220 × (1 + 0.4 × (deployment squad size − 1))` shared salvage. Choices can be banked. Each offer includes an offense, survival and utility option while those families have available stacks, drawn deterministically from six stackable modules. A module can stack three times; profiles are bounded to eighteen installations. This first nine-mission run can award at most sixteen installations before its finale; the higher bound leaves room for additional rounds.

Choices are spent on the campaign board. The host validates the requesting pilot, campaign revision, offered module and available credit. Combat inputs cannot install modules. Upgrades affect combat runtime only; chassis identity, equipment, weight and saved workshop builds remain separate. Every new round reloads each pilot's installed modules. Refit changes clear readiness and require another ready acknowledgment.

The host persists up to four named pilot profiles. Callsigns remain cosmetic, not authentication. Returning pilots keep their modules; new between-round joiners get one catch-up choice per secured mission. A new run clears its modules and banked choices. Best successful mission/contract times persist across new runs. Drills give no campaign progression or module rewards.

## Content and integration boundaries

- `mission-catalog.js`: authored mission specs, arenas and difficulty curve.
- `round-director.js`: seven objective types, bounded waves, cargo, escort, extraction and wipe handling.
- `round-scene.js`: shared geometry, landmarks, capture rings, cargo, crawler and extraction ship.
- `campaign.js`: migration, ordered progress, personal refits, reports and catch-up profiles.
- `campaign-view.js` / `mission-route.css`: route, briefing, drills, refits, contracts and squad readiness.
- `sortie-progression.js`: reused salvage and combat modifiers; legacy combat-install input explicitly rejects requests.

Chassis scale, alternate part tiers, weapon origins, mounted cargo and special-effect pools remain shared with normal gameplay. The room prefix is `ironwake-cinematic-v2-` on both endpoints. A future destruction merge must preserve these mission bounds, host-owned goals and upgrade timing.

## Verification and remaining playtests

Automated checks cover deterministic layouts, Giga clearance, all objective types for solo/four-pilot teams, grounded extraction, complete nine-round advancement, replay rejection, personal upgrades, persistence, damage scaling, catch-up profiles, bounded spawns and finite scene geometry. Existing chassis, item, weapon and Cinderfall tests remain required.

Validation for this pass: all 218 Node tests pass. Local browser checks rendered all nine arenas, entered mission drills, persisted installed modules across reloads, and deployed two clients into Glasswater with their own installed modules. Using a synthetic completed-round save, a new guest received one catch-up choice; installing it synchronized through the host and cleared both pilots' readiness. Both clients displayed the correct next mission and run modules without console errors. These checks validate the refit/network flow, not full-run human combat balance.

The mission gallery renders the actual gameplay meshes. `tests/campaign-fixtures.html` can create clearly labeled synthetic completed-round saves on localhost for refit UI/network checks; it never ships with the game. Such fixture checks do not establish combat balance or prove a human completed a mission. Full-length solo and mixed Scout/Giga squad runs are still needed to tune quotas, survival pressure, salvage thresholds, escort travel and final-boss health. Initial geometry and combat targets should be revised from those playtests.
