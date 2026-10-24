import assert from "node:assert/strict";
import test from "node:test";
import { validatePair } from "./language.mjs";

test("English sources can contain Japanese examples without accepting Japanese prose", () => {
  assert.doesNotThrow(() =>
    validatePair(
      "# Search\n\n[日本語](ja.md)\n\nSearch `食べた`.\n",
      "# 検索\n\n`食べた`を検索します。\n",
      "valid",
    ),
  );
  assert.throws(
    () => validatePair("# 検索\n\n日本語の原文です。\n", "# 検索\n", "invalid"),
    /English source/,
  );
});
test("translations preserve heading structure and executable arguments", () => {
  assert.throws(
    () => validatePair("# Build\n\n## Use\n", "# ビルド\n", "heading"),
    /Heading/,
  );
  assert.throws(
    () =>
      validatePair(
        "# Build\n\n```sh\nrun --limit 10\n```\n",
        "# ビルド\n\n```sh\nrun --limit 20\n```\n",
        "command",
      ),
    /Executable/,
  );
  assert.doesNotThrow(() =>
    validatePair(
      "# Build\n\n```sh\n# Run\nrun --limit 10\n```\n",
      "# ビルド\n\n```sh\n# 実行\nrun --limit 10\n```\n",
      "comments",
    ),
  );
});
