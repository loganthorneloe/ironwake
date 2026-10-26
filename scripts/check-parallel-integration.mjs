// Optional implemented-game check. Chrome/Playwright required; reports are never submitted.
// Seeds only a saved campaign's earned XP so upgrade selection can be checked without a grind.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = fileURLToPath(new URL('../.openai/parallel-integration/', import.meta.url));
await mkdir(output + 'frames', { recursive: true });
const server = spawn(process.execPath, ['scripts/preview-server.mjs', '4307'], {
  cwd: root,
  windowsHide: true,
});
await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('error', reject);
  server.once('exit', (code) => reject(Error('Preview exited: ' + code)));
});
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  let submissions = 0;
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error(error.stack);
  });
  await page.route('**/api/feedback', (route) => {
    if (route.request().method() !== 'GET') submissions++;
    return route.fulfill({ json: { available: false } });
  });
  async function combatAction(selector) {
    if (!(await page.locator(selector).isVisible())) {
      await page.locator('#combatMenu>summary').click();
    }
    await page.locator(selector).click();
  }
  await page.goto('http://127.0.0.1:4307/ironwake/');
  await page.locator('#feedbackDialog').waitFor({ state: 'attached' });
  await page.evaluate(async () => {
    const { newCampaign, registerPilot } = await import('/ironwake/campaign.js');
    const pilot = JSON.parse(localStorage.getItem('iw-callsign'));
    const campaign = registerPilot(newCampaign(617), pilot);
    campaign.pilots[0].xp = 240;
    localStorage.setItem('iw-campaign', JSON.stringify(campaign));
  });
  await page.reload();
  await page.locator('#continueCampaign').click();
  await page.locator('.hub-directory [data-walk=parts]').click();
  await page.locator('#hubVendor').waitFor({ state: 'visible' });
  const entry = page.locator('[data-career-unlock]:enabled').first();
  const certification = await entry.getAttribute('data-career-unlock');
  await entry.click();
  await page.waitForFunction(
    (id) => document.querySelector(`[data-career-unlock="${id}"]`)?.textContent === 'Installed',
    certification,
  );
  await page.screenshot({ path: output + 'hub-career.png' });
  await page.locator('#hubVendor [data-hub-close]').click();
  await page.locator('.hub-directory [data-walk=mission]').click();
  await page.locator('#hubCommand').waitFor({ state: 'visible' });
  await page.locator('[data-action=deploy]').click();
  await page.waitForFunction(
    () =>
      document.querySelector('#sceneFlow').dataset.phase === 'idle' &&
      !document.querySelector('#game').hidden &&
      !document.querySelector('#game').hasAttribute('data-arrival'),
    null,
    { timeout: 30000 },
  );
  await page.evaluate(() => document.exitPointerLock());
  const choice = page.locator('[data-field-upgrade]').first();
  await choice.waitFor({ state: 'visible' });
  const chosenName = await choice.locator('strong').textContent();
  await choice.click();
  await page.locator('#fieldInventoryToggle').click();
  await page.waitForFunction(
    (name) => document.querySelector('#fieldInventory').textContent.includes(name),
    chosenName,
  );
  await page.screenshot({ path: output + 'campaign-field-upgrade.png' });
  await page.locator('#fieldInventoryToggle').click();
  await combatAction('#gameReport');
  await page.waitForFunction(() => document.querySelector('#feedbackScreenshot').naturalWidth > 0);
  const before = JSON.parse(await page.locator('#feedbackContext').textContent());
  await page.waitForTimeout(600);
  await page.locator('#feedbackClose').click();
  await combatAction('#gameReport');
  const after = JSON.parse(await page.locator('#feedbackContext').textContent());
  assert.ok(after.round.time - before.round.time < 0.2, 'solo simulation pauses during reporting');
  assert.match(after.mission.name, /^Ashgate Depot$/i);
  assert.ok(after.player.hp > 0);
  await page.locator('#feedbackClose').click();
  if (await page.locator('#combatMenu').evaluate((menu) => menu.open)) {
    await page.locator('#combatMenu>summary').click();
  }
  for (let i = 0; i < 2; i++) {
    const offer = page.locator('[data-field-upgrade]:enabled').first();
    await offer.waitFor({ state: 'visible' });
    await offer.click();
    await page.waitForTimeout(150);
  }
  await page.locator('#fieldOffers').waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 960, height: 680 });
  await page.locator('#battle').focus();
  await page.keyboard.down('d');
  await page.keyboard.press('Shift');
  for (let i = 0; i < 18; i++) {
    await page.screenshot({ path: output + `frames/${String(i).padStart(3, '0')}.png` });
    await page.waitForTimeout(70);
  }
  await page.keyboard.up('d');
  await page.evaluate(() => document.exitPointerLock());
  await combatAction('#gameReport');
  const moved = JSON.parse(await page.locator('#feedbackContext').textContent());
  const movementDistance = Math.hypot(
    moved.player.x - after.player.x,
    moved.player.y - after.player.y,
  );
  assert.ok(movementDistance > 10, 'captured frames show actual simulated movement');
  await page.locator('#feedbackClose').click();
  await combatAction('#exitGame');
  await page.locator('#confirmExit').click();
  await page.waitForFunction(() => document.body.dataset.screen === 'hub');
  assert.equal(await page.locator('#game').isVisible(), false);
  const savedCareer = await page.evaluate(() => localStorage.getItem('iw-career-v1'));
  assert.ok(savedCareer.includes(certification), 'permanent certification survives the sortie');
  assert.equal(submissions, 0);
  assert.deepEqual(errors, []);
  await writeFile(
    output + 'result.json',
    JSON.stringify(
      {
        certification,
        chosenName,
        mission: after.mission.name,
        reportingTimeDelta: after.round.time - before.round.time,
        movementDistance,
        errors,
        submissions,
        fixture:
          '240 earned field XP in saved campaign; station purchase, walking, launch and choice are real UI',
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS: actual station research, Command navigation, cinematic launch, field choice/inventory, solo report pause, return and career persistence. Saved campaign XP was fixture-assisted.',
  );
} finally {
  await browser.close();
  server.kill();
}
