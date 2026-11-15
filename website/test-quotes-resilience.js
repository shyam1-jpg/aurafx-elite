/**
 * Proves CoinGecko HTML/429 and a bad FX backup response cannot crash the quotes server.
 * Run: node test-quotes-resilience.js
 *
 * Child process stubs https.get:
 *   - first CoinGecko gold + crypto calls return JSON prices
 *   - later CoinGecko calls return HTTP 429 HTML
 *   - open.er-api.com returns HTTP 502 HTML
 *   - Yahoo returns JSON, except silver (SI=F) which has no price
 */
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const PORT = Number(process.env.QUOTES_TEST_PORT) || 39221;
const UPSTREAM_MS = 700;
const CYCLES = 5;
const ARTIFACT = process.env.QUOTES_TEST_LOG || '/opt/cursor/artifacts/quotes-resilience.log';

function urlOf(url) {
  if (typeof url === 'string') return url;
  if (url && typeof url.href === 'string') return url.href;
  return '';
}

function installStub() {
  const https = require('https');
  const origGet = https.get;
  let goldServed = false;
  let cryptoServed = false;

  function respond(status, headers, body, callback) {
    const res = new EventEmitter();
    res.statusCode = status;
    res.headers = headers;
    const req = new EventEmitter();
    req.destroy = function () { return req; };
    req.setTimeout = function () { return req; };
    req.end = function () { return req; };
    process.nextTick(() => {
      callback(res);
      process.nextTick(() => {
        res.emit('data', body);
        res.emit('end');
      });
    });
    return req;
  }

  https.get = function (url, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    const u = urlOf(url);
    let parsed;
    try { parsed = new URL(u); } catch (e) { parsed = null; }
    const host = parsed ? parsed.host : '';

    if (host === 'api.coingecko.com') {
      if (u.includes('pax-gold') && !goldServed) {
        goldServed = true;
        console.error('[quote-test-stub] 200 JSON CoinGecko gold');
        return respond(200, { 'content-type': 'application/json' }, JSON.stringify({
          'pax-gold': { usd: 2401.5, usd_24h_change: 0.4 },
          'tether-gold': { usd: 2402.5, usd_24h_change: 0.3 }
        }), callback);
      }
      if (u.includes('bitcoin') && !cryptoServed) {
        cryptoServed = true;
        console.error('[quote-test-stub] 200 JSON CoinGecko crypto');
        return respond(200, { 'content-type': 'application/json' }, JSON.stringify({
          bitcoin: { usd: 65000, usd_24h_change: 1.2 },
          ethereum: { usd: 3200, usd_24h_change: -0.4 }
        }), callback);
      }
      console.error('[quote-test-stub] 429 HTML CoinGecko');
      return respond(429, {
        'content-type': 'text/html',
        'retry-after': '30'
      }, '<html><title>429 Too Many Requests</title><body>rate limited</body></html>', callback);
    }

    if (host === 'open.er-api.com') {
      console.error('[quote-test-stub] 502 HTML open.er-api.com');
      return respond(502, { 'content-type': 'text/html' }, '<html><title>502 Bad Gateway</title></html>', callback);
    }

    if (host === 'query1.finance.yahoo.com') {
      if (u.includes('SI%3DF') || u.includes('SI=F')) {
        return respond(200, { 'content-type': 'application/json' }, JSON.stringify({ chart: { result: [] } }), callback);
      }
      const gold = u.includes('GC%3DF') || u.includes('GC=F');
      return respond(200, { 'content-type': 'application/json' }, JSON.stringify({
        chart: {
          result: [{
            meta: {
              regularMarketPrice: gold ? 2350.5 : 1.25,
              chartPreviousClose: gold ? 2340 : 1.2,
              regularMarketTime: Math.floor(Date.now() / 1000)
            }
          }]
        }
      }), callback);
    }

    return origGet.apply(this, arguments);
  };
}

function reproOldUnhandledRejection() {
  const script = [
    "const p = Promise.reject(new Error('Bad JSON from https://api.coingecko.com/api/v3/simple/price?ids=bitcoin'));",
    'p.catch(function (e) { throw e; });',
    "setTimeout(function () { console.log('STILL_ALIVE'); }, 400);"
  ].join('\n');
  return spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 3000 });
}

function get(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port: PORT, path: urlPath, timeout: 8000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout ' + urlPath));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeArtifact(text) {
  try {
    fs.mkdirSync(path.dirname(ARTIFACT), { recursive: true });
    fs.writeFileSync(ARTIFACT, text);
  } catch (e) {
    console.error('Could not write artifact:', e.message);
  }
}

async function runParent() {
  const lines = [];
  const say = (line) => {
    lines.push(line);
    console.log(line);
  };

  say('node ' + process.version);
  say('');
  say('--- diagnosis: un-awaited rethrow (the 79b063b stale-refresh pattern) ---');
  const old = reproOldUnhandledRejection();
  const oldOut = ((old.stdout || '') + (old.stderr || '')).trim();
  say('exit=' + old.status + ' signal=' + (old.signal || ''));
  oldOut.split(/\r?\n/).slice(0, 12).forEach((line) => say(line));
  if (old.status !== 1 || /STILL_ALIVE/.test(old.stdout || '')) {
    say('FAIL: expected that pattern to exit 1 before STILL_ALIVE');
    writeArtifact(lines.join('\n') + '\n');
    process.exit(1);
  }
  say('PASS: process exited 1 and did not stay alive');
  say('');

  const child = spawn(process.execPath, [__filename], {
    cwd: __dirname,
    env: Object.assign({}, process.env, {
      AURAFX_QUOTES_TEST_CHILD: '1',
      PORT: String(PORT),
      HOST: '127.0.0.1',
      QUOTES_UPSTREAM_MS: String(UPSTREAM_MS),
      LIVE_TICK_MS: String(UPSTREAM_MS),
      CLIENT_POLL_SEC: '1',
      FINNHUB_API_KEY: '',
      DATABASE_URL: '',
      RENDER: '',
      NODE_ENV: 'test'
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let log = '';
  let serverExit = null;
  child.stdout.on('data', (b) => { log += b.toString(); });
  child.stderr.on('data', (b) => { log += b.toString(); });
  child.on('exit', (code, signal) => { serverExit = { code: code, signal: signal }; });

  const fail = (message) => {
    say('FAIL: ' + message);
    say('--- server log ---');
    say(log);
    if (!serverExit) child.kill('SIGTERM');
    writeArtifact(lines.join('\n') + '\n' + log);
    process.exit(1);
  };

  const started = Date.now();
  while (!log.includes('AURAFX SERVER IS RUNNING')) {
    if (serverExit) return fail('server exited during startup ' + JSON.stringify(serverExit));
    if (Date.now() - started > 15000) return fail('server did not start');
    await sleep(50);
  }
  say('server pid=' + child.pid + ' listening on 127.0.0.1:' + PORT);
  say('CoinGecko stub: first gold+crypto JSON, then HTTP 429 HTML. er-api: HTTP 502 HTML. Yahoo silver: no price.');
  say('');

  let primed = null;
  const primeStart = Date.now();
  while (!primed) {
    if (serverExit) return fail('server exited while priming ' + JSON.stringify(serverExit));
    if (Date.now() - primeStart > 10000) return fail('quotes never returned BTC');
    const q = await get('/api/quotes');
    if (q.status === 200) {
      const body = JSON.parse(q.body);
      if (body.crypto && body.crypto.BTC === 65000) primed = body;
    }
    if (!primed) await sleep(100);
  }
  say('primed /api/quotes 200 BTC=' + primed.crypto.BTC + ' ETH=' + primed.crypto.ETH + ' source=' + primed.source);

  const crashStart = Date.now();
  while (!/HTTP 429 from api\.coingecko\.com/.test(log)) {
    if (serverExit) return fail('server exited before CoinGecko 429 ' + JSON.stringify(serverExit));
    if (Date.now() - crashStart > 10000) return fail('CoinGecko 429 was not observed');
    await sleep(100);
  }
  say('observed CoinGecko HTTP 429 non-JSON handling in the server log');
  await sleep(200);

  for (let i = 1; i <= CYCLES; i++) {
    if (serverExit) return fail('server died before cycle ' + i + ' ' + JSON.stringify(serverExit));
    const home = await get('/');
    const quotes = await get('/api/quotes');
    let body = null;
    try { body = JSON.parse(quotes.body); } catch (e) { body = null; }
    const btc = body && body.crypto ? body.crypto.BTC : null;
    const eth = body && body.crypto ? body.crypto.ETH : null;
    const eurusd = body && body.forex ? body.forex.EURUSD : null;
    const xag = body && body.metals ? body.metals.XAGUSD : null;
    const xau = body && body.metals ? body.metals.XAUUSD : null;
    say(
      'cycle ' + i +
      ' GET / -> ' + home.status +
      '  GET /api/quotes -> ' + quotes.status +
      ' BTC=' + btc +
      ' ETH=' + eth +
      ' EURUSD=' + eurusd +
      ' XAUUSD=' + xau +
      ' XAGUSD=' + (xag == null ? 'omitted' : xag) +
      ' live=' + (body && body.live) +
      ' pidAlive=' + (serverExit ? 'no' : 'yes') +
      ' source=' + (body && body.source)
    );
    if (home.status !== 200) return fail('GET / status ' + home.status);
    if (!/<html/i.test(home.body) && !/Aura/i.test(home.body)) return fail('GET / was not the site HTML');
    if (quotes.status !== 200) return fail('GET /api/quotes status ' + quotes.status);
    if (!body || body.crypto.BTC !== 65000 || body.crypto.ETH !== 3200) {
      return fail('crypto last-good prices were not kept');
    }
    if (body.forex.EURUSD !== 1.25) return fail('EURUSD was not the Yahoo price');
    if (body.metals.XAGUSD != null) return fail('silver was fabricated: ' + body.metals.XAGUSD);
    if (typeof body.metals.XAUUSD !== 'number' || !isFinite(body.metals.XAUUSD)) return fail('gold missing');
    if (body.live !== true) return fail('quotes marked not live while real prices are cached');
    if (/unhandledRejection/i.test(log)) return fail('unhandledRejection was logged');
    if (i < CYCLES) await sleep(UPSTREAM_MS + 100);
  }

  if (serverExit) return fail('server exited during refresh cycles ' + JSON.stringify(serverExit));
  if (!/backing off/.test(log)) return fail('429 backoff was not logged');
  if (!/Bad JSON from open\.er-api\.com/.test(log)) return fail('er-api non-JSON was not handled');
  if (!/last good crypto/.test(log) && !/last good crypto/.test(lines.join('\n'))) {
    return fail('cache did not record last good crypto');
  }

  say('');
  say('PASS: process stayed up for ' + CYCLES + ' refresh cycles after CoinGecko HTML 429');
  say('pid ' + child.pid + ' still running; stopping test server');
  child.kill('SIGTERM');
  const killWait = Date.now();
  while (!serverExit && Date.now() - killWait < 3000) await sleep(50);
  if (!serverExit) child.kill('SIGKILL');

  say('');
  say('--- server log (warnings) ---');
  log.split(/\r?\n/).filter((line) => /AuraFX quotes|quote-test-stub|unhandledRejection|AURAFX SERVER/.test(line)).forEach((line) => say(line));

  const text = lines.join('\n') + '\n';
  writeArtifact(text);
  say('wrote ' + ARTIFACT);
}

if (process.env.AURAFX_QUOTES_TEST_CHILD === '1') {
  installStub();
  require('./simple-server');
} else {
  runParent().catch((e) => {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
  });
}
