// Reproducible edit traces sampled from caller-provided corpus texts.
import { seededRandom } from "./statistics.mjs";

export function querySequences(texts, seed = 31, count = 16) {
  if (
    !Array.isArray(texts) ||
    !texts.length ||
    texts.length > 1_000_000 ||
    texts.some((text) => typeof text !== "string" || text.length > 65535) ||
    !Number.isSafeInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 32
  )
    throw new RangeError("Invalid query corpus, seed or trace count");
  const random = seededRandom(seed);
  const traces = Array.from({ length: count }, () => {
    const symbols = Array.from(
      texts[Math.floor(random() * texts.length)],
    ).slice(0, 64);
    const prefixes = [
      ...new Set(
        [1, 3, 4, 7, 8, 11, 12, 15, 31, 32, 63, 64].map((n) =>
          symbols.slice(0, n).join(""),
        ),
      ),
    ];
    const middle = symbols.slice(0, 12);
    return [
      ...prefixes,
      middle.slice(0, -1).join(""),
      [...middle.slice(0, -1), "誤"].join(""),
      middle.join(""),
      "",
    ];
  });
  return [
    ...traces,
    ["ｶ", "ｶﾞ", "ｶﾞｸ", "ｶﾞ", "か", ""],
    ["😀", "😀a", "😀ab", "😀a", "😀", ""],
    ["a", "a ", "a b", "a  b", "a b c", "ab", ""],
    ["I", "İ", "Σ", "ß", "ＡＢＣ", "abc", ""],
  ];
}
