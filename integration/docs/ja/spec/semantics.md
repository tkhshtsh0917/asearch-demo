# 照合意味論

[English](../../spec/semantics.md)

<a id="section-2"></a>

## 2. 参照意味論

互換性の基準は同梱したasearch.ts 1.0.3のソースと公開libです。現行の読み取り専用ランタイムと一括APIは別途[ランタイム](runtime.md)が規定します。

<a id="section-2-1"></a>

### 2.1 公開する形

上流はAsearchと数値・逆引き付きのMatchMode（Exact=0、Include=1、WildcardSpace=2）を公開します。AsearchはMAXLENGTH=31、matchMode、pattern、符号付きint32のmasksを持ちます。観測できる自前フィールドの順序はloopMask・masks・matchMode・pattern・initPattern・acceptPatternで、verbose()はprototypeメソッドです。上流の型にはprivateメンバーがあるため、privateクラス型への名目的な代入ではなく公開面で互換性を測ります。

<a id="section-2-2"></a>

### 2.2 patternのコンパイル

空白を含め31 UTF-16単位を超えるpatternを拒否します。Array.fromでコードポイントに分割します。INITは符号なしの31番ビット、acceptはINITをpattern記号数だけ右シフトした値です。Includeは開始・受理位置に無料ループを加えます。WildcardSpaceはU+0020ごとに直前位置の無料ループとし、空白を受理位置から除きます。Exactと未知の互換modeには無料ループがありません。

大小文字はpattern側だけで元記号・locale小文字・大文字へ展開します。ß→SSのような複数記号への展開はtextの1記号と一致しません。互換経路はホストJSの変換を使い、native Rustの変換はlocaleによって異なる場合があります。

<a id="section-2-3"></a>

### 2.3 記号遷移

```text
states[e] = INIT >>> e                     for e = 0..ambig
for each text symbol x:
  mk = masks[x] ?? 0
  for e = ambig .. 1:
    states[e] = (states[e] & loop) | ((states[e] & mk) >>> 1)
              | (states[e-1] >>> 1) | states[e-1]
  states[0] = ((states[0] & mk) >>> 1) | (states[0] & loop)
  for e = 1 .. ambig:
    states[e] |= states[e-1] >>> 1
return (states[ambig] & accept) !== 0
```

JSのシフト量は32で折り返します。挿入・置換には更新前の下位levelを使い、削除の閉包には更新後を使います。互換実装ではこの順序を維持します。

<a id="section-2-4"></a>

### 2.4 ソースと公開物の記号単位

TypeScriptソースはコードポイントで走査します。ES5の公開libはtextをUTF-16単位で走査し、patternはコードポイントでコンパイルします。そのため非BMPを含む同一文字列でもlevel 0で一致するとは限りません。a😀b同士は0でfalse、2でtrue、😀同士は0でfalseです。非BMPのtextが常に失敗するわけではなく、Includeのpattern aはa😀と0で一致します。tools/reference/check_lib_quirks.jsを参照してください。

<a id="section-2-5"></a>

### 2.5 互換性の観測

| ID  | 観測した動作                                       | 扱い                                                                         |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| Q1  | 公開物のtext走査はUTF-16単位                       | 既定はソースのコードポイントで、asearch.ts-libを明示して公開物の動作を維持。 |
| Q2  | 長さ検査はUTF-16と空白を数える                     | 互換APIで再現し、拡張索引は資源上限を使う。                                  |
| Q3  | 受理は非単調。a対空文字はlevel 0..3でF,T,F,F       | match()で維持し、一括APIは最初の一致levelを返す。                            |
| Q4  | シフトは32で折り返し、abc同士は31でfalse、32でtrue | 折り返すu32遷移を維持。                                                      |
| Q5  | 負・小数の曖昧度はfalse                            | 文書化した型変換を維持。                                                     |
| Q6  | 上流はprocess.envを参照しprocessがなければ失敗     | この依存を意図的に除く。                                                     |
| Q7  | 未知modeはExactとして動く                          | 互換経路だけで維持。                                                         |
| Q8  | locale依存の小文字化はホストに依存                 | WASM前に同じJS候補をコンパイル。                                             |
| Q9  | match引数なしはTypeError                           | 型を維持し、正確なメッセージは維持しない。                                   |
| Q10 | 上流で数値patternは空文字相当                      | TypeErrorで意図的に拒否。                                                    |

<a id="section-2-6"></a>

### 2.6 profile

| profile      | text／patternの記号            | 初期所属B(i,e) |
| ------------ | ------------------------------ | -------------- |
| AsearchTs    | コードポイント／コードポイント | i == e         |
| AsearchTsLib | UTF-16単位／コードポイント     | i == e         |
| Ideal        | コードポイント／コードポイント | i <= e         |

NodeAsearchは参照比較用で、選択できるランタイムengineではありません。UTF-16のpattern／text、ASCII大小文字、常時ワイルドカードの空白、K<=3を暗黙には採用しません。

<a id="section-2-7"></a>

### 2.7 Idealの費用

```text
C[i][0] = i
C[i][j] = min(C[i][j-1] + (i in LOOPS ? 0 : 1),
              C[i-1][j-1] + (EQ_i(t_j) ? 0 : 1),
              C[i-1][j] + 1)
cost(p,t) = C[m][n]
```

Include・ワイルドカードのループは無料で記号を読み飛ばし、他の挿入・削除・置換は1です。一括順位の独立した最小費用の基準とします。

<a id="section-2-8"></a>

### 2.8 特性

互換profile・整数0<=e<=31・profileに従う記号について、以下が成り立ちます。

```text
compat.match(t,e) iff cost(p,t)<=e and e<=m+n
```

cost<=m+nなので、最初の一致levelはIdeal費用と等しくなります。互換の非単調性はその最小値より上でだけ生じます。そのため一括・転置・絞り込み・DAGは単調な費用を使い、互換matchはu32の受理規則を維持します。

証明の概略：t記号後のlevel eの位置は、費用<=eの位置と[e-t,無限大)の共通部分です。初期位置はちょうどeです。下限未満の位置はi+t<eを満たし、下位levelの有料遷移から再生成されます。受理位置mでは下限条件がe<=m+nになります。

過去の検証では特性960,000三つ組で反例なし、最小level 120,000ペアで不一致なし、公開JSと20,071ペア・level 0..5で一致しました。有限の検査であり、維持するfixtureと独立oracleも引き続き必要です。
