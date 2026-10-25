# セキュリティとランタイムの保守

[English](../security.md)

開発・ビルドにはmiseで固定したNode 24.22.1を使います。SDK互換テストではNode 22.23.4も使用します。対応するNode 22／24はそれぞれこの修正版以上が必要で、古い版や未対応の系列はネットワークツールの事前検査で拒否します。その後のセキュリティリリースに合わせ、pinの更新と再検証を行ってください。

## Brotliデコーダへの対応

[CVE-2026-111497](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)はNode同梱のBrotliデコーダに影響します。対策はnpmのBrotliパッケージではなくNodeランタイムの更新です。このプロジェクトのCargo／npm lockfileには独立したBrotliパッケージはありません。NodeのfetchはJavaScriptでのバイト上限やダイジェスト検証より前にHTTPレスポンスを展開する場合があるため、それらの検査はランタイムの修正の代わりにはなりません。バックポート後も古い表示が残ることがあるprocess.versions.brotliではなく、Nodeのリリース版を確認してください。

```sh
mise install
mise exec -- node --version
mise exec -- pnpm security:check
```

## 継続的な検査

開発ツールを含め、ルートとintegration両方のlockfileを依存監査の対象にします。検証とPages配信は監査成功を前提とし、週次・手動のworkflowでも新たなadvisoryを確認します。registryのエラーは検査失敗とし、advisoryを暗黙に無視しません。Dependabotはレビュー用にnpm・GitHub Actionsの更新を提案します。Rustとfuzzの依存監査はRust repoが担当します。

通常の単体テストはオフラインを維持します。ランタイム下限のテストでは、修正版の境界とネットワークモジュール実行前の拒否を検証します。監査は既知のadvisoryの確認であり、ソース全体の監査や、PC・ブラウザ・hosted Actions・CDNの更新完了の証明ではありません。静的サイトにNodeサーバーは含めませんが、取得・ビルド用ツールにはランタイムの修正が必要です。既存ベンチマークの元のランタイム来歴を保持し、新しい測定として扱い直しません。

## 信頼境界と報告

Release・リソースの厳密なpin、ダイジェスト検査、転送上限、安全なテキスト描画、Actionsの最小権限を維持してください。GitHub Appの鍵はSecretsに保存し、ソースや公開成果物へ含めないでください。hosted workflowの有効化・Pages確認はローカルテストとは別に行います。

有効になっている場合はGitHubの非公開脆弱性報告を使ってください。利用できない場合は、詳細を公開せず非公開の連絡手段を依頼してください。認証情報や機微な再現資料を公開issueへ記載しないでください。
