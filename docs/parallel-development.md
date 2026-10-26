# Parallel development without shared-file bottlenecks

IRONWAKE regularly has five to ten feature branches in flight. The main source of avoidable conflicts
was unrelated features editing the same compressed lines in `dist/core.js`, `dist/app.js`, and mission
catalogs. This integration expands first-party JavaScript into a consistent format and starts moving
independent responsibilities into modules that can be edited separately. This is a migration boundary,
not a requirement to move every existing system in one PR.

## Where new code belongs

| Area                         | Responsibility                                        | Typical workstream                     |
| ---------------------------- | ----------------------------------------------------- | -------------------------------------- |
| `dist/catalog/`              | Equipment definitions and balance values              | New weapon or frame tuning             |
| `dist/builds/`               | Build normalization, validation and derived stats     | Workshop loadouts                      |
| `dist/missions/definitions/` | One authored mission per file                         | New mission content                    |
| `dist/missions/layouts/`     | Independent arena layout definitions                  | Terrain and cover                      |
| `dist/missions/`             | Mission generation, lookup and tuning                 | Objective pacing                       |
| `dist/simulation/`           | Authoritative world state and simulation behavior     | Combat rules                           |
| `dist/app/`                  | Browser controllers, DOM helpers and HUD presentation | Interface work                         |
| `dist/network/protocol.js`   | Shared room compatibility namespaces                  | Incompatible wire-format changes       |
| Existing focused modules     | Their existing subsystem                              | Enemy behavior, career, effects, audio |

Keep dependencies flowing from presentation to simulation to definitions and pure build logic.
Catalogs and build calculations must not import `dist/core.js`, `dist/app.js`, or the `dist/app/` and
`dist/simulation/` directories. Existing pure leaves such as `chassis.js` and `part-designs.js` remain
valid dependencies while migration continues. The architecture check follows dependencies through
legacy leaves, enforces these runtime import restrictions, and rejects module cycles involving the
five extracted directories. It leaves cycles entirely within legacy modules outside that incremental
boundary; it does not claim that every legacy dependency is already layered.

`dist/core.js`, `dist/app.js`, and `dist/mission-catalog.js` are compatibility/composition boundaries.
Prefer importing the focused implementation from new modules. Existing consumers can keep using the
old public exports while they migrate. Add domain behavior inside its module rather than growing the
compatibility file. Composition files should connect systems, not contain their implementation.

When a change introduces a distinct responsibility, make a focused file with a descriptive export.
Keep tests beside the existing subsystem tests or give the new module its own test file. For example,
a new combat rule and a new HUD feature should not both require editing one general helper file.
Avoid replacing a large file with a central list that every feature must update: use existing module
discovery where available, or let the owning subsystem compose its own definitions. Keep required
central registration edits small and explicit.

## A practical routine for five to ten streams

1. Start each stream from current canonical `main` in a separate Git worktree. Give the stream a
   primary subsystem, specific files, and its own regression tests in its task description.
2. Before implementation, compare the stream's expected file list with the other open PRs. If two
   streams both need a shared implementation, extract that boundary first in a small prerequisite PR
   or agree on the shared interface and one owner for its composition change.
3. Put independent content in separate files. Keep mission definitions, HUD components, and combat
   helpers out of unrelated feature diffs. A balance-only PR should not reformat an entire subsystem.
4. Run the formatter and checks before requesting review. Integrate current `main` before that review
   when needed, and resolve overlapping behavior deliberately. Keep feature work and broad cleanup in
   separate commits so reviewers can assess the behavior change.
5. Once approved, merge through the repository's configured process. Use the proposed merge queue
   below if it is enabled. A real conflict or behavior change still needs resolution and appropriate
   review; automatic conflict suppression would hide unreviewed changes.

This initial formatting migration will conflict with branches based on the compressed source. Land it
as one coordinated boundary and update any streams started before it once. Start subsequent streams
from that result. Avoid repeatedly reformatting branches or making another repository-wide style pass.

Example assignment of independent ownership:

| Stream             | Primary implementation                                 | Own verification                |
| ------------------ | ------------------------------------------------------ | ------------------------------- |
| Weapon tuning      | Weapon catalog module and focused combat helpers       | Weapon role/balance tests       |
| Mission content    | One file under `missions/definitions/` and its layout  | Mission generation tests        |
| Combat rule        | A focused `simulation/` module                         | Deterministic simulation tests  |
| HUD interaction    | A focused `app/` controller                            | HUD test and browser capture    |
| Enemy tactics      | Existing `enemy-behaviors.js` or a new behavior module | Enemy behavior tests            |
| Career progression | Existing `career-progression.js`                       | Career/save migration tests     |
| Visual effect      | Existing focused effect module                         | Implemented-game screenshot/GIF |
| Audio feedback     | Existing focused audio/event module                    | Event tests and browser check   |

These are coordination boundaries, not GitHub CODEOWNERS assignments. When a stream crosses a
boundary, agree on the interface rather than silently editing another stream's shared file.

## Local and CI checks

```sh
npm ci
npm run format:check
npm run architecture:check
npm test
npm run build
```

Use `npm run format` to apply the pinned Prettier version before review. Formatting expands multiple
statements into separate lines and provides consistent wrapping, so changes to different statements
are less likely to overlap. `.gitattributes` keeps text line endings at LF across Windows and CI.
Vendor code, generated build output, audio assets, and browser test HTML harnesses are excluded from
the formatting pass. Package lockfiles remain managed by npm. No merge driver silently chooses one
branch or combines source lines without conflict detection.

The architecture checker recursively parses first-party JavaScript under `dist/`, `worker/`,
`scripts/`, and `tests/`. It checks relative imports, re-exports, and dynamic imports with a literal
string target, including nested directories. Browser query strings and fragments are removed before
checking that the target exists. Nonliteral dynamic imports and external package/URL imports are
outside this static check. It checks dependency direction for pure catalogs/builds and cycles among
the extracted architecture modules. Keep Linux CI enabled so case-sensitive import paths are also
verified on that filesystem.

Run `node scripts/check-architecture.mjs --report` to see first-party browser modules with the most
lines and direct importers. This identifies candidates for the next focused extraction; it measures
size and dependency fan-in, not actual merge conflicts. Prioritize files shared by current workstreams
over arbitrary file-length targets. As runtime code moves out of compatibility files, extend the
enforced boundary instead of adding dependencies back through those files.

## Measured merge examples

On 2026-10-25, an isolated Git experiment used the actual pre-refactor files from integrated commit
`a9652ef3fde6e46946f583c1ed6d67c1cd721c68` and their extracted replacements. Git version was
`2.53.0.windows.3`. Each example created a common parent and two child commits in a separate bare
repository with its own temporary index under ignored `.openai/`. The command
`git merge-tree --write-tree --name-only <left-commit> <right-commit>` merged those children without
changing the project branch, project index, or working source files.

| Two concurrent edits from the same starting content     | Original source                                                    | Extracted/expanded source                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| Ashgate `kills: 28 → 29`; Glasswater `kills: 16 → 17`   | Adjacent mission entries in `mission-catalog.js`: conflict, exit 1 | Separate mission definition files: clean, exit 0                |
| Scout `hp: 90 → 91`; Bulwark `hp: 175 → 176`            | Both frame entries on one line in `core.js`: conflict, exit 1      | Separate expanded entries in `catalog/frames.js`: clean, exit 0 |
| Control: Scout `hp: 90 → 91` versus Scout `hp: 90 → 92` | Not needed for this control                                        | Same property in `catalog/frames.js`: conflict, exit 1          |

Both edits were verified in each clean merged tree. These are two concrete examples of independent
changes becoming mergeable; they are not an estimated project conflict rate. The control confirms
that incompatible edits still require a person to resolve them.

## Approval retention and the proposed merge queue

Code structure reduces overlapping edits; it cannot guarantee that GitHub retains approval after
updates. GitHub's review settings control that behavior. Stale approval dismissal can be triggered by
changes to the reviewed diff or merge base. Requiring approval of the latest reviewable push is also
a distinct policy choice. See [GitHub's protected branch documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

For this volume of concurrent PRs, propose a merge queue for canonical `main`: approve a focused PR,
enqueue it, and let CI test it with current `main` and earlier queued changes. GitHub describes this as
providing up-to-date integration checks without requiring the author to update the PR branch first.
This targets the repeated branch-update part of the approval cycle. See [GitHub's merge queue documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue).

Before enabling the queue, the repository owner should confirm availability, choose the queue and
review policy, and require the existing test/build and new formatting/architecture checks. Actions
must also run on `merge_group` with `types: [checks_requested]`; otherwise queued integrations do not
receive the required checks. Keep required check names stable across PR and queue runs.

This change prepares code and CI only. It does not enable a merge queue, change branch protection,
change required reviewers, dismiss reviews, or merge existing PRs into canonical `main`. Those are
repository policy decisions. A queue complements module boundaries and tests; it does not resolve a
real conflict between two implementations of the same behavior.
