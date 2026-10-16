/* Real WebGL rendering, raycast interaction, and responsive/fallback checks. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const { launchBrowser } = require('./browser.cjs');
const { POINTS } = require('../game.js');

const baseURL = process.env.SUNGAI_TEST_URL || 'http://127.0.0.1:8000';
const outputDirectory = process.env.SUNGAI_TEST_OUTPUT || '/tmp/penjaga-sungai-qa3d';
const mobileOnly = process.env.SUNGAI_TEST_GROUP === 'mobile';
const reportFilename = mobileOnly ? 'mobile3d-results.json' : 'render3d-results.json';
fs.mkdirSync(outputDirectory, { recursive: true });
const results = [], errors = [], renderSamples = [];
const state = page => page.evaluate(() => window.SungaiGame.getState());
const stats = page => page.evaluate(() => window.SungaiGame.getRenderStats());
const waitFor = (page, expression, arg) => page.waitForFunction(expression, arg, { timeout: 20000 });

async function record(name, test) {
  const started = Date.now();
  try {
    await test();
    results.push({ name, passed: true, milliseconds: Date.now() - started });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, passed: false, milliseconds: Date.now() - started, error: error.stack || String(error) });
    throw error;
  }
}

function observe(page, label) {
  page.on('pageerror', error => errors.push({ label, message: error.message }));
  page.on('console', message => {
    if (message.type() === 'error') errors.push({ label, message: message.text() });
  });
  page.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith(baseURL)) errors.push({ label, status: response.status(), url: response.url() });
  });
}

async function ready(page) {
  await waitFor(page, () => window.SungaiGame?.getState().ready === true && !document.querySelector('#start-game').disabled);
}

async function acknowledge(page) {
  await page.locator('#dialogue-continue').click();
  await waitFor(page, () => !window.SungaiGame.getState().dialogue);
}

async function noOverflow(page, label) {
  const bounds = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert(bounds.document <= bounds.viewport + 1, `${label}: horizontal overflow ${JSON.stringify(bounds)}`);
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outputDirectory, name), fullPage: true });
}

async function renderedCanvas(page, label) {
  await waitFor(page, () => {
    const stats = window.SungaiGame.getRenderStats();
    return stats.mode === '3d' && stats.calls > 0 && stats.triangles > 0 && stats.frames > 3;
  });
  const sample = await stats(page);
  assert.equal(sample.mode, '3d');
  assert(sample.calls > 10, `${label}: no substantial draw calls`);
  assert(sample.triangles > 1000, `${label}: scene has no substantial 3D geometry`);
  assert(sample.geometries > 10, `${label}: geometry resources not allocated`);
  assert(sample.textures > 0, `${label}: texture resources not allocated`);
  const context = await page.evaluate(() => {
    const canvas = document.querySelector('#gameCanvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return gl ? { version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.RENDERER), lost: gl.isContextLost(), width: gl.drawingBufferWidth, height: gl.drawingBufferHeight } : null;
  });
  assert(context && /WebGL/.test(context.version), `${label}: no real WebGL context`);
  assert.equal(context.lost, false, `${label}: WebGL context lost`);
  assert(context.width > 100 && context.height > 100, `${label}: drawing buffer too small`);
  // Validate rendered pixels too: populated engine counters alone cannot prove
  // that the actual visible canvas contains a scene rather than a clear color.
  const buffer = await page.locator('#gameCanvas').screenshot();
  fs.writeFileSync(path.join(outputDirectory, `${label}-canvas.png`), buffer);
  const png = PNG.sync.read(buffer);
  const colors = new Set();
  let total = 0, squared = 0, count = 0;
  for (let y = 0; y < png.height; y += 5) for (let x = 0; x < png.width; x += 5) {
    const i = (y * png.width + x) * 4;
    const red = png.data[i], green = png.data[i + 1], blue = png.data[i + 2];
    colors.add(`${red >> 4},${green >> 4},${blue >> 4}`);
    const luminance = red * .2126 + green * .7152 + blue * .0722;
    total += luminance; squared += luminance * luminance; count++;
  }
  const luminanceDeviation = Math.sqrt(squared / count - (total / count) ** 2);
  assert(colors.size > 60, `${label}: canvas has only ${colors.size} quantized colors`);
  assert(luminanceDeviation > 12, `${label}: canvas is visually empty (deviation ${luminanceDeviation})`);
  renderSamples.push({ label, ...sample, context, quantizedColors: colors.size, luminanceDeviation });
  return sample;
}

async function clickWorld(page, point) {
  const screen = await page.evaluate(({ x, y }) => window.SungaiGame.debug.project(x, y), point);
  assert(screen && Number.isFinite(screen.x) && Number.isFinite(screen.y), `Point did not project: ${JSON.stringify(screen)}`);
  const box = await page.locator('#gameCanvas').boundingBox();
  assert(screen.x >= box.x && screen.x <= box.x + box.width && screen.y >= box.y && screen.y <= box.y + box.height, `Projected point outside canvas: ${JSON.stringify(screen)}`);
  await page.mouse.click(screen.x, screen.y);
}

(async () => {
  const browser = await launchBrowser();
  const contexts = [];
  try {
    if (!mobileOnly) {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    contexts.push(desktop);
    const page = await desktop.newPage();
    observe(page, 'desktop');
    await page.goto(`${baseURL}/?test=1`, { waitUntil: 'networkidle' });

    await record('Ready loading state, 3D title and educational links', async () => {
      await ready(page);
      assert.equal((await state(page)).renderMode, '3d');
      assert.match(await page.title(), /Penjaga Sungai.*3D/);
      assert(await page.locator('#renderer-status').isVisible());
      await noOverflow(page, 'desktop title');
      assert(await page.locator('a[href="docs.html"]').first().isVisible());
      await screenshot(page, 'desktop-3d-title.png');
    });

    await record('Real WebGL scene, substantial meshes, textured pixels and active frames', async () => {
      await page.locator('#start-game').click();
      await acknowledge(page);
      const before = await renderedCanvas(page, 'desktop-3d-game');
      await waitFor(page, frame => window.SungaiGame.getRenderStats().frames > frame + 2, before.frames);
      await screenshot(page, 'desktop-3d-game.png');
    });

    await record('3D ground raycast click moves the hero; projected key click performs actual interaction', async () => {
      const before = await state(page);
      await clickWorld(page, { x: 430, y: 600 });
      await waitFor(page, x => window.SungaiGame.getState().player.x > x + 40, before.player.x);
      await waitFor(page, () => Math.hypot(window.SungaiGame.getState().player.x - 430, window.SungaiGame.getState().player.y - 600) < 30);
      await page.evaluate(() => window.SungaiGame.setDirection(0, 0));
      await page.evaluate(() => window.SungaiGame.debug.teleport(400, 340));
      await clickWorld(page, POINTS.key);
      await waitFor(page, () => window.SungaiGame.getState().hasKey);
      assert.equal((await state(page)).cargoWeight, 1);
      await acknowledge(page);
    });

    await record('3D boat animation crosses the river, cleared crates open the gate and show the winning scene', async () => {
      await page.evaluate(({ x, y }) => window.SungaiGame.debug.teleport(x, y), POINTS.westDock);
      await page.keyboard.press('e');
      await waitFor(page, () => window.SungaiGame.getState().travelling && window.SungaiGame.getState().player.x > 700);
      await page.evaluate(() => window.SungaiGame.pause('qa-capture'));
      await screenshot(page, 'desktop-3d-boat.png');
      assert.equal((await state(page)).travelling, true, 'Boat capture must show an actual crossing');
      await page.evaluate(() => window.SungaiGame.resume('qa-capture'));
      await waitFor(page, () => window.SungaiGame.getState().crossed);
      for (let i = 0; i < 3; i++) await page.evaluate(() => window.SungaiGame.debug.action('crates'));
      await acknowledge(page);
      await page.evaluate(() => window.SungaiGame.debug.action('gate'));
      await page.locator('#ending-dialog').waitFor({ state: 'visible' });
      assert.equal((await state(page)).status, 'won');
      assert.equal((await state(page)).gateOpen, true);
      await screenshot(page, 'desktop-3d-win.png');
      await page.locator('#view-world-button').click();
      await renderedCanvas(page, 'desktop-3d-river-saved');
      await screenshot(page, 'desktop-3d-river-saved.png');
    });

    await record('Low graphics mode and desktop resizing retain genuine 3D rendering', async () => {
      await page.locator('#quality-select').selectOption('low');
      await waitFor(page, () => window.SungaiGame.getRenderStats().quality === 'low');
      const before = await stats(page);
      const oldBufferWidth = await page.locator('#gameCanvas').evaluate(canvas => canvas.width);
      await page.setViewportSize({ width: 1080, height: 800 });
      await waitFor(page, width => document.querySelector('#gameCanvas').width !== width, oldBufferWidth);
      await waitFor(page, frame => window.SungaiGame.getRenderStats().frames > frame + 2, before.frames);
      const after = await renderedCanvas(page, 'desktop-3d-low');
      assert.equal(after.quality, 'low');
      await noOverflow(page, 'desktop resize');
      await screenshot(page, 'desktop-3d-low.png');
    });
    // Release this software-rendered world before testing mobile; its graphics
    // resources should not compete with the next viewport's real WebGL scene.
    await desktop.close();
    }

    await record('Phone portrait, landscape resize and lost-WebGL fallback remain usable', async () => {
      const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      contexts.push(mobile);
      const phone = await mobile.newPage();
      observe(phone, 'phone');
      await phone.goto(`${baseURL}/?test=1`, { waitUntil: 'networkidle' });
      await ready(phone);
      await noOverflow(phone, 'phone title');
      await screenshot(phone, 'phone-3d-title.png');
      await phone.locator('#start-game').tap();
      await acknowledge(phone);
      await renderedCanvas(phone, 'phone-3d-game');
      await noOverflow(phone, 'phone game');
      const control = await phone.locator('.direction-right').boundingBox();
      assert(control && control.width >= 40 && control.height >= 40 && control.x >= 0 && control.x + control.width <= 391, `Unreachable mobile control: ${JSON.stringify(control)}`);
      await screenshot(phone, 'phone-3d-game.png');
      const portraitStats = await stats(phone);
      await phone.setViewportSize({ width: 844, height: 390 });
      await waitFor(phone, previous => {
        const current = window.SungaiGame.getRenderStats();
        return current.width !== previous.width && current.frames > previous.frames;
      }, portraitStats);
      await renderedCanvas(phone, 'phone-3d-landscape');
      await noOverflow(phone, 'phone landscape');
      await screenshot(phone, 'phone-3d-landscape.png');
      assert(await phone.evaluate(() => {
        const gl = document.querySelector('#gameCanvas').getContext('webgl2');
        const extension = gl?.getExtension('WEBGL_lose_context');
        if (!extension) return false;
        extension.loseContext();
        return true;
      }), 'Browser does not expose the WebGL context-loss test extension');
      await phone.locator('#fallback-2d').waitFor({ state: 'visible' });
      assert.equal((await state(phone)).renderMode, 'unavailable');
      assert.equal((await state(phone)).ready, false);
      assert(await phone.locator('#landing').isVisible(), 'Lost context left the player trapped in the game screen');
      await screenshot(phone, 'phone-webgl-context-lost.png');
      await mobile.close();
    });

    await record('Unavailable WebGL exposes an actionable 2D fallback which remains playable', async () => {
      const unavailable = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      contexts.push(unavailable);
      await unavailable.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          return /^(webgl2?|experimental-webgl)$/.test(type) ? null : original.call(this, type, ...args);
        };
      });
      const fallback = await unavailable.newPage();
      await fallback.goto(`${baseURL}/?test=1`, { waitUntil: 'networkidle' });
      await fallback.locator('#fallback-2d').waitFor({ state: 'visible' });
      assert.equal((await state(fallback)).renderMode, 'unavailable');
      assert.equal((await state(fallback)).ready, false);
      assert.equal(await fallback.locator('#start-game').isDisabled(), true);
      assert.match(await fallback.locator('#renderer-status').innerText(), /WebGL|3D|grafik/i);
      assert.match(await fallback.locator('#fallback-2d').getAttribute('href'), /mode=2d/);
      await screenshot(fallback, 'webgl-unavailable.png');
      await fallback.locator('#fallback-2d').click();
      await ready(fallback);
      assert.equal((await state(fallback)).renderMode, '2d');
      await fallback.locator('#start-game').click();
      await acknowledge(fallback);
      assert.equal((await state(fallback)).status, 'playing');
      await screenshot(fallback, 'fallback-2d-playable.png');
    });

    await record('3D sessions have no JavaScript exceptions or missing local resources', async () => {
      assert.deepEqual(errors, []);
    });
  } catch (error) {
    console.error(error.stack || error);
    process.exitCode = 1;
    for (const [contextIndex, context] of contexts.entries()) for (const [pageIndex, page] of context.pages().entries()) {
      await screenshot(page, `failure-${contextIndex}-${pageIndex}.png`).catch(() => {});
    }
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(outputDirectory, reportFilename), JSON.stringify({ baseURL, generatedAt: new Date().toISOString(), backend: 'Chromium WebGL via SwiftShader software rendering; no hardware performance claim', results, errors, renderSamples }, null, 2));
    console.log(`${results.filter(result => result.passed).length}/${results.length} 3D checks passed. Report: ${path.join(outputDirectory, reportFilename)}`);
  }
})();
