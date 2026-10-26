# Field progression

IRONWAKE now builds a pilot's combat configuration during each sortie. The catalog contains **18 field upgrades, 18 salvage tech components, and 18 resonance relays**. All hardware uses procedural, ink-outlined, cel-shaded models and the established service colors; no external art assets are required.

## Combat loop

1. Destroy hostiles and mission targets. Every living pilot earns combat XP independently of who lands the killing blow. Training targets grant none.
2. Level up and choose one of three seeded upgrades with **1 / 2 / 3**, or **U** to release the cursor and select a card. Combat continues for everyone. Choices remain available until used and can accumulate.
3. Approach a salvage cache and press **F** (or its on-screen button) to install its component. The first authored cache is free; others cost shared salvage. The opener receives the component. Objectives, elites, and every twelfth combat defeat can drop free tech, capped at four drops per sortie; moving near a drop collects it automatically.
4. Link a resonance relay with **F** for a tactical calibration. Each pilot can link each station once. Most calibrations last 60 seconds; Telemetry lasts 75 seconds. Bulkhead and Uplink last for the current sortie. Duplicate timed relay types refresh their timer; permanent calibrations cannot stack with another station of the same type.
5. Extract to retain field upgrades, installed tech, cumulative XP, and unused level choices for the next campaign mission. Refit modules remain an additional between-mission reward. Relay calibrations expire before the next deployment. Defeat or withdrawal ends the run; workshop loadouts remain independent.

Open **B** for stack counts, component descriptions, and active calibration timers. Free tech drops use a 42m collection radius, extended by magnetic hardware. Explicit station interactions require 125m proximity, compatible altitude, and an unobstructed line of sight. Hand controls, flight, dash, specials, missions, enemy warnings, and objectives continue normally during upgrade selection.

## Balance and economy

The first level needs 40 XP. The cumulative threshold for level `L` is `30 × (L − 1) + 10 × (L − 1)²`; enemy awards start at 10 XP for a Hunter, 14 for a Wisp, 22 for a Scarab, 35 for a mission target, 80 for an elite, and 140 for the Warden. Telemetry hardware modifies each pilot's award. Downed pilots receive no XP.

Each mission places four to six caches and two to four relay stations near its authored objectives and insertion, avoiding cover, ramps, and platform edges. Purchases cost 18–30 salvage; two permanent calibration types cost 16 and 20 salvage per pilot. Spending uses the shared balance, while extraction bonus choices use cumulative earnings, so field purchases do not remove the extraction reward threshold. Fractional contract bonuses survive purchases. Salvage modifiers use the average of the living squad's bonuses.

The field inventory allows 36 upgrade stacks and 36 tech stacks, in addition to the existing 18 refit-module slots. Most technologies stack three times; advanced salvage tech stacks twice. Incoming field reduction caps at 65%, weapon cycling at +150%, movement/lift/projectile speed at +100%, and area at +100%. Critical chance caps at 75%. Repair siphons have a 24-hull-per-second budget; chain arcs have a 0.4-second interval and cannot recursively trigger additional procs. Retaliation and ignition also avoid recursive activation. These are first-pass balance values; full-run human solo and squad playtests remain necessary.

## Integration and authority

- `dist/field-catalog.js` owns technology metadata and inventory sanitization. `dist/sortie-progression.js` owns XP, deterministic offers, field stations, purchases, expiry, drops, and reports.
- `dist/core.js` and `dist/field-combat.js` apply the actual combat effects to both hands, projectiles, melee, burns, dash, specials, shielding, repair, enemies, objectives, and destructible scenery. Runtime hull, movement, and lift use `combatStats`; saved workshop builds are never changed.
- Permanent mech research and pilot training from the career system establish the combat base before field modifiers apply once. Field hull stores that trained base across authoritative ticks, purchases, relay support, repair and redeployment. Career points, permanent armory credits, campaign refit tokens, shared field salvage, and combat XP keep separate balances and save rules.
- `dist/field-scene.js` owns shared geometry, palette, signs, beacon markers, spent cache housings, pilot calibration rings, and level pulses. The scene caps at 64 locations and four pilot indicators, resets on deployment, and releases its resources. Reduced effects remove idle motion and pulse animation.
- `dist/sortie-view.js` supplies the XP HUD, choice cards, station prompt, inventory, and debrief. Nearby and full maps include cache and relay markers.
- Campaign saves remain version 2. Old profiles migrate to empty field inventories and zero XP. Successful sortie reports are sanitized before the next profile is stored. Offers and purchases are host-authoritative, revision checked, bounded, and rejected when stale, unaffordable, out of range, obstructed, or downed. Rooms use `ironwake-anchorage-career-cinematic-field-v4`; every squad member must use the same build.

## Verification and playtest

Run `node --test tests/*.test.js`. Field tests cover the catalog, seeded placement across all nine arenas, shared XP, replay rejection, purchases, drop collection, modifiers, damage/healing interactions, save persistence, model distinction, and resource cleanup. The existing combat and campaign suites also remain in place.

Run `node scripts/preview-server.mjs 4190`, then open:

- `http://127.0.0.1:4190/ironwake/` — the actual game; start a new campaign.
- `http://127.0.0.1:4190/tests/field-lab.html` — live combat with the production simulation, HUD, models, and seeded test equipment. **Approach next cache / relay** moves to a station; **Call hostile squad** generates XP targets.
- `http://127.0.0.1:4190/tests/field-lab.html?mode=gallery&type=cache&all=1` — all 18 salvage tech models.
- `http://127.0.0.1:4190/tests/field-lab.html?mode=gallery&type=relay&all=1` — all 18 relay models.

The lab is development-only and is excluded from the deployed `dist/` assets. It does not write a campaign save. Before release, verify desktop and touch card selection, the three live HUD panels, Full/Reduced visuals, every equipment family, an entire nine-mission run, and a host/client squad through extraction and reconnection. The automated checks do not establish rendered layout quality or final balance.

### Review follow-up validation

The review fixes select overlapping Aegis domes using their complete, clamped damage factor, including both shield and special power. Real simulation regressions cover all six weak/strong/target roster orders, mixed bonuses, and the mitigation floor. Automatic collection now continues past rejected drops and stops after one successful pickup per pilot per tick; regressions cover a stack-capped first drop and an obstructed first drop at extended magnetic range. All five regressions failed before their respective fixes.

The earlier review follow-up passed 323 Node tests and the Wrangler 4.151.1 dry-run build. The [stacked integration follow-up](field-stacked-integration.md) now incorporates the finalized mech/pilot career, Anchorage hub, voices, and cinematic deployment branch plus current canonical main. New non-browser integration regressions exercise career/field stat composition, both save/reward systems, queued field input during reporting, cancelled preparation, and the matching-ticket squad launch barrier. Browser and human validation gates remain open.

The attached browser rendered a fresh campaign and deployed Ashgate with field hardware, the XP HUD, map markers, and a cache prompt. [Gameplay capture](pr-media/field-cache.png) shows that limited desktop smoke check. The original visual attempt was blocked because Computer Use could not verify the browser URL; the later attached-browser session was stopped by the user's physical Escape key before completing inventory, feedback, mobile, or live co-op checks. These checks, animated mechanic media, and full campaign/balance playtesting remain outstanding.

## Technology catalog

<!-- Generated from the shipped catalog below. -->

### Field upgrades

| Technology | Effect |
| --- | --- |
| Weapon overdrive | Increase all weapon, dash and special damage by 12% per stack. |
| Siege rounds | Deal 20% more damage to armored scarabs, siege mechs and mission targets. |
| Reactive armor | Reduce incoming damage by 10% per stack. Total field reduction caps at 65%. |
| Recovery mesh | After seven seconds without damage, repair 2 extra hull per second. |
| Vector boosters | Increase movement and lift by 10%; recharge dash 10% faster. |
| Special capacitor | Recharge the equipped special 25% faster. |
| Accelerator servos | Cycle both hand weapons 10% faster, including melee recovery. |
| Coil accelerator | Launch projectiles 20% faster and deal 6% more ranged damage. |
| Blast geometry | Expand projectile explosions and melee shockwaves by 15%. |
| Weakpoint solver | Gain 6% critical-hit chance and 15% more critical-hit damage. |
| Repair siphon | Repair hull equal to 1.5% of damage dealt. |
| Impact actuators | Deal 18% more melee damage and 10% more dash damage. |
| Aerial stabilizers | Deal 15% more damage while airborne and gain 10% lift. |
| Arc coupling | Hits have an 8% chance to arc to a nearby exposed hostile for 35% damage. |
| Thermal injector | Hits have a 10% ignition chance. Increase burn damage by 20%. |
| Cull protocol | Deal 25% more damage to targets below 30% hull. |
| Bulkhead lattice | Increase maximum hull by 15%; gain the added hull immediately. |
| Combat telemetry | Earn 15% more combat experience and increase pickup reach by 30m. |

### Salvage tech

| Technology | Effect |
| --- | --- |
| Counterweight gyro | A reclaimed gimbal adds 8% movement speed and 10% precision damage. |
| Spall liner | Ceramic shielding reduces damage by 6% and adds 8% maximum hull. |
| Ferrite collector | Magnetic vanes pull pickups from 60m farther away and earn 12% more salvage. |
| Redline governor | Cycle weapons 12% faster while reducing maximum hull by 5%. |
| Scarab repair pump | Destroying a hostile repairs 3 hull. |
| Ablative mirror | Reflect 12 damage to nearby attackers whenever you take a hit. |
| Razor flywheel | Deal 20% more dash damage and recharge dash 12% faster. |
| Needle optic | Deal 20% more precision damage and gain 4% critical chance. |
| Pulse resonator | Deal 18% more damage to stunned targets and expand blasts by 8%. |
| Venturi nozzle | Gain 18% lift and deal 10% more damage in flight. |
| Afterburn igniter | Add 8% ignition chance and 25% burn damage. |
| Recovered relay coil | Gain 5% arc chance and 25% chain damage. |
| Mender filament | Recovery repairs 2 extra hull per second; specials recharge 10% faster. |
| Auxiliary reactor | Equipped specials gain 18% power and 10% faster recharge. |
| Emergency overdrive | Below 35% hull, deal 25% more damage. |
| Siege counterweight | Deal 16% more heavy-target damage and 12% more melee damage. |
| Aegis inverter | Strengthen shield protection by 12% and add 10% maximum hull. |
| Warden black box | Earn 20% more XP and gain 25% critical damage. |

### Resonance relays

| Technology | Effect |
| --- | --- |
| Assault relay | Synchronize weapons for +30% damage for 60 seconds. |
| Bastion relay | Resonant plating reduces incoming damage by 30% for 60 seconds. |
| Velocity relay | Gain 30% movement and lift, plus 40% faster dash recharge for 60 seconds. |
| Mender relay | Restore 35% of maximum hull now and gain +6 recovery per second for 60 seconds. |
| Capacitor relay | Recharge specials 75% faster and increase their power by 25% for 60 seconds. |
| Barrage relay | Increase hand-weapon cycling by 30% for 60 seconds. |
| Siege relay | Deal 45% more damage to heavy hostiles and objectives for 60 seconds. |
| Deadeye relay | Gain 20% critical chance and 35% precision damage for 60 seconds. |
| Thermal relay | Gain 35% ignition chance and 60% burn damage for 60 seconds. |
| Arc relay | Gain 25% arc chance and 60% chain damage for 60 seconds. |
| Impact relay | Increase melee damage by 40% and dash damage by 50% for 60 seconds. |
| Telemetry relay | Earn 40% more combat XP and salvage for 75 seconds. |
| Siphon relay | Return 5% of damage dealt as hull and repair 5 hull per kill for 60 seconds. |
| Bulkhead relay | Add 12% maximum hull for the rest of this sortie. New hull is repaired immediately. |
| Reprisal relay | Return 30 damage to close attackers and deal 40% more damage at low hull for 60 seconds. |
| Cull relay | Deal 60% more damage to weakened targets and 30% more to stunned targets for 60 seconds. |
| Uplink relay | Gain 10% weapon damage and 15% experience for the rest of this sortie. |
| Overload relay | Increase blast radius by 35%, projectile speed by 25% and special power by 25% for 60 seconds. |
