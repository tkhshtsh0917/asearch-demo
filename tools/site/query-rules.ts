/** Serializes validated query data within the Worker's UTF-8 transfer limit. */
import { MAX_QUERY_RULE_BYTES, queryRules } from "../../src/shared/query.ts";

export function encodeQueryRules(value: unknown): Uint8Array<ArrayBuffer> {
  const bytes = new TextEncoder().encode(JSON.stringify(queryRules(value)));
  if (bytes.length > MAX_QUERY_RULE_BYTES)
    throw new Error("Query rules exceed publication byte limit");
  return bytes;
}
