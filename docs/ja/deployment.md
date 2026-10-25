# ビルド成果物と静的配信

[原文](../deployment.md) · 日本語版

mainとPRの検証でも、配信せずに実際のPages tarをアップロード・ダウンロードする。公開対象の全ファイルを転送前のSHA-256と照合し、ダウンロードしたRelease情報が記録済みのpinと一致することを確認する。変更・欠落・余分なファイル、隠しファイル、リンクがあると検証を失敗させる。自動配信と手動配信も、同じ往復検証を通過したArtifactを公開する。

## バージョン固定と記録

CIは開始時に、指定タグまたはGitHubの最新正式Releaseを一度だけ解決し、同じReleaseの`SHA256SUMS`から3 OSのbundle SHAを取得する。取得Asset自体のSHAも既存のprepare処理で検査する。検証対象をbranchや途中で変化するlatestへ切り替えない。

`release.lock.json`と生成tarballに対応するルート`pnpm-lock.yaml`は、その実行の作業コピーで更新する。依存パッケージの指定版は保持し、更新後にfrozen installと全テストを行う。自動commitやnpm公開は行わない。`release-inputs` artifactにはそのpin、lockfile、`release.json`を保存する。配信サイトの`release.json`でもRustのタグ・各OSのSHAとdemoのcommit・run IDを確認できる。

コミット済みのローカル開発用pinは、公開済みv0.3.1のReleaseです。CIは互換性のある別のReleaseを選ぶ場合があるため、実際の配信版は実行artifactとサイトの`release.json`で確認してください。コミット済みのローカル構成を再現する手順:

```sh
mise exec -- node tools/engine/select.ts v0.3.1
mise exec -- pnpm engine:build
mise exec -- pnpm install --lockfile-only --update-checksums --ignore-scripts
mise exec -- pnpm install --frozen-lockfile
```

この操作で変更したpin/lockfileをレビューしてcommitできる。欠落またはnullのSHAは捏造せずに拒否する。CIも公開Releaseがまだなければ失敗し、未検証バイナリへfallbackしない。

GitHub側のApp/Secret/Pages設定と、実Releaseからのhosted実行はローカル検証と別の有効化作業になる。

現在のUIは、ネイティブのクエリ変換表出力と位置順位のため、Rust CLI・WASMとも0.3以降が必要です。旧版や互換性のない版を手動指定した場合はテストで失敗し、現在のPagesを維持します。言語リソースのpinと生成時の情報は`release-inputs` artifactの`analysis.json`でも確認できます。コミット済みv0.3.1の構成は、CLI・WASMとも公開済みのRelease Assetsを使います。
