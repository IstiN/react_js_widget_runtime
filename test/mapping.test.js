// DOM mapping: seeds via react-dom/server, effect props as CSS, alias
// resolution through the one normalization, widget `key` reconciliation,
// fallback card for unimplemented registered types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderJsrTree, MAPPED_TYPES } from '../src/dom/mapping.js';

const here = dirname(fileURLToPath(import.meta.url));
const samples = join(here, '..', '.conformance', 'js_widget_runtime', 'docs', 'conformance', 'samples', 'flutter');

function sample(fixture) {
  return JSON.parse(readFileSync(join(samples, `${fixture}.result.json`), 'utf8'));
}

function markupOf(payload, opts) {
  return renderToStaticMarkup(renderJsrTree(payload, opts).element);
}

test('the three seeds render with node id and type attributes', () => {
  const rootType = { hello: 'center', counter: 'center', scroll_list: 'scroll' };
  for (const fixture of ['hello', 'counter', 'scroll_list']) {
    const { renders } = sample(fixture);
    const html = markupOf(renders[0]);
    assert.match(html, /data-node-id="n0"/, fixture);
    assert.match(html, new RegExp(`data-node-type="${rootType[fixture]}"`), fixture);
    assert.match(html, /data-node-type="text"/, fixture);
  }
});

test('hello: button label and tap action are mapped', () => {
  const { renders } = sample('hello');
  const html = markupOf(renders[0]);
  assert.match(html, /<button[^>]*data-node-type="textButton"[^>]*>Tap me<\/button>/);
});

test('hello: tap action dispatches callEvent through the engine', () => {
  const { renders } = sample('hello');
  const actions = [];
  const { element } = renderJsrTree(renders[0], { onAction: (id) => actions.push(id) });
  const buttons = [];
  collectButtons(element, buttons);
  assert.equal(buttons.length, 1);
  buttons[0].props.onClick();
  assert.equal(actions[0], 'tap');
});

function collectButtons(el, out) {
  if (el.props?.['data-node-type'] === 'textButton' && el.props.onClick) out.push(el);
  for (const child of flatten(el.props?.children)) {
    if (child && typeof child === 'object' && child.props) collectButtons(child, out);
  }
}

function flatten(children) {
  return Array.isArray(children) ? children.flat(Infinity) : children ? [children] : [];
}

test('counter: buttons dispatch dec, inc, reset in document order', () => {
  const { renders } = sample('counter');
  const actions = [];
  const { element } = renderJsrTree(renders[0], { onAction: (id) => actions.push(id) });
  const buttons = [];
  collectButtons(element, buttons);
  for (const b of buttons) b.props.onClick();
  assert.deepEqual(actions, ['dec', 'inc', 'reset']);
});

test('effect props map to CSS (L3 list)', () => {
  const cases = [
    [{ type: 'container', width: 10, blur: 8 }, /filter:\s*blur\(8px\)/],
    [{ type: 'container', opacity: 0.5 }, /opacity:\s*0\.5/],
    [{ type: 'container', clip: true }, /overflow:\s*hidden/],
    [{ type: 'text', data: 'x', offsetX: 24, offsetY: 4 }, /transform:\s*translate\(24px, 4px\)/],
    [{ type: 'container', scale: 1.5 }, /transform:\s*scale\(1\.5\)/],
    [{ type: 'container', rotation: 0.25 }, /rotate\(0\.25rad\)/],
    [{ type: 'container', transform: { perspective: 400, rotateX: 0.3, rotateY: 0.2 } }, /perspective\(400px\)\s+rotateX\(0\.3rad\)\s+rotateY\(0\.2rad\)/],
    [{ type: 'text', data: 'x', style: { textShadows: [{ color: '#818CF8', blur: 6, offsetX: 2, offsetY: 2 }] } }, /text-shadow:\s*2px 2px 6px 0px #818CF8/],
    [{ type: 'container', decoration: { shadows: [{ color: '#000000', blur: 12, spread: 2, offsetX: 0, offsetY: 4 }] } }, /box-shadow:\s*0px 4px 12px 2px #000000/],
    [{ type: 'container', decoration: { gradient: { type: 'radial', colors: ['#0EA5E9', '#1E293B'], stops: [0, 1], radius: 0.8 } } }, /radial-gradient\(circle, #0EA5E9 0%, #1E293B 100%\)/],
    [{ type: 'text', data: 'hi', style: { fontWeight: 'bold', color: '#F1F5F9', fontSize: 20 } }, /font-size:\s*20px/],
    [{ type: 'text', data: 'hi', style: { fontWeight: 'w700' } }, /font-weight:\s*700/],
    [{ type: 'text', data: 'hi', style: { textAlign: 'center' } }, /text-align:\s*center/],
    [{ type: 'column', spacing: 12 }, /gap:\s*12px/],
  ];
  for (const [payload, pattern] of cases) {
    const html = markupOf(payload);
    assert.match(html, pattern, JSON.stringify(payload));
  }
});

test('textTransform uppercases the DOM text like the reference renderer', () => {
  const html = markupOf({ type: 'text', data: 'conformance rumor', style: { textTransform: 'uppercase' } });
  assert.match(html, /CONFORMANCE RUMOR/);
  assert.doesNotMatch(html, /text-transform/);
});

test('colors are normalized through the one normalization', () => {
  const html = markupOf({ type: 'container', decoration: { color: '#1e293b' } });
  assert.match(html, /background:\s*#1E293B/);
});

test('widget key prop drives the React key; missing keys fall back to nodeId', () => {
  const { element } = renderJsrTree({
    type: 'column',
    children: [
      { type: 'text', key: 'row-a', data: 'a' },
      { type: 'text', data: 'b' },
    ],
  });
  const kids = flatten(element.props.children).filter((c) => c && c.props);
  assert.equal(kids[0].key, 'row-a');
  assert.equal(kids[1].key, 'n2'); // depth-first pre-order: root n0, texts n1, n2
});

test('unimplemented registered types render the fallback card with their node id', () => {
  const html = markupOf({ type: 'chart', data: '{}' });
  assert.match(html, /data-node-type="chart"/);
  assert.match(html, /data-node-id="n0"/);
  assert.match(html, />chart</);
});

test('the POC-plus-media type list is mapped', () => {
  for (const t of ['center', 'column', 'row', 'text', 'textButton', 'button', 'textField', 'sizedBox', 'padding', 'container', 'card', 'scroll', 'listView', 'divider', 'spacer', 'image', 'icon', 'video', 'audio']) {
    assert.ok(MAPPED_TYPES.includes(t), t);
  }
});

test('textField maps hint and initialValue (value alias)', () => {
  const html = markupOf({ type: 'textField', value: 'seed', placeholder: 'type here' });
  assert.match(html, /placeholder="type here"/);
  assert.match(html, /value="seed"/);
});

test('image maps url and alt', () => {
  const html = markupOf({ type: 'image', url: 'https://example.invalid/a.png', data: 'alt text' });
  assert.match(html, /<img[^>]*src="https:\/\/example\.invalid\/a\.png"[^>]*alt="alt text"/);
});
