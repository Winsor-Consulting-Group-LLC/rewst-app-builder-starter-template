#!/usr/bin/env node
'use strict';

/**
 * Local preview launcher.
 *
 * Starts the mock API + static file server on localhost:3000, then opens
 * the app in a headed Chromium window via Playwright.
 *
 * Usage:
 *   npm run preview          — build first, then preview
 *   node preview/preview.js  — preview only (uses existing dist/ output)
 *
 * To preview in VS Code Simple Browser instead of the Playwright window:
 *   1. Run: node preview/server.js   (keeps the mock server running)
 *   2. In VS Code: Cmd/Ctrl+Shift+P → "Simple Browser: Show" → http://localhost:3000
 *
 * Press Ctrl+C to stop.
 */

const { start: startServer, stop: stopServer } = require('./server');

async function main() {
  // Start the mock server first
  await startServer();

  // Try to load Playwright — if not installed yet, bail with a helpful message
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error('\n[preview] Playwright is not installed.');
    console.error('  Run: npm install');
    console.error('  Then: npx playwright install chromium\n');
    console.error('[preview] Mock server is still running at http://localhost:3000');
    console.error('[preview] Open that URL in VS Code Simple Browser or any browser to preview.');
    // Keep server alive so the user can open it manually
    await waitForCtrlC();
    await stopServer();
    return;
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // Log any browser console errors to the terminal for easier debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`[browser] ${msg.text()}`);
      }
    });

    await page.goto('http://localhost:3000');
    console.log('\n[preview] Browser opened at http://localhost:3000');
    console.log('[preview] Press Ctrl+C to stop the server and close the browser.\n');

    // Keep alive until Ctrl+C
    await waitForCtrlC();
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopServer();
  }
}

function waitForCtrlC() {
  return new Promise(resolve => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
}

main().catch(err => {
  console.error('[preview] Fatal error:', err.message);
  process.exit(1);
});
