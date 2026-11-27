// DOM interaction driver — the web half of plan 1.4 actions. The driver is
// IO-adapter based so the dispatch logic is unit-testable without a
// browser: the runner passes a Playwright-backed IO, tests pass a fake.
//
// Action semantics (plan 1.4 + PROTOCOL v0.2 amendments):
// - tap by nodeId (`/^n\d+$/`) or by visible text
// - input: set the value and fire the input event (onChanged / onChange)
// - submit (A1): keyboard done on the text node (onSubmit / onSubmitted)
// - scroll (A2): wheel/trackpad pointer scroll at the surface center
// - swipe: pointer drag with the given duration
// - wait: real time on every platform
// - back: the reference host-event call `__jsrHostEvent('back', {})`
export const NODE_ID_ATTR = 'data-node-id';

const isNodeId = (value) => typeof value === 'string' && /^n\d+$/.test(value);

/**
 * createDomInteractionDriver — actions against the mounted widget.
 * @param {object} io browser adapter:
 *   click(selector), clickText(text), setText(selector, value),
 *   pressEnter(selector), wheelCenter(dx, dy), drag(x1, y1, x2, y2, ms),
 *   sleep(ms), hostEventBack()
 */
export function createDomInteractionDriver(io) {
  return {
    async tap(target) {
      if (isNodeId(target)) await io.click(nodeSelector(target));
      else await io.clickText(String(target));
    },
    async input(action) {
      await io.setText(nodeSelector(action.node), String(action.value ?? ''));
    },
    async submit(target) {
      await io.pressEnter(nodeSelector(typeof target === 'string' ? target : target.node));
    },
    async scroll(delta) {
      await io.wheelCenter(delta[0], delta[1]);
    },
    async swipe(spec) {
      const [x1, y1, x2, y2, ms] = spec;
      await io.drag(x1, y1, x2, y2, ms ?? 300);
    },
    async wait(ms) {
      await io.sleep(ms);
    },
    async back() {
      await io.hostEventBack();
    },
  };
}

const ACTION_HANDLERS = {
  tap: (driver, arg) => driver.tap(arg),
  input: (driver, arg) => driver.input(arg),
  submit: (driver, arg) => driver.submit(arg),
  scroll: (driver, arg) => driver.scroll(arg),
  swipe: (driver, arg) => driver.swipe(arg),
  wait: (driver, arg) => driver.wait(arg),
  back: (driver) => driver.back(),
};

// Applies the actions array of expected.json in order; an optional
// `afterAction` hook settles between actions (the reference runner pumps
// after every action).
export async function applyActions(driver, actions, afterAction = null) {
  for (const action of actions ?? []) {
    const [kind, arg] = Object.entries(action)[0];
    const handler = ACTION_HANDLERS[kind];
    if (!handler) throw new Error(`unknown action kind: ${kind}`);
    await handler(driver, arg);
    if (afterAction) await afterAction(kind, arg);
  }
}

export function nodeSelector(nodeId) {
  return `[${NODE_ID_ATTR}="${nodeId}"]`;
}
