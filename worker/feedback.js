import {
  REPORT_REPO,
  MAX_SCREENSHOT,
  MAX_AUDIO,
  MAX_REQUEST,
  AUDIO_TYPES,
  REPORT_FIELDS,
  validateReport,
} from '../dist/feedback-schema.js';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function json(value, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
export async function feedbackRoute(request, env) {
  const url = new URL(request.url),
    path = url.pathname;
  if (path.startsWith('/ironwake/api/feedback/media/')) return media(request, env);
  if (path !== '/ironwake/api/feedback') return json({ error: 'Not found.' }, 404);
  if (request.method === 'GET')
    return json({
      available: !!(
        env.GITHUB_FEEDBACK_TOKEN &&
        env.FEEDBACK_MEDIA &&
        env.FEEDBACK_REPORTS &&
        env.FEEDBACK_RATE_LIMIT
      ),
    });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (request.headers.get('Origin') !== url.origin)
    return json({ error: 'Submit reports from the game.' }, 403);
  if (
    !env.GITHUB_FEEDBACK_TOKEN ||
    !env.FEEDBACK_MEDIA ||
    !env.FEEDBACK_REPORTS ||
    !env.FEEDBACK_RATE_LIMIT
  )
    return json(
      { error: 'Direct reporting is not configured on this server yet. Your draft is still here.' },
      503,
    );
  if (!/^multipart\/form-data;/.test(request.headers.get('Content-Type') || ''))
    return json({ error: 'Expected a report with attachments.' }, 415);
  const id = request.headers.get('X-Report-ID');
  if (!uuid.test(id || '')) return json({ error: 'Invalid report ID.' }, 400);
  if (Number(request.headers.get('Content-Length')) > MAX_REQUEST)
    return json({ error: 'Report attachments are too large.' }, 413);
  const allowed = await env.FEEDBACK_RATE_LIMIT.limit({
    key: request.headers.get('CF-Connecting-IP') || 'local',
  });
  if (!allowed.success)
    return json({ error: 'Too many reports. Wait one minute and try again.' }, 429);
  return env.FEEDBACK_REPORTS.get(env.FEEDBACK_REPORTS.idFromName(id)).fetch(request);
}
async function media(request, env) {
  if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
  const key = new URL(request.url).pathname.slice('/ironwake/api/feedback/media/'.length);
  if (
    !new RegExp(
      `^${uuid.source.slice(1, -1)}/(screenshot\\.jpg|voice\\.(webm|ogg|m4a))$`,
      'i',
    ).test(key)
  )
    return json({ error: 'Not found.' }, 404);
  const object = await env.FEEDBACK_MEDIA?.get(key);
  if (!object) return json({ error: 'Attachment not found.' }, 404);
  const type = key.endsWith('.jpg')
    ? 'image/jpeg'
    : key.endsWith('.m4a')
      ? 'audio/mp4'
      : key.endsWith('.ogg')
        ? 'audio/ogg'
        : 'audio/webm';
  return new Response(request.method === 'HEAD' ? null : object.body, {
    headers: {
      'Content-Type': type,
      'Content-Length': String(object.size),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'public, max-age=86400',
      'Content-Disposition': `inline; filename="${key.split('/')[1]}"`,
    },
  });
}
async function boundedBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Empty report.');
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_REQUEST) {
      await reader.cancel();
      throw new Error('Report attachments are too large.');
    }
    chunks.push(value);
  }
  return new Response(new Blob(chunks), {
    headers: { 'Content-Type': request.headers.get('Content-Type') },
  }).formData();
}
function safeText(value) {
  return String(value)
    .replace(/@/g, '＠')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, 'ˋ');
}
export function issueBody(report, links, id) {
  const sections = REPORT_FIELDS[report.kind].map(
    ([key, label]) => `### ${label}\n${safeText(report[key] || 'Covered in the voice recording.')}`,
  );
  return [
    `Submitted from IRONWAKE · **${report.kind === 'bug' ? 'Bug report' : 'Suggestion'}**`,
    ...sections,
    `### Frequency / impact\n${safeText(report.frequency || 'Not specified')} · ${safeText(report.severity || 'Not specified')}`,
    links.screenshot
      ? `### Automatic screenshot\n![Game at report time](${links.screenshot})`
      : '### Automatic screenshot\nCapture unavailable; see game context.',
    links.audio ? `### Voice report\n[Listen to the recording](${links.audio})` : '',
    `<details><summary>Game context</summary>\n\n\`\`\`json\n${safeText(JSON.stringify(report.context, null, 2))}\n\`\`\`\n</details>`,
    `<!-- ironwake-report:${id} -->`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
// One Durable Object per report serializes retries and records the GitHub outcome.
// Persisting "posting" before the API call prevents duplicate issues after an ambiguous timeout/restart.
export class FeedbackReport {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.pending = null;
  }
  async fetch(request) {
    if (this.pending) return this.pending.then((response) => response.clone());
    this.pending = this.submit(request).catch(() =>
      json({ error: 'Reporting is temporarily unavailable. Your draft is still here.' }, 503),
    );
    try {
      return (await this.pending).clone();
    } finally {
      this.pending = null;
    }
  }
  async submit(request) {
    const previous = await this.ctx.storage.get('result');
    if (previous?.url) return json(previous);
    if (previous?.posting)
      return json(
        {
          uncertain: true,
          error:
            'GitHub may have received this report. Check the repository issues before creating another report.',
        },
        409,
      );
    let data, report, screenshot, audio;
    try {
      data = await boundedBody(request);
      screenshot = data.get('screenshot');
      audio = data.get('audio');
      if (
        screenshot &&
        (!(screenshot instanceof File) ||
          screenshot.type !== 'image/jpeg' ||
          screenshot.size > MAX_SCREENSHOT ||
          !screenshot.size)
      )
        throw new Error('Invalid screenshot.');
      if (
        audio &&
        (!(audio instanceof File) ||
          !Object.hasOwn(AUDIO_TYPES, audio.type.split(';')[0]) ||
          audio.size > MAX_AUDIO ||
          !audio.size)
      )
        throw new Error('Invalid voice recording.');
      report = validateReport(JSON.parse(data.get('report')), !!audio);
      if (screenshot) {
        const bytes = new Uint8Array(await screenshot.slice(0, 3).arrayBuffer());
        if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255)
          throw new Error('Invalid screenshot.');
      }
    } catch (error) {
      return json({ error: error.message || 'Invalid report.' }, 400);
    }
    const id = request.headers.get('X-Report-ID'),
      base = new URL('/ironwake/api/feedback/media/', request.url).href,
      links = {};
    for (const [file, name, field] of [
      [screenshot, 'screenshot.jpg', 'screenshot'],
      [audio, `voice.${AUDIO_TYPES[audio?.type.split(';')[0]]}`, 'audio'],
    ]) {
      if (!file) continue;
      await this.env.FEEDBACK_MEDIA.put(`${id}/${name}`, file.stream(), {
        httpMetadata: { contentType: file.type },
      });
      links[field] = base + id + '/' + name;
    }
    await this.ctx.storage.put('result', { posting: true });
    let response;
    try {
      response = await fetch(`https://api.github.com/repos/${REPORT_REPO}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.env.GITHUB_FEEDBACK_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'IRONWAKE-feedback',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `[${report.kind === 'bug' ? 'Bug' : 'Suggestion'}] ${safeText(report.title)}`,
          body: issueBody(report, links, id),
        }),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      return json(
        {
          uncertain: true,
          error:
            'GitHub did not confirm receipt. Check the repository issues before creating another report.',
        },
        409,
      );
    }
    if (!response.ok) {
      // 5xx can be ambiguous; explicit 4xx failures are safe to retry after configuration/rate recovery.
      if (response.status < 500) await this.ctx.storage.delete('result');
      return json(
        {
          uncertain: response.status >= 500,
          error: 'GitHub could not confirm this report. Your draft is still here.',
        },
        502,
      );
    }
    let issue;
    try {
      issue = await response.json();
    } catch {
      return json(
        {
          uncertain: true,
          error: 'GitHub returned an unreadable receipt. Check the repository issues.',
        },
        409,
      );
    }
    if (!new RegExp(`^https://github.com/${REPORT_REPO}/issues/[0-9]+$`).test(issue.html_url))
      return json(
        {
          uncertain: true,
          error: 'GitHub returned an unexpected receipt. Check the repository issues.',
        },
        409,
      );
    const result = { url: issue.html_url };
    await this.ctx.storage.put('result', result);
    return json(result);
  }
}
