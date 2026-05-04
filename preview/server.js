'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { getMockResponse, setWorkflowIds } = require('./mock-data');

const PORT = 3000;
const DIST_HTML = path.join(__dirname, '..', 'dist', 'dashboard-spa-main-compiled.html');

// ─────────────────────────────────────────────────────────────────────────────
// Load workflow IDs so mock-data can map UUIDs → scenario keys
// ─────────────────────────────────────────────────────────────────────────────

const WF_LOCAL   = path.join(__dirname, '..', 'src', 'workflow-ids.local.js');
const WF_EXAMPLE = path.join(__dirname, '..', 'src', 'workflow-ids.example.js');
const wfSource   = fs.existsSync(WF_LOCAL) ? WF_LOCAL : WF_EXAMPLE;

// Extract WORKFLOW_IDS object without running the file in a browser context
// (strip the `window.WORKFLOW_IDS = ...` lines and eval the rest)
try {
  const raw = fs.readFileSync(wfSource, 'utf8')
    .replace(/window\.\w+\s*=\s*\w+;?/g, '')   // remove window.X = Y assignments
    .replace(/const WORKFLOW_STEPS[\s\S]*/m, ''); // drop WORKFLOW_STEPS onwards

  // eslint-disable-next-line no-new-func
  const getIds = new Function(`${raw}; return WORKFLOW_IDS;`);
  const ids = getIds();

  // Invert: { KEY: 'uuid' } → { 'uuid': 'KEY' }
  const inverted = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]));
  setWorkflowIds(inverted);
  console.log(`[server] Loaded ${Object.keys(inverted).length} workflow IDs from ${path.basename(wfSource)}`);
} catch (e) {
  console.warn('[server] Could not parse workflow IDs:', e.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP server
// ─────────────────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // ── GraphQL mock endpoint ──────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/graphql') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { operationName, variables } = JSON.parse(body);
        console.log(`[graphql] ${operationName}`, variables ? JSON.stringify(variables).slice(0, 120) : '');
        const response = getMockResponse(operationName, variables || {});
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify(response));
      } catch (e) {
        console.error('[graphql] parse error:', e.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errors: [{ message: 'Bad request' }] }));
      }
    });
    return;
  }

  // ── CORS preflight ─────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // ── Serve compiled HTML ────────────────────────────────────────────────────
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    if (!fs.existsSync(DIST_HTML)) {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('Run `node build.js` first to generate dist/dashboard-spa-main-compiled.html');
      return;
    }
    const html = fs.readFileSync(DIST_HTML, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

function start() {
  return new Promise((resolve, reject) => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[server] Listening on http://localhost:${PORT}`);
      resolve(PORT);
    });
    server.once('error', reject);
  });
}

function stop() {
  return new Promise(resolve => server.close(resolve));
}

module.exports = { start, stop };

// Allow running standalone: node preview/server.js
if (require.main === module) {
  start().catch(err => {
    console.error('[server] Failed to start:', err.message);
    process.exit(1);
  });
}
