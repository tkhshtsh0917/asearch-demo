/** Defines the pinned native-document/browser-query compatibility profile. */
import model from "../model.lock.json" with { type: "json" };
import runtime from "../runtime.lock.json" with { type: "json" };
export const profileDescription = {
  schema: 1,
  model,
  runtime,
  semantics: {
    tokenizer: "mlc-web-tokenizers-0.1.6-raw-encode-config-bos-eos-v1",
    query:
      "single-thread-ort-q8-f32-hidden-mask-mean-f64-sum-f32-round-f64-l2-f32-v1",
    document:
      "sentence-transformers-6.2.0-torch-2.14.1-cpu-f32-eager-native-mean-normalized-v1",
    roles:
      "exact-prefix-plus-original-text-including-prefix-and-special-tokens",
    overflow: "reject-prefixed-token-count-above-256-no-truncation",
    store: "cosine-f32-normalized-f64-dimension-order-v1",
  },
};
