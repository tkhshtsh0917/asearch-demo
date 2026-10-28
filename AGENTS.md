# asearch-demo contributor instructions

- This repository owns the demo UI, data preparation, Pages configuration and the TS/WASM integration workspace. Rust matching, normalization, CLI and WASM sources belong to asearch. Do not duplicate the Rust engine in JS; bounded server-generated query lookup policy is allowed in the UI.
- Optional vector-store integration belongs in integration/vectide; its Rust sources belong to Vectide and are consumed through explicit Release Assets.
- Use Release Assets with an exact tag and SHA-256 in release.lock.json. CI resolves one published Release at startup, records pins/lockfiles as artifacts and validates before Pages deployment. Do not implicitly build sibling Rust checkouts or follow moving source branches.
- Follow dataset.lock.json and docs/data.md. Index questions only; retain source attribution and CC BY-SA 4.0 in assets and UI.
- TypeScript is required. Keep meaningful file/function boundaries and blank lines in code and tests. Run mise exec -- pnpm check; keep network retrieval out of ordinary unit tests.
- README.md and docs outside ja/ are English sources. README.ja.md and docs/ja are faithful translations, updated in the same change. Preserve commands, examples, constraints and dated evidence.
- Keep comments focused on responsibilities, processing and essential constraints. Put provenance in README acknowledgments and retain legal notices.
- Never commit secrets, personal absolute paths or private workstation instructions. Ignore generated data, logs, dependencies and distribution tarballs.
- Follow CONTRIBUTING.md for development checks and documentation responsibilities.
