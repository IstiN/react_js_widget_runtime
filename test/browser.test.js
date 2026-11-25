// Live-Chromium engine test — the coverage feed for the browser-side code
// (runner.js, mapping widgets, dumpViewTree live paths). Skips when the
// Playwright browser is not installed; CI installs Chromium before npm test
// so the CRAP gate sees real coverage rows (kit precedent).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

test('the runner passes hello and counter in Chromium', async (t) => {
  let chromium;
  try {
    chromium = (await import('playwright')).chromium;
  } catch {
    t.skip('playwright unavailable');
    return;
  }
  let browser;
  const outDir = mkdtempSync(join(tmpdir(), 'jsr-react-test-'));
  try {
    const { runConformance } = await import('../src/conformance/runner.js');
    const { evaluateResult } = await import('../.conformance/js_widget_runtime/harness/evaluate.mjs');
    const { diffTree } = await import('../.conformance/js_widget_runtime/harness/compare.mjs');
    const { normalizeTree } = await import('../.conformance/js_widget_runtime/harness/normalize.mjs');
    const fixturesDir = join(root, '.conformance', 'js_widget_runtime', 'docs', 'conformance', 'fixtures');
    browser = await chromium.launch();
    const results = [];
    for (const filter of ['hello', 'counter', 'l0_tab_bar', 'l0_dropdown', 'l1_on_change', 'l1_on_change_selection', 'l1_on_scroll', 'scroll_list']) {
      results.push(...(await runConformance({
        fixturesDir,
        outDir,
        bundlePath: join(root, 'dist', 'jsr-widget.js'),
        threePath: null,
        browser,
        filter,
      })));
    }
    assert.equal(results.length, 8);
    for (const result of results) {
      assert.equal(result.error, null, `${result.fixture}: ${result.error}`);
      const fixtureDir = join(fixturesDir, result.fixture);
      const expected = JSON.parse(readFileSync(join(fixtureDir, 'expected.json'), 'utf8'));
      const meta = JSON.parse(readFileSync(join(fixtureDir, 'meta.json'), 'utf8'));
      const diffs = evaluateResult({ expected, meta }, result);
      assert.deepEqual(diffs, [], `${result.fixture}: ${JSON.stringify(diffs.slice(0, 3))}`);
      // the initial dump equals the harness-derived tree of render #0
      const expectedDump = normalizeTree(JSON.parse(result.renders[0]));
      const dumpDiffs = diffTree(expectedDump, result.dump, new Set(meta.ignore ?? []));
      assert.deepEqual(dumpDiffs, [], `${result.fixture} dump: ${JSON.stringify(dumpDiffs.slice(0, 3))}`);
    }
  } finally {
    if (browser) await browser.close();
    rmSync(outDir, { recursive: true, force: true });
  }
});
