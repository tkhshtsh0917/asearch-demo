# ja-basic-v1のUnicodeデータ

[English](README.md)

かな生成表はUnicode 17.0.0の[UnicodeData.txt](https://www.unicode.org/Public/17.0.0/ucd/UnicodeData.txt)を使い、SHA-256は`2e1efc1dcb59c575eedf5ccae60f95229f706ee6d031835247d843c11d96470c`です。

U+FF61–FF9Fの狭い分解とU+3099・U+309Aによるかなの正規合成だけを抽出します。UCD全体を同梱せず、ビルド時にも取得しません。実行時正規化はPython・ブラウザICU・一般NFKCライブラリに依存しません。

同一ファイルを独立に取得してから再生成します。

```sh
python3 tools/unicode/generate.py UnicodeData.txt > tables.rs
```

integrationディレクトリで実行します。生成器は原本hashを検証し、rustfmtで標準出力を整形するため、先にRust repo指定版を導入してください。tables.rsをレビューし、Rust repoのasearch-index正規化moduleへ明示的にコピーします。[Unicode License V3](LICENSE.txt)は[公式ライセンス](https://www.unicode.org/license.txt)の原文を保持し、SHA-256は`e7a93b009565cfce55919a381437ac4db883e9da2126fa28b91d12732bc53d96`です。Rust crateと生成WASM packageにも同梱します。このライセンスはデータ由来の表に適用し、新規実装コードはプロジェクトのライセンスを維持します。
