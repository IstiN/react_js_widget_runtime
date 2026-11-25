// Public entry: mount a jsr widget into a DOM container with React as the
// view layer. The widget runs in a Worker (browser) with the two canonical
// bootstrap halves; this thread renders `jsr.render` payloads and drives
// timers, rAF and host services.
import { createRoot } from 'react-dom/client';
import { createWorkerEngine } from './engine/WorkerEngine.js';
import { createHostBridge } from './host/hostServices.js';
import { renderJsrTree } from './dom/mapping.js';
import { dumpViewTree } from './dom/dumpViewTree.js';
import runtimeSource from './vendor/bootstrap-runtime.js?text';
import widgetSource from './vendor/bootstrap-widget.js?text';

export { createWorkerEngine } from './engine/WorkerEngine.js';
export { buildWorkerScript } from './engine/workerBootstrap.js';
export { createHostBridge } from './host/hostServices.js';
export { renderJsrTree, MAPPED_TYPES } from './dom/mapping.js';
export { dumpViewTree } from './dom/dumpViewTree.js';

/**
 * Mount a jsr widget.
 * @param {HTMLElement} container mount point
 * @param {object} options
 * @param {string} options.widgetJs widget code
 * @param {string} [options.iid] instance id (default 'jsr-web')
 * @param {object} [options.theme] initial theme
 * @param {string} [options.mockOrigin] origin for the widget's `__JSR_MOCK_ORIGIN__`
 * @param {string} [options.assetBase] base url for `jsr.loadAsset`
 * @param {object} [options.storage] storage backend override
 * @param {Map} [options.secrets] secrets store override
 * @returns {object} handle: { engine, bridge, dump, dispose }
 */
export function mountJsrWidget(container, options = {}) {
  const engine = createWorkerEngine({
    iid: options.iid ?? 'jsr-web',
    runtimeSource: options.runtimeSource ?? runtimeSource,
    widgetSource: options.widgetSource ?? widgetSource,
    widgetJs: options.widgetJs,
    theme: options.theme,
    mockOrigin: options.mockOrigin,
  });
  let record = new Map();
  let views = 0;
  const bridge = createHostBridge(engine, {
    mockOrigin: options.mockOrigin,
    assetBase: options.assetBase,
    storage: options.storage,
    secrets: options.secrets,
    notify: (channel) => {
      if (channel === '__jsr_render') renderView();
      else if (channel === '__jsr_set_title') document.title = bridge.title;
    },
  });
  const root = createRoot(container);
  const onAction = (actionId, payload) => engine.callEvent(actionId, payload ?? {});

  function renderView() {
    if (bridge.renders.length === 0) return;
    views++;
    const applied = renderJsrTree(bridge.renders[bridge.renders.length - 1], { onAction });
    record = applied.record;
    root.render(applied.element);
  }

  return {
    engine,
    bridge,
    views: () => views,
    dump: () => dumpViewTree(container, record),
    async start() {
      await engine.run();
      return this;
    },
    dispose() {
      bridge.dispose();
      engine.dispose();
      root.unmount();
    },
  };
}
