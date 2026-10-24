# Vendored upstream

[日本語](README.ja.md)

upstream/ contains original upstream files serving as compatibility references. Keep them separate from product code and exclude this directory from formatters/linters.

- [Sources, versions, licenses and SHA256](upstream/README.md)
- [Unicode normalization sources, regeneration and license](unicode/README.md)
- Fixture generation, type compatibility and reference tools read these copies without refetching them.
- Keep upstream files byte-for-byte; moving them does not change SHA256SUMS.
- Build tooling copies upstream/licenses into distributions. See root [NOTICE](../NOTICE) for attribution/permissions.

From the integration root, run `(cd vendor/upstream && shasum -a 256 -c SHA256SUMS)` to verify them.
