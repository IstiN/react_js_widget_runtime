// dumpViewTree: the DOM dump of the three seeds equals what the harness
// derives (normalizeTree(result.renders[0])), diffed with the kit's own
// comparator (harness/compare.mjs diffTree). The DOM is the fake DOM built
// from the same React elements react-dom renders in the browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderJsrTree } from '../src/dom/mapping.js';
import { dumpViewTree } from '../src/dom/dumpViewTree.js';
import { normalizeTree } from '../.conformance/js_widget_runtime/harness/normalize.mjs';
import { diffTree } from '../.conformance/js_widget_runtime/harness/compare.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const samples = join(here, '..', '.conformance', 'js_widget_runtime', 'docs', 'conformance', 'samples', 'flutter');

function sample(fixture) {
  return JSON.parse(readFileSync(join(samples, `${fixture}.result.json`), 'utf8'));
}

// Minimal element tree mirroring React's output: createElement -> node.
function instantiate(el) {
  const node = {
    tag: el.type,
    attrs: {},
    children: [],
    text: '',
    value: el.type === 'input' ? (el.props.defaultValue ?? '') : undefined,
  };
  for (const [k, v] of Object.entries(el.props ?? {})) {
    if (k === 'children' || k === 'key' || k === 'onClick' || k === 'onChange') continue;
    node.attrs[k] = k === 'style' ? styleToString(v) : String(v);
  }
  const kids = Array.isArray(el.props?.children) ? el.props.children.flat(Infinity) : el.props?.children ? [el.props.children] : [];
  for (const child of kids) {
    if (child === null || child === undefined || child === false) continue;
    if (typeof child === 'object') node.children.push(instantiate(child));
    else node.text += String(child);
  }
  return node;
}

function styleToString(style) {
  return Object.entries(style ?? {}).map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}: ${v}`).join('; ');
}

test('the dump of each seed equals the harness-derived expected tree', () => {
  for (const fixture of ['hello', 'counter', 'scroll_list']) {
    const result = sample(fixture);
    const expected = normalizeTree(JSON.parse(result.renders[0]));
    const { element, record } = renderJsrTree(result.renders[0]);
    const dom = instantiate(element);
    const dump = dumpViewTree(dom, record);
    const diffs = diffTree(expected, dump);
    assert.deepEqual(diffs, [], `${fixture}: ${JSON.stringify(diffs)}`);
    assert.equal(dump.nodeId, 'n0');
  }
});

test('hello and counter dumps match the committed reference dumps', () => {
  // scroll_list is excluded: the reference runner's Flutter dumpViewTree
  // legitimately diverges from the payload-derived tree there (ListView
  // builds rows lazily, so its element dump carries leaf containers). The
  // harness rule — dump equals normalizeTree(renders[0]) — holds for all
  // three seeds in the test above.
  for (const fixture of ['hello', 'counter']) {
    const result = sample(fixture);
    const { element, record } = renderJsrTree(result.renders[0]);
    const dump = dumpViewTree(instantiate(element), record);
    const diffs = diffTree(result.dump, dump);
    assert.deepEqual(diffs, [], `${fixture}: ${JSON.stringify(diffs)}`);
  }
});

test('a text node missing from the record is an error, not a silent skip', () => {
  const { element, record } = renderJsrTree({ type: 'text', data: 'x' });
  const dom = instantiate(element);
  record.delete('n0');
  assert.throws(() => dumpViewTree(dom, record), /no applied record/);
});

test('live text override reads back typed input values', () => {
  const { element, record } = renderJsrTree({ type: 'textField', value: 'seed', placeholder: 'hint here' });
  const dom = instantiate(element);
  dom.value = 'typed by user';
  const dump = dumpViewTree(dom, record);
  assert.equal(dump.props.initialValue, 'typed by user');
  assert.equal(dump.props.hint, 'hint here');
});
