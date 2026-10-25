import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePair } from "./language.mjs";

// Checks both source and Japanese documentation without depending on the cwd.
const integration = fileURLToPath(new URL("../../", import.meta.url));
const demo = process.argv[2] === "--demo";
const root = demo ? resolve(integration, "..") : integration;

async function documents(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await documents(path)));
    else {
      assert.ok(entry.name.endsWith(".md"), `Non-document in docs: ${path}`);
      paths.push(path);
    }
  }
  return paths;
}

const files = [
  ...(await documents(resolve(root, "docs"))),
  ...(demo
    ? [
        "README.md",
        "README.ja.md",
        "CONTRIBUTING.md",
        "CONTRIBUTING.ja.md",
        "AGENTS.md",
      ]
    : [
        "README.md",
        "README.ja.md",
        "AGENTS.md",
        "tools/reference/README.md",
        "tools/bench/README.md",
        "tests/browser/README.md",
        "vendor/README.md",
        "vendor/unicode/README.md",
        "packages/asearch-wasm/README.md",
      ]
  ).flatMap((path) =>
    path.endsWith("/README.md")
      ? [
          resolve(root, path),
          resolve(root, path.replace(/README\.md$/, "README.ja.md")),
        ]
      : [resolve(root, path)],
  ),
];
// Require pairs in both directions and verify language/structure/example consistency.
for (const file of files) {
  const prefix = `${resolve(root, "docs")}${sep}`;
  let counterpart;
  if (
    ["README.md", "CONTRIBUTING.md"].some(
      (name) => file === resolve(root, name),
    )
  )
    counterpart = file.replace(/\.md$/, ".ja.md");
  else if (file.startsWith(prefix)) {
    const relative = file.slice(prefix.length);
    if (relative.startsWith(`ja${sep}`)) {
      assert.ok(
        (await stat(resolve(root, "docs", relative.slice(3)))).isFile(),
        `Orphan Japanese document: ${relative}`,
      );
      continue;
    }
    counterpart = resolve(root, "docs/ja", relative);
  }
  if (!counterpart && file.endsWith(`${sep}README.md`))
    counterpart = resolve(dirname(file), "README.ja.md");
  if (!counterpart) continue;
  assert.ok((await stat(counterpart)).isFile(), `Missing translation: ${file}`);
  validatePair(
    await readFile(file, "utf8"),
    await readFile(counterpart, "utf8"),
    file,
  );
}

let links = 0;
for (const file of files) {
  const text = (await readFile(file, "utf8")).replace(
    /```[^\n]*\n[\s\S]*?```/g,
    "",
  );
  for (const [, raw] of text.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^(?:[a-z]+:|\/\/)/i.test(raw)) continue;
    const [path, fragment] = raw.split("#");
    const target = path
      ? resolve(dirname(file), decodeURIComponent(path))
      : file;
    assert.ok((await stat(target)).isFile(), `Broken link: ${file} → ${raw}`);
    if (fragment) {
      const body = await readFile(target, "utf8");
      const id = decodeURIComponent(fragment);
      const slugs = [...body.matchAll(/^#{1,6}\s+(.+)$/gm)].map(([, title]) =>
        title
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, "")
          .replace(/ /g, "-"),
      );
      assert.ok(
        body.includes(`id="${id}"`) || slugs.includes(id),
        `Broken fragment: ${file} → ${raw}`,
      );
    }
    links++;
  }
}
console.log(`${files.length} documents, ${links} local links checked`);
