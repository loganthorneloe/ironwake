// Chrome regression for selectable pilot voices, compact menus and canonical reporting.
// PILOT_STATIC=1 serves real public assets (including WAVs) through browser routes.
// PLAYWRIGHT_MODULE may point to an externally installed Playwright module. No reports are sent.
import assert from 'node:assert/strict';
import { mkdir, readFile, realpath } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, relative, isAbsolute, sep, extname } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, '.openai/pilot-feedback');
await mkdir(output, { recursive: true });
const staticMode = process.env.PILOT_STATIC === '1' || process.env.UI_UX_STATIC === '1';
const base =
  process.env.PILOT_BASE_URL ||
  (staticMode ? 'https://ironwake.test/ironwake/' : 'http://127.0.0.1:4296/ironwake/');
const publicRoot = await realpath(resolve(root, 'dist')),
  origin = new URL(base).origin;
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};
let server, browser;
if (!staticMode && !process.env.PILOT_BASE_URL) {
  server = spawn(
    process.execPath,
    [fileURLToPath(new URL('./preview-server.mjs', import.meta.url)), '4296'],
    { cwd: root, windowsHide: true },
  );
  await new Promise((done, reject) => {
    server.stdout.on('data', (data) => {
      if (String(data).includes('preview:')) done();
    });
    server.once('error', reject);
    server.once('exit', (code) => reject(Error('Preview exited: ' + code)));
  });
}
async function serveStatic(route) {
  const request = route.request(),
    url = new URL(request.url());
  if (url.origin !== origin || request.method() !== 'GET') return route.abort('blockedbyclient');
  try {
    const path = decodeURIComponent(url.pathname),
      prefix = path.startsWith('/ironwake/')
        ? '/ironwake/'
        : path.startsWith('/dist/')
          ? '/dist/'
          : null;
    if (!prefix || path.includes('\\')) return route.fulfill({ status: 404, body: 'Not found' });
    let assetPath = path.slice(prefix.length);
    if (!assetPath || assetPath.endsWith('/')) assetPath += 'index.html';
    const file = await realpath(resolve(publicRoot, assetPath)),
      within = relative(publicRoot, file);
    if (within === '..' || within.startsWith('..' + sep) || isAbsolute(within))
      return route.fulfill({ status: 403, body: 'Forbidden' });
    const contentType = mime[extname(file).toLowerCase()];
    if (!contentType) return route.fulfill({ status: 404, body: 'Not found' });
    return route.fulfill({
      body: await readFile(file),
      contentType,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return route.fulfill({ status: 404, body: 'Not found' });
  }
}
try {
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  if (staticMode) await ctx.route('**/*', serveStatic);
  let submissions = 0;
  await ctx.route('**/api/feedback', async (route) => {
    if (route.request().method() !== 'GET') submissions++;
    return route.fulfill({ json: { available: false } });
  });
  await ctx.addInitScript(() => {
    const decoded = new WeakSet();
    window.pilotPlayback = { decoded: 0, started: 0 };
    const decode = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function (...args) {
      return decode.apply(this, args).then((buffer) => {
        decoded.add(buffer);
        window.pilotPlayback.decoded++;
        return buffer;
      });
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (decoded.has(this.buffer)) window.pilotPlayback.started++;
      return start.apply(this, args);
    };
  });
  const page = await ctx.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.setDefaultTimeout(20000);
  await page.goto(base);
  await page.locator('#feedbackDialog').waitFor({ state: 'attached' });
  const capture = (name) => page.screenshot({ path: resolve(output, name + '.png') });
  const buildVisible = async () => {
    await page.locator('#buildLabel').waitFor({ state: 'visible' });
    assert.match(await page.locator('#buildLabel').textContent(), /v[0-9].*local\./);
  };
  const openMenu = async (menu) => {
    if (!(await page.locator(menu).evaluate((el) => el.open)))
      await page.locator(menu + '>summary').click();
  };
  const menuItem = async (selector, menu = '#interfaceMenu') => {
    await openMenu(menu);
    await page.locator(menu).locator(selector).click();
  };
  const controlsFit = async (selector) =>
    assert.equal(
      await page.evaluate((selector) => {
        const boxes = [...document.querySelectorAll(selector)]
          .filter((el) => !el.closest('details:not([open])'))
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width && r.height);
        return (
          boxes.length > 0 &&
          boxes.every(
            (r) => r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight,
          ) &&
          boxes.every((a, i) =>
            boxes
              .slice(i + 1)
              .every((b) => a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y),
          )
        );
      }, selector),
      true,
      'visible controls fit without overlap: ' + selector,
    );
  const pickerFits = async () => {
    const state = await page.locator('#modal').evaluate((el) => ({
      width: el.clientWidth,
      scroll: el.scrollWidth,
      font: getComputedStyle(el.querySelector('h2')).fontFamily,
      radios: [...el.querySelectorAll('[name=pilotVoice]')].map((input) => ({
        width: input.getBoundingClientRect().width,
        height: input.getBoundingClientRect().height,
      })),
      descriptions: [...el.querySelectorAll('.pilot-voice-options small')].map((s) =>
        Number.parseFloat(getComputedStyle(s).fontSize),
      ),
    }));
    assert.ok(state.scroll <= state.width + 1, 'voice picker has no horizontal overflow');
    assert.match(state.font, /Arial/);
    assert.ok(
      state.radios.length === 3 && state.radios.every((r) => r.width === 20 && r.height === 20),
      'native radio size is preserved',
    );
    assert.ok(
      state.descriptions.every((size) => size >= 14),
      'voice descriptions are readable',
    );
  };
  for (const width of [1440, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    await openMenu('#interfaceMenu');
    await controlsFit('#interfaceMenu .interface-menu-panel>button');
    await page.locator('#interfaceMenu>summary').click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Cancelling a preview while its real WAVs are loading must not start speech later.
  let release;
  const gate = new Promise((done) => (release = done));
  let blocked = 0;
  await ctx.route('**/audio/pilot/flint/*.wav', async (route) => {
    blocked++;
    await gate;
    await route.fallback();
  });
  await menuItem('#pilotVoiceSettings');
  await buildVisible();
  await pickerFits();
  assert.equal(
    await page.locator('#interfaceMenu').evaluate((el) => el.open),
    false,
    'picker closes its originating menu',
  );
  await page.locator('[name=pilotVoice][value=flint]').check();
  await page.locator('#previewPilotVoice').click();
  await page.waitForFunction(() =>
    document.querySelector('#pilotVoicePreviewStatus').textContent.includes('Loading'),
  );
  assert.ok(blocked > 0);
  await page.locator('#closePilotVoices').click();
  release();
  await page.waitForFunction(() => window.pilotPlayback.decoded === 32);
  assert.equal(await page.evaluate(() => window.pilotPlayback.started), 0);
  for (const [id, name] of [
    ['flint', 'Flint'],
    ['echo', 'Echo'],
    ['rook', 'Rook'],
  ]) {
    await menuItem('#pilotVoiceSettings');
    await page.locator(`[name=pilotVoice][value=${id}]`).check();
    await page.locator('#previewPilotVoice').click();
    await page.waitForFunction(
      (name) =>
        document.querySelector('#pilotVoicePreviewStatus').textContent === name + ' preview.',
      name,
    );
    await buildVisible();
    await page.locator('#closePilotVoices').click();
  }
  assert.equal(await page.evaluate(() => window.pilotPlayback.decoded), 96);
  assert.equal(await page.evaluate(() => window.pilotPlayback.started), 3);
  await menuItem('#pilotVoiceSettings');
  await page.locator('[name=pilotVoice][value=echo]').check();
  await page.locator('#closePilotVoices').click();
  await page.reload();
  assert.equal(await page.locator('#pilotVoiceSettings').textContent(), 'Voice: Echo');
  await menuItem('[data-feedback]');
  await buildVisible();
  await page.locator('[name=title]').fill('Local coexistence regression draft');
  await page.locator('#feedbackClose').click();
  await page.locator('#startGarage').click();
  await page.locator('#testBuildTop').click();
  await page.waitForFunction(
    () =>
      document.querySelector('#sceneFlow').dataset.phase === 'idle' &&
      !document.querySelector('#game').hidden &&
      !document.querySelector('#game').inert,
  );
  assert.equal(await page.locator('#gameReport').count(), 1);
  const audioModules = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => new URL(url).pathname.endsWith('/audio.js')),
  );
  assert.equal(new Set(audioModules).size, 1);
  await page.evaluate(() => document.exitPointerLock());
  assert.equal(await page.locator('#voiceSettings').textContent(), 'ECHO ▾');
  await buildVisible();
  await capture('desktop-combat');
  await openMenu('#combatMenu');
  await controlsFit('#combatMenu .interface-menu-panel>button');
  await menuItem('#voiceToggle', '#combatMenu');
  assert.equal(await page.locator('#voiceToggle').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.evaluate(() => localStorage.getItem('iw-pilot-voice')), 'off');
  await menuItem('#voiceToggle', '#combatMenu');
  assert.equal(await page.locator('#voiceToggle').getAttribute('aria-pressed'), 'true');
  await menuItem('#voiceSettings', '#combatMenu');
  await pickerFits();
  assert.equal(await page.locator('#combatMenu').evaluate((el) => el.open), false);
  await page.locator('[name=pilotVoice][value=flint]').check();
  await page.locator('#closePilotVoices').click();
  assert.equal(await page.locator('#voiceSettings').textContent(), 'FLINT ▾');
  await menuItem('#gameReport', '#combatMenu');
  assert.equal(
    await page.locator('[name=title]').inputValue(),
    'Local coexistence regression draft',
  );
  await buildVisible();
  await page.waitForFunction(() => document.querySelector('#feedbackScreenshot').naturalWidth > 0);
  await capture('desktop-feedback');
  await page.locator('#feedbackClose').click();
  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    await openMenu('#combatMenu');
    await controlsFit('#combatMenu .interface-menu-panel>button');
    await menuItem('#voiceSettings', '#combatMenu');
    await buildVisible();
    await pickerFits();
    await capture(width + '-voice-picker');
    await page.locator('#closePilotVoices').click();
    await capture(width + '-combat');
    await menuItem('#gameReport', '#combatMenu');
    await buildVisible();
    await page.locator('#feedbackClose').click();
    await page.keyboard.press('F8');
    await buildVisible();
    await page.locator('#feedbackClose').click();
  }
  await menuItem('#exitGame', '#combatMenu');
  await page.locator('#game').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#pilotVoiceSettings').textContent(), 'Voice: Flint');
  assert.equal(submissions, 0);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: 3 voice packs / 96 real WAV clips, preview cancellation, selection persistence, independent voice toggle, menu/combat reporting, draft retention, capture, build labels, readable radio controls, and non-overlapping desktop/390px/360px menus. No external submissions.',
  );
} finally {
  await browser?.close();
  server?.kill();
}
