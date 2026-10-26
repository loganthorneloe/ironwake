// Optional browser integration check. Requires Playwright and Chrome.
// PLAYWRIGHT_MODULE may point to an installed Playwright ESM entry point.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.CINEMATIC_URL
  ? null
  : spawn(
      process.execPath,
      [new URL('./preview-server.mjs', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), '4291'],
      { windowsHide: true },
    );
if (server)
  await new Promise((resolve, reject) => {
    server.stdout.once('data', resolve);
    server.once('error', reject);
    server.once('exit', (code) => reject(Error('Preview exited: ' + code)));
  });
const base = process.env.CINEMATIC_URL || 'http://127.0.0.1:4291/ironwake/';
const output = new URL('../.openai/cinematics/', import.meta.url).pathname.replace(
  /^\/(\w:)/,
  '$1',
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
});
const errors = [];
async function makePage(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  // A test-only hook delays/fails shader preparation to exercise slow loaders.
  await context.route('**/three-view.js*', async (route) => {
    const response = await route.fetch();
    let source = await response.text();
    source = source.replace(
      'await renderer.compileAsync(scene,camera);',
      'await globalThis.__holdDeployment?.();await renderer.compileAsync(scene,camera);',
    );
    await route.fulfill({ response, body: source });
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  return page;
}
const phase = (page) => page.locator('#sceneFlow').getAttribute('data-phase');
const waitPhase = (page, value) =>
  page.waitForFunction(
    (value) => document.querySelector('#sceneFlow').dataset.phase === value,
    value,
    { timeout: 30000 },
  );
async function releasePointer(page) {
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !document.pointerLockElement);
}
async function open(page) {
  await page.goto(base);
  await page.locator('#startGarage').waitFor();
}
async function range(page) {
  await page.locator('#startGarage').click();
  await page.locator('#testBuildTop').click();
}
async function command(page) {
  await page.locator('#hubScreen').waitFor({ state: 'visible' });
  await page.locator('.hub-directory [data-walk=mission]').click();
  await page.locator('#hubCommand').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#hubCommand [data-action=deploy]').waitFor();
}
async function readyAtHub(page) {
  const ready = page.locator('#hubTeam [data-hub-action=ready]');
  await ready.waitFor({ state: 'visible' });
  await ready.click();
  await page.waitForFunction(
    () => document.querySelector('#hubTeam [data-hub-action=ready]')?.textContent === 'Unready',
  );
}
async function live(page) {
  await waitPhase(page, 'idle');
  assert.equal(await page.locator('#game').isVisible(), true);
  assert.equal(await page.locator('#game').getAttribute('data-arrival'), null);
}
try {
  const page = await makePage();
  await open(page);
  await page.evaluate(() => {
    window.__holdDeployment = () =>
      new Promise((resolve) => (window.__releaseDeployment = resolve));
  });
  await range(page);
  await page.waitForFunction(() => !!window.__releaseDeployment);
  assert.equal(await phase(page), 'loading');
  assert.equal(await page.locator('#game').getAttribute('inert'), '');
  await page.screenshot({ path: output + '/loading.png' });
  await page.locator('.deployment-cancel').click();
  await waitPhase(page, 'idle');
  assert.equal(await page.locator('#hangar').isVisible(), true);
  await page.evaluate(() => window.__releaseDeployment());
  await page.waitForTimeout(100);
  assert.equal(
    await page.locator('#game').isVisible(),
    false,
    'cancelled preparation cannot resurrect the arena',
  );
  await page.evaluate(() => {
    delete window.__holdDeployment;
  });
  const loadingAt = Date.now();
  await page.locator('#testBuildTop').click();
  await waitPhase(page, 'reveal');
  assert.ok(Date.now() - loadingAt >= 1400, 'loading screen holds for at least 1.5 seconds');
  await page.screenshot({ path: output + '/gray-reveal.png' });
  await waitPhase(page, 'insertion');
  await page.screenshot({ path: output + '/insertion.png' });
  await waitPhase(page, 'holding');
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('w');
  await page.keyboard.press('Space');
  assert.equal(
    await page.locator('#game').getAttribute('inert'),
    '',
    'input stays blocked through the entire title hold',
  );
  assert.equal(await page.locator('.deployment-mission').isVisible(), true);
  await page.waitForTimeout(1000);
  assert.equal(await phase(page), 'holding', 'title hold precedes gameplay');
  await live(page);
  assert.equal(await page.locator('.deployment-card').isVisible(), false);
  await page.keyboard.press('w');
  await releasePointer(page);
  await page.screenshot({ path: output + '/desktop-combat.png' });
  await page.locator('#exitGame').click();
  await waitPhase(page, 'idle');
  assert.equal(await page.locator('#hangar').isVisible(), true);
  console.log(
    'PASS: staged preparation, cancellation, stale async completion, retry, camera handoff and return',
  );
  await page.evaluate(() => {
    window.__holdDeployment = () => {
      throw Error('Fixture shader preparation failure');
    };
  });
  await page.locator('#testBuildTop').click();
  await page.waitForFunction(() =>
    document.querySelector('#toast').textContent.includes('Fixture shader'),
  );
  assert.equal(await page.locator('#hangar').isVisible(), true);
  assert.equal(await phase(page), 'idle');
  await page.evaluate(() => {
    window.__originalTimeout = window.setTimeout;
    window.setTimeout = (handler, ms, ...args) =>
      window.__originalTimeout(handler, ms === 30000 ? 250 : ms, ...args);
    window.__holdDeployment = () =>
      new Promise((resolve) => (window.__releaseDeployment = resolve));
  });
  await page.locator('#testBuildTop').click();
  await page.waitForFunction(() =>
    document.querySelector('#toast').textContent.includes('timed out'),
  );
  assert.equal(await page.locator('#hangar').isVisible(), true);
  assert.equal(await phase(page), 'idle');
  await page.evaluate(() => {
    window.__releaseDeployment();
    window.setTimeout = window.__originalTimeout;
  });
  await page.close();
  console.log('PASS: shader failure and loading deadline unwind safely');

  const mobile = await makePage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  await open(mobile);
  await mobile.evaluate(() => {
    window.__holdDeployment = () =>
      new Promise((resolve) => (window.__releaseDeployment = resolve));
  });
  await mobile.locator('#startMission').click();
  await command(mobile);
  await mobile.locator('#hubCommand [data-action=deploy]').click();
  await mobile.waitForFunction(() => !!window.__releaseDeployment);
  await mobile.screenshot({ path: output + '/mobile-loading.png' });
  assert.equal(await mobile.locator('#sceneFlow').getAttribute('data-motion'), 'reduced');
  assert.equal(
    await mobile
      .locator('.deployment-mission')
      .evaluate((el) => el.getBoundingClientRect().right <= innerWidth),
    true,
  );
  await mobile.evaluate(() => window.__releaseDeployment());
  await live(mobile);
  await mobile.screenshot({ path: output + '/mobile-combat.png' });
  console.log('PASS: portrait layout and system reduced-motion deployment');
  await mobile.close();

  // Relay the real app's PeerJS packets locally. Only signaling/transport is mocked.
  // Separate contexts preserve independent pilot saves; gameplay and the host barrier are real.
  const peers = new Map(),
    links = new Map();
  let sequence = 0;
  async function deliver(target, message) {
    await target.evaluate((message) => window.__receivePeer(message), message);
  }
  const relay = async ({ page }, message) => {
    if (message.type === 'register') {
      peers.set(message.id, page);
      await deliver(page, { type: 'peer-open', id: message.id });
    }
    if (message.type === 'connect') {
      const target = peers.get(message.target);
      assert.ok(target, 'mock host must exist');
      links.set(message.link, {
        source: page,
        target,
        sourceId: message.id,
        targetId: message.target,
      });
      await deliver(target, { type: 'connection', link: message.link, peer: message.id });
      await deliver(target, { type: 'connection-open', link: message.link });
      await deliver(page, { type: 'connection-open', link: message.link });
    }
    if (message.type === 'send') {
      const link = links.get(message.link);
      if (link)
        await deliver(page === link.source ? link.target : link.source, {
          type: 'data',
          link: message.link,
          data: message.data,
        });
    }
    if (message.type === 'destroy') {
      peers.delete(message.id);
      for (const [key, link] of links)
        if (page === link.source || page === link.target) {
          links.delete(key);
          await deliver(page === link.source ? link.target : link.source, {
            type: 'connection-close',
            link: key,
          });
        }
    }
  };
  async function mockPeer(page) {
    await page.context().exposeBinding('__relayPeer', relay);
    await page.context().addInitScript(
      ({ pilotId }) => {
        class Events {
          constructor() {
            this.handlers = {};
          }
          on(name, handler) {
            (this.handlers[name] ??= []).push(handler);
            return this;
          }
          emit(name, value) {
            for (const handler of this.handlers[name] || []) handler(value);
          }
        }
        const connections = new Map();
        let peer;
        class Connection extends Events {
          constructor(link, id) {
            super();
            this.link = link;
            this.peer = id;
            this.open = false;
            this.bufferSize = 0;
            connections.set(link, this);
          }
          send(data) {
            window.__relayPeer({ type: 'send', link: this.link, data });
          }
          close() {
            this.open = false;
            this.emit('close');
          }
        }
        class Peer extends Events {
          constructor(id) {
            super();
            this.id = id || pilotId;
            peer = this;
            queueMicrotask(() => window.__relayPeer({ type: 'register', id: this.id }));
          }
          connect(target) {
            const link = this.id + '-' + target;
            const conn = new Connection(link, target);
            window.__relayPeer({ type: 'connect', id: this.id, target, link });
            return conn;
          }
          destroy() {
            this.destroyed = true;
            window.__relayPeer({ type: 'destroy', id: this.id });
          }
        }
        window.__receivePeer = (message) => {
          if (message.type === 'peer-open') peer.emit('open', message.id);
          if (message.type === 'connection') {
            const conn = new Connection(message.link, message.peer);
            peer.emit('connection', conn);
          }
          const conn = connections.get(message.link);
          if (!conn) return;
          if (message.type === 'connection-open') {
            conn.open = true;
            conn.emit('open');
          }
          if (message.type === 'connection-close') {
            conn.open = false;
            conn.emit('close');
          }
          if (message.type === 'data') {
            (window.__receivedPackets ??= []).push(message.data);
            if (message.data.type === 'start') window.__deploymentTicket = message.data.ticket;
            conn.emit('data', message.data);
          }
        };
        window.__testPacket = (data) => [...connections.values()][0].send(data);
        Object.defineProperty(window, 'Peer', { get: () => Peer, set() {}, configurable: true });
      },
      { pilotId: 'test-pilot-' + ++sequence },
    );
  }
  const host = await makePage(),
    guest = await makePage();
  await mockPeer(host);
  await mockPeer(guest);
  await open(host);
  await host.locator('#startHost').click();
  await host.locator('#hubTeam .hub-squad-label').filter({ hasText: 'ROOM ' }).waitFor();
  const code = (await host.locator('#hubTeam .hub-squad-label').textContent()).match(
    /ROOM (\w+)/,
  )[1];
  await open(guest);
  await guest.locator('#startJoin').click();
  await guest.locator('#joinCode').fill(code);
  await guest.locator('#confirmJoin').click();
  await guest.locator('#hubTeam [data-hub-action=ready]').waitFor();
  await guest.evaluate(() => {
    window.__holdDeployment = () =>
      new Promise((resolve) => (window.__releaseDeployment = resolve));
  });
  await readyAtHub(host);
  await readyAtHub(guest);
  await command(host);
  await host.locator('#hubCommand [data-action=deploy]').click();
  await guest.waitForFunction(() => !!window.__releaseDeployment);
  await waitPhase(host, 'waiting');
  assert.equal(await phase(guest), 'loading');
  assert.equal(
    await host.evaluate(
      () => window.__receivedPackets?.filter((p) => p.type === 'state').length || 0,
    ),
    0,
  );
  await guest.evaluate(() =>
    window.__testPacket({ type: 'deployment-ready', ticket: 'stale-drop' }),
  );
  await host.waitForTimeout(150);
  assert.equal(await phase(host), 'waiting');
  await guest.evaluate(() => window.__releaseDeployment());
  await Promise.all([live(host), live(guest)]);
  await guest.waitForFunction(() => window.__receivedPackets.some((p) => p.type === 'state'));
  const firstState = await guest.evaluate(
    () => window.__receivedPackets.find((p) => p.type === 'state').world,
  );
  assert.ok(firstState.time < 1, 'combat clock starts after the slow pilot is ready');
  await host.screenshot({ path: output + '/coop-combat.png' });
  console.log(
    'PASS: two-pilot host barrier, slow guest, stale ready rejection, synchronized combat release and snapshots',
  );

  // Abort a second drop on disconnect; the campaign must remain available.
  await releasePointer(host);
  await host.locator('#exitGame').click();
  await host.locator('#confirmExit').click();
  await command(host);
  await host.locator('#hubCommand [data-action=newRun]').click();
  await host.locator('#confirmCampaign').click();
  await readyAtHub(host);
  await readyAtHub(guest);
  await command(host);
  await host.locator('#hubCommand [data-action=deploy]').click();
  await guest.waitForFunction(
    () =>
      !!window.__releaseDeployment &&
      document.querySelector('#sceneFlow').dataset.phase === 'loading',
  );
  await guest.locator('.deployment-cancel').click();
  await waitPhase(host, 'idle');
  assert.equal(await host.locator('#hangar').isVisible(), true);
  await command(host);
  assert.equal(
    await host.locator('#hubCommand [data-action=deploy]').isEnabled(),
    false,
    'host must ready up again after cancellation',
  );
  console.log('PASS: guest cancellation unwinds host deployment without ending the campaign');
  // Destruction rooms need the same ticketed barrier, including the lab's reset action.
  const demolitionHost = await makePage(),
    demolitionGuest = await makePage();
  await mockPeer(demolitionHost);
  await mockPeer(demolitionGuest);
  await demolitionHost.goto(base + '?lab=destruction');
  await demolitionHost.locator('#closeModal').click();
  await demolitionHost.locator('#startHost').click();
  await demolitionHost.waitForFunction(() => document.body.dataset.room === 'true');
  const demolitionCode = (await demolitionHost.locator('#networkStatus').textContent()).match(
    /ROOM (\w+)/,
  )[1];
  await demolitionHost.locator('#destructionLab').click();
  await demolitionHost.locator('[data-demolition=yard]').click();
  await demolitionGuest.goto(base + '?lab=destruction&room=' + demolitionCode);
  await demolitionGuest.locator('#confirmJoin').click();
  await demolitionGuest.waitForFunction(() => document.body.dataset.room === 'true');
  // The lab uses the shared workshop readiness controls.
  await demolitionHost.locator('#deploy').click();
  await demolitionGuest.locator('#deploy').click();
  await demolitionHost.waitForFunction(() => !document.querySelector('#deploy').disabled);
  await demolitionHost.locator('#deploy').click();
  await Promise.all([live(demolitionHost), live(demolitionGuest)]);
  await demolitionHost.locator('#destructionTelemetry').waitFor();
  await releasePointer(demolitionHost);
  await demolitionHost.locator('#restartDemolition').click();
  await Promise.all([live(demolitionHost), live(demolitionGuest)]);
  const starts = await demolitionGuest.evaluate(() =>
    window.__receivedPackets.filter((p) => p.type === 'start'),
  );
  assert.equal(starts.length, 2, 'one start packet per destruction deployment');
  assert.ok(starts.every((p) => typeof p.ticket === 'string'));
  assert.notEqual(starts[0].ticket, starts[1].ticket);
  console.log('PASS: two-pilot destruction deployment and ticketed restart');
  if (process.argv.includes('--capture')) {
    const capture = await makePage();
    await open(capture);
    await capture.locator('#startMission').click();
    await command(capture);
    await capture.waitForTimeout(250);
    await capture.screenshot({ path: output + '/campaign-before.png' });
    await mkdir(output + '/frames', { recursive: true });
    await capture.locator('#hubCommand [data-action=deploy]').click();
    let capturedInsertion = false;
    const frameTimes = [];
    for (let i = 0; i < 64; i++) {
      if (!capturedInsertion && (await phase(capture)) === 'insertion') {
        await capture.screenshot({ path: output + '/campaign-insertion.png' });
        capturedInsertion = true;
      }
      frameTimes.push(Date.now());
      await capture.screenshot({ path: output + '/frames/' + String(i).padStart(3, '0') + '.png' });
      await capture.waitForTimeout(40);
    }
    await writeFile(output + '/frame-times.json', JSON.stringify(frameTimes));
    await live(capture);
    await capture.screenshot({ path: output + '/campaign-combat.png' });
    console.log('Captured 64 timestamped frames of an unmodified solo campaign launch');
  }
  assert.deepEqual(errors, [], 'no unhandled browser errors');
  console.log('Browser checks complete. Captures: ' + output);
} finally {
  await browser.close();
  server?.kill();
}
