# 正規化・順位・曖昧度ポリシー

[English](../../spec/normalization.md)

<a id="section-8"></a>

## 8. 正規化

互換`Asearch`は正規化しません。一括索引・セッション・IntentIndexの既定は`ja-basic-v1`の下記1〜5で、6は無効です。normalizerをnoneにしprofile・mode・wrapを揃えると、一括APIのlevelは互換照合で0..Kの中で最初に一致するlevelと等しくなります。match(text,K)を1回呼ぶ結果と同じとは限りません。

サーバーの索引生成とWASMクエリは同じRustの機械的正規化を使います。ASIXに`(id,version,options)`を記録し、非互換な記述子を拒否します。noneは`(0,1,0)`、ja-basicは`(1,1,0..63)`を受け付け、未知の版と不正なoptionsを区別します。以下を個別に選択できます。

1. U+3000→U+0020。WildcardSpaceの解釈にも適用。
2. 全角ASCII U+FF01–FF5E→U+0021–007E。
3. 半角かなU+FF61–FF9F→全角。対応する直後の半角濁点・半濁点を合成。例：ｶﾞ→ガ、ﾊﾟ→パ、ｳﾞ→ヴ。
4. カタカナU+30A1–30F6から0x60を引いてひらがなへ。
5. 両側のASCII大文字→小文字。
6. 任意の長音・ダッシュ統一：ー／ｰ／－／‐／―／−／ASCII `-`→U+30FC。ASCIIハイフンも含めて幅変換との組み合わせを冪等にし、型番を維持するため既定は無効。

3の後に4を適用します。ヷは4の範囲外です。既存のU+3099/U+309Aや他の結合列に一般的なNFCを施しません。[Unicode 17.0.0の限定表](../../../vendor/unicode/README.ja.md)は全NFKCではなく、現状で汎用NFKC featureは提供しません。全64設定で全単位・かな／濁点・冪等性を検査し、孤立サロゲートを保持します。

`normalize_into`は呼び出し元が入力UTF-16長以上を予約していれば確保せず書き込みます。不足なら以前の出力を変えずNeedsCapacityを返します。予約は所有する索引・作業領域が計上します。正規化で短くなる場合もあるため編集費用は正規化後の記号で数え、原文UTF-16への説明用写像は要求された結果だけ再計算します。

<a id="section-9"></a>

## 9. 順位・重複排除・説明

既定順序は`(最小level,order,key)`です。orderの既定はkeyで、不変セグメントの配置に織り込むため、既定の抽出はソートせずlevel別に走査します。同じkeyは最良距離における最初のtextを選んで1回だけ返します。別々の結果行にしたい場合は別keyを付けます。順位だけの変更もupsertで、大量の並べ替えにはサーバーの圧縮を利用できます。

Rust 0.3以降は`ranking: "position"`として`(最小level,最も早い正規化UTF-16開始位置,order,key)`も扱います。上位件数へ絞る前に、生存するすべての一致別名を評価し、同距離ならオフセット0、1、2の順です。同距離・同開始位置の別名は入力順を維持します。記号を消費しない開始位置は最後です。デモはコーパス検索で有効にします。予算付きの行バッファとABIは[順位の契約](https://github.com/tkhshtsh0917/asearch/blob/main/docs/ja/ranking.md)を参照してください。

`explain`は別途予算を計上する経路復元行列を使い、超過はRESOURCE_LIMITです。無料ループはハイライトしません。同点は最も左の終端、最も右の始端、完全一致の対角、置換、削除、挿入、無料ループの順です。範囲は明示された座標系のUTF-16区間です。指定された原文を優先し、正規化後の索引textとの不一致はINVALID_INPUTです。指定がなければ保存された原文を使い、正規化文だけのファイルは原文位置を捏造せずnormalized-utf16を返します。IntentIndexは選択した展開を説明します。位置順位はこのハイライトの同点規則を変えません。

<a id="section-10"></a>

## 10. 曖昧度ポリシー

処理順は正規化→mode／profileに従う長さ→K→wrap→照合です。wrapはWildcardSpaceだけに空白2つを加え、Kや外部入力上限には数えません。QueryWorkspaceはactive／stagingを失敗可能な予約で確保し、前処理に失敗したら成功済みpattern・Kを保持します。索引の所有下では容量を合算します。

- 既定は`byLength({every:4,max:3,unit:"profile",includeWildcards:false})`で、`min(floor(len/4),3)`です。
- `fixed(k)`と数値のmaxAmbigは整数0..7を使い、everyは正の安全な整数です。丸めずに不正値を拒否します。K=0..3は専用化した経路、4..7は汎用経路です。互換matchには別の上限があります。
- profile長はそのprofileのtext記号で数え、code-point・utf16も明示できます。孤立サロゲートは1です。WildcardSpaceの空白は既定で除き、Exact／Includeのリテラル空白は数えます。内部wrapは常に除きます。
- 例：abc→3/0、abcd→4/1、ab cd→4/1、ＡＢＣＤ→4/1、ｶﾞｷｸｹ→がきくけ→4/1。😀😀はcode-point長で2/0、utf16で4/1です。
- JSの独自ポリシーは、正規化後・wrap前の入力とmode・profileを検索／更新ごとに1回受けます。返値は整数0..7が必須です。呼び出し元の例外はそのまま伝え、callback後に解放・再入を再検査します。callbackの確保は準備済みRust検索器の確保ゼロには含めません。

サーバー生成のクエリ変換表は、これらより前に適用する呼び出し元の別ポリシーで、ja-basic-v1やASIXを変えません。[デモの解析ガイド](../../../../docs/search-analysis.md)を参照してください。
