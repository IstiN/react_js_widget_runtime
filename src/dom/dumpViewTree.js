// DOM reflection dump — the React row of plan 1.3: walk the mounted view in
// order; every mapped element carries `data-node-id`/`data-node-type`;
// text-bearing props (`data`, `hint`, `value`) are read live from the DOM
// node, every other prop comes from the applied-node record that the
// renderer kept. Output is already normalized (the record holds normalized
// nodes), so `jsr-harness compare` can diff it against
// normalizeTree(result.renders[0]) directly.
const LIVE_TEXT_TYPES = new Set(['text', 'textButton', 'button', 'icon']);

/**
 * Dump the mounted widget.
 * @param {object} rootEl the mount container (DOM or the fake DOM of the tests)
 * @param {Map} record nodeId -> normalized node (renderJsrTree record)
 * @returns {object} normalized dump node (same shape as normalizeTree output)
 */
export function dumpViewTree(rootEl, record) {
  return dumpElement(findNodeElements(rootEl)[0], record);
}

function findNodeElements(rootEl) {
  const found = [];
  visitElements(rootEl, (el) => {
    if (getAttribute(el, 'data-node-id') !== null) found.push(el);
  });
  return found;
}

// Depth-first, document order — children of a mapped element are mapped
// elements (mapping is 1:1, no wrappers).
function visitElements(el, visit) {
  visit(el);
  for (const child of elementChildren(el)) visitElements(child, visit);
}

function dumpElement(el, record) {
  const nodeId = getAttribute(el, 'data-node-id');
  const node = record.get(nodeId);
  if (!node) throw new Error(`dumpViewTree: no applied record for ${nodeId}`);
  return {
    type: getAttribute(el, 'data-node-type'),
    props: liveProps(el, node),
    events: node.events ?? {},
    children: elementChildren(el)
      .filter((child) => getAttribute(child, 'data-node-id') !== null)
      .map((child) => dumpElement(child, record)),
    nodeId,
  };
}

function liveProps(el, node) {
  const props = { ...node.props };
  if (LIVE_TEXT_TYPES.has(node.type)) liveTextProps(props, node.type, textContent(el));
  else liveInputProps(props, el);
  return props;
}

// Text-bearing props are read live from the DOM node; the reference dump
// keeps the button's source prop next to the live data (comparator note:
// live-text `data` next to `text`).
function liveTextProps(props, type, live) {
  if (props.data !== undefined) props.data = coerceLive(props.data, live);
  if (type === 'textButton' || type === 'button') props.text = live;
}

function liveInputProps(props, el) {
  if (props.initialValue !== undefined) props.initialValue = coerceLive(props.initialValue, el.value ?? '');
  if (props.hint !== undefined) props.hint = getAttribute(el, 'placeholder') ?? props.hint;
}

// The DOM carries strings; the record carries the payload's value types.
function coerceLive(recordValue, liveText) {
  if (typeof recordValue === 'number') {
    const n = Number(liveText);
    if (!Number.isNaN(n)) return n;
  }
  return liveText;
}

// ---- minimal element surface (real DOM and the fake DOM of the tests) ----

function getAttribute(el, name) {
  if (typeof el.getAttribute === 'function') return el.getAttribute(name);
  const v = el.attrs?.[name];
  return v === undefined ? null : v;
}

function elementChildren(el) {
  if (typeof el.querySelectorAll === 'function') return Array.from(el.children);
  return el.children ?? [];
}

function textContent(el) {
  if (typeof el.textContent === 'string') return el.textContent;
  return (el.text ?? '') + elementChildren(el).map(textContent).join('');
}
