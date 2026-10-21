import { isReleaseTag, releasePin } from "./release.ts";

export const RELEASE_REPOSITORY = "https://github.com/tkhshtsh0917/asearch";
const platforms = ["linux-x86_64", "macos-aarch64", "windows-x86_64"];

/** Resolves the complete bundle checksum set from a published release. */
export function checksumPin(tag: string, text: string) {
  const assets: Record<string, string> = {};
  for (const line of text.trim().split("\n")) {
    const match = /^([a-f0-9]{64}) [ *](\S+)$/.exec(line);
    if (!match) throw new Error("Invalid release checksum line");
    for (const platform of platforms) {
      if (match[2] !== `asearch-assets-${platform}.tar.gz`) continue;
      if (assets[platform]) throw new Error("Duplicate bundle checksum");
      assets[platform] = match[1] as string;
    }
  }
  const pin = { repository: RELEASE_REPOSITORY, tag, assets };
  for (const platform of platforms) releasePin(pin, platform);
  return pin;
}

async function boundedText(response: Response) {
  if (!response.ok || !response.body) {
    void response.body?.cancel().catch(() => {});
    throw new Error(`Release request failed (${response.status})`);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 1024 * 1024)
        throw new Error("Release metadata exceeds limit");
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Freezes latest or an explicit tag to verified per-platform bundle hashes. */
export async function resolveRelease(selector: string, request = fetch) {
  if (selector !== "latest" && !isReleaseTag(selector))
    throw new Error("Invalid release tag");
  const path =
    selector === "latest" ? "latest" : `tags/${encodeURIComponent(selector)}`;
  const metadata = JSON.parse(
    await boundedText(
      await request(
        `https://api.github.com/repos/tkhshtsh0917/asearch/releases/${path}`,
        {
          signal: AbortSignal.timeout(120000),
          headers: { Accept: "application/vnd.github+json" },
        },
      ),
    ),
  ) as { tag_name?: unknown; draft?: unknown; prerelease?: unknown };
  if (
    metadata.draft !== false ||
    typeof metadata.tag_name !== "string" ||
    (selector === "latest"
      ? metadata.prerelease !== false || metadata.tag_name.includes("-")
      : metadata.tag_name !== selector)
  )
    throw new Error("Release identity mismatch or unpublished release");
  if (!isReleaseTag(metadata.tag_name)) throw new Error("Invalid release tag");
  return checksumPin(
    metadata.tag_name,
    await boundedText(
      await request(
        `${RELEASE_REPOSITORY}/releases/download/${encodeURIComponent(metadata.tag_name)}/SHA256SUMS`,
        { signal: AbortSignal.timeout(120000) },
      ),
    ),
  );
}
