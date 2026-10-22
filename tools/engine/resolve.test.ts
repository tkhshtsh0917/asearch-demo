import assert from "node:assert/strict";
import test from "node:test";
import { checksumPin, resolveRelease } from "./resolve.ts";

const sums = ["linux-x86_64", "macos-aarch64", "windows-x86_64"]
  .map((p) => `${"a".repeat(64)}  asearch-assets-${p}.tar.gz`)
  .join("\n");

test("release checksums require one entry for every platform", () => {
  assert.equal(
    checksumPin("v0.2.0", sums).assets["macos-aarch64"],
    "a".repeat(64),
  );
  for (const text of [
    sums.split("\n").slice(1).join("\n"),
    `${sums}\n${sums}`,
    "bad",
    sums.replace(/a/g, "x"),
  ])
    assert.throws(() => checksumPin("v0.2.0", text));
});

test("explicit tags and latest resolve once to an exact published identity", async () => {
  for (const selector of ["latest", "v0.2.0", "v0.2.0-rc.1"]) {
    const tag = selector === "latest" ? "v0.2.0" : selector;
    const urls: string[] = [];
    const request: typeof fetch = async (url) => {
      urls.push(String(url));
      return new Response(
        urls.length === 1
          ? JSON.stringify({
              tag_name: tag,
              draft: false,
              prerelease: tag.includes("-"),
            })
          : sums,
      );
    };
    assert.equal((await resolveRelease(selector, request)).tag, tag);
    assert.equal(urls.length, 2);
    assert.ok(urls[1]?.includes(`/download/${tag}/SHA256SUMS`));
  }
});

test("invalid selectors fail before issuing HTTP requests", async () => {
  const invalid: typeof fetch = async () => {
    throw new Error("must not fetch");
  };

  await assert.rejects(resolveRelease("main", invalid), /Invalid release/);
});

test("unpublished and mismatched identities are rejected", async () => {
  for (const metadata of [
    { tag_name: "v9.0.0", draft: false },
    { tag_name: "v0.2.0", draft: true },
    { tag_name: "../main", draft: false },
  ]) {
    const response = () =>
      Promise.resolve(new Response(JSON.stringify(metadata)));

    await assert.rejects(resolveRelease("v0.2.0", response));
  }
});

test("latest rejects prereleases", async () => {
  const metadata = { tag_name: "v0.2.0-rc.1", draft: false, prerelease: true };

  await assert.rejects(
    resolveRelease(
      "latest",
      async () => new Response(JSON.stringify(metadata)),
    ),
  );
});

test("missing and oversized metadata responses are rejected", async () => {
  await assert.rejects(
    resolveRelease(
      "latest",
      async () => new Response("missing", { status: 404 }),
    ),
    /404/,
  );
  await assert.rejects(
    resolveRelease(
      "latest",
      async () => new Response("x".repeat(1024 * 1024 + 1)),
    ),
    /limit/,
  );
});

test("failed release responses cancel unread bodies", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    resolveRelease("latest", async () => new Response(body, { status: 503 })),
    /503/,
  );
  assert.equal(cancelled, true);
});
