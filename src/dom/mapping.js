// DOM mapping — jsr node tree (normalized, plan 1.3 shape) to React
// elements. Every mapped element carries `data-node-id="n<i>"` and
// `data-node-type="<type>"`; React reconciles by the widget's `key` prop
// (collected from the raw payload before normalization) falling back to the
// stable nodeId. Implemented types: the Android POC set (NativeRenderer.kt)
// plus image, icon, video, audio; every other registered type renders the
// fallback card with its node id tag (Wave C common rule).
import { createElement } from 'react';
import { normalizeTree } from '../../.conformance/js_widget_runtime/harness/normalize.mjs';

const TAGS = {
  text: 'span',
  textButton: 'button',
  button: 'button',
  outlinedButton: 'button',
  iconButton: 'button',
  textField: 'input',
  textArea: 'textarea',
  searchBar: 'input',
  image: 'img',
  video: 'video',
  audio: 'audio',
};

// Raw-tree walk: widget `key` values keyed by child index path, read before
// normalization strips them (plan 1.3 rule 4).
function collectKeys(node, path = '0', map = new Map()) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return map;
  const k = node.key ?? node.props?.key;
  if (typeof k === 'string') map.set(path, k);
  rawChildrenOf(node).forEach((child, i) => collectKeys(child, `${path}.${i}`, map));
  return map;
}

function rawChildrenOf(node) {
  if (Array.isArray(node.children)) return node.children;
  if (node.child !== undefined && node.child !== null) return [node.child];
  if (Array.isArray(node.items)) return node.items;
  return [];
}

/**
 * Render a raw `jsr.render` payload into a React element tree.
 * @param {object|string} payload the raw render payload (node or JSON string)
 * @param {object} [opts]
 * @param {function} [opts.onAction] (actionId, payload) for taps and inputs
 * @returns {{ element: object, tree: object, record: Map }} React element,
 *   normalized tree, and the applied-node record keyed by nodeId: the raw
 *   (verbatim) props the renderer applied plus the normalized node for
 *   type/events/children — the reference dump keeps payload props verbatim.
 */
export function renderJsrTree(payload, opts = {}) {
  const raw = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const keys = collectKeys(raw);
  const rawByPath = new Map();
  collectRaw(raw, '0', rawByPath);
  const tree = normalizeTree(raw);
  const record = new Map();
  const element = buildElement(tree, '0', keys, rawByPath, record, opts.onAction ?? null);
  return { element, tree, record };
}

// The raw tree and the normalized tree share the child index order
// (child/children/items all normalize to children), so a parallel walk by
// child index path pairs every normalized node with its raw props.
function collectRaw(node, path, map) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return;
  map.set(path, node);
  rawChildrenOf(node).forEach((child, i) => collectRaw(child, `${path}.${i}`, map));
}

function buildElement(node, path, keys, rawByPath, record, onAction) {
  record.set(node.nodeId, { node, raw: rawByPath.get(path) ?? null });
  const children = node.children.map((child, i) => buildElement(child, `${path}.${i}`, keys, rawByPath, record, onAction));
  const mapper = MAPPERS[node.type] ?? null;
  const built = (mapper ?? fallbackCard)(node, onAction) ?? {};
  const { __kids, ...props } = built;
  const own = childrenOf(node, children, mapper === null);
  return createElement(TAGS[node.type] ?? 'div', {
    key: keys.get(path) ?? node.nodeId,
    'data-node-id': node.nodeId,
    'data-node-type': node.type,
    ...props,
  }, own ?? __kids);
}

// Text nodes render their `data` as the child string; the reference
// renderer applies textTransform before building Text, so the DOM text
// shows the transformed string and live dumps match the reference dump.
function textOf(node) {
  const data = node.props.data;
  const t = node.props.textTransform === 'uppercase' && typeof data === 'string' ? data.toUpperCase() : data;
  return String(t ?? '');
}

function labelChildren(node, children) {
  if (children.length > 0) return children;
  return [String(node.props.data ?? node.props.text ?? '')];
}

const LABEL_TYPES = new Set(['textButton', 'button', 'outlinedButton', 'iconButton']);

function childrenOf(node, children, isFallback) {
  if (node.type === 'text') return [textOf(node)];
  if (node.type === 'icon') return [String(node.props.data ?? node.props.name ?? '')];
  if (LABEL_TYPES.has(node.type)) return labelChildren(node, children);
  if (isFallback) return children.length > 0 ? children : [node.type];
  return children.length > 0 ? children : undefined;
}

// ---------- prop -> CSS ----------

function px(v) {
  return typeof v === 'number' ? `${v}px` : v;
}

function spacing(v) {
  return Array.isArray(v) ? v.map(px).join(' ') : px(v);
}

function decorationToCss(decoration) {
  if (!decoration || typeof decoration !== 'object') return {};
  const css = {};
  if (decoration.color) css.background = decoration.color;
  if (decoration.borderRadius !== undefined) css.borderRadius = px(decoration.borderRadius);
  if (Array.isArray(decoration.shadows)) css.boxShadow = decoration.shadows.map(shadowCss).join(', ');
  if (decoration.gradient) css.background = gradientCss(decoration.gradient);
  return css;
}

function shadowCss(s) {
  return `${px(s.offsetX ?? 0)} ${px(s.offsetY ?? 0)} ${px(s.blur ?? 0)} ${px(s.spread ?? 0)} ${s.color ?? '#000000'}`;
}

function gradientCss(g) {
  if (g.type === 'radial') return `radial-gradient(circle, ${stopsCss(g)})`;
  return `linear-gradient(${g.angle ?? 180}deg, ${stopsCss(g)})`;
}

function stopsCss(g) {
  const colors = g.colors ?? [];
  const stops = g.stops ?? [];
  return colors.map((c, i) => (stops[i] !== undefined ? `${c} ${stopPct(stops[i])}` : c)).join(', ');
}

function stopPct(s) {
  return typeof s === 'number' && s <= 1 ? `${Math.round(s * 100)}%` : String(s);
}

// Universal effect props (plan 1.4 L3): blur, clip, boxShadows via
// decoration, radial gradient via decoration, rotateX/rotateY/perspective,
// textShadow, textTransform, offsetX, offsetY, scale, rotation, opacity.
function effectCss(props) {
  const css = {};
  if (props.opacity !== undefined) css.opacity = props.opacity;
  if (props.blur !== undefined) css.filter = `blur(${px(props.blur)})`;
  if (props.clip === true) css.overflow = 'hidden';
  const t = transformCss(props);
  if (t) css.transform = t;
  return css;
}

function transformCss(props) {
  const parts = [...cameraTransform(props.transform ?? {}), ...motionTransform(props)];
  return parts.length > 0 ? parts.join(' ') : null;
}

// transform: { perspective, rotateX, rotateY } — the camera group.
function cameraTransform(t) {
  const parts = [];
  if (t.perspective !== undefined) parts.push(`perspective(${px(t.perspective)})`);
  if (t.rotateX !== undefined) parts.push(`rotateX(${t.rotateX}rad)`);
  if (t.rotateY !== undefined) parts.push(`rotateY(${t.rotateY}rad)`);
  return parts;
}

// Universal motion props: offsetX/offsetY/scale/rotation.
function motionTransform(props) {
  const parts = [];
  if (props.offsetX !== undefined || props.offsetY !== undefined) {
    parts.push(`translate(${px(props.offsetX ?? 0)}, ${px(props.offsetY ?? 0)})`);
  }
  if (props.scale !== undefined) parts.push(`scale(${props.scale})`);
  if (props.rotation !== undefined) parts.push(`rotate(${props.rotation}rad)`);
  return parts;
}

const BOLD_WEIGHTS = new Set(['bold', 'w600', 'w700', 'w800']);

// Normalization merges the style object into props (plan 1.3 rule 1), so
// all style props live at the top level of the normalized node.
function textStyleCss(props) {
  const css = {};
  if (props.fontSize !== undefined) css.fontSize = px(props.fontSize);
  if (props.color) css.color = props.color;
  if (props.fontWeight !== undefined) css.fontWeight = numberWeight(props.fontWeight);
  if (props.textAlign !== undefined) css.textAlign = props.textAlign;
  if (Array.isArray(props.textShadows)) css.textShadow = props.textShadows.map(shadowCss).join(', ');
  if (props.textShadow !== undefined) css.textShadow = shadowCss(props.textShadow);
  return css;
}

function numberWeight(w) {
  if (BOLD_WEIGHTS.has(w)) return w === 'bold' ? '700' : String(Number(w.slice(1)));
  return w;
}

function boxCss(node) {
  const p = node.props;
  const css = {
    ...decorationToCss(p.decoration),
    ...effectCss(p),
    ...textStyleCss(p),
  };
  if (p.width !== undefined) css.width = px(p.width);
  if (p.height !== undefined) css.height = px(p.height);
  if (p.padding !== undefined) css.padding = spacing(p.padding);
  if (p.margin !== undefined) css.margin = spacing(p.margin);
  if (p.borderRadius !== undefined) css.borderRadius = px(p.borderRadius);
  if (p.spacing !== undefined) css.gap = px(p.spacing);
  return backgroundCss(css, p, node.type);
}

function backgroundCss(css, p, type) {
  // POC semantics: on containers `color` is the background; on text and
  // icons it is the text color (handled in textStyleCss).
  const TEXTISH = type === 'text' || type === 'icon';
  const bg = p.decoration?.color ?? (TEXTISH ? p.backgroundColor : (p.color ?? p.backgroundColor));
  if (bg) css.background = bg;
  return css;
}

const ALIGN = {
  start: 'flex-start',
  end: 'flex-end',
  flexStart: 'flex-start',
  flexEnd: 'flex-end',
  center: 'center',
};

function flexCss(node, direction) {
  const p = node.props;
  const css = { display: 'flex', flexDirection: direction, ...boxCss(node) };
  if (p.mainAxisAlignment !== undefined) css.justifyContent = ALIGN[p.mainAxisAlignment] ?? p.mainAxisAlignment;
  if (p.crossAxisAlignment !== undefined) css.alignItems = ALIGN[p.crossAxisAlignment] ?? p.crossAxisAlignment;
  return css;
}

// ---------- node mappers (one per type family) ----------

// A3/A2: the reference swipe is a touch drag — the finger moves the list
// 1:1 and the release fling carries the release momentum (ListView fling
// physics). The web equivalent on the mapped overflow container: pointer
// drag scrolls live; the runner hands the gesture's velocity (action
// distance over action duration) to `__jsrFling`, which applies the
// momentum carry synchronously — the geometric sum of the per-frame
// velocities (16 px frames, 3 % decay, stop under 0.03 px/ms) — so the
// end state is identical on every host and does not depend on frame
// pacing. scrollTop clamps at both ends. Taps never fling, so buttons
// inside the container are unaffected.
function trackDrag(drag, el, e) {
  drag.top += drag.y - e.clientY;
  drag.y = e.clientY;
  el.scrollTop = drag.top;
  return drag;
}

function applyFling(el, v) {
  while (Math.abs(v) > 0.03) {
    el.scrollTop += v * 16;
    v *= 0.97;
  }
}

function flingScroll(el) {
  if (!el) return;
  let drag = null;
  const move = (e) => {
    if (drag && e.pointerId === drag.id) drag = trackDrag(drag, el, e);
  };
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    window.removeEventListener('pointermove', move);
  };
  el.addEventListener('pointerdown', (e) => {
    if (drag) return;
    drag = { id: e.pointerId, y: e.clientY, top: el.scrollTop };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
    window.addEventListener('pointercancel', end, { once: true });
  });
  el.__jsrFling = (v) => applyFling(el, v);
}

const MAPPERS = {
  center: (node) => ({ style: { display: 'flex', alignItems: 'center', justifyContent: 'center', ...boxCss(node) } }),
  column: (node) => ({ style: flexCss(node, 'column') }),
  row: (node) => ({ style: flexCss(node, 'row') }),
  text: (node) => ({ style: { ...boxCss(node), whiteSpace: 'pre-wrap' } }),
  scroll: (node) => ({ style: { overflowY: 'auto', ...boxCss(node) }, ref: flingScroll }),
  listView: (node) => ({ style: { overflowY: 'auto', display: 'flex', flexDirection: 'column', ...boxCss(node) } }),
  padding: (node) => ({ style: { boxSizing: 'border-box', ...boxCss(node) } }),
  container: (node) => ({ style: boxCss(node) }),
  card: (node) => ({ style: { display: 'flex', flexDirection: 'column', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', boxSizing: 'border-box', ...boxCss(node) } }),
  sizedBox: (node) => ({ style: boxCss(node) }),
  spacer: (node) => ({ style: { flex: '1 1 0%', ...boxCss(node) } }),
  divider: (node) => ({ style: { height: '1px', background: 'rgba(136,136,136,0.2)', ...boxCss(node) } }),
  image: (node) => ({ src: node.props.url ?? node.props.src, alt: String(node.props.data ?? ''), style: boxCss(node) }),
  icon: (node) => ({ style: { ...boxCss(node), color: node.props.color } }),
  video: (node) => ({ src: node.props.url ?? node.props.src, controls: true, style: boxCss(node) }),
  audio: (node) => ({ src: node.props.url ?? node.props.src, controls: true, style: boxCss(node) }),
  textField: (node, onAction) => ({
    placeholder: node.props.hint ?? '',
    defaultValue: node.props.initialValue ?? '',
    ...wiredInput(node, onAction),
    style: boxCss(node),
  }),
  textArea: (node, onAction) => ({
    placeholder: node.props.hint ?? '',
    defaultValue: node.props.initialValue ?? '',
    ...wiredInput(node, onAction),
    style: boxCss(node),
  }),
  searchBar: (node, onAction) => ({
    placeholder: node.props.hint ?? '',
    defaultValue: node.props.initialValue ?? '',
    ...wiredInput(node, onAction),
    style: boxCss(node),
  }),
  tabBar: tabBarView,
  textButton: (node, onAction) => ({
    type: 'button',
    ...wiredButton(node, onAction),
    style: boxCss(node),
  }),
  // Interactive composite nodes: the interactive sub-elements (destinations,
  // markers, menu options) carry NO data-node-id — the AUI dump keeps only
  // the node element itself (plan 1.3 dump source).
  gestureDetector: (node, onAction) => ({
    onWheel: wheelWiring(node, onAction),
    ...wiredButton(node, onAction),
    style: boxCss(node),
  }),
  listTile: (node, onAction) => ({
    ...pressWiring(node, onAction),
    style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', ...boxCss(node) },
  }),
  dropdown: (node, onAction) => ({
    __kids: [createElement(DropdownWidget, { key: 'dd', node, onAction })],
    style: { position: 'relative', ...boxCss(node) },
  }),
  navigationBar: destinationsView,
  navigationRail: destinationsView,
  segmentedButton: destinationsView,
  map: (node, onAction) => ({
    style: { position: 'relative', background: '#dbeafe', ...boxCss(node) },
    __kids: mapKids(node, onAction),
  }),
};

MAPPERS.button = MAPPERS.textButton;
MAPPERS.outlinedButton = MAPPERS.textButton;
MAPPERS.iconButton = MAPPERS.textButton;

// POC buttons carry `onTap`/`onPressed` string action ids (the native
// renderer reads both, plus onPress on list tiles); inputs carry
// `onChanged`/`onChange`.
function tapActionOf(node) {
  const e = node.events ?? {};
  return e.onTap ?? e.onPressed ?? e.onClick ?? e.onPress ?? null;
}

function changeActionOf(node) {
  const e = node.events ?? {};
  return e.onChanged ?? e.onChange ?? null;
}

// A1: keyboard done on a text node dispatches onSubmit / onSubmitted.
function submitActionOf(node) {
  const e = node.events ?? {};
  return e.onSubmit ?? e.onSubmitted ?? null;
}

function wiredButton(node, onAction) {
  const action = tapActionOf(node);
  if (!onAction || !action) return {};
  return { onClick: () => onAction(action, {}) };
}

function wiredInput(node, onAction) {
  const action = changeActionOf(node);
  const submit = submitActionOf(node);
  const wiring = {};
  if (onAction && action) wiring.onChange = (e) => onAction(action, { value: e.target.value });
  if (onAction && submit) {
    wiring.onKeyDown = (e) => {
      if (e.key === 'Enter') onAction(submit, { value: e.target.value });
    };
  }
  return wiring;
}

// A2: pointer scroll on a gestureDetector delivers onScroll with the wheel
// deltas; the payload shape follows the reference event contract.
function wheelWiring(node, onAction) {
  const e = node.events ?? {};
  const action = e.onScroll ?? null;
  if (!onAction || !action) return undefined;
  return (ev) => onAction(action, { dx: ev.deltaX, dy: ev.deltaY });
}

// listTile priority: onPress when onTap is not set (reference semantics).
function pressWiring(node, onAction) {
  const e = node.events ?? {};
  const action = e.onTap ?? e.onPress ?? null;
  if (!onAction || !action) return {};
  return { onClick: () => onAction(action, {}) };
}

// navigationBar / navigationRail / segmentedButton: destinations or segments
// render as clickable labels; the event priority is
// onChange ?? onChanged ?? onSelected. Destinations deliver {value: index};
// string segments deliver {value: label}.
function destinationsView(node, onAction) {
  const items = node.props.destinations ?? node.props.segments ?? [];
  const action = selectedActionOf(node);
  const numeric = Array.isArray(node.props.destinations);
  const style = { display: 'flex', gap: '24px', padding: '8px', ...boxCss(node) };
  return {
    style,
    __kids: items.map((item, i) => createElement('span', {
      key: `${labelOf(item)}-${i}`,
      onClick: onAction && action ? () => onAction(action, { value: numeric ? i : labelOf(item) }) : undefined,
      style: ITEM_STYLE,
    }, labelOf(item))),
  };
}

function selectedActionOf(node) {
  const e = node.events ?? {};
  return e.onChange ?? e.onChanged ?? e.onSelected ?? null;
}

function labelOf(item) {
  return typeof item === 'string' ? item : String(item?.label ?? '');
}

const ITEM_STYLE = { cursor: 'pointer', padding: '4px 8px' };

// map: the surface delivers onTap {lat, lng} (origin for the stub surface);
// markers render as labeled spans and deliver onMarkerTap {id}.
function mapKids(node, onAction) {
  const e = node.events ?? {};
  const kids = [];
  if (onAction && e.onTap) {
    kids.push(createElement('span', {
      key: 'surface',
      onClick: () => onAction(e.onTap, { lat: 0, lng: 0 }),
      style: { position: 'absolute', inset: 0 },
    }));
  }
  for (const marker of node.props.markers ?? []) {
    kids.push(createElement('span', {
      key: `marker-${marker.id ?? marker.label}`,
      onClick: onAction && e.onMarkerTap ? () => onAction(e.onMarkerTap, { id: marker.id }) : undefined,
      style: { position: 'absolute', left: '40%', top: '40%', cursor: 'pointer', background: '#fff', borderRadius: '4px', padding: '2px 6px', fontSize: '11px' },
    }, marker.label ?? marker.id));
  }
  return kids;
}

// tabBar: tab labels render as clickable spans (no node ids — the dump
// keeps the bar as one node); the bar's live `data` is the selected label.
function tabBarView(node, onAction) {
  const tabs = node.props.tabs ?? [];
  const action = selectedActionOf(node);
  const selected = typeof node.props.selectedIndex === 'number' ? node.props.selectedIndex : 0;
  return {
    style: { display: 'flex', gap: '16px', padding: '8px', ...boxCss(node) },
    __kids: tabs.map((tab, i) => createElement('span', {
      key: `tab-${i}`,
      onClick: onAction && action ? () => onAction(action, { value: i }) : undefined,
      style: { ...ITEM_STYLE, fontWeight: i === selected ? '700' : '400' },
    }, typeof tab === 'string' ? tab : String(tab?.label ?? ''))),
  };
}

// dropdown: the menu is DOM state (uncontrolled show/hide), not React state,
// so the wiring stays drivable from plain element trees (unit tests) and
// identical in the browser; selecting an option dispatches
// onChange ?? onChanged ?? onTap {value} — the reference's fallback chain.
// exported for the interaction unit test (hook-free by design)
export function DropdownWidget({ node, onAction }) {
  const e = node.events ?? {};
  const action = e.onChange ?? e.onChanged ?? e.onTap ?? null;
  const options = node.props.options ?? [];
  return createElement('span', { style: { position: 'relative', display: 'inline-block', width: '100%', height: '100%' } },
    createElement('button', { type: 'button', onClick: toggleDropdownMenu, style: { width: '100%', height: '100%', ...ITEM_STYLE } },
      String(node.props.value ?? '')),
    createElement('span', { style: { display: 'none', position: 'absolute', background: '#fff', border: '1px solid #94a3b8', borderRadius: '4px', zIndex: 10 } },
      options.map((o) => createElement('span', {
        key: String(o),
        onClick: (ev) => {
          hideDropdownMenu(ev.currentTarget.parentElement);
          if (onAction && action) onAction(action, { value: String(o) });
        },
        style: ITEM_STYLE,
      }, String(o)))));
}

function toggleDropdownMenu(ev) {
  const menu = ev.currentTarget.nextElementSibling;
  if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function hideDropdownMenu(menu) {
  if (menu) menu.style.display = 'none';
}

// Fallback card: the type name with the node id tag (Wave C common rule).
// String tap actions still fire from the card, the way the reference
// delivers taps for unimplemented interactive nodes.
function fallbackCard(node, onAction) {
  return {
    ...wiredButton(node, onAction),
    style: {
      border: '1px dashed #64748b',
      borderRadius: '8px',
      padding: '8px',
      fontSize: '12px',
      color: '#94a3b8',
      ...boxCss(node),
    },
  };
}

export const MAPPED_TYPES = Object.keys(MAPPERS);

// Mapping spec — one entry per mapped type, rendered into docs/dom-mapping.md
// rows by tool/gen-support-docs.mjs (one source of truth: this file). Kept
// next to the mappers so a mapper change and its doc row land in one diff;
// test/nodeSupport.test.js fails when a mapped type lacks a spec.
// Every row also gets: data-node-id/data-node-type, the React `key`
// (widget key ?? nodeId), and the universal effect props → CSS (opacity,
// blur→filter, clip→overflow, perspective/rotateX/rotateY/offsetX/offsetY/
// scale/rotation→transform) plus the box props (width/height/padding/
// margin/borderRadius/spacing→gap, decoration color/shadows/gradient→
// background/box-shadow).
const FLEX_CSS = 'display:flex; spacing→gap; mainAxisAlignment→justify-content; crossAxisAlignment→align-items; box props';
const BOX = { css: 'box props' };
const TAP = 'onTap ?? onPressed ?? onClick ?? onPress → click {}';
const BUTTON_SPEC = { dom: '<button> (label: data ?? text ?? children)', attrs: ['type=button'], css: 'box props', events: [TAP] };
const INPUT_SPEC = (dom) => ({ dom, attrs: ['placeholder = hint', 'defaultValue = initialValue'], css: 'box props', events: ['onChanged ?? onChange → input {value}', 'onSubmit ?? onSubmitted → Enter {value}'] });
const SELECT_SPEC = (dom, value) => ({ dom, css: 'flex row; gap 24px; padding 8px; box props', events: [`onChange ?? onChanged ?? onSelected → label click {value: ${value}}`] });

export const SPECS = {
  center: { dom: '<div> flex center', css: 'display:flex; align-items:center; justify-content:center; box props' },
  column: { dom: '<div> flex column', css: FLEX_CSS.replace('spacing', 'flex-direction:column; spacing') },
  row: { dom: '<div> flex row', css: FLEX_CSS.replace('spacing', 'flex-direction:row; spacing') },
  text: { dom: '<span> text child (data, textTransform applied)', css: 'white-space:pre-wrap; fontSize→font-size; color→color; fontWeight→font-weight; textAlign→text-align; textShadow(s)→text-shadow; box props' },
  scroll: { dom: '<div> scroll container (pointer drag scrolls 1:1; the swipe release carries the gesture velocity as a synchronous momentum carry)', css: 'overflow-y:auto; box props; A3 dump: scrollOffset/scrollExtent/viewportExtent' },
  listView: { dom: '<div> flex column scroll', css: 'display:flex; flex-direction:column; spacing→gap; overflow-y:auto; box props' },
  padding: { dom: '<div> padded box', css: 'box-sizing:border-box; padding→padding; box props' },
  container: { dom: '<div> box', ...BOX },
  card: { dom: '<div> elevated card', css: 'default radius 12px + shadow 0 2px 4px rgba(0,0,0,.3); flex column; box props' },
  sizedBox: { dom: '<div> fixed box', css: 'width/height→width/height; box props' },
  spacer: { dom: '<div> flexible gap', css: 'flex:1 1 0%; box props' },
  divider: { dom: '<div> 1px rule', css: 'height:1px; background:rgba(136,136,136,.2); box props' },
  image: { dom: '<img>', attrs: ['src = url ?? src', 'alt = data'], css: 'box props' },
  icon: { dom: '<div> glyph child (data ?? name)', css: 'color→color; box props' },
  video: { dom: '<video controls>', attrs: ['src = url ?? src', 'controls'], css: 'box props' },
  audio: { dom: '<audio controls>', attrs: ['src = url ?? src', 'controls'], css: 'box props' },
  textField: INPUT_SPEC('<input>'),
  textArea: INPUT_SPEC('<textarea>'),
  searchBar: INPUT_SPEC('<input>'),
  tabBar: {
    dom: '<div> tab labels (clickable spans, selected bold)',
    css: 'flex row; gap 16px; padding 8px; box props',
    events: ['onChange ?? onChanged ?? onSelected → tab click {value: index}'],
    notes: 'live `data` is the selected label (dump)',
  },
  gestureDetector: { dom: '<div> hit area', css: 'box props', events: [TAP, 'onScroll → wheel {dx, dy}'] },
  listTile: { dom: '<div> flex row center', css: 'display:flex; align-items:center; gap 12px; padding 12px; box props', events: ['onTap ?? onPress → click {}'] },
  dropdown: {
    dom: '<div> relative wrapper + button (value) + option spans (menu is uncontrolled DOM)',
    css: 'position:relative; box props',
    events: ['onChange ?? onChanged ?? onTap → option click {value: option}'],
  },
  navigationBar: SELECT_SPEC('<div> destination labels (clickable)', 'index'),
  navigationRail: SELECT_SPEC('<div> destination labels (clickable)', 'index'),
  segmentedButton: SELECT_SPEC('<div> segment labels (clickable)', 'label'),
  map: {
    dom: '<div> stub surface + marker labels',
    css: 'position:relative; background:#dbeafe; box props',
    events: ['onTap → surface click {lat: 0, lng: 0}', 'onMarkerTap → marker click {id}'],
  },
  textButton: BUTTON_SPEC,
  button: BUTTON_SPEC,
  outlinedButton: BUTTON_SPEC,
  iconButton: BUTTON_SPEC,
};
