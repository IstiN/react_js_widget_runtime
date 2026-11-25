// Worker script builder — a port of the worker part of the Flutter web
// backend (js_widget_engine_web_worker.dart, `_buildWorkerScript`): the same
// control message names (`__jsr_call_event`, `__jsr_updateTheme`,
// `__jsr_host_event`, `__jsr_interval_tick`, `__jsr_raf_tick`,
// `__jsr_resolve`), with `kJsWidgetBootstrap` replaced by the two canonical
// halves of src/vendor/ (plan 1.2 boot order: __IID, runtime, widget,
// widget.js). An additional `__jsr_eval` control message implements the
// `eval` operation of docs/ENGINE_ADAPTER.md. The main thread drives timers
// and animation frames; the worker drains microtasks by itself.

// Transport shim: a browser Worker talks over self.postMessage/onmessage;
// a node:worker_threads Worker (eval mode) exposes parentPort through
// require. Everything else is identical.
const TRANSPORT = `
var __jsrPost, __jsrSetOn;
if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  __jsrPost = function (m) { self.postMessage(m); };
  __jsrSetOn = function (h) { self.onmessage = function (e) { h(e.data); }; };
} else {
  var __jsrPort = require('node:worker_threads').parentPort;
  __jsrPost = function (m) { __jsrPort.postMessage(m); };
  __jsrSetOn = function (h) { __jsrPort.on('message', h); };
}
`;

// Message branches, ported from the Dart backend's self.onmessage.
const DISPATCH = `
function __jsrHandleWorkerMessage(data) {
  if (data && typeof data === 'object' &&
      (data.type === 'jsr.three.frameAck' || data.type === 'jsr.three.release')) {
    var three = typeof jsr !== 'undefined' ? jsr.three : null;
    if (three) {
      if (typeof three._frameControl === 'function') three._frameControl(data);
      else if (typeof three._hostEvent === 'function') three._hostEvent(data.type, data);
    }
    return;
  }
  if (typeof data !== 'string' || data.indexOf('__jsr__') !== 0) return;
  var msg = JSON.parse(data.slice('__jsr__'.length));
  if (msg.channel === '__jsr_call_event') {
    var actionId = msg.payload.actionId;
    var payload = msg.payload.payload;
    var __h = jsr._handler || (typeof handleEvent === 'function' ? handleEvent : null);
    if (!__h) { sendMessage('__jsr_event_done', '{}'); return; }
    try {
      var __r = __h(actionId, payload);
      if (__r && typeof __r.then === 'function') {
        __r.then(function(){ sendMessage('__jsr_event_done', '{}'); },
                 function(e){ sendMessage('__jsr_event_done', JSON.stringify({error: e.message || String(e)})); });
      } else {
        sendMessage('__jsr_event_done', '{}');
      }
    } catch(e) {
      sendMessage('__jsr_event_done', JSON.stringify({error: e.message || String(e)}));
    }
  } else if (msg.channel === '__jsr_updateTheme') {
    jsr.theme = Object.assign(jsr.theme || {}, msg.payload);
    if (jsr._onThemeChange) { try { jsr._onThemeChange(jsr.theme); } catch(e) {} }
  } else if (msg.channel === '__jsr_host_event') {
    if (typeof __jsrHostEvent === 'function') {
      __jsrHostEvent(msg.payload.target, msg.payload.payload);
    }
  } else if (msg.channel === '__jsr_interval_tick') {
    if (__iv_cbs[msg.payload]) __iv_cbs[msg.payload]();
  } else if (msg.channel === '__jsr_raf_tick') {
    if (__raf_cbs[msg.payload.id]) __raf_cbs[msg.payload.id](msg.payload.elapsed);
  } else if (msg.channel === '__jsr_resolve') {
    if (__cbs[msg.payload.id]) { __cbs[msg.payload.id](msg.payload.value); delete __cbs[msg.payload.id]; }
  } else if (msg.channel === '__jsr_eval') {
    try {
      (0, eval)(msg.payload.code);
      sendMessage('__jsr_eval_result', JSON.stringify({ id: msg.payload.id, ok: true }));
    } catch (e) {
      sendMessage('__jsr_eval_result', JSON.stringify({ id: msg.payload.id, ok: false, error: e.message || String(e) }));
    }
  }
}
__jsrSetOn(__jsrHandleWorkerMessage);
`;

function json(value) {
  return JSON.stringify(value === undefined ? null : value);
}

/**
 * Build the worker script string.
 * @param {object} opts
 * @param {string} opts.iid instance id (`__IID`)
 * @param {string} opts.runtimeSource canonical bootstrap-runtime.js
 * @param {string} opts.widgetSource canonical bootstrap-widget.js
 * @param {string} opts.widgetJs widget code
 * @param {object} [opts.theme] initial theme merged into jsr.theme
 * @param {string} [opts.mockOrigin] origin injected as `__JSR_MOCK_ORIGIN__`
 * @param {string} [opts.hostBootstrapJs] optional code between the halves and the widget
 * @param {string} [opts.preloadSource] library preload between __IID and the halves (three.min.js)
 * @returns {string} the worker script
 */
export function buildWorkerScript(opts) {
  const { iid, runtimeSource, widgetSource, widgetJs } = opts;
  const theme = opts.theme ?? {};
  const mockOrigin = opts.mockOrigin ?? '';
  const hostBootstrapJs = opts.hostBootstrapJs ?? '';
  const preloadSource = opts.preloadSource ?? '';
  return `
${TRANSPORT}
var __IID = ${json(iid)};
var __JSR_MOCK_ORIGIN__ = ${json(mockOrigin)};
function sendMessage(channel, jsonString) {
  __jsrPost('__jsr__' + JSON.stringify({channel: channel, payload: jsonString}));
}
${DISPATCH}
${preloadSource}
${runtimeSource}
${widgetSource}
jsr.theme = Object.assign(jsr.theme || {}, ${json(theme)});
try {
  ${hostBootstrapJs}
  ${widgetJs}
} catch (e) {
  jsr.showError('Widget error: ' + (e.message || String(e)));
}
sendMessage('__jsr_ready', '{}');
`;
}
