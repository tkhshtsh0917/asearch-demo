# リポジトリ構成と依存方向

[English](../repository-layout.md)

`asearch`はRustの照合・形式・ネイティブ解析／索引生成・CLI・WASM境界・Rustテスト・fuzzを管理します。タグCIはRustの品質検査後、OS別のWASM・CLI・ライセンスbundleをSHA256SUMSとともに公開します。

`asearch-demo`は固定したAssetsを取得し、SHA-256を照合し、JSグルーとTS APIを生成して、回帰テスト・画面E2Eを通過したビルドをPagesへ配信します。通常のビルドでRustソースを取得・再ビルドしません。

- `packages/asearch-wasm/src`: TS APIと環境別初期化。
- `packages/asearch-wasm/test`: API・型・配布物の回帰。native比較とfixtureには取得済みCLIを使用。
- `tests/browser`: WASM・Worker・ブラウザ境界の検証。
- `tests/fixtures`: Node／ブラウザテスト用のCLIによるASIX準備。配布物からは除外。
- `tools/build`: wasm-bindgen・最適化・JS配布物の生成。
- `tools/fixtures`, `tools/reference`, `vendor/upstream`: 独立oracleと互換fixture。原本のライセンス・ハッシュを保持。
- `tools/bench`: ネイティブCLI・Node・ブラウザの計測。
- `experiments/ruri`: 独立した[ブラウザEmbedding試験](../../experiments/ruri/README.ja.md)。専用の固定依存・オフライン検査・明示的なモデル準備を持ち、公開デモのビルドには含めない。
- `fixtures`: JS回帰用の固定入力。Rustも独立テスト用の同じfixtureを保持。
- `.engine/release`: 検証済みでGit追跡しないRelease Assets。

デモルートの`src`と`tools`がUI・IME・コーパス・配信資産を担当します。Rustの照合や正規化を再実装しません。UIは明示的なクエリポリシーとして、サーバー生成の上限付き変換表を利用できます。ライセンスは配布単位ごとに保持し、npmには公開しません。
