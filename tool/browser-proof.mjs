// Local browser proof (R1): serve the bundle, mount `hello` and `counter`
// in Chromium, dump through DOM reflection, and tap the counter's +1
// button — one real engine run per widget. R2 builds the full runner.
// Run: npm run build && npm run proof
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeTree } from '../.conformance/js_widget_runtime/harness/normalize.mjs';
import { diffTree } from '../.conformance/js_widget_runtime/harness/compare.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const fixtures = join(root, '.conformance', 'js_widget_runtime', 'docs', 'conformance', 'fixtures');

const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };

const PAGE = `<!doctype html><html><body>
<div id="hello"></div><div id="counter"></div>
<script type="module">
  import { mountJsrWidget } from '/dist/jsr-widget.js';
  const mounts = {};
  window.__mounts = mounts;
  async function boot(id, containerId) {
    const widgetJs = await (await fetch('/fixtures/' + id + '/widget.js')).text();
    const handle = mountJsrWidget(document.getElementById(containerId), { iid: id, widgetJs });
    mounts[id] = handle;
    await handle.start();
  }
  await Promise.all([boot('hello', 'hello'), boot('counter', 'counter')]);
  window.__ready = true;
</script></body></html>`;

function serve() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://x');
      let body = null;
      if (url.pathname === '/') body = PAGE;
      else if (url.pathname === '/dist/jsr-widget.js') body = readFileSync(join(root, 'dist/jsr-widget.js'));
      else if (url.pathname.startsWith('/fixtures/')) {
        const rel = url.pathname.slice('/fixtures/'.length).replace(/\.\./g, '');
        body = readFileSync(join(fixtures, rel));
      }
      if (body === null) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': MIME[extname(url.pathname)] ?? (url.pathname === '/' ? 'text/html' : 'application/octet-stream') });
      res.end(body);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

const { server, origin } = await serve();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`page console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => console.log(`page error: ${e.message}`));
  await page.goto(origin);
  await page.waitForFunction('window.__ready === true', null, { timeout: 15000 });

  const results = {};
  for (const id of ['hello', 'counter']) {
    const state = await page.evaluate((widgetId) => {
      const handle = window.__mounts[widgetId];
      const el = document.getElementById(widgetId);
      const base = {
        renders: handle.bridge.renders,
        title: handle.bridge.title,
        trace: handle.bridge.trace,
        lastError: handle.engine.lastError,
        html: el.innerHTML.slice(0, 200),
      };
      try {
        return { dump: handle.dump(), ...base };
      } catch (e) {
        return { dump: undefined, error: e.message, ...base };
      }
    }, id);
    if (state.dump === undefined) {
      throw new Error(`${id} no dump: ${state.error} trace=${JSON.stringify(state.trace)} lastError=${state.lastError} renders=${state.renders.length} html=${state.html}`);
    }
    const expected = normalizeTree(JSON.parse(state.renders[0]));
    const diffs = diffTree(expected, state.dump);
    if (diffs.length > 0) throw new Error(`${id} dump diffs: ${JSON.stringify(diffs)}`);
    results[id] = state;
    console.log(`proof: ${id} dump matches normalizeTree(renders[0]) (${countNodes(expected)} nodes)`);
  }

  // one tap on the +1 button changes the counter text (expected.json of
  // counter: finalDumpDelta text[1].data -> "1")
  await page.locator('[data-node-type="textButton"]', { hasText: '+1' }).click();
  await page.waitForFunction(
    () => {
      const handle = window.__mounts.counter;
      return handle.dump().children[0].children[1].props.data === '1';
    },
    null,
    { timeout: 10000 },
  );
  const after = await page.evaluate(() => {
    const handle = window.__mounts.counter;
    return { renders: handle.bridge.renders.length, data: handle.dump().children[0].children[1].props.data, trace: handle.bridge.trace };
  });
  console.log(`proof: counter +1 tap -> text[1].data = ${JSON.stringify(after.data)}, renders = ${after.renders}, trace = ${after.trace.join(' ')}`);
  results.counterAfter = after;
  console.log('PROOF PASS');
} finally {
  await browser.close();
  server.close();
}

function countNodes(n) {
  return 1 + (n.children ?? []).reduce((a, c) => a + countNodes(c), 0);
}
