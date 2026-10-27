# encoder再配布notice

[English](README.md)

ここにはupstream ONNX Runtime 1.31.1のlicenseとthird-party notice一覧、tokenizers-cpp 0.1.6のlicenseと確認できたnative componentのlicenseを保持します。`pins.json`は不変なsource URL・bytes・SHA-256を記録します。npm tokenizerのソースはregistryの`gitHead`で識別し、そのrepositoryはSentencePiece・msgpackをsubmoduleとして固定し、Hugging Face tokenizers 0.21.0を宣言しています。upstreamは、事前コンパイルしたnpm tokenizerの過去の解決済みRust lockfileを公開していません。これらのcomponent noticeは、推移的なbinary SBOMの完全な再現や、不明な過去の推移的versionの監査を意味しません。

Ruri modelとONNX変換は、model.lock.jsonが参照する固定model cardによればApache-2.0です。model/runtime/tokenizerのコードはRust storeの一部ではありません。consumerは任意のsite配信を構築する際、RuriのApache license、主要datasetのattribution、Vector Storeから提供されたnotice一覧全体、Viteのmodulepreload licenseも保持します。
