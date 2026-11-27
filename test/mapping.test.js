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

test('submit wiring: Enter fires onSubmit, input alone does not', () => {
  const actions = [];
  const { element } = renderJsrTree(
    { type: 'textField', hint: 'F', onSubmit: 'go' },
    { onAction: (id, p) => actions.push([id, p]) },
  );
  const input = findTag(element, 'input');
  input.props.onKeyDown({ key: 'Enter', target: { value: 'typed' } });
  assert.deepEqual(actions, [['go', { value: 'typed' }]]);
  assert.equal(input.props.onChange, undefined);
});

test('composite nodes keep their node id on the root and expose interactive kids', () => {
  const { element, record } = renderJsrTree(
    { type: 'navigationBar', destinations: [{ label: 'N1' }, { label: 'N2' }], selectedIndex: 0, onSelected: 's1' },
    { onAction: () => {} },
  );
  assert.equal(element.props['data-node-type'], 'navigationBar');
  assert.equal(record.size, 1); // destinations carry no node id
  assert.match(renderToStaticMarkup(element), />N2</);
});

test('navigationBar destinations deliver {value: index}; segments deliver {value: label}', () => {
  const nav = [];
  const navElement = renderJsrTree(
    { type: 'navigationBar', destinations: [{ label: 'N1' }, { label: 'N2' }], onSelected: 's1' },
    { onAction: (id, p) => nav.push([id, p]) },
  ).element;
  clickKid(navElement, 'N2');
  assert.deepEqual(nav, [['s1', { value: 1 }]]);

  const seg = [];
  const segElement = renderJsrTree(
    { type: 'segmentedButton', segments: ['S1', 'S2'], onSelected: 's3' },
    { onAction: (id, p) => seg.push([id, p]) },
  ).element;
  clickKid(segElement, 'S2');
  assert.deepEqual(seg, [['s3', { value: 'S2' }]]);
});

test('map surface delivers onTap {lat,lng}; markers deliver onMarkerTap {id}', () => {
  const actions = [];
  const { element } = renderJsrTree(
    { type: 'map', width: 100, height: 50, markers: [{ id: 'm1', label: 'M1' }], onTap: 'mt', onMarkerTap: 'mk' },
    { onAction: (id, p) => actions.push([id, p]) },
  );
  const kids = flatten(element.props.children);
  const marker = kids.find((c) => typeof c === 'object' && c.key === 'marker-m1');
  const surface = kids.find((c) => typeof c === 'object' && c.key === 'surface');
  marker.props.onClick();
  surface.props.onClick();
  assert.deepEqual(actions, [['mk', { id: 'm1' }], ['mt', { lat: 0, lng: 0 }]]);
});

test('gestureDetector wires onScroll to wheel deltas', () => {
  const actions = [];
  const { element } = renderJsrTree(
    { type: 'gestureDetector', onScroll: 'sc' },
    { onAction: (id, p) => actions.push([id, p]) },
  );
  element.props.onWheel({ deltaX: 3, deltaY: 60 });
  assert.deepEqual(actions, [['sc', { dx: 3, dy: 60 }]]);
});

test('tabBar renders labels and delivers {value: index} on tap', () => {
  const taps = [];
  const { element } = renderJsrTree(
    { type: 'tabBar', tabs: ['One', 'Two'], selectedIndex: 0, onChanged: 'tb' },
    { onAction: (id, p) => taps.push([id, p]) },
  );
  assert.equal(element.type, 'div');
  const html = renderToStaticMarkup(element);
  assert.match(html, />One</);
  assert.match(html, />Two</);
  const spans = flatten(element.props.children).filter((c) => typeof c === 'object' && c.type === 'span');
  spans[1].props.onClick();
  assert.deepEqual(taps, [['tb', { value: 1 }]]);
});

test('dropdown renders the closed opener; toggling opens and selecting dispatches', async () => {
  const actions = [];
  const { DropdownWidget } = await import('../src/dom/mapping.js');
  const widget = DropdownWidget({
    node: { events: { onTap: 'dd' }, props: { options: ['Alpha', 'Beta'], value: 'Alpha' } },
    onAction: (id, p) => actions.push([id, p]),
  });
  const html = renderToStaticMarkup(widget);
  assert.match(html, /<button[^>]*>Alpha<\/button>/);
  // the closed menu is display:none and shows no options
  assert.match(html, /display:none/);
  assert.match(html, />Beta</);
  const button = findTag(widget, 'button');
  const menu = widget.props.children[1];
  const option = flatten(menu.props.children).find((c) => typeof c === 'object' && c.props.children === 'Beta');
  // opener toggles the menu; selecting hides it and dispatches {value}
  const fakeButton = { nextElementSibling: { style: { display: 'none' } } };
  button.props.onClick({ currentTarget: fakeButton });
  assert.equal(fakeButton.nextElementSibling.style.display, 'block');
  option.props.onClick({ currentTarget: { parentElement: { style: { display: 'block' } } } });
  assert.deepEqual(actions, [['dd', { value: 'Beta' }]]);
});

test('simple mappers render their DOM shape; listTile tap and input wiring dispatch', () => {
  const actions = [];
  const { element } = renderJsrTree(
    { type: 'column', children: [
      { type: 'listView', children: [{ type: 'text', data: 'row' }] },
      { type: 'padding', child: { type: 'card', child: { type: 'text', data: 'card' } } },
      { type: 'spacer' },
      { type: 'divider' },
      { type: 'icon', icon: 'star' },
      { type: 'video', src: 'v.mp4' },
      { type: 'audio', src: 'a.mp3' },
      { type: 'textArea', hint: 'area', initialValue: 'ta' },
      { type: 'searchBar', hint: 'search' },
      { type: 'listTile', title: 'Item', onTap: 'lt' },
      { type: 'textField', initialValue: 'f', onChanged: 'ch', onSubmit: 'sub' },
    ] },
    { onAction: (id, p) => actions.push([id, p]) },
  );
  const html = renderToStaticMarkup(element);
  assert.match(html, /<textarea[^>]*>ta<\/textarea>/);
  assert.match(html, /placeholder="search"/);
  assert.match(html, /data-node-type="listTile"/);
  assert.match(html, /data-node-type="video"/);
  assert.match(html, /data-node-type="audio"/);
  const tiles = [];
  collectByType(element, 'listTile', tiles);
  tiles[0].props.onClick();
  assert.deepEqual(actions[0], ['lt', {}]);
  const inputs = [];
  collectByType(element, 'textField', inputs);
  inputs[0].props.onChange({ target: { value: 'abc' } });
  inputs[0].props.onKeyDown({ key: 'Enter', target: { value: 'abc' } });
  assert.deepEqual(actions[1], ['ch', { value: 'abc' }]);
  assert.deepEqual(actions[2], ['sub', { value: 'abc' }]);
});

function collectByType(el, type, out) {
  if (el.props?.['data-node-type'] === type) out.push(el);
  for (const child of flatten(el.props?.children)) {
    if (child && typeof child === 'object' && child.props) collectByType(child, type, out);
  }
}

function findTag(el, tag) {
  if (el.type === tag) return el;
  for (const child of flatten(el.props?.children)) {
    if (child && typeof child === 'object' && child.props) {
      const hit = findTag(child, tag);
      if (hit) return hit;
    }
  }
  return null;
}

function clickKid(el, text) {
  for (const child of flatten(el.props?.children)) {
    if (child && typeof child === 'object' && child.props) {
      const kids = child.props.children;
      const first = Array.isArray(kids) ? kids[0] : kids;
      if (first === text) {
        child.props.onClick();
        return child;
      }
    }
  }
  throw new Error(`kid with text ${text} not found`);
}

test('A3 fling: pointer drag scrolls 1:1; the release carry is synchronous and deterministic', () => {
  const element = renderJsrTree({ type: 'scroll', children: [{ type: 'text', data: 'x' }] }).element;
  const listeners = {};
  const el = {
    scrollTop: 100,
    addEventListener: (name, fn) => { listeners[name] = fn; },
  };
  const realWindow = globalThis.window;
  globalThis.window = { addEventListener: (n, f) => { listeners['win:' + n] = f; }, removeEventListener() {} };
  try {
    element.props.ref(el);
    listeners.pointerdown({ pointerId: 1, clientY: 200 });
    listeners['win:pointermove']({ pointerId: 1, clientY: 130 });
    assert.equal(el.scrollTop, 170, 'the finger moves the container 1:1');
    listeners['win:pointermove']({ pointerId: 1, clientY: 60 });
    assert.equal(el.scrollTop, 240);
    listeners['win:pointerup']({ pointerId: 1 });
    assert.equal(el.scrollTop, 240, 'release alone adds nothing — the fling is the gesture velocity');

    // v = 140 px over 150 ms (the scroll_list swipe): the carry is the
    // geometric sum 16 px per frame, 3 % decay, stop under 0.03 px/ms.
    const v0 = 140 / 150;
    let carry = 0;
    for (let v = v0; Math.abs(v) > 0.03; v *= 0.97) carry += v * 16;
    el.__jsrFling(v0);
    assert.ok(Math.abs(el.scrollTop - (240 + carry)) < 1, `carry matches the closed-form sum: ${el.scrollTop} vs ${240 + carry}`);
    el.__jsrFling(v0);
    assert.ok(Math.abs(el.scrollTop - (240 + 2 * carry)) < 1, 'repeated flings add the same carry');
  } finally {
    globalThis.window = realWindow;
  }
});
