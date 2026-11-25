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
  textField: 'input',
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
 *   normalized tree, and the applied-node record keyed by nodeId (dumpViewTree).
 */
export function renderJsrTree(payload, opts = {}) {
  const raw = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const keys = collectKeys(raw);
  const tree = normalizeTree(raw);
  const record = new Map();
  const element = buildElement(tree, '0', keys, record, opts.onAction ?? null);
  return { element, tree, record };
}

function buildElement(node, path, keys, record, onAction) {
  record.set(node.nodeId, node);
  const children = node.children.map((child, i) => buildElement(child, `${path}.${i}`, keys, record, onAction));
  const mapper = MAPPERS[node.type] ?? null;
  const props = {
    key: keys.get(path) ?? node.nodeId,
    'data-node-id': node.nodeId,
    'data-node-type': node.type,
    ...(mapper ?? fallbackCard)(node, onAction),
  };
  return createElement(TAGS[node.type] ?? 'div', props, childrenOf(node, children, mapper === null));
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

const LABEL_TYPES = new Set(['textButton', 'button']);

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

const MAPPERS = {
  center: (node) => ({ style: { display: 'flex', alignItems: 'center', justifyContent: 'center', ...boxCss(node) } }),
  column: (node) => ({ style: flexCss(node, 'column') }),
  row: (node) => ({ style: flexCss(node, 'row') }),
  text: (node) => ({ style: { ...boxCss(node), whiteSpace: 'pre-wrap' } }),
  scroll: (node) => ({ style: { overflowY: 'auto', ...boxCss(node) } }),
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
  textButton: (node, onAction) => ({
    type: 'button',
    ...wiredButton(node, onAction),
    style: boxCss(node),
  }),
};

MAPPERS.button = MAPPERS.textButton;

// POC buttons carry `onTap`/`onPressed` string action ids (the native
// renderer reads both); inputs carry `onChanged`/`onChange`.
function tapActionOf(node) {
  const e = node.events ?? {};
  return e.onTap ?? e.onPressed ?? e.onClick ?? null;
}

function changeActionOf(node) {
  const e = node.events ?? {};
  return e.onChanged ?? e.onChange ?? null;
}

function wiredButton(node, onAction) {
  const action = tapActionOf(node);
  if (!onAction || !action) return {};
  return { onClick: () => onAction(action, {}) };
}

function wiredInput(node, onAction) {
  const action = changeActionOf(node);
  if (!onAction || !action) return {};
  return { onChange: (e) => onAction(action, { value: e.target.value }) };
}

// Fallback card: the type name with the node id tag (Wave C common rule).
function fallbackCard(node) {
  return {
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
