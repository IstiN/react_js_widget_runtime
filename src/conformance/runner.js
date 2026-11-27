// Conformance runner — plan 1.4 in Chromium. Per fixture: mock server (the
// kit's mock-server module), static server (bundle + harness page + fixture
// assets), boot the widget through mountJsrWidget, apply the actions of
// expected.json through the DOM interaction driver, dump through DOM
// reflection, write result.json. Structure mirrors the kit's
// harness/runner-chromium.mjs where it fits.
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listFixtureIds, loadFixture } from '../../.conformance/js_widget_runtime/harness/fixtures.mjs';
import { createMockServer } from '../../.conformance/js_widget_runtime/harness/mock-server.mjs';
import { createDomInteractionDriver, applyActions } from '../dom/DomInteractionDriver.js';

const SETTLE_AFTER_BOOT_MS = 400;
const SETTLE_AFTER_ACTION_MS = 150;
const SETTLE_FINAL_MS = 400;

// The worker engine answers every handled event with the protocol-mandated
// `__jsr_event_done` (sent by Web Worker engines only). The reference
// runner (QuickJS) never sees it, so the result trace records the
// widget-visible channel flow — the same list the reference produces.
export function resultTrace(trace) {
  return trace.filter((verb) => verb !== 'event_done');
}

// `--filter <glob>`: `*` matches any run of characters, everything else is
// literal (the kit CLI uses the same simple shape).
export function filterFixtureIds(ids, glob) {
  if (!glob) return ids;
  const pattern = new RegExp('^' + glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return ids.filter((id) => pattern.test(id));
}

export function needsPreload(meta) {
  return (meta.capabilities ?? []).includes('three');
}

export function needsMock(meta) {
  return meta.mock !== undefined && Object.keys(meta.mock).length > 0;
}

// result.json per plan 1.4; the dump is the DOM reflection of the mounted
// widget (initial state before actions, final state after).
export function assembleResult({ fixture, status = 'DONE', bridge, dump, finalDump, error = null, skippedReason = null }) {
  return {
    fixture,
    platform: 'web',
    status,
    dump: dump ?? null,
    trace: resultTrace(bridge.trace),
    diffs: [],
    screenshot: null,
    renders: [...bridge.renders],
    finalDump: finalDump ?? null,
    title: bridge.title,
    state: bridge.state === undefined ? null : bridge.state,
    console: [...bridge.consoleLines],
    error,
    skippedReason,
  };
}

const PAGE_BODY = `<!doctype html><html><head><style>
body { margin: 0; background: #0b1220; }
#surface { width: 400px; height: 700px; overflow: hidden; position: relative; }
</style></head><body><div id="surface"></div>
<script>window.__config = __CONFIG__;</script>
<script type="module">
  import { mountJsrWidget } from '/dist/jsr-widget.js';
  const cfg = window.__config;
  let preloadSource = null;
  if (cfg.preloadUrl) preloadSource = await (await fetch(cfg.preloadUrl)).text();
  const widgetJs = await (await fetch('/fixtures/' + cfg.fixtureId + '/widget.js')).text();
  localStorage.clear();
  const handle = mountJsrWidget(document.getElementById('surface'), {
    widgetJs,
    iid: cfg.fixtureId,
    mockOrigin: cfg.mockOrigin,
    assetBase: cfg.assetBase,
    preloadSource,
  });
  window.__jsr = handle;
  // Freeze the initial dump at the FIRST React commit (MutationObserver
  // fires right after the DOM mutation), before any fixture timer can
  // re-render — the reference runner dumps its initial tree the same way.
  const surface = document.getElementById('surface');
  const observer = new MutationObserver(() => {
    if (window.__dump0 === undefined && handle.views() > 0) {
      try { window.__dump0 = handle.dump(); } catch (e) { window.__dump0 = null; window.__dump0Error = e.message; }
      observer.disconnect();
    }
  });
  observer.observe(surface, { childList: true, subtree: true });
  await handle.start();
  const t0 = Date.now();
  while ((window.__dump0 === undefined) && Date.now() - t0 < 2000) {
    await new Promise((r) => setTimeout(r, 15));
  }
  observer.disconnect();
  if (window.__dump0 === undefined) { window.__dump0 = null; window.__dump0Error = 'no first render commit within 2s'; }
  window.__ready = true;
</script></body></html>`;

export function pageHtml(config) {
  return PAGE_BODY.replace('__CONFIG__', JSON.stringify(config));
}

/**
 * runConformance — the whole loop.
 * @param {object} opts
 * @param {string} opts.fixturesDir fixture directory (the kit's)
 * @param {string} opts.outDir result directory (created)
 * @param {string} opts.bundlePath built bundle (dist/jsr-widget.js)
 * @param {string} opts.threePath three.min.js for `three` fixtures
 * @param {object} opts.browser a Playwright browser handle
 * @param {string} [opts.filter] glob over fixture ids
 * @param {function} [opts.onFixture] (id, result) progress hook
 */
export async function runConformance(opts) {
  const { fixturesDir, outDir, bundlePath, threePath, browser, filter, onFixture } = opts;
  const ids = filterFixtureIds(listFixtureIds(fixturesDir), filter);
  mkdirSync(outDir, { recursive: true });
  const { origin, close } = await serveStatic({ bundlePath, threePath, fixturesDir });
  const results = [];
  try {
    for (const id of ids) {
      const fixture = loadFixture(fixturesDir, id);
      const result = await runFixture({ fixture, browser, origin, threePath });
      writeFileSync(join(outDir, `${id}.result.json`), JSON.stringify(result, null, 1) + '\n');
      results.push(result);
      if (onFixture) onFixture(id, result);
    }
  } finally {
    await close();
  }
  return results;
}

async function runFixture({ fixture, browser, origin, threePath }) {
  const mockServer = needsMock(fixture.meta) ? await createMockServer(fixture.meta.mock) : null;
  const context = await browser.newContext();
  const page = await context.newPage();
  let error = null;
  page.on('pageerror', (e) => { if (!error) error = e.message; });
  try {
    const config = fixtureConfig(fixture, mockServer, origin);
    const dumped = await bootPage(page, origin, config);
    error = firstError(dumped.bootProblem, error);
    const final = await settlePage(page, fixture, dumped.dump);
    error = firstError(final.lastError ? `worker: ${final.lastError}` : null, error);
    return assembleResult({
      fixture: fixture.id,
      bridge: final.bridge,
      dump: dumped.dump,
      finalDump: final.finalDump,
      error,
    });
  } catch (e) {
    return assembleResult({
      fixture: fixture.id,
      bridge: { trace: [], renders: [], title: null, state: null, consoleLines: [] },
      dump: null,
      finalDump: null,
      error: error ?? e.message,
    });
  } finally {
    await context.close();
    if (mockServer) await mockServer.close();
  }
}

// page boot config: mock origin, asset base, and the three preload for
// fixtures that declare the `three` capability
function fixtureConfig(fixture, mockServer, origin) {
  return {
    fixtureId: fixture.id,
    mockOrigin: mockServer ? mockServer.origin : '',
    // the static server serves fixture files under /fixtures/<id>/ (resolveStatic)
    assetBase: `${origin}/fixtures/${fixture.id}`,
    preloadUrl: needsPreload(fixture.meta) ? '/preload/three.min.js' : null,
    settle: SETTLE_AFTER_BOOT_MS,
  };
}

function firstError(message, current) {
  return message && !current ? message : current;
}

// Boot: load the page, wait for the frozen initial dump.
async function bootPage(page, origin, config) {
  await page.goto(pageUrl(origin, config));
  await page.waitForFunction('window.__ready === true', null, { timeout: 15000 });
  const bootProblem = await page.evaluate(() => window.__dump0Error ?? null);
  const dump = await page.evaluate(() => window.__dump0);
  return { dump, bootProblem };
}

// Apply actions, settle, and read the final bridge state.
async function settlePage(page, fixture, dump) {
  await applyActionsOnPage(page, fixture.expected.actions);
  await page.waitForTimeout(SETTLE_FINAL_MS);
  const finalDump = await dumpOnPage(page);
  const state = await readBridge(page);
  return { bridge: state.bridge, finalDump, lastError: state.lastError };
}

function pageUrl(origin, config) {
  const params = new URLSearchParams({
    fixture: config.fixtureId,
    mockOrigin: config.mockOrigin,
    assetBase: config.assetBase,
    preloadUrl: config.preloadUrl ?? '',
    settle: String(config.settle),
  });
  return `${origin}/?${params.toString()}`;
}

// Actions run through the driver with a Playwright-backed IO; every action
// settles so async channels land like the reference runner's pumps.
async function applyActionsOnPage(page, actions) {
  const io = playwrightIo(page);
  const driver = createDomInteractionDriver(io);
  await applyActions(driver, actions, async () => page.waitForTimeout(SETTLE_AFTER_ACTION_MS));
}

// A2/A3 swipe: pointer drag with the given duration; the release hands the
// gesture velocity (the action's own distance over duration, never event
// timing) to the scroll container under the start point, which applies its
// synchronous momentum carry (mapping.js flingScroll).
async function dragGesture(page, x1, y1, x2, y2, ms) {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: Math.max(4, Math.min(40, Math.round(ms / 16))) });
  await page.mouse.up();
  await page.waitForTimeout(ms);
  if (y1 !== y2 && ms > 0) {
    await page.evaluate(([x, y, v]) => {
      let el = document.elementFromPoint(x, y);
      while (el && !el.__jsrFling) el = el.parentElement;
      el?.__jsrFling?.(v);
    }, [x1, y1, (y1 - y2) / ms]);
  }
}

function playwrightIo(page) {
  return {
    click: (selector) => page.click(selector, { timeout: 5000 }),
    clickText: async (text) => {
      const clicked = await page.evaluate((wanted) => {
        for (const el of document.querySelectorAll('#surface *')) {
          const direct = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent.trim())
            .join('');
          if (direct === wanted) { el.click(); return true; }
        }
        return false;
      }, text);
      if (!clicked) throw new Error(`tap: no visible text "${text}"`);
    },
    setText: (selector, value) => page.fill(selector, value, { timeout: 5000 }),
    pressEnter: (selector) => page.press(selector, 'Enter', { timeout: 5000 }),
    wheelCenter: async (dx, dy) => {
      const box = await page.locator('#surface').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(dx, dy);
    },
    drag: (x1, y1, x2, y2, ms) => dragGesture(page, x1, y1, x2, y2, ms),
    sleep: (ms) => page.waitForTimeout(ms),
    hostEventBack: () => page.evaluate(() => window.__jsr.engine.hostEvent('back', {})),
  };
}

async function dumpOnPage(page) {
  return page.evaluate(() => window.__jsr.dump());
}

async function readBridge(page) {
  return page.evaluate(() => ({
    bridge: {
      trace: window.__jsr.bridge.trace,
      renders: window.__jsr.bridge.renders,
      title: window.__jsr.bridge.title,
      state: window.__jsr.bridge.state,
      consoleLines: window.__jsr.bridge.consoleLines,
    },
    lastError: window.__jsr.engine.lastError,
  }));
}

// Static server: the built bundle, the fixture assets (loadAsset), the
// three preload, and the per-fixture harness page (config via query).
function serveStatic({ bundlePath, threePath, fixturesDir }) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      respondStatic(server, req, res, { bundlePath, threePath, fixturesDir });
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() });
    });
  });
}

// one route lookup: {body, type} or null for 404
export function resolveStatic(server, url, { bundlePath, threePath, fixturesDir }) {
  if (url.pathname === '/') {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const fixtureId = url.searchParams.get('fixture') ?? 'hello';
    return {
      body: pageHtml({
        fixtureId,
        mockOrigin: url.searchParams.get('mockOrigin') ?? '',
        assetBase: url.searchParams.get('assetBase') ?? `${origin}/fixtures/${fixtureId}`,
        preloadUrl: url.searchParams.get('preloadUrl') || null,
        settle: Number(url.searchParams.get('settle') ?? SETTLE_AFTER_BOOT_MS),
      }),
      type: 'text/html',
    };
  }
  if (url.pathname === '/dist/jsr-widget.js') return { body: readFileSync(bundlePath), type: 'text/javascript' };
  if (url.pathname === '/preload/three.min.js') return { body: readFileSync(threePath), type: 'text/javascript' };
  if (url.pathname.startsWith('/fixtures/')) {
    return {
      body: readFileSync(join(fixturesDir, decodeURIComponent(url.pathname.slice('/fixtures/'.length)))),
      type: 'text/plain',
    };
  }
  return null;
}

function respondStatic(server, req, res, paths) {
  const url = new URL(req.url, 'http://local');
  let found = null;
  try {
    found = resolveStatic(server, url, paths);
  } catch {
    found = null;
  }
  if (!found || found.body === null) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': found.type });
  res.end(found.body);
}
