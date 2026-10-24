# 互換境界

[English](../../spec/compatibility.md)

<a id="section-19"></a>

## 19. 互換実装の契約

廃止したM0のrepo構成ではなく、維持する境界を規定します。[照合意味論](semantics.md)が遷移系、[ランタイム](runtime.md)が現在の責務を定義します。

<a id="section-19-1"></a>

### 19.1 範囲

上流の公開class・enumの面を、明示profile・最小level照会・解放とともに維持します。互換性は資源上限付きの一括照合とは別です。ブラウザにprocessの補完を要求せず、上流verbose loggingや任意の非文字列textを扱いません。

<a id="section-19-2"></a>

### 19.2 版

ツールの版はpackage.json・lockfile・mise.toml・Rust repoのrust-toolchain.tomlを正本とします。wasm-bindgen-cliはRust Cargo.lockと揃えます。過去の計測は記録した版を保持し、現在の測定に読み替えません。ビルドはall-featuresではなく、実際に必要なWASM機能だけを有効にします。

<a id="section-19-3"></a>

### 19.3 Rustコア

`asearch-engine`は折り返すu32シフトでJSのmodulo 32を維持します。AsearchTsは有効なサロゲート対をコードポイントに復号して孤立単位を保持し、AsearchTsLibはUTF-16単位で走査します。native Rustは1文字になる大小変換を使い、ホストJSのlocaleと異なる場合があります。そのため互換経路ではJSからコンパイル済みmaskを渡します。

曖昧度<=31は準備後に確保せず固定stack状態を使います。65,535までの互換専用経路は一時状態bufferを確保する場合があります。Idealは高level接頭辞を折り返さず単調な初期値を使い、matchLevelは0..31です。コアRustはunsafeを禁止し、計数allocatorのテストと生成WASM境界は別です。

<a id="section-19-4"></a>

### 19.4 WASM転送

薄いhandleは設定・配列の形を検証してUTF-16を渡します。JSの型配列を渡すと線形メモリへの確保・コピーがあり、nativeの確保ゼロに転送は含みません。明示freeと補助finalizerがhandleを所有します。呼び出し元の生pointerや未検査のファイルcastは受け付けません。

<a id="section-19-5"></a>

### 19.5 観測可能なJS動作

構築ごとに変更可能なAsearch.MAXLENGTHを読み、元のmode・pattern値を保持し、Array.fromで分割してホストの大小文字変換でmaskを計算します。Rustへ渡すmaskキーは1コードポイントだけです。自前field順と数値enumの逆引きは参照実装と揃えます。構築後にinstanceのmask・fieldを変更してもnative照合器は変わらず、文書化した逸脱です。MAXLENGTHの既定は31で書き換え可能です。

pattern・textは原始文字列か、String.prototype.valueOfで実体を確認したStringオブジェクトに限定し、別realmも受け付けます。toStringTagの偽装だけでは受理しません。patternのStringオブジェクトはオブジェクトとして観測できます。textはUTF-16転送前に原始文字列へ変換します。数値・配列textは意図的にTypeErrorです。

曖昧度の変換順を維持します。最初にambig+1とToLengthを評価し、2^32-1超の配列長を拒否し、text型を検査してからToPropertyKey(ambig)を計算します。計算済み長さ内の正規な非負整数のproperty名だけを受理します。負・小数・NaN・null・true・"01"・" 1"はfalseで、"1"と[1]はlevel 1です。BigInt・Symbolの変換例外はそのまま伝えます。Symbolのpropertyキーはfalseとし、配列length propertyを偶然参照する動作は再現しません。65,535超の整数曖昧度はRangeErrorで、呼び出し元の型変換後に解放を再検査します。

型互換性は上流の公開Pick面とコンストラクター・enumの形に対する一方向です。上流privateメンバーのため上流class全体への名目的代入はできず、上流オブジェクトは追加した解放APIを満たしません。

<a id="section-19-5-1"></a>

### 19.5.1 初期化試行

ビルドは最適化済みWASMから期待するexport名・kindを生成し、生成glueがキャッシュする前に検証します。不一致は初期化失敗です。exportの形の検査であり、署名・配信物の真正性ではありません。glue挿入位置の変更はビルドを失敗させてレビューします。

ブラウザ状態はuninitialized→initializing→readyまたはfailedです。module評価で既定初期化を試し完了を待ちますが、失敗をcatchしてimportを使える状態に保ちます。公開ready自体は失敗時rejectのままで、即時の内部catchで未処理rejectionを防ぎます。再試行でlive bindingのreadyを置き換え、保持済みの古いpromiseは変えません。

| 呼び出し                            | 動作                                                  |
| ----------------------------------- | ----------------------------------------------------- |
| uninitialized／failedでinit(input?) | 新試行を開始しreadyを置換。                           |
| initializingでinit()                | 同じ試行promiseを返す。                               |
| initializingでinit(input)           | 試行を変えずINITIALIZATION_IN_PROGRESSでreject。      |
| ready後にinit()                     | 現在の解決済みreadyを返す。                           |
| ready後にinit(input)                | ALREADY_INITIALIZEDでrejectし、handleを無効にしない。 |

明示undefinedは入力省略と同じです。入力はWebAssembly.Module・BufferSource・URLです。初期化失敗はcauseを保持するINITIALIZATION_FAILEDです。構築にはreadyで導入済みのbindingが必要で、再試行ではinit(input)をawaitします。動的importは最初の試行後に解決し、同じmoduleの初回評価途中のinit呼び出しは保証しません。

Node ESM／CJSはローカル成果物を同期初期化します。成功時readyは解決済みで、init(input?)はそれを返すno-opです。ローカル成果物の欠落・破損はimport／requireを失敗させ、ブラウザのネットワーク再試行契約をNodeへ適用しません。

<a id="section-19-6"></a>

### 19.6 fixture

`tools/fixtures/gen.mjs`はhash付き同梱上流原本を固定seed・localeで実行し、fixtures/compat.jsonを再生成します。ソースと公開libの期待値は別です。空・空白pattern、長さ境界、孤立サロゲート、非BMP、大小文字、折り返す曖昧度levelを含めます。上流原本をformatしません。

<a id="section-19-7"></a>

### 19.7 Nodeテスト

ESM／CJS、実行時の型変換順、profile差、解放／再入、公開型、workspace外のpack配布物を検証します。独立最小費用oracleは互換fixtureを補い、片方の成功で他方を代替しません。

<a id="section-19-8"></a>

### 19.8 ブラウザテスト

PlaywrightのChromium・Firefox・WebKitでロード・失敗／再試行・Worker・厳密な境界・更新を検証します。デモは合成IMEとスマホプロファイルの画面検証を加えます。OSのIMEや実機動作の証明にはしません。

<a id="section-19-9"></a>

### 19.9 CI

Rust検査はRust repo、生成アダプター・Node／ブラウザ回帰・デモE2Eはここで検証済みRelease Assetsに対して実行します。ホスト上の実際の実行はローカル検査と別に報告します。

<a id="section-19-10"></a>

### 19.10 帰属表示

関連する配布物すべてに上流ソースのライセンス・hash、Rust／WASMの帰属情報、依存の帰属情報を保持します。新規コードには宣言したライセンスを使い、データの帰属には別要件があります。

<a id="section-19-11"></a>

### 19.11 配布

ブラウザESMはweb glue、Node ESM／CJSは入れ子のcommonjs package指定付きnodejs glueを使います。生成物はGit追跡しません。条件付きexportsはESM／CJS宣言を持ちます。ローカルでpackするアダプターはnpm公開ではありません。
