/** Checks source language and mechanical invariants shared by a translation pair. */
import assert from "node:assert/strict";

function blocks(markdown) {
  return [...markdown.matchAll(/^```([^\n]*)\n([\s\S]*?)^```/gm)];
}

export function validatePair(source, translated, label) {
  const prose = source
    .replace(/^```[^\n]*\n[\s\S]*?^```/gm, "")
    .replace(/`[^`]*`/g, "")
    .replace(/<[^>]*>/g, "");
  for (const line of prose.split("\n")) {
    if (/^\s*\[(日本語|日本語版)\]\(/.test(line)) continue;
    const japanese =
      line.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu)
        ?.length ?? 0;
    const latin = line.match(/[a-z]/gi)?.length ?? 0;
    assert.ok(
      !line.includes("。") && japanese <= latin,
      `English source contains Japanese prose: ${label}: ${line}`,
    );
  }
  const headings = (text) =>
    [...text.matchAll(/^(#{1,6}) /gm)].map((match) => match[1]);
  assert.deepEqual(
    headings(source),
    headings(translated),
    `Heading structure differs: ${label}`,
  );
  const originalBlocks = blocks(source),
    translatedBlocks = blocks(translated);
  assert.deepEqual(
    originalBlocks.map((b) => b[1]),
    translatedBlocks.map((b) => b[1]),
    `Code block languages differ: ${label}`,
  );
  for (let i = 0; i < originalBlocks.length; i++) {
    if (originalBlocks[i][1] === "text") continue;
    const code = (text) => text.replace(/^\s*(?:#|\/\/).*$/gm, "").trim();
    assert.equal(
      code(originalBlocks[i][2]),
      code(translatedBlocks[i][2]),
      `Executable example differs: ${label}, block ${i + 1}`,
    );
  }
}
