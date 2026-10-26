# Chassis roster and integration contract

The campaign-expansion branch builds on PR #6 (chassis plus PR #5 item/special art) and integrates PR #4 (sortie modules and rewards). PR #3 (destruction) now integrates main while keeping Breakwater and its ranges behind the opt-in lab. See `docs/campaign-missions.md` for the nine-round director and the revised between-mission upgrade timing. All PRs target `loganthorneloe/ironwake:main`.

## Chassis and equipment are separate

`dist/chassis.js` is the content registry and the shared simulation/rendering contract. It imports neither the simulation nor Three.js. A saved build identifies its platform with `build.chassis`; `build.parts`, `equipment`, `partColors` and `trailColor` remain separate. Add another platform through the registry; the workshop and campaign derive their rosters from it.

Each platform declares its size class, physical scale, armor/speed/lift/output factors, payload limit, hardpoint allowance, role, specialty and factory kit. Factory stats are examples, not fixed final stats: changing parts still changes performance. **Fit chassis** preserves the current kit; **Factory build** explicitly loads a fresh starting kit.

The initial combat contract retains two independently controlled hands and one special. `hardpoints.heavy` is the number of those hand mounts permitted to carry heavy equipment, not a count of additional guns. Do not show extra shoulder guns until an auxiliary mount schema, simulation, input controls and network replication actually support them. Extending that contract should use new mount IDs rather than changing the meaning of the existing three equipment slots.

Legacy saves without a chassis retain their original stats, physical scale and unrestricted two-hand fitting. New chassis IDs and all part/weapon IDs are validated against static registries. Runtime stat overrides are never loaded from saved builds.

## Integrated PR #5: equipment and special-weapon art

- Preserve both part-design installation and `chassis` sanitization when resolving `core.js`. The build key must contain chassis identity, parts, equipment, paint and exhaust color.
- In `makeMech`, run `buildChassisModel` first, then `addItemDetails`, before rigid-part batching. Chassis geometry owns the silhouette; item geometry owns selected equipment and carried pickups. Preserve the art pass's animated beacon/cargo exclusions.
- Apply chassis scale once to the mech root. Arm/weapon transforms, muzzle flashes and articulated accessories inherit it. Do not independently scale weapons a second time.
- Combine `partChassis` from the art pass with the chassis-default part tiers in `weapon-origin.js`; authoritative muzzle transforms must match the rendered root scale and selected arm/torso geometry.
- Retain `buildKey` as the live-model signature. Rebuild on chassis/part/paint changes as well as equipment changes.
- Ability fields retain the actual simulation radius. Weapon effects should sample world-space muzzle transforms, as the art pass already does. Preserve both the scaled workshop camera and special-preview update helper.
- A carried cell attaches to the existing body mount and inherits chassis scale. Keep the dropped canister and mounted cell mutually exclusive.

## Integrated PR #4: run progression

- Apply chassis factors to assembled part stats, then apply sortie upgrade modifiers. Keep chassis identity and factory loadouts separate from earned module IDs; choosing a platform must not silently install or discard a sortie upgrade.
- Preserve the generated 15-platform campaign roster when resolving campaign UI changes. Contract selection remains host-owned and personal chassis changes invalidate only that pilot's ready state.
- Use the existing validated armor/payload/heavy-slot result when accepting loadouts or deploying. Keep explicit rejection of invalid drafts on the host.
- Keep passive-module hardware separate from chassis silhouettes and hand weapons when extending the art layer.

## PR #3: destruction and Breakwater

- Use `chassisBounds(build)` for pilot radius, body height, clearance and aiming height in movement, cover clipping, swept projectile checks and destructible-structure collision queries. Do not restore the old fixed `21`-radius/`62`-height assumptions.
- Preserve the scale-aware authoritative barrel transform and third-person pivot/distance when integrating analytic sight-line and camera-obstruction changes.
- Keep cosmetic rubble nonblocking; larger chassis must still collide with intact panels and deck undersides. Size is not permission to ignore structures.

## Network and regression checks

The campaign build uses `ironwake-cinematic-enemies-v2-` room IDs. Both hosting and joining require the mission director, between-round refits, chassis registry and expanded part catalog, preventing either older branch from silently normalizing the other branch's builds. The integrated destruction lab uses the separate `ironwake-demolition-cinematic-enemies-v2-` prefix on both endpoints; its invites preserve `?lab=destruction`.

Run all tests after each integration. Check every factory kit; smallest/largest mixed squads; saved/JSON/snapshot round trips; invalid heavy mounts with otherwise legal weight; body-sized cover and shield coverage; both muzzle origins at several headings and elevations; all elevated objectives; and Full/Reduced special effects on Scout and Giga roots. Verify shared ranks, contracts and fracture state in actual multiplayer after integration. The current automated coverage does not replace those future multi-feature multiplayer checks.

The gallery at `tests/chassis-preview.html` uses the live model factory and a shared camera distance to show relative sizes. `tests/chassis.test.js` covers roster validity, migrations, mount rules, movement, scale/weapon agreement, hitboxes, shields, cameras and Giga clearance. Initial armor and movement tuning still needs full campaign playtesting.

## Authored chassis shells

`dist/chassis-art.js` defines fifteen visual identities and workshop silhouettes. `dist/chassis-models.js` replaces the generic rigid shells on named platforms while retaining arm, elbow, weapon and live nozzle groups. Chassis shells must be built before item or module hardware is attached: the replacement removes direct structural meshes. Head and stance offsets are visual; authoritative hand transforms remain unchanged. Selected part tiers change shell bulk and paint is applied by component. Legacy custom frames and enemies retain the original models.

Citadel uses a stationary track undercarriage, including when airborne, and suppresses walking bob. Leviathan uses four splayed supports in two articulated pairs. Other chassis have individual ground stride factors. All retain the existing simulation locomotion, including boost and flight; these models add no auxiliary guns or new chassis abilities. Shared shell geometries and rigid batching follow the existing renderer ownership rules.

## Combined playtest

Run `node scripts/preview-server.mjs 4177` and open `/ironwake/` for normal gameplay. All fifteen factory chassis can deploy into the target range, AI duel or Cinderfall. Workshop sockets expose all forty-five frame designs. Use the special socket and Test equipment to preview EMP, Aegis or repair on the chosen chassis. Cinderfall cells attach to the carrier and detach on delivery, death or disconnect.

The chassis foundry at `/tests/chassis-preview.html` includes six alternate part kits, a special selector, carried-cell hardware and Full/Reduced effects on every chassis. It uses the combined live model factory and effect pools. Preview fields are intentionally reduced in radius for inspection; gameplay uses the actual ability radius in world space. Invalid preview fits remain inspectable; gameplay still enforces mount and payload limits.

`tests/chassis-items-integration.test.js` exercises every part on all fifteen chassis, alternate part families and muzzle transforms, mixed-size squad fields in both effect modes, and real Cinderfall pickup/delivery/death/disconnect snapshots. Normal multiplayer still requires peers running the same combined branch; public signaling and NAT behavior need live squad testing.

Validation on 2026-10-21: all 209 automated tests passed. Browser checks covered custom Wisp and Leviathan target-range firing, Aegis and repair in Full mode, EMP in Reduced mode, and a real two-tab mixed Scout/Giga PeerJS squad deploying into Cinderfall with simultaneous EMP/Aegis effects. Both clients reported no console warnings or errors. The test squad was disconnected after the sortie. Pickup lifecycle coverage is automated simulation/snapshot testing plus visual carried-cell inspection; a full-length multi-pilot campaign remains a playtest task.

Campaign expansion validation and remaining tuning are documented in `docs/campaign-missions.md`. The earlier two-pilot Cinderfall result above refers to the chassis/item integration; new run/refit checks are tracked separately and do not establish nine-mission combat balance.
