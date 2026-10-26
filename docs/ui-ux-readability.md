# Game interface

The menu is a field-service hangar. A real fitted mech and an authored environment carry the screen; controls sit at its edges. Typography is Arial/Helvetica throughout, with normal-width headings and no decorative eyebrows.

- **Hangar:** full-screen machine, directional lighting, repair gantry, cables and dust. A spare vertical menu uses a solid selection band, positional movement and chevron. Keyboard navigation matches the visible selection.
- **Assembly:** an open inspection floor, unboxed socket list and a compact parts docket. Candidate geometry appears immediately. Fitted parts carry a check badge; the preview receives a solid contrasting selection. Install explicitly commits a candidate; previewing does not write the saved build. Actual stat changes and invalid capacity remain visible.
- **Operations:** a technical map built from playable geometry, plain mission orders and a connected route. Completed, current, inspected and future missions have different shapes and marks. Loadout, refits, contracts and reports remain working tabs; selected contracts and installed refits have visible check seals.
- **Combat:** one large current-health value and segmented bar at lower left; two equipped weapon silhouettes and compact movement/special controls at lower right. The weapon recovery bars use actual per-hand intervals, rail charge, or movement charge. Active weapons invert to ivory; remaining cooldown time appears only while needed. The special shows its equipment icon when ready and seconds within its ring while unavailable. Weapon names are available on hover, focus and accessible labels. Salvage and run upgrades sit inside the objective disclosure. Touch controls retain adequate target sizes.
- **Registry, saved machines and manual:** readable catalog sheets, ruled navigation and deliberate primary actions. Real data labels remain; repetitive captions, slogans and numbered instructions are removed.

`dist/hangar-ui.css` owns the title screen, shared controls, navigation and dialogs. `assembly-ui.css` owns fitting. `campaign-ux.css`, `chassis-ux.css` and `combat-ux.css` own those screens. `home-battle.js` authors the hangar; `three-view.js` uses inspection-only materials so combat rendering is unaffected. No generated art, font downloads or extra runtime packages are required.

Reference screenshots and visual criteria are documented in [menu-art-direction.md](menu-art-direction.md).

## Verification

The current combined candidate includes career, Anchorage, cinematics and field progression. Its [stacked integration record](ui-stacked-integration.md) lists current non-browser checks and the held readiness gate. Existing screenshots and earlier browser results below predate this stack; the browser harness was not run for the combined build and does not validate its hub/field flows.

```sh
npm test
npm run build
node scripts/check-ui-ux.mjs
```

The browser checker runs four viewports (1440x900, 1280x720, 390x844 and 844x390). It exercises campaign actions, keyboard/focus navigation, preview isolation, installation persistence, chassis changes, saved builds, combat inputs and cooldowns, earned refits and touch targets. It also checks computed typography and visible decorative labels. Set `PLAYWRIGHT_MODULE` to an installed Playwright module URL when it is outside the checkout. `UI_UX_STATIC=1` serves only public game files and the exact campaign fixture through intercepted browser requests when local HTTP access is restricted; it exercises the actual game modules and rendering.

Media under `docs/pr-media/ui-ux/` shows the implemented game. Four-pilot HUD coverage uses layout fixtures; live peer connections are not covered by this UI check.

Pilot voice selection lives in System and the combat menu; the separate voice toggle stays inside that menu. The picker shares Arial typography, ivory selection and readable native radio controls. `PILOT_STATIC=1 node scripts/check-pilot-feedback.mjs` verifies voice selection persistence, preview cancellation, reporting and menu layouts using the real public WAV assets when local HTTP access is restricted.
