# Build artifacts and static hosting

[日本語](ja/deployment.md)

Follow the [README](../README.md#setup) to prepare verified Rust Release Assets, language resources and the corpus. `pnpm build` generates the data publication and Vite's static site in `dist/`.

## Static output

Set `BASE_PATH` to the site's URL prefix when building, and serve `dist/` at that prefix. The README uses `/asearch-demo/`. Serve the generated directory as a whole so HTML, code, Workers and content-hashed data stay from the same build. Development caches, raw inputs and Rust sources are not site inputs.

The browser loads the generated JS/WASM, ASIX segments, manifests, catalogs and query lookup data. Attribution and redistributed dependency notices are under `licenses/`. See [data and attribution](data.md) for source licenses and the fixed update scenario.

## Release identity

The committed `release.lock.json` is the local setup's default. A build can explicitly select another compatible published Release with `tools/engine/select.ts`; selection records the exact tag and all three OS bundle SHA-256 values from that Release's `SHA256SUMS`. Preparation verifies the downloaded bundle before generating the adapter. Missing checksums or incompatible artifacts fail rather than falling back to unverified binaries.

The generated adapter changes the root package checksum. After an intentional update, regenerate the root lockfile as shown in the README, then use frozen installation and [contributor checks](../CONTRIBUTING.md). Resolving a Release does not edit the Rust repository or implicitly build a sibling checkout.

## Published metadata

An ordinary `pnpm build` includes `data/release.json` and `data/analysis.json`. The first describes the base/delta/compacted data stages and their shared query rules; the second records the language-resource snapshot and filtering policy.

Root `release.json` is a separate provenance record. CI adds it after build validation by running `tools/engine/provenance.ts`; it is not an output of `pnpm build`. To add the same record to a prepared local build, run this command after the build finishes:

```sh
mise exec -- node tools/engine/provenance.ts
```

The record copies the selected Rust tag and all three OS bundle checksums from `release.lock.json`. `demoCommit` and `runId` come from `GITHUB_SHA` and `GITHUB_RUN_ID`; without those CI values, both fields are `null`. The command records build inputs, not independent proof that a served artifact used them. Prepare verified assets as described in the README, and run it again after rebuilding because Vite clears `dist/`. Inspect the served metadata and validated artifacts when reproducing a site; a committed local pin alone does not identify a deployed build.

Validation records pins and lockfiles, then checks the actual transferred site artifact against its captured file hashes and Release metadata. Source tests, build checks and the served metadata answer different questions. The [security guide](security.md) describes the trust boundaries; [Contributing](../CONTRIBUTING.md) lists reproducible validation commands.
