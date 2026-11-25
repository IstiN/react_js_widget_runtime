// Host services: exec/host_call/capture named errors, fetch against a real
// local server, storage round trip, in-memory secrets, loadAsset, openUrl,
// timer scheduling and cancellation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHostBridge } from '../src/host/hostServices.js';

function fakeEngine() {
  return {
    resolves: [],
    ticks: [],
    resolveCallback(id, value) { this.resolves.push([id, value]); },
    intervalTick(id) { this.ticks.push(id); },
    rafTick(id) { this.ticks.push(id); },
    callEvent() {},
    setMessageCallback() {},
  };
}

function mapStorage() {
  const map = new Map();
  return {
    get: (k) => (map.has(k) ? map.get(k) : null),
    set: (k, v) => map.set(k, v),
  };
}

function makeBridge(opts = {}) {
  const engine = fakeEngine();
  const bridge = createHostBridge(engine, opts);
  const send = (channel, payload) => bridge.dispatch(channel, payload);
  return { bridge, engine, send };
}

test('exec, host_call and capture resolve the documented named error', async () => {
  const { engine, send } = makeBridge();
  send('__jsr_exec', JSON.stringify({ iid: 'x', id: 'a', cmd: 'ls' }));
  send('__jsr_host_call', JSON.stringify({ iid: 'x', id: 'b', name: 'fn', args: {} }));
  send('__jsr_capture', JSON.stringify({ iid: 'x', id: 'c', opts: {} }));
  await settle(20);
  const values = engine.resolves.map(([, v]) => v.__error);
  assert.deepEqual(values, [
    '__jsr_exec is not supported by this host',
    '__jsr_host_call is not supported by this host',
    '__jsr_capture is not supported by this host',
  ]);
});

test('fetch resolves parsed JSON; HTTP errors are named', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/data') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ temp: 21 }));
    } else {
      res.writeHead(503);
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const { engine, send } = makeBridge();
  send('__jsr_fetch', JSON.stringify({ iid: 'x', id: 'f1', url: `${origin}/data`, method: 'GET', headers: {} }));
  send('__jsr_fetch', JSON.stringify({ iid: 'x', id: 'f2', url: `${origin}/boom`, method: 'GET', headers: {} }));
  await settle(300);
  assert.deepEqual(engine.resolves[0], ['f1', { temp: 21 }]);
  assert.deepEqual(engine.resolves[1], ['f2', { __error: 'HTTP 503' }]);
  server.close();
});

test('storage rides the injected backend; get misses resolve null', async () => {
  const storage = mapStorage();
  const { engine, send } = makeBridge({ storage });
  send('__jsr_storage_set', JSON.stringify({ iid: 'x', key: 'k', value: { n: 1 } }));
  send('__jsr_storage_get', JSON.stringify({ iid: 'x', id: 'g1', key: 'k' }));
  send('__jsr_storage_get', JSON.stringify({ iid: 'x', id: 'g2', key: 'missing' }));
  await settle(20);
  assert.deepEqual(engine.resolves, [
    ['g1', { n: 1 }],
    ['g2', null],
  ]);
  assert.deepEqual(storage.get('k'), { n: 1 });
});

test('secrets are in-memory and never leave the host', async () => {
  const secrets = new Map();
  const { engine, send } = makeBridge({ secrets });
  send('__jsr_secrets_set', JSON.stringify({ iid: 'x', id: 's1', key: 'token', value: 'sekrit' }));
  send('__jsr_secrets_get', JSON.stringify({ iid: 'x', id: 's2', key: 'token' }));
  send('__jsr_secrets_get', JSON.stringify({ iid: 'x', id: 's3', key: 'nope' }));
  await settle(20);
  assert.equal(secrets.get('token'), 'sekrit');
  assert.deepEqual(engine.resolves, [['s1', true], ['s2', 'sekrit'], ['s3', null]]);
});

test('loadAsset fetches text from the asset base; failures resolve null', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/hello.txt') {
      res.writeHead(200);
      res.end('asset body');
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const { engine, send } = makeBridge({ assetBase: base });
  send('__jsr_load_asset', JSON.stringify({ iid: 'x', id: 'a1', path: 'hello.txt' }));
  send('__jsr_load_asset', JSON.stringify({ iid: 'x', id: 'a2', path: 'missing.txt' }));
  await settle(300);
  assert.deepEqual(engine.resolves, [['a1', 'asset body'], ['a2', null]]);
  server.close();
});

test('openUrl calls the injected opener', async () => {
  const opened = [];
  const { send } = makeBridge({ open: (url) => { opened.push(url); return true; } });
  send('__jsr_open_url', JSON.stringify({ iid: 'x', id: 'o1', url: 'https://example.invalid' }));
  await settle(20);
  assert.deepEqual(opened, ['https://example.invalid']);
});

test('interval repeats on the main thread; once fires exactly one tick; clear cancels', async () => {
  const { engine, send } = makeBridge();
  send('__jsr_set_interval', JSON.stringify({ iid: 'x', id: 'i1', ms: 15 }));
  send('__jsr_set_interval', JSON.stringify({ iid: 'x', id: 'i2', ms: 15, once: true }));
  await settle(60);
  send('__jsr_clear_interval', 'i1');
  send('__jsr_caf', 'i1');
  const i1Ticks = engine.ticks.filter((id) => id === 'i1').length;
  await settle(60);
  assert.equal(i1Ticks >= 1, true, `ticks: ${engine.ticks}`);
  assert.equal(engine.ticks.filter((id) => id === 'i2').length, 1);
  const i1AfterClear = engine.ticks.filter((id) => id === 'i1').length;
  assert.equal(i1AfterClear, i1Ticks);
});

test('trace records verbs and unsupported promise channels do not resolve without id', async () => {
  const { bridge, engine, send } = makeBridge();
  send('__jsr_render', '{"type":"text","data":"x"}');
  send('__jsr_set_title', 'hi');
  send('__jsr_log', 'note');
  send('__jsr_export_state', JSON.stringify({ count: 2 }));
  send('__jsr_exec', 'not json with id'); // payload without an id: dropped
  assert.deepEqual(bridge.trace, ['render', 'set_title', 'log', 'export_state', 'exec']);
  assert.deepEqual(bridge.renders, ['{"type":"text","data":"x"}']);
  assert.equal(bridge.title, 'hi');
  assert.deepEqual(bridge.consoleLines, ['note']);
  assert.deepEqual(bridge.state, { count: 2 });
  assert.equal(engine.resolves.length, 0);
});

function settle(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
