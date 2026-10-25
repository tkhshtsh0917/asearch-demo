# ブラウザ連携テスト

[English](README.md)

PlaywrightのChromium・Firefox・WebKitで公開API・初期化・pack配布物を検証するハーネスです。利用者向けデモではありません。Rust製品コードとpackランタイム成果物は依存しません。

| 配置                  | 責務                                           |
| --------------------- | ---------------------------------------------- |
| *.spec.ts             | ブラウザ照合、初期化失敗・再試行、配布物検証。 |
| fixtures/             | テスト専用HTML・module Worker。                |
| server.mjs            | loopback限定配信とtarballの一時展開。          |
| playwright.config.mts | 対象・engine・server起動。                     |

integrationルートでmise exec -- pnpm build、続いてmise exec -- pnpm test:browserを実行します。ブラウザの導入は[コントリビューション](../../../CONTRIBUTING.ja.md#開発時の検証)を参照してください。fixtureは実際のdist/web.mjsを読み、別のRust・WASM engineを実装しません。

製品UIはデモrepoルートのsrc/に置きます。障害注入・CLI fixture・loopback配信はここにテスト専用として維持します。
