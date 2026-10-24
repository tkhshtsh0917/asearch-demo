# 設計理由と参考資料

[English](../../spec/rationale.md)

<a id="section-16"></a>

## 16. 採用しなかった代替案

| 代替案                             | 理由                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| BNDM／ABNDMを既定にする            | 短い候補と内部wildcardの動作を重視する現行設計で、既定採用の実測優位性がない。 |
| 無条件のtext長上限filter           | Include／WildcardSpaceは任意の長文と一致でき、安全な境界だけを使う。           |
| 全UTF-32・派生EQ・絶対offsetを保存 | 表現・更新の結合を増やすため、検証済みtextから実行時構造を導出する。           |
| 独自のバイナリpatch                | base・delta・tombstone・manifestで別のpatch互換／検証層を避ける。              |
| 文字列ごとの一括JS／WASM呼び出し   | flat UTF-16やASIXで越境回数を減らす。                                          |
| 組込みdebounce・学習順位           | 呼び出し元の責務で、ライブラリは明示された入力・orderを受ける。                |
| 任意のSIMD／Myers／OSA kernel      | 未検証機能を表示せずautoで選ばない。同値性と条件付き効果が必要。               |

決定的な位置順位は明示的に対応し、学習順位とは別です。サーバー専用解析はブラウザに形態素解析器を追加しません。

<a id="section-18"></a>

## 18. 参考資料

- [同梱ソース・版・ライセンス](../../../vendor/upstream/README.md)
- [asearch.ts](https://github.com/teramotodaiki/asearch.ts)
- [node-asearch](https://github.com/shokai/node-asearch)
- [asearch-ruby](https://github.com/masui/asearch-ruby)：algorithmの由来で、コードは取り込まない。
- [実行できる独立モデル](../../../tools/reference/README.ja.md)
