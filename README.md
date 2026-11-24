# react_js_widget_runtime

Web renderer for jsr widgets: JSON tree to DOM (React).

Part of the jsr family:
- Contract + conformance: [js_widget_runtime](https://github.com/IstiN/js_widget_runtime) (PROTOCOL.md is the binding test spec)
- Runtime core: [js_runtime](https://github.com/IstiN/js_runtime)
- Reference renderer: [flutter_js_widget_runtime](https://github.com/IstiN/flutter_js_widget_runtime)
- Android: [android_js_widget_runtime](https://github.com/IstiN/android_js_widget_runtime)

Engine notes: Browser: the js_runtime Web Worker engine, DOM as the render target. Three.js gets real WebGL here — unique among renderers.

Status: **planning** — see issues. Conformance must pass per
[js_widget_runtime/docs/conformance/PROTOCOL.md](https://github.com/IstiN/js_widget_runtime/blob/main/docs/conformance/PROTOCOL.md).
