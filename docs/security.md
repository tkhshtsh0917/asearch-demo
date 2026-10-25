# Security and runtime maintenance

[日本語](ja/security.md)

Use mise's pinned Node 24.22.1 for development and builds. SDK compatibility tests also use Node 22.23.4. Supported Node 22/24 releases must be at least those patch levels; older and unsupported lines are rejected by the network-tool preflight. Update pins and revalidate when subsequent security releases appear.

Build-tool Node type declarations stay on the supported Node 24 major. Declarations for a newer runtime can permit APIs that the actual build runtime lacks, even if current tests pass. Dependabot keeps proposing compatible updates; its Node-type major limit must be reviewed together with a future build-runtime upgrade.

## Brotli decoder remediation

[CVE-2026-111497](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) affects Node's bundled Brotli decoder. The fix is a Node runtime update, not an npm Brotli package update. The project's Cargo/npm locks contain no separate Brotli package. Node fetch can decode compressed HTTP responses before JavaScript byte limits or digest verification, so those checks do not replace a patched runtime. Check the Node release version rather than relying on process.versions.brotli, which can retain an older label after a backport.

```sh
mise install
mise exec -- node --version
mise exec -- pnpm security:check
```

## Continuous checks

Dependency auditing covers both root and integration lockfiles, including development tools. Validation and Pages delivery depend on a successful audit; a weekly/manual workflow also checks for new advisories. Registry errors fail the check, and advisories are not silently ignored. Dependabot proposes npm and GitHub Actions updates for review. Rust and fuzz dependency auditing belongs to the Rust repository.

Ordinary unit tests remain offline. Runtime-floor tests verify patch boundaries and rejection before network modules run. Audits describe known advisories, not a complete source audit or proof that the workstation, browser, hosted Actions or CDN is patched. The static site includes no Node server, but download/build tools still need the runtime fix. Existing benchmark results retain their original runtime provenance and are not relabeled as new measurements.

## Trust and reporting

Retain exact Release/resource pins, digest checks, bounded transfers, safe text rendering and minimum Actions permissions. Keep GitHub App keys in Secrets, never source or public artifacts. Hosted workflow activation and Pages verification are separate from local tests.

Use GitHub private vulnerability reporting when enabled. If unavailable, request a private contact channel without vulnerability details. Do not disclose credentials or sensitive reproductions in public issues.
