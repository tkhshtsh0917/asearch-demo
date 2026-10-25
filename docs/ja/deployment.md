# ビルド成果物と静的配信

[English](../deployment.md)

[README](../../README.ja.md#セットアップ)の手順で、検証済みのRust Release Assets・言語リソース・コーパスを準備します。`pnpm build`は公開データとViteの静的サイトを`dist/`へ生成します。

## 静的な出力

ビルド時に`BASE_PATH`をサイトのURLの接頭辞に設定し、その接頭辞で`dist/`を配信します。READMEでは`/asearch-demo/`を使います。HTML・コード・Worker・内容ハッシュ付きのデータを同じビルドで揃えるため、生成ディレクトリ全体を配信してください。開発用cache・生の入力・Rustソースはサイトの入力ではありません。

ブラウザは生成したJS/WASM・ASIXセグメント・manifest・catalog・クエリ変換表を読み込みます。帰属表示と再配布する依存のnoticeは`licenses/`にあります。出典のライセンスと固定した更新例は[データと帰属表示](data.md)を参照してください。

## Releaseの識別

コミット済み`release.lock.json`はローカル環境の既定です。ビルドでは`tools/engine/select.ts`で互換性のある別の公開Releaseを明示的に選択でき、そのReleaseの`SHA256SUMS`から正確なタグと3 OSのbundleのSHA-256を記録します。準備時に取得したbundleを検証してからアダプターを生成します。チェックサムがない場合や成果物に互換性がない場合は、未検証のバイナリへfallbackせず失敗します。

生成したアダプターはルートpackageのチェックサムを変えます。意図的な更新後はREADMEの手順でルートlockfileを再生成し、frozen installと[Contributor向けの検証](../../CONTRIBUTING.ja.md)を行ってください。Releaseの選択はRust repoを編集せず、隣接checkoutを暗黙にビルドしません。

## 公開されたメタデータ

通常の`pnpm build`には、`data/release.json`と`data/analysis.json`が含まれます。前者はbase／delta／圧縮版のデータ段階と共通のクエリ変換表、後者は言語リソースのsnapshotとフィルタ方針を記録します。

ルートの`release.json`は別の来歴記録です。CIがビルド検証後に`tools/engine/provenance.ts`を実行して追加するもので、`pnpm build`の出力には含まれません。準備済みのローカルビルドにも同じ記録を追加する場合は、ビルド完了後に次のコマンドを実行します。

```sh
mise exec -- node tools/engine/provenance.ts
```

記録は、選択したRustタグと3 OSすべてのbundleのチェックサムを`release.lock.json`からコピーします。`demoCommit`と`runId`は`GITHUB_SHA`と`GITHUB_RUN_ID`から取得し、それらのCIの値がない場合は両方とも`null`です。このコマンドはビルド入力を記録するもので、配信成果物がその入力を使ったことの独立した証明ではありません。READMEの手順で検証済みAssetsを準備し、Viteは`dist/`を消去するため、再ビルド後はこのコマンドも再実行してください。サイトを再現するときは配信されたメタデータと検証済み成果物を確認し、コミットされたローカルのpinだけで配信版を判断しないでください。

検証ではpinとlockfileを記録し、実際に転送したサイト成果物を、取得済みのファイルハッシュとRelease情報に照合します。ソースのテスト・ビルドの検査・配信された情報は、それぞれ異なる問いに答えます。[セキュリティガイド](security.md)が信頼境界、[コントリビューション](../../CONTRIBUTING.ja.md)が再現できる検証コマンドを説明します。
