# ReleaseとPages配信

[原文](../deployment.md) · 日本語版

RustのReleaseからPages配信までの連携、GitHub Appの設定、手動での版指定と切り戻しを説明します。

RustのRelease公開が成功すると、`asearch`の`notify-demo`がこのrepoの`release-update.yml`を起動する。対象タグのAssetsを検証し、ライブラリと画面の全回帰が成功した場合だけGitHub Pagesへ反映する。通常のpush/PRは最新の正式Releaseで検証だけを行い、手動で選んだ配信版を上書きしない。

## 初回の設定

1. 両repoのworkflowを先にmainへ反映し、このrepoのSettings → Pages → SourceをGitHub Actionsにする。
2. GitHub Appを作成する。Webhookは不要。Repository permissionsはActions: Read and write、Metadata: Read-only。このrepoだけへインストールする。
3. `asearch`側のSettings → Secrets and variables → Actionsで、AppのClient IDを変数`ASEARCH_DEMO_APP_CLIENT_ID`、生成した秘密鍵をSecret `ASEARCH_DEMO_APP_PRIVATE_KEY`へ登録する。秘密鍵をファイルとしてcommitしない。
4. Rust側のversionを更新して対応タグをpushする。Rust CI → 全OSのAssets生成 → Release公開 → demoのAction起動、の順で進む。

repo固有のGITHUB_TOKENには別repoを起動する権限がないため、AppでdemoのActions起動権限だけを付与する。Pages配信にはdemo側のGITHUB_TOKENを使い、検証jobへPages書込み権限を与えない。このリリースworkflowではRust CI通過後にReleaseを作成する。demo起動に失敗した場合はRust側のnotify-demoだけを再実行できる。

## 手動で指定版を配信する

Actions → **Deploy a selected Rust version** → Run workflowから、Branchは`main`、tagに`v0.3.0`など公開済みのRust Releaseタグを指定する。過去版やプレリリースも互換性検証を条件として指定できる。main以外の実行からは配信しない。draft、未公開タグ、不足するAssetsやSHA、互換性テストの失敗があれば配信を止め、現在のPagesを維持する。

手動と自動は同じ`validate.yml`で生成・回帰を行う。自動配信はGitHubでlatestとされる正式Releaseだけが対象で、配信直前に対象を再確認する。プレリリースや古い版の遅延通知は自動配信しない。手動操作はこのlatest条件を適用しないため、ロールバックにも使える。次の正式Releaseでは再び自動更新する。

配信操作は同じconcurrency groupで直列化し、実行中の配信を新しい要求でキャンセルしない。GitHubの待機順は保証されない。自動処理の古い通知はlatest照合で除外されるが、手動要求を複数続けて実行するときは先の完了を待つ。

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
