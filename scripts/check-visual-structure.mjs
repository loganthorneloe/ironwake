// CPU/scene-structure evidence, never an FPS or GPU benchmark. No browser is launched.
import { execFileSync } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import * as T from '../dist/vendor/three.module.min.js';
import { buildRoundScene } from '../dist/round-scene.js';
import { MISSIONS, campaignRound } from '../dist/mission-catalog.js';
import { createGroundContact } from '../dist/ground-contact.js';
import { createAmbientAir } from '../dist/ambient-air.js';
import { visualBudget } from '../dist/visual-quality.js';
import { clearSpace } from '../dist/space-scene.js';

const root = resolve(import.meta.dirname, '..'),
  baseline = process.env.VISUAL_BASELINE || '5492bdb286ce48b45fc6e66be3e50abc1482ccce',
  source = execFileSync('git', ['show', `${baseline}:dist/round-scene.js`], {
    cwd: root,
    encoding: 'utf8',
  }),
  vendor = pathToFileURL(resolve(root, 'dist/vendor/three.module.min.js')).href,
  old = await import(
    'data:text/javascript;base64,' +
      Buffer.from(
        source.replace("'./vendor/three.module.min.js'", JSON.stringify(vendor)),
      ).toString('base64')
  );
function structure(build, m) {
  const parent = new T.Group(),
    colliders = [];
  build(parent, m, colliders);
  let meshes = 0,
    instances = 0,
    triangles = 0,
    shadowCandidates = 0;
  parent.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const count = o.isInstancedMesh ? o.count : 1;
    if (!count) return;
    meshes++;
    instances += count;
    triangles += ((o.geometry.index?.count || o.geometry.attributes.position.count) / 3) * count;
    if (o.castShadow) shadowCandidates++;
  });
  clearSpace(parent);
  return { meshes, instances, triangles, shadowCandidates, colliders: colliders.length };
}
function cpu(budget, reduced) {
  const parent = new T.Group(),
    contact = createGroundContact(parent, budget),
    air = createAmbientAir(parent, budget),
    w = {
      time: 0,
      mission: campaignRound('ashgate'),
      players: Array.from({ length: 4 }, (_, i) => ({
        id: 'p' + i,
        x: 1200 + i * 60,
        y: 1700,
        hp: 100,
        altitude: 0,
        r: 22,
      })),
      enemies: Array.from({ length: 48 }, (_, i) => ({
        id: i,
        x: 1000 + (i % 8) * 60,
        y: 1300 + Math.floor(i / 8) * 55,
        hp: 100,
        r: 18,
      })),
      effects: [],
    },
    durations = [];
  for (let i = 0; i < 660; i++) {
    w.time = i / 60;
    w.effects = Array.from({ length: 18 }, (_, j) => ({
      id: Math.floor(i / 30) * 18 + j,
      kind: 'explosion',
      x: 1000 + j * 30,
      y: 1700,
      z: 0,
      r: 80,
    }));
    const start = performance.now();
    contact.update(w, reduced);
    air.update(w.time, 120, 170, reduced);
    if (i >= 60) durations.push(performance.now() - start);
  }
  durations.sort((a, b) => a - b);
  const result = {
    tier: budget.tier,
    reduced,
    samples: durations.length,
    p50Ms: durations[300],
    p95Ms: durations[570],
    shadowTexels: budget.shadowSize ** 2,
    maxMotes: reduced ? 0 : budget.motes,
    surfaces: contact.stats(),
  };
  contact.dispose();
  air.dispose();
  return result;
}
const evidence = {
  kind: 'Node CPU and scene structure; no GPU rendering, culling, FPS or visual acceptance',
  recordedAt: new Date().toISOString(),
  baseline,
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  arenas: MISSIONS.map((spec) => ({
    id: spec.id,
    before: structure(old.buildRoundScene, campaignRound(spec.id)),
    after: structure(buildRoundScene, campaignRound(spec.id)),
  })),
  surfaceCpu: [
    cpu(visualBudget(), false),
    cpu(visualBudget(), true),
    cpu(visualBudget({ coarse: true }), false),
    cpu(visualBudget({ coarse: true }), true),
  ],
};
await mkdir(resolve(root, '.openai/visual-pass'), { recursive: true });
await writeFile(
  resolve(root, '.openai/visual-pass/structure.json'),
  JSON.stringify(evidence, null, 2) + '\n',
);
console.log(JSON.stringify(evidence, null, 2));
