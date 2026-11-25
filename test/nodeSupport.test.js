// node-support.json and dom-mapping.md are generated from the mapping
// registry (plan: the smallest truthful generator is a unit test that
// writes the file and fails on drift).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

test('docs/node-support.json covers every registered type with the registry status', () => {
  const support = JSON.parse(readFileSync(join(root, 'docs', 'node-support.json'), 'utf8'));
  const nodes = support.nodes;
  assert.equal(Object.keys(nodes).length >= 87, true, '87 registered types');
  assert.deepEqual(nodes.center, { status: 'yes' });
  assert.deepEqual(nodes.chart, { status: 'partial', reason: 'host contract' });
  assert.equal(nodes.absoluteFill.status, 'partial');
  assert.equal(nodes.absoluteFill.reason, 'fallback');
});

test('generated docs are in sync with the mapping registry (drift check)', () => {
  execFileSync(process.execPath, [join(root, 'tool', 'gen-support-docs.mjs'), '--check'], { stdio: 'pipe' });
});
