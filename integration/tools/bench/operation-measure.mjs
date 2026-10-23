// Compare loading or repeated public updates without timing setup/result checks.

import { measureExplanations } from "./explain-measure.mjs";
import { pairedOperations as paired } from "./operation-pairs.mjs";
import { measureSessions } from "./session-measure.mjs";

function snapshot(result) {
  return JSON.stringify(
    [result.ids, result.levels, result.orders, result.totals].map((v) => [
      ...v,
    ]),
  );
}

async function descriptor(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-384", bytes));
  return {
    id: view.getBigUint64(24, true).toString(16).padStart(16, "0"),
    url: "https://example.test/fixture.asix",
    bytes: bytes.length,
    texts: view.getUint32(36, true),
    integrity: `sha384-${btoa(String.fromCharCode(...digest))}`,
  };
}

function measureLoad(apis, bytes, expected, options, now) {
  let reference;
  const pattern = options.pattern ?? "地理";
  const report = paired((side) => {
    const start = now();
    const index = apis[side].AsearchIndex.fromBytes(bytes, { expected });
    const elapsed = now() - start;
    try {
      const value = snapshot(index.search(pattern, { countTotal: true }));
      reference ??= value;
      if (value !== reference) throw new Error("Load result mismatch");
      return elapsed;
    } finally {
      index.free();
    }
  }, options);
  return {
    ...report,
    pattern,
    scope:
      "Individual in-memory fromBytes with expected SHA-384; search/free outside timer; excludes HTTP, module compile and initialization",
  };
}

function measureNarrowing(apis, bytes, options, now) {
  const {
    primer,
    pattern,
    iterations = 512,
    baselineEngine = "auto",
    candidateEngine = "auto",
  } = options;
  if (baselineEngine !== "auto" || candidateEngine !== "auto")
    throw new RangeError("Narrowing batches require engine auto on both sides");
  if (
    typeof primer !== "string" ||
    typeof pattern !== "string" ||
    primer.length > 1024 ||
    pattern.length > 1024 ||
    !Number.isInteger(iterations) ||
    iterations < 1 ||
    iterations > 16384
  )
    throw new RangeError("Invalid narrowing batch workload");
  const indexes = [],
    sessions = [];
  try {
    for (const api of apis) {
      const index = api.AsearchIndex.fromBytes(bytes);
      indexes.push(index);
      sessions.push(index.session({ engine: "auto", countTotal: true }));
    }
    let reference;
    const verify = (result) => {
      const value = snapshot(result);
      reference ??= value;
      if (value !== reference || result.stats.engine !== "narrowing")
        throw new Error("Narrowing result or selected engine mismatch");
    };
    const report = paired((side) => {
      const session = sessions[side];
      session.reset();
      session.update(primer);
      verify(session.update(pattern));
      let last;
      const start = now();
      for (let i = 0; i < iterations; i++) last = session.update(pattern);
      const elapsed = (now() - start) / iterations;
      verify(last);
      return elapsed;
    }, options);
    return {
      ...report,
      primer,
      pattern,
      iterations,
      comparison: { baselineEngine, candidateEngine },
      scope:
        "Batch mean milliseconds per repeated public session.update; reset/prime and result checks excluded; percentiles describe batch means, not individual keystrokes",
    };
  } finally {
    for (const session of sessions.reverse()) session.free();
    for (const index of indexes.reverse()) index.free();
  }
}

export async function measureComparison(
  api,
  bytes,
  options = {},
  now = () => performance.now(),
) {
  const { kind = "session", candidateApi = api } = options;
  if (kind === "explain")
    return measureExplanations([api, candidateApi], bytes, options, now);
  if (kind === "load")
    return measureLoad(
      [api, candidateApi],
      bytes,
      await descriptor(bytes),
      options,
      now,
    );
  if (kind === "narrow-batch")
    return measureNarrowing([api, candidateApi], bytes, options, now);
  return measureSessions(api, bytes, options, now);
}
