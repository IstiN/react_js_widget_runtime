// DOM reflection dump — the React row of plan 1.3: walk the mounted view in
// order; every mapped element carries `data-node-id`/`data-node-type`;
// text-bearing props (`data`, `text`, `hint`, `value`) are read live from
// the DOM node, every other prop comes from the applied-node record that
// the renderer kept. The record holds the RAW payload props (the reference
// dump pipeline keeps them verbatim — flat `color`, kept `text`, renderer
// defaults) plus the normalized node for type/events/children. Output is
// comparable by `jsr-harness compare`; color values go through the one
// normalization.
import { normalizeColor, isScrollableType } from '../../.conformance/js_widget_runtime/harness/normalize.mjs';

// Types whose label is live DOM text (the reference dump reads Text.data /
// button labels live and keeps both data and text on buttons).
const LIVE_TEXT_TYPES = new Set(['text', 'textButton', 'button', 'outlinedButton', 'iconButton', 'icon']);

/**
 * Dump the mounted widget.
 * @param {object} rootEl the mount container (DOM or the fake DOM of the tests)
 * @param {Map} record nodeId -> { node, raw } (renderJsrTree record)
 * @returns {object} normalized dump node (same shape as normalizeTree output)
 */
export function dumpViewTree(rootEl, record) {
  const first = findNodeElements(rootEl)[0];
  if (!first) throw new Error('dumpViewTree: no mapped element under the mount root');
  return dumpElement(first, record);
}

function findNodeElements(rootEl) {
  const found = [];
  visitElements(rootEl, (el) => {
    if (getAttribute(el, 'data-node-id') !== null) found.push(el);
  });
  return found;
}

// Depth-first, document order — children of a mapped element are mapped
// elements (mapping is 1:1; interactive sub-elements carry no node id).
function visitElements(el, visit) {
  visit(el);
  for (const child of elementChildren(el)) visitElements(child, visit);
}

function dumpElement(el, record) {
  const nodeId = getAttribute(el, 'data-node-id');
  const applied = record.get(nodeId);
  if (!applied) throw new Error(`dumpViewTree: no applied record for ${nodeId}`);
  const node = applied.node;
  return {
    type: node.type,
    props: liveProps(el, applied),
    events: node.events ?? {},
    children: elementChildren(el)
      .filter((child) => getAttribute(child, 'data-node-id') !== null)
      .map((child) => dumpElement(child, record)),
    nodeId,
  };
}

function liveProps(el, applied) {
  const props = appliedProps(applied.raw ?? applied.node);
  const type = applied.node.type;
  if (LIVE_TEXT_TYPES.has(type)) liveTextProps(props, type, textContent(el));
  else if (isFormType(type)) liveInputProps(props, el);
  else if (type === 'popupMenu') props.message = props.message ?? 'Show menu';
  else if (type === 'tabBar') props.data = selectedTab(props);
  else if (isScrollableType(type)) scrollState(props, el);
  return props;
}

// A3: every scrollable node dumps its live scroll state — offset, full
// content extent and viewport extent, logical px on the primary axis
// (DOM: scrollTop / scrollHeight / clientHeight). Both dumps carry it;
// the comparator validates presence and derives `scrolledToEnd` from it.
function scrollState(props, el) {
  props.scrollOffset = el.scrollTop ?? 0;
  props.scrollExtent = el.scrollHeight ?? 0;
  props.viewportExtent = el.clientHeight ?? 0;
}

// The applied-node record the way the reference dump pipeline keeps it:
// payload props verbatim (flat color, kept text), the style object merged
// in with node keys winning, colors normalized — but no type aliases and
// no decoration wrapping (those run only in the reference's binding
// normalizer, never in its dump path).
const APPLIED_STRUCTURAL = new Set(['type', 'child', 'children', 'items', 'key', 'style', 'props', 'events', 'nodeId', '__iid']);

function appliedProps(rawNode) {
  const working = { ...(rawNode.props ?? {}) };
  for (const [k, v] of Object.entries(rawNode)) {
    if (k !== 'props' && !(k in working)) working[k] = v;
  }
  const out = {};
  collectApplied(out, working);
  mergeAppliedStyle(out, rawNode.style);
  return out;
}

// payload props verbatim: structural and event keys dropped, colors normalized
function collectApplied(out, working) {
  for (const [k, v] of Object.entries(working)) {
    if (APPLIED_STRUCTURAL.has(k)) continue;
    if (/^on[A-Z]/.test(k) && typeof v === 'string') continue; // events
    out[k] = colorValue(k, v);
  }
}

// the style object merged in with node keys winning
function mergeAppliedStyle(out, style) {
  if (!style || typeof style !== 'object' || Array.isArray(style)) return;
  for (const [k, v] of Object.entries(style)) {
    if (!(k in out)) out[k] = colorValue(k, v);
  }
}

function colorValue(k, v) {
  if (/color/i.test(k) && typeof v === 'string') return normalizeColor(v);
  return colorDeep(v);
}

// colors normalize recursively through nested objects and arrays
function colorDeep(v) {
  if (Array.isArray(v)) return v.map((item) => (item && typeof item === 'object' ? colorDeep(item) : item));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [ik, iv] of Object.entries(v)) out[ik] = colorValue(ik, iv);
    return out;
  }
  return v;
}

function isFormType(type) {
  return type === 'textField' || type === 'input' || type === 'textArea' || type === 'searchBar';
}

// Text-bearing props are read live from the DOM node; the reference dump
// keeps the button's source prop next to the live data (comparator note:
// live-text `data` next to `text`).
function liveTextProps(props, type, live) {
  props.data = coerceLive(props.data, live);
  if (type !== 'text' && type !== 'icon') props.text = live;
}

function liveInputProps(props, el) {
  // the input field aliases (value -> initialValue, placeholder -> hint)
  // apply to the dump record the way the derived tree expects them
  if (props.initialValue === undefined && props.value !== undefined) props.initialValue = props.value;
  if (props.hint === undefined && props.placeholder !== undefined) props.hint = props.placeholder;
  if (props.initialValue !== undefined && typeof el.value === 'string') {
    props.initialValue = coerceLive(props.initialValue, el.value);
  }
  if (props.hint !== undefined) props.hint = getAttribute(el, 'placeholder') ?? props.hint;
}

// The reference renderer shows the active tab label as the bar's live text.
function selectedTab(props) {
  const tabs = props.tabs ?? [];
  const index = typeof props.selectedIndex === 'number' ? props.selectedIndex : 0;
  const tab = tabs[index];
  return typeof tab === 'string' ? tab : String(tab?.label ?? tab ?? '');
}

// The DOM carries strings; the record carries the payload's value types.
function coerceLive(recordValue, liveText) {
  if (typeof recordValue === 'number') {
    const n = Number(liveText);
    if (!Number.isNaN(n)) return n;
  }
  return liveText ?? (typeof recordValue === 'string' ? recordValue : '');
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
