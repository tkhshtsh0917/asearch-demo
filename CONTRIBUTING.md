# Contributing

[日本語](CONTRIBUTING.ja.md)

## Scope and setup

This repository owns the demo UI, data preparation, TS/JS adapter, browser tests, reference models and measurement tools. Rust algorithms and the CLI/WASM source belong to [asearch](https://github.com/tkhshtsh0917/asearch). Follow the [README setup](README.md#setup) before running checks; use verified Release Assets rather than implicitly building a sibling checkout.

## Development checks

Run these commands from the repository root after setup:

```sh
mise exec -- pnpm exec playwright install --with-deps chromium firefox webkit
mise exec -- pnpm check
mise exec -- pnpm --dir integration typecheck
mise exec -- pnpm --dir integration lint
mise exec -- pnpm --dir integration test
mise exec -- pnpm --dir integration test:bench
mise exec -- pnpm --dir integration fixtures:check
mise exec -- pnpm --dir integration docs:check
mise exec -- pnpm --dir integration test:browser
mise exec -- pnpm test:dev
mise exec -- pnpm test:e2e
```

Install Playwright's browsers before browser tests. Run the browser commands serially because they share output directories. `pnpm analysis:test` additionally exercises the prepared real dictionary; ordinary unit tests stay offline. See [integration layout](integration/docs/repository-layout.md) for test/tool ownership.

## Change guidelines

Use TypeScript for application code. Separate files and functions by responsibility, use blank lines between meaningful stages, and keep comments focused on behavior and essential constraints. Keep changes focused and preserve license notices. Exclude generated data, distributions, secrets and workstation-specific paths from commits.

Preserve Worker request/epoch handling, original-text rendering, mixed IME input, positional ranking, article filtering and atomic update/restore behavior. Add regressions for fixes, including delayed responses and failure recovery where relevant. Browser profiles and synthetic IME events provide emulator-level coverage, not physical-device verification.

Keep Release, dataset and language-resource pins explicit. If a change intentionally regenerates the adapter, verify its source assets and update the root lockfile before frozen installation. [Build artifacts](docs/deployment.md) explains the generated files and provenance; [data](docs/data.md) and [analysis](docs/search-analysis.md) define input and redistribution constraints.

## Documentation and measurements

README and specifications describe use and supported behavior. Contributor, test and tool guides describe development. Update English sources and faithful Japanese translations together, including executable examples and diagrams. Keep each contract authoritative in one location and link to it rather than copying parameters into several guides.

Use [independent reference models](integration/tools/reference/README.md) for algorithmic comparisons. For performance work, prepare artifacts before timing, check equivalent outputs, record inputs/artifact/source identities and inspect regressions in separate paired confirmation runs. See [API measurements](integration/docs/performance.md) and [UI measurements](docs/performance.md). Shared CI checks correctness without noisy speed thresholds.

## Reporting issues

Include the Rust Release tag, demo revision, browser/runtime, minimal input and reproduction steps. Use the [security policy](SECURITY.md) for suspected vulnerabilities; do not post credentials or sensitive reproductions publicly.
