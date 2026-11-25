# react_js_widget_runtime

Web renderer for JSR widgets: a JSON widget tree produced by `jsr.render`
runs in a Web Worker and is rendered into the DOM with React. Part of the
[JSR family](https://github.com/IstiN/js_runtime) (`js_runtime`, `js_widget_runtime`,
`flutter_js_widget_runtime`, `android_js_widget_runtime`, `apple_js_widget_runtime`).

## How it works

- **Worker engine** (`src/engine/`): a port of the Flutter web worker
  backend — the widget runs on a Worker with the two canonical bootstrap
  halves (`src/vendor/`, generated from `IstiN/js_widget_runtime` by
  `scripts/sync-bootstrap.sh`), the main thread drives timers, animation
  frames and the host services, and the interface is the engine adapter of
  `IstiN/js_runtime/docs/ENGINE_ADAPTER.md`.
- **DOM mapping** (`src/dom/mapping.js`): normalized node tree to React
  elements. Implemented node types: the Android POC set (`center`, `column`,
  `row`, `text`, `textButton`/`button`, `textField`, `sizedBox`, `padding`,
  `container`, `card`, `scroll`, `listView`, `divider`, `spacer`) plus
  `image`, `icon`, `video`, `audio`; every other registered type renders the
  fallback card with its node id tag. Effect props (blur, clip, boxShadows,
  gradients, rotateX/rotateY/perspective, textShadow, textTransform,
  offsetX/offsetY, scale, rotation, opacity) map to CSS natively.
- **Host services** (`src/host/hostServices.js`): `fetch` (mock origin),
  `localStorage`, in-memory secrets, `loadAsset` by fetch, `openUrl` by
  `window.open`, `exec` resolves the documented named error.
- **AUI dump** (`src/dom/dumpViewTree.js`): DOM reflection — every mapped
  element carries `data-node-id`/`data-node-type`; text-bearing props are
  read live from the DOM, the rest from the applied-node record.

## Usage

```js
import { mountJsrWidget } from './dist/jsr-widget.js';

const handle = mountJsrWidget(container, { widgetJs, iid: 'my-widget' });
await handle.start();
handle.dump();      // normalized AUI dump of what is on screen
handle.dispose();
```

## Local commands

```bash
npm install
npm test          # unit tests (node --test)
npm run build     # esbuild bundle -> dist/jsr-widget.js
npm run proof     # Playwright browser proof (needs `npx playwright install chromium`)
```

## Quality gate

First-party source only (`src/`, generated `src/vendor/` excluded); the
coverage file comes from the unit tests; a missing or empty coverage file
fails the job.

```bash
npx c8 --reporter=json --reporter=text --include='src/**' node --test "test/*.test.js"
npx crap4js src --coverage coverage/coverage-final.json --threshold 8.0 --exclude 'src/vendor/**'
```

## Conformance

Cross-repository inputs are pinned in `conformance.lock` and fetched with
`scripts/fetch-conformance.sh` into `.conformance/` (CI runs it right after
checkout). The bootstrap drift check
(`scripts/sync-bootstrap.sh && git diff --exit-code`) fails when a committed
copy differs from its source.
