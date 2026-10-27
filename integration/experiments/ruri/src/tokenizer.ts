/** Loads the Rust/WASM tokenizer and applies the pinned model's special-token policy. */
import { Tokenizer } from "@mlc-ai/web-tokenizers";

export async function loadTokenizer(
  bytes: Uint8Array<ArrayBuffer>,
  config: Record<string, unknown>,
) {
  const tokenizer = await Tokenizer.fromJSON(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  if (tokenizer.encode("").length !== 0)
    throw new Error("Unexpected tokenizer special-token contract");
  const bos = config.bos_token_id,
    eos = config.eos_token_id;
  if (!Number.isInteger(bos) || !Number.isInteger(eos))
    throw new Error("Missing special-token IDs");

  return {
    encode(text: string) {
      const ids = [bos as number, ...tokenizer.encode(text), eos as number];
      return { ids, attention_mask: ids.map(() => 1) };
    },
    dispose: () => tokenizer.dispose(),
  };
}
