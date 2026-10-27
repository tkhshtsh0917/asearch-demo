import assert from "node:assert/strict";
import test from "node:test";
import { TurnScheduler } from "../src/scheduler.ts";

test("two concurrent tasks yield in order; disposal resolves queued tasks and closes the scheduler", async () => {
  const scheduler = new TurnScheduler(),
    order: number[] = [];
  const first = scheduler.turn().then(() => order.push(1));
  const second = scheduler.turn().then(() => order.push(2));
  await assert.rejects(scheduler.turn(), /queue limit/);
  await Promise.all([first, second]);
  assert.deepEqual(order, [1, 2]);
  const pending = scheduler.turn();
  scheduler.dispose();
  scheduler.dispose();
  await pending;
  await assert.rejects(scheduler.turn(), /disposed/);
});
