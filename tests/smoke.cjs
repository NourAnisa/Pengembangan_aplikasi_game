/* Browser checks for the real game UI. Requires Playwright and a local HTTP server. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchBrowser } = require('./browser.cjs');
const { POINTS } = require('../game.js');

const baseURL = process.env.SUNGAI_TEST_URL || 'http://127.0.0.1:8000';
const outputDirectory = process.env.SUNGAI_TEST_OUTPUT || '/tmp/penjaga-sungai-qa';
const mobileOnly = process.env.SUNGAI_TEST_GROUP === 'mobile';
const productionOnly = process.env.SUNGAI_TEST_GROUP === 'production';
const expectedChecks = productionOnly ? 1 : mobileOnly ? 3 : 11;
const reportFilename = productionOnly ? 'smoke-production-results.json' : mobileOnly ? 'smoke-mobile-results.json' : 'smoke-results.json';
fs.mkdirSync(outputDirectory, { recursive: true });
const results = [];
const browserProblems = [];
const missingResources = [];
let fatalError = null;

async function record(name, test) {
  const start = Date.now();
  try {
    await test();
    results.push({ name, passed: true, milliseconds: Date.now() - start });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, passed: false, milliseconds: Date.now() - start, error: error.stack || String(error) });
    console.error(`FAIL ${name}\n${error.stack || error}`);
    throw error;
  }
}

function observe(page, label) {
  page.on('pageerror', error => browserProblems.push({ label, message: error.message }));
  page.on('console', message => {
    if (message.type() === 'error') browserProblems.push({ label, message: message.text() });
  });
  page.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith(baseURL)) {
      missingResources.push({ label, status: response.status(), url: response.url() });
    }
  });
  page.on('requestfailed', request => {
    if (request.url().startsWith(baseURL) && request.failure()?.errorText !== 'net::ERR_ABORTED') {
      missingResources.push({ label, status: request.failure()?.errorText, url: request.url() });
    }
  });
}

const state = page => page.evaluate(() => window.SungaiGame.getState());
const waitState = (page, expression) => page.waitForFunction(expression, null, { timeout: 15000 });
async function acknowledge(page) {
  await page.locator('#dialogue-dialog').waitFor({ state: 'visible' });
  await page.locator('#dialogue-continue').click();
  await waitState(page, () => !window.SungaiGame.getState().dialogue);
}
async function interactAt(page, pointName, interactionId) {
  const point = POINTS[pointName];
  assert(point, `No exported point ${pointName}`);
  await page.evaluate(({ x, y }) => window.SungaiGame.debug.teleport(x, y), point);
  await waitState(page, () => !window.SungaiGame.getState().paused);
  const current = await state(page);
  assert.equal(current.interactionId, interactionId, `Expected interaction ${interactionId} at ${pointName}`);
  await page.keyboard.press('e');
}
async function assertNoHorizontalOverflow(page, label) {
  const geometry = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth }));
  assert(geometry.scroll <= geometry.width + 1, `${label}: page overflows horizontally (${geometry.scroll} > ${geometry.width})`);
}

(async () => {
  const browser = await launchBrowser();
  let desktop;
  let mobile;
  try {
    desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const page = await desktop.newPage();
    observe(page, 'desktop');
    if (!mobileOnly && !productionOnly) {
    await page.goto(`${baseURL}/?test=1`, { waitUntil: 'networkidle' });
    await waitState(page, () => !!window.SungaiGame);
    await waitState(page, () => !document.querySelector('#start-game').disabled);

    await record('Landing, local assets, PPT and design-document links', async () => {
      assert.match(await page.title(), /^Penjaga Sungai.*3D/);
      assert.equal((await state(page)).status, 'title');
      await assertNoHorizontalOverflow(page, 'desktop landing');
      for (const filename of ['assets/world.png', 'assets/hero.png', 'assets/guardian.png', 'assets/boat.png', 'assets/world_open.png', 'docs.html', 'docs/rancangan.md', 'Pertemuan_6_7_8_Properti_Storyboard_Laporan_OBE.pptx']) {
        const response = await page.request.get(`${baseURL}/${filename}`);
        assert(response.ok(), `${filename}: HTTP ${response.status()}`);
        assert((await response.body()).length > 100, `${filename}: empty resource`);
      }
      await page.screenshot({ path: path.join(outputDirectory, 'desktop-landing.png'), fullPage: true });
    });

    await record('Start briefing and dialogue stop the countdown', async () => {
      await page.locator('#start-game').click();
      await page.locator('#game-screen').waitFor({ state: 'visible' });
      await page.locator('#dialogue-dialog').waitFor({ state: 'visible' });
      const before = (await state(page)).timeRemaining;
      await page.waitForTimeout(300);
      await page.evaluate(() => window.SungaiGame.debug.tick(2));
      assert.equal((await state(page)).timeRemaining, before, 'Dialogue consumed mission time');
      await acknowledge(page);
      assert.equal((await state(page)).phase, 'key');
    });

    await record('Actual WASD / arrow movement and river-bank collision', async () => {
      const before = await state(page);
      await page.keyboard.down('d');
      await page.waitForFunction(x => window.SungaiGame.getState().player.x > x + 20, before.player.x, { timeout: 10000 });
      await page.keyboard.up('d');
      const after = await state(page);
      assert(after.player.x > before.player.x + 20, 'D key did not move the player');
      assert(after.timeRemaining < before.timeRemaining, 'Active countdown did not run');
      await page.evaluate(() => window.SungaiGame.debug.teleport(620, 670));
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(350);
      await page.keyboard.up('ArrowRight');
      assert((await state(page)).player.x <= 626, 'Player walked into the river without a boat');
    });

    await record('Pause / resume, help modal and sound UI', async () => {
      await page.locator('#pause-button').click();
      await page.locator('#pause-dialog').waitFor({ state: 'visible' });
      const before = (await state(page)).timeRemaining;
      await page.waitForTimeout(300);
      await page.evaluate(() => window.SungaiGame.debug.tick(2));
      assert.equal((await state(page)).timeRemaining, before, 'Manual pause consumed time');
      await page.locator('#resume-button').click();
      await waitState(page, () => !window.SungaiGame.getState().paused);
      await page.keyboard.press('Escape');
      await page.locator('#pause-dialog').waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      await waitState(page, () => !window.SungaiGame.getState().paused);
      await page.locator('#game-screen [data-open-help]').click();
      await page.locator('#help-dialog').waitFor({ state: 'visible' });
      const helpBefore = (await state(page)).timeRemaining;
      await page.evaluate(() => window.SungaiGame.debug.tick(3));
      assert.equal((await state(page)).timeRemaining, helpBefore, 'Help modal consumed time');
      await page.locator('#help-dialog [data-close-help]').first().click();
      const soundBefore = (await state(page)).soundEnabled;
      await page.locator('#sound-button').click();
      assert.equal((await state(page)).soundEnabled, !soundBefore);
      assert.equal(await page.locator('#sound-button').getAttribute('aria-pressed'), String(!soundBefore));
      await page.locator('#sound-button').click();
      assert.equal((await state(page)).soundEnabled, soundBefore);
    });

    await record('Guardian hint and key property changes inventory and objective', async () => {
      await interactAt(page, 'guardian', 'guardian');
      assert.match((await state(page)).dialogue.text, /gudang/i);
      await acknowledge(page);
      await interactAt(page, 'key', 'key');
      const current = await state(page);
      assert.equal(current.hasKey, true);
      assert.equal(current.cargoWeight, 1);
      assert(current.progress[0].done);
      assert.match(current.dialogue.text, /perahu/i);
      await acknowledge(page);
      assert.match((await state(page)).objective, /perahu/i);
    });

    await record('Optional parcel demonstrates capacity and safe storage', async () => {
      await interactAt(page, 'parcel', 'parcel');
      assert.equal((await state(page)).cargoWeight, 3);
      assert.equal((await state(page)).capacity, 2);
      await acknowledge(page);
      assert.match((await state(page)).objective, /berat|paket/i);
      await interactAt(page, 'westDock', 'boat');
      assert.equal((await state(page)).crossed, false, 'Overweight boat departed');
      assert.equal((await state(page)).parcel, 'stored');
      assert.equal((await state(page)).cargoWeight, 1);
      await acknowledge(page);
      await page.screenshot({ path: path.join(outputDirectory, 'desktop-game.png'), fullPage: true });
    });

    await record('Boat crossing, locked gate, three crates and winning ending', async () => {
      await interactAt(page, 'westDock', 'boat');
      assert.equal((await state(page)).travelling, true);
      await waitState(page, () => window.SungaiGame.getState().crossed);
      assert((await state(page)).progress[1].done);
      await interactAt(page, 'gate', 'gate');
      assert.equal((await state(page)).gateOpen, false, 'Gate opened before clearing crates');
      await acknowledge(page);
      for (let count = 1; count <= 3; count += 1) {
        await interactAt(page, 'crates', 'crates');
        assert.equal((await state(page)).crateHits, count);
      }
      await acknowledge(page);
      assert.match((await state(page)).objective, /kunci.*pintu air|pintu air/i);
      await interactAt(page, 'gate', 'gate');
      assert.equal((await state(page)).status, 'won');
      assert.equal((await state(page)).gateOpen, true);
      assert((await state(page)).progress.every(item => item.done));
      await page.locator('#ending-dialog').waitFor({ state: 'visible' });
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(outputDirectory, 'desktop-win.png'), fullPage: true });
      await page.locator('#view-world-button').click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(outputDirectory, 'desktop-river-saved.png'), fullPage: true });
      await page.locator('#pause-button').click();
      await page.locator('#ending-dialog').waitFor({state:'visible'});
    });

    await record('Timeout ending and real retry button reset the mission', async () => {
      await page.locator('#play-again-button').click();
      await acknowledge(page);
      await page.evaluate(() => window.SungaiGame.debug.time(0.15));
      await waitState(page, () => window.SungaiGame.getState().status === 'lost');
      await page.locator('#ending-dialog').waitFor({ state: 'visible' });
      assert.match(await page.locator('#ending-title').innerText(), /air|harapan|waktu/i);
      await page.locator('#play-again-button').click();
      assert.equal((await state(page)).hasKey, false);
      assert.equal((await state(page)).crateHits, 0);
      assert.equal((await state(page)).parcel, 'ground');
      assert.equal((await state(page)).timeRemaining, 240);
      await acknowledge(page);
    });
    }

    // Release the desktop WebGL world before compiling a second one in the
    // software-rendered phone context. The gameplay checks above are complete.
    await page.close();

    if (!productionOnly) {
    mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const phone = await mobile.newPage();
    await phone.bringToFront();
    observe(phone, 'phone');
    await phone.goto(`${baseURL}/?test=1`, { waitUntil: 'networkidle' });
    await waitState(phone, () => !!window.SungaiGame);
    await waitState(phone, () => !document.querySelector('#start-game').disabled);
    await record('Phone landing and dialogs fit 390px viewport', async () => {
      await assertNoHorizontalOverflow(phone, 'phone landing');
      await phone.screenshot({ path: path.join(outputDirectory, 'phone-landing.png'), fullPage: true });
      await phone.locator('#start-game').tap();
      await phone.locator('#dialogue-dialog').waitFor({ state: 'visible' });
      const box = await phone.locator('#dialogue-dialog').boundingBox();
      assert(box.x >= 0 && box.x + box.width <= 391, 'Phone dialogue extends outside the viewport');
      await phone.locator('#dialogue-continue').tap();
      await assertNoHorizontalOverflow(phone, 'phone game');
    });

    await record('Real touch direction movement and reachable action controls', async () => {
      const button = phone.locator('.direction-right');
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      assert(box && box.width >= 40 && box.height >= 40, 'Touch control too small or invisible');
      assert(box.x >= 0 && box.x + box.width <= 391, 'Touch control outside phone width');
      const before = await state(phone);
      const client = await mobile.newCDPSession(phone);
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
      await phone.waitForFunction(x => window.SungaiGame.getState().player.x > x + 20, before.player.x, { timeout: 10000 });
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await client.detach();
      assert((await state(phone)).player.x > before.player.x + 20, 'Holding touch direction did not move player');
      await phone.evaluate(({ x, y }) => window.SungaiGame.debug.teleport(x, y), POINTS.guardian);
      await phone.locator('#interact-button').tap();
      await phone.locator('#dialogue-dialog').waitFor({ state: 'visible' });
      assert.match((await state(phone)).dialogue.title, /petunjuk/i);
      await phone.locator('#dialogue-continue').tap();
      await assertNoHorizontalOverflow(phone, 'phone controls');
      await phone.screenshot({ path: path.join(outputDirectory, 'phone-game.png'), fullPage: true });
    });
    await mobile.close();
    }

    await record('Production URL omits debugging hooks; browser has no missing assets or runtime errors', async () => {
      const production = await desktop.newPage();
      await production.bringToFront();
      observe(production, 'production');
      await production.goto(baseURL, { waitUntil: 'networkidle' });
      await waitState(production, () => !!window.SungaiGame);
      assert.equal(await production.evaluate(() => 'debug' in window.SungaiGame), false);
      assert.deepEqual(missingResources, [], 'Missing resources');
      assert.deepEqual(browserProblems, [], 'Browser errors');
      await production.close();
    });
  } catch (error) {
    fatalError = error.stack || String(error);
    console.error(fatalError);
    if (desktop) for (const [index, page] of desktop.pages().entries()) {
      await page.screenshot({ path: path.join(outputDirectory, `failure-desktop-${index}.png`), fullPage: true }).catch(() => {});
    }
    if (mobile) for (const [index, page] of mobile.pages().entries()) {
      await page.screenshot({ path: path.join(outputDirectory, `failure-phone-${index}.png`), fullPage: true }).catch(() => {});
    }
    process.exitCode = 1;
  } finally {
    await browser.close();
    const report = { baseURL, generatedAt: new Date().toISOString(), expectedChecks, results, fatalError, browserProblems, missingResources };
    fs.writeFileSync(path.join(outputDirectory, reportFilename), JSON.stringify(report, null, 2));
    const passed = results.filter(result => result.passed).length;
    console.log(`${passed}/${expectedChecks} checks passed. Report: ${path.join(outputDirectory, reportFilename)}`);
  }
})();
