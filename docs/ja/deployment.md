# ビルド成果物と静的配信

[原文](../deployment.md) · 日本語版

## バージョン固定と記録

CIは開始時に、指定タグまたはGitHubの最新正式Releaseを一度だけ解決し、同じReleaseの`SHA256SUMS`から3 OSのbundle SHAを取得する。取得Asset自体のSHAも既存のprepare処理で検査する。検証対象をbranchや途中で変化するlatestへ切り替えない。

`release.lock.json`と生成tarballに対応するルート`pnpm-lock.yaml`は、その実行の作業コピーで更新する。依存パッケージの指定版は保持し、更新後にfrozen installと全テストを行う。自動commitやnpm公開は行わない。`release-inputs` artifactにはそのpin、lockfile、`release.json`を保存する。配信サイトの`release.json`でもRustのタグ・各OSのSHAとdemoのcommit・run IDを確認できる。

repoにあるpinはローカル開発用。CIの配信版は実行artifactとサイトの`release.json`で確認する。選択するReleaseの公開後、ローカルで同じ版へ揃える手順:

```sh
mise exec -- node tools/engine/select.ts v0.3.0
mise exec -- pnpm engine:build
mise exec -- pnpm install --lockfile-only --update-checksums --ignore-scripts
mise exec -- pnpm install --frozen-lockfile
```

この操作で変更したpin/lockfileをレビューしてcommitできる。欠落またはnullのSHAは捏造せずに拒否する。CIも公開Releaseがまだなければ失敗し、未検証バイナリへfallbackしない。

GitHub側のApp/Secret/Pages設定と、実Releaseからのhosted実行はローカル検証と別の有効化作業になる。

現在のUIは、ネイティブのクエリ変換表出力と位置順位のため、Rust CLI・WASMとも0.3以降が必要です。旧版や互換性のない版を手動指定した場合はテストで失敗し、現在のPagesを維持します。言語リソースのpinと生成時の情報は`release-inputs` artifactの`analysis.json`でも確認できます。0.3の公開前は、開発用成果物を明示的に指定したローカル環境だけでこれらの新機能を検証できます。
