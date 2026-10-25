# Demo documentation

[日本語](ja/README.md)

Read the root README and current runtime contract before historical plans and decisions. Identifiers, commands and data formats are shared between languages. English files are the source; Japanese files translate them and are updated in the same change.

| Document                              | What it explains                                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [Data](data.md)                       | AutoWikiQA sources, pinned revisions, question selection, attribution and licensing.                                  |
| [Deployment](deployment.md)           | Release-to-Pages automation, GitHub App setup, manual version selection and rollback.                                 |
| [Performance](performance.md)         | Worker round-trip, DOM and startup measurement, including limitations.                                                |
| [Search analysis](search-analysis.md) | Native readings, romanizations, synonyms, query rewrites, original-text separation, resource updates/pins and limits. |

Current runtime contracts take precedence over historical design records. The [integration specifications](../integration/docs/spec/README.md) describe the library boundary.

[Security](security.md) explains runtime ownership, dependency audits and private reporting.
