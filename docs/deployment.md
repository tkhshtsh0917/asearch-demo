# Build artifacts and static hosting

[日本語](ja/deployment.md)

Main-branch and PR validation also upload the actual Pages tar and download it again without deploying. Every published file is checked against its pre-upload SHA-256, and the downloaded release metadata must match the recorded Release pin. Changed, missing, extra, hidden or linked files fail validation. Automatic and manual deployments use this same round-trip gate before publishing the validated artifact.

## Pins and provenance

At startup, CI resolves the selected tag or latest stable Release exactly once and reads all three OS bundle checksums from that Release's `SHA256SUMS`. Preparation verifies the downloaded bundle too. It does not switch to a branch or a moving latest target during validation.

The run updates `release.lock.json` and the generated adapter's root `pnpm-lock.yaml` in its working copy. Dependency versions are retained; frozen installation and all tests follow. No automatic commit or npm publication occurs. The `release-inputs` artifact records pins, lockfile and `release.json`. The deployed `release.json` also identifies the Rust tag/OS checksums and demo commit/run ID.

The committed local-development pin is the published v0.3.1 Release. CI may select a different compatible Release; inspect run artifacts and the deployed `release.json` for the actual deployment version. To reproduce the committed local setup:

```sh
mise exec -- node tools/engine/select.ts v0.3.1
mise exec -- pnpm engine:build
mise exec -- pnpm install --lockfile-only --update-checksums --ignore-scripts
mise exec -- pnpm install --frozen-lockfile
```

Review and commit intentional pin/lockfile changes. Missing or null checksums are rejected rather than invented. CI fails if no suitable published Release exists; it does not fall back to unverified binaries.

The current UI requires Rust CLI and WASM 0.3+ for native query-rule export and positional ranking. Older or incompatible manual selections fail tests and preserve current Pages. Language-resource pins and generated provenance also appear in `analysis.json` in the `release-inputs` artifact. The committed v0.3.1 setup uses published Release Assets for both the CLI and WASM.
