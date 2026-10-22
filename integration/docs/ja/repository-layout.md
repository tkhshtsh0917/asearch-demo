# リポジトリ構成と依存方向

[原文](../repository-layout.md) · 日本語版

Rust本体、TS API、ブラウザ検証、デモ画面、生成物の配置と依存方向を説明します。

`asearch`はRustコア・CLI・WASM境界・Rustテスト・fuzzを管理します。タグCIはRustの品質検証後にOS別のWASM/CLI/ライセンスbundleとSHA256SUMSをRelease Assetsへ公開します。

`asearch-demo`は固定タグのAssetsを取得し、SHA-256照合、JSグルー生成、TS APIのビルド、回帰テスト、画面E2Eの順に実行し、成功したものだけPagesへ配信します。Rustソースの取得・再ビルドは行いません。

このintegration workspaceの配置は以下のとおりです。

- `packages/asearch-wasm/src`: TS APIと環境別初期化。
- `packages/asearch-wasm/test`: API・型・配布物の回帰テスト。nativeとの比較とfixture生成には取得したCLIを使用。
- `tests/browser`: WASM/Worker/ブラウザ境界の検証。
- `tests/fixtures`: CLIによるNode/ブラウザ回帰用のASIX準備。配布物には含めない。
- `tools/build`: wasm-bindgenと最適化・JS配布物の生成。
- `tools/fixtures`, `tools/reference`, `vendor/upstream`: 独立oracleと互換fixture生成。原本のライセンス・ハッシュを保持。
- `tools/bench`: ネイティブCLI・Node・ブラウザの計測。
- `fixtures`: JS回帰用の固定入力。Rust側にも独立テスト用の同一fixtureを保持する。
- `.engine/release`: 検証済みのRelease Assets。生成物としてGit追跡しない。

画面・IME・コーパス・配信資産の生成はデモrepoルートの`src`と`tools`に置きます。Rustの検索・正規化の別実装は作りません。ライセンスは配布単位ごとに保持します。npmへは公開しません。
