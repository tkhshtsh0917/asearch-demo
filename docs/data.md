# 検索対象データ

## 出典・抽出範囲

- タイトル: AutoWikiQA。
- 作成者: CL Research Group in Nagoya, Japan / AutoWikiQA contributors。
- 配布元: [cl-nagoya/auto-wiki-qa](https://huggingface.co/datasets/cl-nagoya/auto-wiki-qa)。
- 原典: [hpprc/jawiki](https://huggingface.co/datasets/hpprc/jawiki)、日本語Wikipedia。
- ライセンス: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)。抽出データにも同じライセンスを適用し、配信時に作成者・出典・変更内容・ライセンスを表示する。

revision・ファイル・抽出範囲・ハッシュは`dataset.lock.json`を正本とする。初期デモは最初のshardの先頭10,000行を使う決定的なサブセットであり、無作為抽出でも全体の代表標本でもない。全体は配布元の記載で2,377,503行。全体での規模検証と、初期デモの読み込み量は別に扱う。

検索するのは`query`だけ。`title`・`url`・`passage_id`は出典表示用に保持し、`answer`と`text`は取得対象から外す。原典の記事ごとに複数の質問があるため、`passage_id`を検索結果の一意なkeyに使わない。固定shardの物理行番号をkeyとする。将来複数shardへ広げる場合は、衝突しない決定的なkey体系へ更新する。

加工内容は、行の選択、列の抽出、JSONL形式への変換。質問文は取得時に正規化・書き換えをしない。検索用正規化はasearch側に任せる。生成した`attribution.json`にも変更内容と出典を保存する。

データは機械生成で、原典にも時点がある。検索デモのコーパスとして利用し、回答の正しさや最新性を保証する用途にはしない。

## 取得・検証

[hyparquet](https://github.com/hyparam/hyparquet)で必要な列・行だけを読み出す。HTTP Rangeを使い、正確な206応答・Content-Range・非圧縮転送・長さを検証する。Rangeを無視した全shard応答は拒否する。1要求16 MiB・合計64 MiB・1要求30秒を上限とする。データ取得は開発/ビルド時だけ行い、ページ利用者のブラウザからHugging Faceへ要求しない構成にする。

`fileSha256`は配布元が公開する原本shardのSHA-256であり、部分取得処理が全shardのハッシュを検証するものではない。固定revisionのHTTPS URLから部分取得し、抽出後のJSONLを`outputSha256`で検証する。行数・空質問・UTF-16長・安全な整数・Wikipedia出典URLも検証し、不正行を黙って除外して件数やkeyを変えない。

`public/data/`は再生成可能なためGitへ含めない。Pagesの配布物には質問文と帰属情報を含め、UIでも出典を確認できるようにする。検索索引や出典情報の生成にローカル環境の絶対パス・時刻・秘密情報を埋め込まない。

## 配信用の固定更新シナリオ

`pnpm build`は質問文の出力ハッシュを再確認し、基本索引・差分・圧縮版を生成する。変更3件には「更新例：」を付け、4件目を削除し、合成質問1件を追加する。実効件数は1万件を保つ。取得した原文JSONLは変更しない。差分適用後のcanonical bytesが圧縮版と一致することも生成時に検査する。

ASIX・出典カタログ・manifestは内容ハッシュを含むファイル名で配信し、`release.json`が3世代を参照する。カタログはSHA-256、ASIXはmanifestのSHA-384と形式情報で検証する。これは同じ配信元からの破損検知であり、配信元自体に対する署名認証ではない。利用側はHTTPSと配信元の管理を必要とする。

配布されるカタログと索引もCC BY-SA 4.0で提供する。`release.json`と画面で作者・元データ・固定revision・変更内容を表示する。`public/site/`だけがViteの公開入力になり、未加工のビルド入力や開発用ファイルは配信しない。再配布するWASMのライセンス・NOTICE・第三者表示は`licenses/`へ同梱する。
