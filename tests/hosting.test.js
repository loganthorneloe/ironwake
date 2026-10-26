import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
const origin = 'https://thorneloe.ai';
test('bare game path redirects with room invite intact', async () => {
  const response = await worker.fetch(new Request(origin + '/ironwake?room=ABCDEF'), {});
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('Location'), origin + '/ironwake/?room=ABCDEF');
});
test('game assets are fetched under subpath and receive safe content headers', async () => {
  for (const [path, expected] of [
    ['/ironwake/', '/index.html'],
    ['/ironwake/app.js?v=41', '/app.js'],
  ]) {
    const response = await worker.fetch(new Request(origin + path), {
      ASSETS: {
        fetch: async (req) => {
          assert.equal(new URL(req.url).pathname, expected);
          return new Response('asset', { headers: { 'Content-Type': 'text/javascript' } });
        },
      },
    });
    assert.equal(await response.text(), 'asset');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  }
});
test('asset uploads are not accepted', async () => {
  assert.equal(
    (await worker.fetch(new Request(origin + '/ironwake/app.js', { method: 'POST' }), {})).status,
    405,
  );
});
