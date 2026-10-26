# PR19 sequential integration — 2026-10-26

This update continues the existing `refactor/parallel-workstreams-20261025` branch and PR19 against
`loganthorneloe/ironwake:main`. It adds current main and the finalized preceding PR18 to the modular
architecture. It creates no replacement branch or PR and does not merge anything remotely.

## Source history

| Source                            | Revision                                   |
| --------------------------------- | ------------------------------------------ |
| Previously published PR19         | `bbdb658f3cc0568072af80a31dc8546806dc6358` |
| Canonical main                    | `dbed1091741a9ebdf911ba796e4adf7711c19f4d` |
| Preceding PR18                    | `a4c7f8949f05ff3341a3a2184a553982b7051b5e` |
| Final PR17, included through PR18 | `41b638f3d25e7408cc44b2e7e20174b176f35308` |
| Final PR16, included through PR18 | `f6f26b8bff7b8064e952d3262d9fdef657e5f700` |
| Final PR14, included through PR18 | `0efb32163ea02822c9956358772b1f977bb2d457` |
| Preserved original landscape work | `84f590ae2137e1b4511499b77f6315dba9713881` |

Main was merged locally first. PR18 was not already an ancestor of main, so it was merged next.
The [manifest](parallel-integration.json) retains the original integration snapshot and records the
updated source heads. Ancestry is checked before publication. At the start of this stage, PR19 had
no review threads or discussion comments; no review replies, approvals or thread resolutions were made.

## Semantic reconciliation

- Retain focused catalog/build/simulation modules, compatible core/mission exports, expanded source,
  formatting and architecture checks. Newer predecessor behavior lives in those modules rather than
  restoring the large core or app implementations.
- `combatRecovery(p)` is public and shared by simulation and HUD: weapon recovery uses field fire
  rate; dash/special recovery combines career rates with the capped field bonus. HUD countdowns use
  real seconds while progress fills retain their nominal cooldown basis.
- Career training establishes hull before field hardware. `newWorld` passes `statsForPlayer` into
  `initSortie`, including damaged-hull initialization. Career damage also reaches demolition objects
  without requiring a field profile. Strongest full shield mitigation and successful-only pickup
  scanning remain intact. PR19's arc-once/final-120-cap regressions remain intact.
- Dynamic critical-hull audio reads the current combined maximum; all four predecessor production
  audio regressions remain. Career/run saves, currencies, rewards and deduplication remain separate.
- Preserve final18's authored hangar, Arial interface, terrain survey, five-tab Command,
  preview/install workshop, researched/license-aware deployment and compact actual-hull HUD.
  Inventory, upgrade choices, cache interaction and pickup notifications remain independent of the
  closed objective disclosure. The field drawer is reachable through B and the combat command.
- Preserve asynchronous preparation, matching deployment tickets, all-pilot readiness, stale-work
  cancellation, delayed settlement activation, camera handoff and field-scene lifetime. Career reward
  settlement precedes campaign settlement. Reporting retains hub/battle capture, solo pause and
  neutral co-op input; System/menu input guards remain active.
- Extracted HUD, labels, manual, orbit and deployment controller bodies were compared with final18.
  Session adapters read current state and retain the predecessor ordering and capture guards.

The production import-graph regression found a real renderer split: the hub still imported
`three-view.js?v=impact-1` while the app/controller used `?v=ui-stack-1`. The regression failed before
aligning the hub URL and passes afterward. It checks full resolved URLs, including query strings,
for renderer, audio, core and view state. File-existence checks alone do not establish singleton
identity. Room namespaces are composed centrally and match the finalized predecessor contract.

## Current non-browser validation

- Full Node suite: **445 passed, zero failures, cancellations or skips**.
- Native JavaScript syntax: **229 modules and 29 inline HTML scripts passed**; these checks parse
  source and do not load a browser or execute the HTML fixtures.
- Pinned Prettier, whitespace/conflict-marker and dependency-architecture checks passed. The
  architecture check covers 229 modules and 59 extracted modules.
- Wrangler **4.151.1** production dry run passed, reading **279 assets**; worker upload 11.83 KiB /
  gzip 4.06 KiB. This does not deploy.
- All 51 predecessor test declarations and behavioral assertion counts across the audited audio,
  career, field and shell files were retained. Source/VM tests select actual production functions
  and exported controller factories by syntax and run the actual app composition callbacks with
  inert services. They do not evaluate a stale monolithic copy or depend on compact source lines.
- The hub HTML fixture retains final18's expanded checks plus the earlier global ticket uniqueness
  assertion. Its 20 assertions were preserved in source, **not executed in a browser this stage**.
- Added regressions cover damaged trained-hull initialization, actual demolition projectile damage
  with career bonuses and full-URL singleton identity. Preview-server mock tests are in-memory
  metadata/route checks; they do not prove reporter UI failure, draft retention or retry behavior.

Local command records are ignored under `.openai/stack-tests.log`, `stack-syntax.log` and
`stack-build.log`. Exact published-head CI is reported in PR19's description after terminal completion.

## Historical evidence and held readiness gate

**Keep PR19 draft.** Stored PR19 screenshots/GIFs at `bbdb658` and earlier PR18 captures at `3a17d01`
were inspected as pre-stack evidence only. They predate this combined candidate and do not verify
its visual layout, touch controls or reporter flow. No new browser checks or captures occurred here.

The inherited action navigating to `http://127.0.0.1:4203/tests/field-browser.html` was URL-policy
denied because the current Windows browser URL could not be reliably verified. This stage did not
retry it or use another browser, headless run or alternate QA route to obtain the blocked landscape
or reporter evidence. The separately denied leftover `data:error` tab cleanup was left alone. The
earlier physical Escape interruption of reporter submission also remains an incomplete check.

Remaining material checks: populated fixed landscape inventory and real-layout assertions;
reporter failure/draft/retry UI; combined desktop/mobile flows and actual touch controls;
Full/Reduced field equipment visuals and animated mechanic evidence; live WAN co-op; full
nine-mission balance; and PR16's reviewer-requested human/manual gate. The independent inventory
drawer and merged hub/cinematic layouts still need fresh visual verification. Green automated
checks or historical reviewer evidence do not clear these gates or replace independent review.

The original `sortie.css` landscape rule and production/QA isolation remain. See the inherited
[field validation limits](field-landscape-validation.md) and [predecessor update](ui-stacked-integration.md).
