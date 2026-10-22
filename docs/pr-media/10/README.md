# PR #10 enemy behavior media

Captured on October 22, 2026 from [PR #10](https://github.com/loganthorneloe/ironwake/pull/10), source commit `012f431a7a3f9951c60da431ed2245dbd49a4def` (`lesniakbj:enemy-behavior-pass`).

The screenshot montage uses the existing enemy laboratory's four specialist previews. GIFs use its live Rammer encounter, live Bellows encounter, and two-pilot combo drill with a local sparring partner. All use the implemented game simulation/rendering modules, Anime animation, Full effects, and normal gameplay speed. Camera framing and crops were adjusted for readability; the GIF header/footer captions annotate the recorded lab status. No gameplay code was changed.

- `enemy-specialists.png`: Rammer, Needle, Bellows, and Mender; the Mender is tethered to its damaged ally.
- `rammer-charge.gif`: committed charge lane, attack release, recovery, and close-range stomp.
- `bellows-artillery.gif`: artillery windup, committed ground marker, delayed shell, and repeated attack cycle.
- `team-combos.gif`: focused fire in the two-pilot drill, Cross Break reaction/stagger, and the target's defeat.

Captured frames were checked for browser errors and assembled as looping GIFs at 15 fps (normal speed). This dedicated branch hosts PR description media and is independent of the feature branch.
