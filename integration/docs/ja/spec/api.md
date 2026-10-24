# JS/TS APIとWASMビルド

[English](../../spec/api.md)

<a id="section-12"></a>

## 12. ランタイムAPI

将来案の一覧ではなく現在のAPIです。[パッケージREADME](../../../packages/asearch-wasm/README.ja.md)と生成するTypeScript宣言が利用例・正確な型を示します。

<a id="section-12-1"></a>

### 12.1 互換API

`Asearch(pattern,mode?,{profile?})`はMAXLENGTH=31、pattern、matchMode、masksの互換な値・列挙順を公開します。既定modeはExact、profileはasearch.tsです。原始文字列と実際のStringオブジェクトを受け付けます。`match(text,ambig=0)`は文書化した変換・上限を維持します。`matchLevel(text,maxAmbig=3)`は最初の一致levelまたは-1を返し、全profileで整数0..31が上限です。number以外のmaxAmbigはTypeError、非整数・範囲外・非有限はRangeErrorです。引数検証より先に解放状態を確認します。Idealでもpatternは31 UTF-16単位で、長い入力には別の汎用Rust ScalarWmを使います。

`free()`と`[Symbol.dispose]()`は冪等です。不正receiverはTypeError、解放後の利用はDISPOSEDです。Symbol.disposeがなければグローバルSymbolを変えずSymbol.for("Symbol.dispose")を使います。TypeScriptの解放構文にはESNext.Disposableが必要です。

<a id="section-12-2"></a>

### 12.2 境界と初期化

JSが単一記号の大小文字候補`[c,c.toLocaleLowerCase(),c.toUpperCase()]`を生成し、Rustが検証・照合します。UTF-16転送で孤立サロゲートを保持し、TextEncoderを使いません。nativeハンドルは明示解放でき、finalizerを補助に使います。WASMコピー前に入力・輸送予算を確認し、呼び出し元のhook・callback後に解放・再入を再検査します。

ブラウザESMは非同期初期化を試み、公開する`ready`または`init()`をawaitします。失敗してもimportを維持して後で再試行できます。Node ESM／CJSは同期初期化です。試行ごとのpromiseと競合する明示初期化は[互換契約](compatibility.md#section-19-5-1)が定義します。ブラウザコードはprocessやDOMのglobalを必要としません。

<a id="section-12-3"></a>

### 12.3 不変索引と結果

| API                                               | 責務                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| AsearchIndex.fromBytes / fromStream               | サーバーのASIXを検証・ロードし、任意でexpected記述子・SRIも照合。 |
| index.search / index.session                      | 共有する不変内容を単発、または独立予算の繰り返し検索で照合。      |
| session.update / reset / free                     | 入力更新、再利用checkpointの破棄、セッション解放。                |
| index.explain                                     | 所有するrefから予算付き整列を取得。                               |
| index.addSegment / replaceSegments                | 単一セグメントの追記、または完全な置換列の原子的採用。            |
| index.segments / free                             | セグメント情報の確認、またはrootと子sessionの解放。               |
| IntentIndex.fromEntries / search / explain / free | 上限付き意図DAGの構築、非展開検索、説明、解放。                   |
| diffManifest                                      | 純粋な検証・比較。取得・状態変更を行わない。                      |
| mergeResults                                      | 静的Worker分割を重複排除し、所有元ごとのrefを保持。               |

ランタイムにfromDocs・fromStrings・buildIndex・buildDelta・toBytesやクライアント編集APIはありません。これらの補助機能を持つnative CLIアダプターはテスト準備だけに存在し、pack配布物には含めません。

一括の既定はIdeal・ja-basic-v1・WildcardSpace・wrap=true・ByLength・limit=30・countTotal=false・engine=autoです。検索はmode・wrap・maxAmbig・limit・countTotal・engine・rankingを受け付けます。不変索引の対応engineはauto／transposed-blockedで、未対応optionは失敗します。sessionには全体予算内で既定32 MiBのmaxCacheBytesもあります。0はcheckpointを無効にしますが、autoは安全な絞り込みを使う場合があります。transposed-blockedは全量検索を明示します。Intentはauto／dagを受け付け、rankingは受け付けません。

結果はJS所有のids・levels・refs・orders配列、length、任意の正確な最小level別totals、stats、copy()を持ちます。位置順位は任意のstartsを加え、既定順序は維持します。totalsはlimitとは独立に生存する一意keyを数えます。limit=0は有効です。空クエリをライブラリで暗黙に抑制せず、選択した意味論で評価します。UI側で抑制することは可能です。

`mergeResults`はstructured clone対応の最大256 partを受けます。呼び出し元のプロパティを取得し終えてから、配列の実際の型・長さ・順位を検証します。位置順位は全partにstartsが必須で、モード混在は失敗します。出力型配列の上限は256 MiBで、JS heap全体ではありません。重複時の同点は入力part・順序で決め、refはparts[i]が示す所有元に属します。統合totalsは返しません。共有bufferの並行変更は呼び出し元が防ぎます。更新／tombstoneの列は1つのWorkerに保持し、v1にはWorkerをまたぐ更新プロトコルを設けません。Worker生成・通信・スケジューリング・描画は呼び出し元の責務です。

<a id="section-12-4"></a>

### 12.4 エラー・寿命・更新

一括の同期メソッドはthrow、非同期はrejectし、安定したcodeとしてINVALID_INPUT・INVALID_INDEX・UNSUPPORTED_FORMAT・UNSUPPORTED_OPTION・RESOURCE_LIMIT・INVALID_MANIFEST・CONFLICT・BUSY・DISPOSEDを返します。型不正はINVALID_INPUT付きTypeErrorです。呼び出し元のgetter・policy・stream例外はそのまま伝え、codeを保証しません。メッセージを機械判定に使わないでください。互換Asearchには別の変換規則を維持します。

key・orderは0..2^32-1の整数です。元文書は原始文字列のtextを1つ以上持ち、原文・正規化文とも各65,535 UTF-16単位以内が必須です。文書keyの重複は失敗し、text入力順は意味を持ちます。確保前に上限・記述子を検証し、root・session・輸送・準備の容量を合算します。

rootごとの非同期更新は1つだけで、2つ目はBUSYです。検索は旧active状態で継続します。失敗・中止でその状態を保持し、freeは準備を中止して遅れた採用を防ぎます。複数セグメントのmanifestは1回のreplaceSegmentsで原子的に採用します。成功時は全opaque refと関連cacheを無効にし、sessionの入力・optionを維持します。

結果配列は次の呼び出し・採用・free後も保持でき、copy()は配列・statsを独立複製します。refはroot・世代固有で、別root／Workerに流用できません。古い／別所有元のrefはINVALID_INPUTです。参照番号は暗黙に折り返さず、枯渇はRESOURCE_LIMITです。root解放で子sessionも無効になります。

<a id="section-13"></a>

## 13. WASMビルド

Rust Release CIが基本命令版WASMを生成します。デモは固定Assetsを検証し、wasm-bindgenの後にwasm-opt -O3を実行します。wasm-bindgen-cliはRust Cargo.lockと同じ版を使い、wasm-packは不要です。SIMD・Myers・OSAのランタイム成果物は採用しません。Rust release設定はopt-level=3・fat LTO・codegen unit 1・abort panic・debug情報除去です。コアRustはunsafeを禁止し、検証済みlittle-endian sliceを明示的に復号します。

Rust既定allocatorを維持します。準備済みnative照合は検索中に確保せず、境界の結果コピー・DAG構築・更新・説明は別途予算を持ちます。raw・gzip・Brotliサイズと条件付き時間計測は別指標です。Biome・rustfmt／Clippy・型・テスト・文書検査を別コマンドに保ち、変更しない上流原本を一括formatしません。
