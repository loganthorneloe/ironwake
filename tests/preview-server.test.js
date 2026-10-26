import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { createPreviewHandler } from '../scripts/preview-server.mjs';

async function request(handler, url, { method = 'GET', headers = {}, body } = {}) {
  const result = { status: null, headers: null, body: null, rawBody: null };
  const res = {
    writeHead(status, headers) {
      result.status = status;
      result.headers = headers;
      return this;
    },
    end(body) {
      result.rawBody = body;
      result.body = body?.toString() || '';
      return this;
    },
  };
  const req = body
    ? Object.assign(Readable.from([body]), { url, method, headers })
    : { url, method, headers };
  await handler(req, res);
  return result;
}

test('normal preview serves the unchanged production app and cannot expose QA feedback', async () => {
  const handler = createPreviewHandler(),
    app = await request(handler, '/ironwake/app.js?v=feedback-1');
  assert.equal(app.status, 200);
  assert.equal(app.body, await readFile(new URL('../dist/app.js', import.meta.url), 'utf8'));
  assert.equal((await request(handler, '/ironwake/api/feedback')).status, 404);
  assert.equal((await request(handler, '/tests/field-qa-log.json')).status, 404);
});

test('only explicit field QA enables the fixture injection and a fresh local-only mock', async () => {
  const handler = createPreviewHandler({ fieldQA: true }),
    app = await request(handler, '/ironwake/app.js?v=feedback-1');
  assert.equal(app.status, 200);
  assert.match(
    app.body,
    /installFieldBrowserQA\(\{getWorld:\(\)=>world,getLocalId:\(\)=>localId\}\)/,
  );
  const config = JSON.parse((await request(handler, '/ironwake/api/feedback')).body);
  assert.equal(config.available, true);
  assert.equal(config.mock, true);
  assert.deepEqual(JSON.parse((await request(handler, '/tests/field-qa-log.json')).body), {
    mock: true,
    publication: 'none',
    attempts: [],
  });
  const core = await request(handler, '/ironwake/core.js');
  assert.equal(core.body, await readFile(new URL('../dist/core.js', import.meta.url), 'utf8'));
});

test('preview preserves pilot WAV bytes and audio MIME type with and without field QA', async () => {
  const voice = await readFile(new URL('../dist/audio/pilot/rook/launch.wav', import.meta.url));
  for (const fieldQA of [false, true]) {
    const response = await request(
      createPreviewHandler({ fieldQA }),
      '/ironwake/audio/pilot/rook/launch.wav',
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers['Content-Type'], 'audio/wav');
    assert.deepEqual(response.rawBody, voice);
  }
});

async function multipartReport() {
  const screenshot = Buffer.from('local screenshot fixture'),
    audio = Buffer.from('local audio fixture');
  const report = {
    kind: 'suggestion',
    title: 'Keep relay timers visible',
    details: 'Show the active relay timer in the field HUD.',
    steps: 'While inspecting a long equipment inventory.',
    expected: 'The remaining duration stays easy to read.',
    actual: 'This helps compare the current build and support.',
    context: { screen: 'battle', session: 'solo', mission: { name: 'LOCAL QA' } },
  };
  const form = new FormData();
  form.set('report', JSON.stringify(report));
  form.set('screenshot', new Blob([screenshot], { type: 'image/jpeg' }), 'screenshot.jpg');
  form.set('audio', new Blob([audio], { type: 'audio/webm' }), 'voice.webm');
  const req = new Request('http://127.0.0.1/ironwake/api/feedback', {
    method: 'POST',
    headers: { 'X-Report-ID': 'local-in-memory-regression' },
    body: form,
  });
  return {
    body: Buffer.from(await req.arrayBuffer()),
    headers: Object.fromEntries(req.headers),
    report,
    screenshotBytes: screenshot.length,
    audioBytes: audio.length,
  };
}

test('normal preview rejects feedback POST without exposing a mock or using network', async (t) => {
  const network = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('This in-memory check must not use sockets.');
  });
  const payload = await multipartReport(),
    handler = createPreviewHandler();
  const result = await request(handler, '/ironwake/api/feedback', {
    method: 'POST',
    headers: payload.headers,
    body: payload.body,
  });
  assert.equal(result.status, 404);
  assert.equal((await request(handler, '/tests/field-qa-log.json')).status, 404);
  assert.equal(network.mock.callCount(), 0);
});

test('explicit local mock retains the first draft and records retry ID and attachment metadata without network', async (t) => {
  const network = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('This in-memory check must not use sockets.');
  });
  t.mock.method(console, 'log', () => {});
  const payload = await multipartReport(),
    handler = createPreviewHandler({ fieldQA: true });
  const send = () =>
    request(handler, '/ironwake/api/feedback', {
      method: 'POST',
      headers: payload.headers,
      body: payload.body,
    });
  const first = await send();
  assert.equal(first.status, 502);
  assert.match(JSON.parse(first.body).error, /draft retained/);
  const second = await send();
  assert.equal(second.status, 200);
  assert.deepEqual(JSON.parse(second.body), {
    url: 'https://github.com/loganthorneloe/ironwake/issues/0',
    mock: true,
    message: 'LOCAL QA MOCK: issue 0 is a placeholder; nothing was published.',
  });
  const log = JSON.parse((await request(handler, '/tests/field-qa-log.json')).body);
  assert.equal(log.publication, 'none');
  assert.equal(log.attempts.length, 2);
  for (const [index, attempt] of log.attempts.entries())
    assert.deepEqual(attempt, {
      attempt: index + 1,
      id: 'local-in-memory-regression',
      kind: payload.report.kind,
      context: payload.report.context,
      screenshotBytes: payload.screenshotBytes,
      audioBytes: payload.audioBytes,
      requestBytes: payload.body.length,
    });
  assert.equal(network.mock.callCount(), 0);
});
