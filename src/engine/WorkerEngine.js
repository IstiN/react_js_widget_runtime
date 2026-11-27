// Main-thread worker engine — the Web Worker row of
// .conformance/js_runtime/docs/ENGINE_ADAPTER.md: five operations, five
// host-to-JS helpers. The worker runs the two canonical bootstrap halves and
// the widget; this side unwraps `__jsr__`-framed messages and drives timers
// and animation frames through the tick control messages.
import { buildWorkerScript } from './workerBootstrap.js';

const READY_TIMEOUT_MS = 5000; // the Dart backend uses the same budget

// Default transport: a browser Worker created from a Blob URL (the Dart
// backend's transport). Worker boot errors are reported on the same bus so
// they surface in the message trace instead of dying silently.
function browserTransport(code, onRawMessage) {
  const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
  const worker = new Worker(url);
  worker.onerror = (e) => onRawMessage(`__jsr__${JSON.stringify({ channel: '__jsr_worker_error', payload: JSON.stringify({ message: e.message || String(e.message ?? e) }) })}`);
  worker.onmessage = (e) => onRawMessage(e.data);
  return {
    post: (m) => worker.postMessage(m),
    setHandler: () => {}, // handler wired above
    stop: () => { worker.terminate(); URL.revokeObjectURL(url); },
  };
}

const PREFIX = '__jsr__';

function unwrap(data) {
  if (typeof data !== 'string' || !data.startsWith(PREFIX)) return null;
  try {
    return JSON.parse(data.slice(PREFIX.length));
  } catch {
    return null;
  }
}

/**
 * createWorkerEngine — the `create` operation. Options: the worker script
 * inputs (see buildWorkerScript) plus an optional `transport(code)` factory
 * for non-browser hosts.
 */
export function createWorkerEngine(opts = {}) {
  const makeTransport = opts.transport ?? browserTransport;
  let transport = null;
  // The Dart backend builds its bridge (with onRender etc.) in the
  // constructor, before run(): handlers must exist before the worker boots.
  let messageCallback = typeof opts.onMessage === 'function' ? opts.onMessage : null;
  let readyPromise = null;
  let readySettle = null;
  const pendingEvals = new Map(); // eval id -> { resolve }
  let evalSeq = 0;
  let disposed = false;

  const INTERNAL_CHANNELS = new Set(['__jsr_ready', '__jsr_eval_result', '__jsr_worker_error']);

  function handleMessage(data) {
    const msg = typeof data === 'string' ? unwrap(data) : null;
    if (!msg || typeof msg.channel !== 'string') return;
    if (INTERNAL_CHANNELS.has(msg.channel)) dispatchInternal(msg);
    else if (messageCallback) messageCallback(msg.channel, msg.payload);
  }

  function dispatchInternal(msg) {
    if (msg.channel === '__jsr_ready') {
      if (readySettle) { readySettle.ok(); readySettle = null; }
    } else if (msg.channel === '__jsr_eval_result') {
      settleEval(msg.payload);
    } else {
      noteWorkerError(msg.payload);
    }
  }

  function noteWorkerError(payload) {
    const p = typeof payload === 'string' ? JSON.parse(payload) : payload;
    engine.lastError = p?.message ?? 'worker error';
  }

  function settleEval(payload) {
    const p = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const pending = pendingEvals.get(p?.id);
    if (!pending) return;
    pendingEvals.delete(p.id);
    pending.resolve(p.ok ? { ok: true } : { ok: false, error: p.error });
  }

  function post(channel, payload) {
    if (disposed || !transport) return;
    transport.post(PREFIX + JSON.stringify({ channel, payload }));
  }

  const engine = {
    lastError: null,

    /** `run`: start the worker with the boot items and the widget code. */
    run() {
      disposed = false;
      readyPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          readySettle = null;
          reject(new Error('worker ready timeout'));
        }, READY_TIMEOUT_MS);
        readySettle = {
          ok: () => { clearTimeout(timer); resolve(); },
        };
      });
      transport = makeTransport(buildWorkerScript(opts), handleMessage);
      transport.setHandler(handleMessage);
      return readyPromise;
    },

    /** `eval(code, sourceName)`: evaluates on the worker thread. */
    eval(code, _sourceName = '<widget>') {
      const id = 'e' + (++evalSeq);
      return new Promise((resolve) => {
        pendingEvals.set(id, { resolve });
        post('__jsr_eval', { id, code });
      });
    },

    /** `callEvent`: dispatches a widget action; the worker answers `__jsr_event_done`. */
    callEvent(actionId, payload = {}) {
      post('__jsr_call_event', { actionId, payload });
    },

    /** `resolveCallback`: resolves a pending promise channel (`__jsrResolve`). */
    resolveCallback(id, value) {
      post('__jsr_resolve', { id, value });
    },

    /** `intervalTick`: fires a pending interval/timeout callback. */
    intervalTick(id) {
      post('__jsr_interval_tick', id);
    },

    /** `rafTick`: fires an animation-frame callback with its elapsed ms. */
    rafTick(id, elapsed) {
      post('__jsr_raf_tick', { id, elapsed });
    },

    /** `hostEvent`: `__jsrHostEvent(target, payload)` on the worker. */
    hostEvent(target, payload) {
      post('__jsr_host_event', { target, payload });
    },

    /** Theme push (`__jsr_updateTheme`), as in the Dart backend. */
    updateTheme(colors) {
      post('__jsr_updateTheme', colors ?? {});
    },

    /** `setMessageCallback`: every engine->host channel lands here. */
    setMessageCallback(cb) {
      messageCallback = cb;
    },

    /** `executePendingJobs`: no-op — the worker drains by itself. */
    executePendingJobs() {},

    /** `dispose`: terminate; no callbacks fire afterwards. */
    dispose() {
      disposed = true;
      if (transport) {
        transport.stop();
        transport = null;
      }
      for (const pending of pendingEvals.values()) pending.resolve({ ok: false, error: 'engine disposed' });
      pendingEvals.clear();
    },
  };
  return engine;
}
