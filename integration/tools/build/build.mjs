import { spawnSync } from "node:child_process";
import { copyFile, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { guardBindings } from "./guard-bindings.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
// All tools and filesystem operations must use this repository, not the caller's cwd.
process.chdir(root);
const source = resolve(root, ".engine/release");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed`);
}

const dist = "packages/asearch-wasm/dist";
// Never ship files left behind by a previous build.
await rm(dist, { recursive: true, force: true });

for (const directory of ["web", "node"]) {
  const target = directory === "node" ? "nodejs" : "web";
  const crate = resolve(source, "asearch_wasm.wasm");
  run("wasm-bindgen", [
    "--out-name",
    "asearch_wasm",
    "--target",
    target,
    "--out-dir",
    `${dist}/${directory}`,
    crate,
  ]);
  run("pnpm", [
    "exec",
    "wasm-opt",
    "-O3",
    "--enable-bulk-memory",
    "--enable-nontrapping-float-to-int",
    "--enable-sign-ext",
    "--enable-mutable-globals",
    "--enable-reference-types",
    "--enable-multivalue",
    "-o",
    `${dist}/${directory}/asearch_wasm_bg.wasm`,
    `${dist}/${directory}/asearch_wasm_bg.wasm`,
  ]);
  await guardBindings(`${dist}/${directory}`, target);
}
await writeFile(`${dist}/node/package.json`, '{"type":"commonjs"}\n');
for (const [entry, format, name] of [
  ["web", "esm", "web.mjs"],
  ["node", "esm", "node.mjs"],
  ["node", "cjs", "node.cjs"],
]) {
  await build({
    absWorkingDir: root,
    entryPoints: [`packages/asearch-wasm/src/${entry}.ts`],
    outfile: `${dist}/${name}`,
    bundle: true,
    format,
    platform: entry === "node" ? "node" : "browser",
    target: "es2022",
    plugins: [
      {
        name: "bindings",
        setup(plugin) {
          plugin.onResolve(
            { filter: /dist\/(web|node)\/asearch_wasm\.js$/ },
            ({ path }) => ({
              path: path.replace("../dist/", "./"),
              external: true,
            }),
          );
        },
      },
    ],
  });
}
run("pnpm", ["exec", "tsc", "-p", "packages/asearch-wasm/tsconfig.json"]);
await copyFile(`${dist}/index.d.ts`, `${dist}/index.d.cts`);
for (const name of ["LICENSE-MIT", "LICENSE-APACHE", "NOTICE"])
  await cp(resolve(source, name), `packages/asearch-wasm/${name}`);
await mkdir(`${dist}/licenses`, { recursive: true });
await cp("vendor/upstream/licenses", `${dist}/licenses`, { recursive: true });
await copyFile(
  "vendor/unicode/LICENSE.txt",
  `${dist}/licenses/Unicode-3.0.txt`,
);
await copyFile(
  resolve(source, "licenses/xxhash-rust.txt"),
  `${dist}/licenses/xxhash-rust.txt`,
);

await cp(
  resolve(source, "licenses/rust-dependencies"),
  `${dist}/licenses/rust-dependencies`,
  { recursive: true },
);

await build({
  entryPoints: ["tests/fixtures/index-builders.ts"],
  outfile: "tests/fixtures/builders.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["./server.mjs"],
});

await build({
  entryPoints: ["tests/fixtures/index-builders.ts"],
  outfile: "tests/fixtures/browser-builders.mjs",
  bundle: true,
  platform: "browser",
  format: "esm",
  plugins: [
    {
      name: "fixture-transport",
      setup(plugin) {
        plugin.onResolve({ filter: /^\.\/server\.mjs$/ }, () => ({
          path: "./browser-transport.mjs",
          external: true,
        }));
      },
    },
  ],
});
