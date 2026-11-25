// Host services and the host half of the worker protocol — the mirror of
// .conformance/js_widget_runtime/harness/host.mjs, but as a live browser
// host: promise channels resolve through the engine's resolveCallback,
// the main thread drives interval and rAF ticks, storage rides localStorage,
// secrets stay in memory, exec resolves the documented named error.
const UNSUPPORTED = {
  __jsr_exec: '__jsr_exec is not supported by this host',
  __jsr_host_call: '__jsr_host_call is not supported by this host',
  __jsr_capture: '__jsr_capture is not supported by this host',
};

function parseObject(payload) {
  if (payload && typeof payload === 'object') return payload;
  if (typeof payload !== 'string') return undefined;
  return parseJson(payload);
}

function parseJson(s) {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

// Object payloads arrive with the routing `iid` merged in (`__tag`); strip
// it the way the bridge does (PROTOCOL 1/6).
function parseTagged(payload) {
  const p = parseObject(payload);
  if (p && p.iid !== undefined) delete p.iid;
  return p;
}

function unwrapRaw(payload) {
  const s = typeof payload === 'string' ? payload : String(payload);
  const o = parseObject(s);
  if (o && typeof o.id === 'string' && typeof o.iid === 'string' && Object.keys(o).length === 2) return o.id;
  return s;
}

// localStorage wrapper; injectable for tests and non-browser hosts.
function defaultStorage() {
  const ls = globalThis.localStorage;
  return {
    get: (key) => {
      const raw = ls.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    },
    set: (key, value) => ls.setItem(key, JSON.stringify(value)),
  };
}

function intervalMsOf(p, once) {
  return typeof p.ms === 'number' && p.ms >= 0 ? p.ms : (once ? 0 : 1000);
}

// ctx carries { bridge, resolve, schedule, unschedule, storage, secrets,
// open, assetBase } — the same per-channel-table shape as the kit host.
function resolveHandler(valueFn) {
  return (ctx, payload) => {
    const p = parseTagged(payload);
    if (!p || typeof p.id !== 'string') return;
    ctx.resolve(p.id, valueFn(ctx, p));
  };
}

function cancelTimer(ctx, payload) {
  ctx.unschedule(unwrapRaw(payload));
}

const HANDLERS = {
  __jsr_render: (ctx, payload) => { ctx.bridge.renders.push(String(payload)); },
  __jsr_set_title: (ctx, payload) => { ctx.bridge.title = unwrapRaw(payload); },
  __jsr_log: (ctx, payload) => { ctx.bridge.consoleLines.push(unwrapRaw(payload)); },
  __jsr_export_state: (ctx, payload) => { ctx.bridge.state = parseTagged(payload) ?? null; },
  __jsr_set_interval: (ctx, payload) => {
    const p = parseTagged(payload);
    if (!p || typeof p.id !== 'string') return;
    const once = Boolean(p.once);
    const ms = intervalMsOf(p, once);
    ctx.schedule(p.id, ms, () => ctx.engine.intervalTick(p.id), !once);
  },
  __jsr_clear_interval: cancelTimer,
  __jsr_caf: cancelTimer,
  __jsr_raf: (ctx, payload) => {
    const p = parseTagged(payload);
    if (!p || typeof p.id !== 'string') return;
    ctx.schedule(p.id, 0, () => ctx.engine.rafTick(p.id, Date.now() - ctx.startedAt), false);
  },
  __jsr_fetch: (ctx, payload) => {
    const p = parseTagged(payload);
    if (!p || typeof p.id !== 'string') return;
    asyncFetchValue(ctx, p).then((v) => ctx.resolve(p.id, v));
  },
  __jsr_storage_get: resolveHandler((ctx, p) => storedValue(ctx.storage, String(p.key))),
  __jsr_storage_set: (ctx, payload) => {
    const p = parseTagged(payload);
    if (!p || typeof p.key !== 'string') return;
    ctx.storage.set(p.key, p.value);
  },
  __jsr_secrets_get: resolveHandler((ctx, p) => (ctx.secrets.has(p.key) ? ctx.secrets.get(p.key) : null)),
  __jsr_secrets_set: (ctx, payload) => {
    const p = parseTagged(payload);
    if (!p || typeof p.id !== 'string') return;
    ctx.secrets.set(p.key, p.value);
    ctx.resolve(p.id, true);
  },
  __jsr_load_asset: (ctx, payload) => {
    const p = parseTagged(payload);
    if (!p || typeof p.id !== 'string') return;
    asyncLoadValue(ctx.assetBase, String(p.path)).then((v) => ctx.resolve(p.id, v));
  },
  __jsr_open_url: (ctx, payload) => {
    const p = parseTagged(payload);
    if (!p || typeof p.id !== 'string') return;
    ctx.open(String(p.url ?? ''));
    ctx.resolve(p.id, true);
  },
  __jsr_event_done: () => {},       // fire-and-forget lanes: dropped
  __jsr_host_call_binary: () => {},
  __jsr_scene3d_command: () => {},
};

// unsupported promise channels resolve the documented named error
for (const [channel, message] of Object.entries(UNSUPPORTED)) {
  HANDLERS[channel] = resolveHandler(() => ({ __error: message }));
}

function storedValue(storage, key) {
  try {
    return storage.get(key) ?? null;
  } catch {
    return null;
  }
}

async function asyncFetchValue(_ctx, p) {
  try {
    const res = await fetch(String(p.url), { method: p.method || 'GET', headers: p.headers || {} });
    if (!res.ok) return { __error: `HTTP ${res.status}` };
    return await res.json();
  } catch (e) {
    return { __error: e.message || String(e) };
  }
}

async function asyncLoadValue(assetBase, path) {
  try {
    const res = await fetch(`${assetBase}/${path}`);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null; // loadAsset never rejects (harness readAsset semantics)
  }
}

/**
 * createHostBridge — wires an engine to host-side behavior.
 * @param {object} engine a createWorkerEngine handle
 * @param {object} opts
 * @param {string} [opts.mockOrigin] origin served to the widget (`__JSR_MOCK_ORIGIN__`)
 * @param {string} [opts.assetBase] base url for `jsr.loadAsset` fetches
 * @param {object} [opts.storage] { get, set } backend (default localStorage)
 * @param {Map} [opts.secrets] in-memory secret store (default fresh Map)
 * @param {function} [opts.open] window.open override (default window.open)
 * @param {function} [opts.notify] (channel) called after each message dispatch
 * @returns {object} bridge with trace/renders/title/state/console records
 */
export function createHostBridge(engine, opts = {}) {
  const storage = opts.storage ?? defaultStorage();
  const secrets = opts.secrets ?? new Map();
  const open = opts.open ?? ((url) => globalThis.open(url));
  const timers = new Map(); // timer id -> { cancel }
  const startedAt = Date.now();

  const bridge = {
    trace: [],        // verbs: channel name without the __jsr_ prefix
    renders: [],      // raw __jsr_render payload strings in order
    title: null,
    state: null,
    consoleLines: [],
    dispose() {
      for (const t of timers.values()) t.cancel();
      timers.clear();
    },
  };

  const ctx = {
    bridge,
    engine,
    storage,
    secrets,
    open,
    assetBase: opts.assetBase ?? '',
    startedAt,
    resolve: (id, value) => engine.resolveCallback(id, value),
    unschedule: (id) => {
      timers.get(id)?.cancel();
      timers.delete(id);
    },
    schedule,
  };

  // rAF when the host has it (browser), setTimeout fallback for the
  // non-browser main thread; once timers fire once, intervals repeat.
  function schedule(id, ms, tick, repeat) {
    const raf = globalThis.requestAnimationFrame;
    let cancel;
    if (raf && !repeat) {
      const rafId = raf(() => {
        if (!timers.has(id)) return;
        timers.delete(id);
        tick();
      });
      cancel = () => globalThis.cancelAnimationFrame(rafId);
    } else if (repeat) {
      const t = setInterval(tick, ms);
      cancel = () => clearInterval(t);
    } else {
      const t = setTimeout(() => { timers.delete(id); tick(); }, ms);
      cancel = () => clearTimeout(t);
    }
    timers.set(id, { cancel });
  }

  bridge.dispatch = (channel, payload) => {
    bridge.trace.push(channel.slice('__jsr_'.length));
    const handler = HANDLERS[channel];
    if (handler) handler(ctx, payload);
    if (opts.notify) opts.notify(channel);
  };

  engine.setMessageCallback((channel, payload) => bridge.dispatch(channel, payload));

  return bridge;
}
