# Field progression stacked integration

This 2026-10-26 follow-up keeps the existing `feature/field-progression` branch and draft [PR #17](https://github.com/loganthorneloe/ironwake/pull/17) against `loganthorneloe/ironwake:main`. It includes the unmerged predecessor PR #16, so the PR diff against main also includes that predecessor's career, Anchorage hub, and cinematic work. This is a stacked candidate, not a claim that all those features originated in PR #17.

## Included history

- Published PR #17 baseline: `a340e65099228fc5a1c1f4b12ea2959d0d35e9bc`.
- Preserved local landscape/QA candidate: `84f590ae2137e1b4511499b77f6315dba9713881`.
- Latest verified canonical main: `dbed1091741a9ebdf911ba796e4adf7711c19f4d`.
- Finalized PR #16 predecessor: `f6f26b8bff7b8064e952d3262d9fdef657e5f700` on `feature/mech-pilot-upgrade-trees`.
- PR #14 included by that predecessor: `0efb32163ea02822c9956358772b1f977bb2d457`.

Main and PR #14 were verified ancestors of PR #16 before merging the predecessor, so that merge brings both required histories into PR #17 without a redundant main merge. The unrelated all-PR integration/refactor branches are not used. The original landscape commit and reproduction image remain preserved.

The complete stacked diff against the verified main is **91 files, 4216 insertions and 170 deletions**. Against finalized PR #16, the field candidate is **39 files, 1492 insertions and 114 deletions**. These Git counts include documentation and media; predecessor screenshots and GIFs are not new combined-build verification.

## Semantic resolutions

- Career training modifies workshop base stats first; field hardware applies afterward. A trained hull base is captured before loading carried field inventory, preventing `stepField` from clamping away career hull. Movement, lift, damage, recovery, cooldowns, and mitigation compose once. Field armor uses its bounded additive contract, with career mitigation multiplying the result.
- Career certifications, armory ownership/credits, run refit tokens, field salvage, combat XP, upgrades, and salvage tech keep their existing distinct reward and persistence rules. Command displays carried field stacks and sends refit purchases to Run supplies; foundry/archive career access and armory station gates remain intact.
- The complete shield-factor selection and automatic pickup scan fixes remain. Career and field integration tests use actual simulation damage, hull changes, expiry, motion, save reload, rewards, refit spending, respec, defeat, and practice exclusions.
- App field commands and HUD coexist with reporter input guards, solo report pause, co-op neutral input, hub screenshot capture, selectable pilot voices, and one audio module import. Node VM regressions exercise the real app functions without a browser or network.
- The final audio audit reproduced a stale maximum-hull cache: field acquisition changes hull without replacing the workshop build object. `updateSound` now supplies current `combatStats(p).hp` to the critical-callout tracker. Four regressions execute the production audio module with real stats/event tracking and an inert voice sink: hull upgrade, Spall liner, Bulkhead relay, and Redline governor. All four failed before the fix and passed afterward, covering both missed and premature 25% critical edges without replaying the callout. These tests do not establish audible playback quality.
- Async battlefield preparation retains generation checks, deployment ticket acknowledgements, the all-pilot readiness barrier, cancellation, and delayed campaign settlement activation. Field scene resources warm with the render assets, hide during deployment, and reset/dispose with the battlefield.
- Co-op uses the new shared `ironwake-anchorage-career-cinematic-field-v4-` namespace, with a separate demolition namespace. Every squad member must use this combined build.
- The preview server retains explicit `--field-qa` injection and localhost-only mock behavior, and serves the predecessor's WAV voice assets with the correct MIME type. Five in-memory preview regressions cover ordinary app identity, opt-in isolation, mock failure/retry metadata, no network calls, and exact WAV bytes/content type. Deployed assets remain `./dist`; the local fixtures and mock server are excluded.

## Validation and held readiness gate

Final non-browser validation on the combined candidate:

- `node --test tests/*.test.js`: **403 passed, 0 failed, 0 cancelled, 0 skipped**, duration 40127.2963ms. This includes the eight new career/field simulation tests, four app integration tests, four critical-hull audio regressions, five preview-isolation/media tests, and the existing shield/pickup regressions.
- `node --check` passed for all **153** non-vendor JavaScript modules in `dist`, `worker`, `scripts`, and `tests`. Git whitespace and conflict-marker checks passed.
- Wrangler **4.151.1** `deploy --dry-run --outdir build` passed, reading **203** production asset files; worker upload 11.14 KiB / gzip 3.94 KiB. No deployment was performed.
- Source checks found one app audio import and no local QA fixture imports/hooks/mocks in production source or deployment configuration. Wrangler assets remain `./dist`. The landscape CSS, fixtures, assertions, and reproduction PNG from the preserved local commit remain intact.
- Ignored local logs: `.field-stacked-tests.log` and `.field-stacked-build.log`.

These are code/simulation checks, not browser or live WAN coverage. CI must be checked separately on the exact published head.

PR #17 remains **draft**. Its confirmed pre-fix landscape reproduction is documented in [the landscape validation record](field-landscape-validation.md); the 72px minimum fix has not been visually rechecked. The last Computer Use attempt to navigate to `http://127.0.0.1:4203/tests/field-browser.html` was blocked because the current Windows browser URL could not be verified confidently enough to enforce policy. No browser restart, alternate route, headless workflow, or workaround was attempted in this integration pass.

The fixed populated inventory at 667×375, real layout assertions, reporter UI failure/draft/retry, remaining desktop/mobile interactions, real touch controls, Full/Reduced field visuals across equipment, animated field-mechanic evidence, live WAN co-op, and full nine-mission balance still need validation. PR #16's reviewer-requested human/manual gate is also inherited and is not cleared by this merge or green CI. Independent reviewer approval remains required. Prior screenshots/GIFs are historical evidence, not fresh captures of the combined candidate.
