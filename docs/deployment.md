# Releases and Pages deployment

[日本語](ja/deployment.md)

After a successful Rust Release publication, `asearch`'s `notify-demo` starts this repository's `release-update.yml`. It verifies that tag's Assets and deploys to GitHub Pages only after all library/UI regressions succeed. Ordinary push/PR runs validate the latest stable Release without overwriting a manually selected deployment.

## Initial configuration

1. Merge both repositories' workflows to main, and set this repository's Settings → Pages → Source to GitHub Actions.
2. Create a GitHub App with no webhook. Repository permissions: Actions: Read and write, Metadata: Read-only. Install it on this repository only.
3. In `asearch` → Settings → Secrets and variables → Actions, set variable `ASEARCH_DEMO_APP_CLIENT_ID` to the App Client ID and secret `ASEARCH_DEMO_APP_PRIVATE_KEY` to its generated private key. Never commit the private key.
4. Update the Rust version and push its matching tag. The sequence is Rust CI → all-platform Assets → Release publication → demo Action.

A repository's GITHUB_TOKEN cannot start another repository's workflow, so the App grants only demo Actions access. Pages uses the demo's own GITHUB_TOKEN; validation jobs receive no Pages write permission. Rust Release creation follows Rust CI. If notification fails, rerun only Rust's notify-demo job.

## Manually deploy a version

Open Actions → **Deploy a selected Rust version** → Run workflow. Select Branch `main` and a published Rust Release tag such as `v0.3.0`. Older releases and prereleases can be selected, subject to compatibility checks. Runs from other branches do not deploy. Drafts, unpublished tags, missing Assets/checksums or failed compatibility tests stop deployment and preserve current Pages.

Manual and automatic runs use the same `validate.yml`. Automatic deployment accepts only GitHub's latest stable Release and rechecks the target immediately before deployment. Prereleases and delayed notifications for old versions are skipped. Manual runs bypass the latest requirement and can roll back; the next stable Release resumes automatic updating.

Deployment operations share one concurrency group and do not cancel an active deployment for a newer request. GitHub does not guarantee waiting order. The latest check excludes stale automatic notifications; wait for one manual deployment to finish before requesting another.

## Pins and provenance

At startup, CI resolves the selected tag or latest stable Release exactly once and reads all three OS bundle checksums from that Release's `SHA256SUMS`. Preparation verifies the downloaded bundle too. It does not switch to a branch or a moving latest target during validation.

The run updates `release.lock.json` and the generated adapter's root `pnpm-lock.yaml` in its working copy. Dependency versions are retained; frozen installation and all tests follow. No automatic commit or npm publication occurs. The `release-inputs` artifact records pins, lockfile and `release.json`. The deployed `release.json` also identifies the Rust tag/OS checksums and demo commit/run ID.

The committed pin is for local development. Inspect run artifacts and the deployed `release.json` for the actual deployment version. To align local development after publishing the selected release:

```sh
mise exec -- node tools/engine/select.ts v0.3.0
mise exec -- pnpm engine:build
mise exec -- pnpm install --lockfile-only --update-checksums --ignore-scripts
mise exec -- pnpm install --frozen-lockfile
```

Review and commit intentional pin/lockfile changes. Missing or null checksums are rejected rather than invented. CI fails if no suitable published Release exists; it does not fall back to unverified binaries.

GitHub App/Secret/Pages settings and hosted execution against an actual Release are activation steps separate from local validation.

The current UI requires Rust CLI and WASM 0.3+ for native query-rule export and positional ranking. Older or incompatible manual selections fail tests and preserve current Pages. Language-resource pins and generated provenance also appear in `analysis.json` in the `release-inputs` artifact. Until 0.3 is published, these new features can only be verified locally with explicitly supplied development artifacts.
