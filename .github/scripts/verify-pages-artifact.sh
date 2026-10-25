#!/usr/bin/env bash
# Validates and extracts the Pages tar, then checks all files and release provenance.
set -euo pipefail

archive=.artifact-download/pages/artifact.tar
inputs=.artifact-download/inputs
site=.artifact-download/site
mkdir -p "$site"
tar -tf "$archive" > .artifact-download/members.txt
if grep -Eq '(^/|(^|/)\.\.(/|$)|\\)' .artifact-download/members.txt; then
  echo "Invalid Pages archive path" >&2
  exit 1
fi
tar -tvf "$archive" | awk 'substr($0, 1, 1) != "-" && substr($0, 1, 1) != "d" { exit 1 }'
tar -xf "$archive" -C "$site" --no-same-owner --no-same-permissions
node tools/ci/pages-artifact.ts verify "$site" "$inputs/pages-files.json"
cmp "$site/release.json" "$inputs/dist/release.json"
node --input-type=module - "$site/release.json" "$inputs/release.lock.json" <<'JS'
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const [provenance, pin] = await Promise.all(process.argv.slice(2).map(async (path) => JSON.parse(await readFile(path, "utf8"))));
assert.deepEqual(provenance.release, pin);
console.log(`Verified Pages artifact for ${pin.tag}`);
JS
