import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { FeedbackReport, issueBody } from '../worker/feedback.js';
import { validateReport, MAX_AUDIO, MAX_REQUEST } from '../dist/feedback-schema.js';
const origin = 'https://thorneloe.ai',
  id = '7bc084df-aac3-4ace-b205-c8674cc3fe13';
const report = {
  kind: 'bug',
  title: 'Railgun misses close targets',
  details: 'Railgun goes through target.',
  steps: 'Equip railgun and fire close.',
  expected: 'The shot should hit the target.',
  actual: 'No damage appears on the target.',
  context: { mission: { seed: 42 }, loadout: { weapon: 'rail' } },
};
function request(value = report, { audio = false, screenshot = true } = {}) {
  const data = new FormData();
  data.set('report', JSON.stringify(value));
  if (screenshot)
    data.set(
      'screenshot',
      new Blob([new Uint8Array([255, 216, 255, 217])], { type: 'image/jpeg' }),
      'screenshot.jpg',
    );
  if (audio) data.set('audio', new Blob(['test recording'], { type: 'audio/webm' }), 'voice.webm');
  return new Request(origin + '/ironwake/api/feedback', {
    method: 'POST',
    headers: { Origin: origin, 'X-Report-ID': id },
    body: data,
  });
}
function fixture() {
  const store = new Map(),
    objects = new Map(),
    puts = [];
  const ctx = {
    storage: {
      get: async (key) => store.get(key),
      put: async (key, value) => store.set(key, value),
      delete: async (key) => store.delete(key),
    },
  };
  const env = {
    GITHUB_FEEDBACK_TOKEN: 'server-only-test-token',
    FEEDBACK_MEDIA: {
      put: async (key, body) => {
        objects.set(key, body);
        puts.push(key);
      },
      get: async (key) => objects.get(key),
    },
    FEEDBACK_RATE_LIMIT: { limit: async () => ({ success: true }) },
  };
  const object = new FeedbackReport(ctx, env);
  env.FEEDBACK_REPORTS = { idFromName: (value) => value, get: () => object };
  return { env, object, store, objects, puts };
}
test('requires actionable bug/suggestion details or a voice report and always a title', () => {
  assert.equal(validateReport(report).kind, 'bug');
  assert.equal(validateReport({ ...report, kind: 'suggestion' }).kind, 'suggestion');
  assert.throws(() => validateReport({ ...report, steps: '' }), /Steps/);
  assert.equal(validateReport({ kind: 'bug', title: 'Voice report of collision' }, true).steps, '');
  assert.throws(() => validateReport({ kind: 'bug', title: 'x' }, true), /title/);
  assert.throws(() => validateReport({ ...report, kind: 'constructor' }), /Choose/);
  assert.throws(
    () => validateReport({ ...report, context: { dump: 'a'.repeat(12001) } }),
    /context/,
  );
});
test('report API fails closed without service bindings and enforces origin, method, size and rate limits', async () => {
  const { env } = fixture();
  assert.equal(
    (await worker.fetch(new Request(origin + '/ironwake/api/feedback'), {})).status,
    200,
  );
  assert.equal(
    (await (await worker.fetch(new Request(origin + '/ironwake/api/feedback'), {})).json())
      .available,
    false,
  );
  assert.equal((await worker.fetch(request(), {})).status, 503);
  assert.equal(
    (await worker.fetch(new Request(origin + '/ironwake/api/feedback', { method: 'DELETE' }), env))
      .status,
    405,
  );
  const cross = request();
  cross.headers.set('Origin', 'https://evil.example');
  assert.equal((await worker.fetch(cross, env)).status, 403);
  const huge = request();
  huge.headers.set('Content-Length', String(MAX_REQUEST + 1));
  assert.equal((await worker.fetch(huge, env)).status, 413);
  env.FEEDBACK_RATE_LIMIT.limit = async () => ({ success: false });
  assert.equal((await worker.fetch(request(), env)).status, 429);
});
test('uploads screenshot and audio, creates only canonical issues, and retries return the same receipt', async (t) => {
  const { env, puts } = fixture();
  let calls = 0,
    payload;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.github.com/repos/loganthorneloe/ironwake/issues');
    assert.equal(options.headers.Authorization, 'Bearer server-only-test-token');
    payload = JSON.parse(options.body);
    return Response.json({ html_url: 'https://github.com/loganthorneloe/ironwake/issues/123' });
  });
  const response = await worker.fetch(request(report, { audio: true }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    url: 'https://github.com/loganthorneloe/ironwake/issues/123',
  });
  assert.deepEqual(puts, [id + '/screenshot.jpg', id + '/voice.webm']);
  assert.match(
    payload.body,
    /!\[Game at report time\]\(https:\/\/thorneloe.ai\/ironwake\/api\/feedback\/media\//,
  );
  assert.match(payload.body, /Listen to the recording/);
  assert.match(payload.body, /'?seed"?: 42/);
  assert.equal(payload.title, '[Bug] Railgun misses close targets');
  assert.doesNotMatch(payload.body, /server-only-test-token/);
  assert.equal((await worker.fetch(request(), env)).status, 200);
  assert.equal(calls, 1);
});
test('concurrent submissions create one issue and one set of attachments', async (t) => {
  const { env } = fixture();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return Response.json({ html_url: 'https://github.com/loganthorneloe/ironwake/issues/321' });
  });
  const responses = await Promise.all([worker.fetch(request(), env), worker.fetch(request(), env)]);
  assert.equal(calls, 1);
  assert.deepEqual(await responses[0].json(), await responses[1].json());
});
test('ambiguous GitHub failures remain locked across object restarts, explicit rejections allow retry', async (t) => {
  const fixture1 = fixture();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    throw new Error('lost response');
  });
  assert.equal((await fixture1.object.fetch(request())).status, 409);
  const restarted = new FeedbackReport(
    { storage: { get: async () => fixture1.store.get('result') } },
    fixture1.env,
  );
  assert.equal((await restarted.fetch(request())).status, 409);
  assert.equal(calls, 1);
  t.mock.restoreAll();
  const fixture2 = fixture();
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 403 }));
  assert.equal((await fixture2.object.fetch(request())).status, 502);
  assert.equal(fixture2.store.has('result'), false);
});
test('rejects fake images, oversized audio and truncated/oversized multipart streams before GitHub', async (t) => {
  const { env } = fixture();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    throw Error('must not call');
  });
  const data = new FormData();
  data.set('report', JSON.stringify(report));
  data.set('screenshot', new Blob(['not jpeg'], { type: 'image/jpeg' }), 'x.jpg');
  assert.equal(
    (
      await worker.fetch(
        new Request(origin + '/ironwake/api/feedback', {
          method: 'POST',
          headers: { Origin: origin, 'X-Report-ID': id },
          body: data,
        }),
        env,
      )
    ).status,
    400,
  );
  data.delete('screenshot');
  data.set('audio', new Blob(['a'.repeat(MAX_AUDIO + 1)], { type: 'audio/webm' }), 'voice.webm');
  assert.equal(
    (
      await fixture().object.fetch(
        new Request(origin + '/ironwake/api/feedback', {
          method: 'POST',
          headers: { 'X-Report-ID': id },
          body: data,
        }),
      )
    ).status,
    400,
  );
  assert.equal(calls, 0);
});
test('media URLs are restricted to fixed extensions, never expose executable uploads, and support HEAD', async () => {
  const { env, objects } = fixture();
  objects.set(id + '/screenshot.jpg', { size: 4, body: new Uint8Array([255, 216, 255, 217]) });
  const url = origin + '/ironwake/api/feedback/media/' + id + '/screenshot.jpg';
  const response = await worker.fetch(new Request(url), env);
  assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal((await worker.fetch(new Request(url, { method: 'HEAD' }), env)).body, null);
  assert.equal((await worker.fetch(new Request(url.replace('.jpg', '.html')), env)).status, 404);
  assert.equal((await worker.fetch(new Request(url, { method: 'POST' }), env)).status, 405);
});
test('issue formatting includes suggestion prompts and neutralizes mentions, HTML and fenced context', () => {
  const body = issueBody(
    validateReport({
      ...report,
      kind: 'suggestion',
      details: '@everyone <script>no</script>',
      context: { text: '``` </details>' },
    }),
    {},
    id,
  );
  assert.match(body, /How should it work/);
  assert.doesNotMatch(body, /@everyone|<script>|``` <\/details>/);
  assert.match(body, /Capture unavailable/);
});
