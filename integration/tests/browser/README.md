# Browser integration tests

[日本語](README.ja.md)

This harness verifies the public API, initialization and packed distribution in Playwright Chromium/Firefox/WebKit. It is not the user-facing demo. Rust product code and packed runtime artifacts do not depend on it.

| Location              | Responsibility                                                           |
| --------------------- | ------------------------------------------------------------------------ |
| *.spec.ts             | Browser matching, initialization failures/retry and distribution checks. |
| fixtures/             | Test-only HTML and module Workers.                                       |
| server.mjs            | Loopback-only serving and temporary tarball extraction.                  |
| playwright.config.mts | Test targets, engines and server startup.                                |

From the integration root, run mise exec -- pnpm build, then mise exec -- pnpm test:browser. See the [Contributing](../../../CONTRIBUTING.md#development-checks) for browser installation. Fixtures load the actual dist/web.mjs and do not implement another Rust/WASM engine.

The product UI lives in the demo repository root's src/. Fault injection, CLI fixtures and loopback serving remain test-only here.
