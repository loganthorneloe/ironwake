import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeBuildInfo } from '../scripts/build-info.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'ironwake-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'package.json'), JSON.stringify({ version: '1.2.3' }));
  return root;
}

test('local builds increment on disk and read the current package version', async (t) => {
  const root = await fixture(t),
    now = new Date('2026-10-22T12:00:00Z');
  const first = await writeBuildInfo({ root, env: {}, now });
  assert.equal(first.label, 'v1.2.3 · local.1 · source unknown');
  assert.equal(first.builtAt, now.toISOString());
  await writeFile(join(root, 'package.json'), JSON.stringify({ version: '1.2.4' }));
  const second = await writeBuildInfo({ root, env: {}, now });
  assert.equal(second.build, 'local.2');
  assert.equal(second.version, '1.2.4');
  assert.deepEqual(JSON.parse(await readFile(join(root, 'dist/build-info.json'), 'utf8')), second);
});

test('GitHub builds use the Actions run, attempt and exact source SHA without changing local counters', async (t) => {
  const root = await fixture(t),
    env = {
      GITHUB_ACTIONS: 'true',
      GITHUB_RUN_NUMBER: '42',
      GITHUB_RUN_ATTEMPT: '1',
      GITHUB_SHA: '1234567890abcdef',
    };
  assert.equal((await writeBuildInfo({ root, env })).label, 'v1.2.3 · github.42.1 · 1234567');
  const retry = await writeBuildInfo({ root, env: { ...env, GITHUB_RUN_ATTEMPT: '2' } });
  assert.equal(retry.build, 'github.42.2');
  assert.equal(retry.revision, env.GITHUB_SHA);
  assert.equal((await writeBuildInfo({ root, env: {} })).build, 'local.1');
});

test('invalid counters or incomplete GitHub context fail instead of reusing a build identity', async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, '.local-build-number'), 'broken');
  await assert.rejects(writeBuildInfo({ root, env: {} }), /Invalid .local-build-number/);
  await assert.rejects(
    writeBuildInfo({ root, env: { GITHUB_ACTIONS: 'true' } }),
    /GITHUB_RUN_NUMBER/,
  );
  await assert.rejects(
    writeBuildInfo({
      root,
      env: { GITHUB_ACTIONS: 'true', GITHUB_RUN_NUMBER: '4', GITHUB_RUN_ATTEMPT: '0' },
    }),
    /GITHUB_RUN_ATTEMPT/,
  );
});
