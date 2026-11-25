#!/usr/bin/env node
// Conformance CLI: run fixtures in Chromium and write result.json files.
//   node tool/conformance.mjs --fixtures <dir> --out <dir> [--filter <glob>]
// Exits 0 when every fixture ran (DONE or SKIP); the harness `compare`
// command judges the results.
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runConformance } from '../src/conformance/runner.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kit = resolve(root, '.conformance', 'js_widget_runtime');

function argOf(name, fallback = undefined) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const fixturesDir = resolve(argOf('--fixtures', resolve(kit, 'docs', 'conformance', 'fixtures')));
const outDir = resolve(argOf('--out', 'out/conformance'));
const filter = argOf('--filter');

const browser = await chromium.launch();
try {
  let done = 0;
  const results = await runConformance({
    fixturesDir,
    outDir,
    bundlePath: resolve(root, 'dist/jsr-widget.js'),
    threePath: resolve(root, '.conformance/js_runtime/libs/three/three.min.js'),
    browser,
    filter,
    onFixture: (id, result) => {
      done++;
      const mark = result.status === 'DONE' ? (result.error ? 'ERR' : 'ok') : result.status;
      process.stdout.write(`[${done}] ${id} ${mark}${result.error ? ': ' + result.error.slice(0, 120) : ''}\n`);
    },
  });
  const errors = results.filter((r) => r.error).length;
  console.log(`results: ${results.length} written to ${outDir} (${errors} with error field)`);
} finally {
  await browser.close();
}
