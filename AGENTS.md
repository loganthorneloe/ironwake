# IRONWAKE project instructions

## Parallel development

- Start new workstreams from canonical `main` in separate worktrees. Identify the subsystem and expected files before changing shared composition code.
- Keep equipment definitions in `dist/catalog/`, pure build logic in `dist/builds/`, combat behavior in `dist/simulation/`, mission content/layouts in `dist/missions/`, and browser controllers in `dist/app/`.
- Preserve the public exports of `dist/core.js` and `dist/mission-catalog.js`; these are compatibility/composition boundaries. Implement new behavior in focused modules.
- Catalog/build modules must not import the core facade, application code, or simulation runtime. Preserve existing query suffixes for shared browser module state.
- Run `npm run format`, `npm run architecture:check`, relevant tests, and the build before review. Do not hand-compact first-party source or mix broad formatting with feature work after this migration.
- See `docs/parallel-development.md` for ownership examples, integration checks, and the proposed approval/merge-queue workflow. Do not change review policies or branch protection as part of ordinary feature work.

## Pull requests

- The canonical repository is `loganthorneloe/ironwake`.
- Always open pull requests against the `main` branch of `loganthorneloe/ironwake`, unless the user explicitly requests a different destination for that PR.
- Specify the destination explicitly: GitHub CLI `--repo loganthorneloe/ironwake --base main`, or connector `repository_full_name: "loganthorneloe/ironwake"` and `base: "main"`.
- Verify the created PR's base repository and branch before reporting completion. Do not infer its destination from `origin` or the branch the work started from.
- Include screenshots and/or animated GIFs in each PR where appropriate to showcase new or changed mechanics. Use screenshots for visual changes and GIFs for movement, animation, combat, and other behavior over time. Capture the implemented game, embed the media in the PR description with brief captions, and show the mechanic clearly; use before/after comparisons when helpful.
