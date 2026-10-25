/** Validates server-produced lookup data and applies bounded query-only rewrites. */
export const MAX_QUERY_RULE_BYTES = 2 * 1024 * 1024;

export interface QueryRules {
  format: "asearch-query-rules/1";
  forms: [string, string][];
  kana: [string, string][];
}

function pairs(
  value: unknown,
  maximum: number,
  kana: boolean,
): [string, string][] {
  if (!Array.isArray(value) || value.length > maximum)
    throw new Error("Invalid query rule count");
  const seen = new Set<string>();
  return value.map((pair: unknown) => {
    if (!Array.isArray(pair) || pair.length !== 2)
      throw new Error("Invalid query rule");
    const [source, target] = pair;
    if (
      typeof source !== "string" ||
      typeof target !== "string" ||
      !source ||
      !target ||
      source.length > 128 ||
      target.length > 128 ||
      /\s/u.test(source) ||
      /\s/u.test(target) ||
      seen.has(source) ||
      (kana && (Array.from(source).length > 3 || !/^[a-z'-]+$/.test(target)))
    )
      throw new Error("Invalid query rule text");
    seen.add(source);
    return [source, target];
  });
}

export function queryRules(value: unknown): QueryRules {
  if (!value || typeof value !== "object")
    throw new Error("Invalid query rules");
  const input = value as QueryRules;
  if (input.format !== "asearch-query-rules/1")
    throw new Error("Unknown query rule format");
  const forms = pairs(input.forms, 50000, false);
  const sources = new Set(forms.map(([source]) => source));
  if (forms.some(([, target]) => sources.has(target)))
    throw new Error("Chained query rules rejected");
  return { format: input.format, forms, kana: pairs(input.kana, 8192, true) };
}

/** Uses whole whitespace-delimited terms; unknown or ambiguous inflections stay literal. */
export class QueryPolicy {
  private readonly forms: ReadonlyMap<string, string>;
  private readonly kana: ReadonlyMap<string, string>;

  constructor(value: unknown) {
    const valid = queryRules(value);
    this.forms = new Map(valid.forms);
    this.kana = new Map(valid.kana);
  }

  normalize(pattern: string): string {
    const rewritten = pattern
      .split(/(\s+)/u)
      .map((term) => this.forms.get(term) ?? term)
      .join("");
    return rewritten.length <= 128 ? rewritten : pattern;
  }

  /** Produces at most one bounded alternative, without a browser tokenizer or dictionary. */
  romanize(pattern: string): string | undefined {
    if (pattern.length > 128) return undefined;
    if (!/[\u3041-\u3096\u30a1-\u30faー]/u.test(pattern)) return undefined;
    const chars = Array.from(pattern);
    let output = "";
    for (let i = 0; i < chars.length; ) {
      let length = Math.min(3, chars.length - i),
        replacement: string | undefined;
      for (; length > 0; length--) {
        replacement = this.kana.get(chars.slice(i, i + length).join(""));
        if (replacement !== undefined) break;
      }
      output += replacement ?? chars[i];
      i += replacement === undefined ? 1 : length;
      if (output.length > 128) return undefined;
    }
    return output !== pattern ? output : undefined;
  }
}
