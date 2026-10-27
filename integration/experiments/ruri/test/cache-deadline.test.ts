import assert from "node:assert/strict";
import test from "node:test";
import { cacheDeadline } from "../src/cache-deadline.ts";

test("a stuck optional cache transaction aborts, while completed work clears its deadline", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let aborted = 0,
    failed = 0;
  const tx = {
    abort() {
      aborted++;
    },
  } as unknown as IDBTransaction;
  const done = cacheDeadline(tx, () => failed++);
  done();
  t.mock.timers.tick(2001);
  assert.equal(aborted, 0);
  assert.equal(failed, 0);
  cacheDeadline(tx, () => failed++);
  t.mock.timers.tick(2001);
  assert.equal(aborted, 1);
  assert.equal(failed, 1);
});
