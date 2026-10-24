# ビルド成果物と静的配信

[原文](../deployment.md) · 日本語版

## バージョン固定と記録

CIは開始時に、指定タグまたはGitHubの最新正式Releaseを一度だけ解決し、同じReleaseの`SHA256SUMS`から3 OSのbundle SHAを取得する。取得Asset自体のSHAも既存のprepare処理で検査する。検証対象をbranchや途中で変化するlatestへ切り替えない。

`release.lock.json`と生成tarballに対応するルート`pnpm-lock.yaml`は、その実行の作業コピーで更新する。依存パッケージの指定版は保持し、更新後にfrozen installと全テストを行う。自動commitやnpm公開は行わない。`release-inputs` artifactにはそのpin、lockfile、`release.json`を保存する。配信サイトの`release.json`でもRustのタグ・各OSのSHAとdemoのcommit・run IDを確認できる。

repoにあるpinはローカル開発用。CIの配信版は実行artifactとサイトの`release.json`で確認する。ローカルで同じ版へ揃える手順:

```sh
mise exec -- node tools/engine/select.ts v0.1.0
mise exec -- pnpm engine:build
mise exec -- pnpm install --lockfile-only --update-checksums --ignore-scripts
mise exec -- pnpm install --frozen-lockfile
```

この操作で変更したpin/lockfileをレビューしてcommitできる。初期pinのnullは未公開AssetのSHAを捏造しないための値で、既存のprepare処理は引き続き拒否する。CIも公開Releaseがまだなければ失敗し、未検証バイナリへfallbackしない。

GitHub側のApp/Secret/Pages設定と、実Releaseからのhosted実行はローカル検証と別の有効化作業になる。

現在の画面の読み・同義語生成には、解析CLIを持つRust v0.2.0以降が必要です。手動指定でもこの互換条件を検証し、旧版などで失敗した場合は現在のPagesを維持します。リソースのpinと生成結果は`release-inputs` artifactの`analysis.json`でも確認できます。
