# UI/UX stacked integration

This 2026-10-26 cleanup continues `feature/ui-ux-readability` and existing draft [PR #18](https://github.com/loganthorneloe/ironwake/pull/18), targeting `loganthorneloe/ironwake:main`. It combines the UI redesign with finalized, unmerged PR #17. Its diff against main therefore includes the career, Anchorage hub, cinematic and field-progression predecessors.

## Required history

- Previous published UI head: `3a17d01cafd7fd454c0b03d84d5aac766013a778`.
- Fresh canonical main: `dbed1091741a9ebdf911ba796e4adf7711c19f4d`, already an ancestor of the UI branch.
- Finalized PR #17: `41b638f3d25e7408cc44b2e7e20174b176f35308`.
- PR #16 contained by #17: `f6f26b8bff7b8064e952d3262d9fdef657e5f700`.
- PR #14 contained by #16: `0efb32163ea02822c9956358772b1f977bb2d457`.
- Original landscape/QA commit preserved through #17: `84f590ae2137e1b4511499b77f6315dba9713881`.

Main was already fully included, so the predecessor merge brings the required history without another main merge. No other implementation branch was used. No remote PR or main was merged, and nothing was deployed.

## Semantic integration

The authored hangar, Arial/Helvetica typography, technical mission map, explicit component preview/install behavior and compact primary combat HUD remain. Command uses the redesigned five tabs while preserving researched deployment stats, license gating, carried field inventory and the supply-station route for refit spending. The Anchorage viewport reserves the shell's top navigation and bottom rail. System blocks hub movement input, and Anchorage receives the active navigation state.

Combat health reads `combatStats(p).hp`, including career training and current field hull changes. Weapon, dash and special countdowns use the same `combatRecovery(p)` rates as the simulation; recovery-fill fractions retain their nominal timer basis. This fixes incorrect seconds after recharge upgrades without changing gameplay rates.

Routine field summary data sits inside the objective disclosure. The inventory drawer, live upgrade choices, nearby interactions and pickup notices are independent game children. B or the combat-menu inventory command opens inventory while objectives remain closed; the drawer has its own close control. Field choices and interactions keep their revision/deduplication behavior and actual command queue. Combat-menu and reporter input guards return neutral input without consuming pending field commands. Choices and interaction shortcuts preserve combat mouse capture; inventory/cursor shortcuts release it.

The original `sortie.css` landscape rule `max-height: max(72px, calc(100svh - 465px))` and its explicit QA isolation remain unchanged. The original reproduction PNG has the same Git blob `e95d5d0c1af984b4ac31a4165b9dc569d5eca122`. The new inventory drawer and primary-HUD spacing rules also require actual visual verification; their source and VM checks do not establish readability, occlusion or scrolling quality.

Career training still establishes the base before field hardware applies. The strongest complete shield selection, capped/obstructed pickup progress, trained hull base, dynamic critical-hull audio threshold, separate career/run rewards/currencies/saves and reward dedupe remain. The corresponding predecessor simulation and production-audio regressions pass.

Deployment keeps asynchronous preparation, generation checks, matching tickets, cancellation, the all-pilot readiness barrier and settlement activation only at combat release. Career rewards settle before campaign settlement clears the active flag. The renderer preserves cinematic camera handoff and field-scene warm-up/hide/disposal alongside the redesigned inspection hangar. Voices and transition/combat playback share one audio import. Reporter capture still selects the hub or battlefield appropriately, pauses solo simulation and neutralizes co-op input.

## Current non-browser validation

- Full Node suite: **419 passed, 0 failed, 0 cancelled, 0 skipped**.
- Syntax: **161** non-vendor JavaScript modules and **29** inline HTML scripts passed.
- Wrangler **4.151.1** production dry-run: passed, reading **212** production assets; worker upload 11.14 KiB / gzip 3.94 KiB. No deployment.
- Sixteen new simulation/VM regressions cover closed-objective inventory access and command delivery, menu/report guards, dynamic hull and actual recharge seconds, relay expiry/caps, station routing and read-only carried progression, researched/license-aware command tabs, and shell/hub navigation/input.
- The entry-asset regression checks unique controls and the voice/report/inventory commands within the combat menu. Existing view fixtures were adapted to the real tab/disclosure structure rather than retaining duplicate hidden UI.
- Source checks preserve one app audio import and no QA fixture/mock imports in deployed source/config. Whitespace and conflict-marker checks pass.

Local logs are ignored under `.artifacts/ui-stack-final-tests.log` and `.artifacts/ui-stack-wrangler.log`. Exact published-head CI is reported in the PR description separately.

## Evidence and readiness limits

**Keep draft.** Earlier PR #18 screenshots, GIFs, four-viewport browser checks and pilot/reporter smoke results belong to the pre-stack UI build `3a17d01`. Predecessor screenshots also predate this combined build. They remain historical design/behavior evidence and are not current combined visual proof.

The inherited browser action navigating to `http://127.0.0.1:4203/tests/field-browser.html` was URL-policy denied because the current URL could not be verified reliably. This pass did not retry that action, use another browser/headless/QA route, or indirectly obtain the denied field landscape/reporter validation. The denied leftover `data:error` tab from PR #16 was left alone. No browser checks or new captures were performed in this pass.

The fixed populated landscape inventory and real-layout assertions, reporter failure/draft/retry UI, combined desktop/mobile flows and actual touch controls, Full/Reduced field equipment visuals, animated field-mechanic evidence, live WAN co-op and full nine-mission balance remain unverified. The old UI browser harness was not run and does not establish the new hub/field flow. PR #16's reviewer-requested human/manual gate is inherited and remains open. Passing Node tests, source checks and CI do not clear these material gates or replace independent review.
