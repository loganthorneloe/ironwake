# Landscape inventory follow-up — visual verification pending

Historical local validation on 2026-10-25, preserved in commit `84f590ae2137e1b4511499b77f6315dba9713881` on `feature/field-progression`. At that time this follow-up was not pushed and draft [PR #17](https://github.com/loganthorneloe/ironwake/pull/17) published `a340e65099228fc5a1c1f4b12ea2959d0d35e9bc`, targeting `loganthorneloe/ironwake:main`. See the [subsequent stacked integration](field-stacked-integration.md) for the current candidate; the visual verification below is still pending.

## Reproduction and scoped fix

Before the fix, the actual game running in the local QA iframe at **667 × 375 CSS pixels** had an open inventory containing 36 upgrade stacks and 36 salvage tech stacks. The inventory measured `clientHeight: 0`, `scrollHeight: 3718`, and computed `max-height: 0px`. Its bounds were x=23, y=210, width=138, height=0. The mobile rule `calc(100svh - 465px)` caused the collapse.

The production change is limited to the final mobile inventory rule in `dist/sortie.css`: `max-height: max(72px, calc(100svh - 465px))`. The 72px minimum is intended to keep a scrolling content area on short displays. **The changed CSS has not been visually rechecked**, and control overlap, actual readability, and scrolling after the fix remain unverified.

[Pre-fix screenshot](pr-media/field-landscape-before-full.png) records the actual game and explicit local QA controls. It is reproduction evidence only; it does not show the fix. The original PNG is 212151 bytes, SHA-256 `ab9926af1e39f9c7f5e22d574c5db412ad836263758fe8f3769a5ac8566539a1`.

## Local QA support and production isolation

- `scripts/preview-server.mjs` accepts an explicit `--field-qa` flag. Only that mode appends the fixture import to the served app and enables the feedback mock/log routes. The executable preview binds `127.0.0.1`; importing the request handler starts no server and writes no build info.
- `tests/field-browser.html` hosts the production game at exact 1280×900, 390×844, 390×667, or 667×375 iframe sizes. The separate toolbar lives outside the game frame.
- `tests/field-browser-qa.js` offers deterministic solo fixtures, input-focus diagnostics, and state/bounds inspection. It refuses world mutations in a co-op room. Completing or leaving a campaign can save fixture progression on that localhost origin; use a disposable local campaign. Disabling Safe field stops clearing threats, but reload or redeployment is needed to restore protection and director state.
- `tests/field-layout-checks.js` provides real-browser assertions for positive inventory height, scroll overflow, viewport containment, and functioning scrolling with the original position restored. These assertions are prepared, **not executed against the fixed layout**. They do not prove occlusion or visual quality.
- Four in-memory Node regressions in `tests/preview-server.test.js` check unchanged ordinary app serving, explicit mock gating, deliberate first 502 then 200, retry report ID and attachment metadata, and no `fetch` calls. Their stub attachment bytes are not browser screenshots or microphone recordings. They do not prove the reporter UI retains a draft or completes a retry.
- Wrangler deploys only `./dist`; the fixture, mock server, assertions, test files, and this evidence are outside deployed assets. Searches found no QA imports or mock hooks in `dist`, `worker`, or `wrangler.jsonc`. No production app, worker, or deployment configuration changes accompany the CSS fix.

## Final non-browser validation

- `node --test tests/*.test.js`: **327 passed, 0 failed, 0 cancelled, 0 skipped**, duration 72764.4436ms. This run includes all four preview-server tests and supersedes the earlier 325-test run.
- `node --check`: passed for `scripts/preview-server.mjs`, `tests/field-browser-qa.js`, `tests/field-layout-checks.js`, `tests/preview-server.test.js`, and the extracted inline module from `tests/field-browser.html`.
- Git whitespace checks: passed.
- Wrangler **4.151.1** `deploy --dry-run --outdir build`: passed; read 86 production asset files; worker upload 11.14 KiB / gzip 3.94 KiB. This was a dry run, not a deployment.
- Full command output remains locally in ignored `.field-landscape-final-tests.log` and `.field-landscape-final-build.log`.

## Browser blocker and remaining gaps

The latest blocked action was a native browser **Return** key intended to navigate the isolated Brave test window to `http://127.0.0.1:4203/tests/field-browser.html`. Computer Use stopped because it could not determine the current Windows browser URL with enough confidence to enforce policy. The navigation outcome is unverified. No subsequent browser action, alternate browser route, headless test, or policy workaround was attempted in this final pass.

The earlier reporter submit action was interrupted by a separate physical Escape cancellation. Its browser submission/failure/draft/retry flow remains incomplete. The fixed landscape inventory and its real-layout assertions, the remaining desktop/mobile HUD interactions, real touch input, animated mechanic evidence, live WAN co-op, and full campaign/balance playtesting remain outstanding. There is no non-browser validation blocker. No changes were pushed, merged, or deployed, and no PR replies or review-thread resolutions were made.
