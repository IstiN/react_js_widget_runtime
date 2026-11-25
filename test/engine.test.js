// WorkerEngine against a real node:worker_threads worker: boot order,
// render channel, event round trip, eval op, host-driven timers and rAF,
// promise channels. The browser path uses the same script over a Blob
// Worker; the host side is createHostBridge, as in production.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { createWorkerEngine } from '../src/engine/WorkerEngine.js';
import { createHostBridge } from '../src/host/hostServices.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const runtimeSource = readFileSync(join(root, 'src/vendor/bootstrap-runtime.js'), 'utf8');
const widgetSource = readFileSync(join(root, 'src/vendor/bootstrap-widget.js'), 'utf8');

function nodeTransport(code) {
  const w = new Worker(code, { eval: true });
  return {
    post: (m) => w.postMessage(m),
    setHandler: (cb) => w.on('message', cb),
    stop: () => w.terminate(),
  };
}

function mapStorage() {
  const map = new Map();
  return {
    get: (k) => (map.has(k) ? map.get(k) : null),
    set: (k, v) => map.set(k, v),
  };
}

// Engine + live host bridge; the bridge registers its message callback
// before run(), so the widget's initial render is never dropped.
function bootEngine(widgetJs, opts = {}) {
  const engine = createWorkerEngine({
    iid: 'test-iid',
    runtimeSource,
    widgetSource,
    widgetJs,
    transport: nodeTransport,
    ...opts,
  });
  const bridge = createHostBridge(engine, { storage: opts.storage ?? mapStorage() });
  const started = engine.run().then(() => ({ engine, bridge }));
  return started;
}

const HELLO = `
jsr.render({ type: 'center', child: { type: 'text', data: 'Hello from JS!' } });
jsr.onEvent(function(actionId) {
  if (actionId === 'tap') { jsr.setTitle('Tapped: 1'); jsr.render({ type: 'center', child: { type: 'text', data: 'Taps: 1' } }); }
});
`;

test('engine boots the halves and the widget; render payload arrives', async () => {
  const { engine, bridge } = await bootEngine(HELLO);
  await settle(100);
  assert.deepEqual(bridge.trace, ['render']);
  const tree = JSON.parse(bridge.renders[0]);
  assert.equal(tree.type, 'center');
  assert.equal(tree.__iid, 'test-iid');
  engine.dispose();
});

test('callEvent runs the widget handler; set_title and second render land', async () => {
  const { engine, bridge } = await bootEngine(HELLO);
  await settle(100);
  engine.callEvent('tap', {});
  await settle(100);
  assert.deepEqual(bridge.trace, ['render', 'set_title', 'render', 'event_done']);
  assert.equal(bridge.title, 'Tapped: 1');
  engine.dispose();
});

test('eval op resolves {ok:true}; a throwing eval reports the error', async () => {
  const { engine, bridge } = await bootEngine('jsr.render({type:"text",data:"x"});');
  await settle(100);
  const ok = await engine.eval('globalThis.__probe = 41 + 1;');
  assert.deepEqual(ok, { ok: true });
  const bad = await engine.eval('throw new Error("boom");');
  assert.equal(bad.ok, false);
  assert.match(bad.error, /boom/);
  const probe = await engine.eval('String(globalThis.__probe)');
  assert.deepEqual(probe, { ok: true });
  assert.equal(bridge.trace.includes('render'), true);
  engine.dispose();
});

test('promise channels resolve through the host (storage round trip)', async () => {
  const storage = mapStorage();
  const widget = `
  jsr.storage.set('k', 'v').then(function () {
    return jsr.storage.get('k');
  }).then(function (v) { console.log('stored:' + v); });
  jsr.render({ type: 'text', data: 'store' });
  `;
  const { engine, bridge } = await bootEngine(widget, { storage });
  await settle(200);
  assert.equal(bridge.consoleLines.includes('stored:v'), true, `console: ${bridge.consoleLines}`);
  engine.dispose();
});

test('main thread drives interval ticks; clear stops them', async () => {
  const widget = `
  var n = 0;
  var id = setInterval(function () { n++; console.log('tick' + n); if (n >= 2) clearInterval(id); }, 20);
  jsr.render({ type: 'text', data: 'timer' });
  `;
  const { engine, bridge } = await bootEngine(widget);
  await settle(400);
  assert.equal(bridge.consoleLines.includes('tick1'), true, `console: ${bridge.consoleLines}`);
  assert.equal(bridge.consoleLines.includes('tick3'), false);
  engine.dispose();
});

test('setTimeout is a once interval; the tick reaches the worker', async () => {
  const widget = `
  setTimeout(function () { console.log('timeout fired'); }, 20);
  jsr.render({ type: 'text', data: 't' });
  `;
  const { engine, bridge } = await bootEngine(widget);
  await settle(200);
  assert.equal(bridge.consoleLines.includes('timeout fired'), true, `console: ${bridge.consoleLines}`);
  engine.dispose();
});

test('main thread drives animation frames', async () => {
  const widget = `
  requestAnimationFrame(function (elapsed) { console.log('raf:' + (elapsed >= 0)); });
  jsr.render({ type: 'text', data: 'raf' });
  `;
  const { engine, bridge } = await bootEngine(widget);
  await settle(200);
  assert.equal(bridge.consoleLines.includes('raf:true'), true, `console: ${bridge.consoleLines}`);
  engine.dispose();
});

test('widget errors surface as the showError render, not a crash', async () => {
  const { engine, bridge } = await bootEngine('throw new Error("widget boom");');
  await settle(100);
  const tree = JSON.parse(bridge.renders[0]);
  assert.equal(tree.type, 'center');
  assert.equal(JSON.stringify(tree).includes('Widget error: widget boom'), true);
  engine.dispose();
});

test('dispose stops callbacks; executePendingJobs is a no-op', async () => {
  const { engine, bridge } = await bootEngine(HELLO);
  await settle(100);
  engine.dispose();
  const traceLen = bridge.trace.length;
  engine.callEvent('tap', {});
  engine.executePendingJobs();
  await settle(100);
  assert.equal(bridge.trace.length, traceLen);
});

test('worker boot errors surface on engine.lastError', async () => {
  let fire = null;
  const errorTransport = (code, onRaw) => {
    return {
      post: () => {},
      setHandler: (cb) => { fire = cb; },
      stop: () => {},
    };
  };
  const engine = createWorkerEngine({
    iid: 'err',
    runtimeSource: '',
    widgetSource: '',
    widgetJs: '',
    transport: errorTransport,
  });
  const started = engine.run().catch((e) => e);
  await settle(20);
  fire(`__jsr__${JSON.stringify({ channel: '__jsr_worker_error', payload: JSON.stringify({ message: 'boot failed' }) })}`);
  await started;
  assert.equal(engine.lastError, 'boot failed');
  engine.dispose();
});

function settle(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
