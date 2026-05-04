#!/usr/bin/env node
/**
 * Deploy Script
 * POSTs the compiled HTML to the Rewst webhook endpoint.
 *
 * Usage: node deploy.js
 * Typically called automatically at the end of node build.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUTPUT_PATH = path.join(__dirname, 'dist/dashboard-spa-main-compiled.html');
const DEPLOY_URL = 'https://engine.rewst.io/webhooks/custom/trigger/019df421-ec82-72f6-a3a2-8e368de73251/084a09f0-13f5-4cf2-bdab-b01bf9f51504';

if (!fs.existsSync(OUTPUT_PATH)) {
  console.error('Deploy failed: compiled HTML not found at', OUTPUT_PATH);
  process.exit(1);
}

const html = fs.readFileSync(OUTPUT_PATH, 'utf8');
const payload = JSON.stringify({ html_payload: html });

const url = new URL(DEPLOY_URL);
const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'x-rewst-secret': '12345',
  },
};

console.log('\nDeploying to Rewst...');

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      console.log(`Deploy successful (HTTP ${res.statusCode})`);
      if (body) console.log('Response:', body);
    } else {
      console.error(`Deploy failed (HTTP ${res.statusCode}): ${body}`);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error('Deploy error:', err.message);
  process.exit(1);
});

req.write(payload);
req.end();
