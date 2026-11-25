// Runner parts that run without a browser: fixture filter, trace
// post-processing, result assembly, boot decisions, action dispatch through
// the driver with a fake IO.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleResult, filterFixtureIds, needsMock, needsPreload, resultTrace } from '../src/conformance/runner.js';
import { applyActions, createDomInteractionDriver } from '../src/dom/DomInteractionDriver.js';

test('resultTrace drops the worker-internal event_done verb', () => {
  assert.deepEqual(
    resultTrace(['render', 'event_done', 'set_title', 'render', 'event_done']),
    ['render', 'set_title', 'render'],
  );
  assert.deepEqual(resultTrace(['render']), ['render']);
});

test('filterFixtureIds: glob with star, literal passthrough', () => {
  const ids = ['hello', 'counter', 'l0_card', 'l0_carousel', 'three_scene_graph'];
  assert.deepEqual(filterFixtureIds(ids, 'l0_ca*'), ['l0_card', 'l0_carousel']);
  assert.deepEqual(filterFixtureIds(ids, 'counter'), ['counter']);
  assert.deepEqual(filterFixtureIds(ids, 'three_*'), ['three_scene_graph']);
  assert.deepEqual(filterFixtureIds(ids), ids);
  assert.deepEqual(filterFixtureIds(ids, 'he*o'), ['hello']);
});

test('needsMock / needsPreload follow meta.json', () => {
  assert.equal(needsMock({ mock: { '/a': { status: 200, body: {} } } }), true);
  assert.equal(needsMock({ mock: {} }), false);
  assert.equal(needsMock({}), false);
  assert.equal(needsPreload({ capabilities: ['three'] }), true);
  assert.equal(needsPreload({ capabilities: [] }), false);
  assert.equal(needsPreload({}), false);
});

test('assembleResult mirrors the kit result shape', () => {
  const bridge = {
    trace: ['render', 'set_title', 'render', 'event_done'],
    renders: ['{a}', '{b}'],
    title: 'T',
    state: { n: 1 },
    consoleLines: ['x'],
  };
  const result = assembleResult({ fixture: 'f1', bridge, dump: { type: 'text' }, finalDump: { type: 'row' } });
  assert.deepEqual(result, {
    fixture: 'f1',
    platform: 'web',
    status: 'DONE',
    dump: { type: 'text' },
    trace: ['render', 'set_title', 'render'],
    diffs: [],
    screenshot: null,
    renders: ['{a}', '{b}'],
    finalDump: { type: 'row' },
    title: 'T',
    state: { n: 1 },
    console: ['x'],
    error: null,
    skippedReason: null,
  });
  const failed = assembleResult({
    fixture: 'f2',
    bridge: { trace: [], renders: [], title: null, state: null, consoleLines: [] },
    dump: null,
    finalDump: null,
    error: 'boot failed',
  });
  assert.equal(failed.error, 'boot failed');
  assert.equal(failed.dump, null);
  assert.equal(failed.state, null);
});

function fakeIo() {
  const calls = [];
  return {
    calls,
    async click(selector) { calls.push(['click', selector]); },
    async clickText(text) { calls.push(['clickText', text]); },
    async setText(selector, value) { calls.push(['setText', selector, value]); },
    async pressEnter(selector) { calls.push(['pressEnter', selector]); },
    async wheelCenter(dx, dy) { calls.push(['wheelCenter', dx, dy]); },
    async drag(x1, y1, x2, y2, ms) { calls.push(['drag', x1, y1, x2, y2, ms]); },
    async sleep(ms) { calls.push(['sleep', ms]); },
    async hostEventBack() { calls.push(['hostEventBack']); },
  };
}

test('driver dispatches every action kind through the io', async () => {
  const io = fakeIo();
  const driver = createDomInteractionDriver(io);
  await applyActions(driver, [
    { tap: 'n3' },
    { tap: 'Tap me' },
    { input: { node: 'n2', value: 'x' } },
    { submit: 'n1' },
    { scroll: [0, 600] },
    { swipe: [50, 500, 50, 100, 300] },
    { wait: 250 },
    { back: true },
  ]);
  assert.deepEqual(io.calls, [
    ['click', '[data-node-id="n3"]'],
    ['clickText', 'Tap me'],
    ['setText', '[data-node-id="n2"]', 'x'],
    ['pressEnter', '[data-node-id="n1"]'],
    ['wheelCenter', 0, 600],
    ['drag', 50, 500, 50, 100, 300],
    ['sleep', 250],
    ['hostEventBack'],
  ]);
});

test('applyActions rejects unknown action kinds', async () => {
  const driver = createDomInteractionDriver(fakeIo());
  await assert.rejects(() => applyActions(driver, [{ teleport: 'n1' }]), /unknown action kind/);
});

test('applyActions calls the afterAction hook between actions', async () => {
  const io = fakeIo();
  const driver = createDomInteractionDriver(io);
  const seen = [];
  await applyActions(driver, [{ tap: 'n1' }, { wait: 10 }], async (kind) => seen.push(kind));
  assert.deepEqual(seen, ['tap', 'wait']);
});
