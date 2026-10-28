/** Verifies immediate inference failure recovery and rejection of retired callbacks. */
import assert from "node:assert/strict";
import test from "node:test";
import { EncoderPort } from "../../src/semantic/encoder-port.ts";
import { installEncoderWorkers } from "./test-support/encoder-worker.ts";

const port = () =>
  new EncoderPort(
    new URL("https://example.test/encoder.js"),
    new URL("https://example.test/"),
    "test-profile",
  );

test("decoding failure rejects immediately and retired callbacks cannot stop a replacement", async (t) => {
  const workers = installEncoderWorkers(t),
    encoder = port();
  const rejected = encoder.encode("日本").catch((error: Error) => error);
  const old = workers[0];
  assert.ok(old);
  const lateFailure = old.decodingListener(),
    lateError = old.onerror;

  old.dispatchEvent(new MessageEvent("messageerror"));
  assert.equal(old.terminated, true);
  assert.equal(old.decodingListeners.size, 0);
  assert.match(String(await rejected), /Encoder response could not be decoded/);

  const next = encoder.encode("大学");
  const replacement = workers[1];
  assert.ok(replacement);
  lateFailure.call(old, new MessageEvent("messageerror"));
  lateError?.(new Event("error", { cancelable: true }) as ErrorEvent);
  assert.equal(replacement.terminated, false);
  replacement.reply();
  assert.equal((await next)[0], 1);
  t.mock.timers.tick(120000);
  assert.equal(replacement.terminated, false);
  encoder.dispose();
});

test("successful requests remove listeners and ignore late callbacks when reusing their Worker", async (t) => {
  const workers = installEncoderWorkers(t),
    encoder = port();
  const first = encoder.encode("日本");
  const worker = workers[0];
  assert.ok(worker);
  const lateFailure = worker.decodingListener();
  worker.reply();
  await first;
  assert.equal(worker.decodingListeners.size, 0);

  const next = encoder.encode("大学");
  assert.equal(workers.length, 1);
  assert.equal(worker.decodingListeners.size, 1);
  lateFailure.call(worker, new MessageEvent("messageerror"));
  worker.reply(-1);
  assert.equal(worker.terminated, false);
  worker.reply();
  assert.equal((await next)[0], 1);
  assert.equal(worker.decodingListeners.size, 0);
  t.mock.timers.tick(120000);
  assert.equal(worker.terminated, false);
  encoder.dispose();
});

for (const failure of ["error", "timeout"] as const) {
  test(`${failure} failure releases inference state and permits a fresh Worker`, async (t) => {
    const workers = installEncoderWorkers(t),
      encoder = port();
    const first = encoder.encode("日本").catch((error: Error) => error);
    const worker = workers[0];
    assert.ok(worker);
    if (failure === "error") {
      const event = new Event("error", { cancelable: true }) as ErrorEvent;
      worker.onerror?.(event);
      assert.equal(event.defaultPrevented, true);
    } else {
      t.mock.timers.tick(119999);
      assert.equal(worker.terminated, false);
      t.mock.timers.tick(1);
    }

    assert.ok((await first) instanceof Error);
    assert.equal(worker.terminated, true);
    assert.equal(worker.decodingListeners.size, 0);
    const next = encoder.encode("大学");
    const replacement = workers[1];
    assert.ok(replacement);
    replacement.reply();
    assert.equal((await next)[0], 1);
    t.mock.timers.tick(120000);
    assert.equal(replacement.terminated, false);
    encoder.dispose();
  });
}

test("a synchronous send failure releases inference state before retrying", async (t) => {
  const workers = installEncoderWorkers(t),
    encoder = port();
  const first = encoder.encode("日本");
  const worker = workers[0];
  assert.ok(worker);
  worker.reply();
  await first;

  worker.failSend = true;
  const rejected = encoder.encode("大学").catch((error: Error) => error);
  assert.match(String(await rejected), /Encoder request could not be sent/);
  assert.equal(worker.terminated, true);
  assert.equal(worker.decodingListeners.size, 0);

  const next = encoder.encode("大学");
  const replacement = workers[1];
  assert.ok(replacement);
  replacement.reply();
  assert.equal((await next)[0], 1);
  t.mock.timers.tick(120000);
  assert.equal(replacement.terminated, false);
  encoder.dispose();
});
