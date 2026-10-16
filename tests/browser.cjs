'use strict';

const { chromium } = require('playwright');

// CI has no physical GPU. SwiftShader still executes the real WebGL pipeline;
// these checks must not be presented as hardware GPU performance benchmarks.
function launchBrowser() {
  return chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--enable-webgl',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage'
    ]
  });
}

module.exports = { launchBrowser };
