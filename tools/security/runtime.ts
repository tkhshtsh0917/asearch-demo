/** Rejects unsupported or unpatched Node releases before build tools retrieve data. */
export function assertPatchedNode(version: string): void {
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  const major = Number(parts?.[1]),
    minor = Number(parts?.[2]),
    patch = Number(parts?.[3]);
  const floor =
    major === 22
      ? ([23, 4] as const)
      : major === 24
        ? ([22, 1] as const)
        : undefined;
  if (
    !parts ||
    !floor ||
    minor < floor[0] ||
    (minor === floor[0] && patch < floor[1])
  )
    throw new Error(
      "Use patched Node.js 22.23.4+ or 24.22.1+ on the supported 22/24 lines (CVE-2026-111497); run mise install.",
    );
}

assertPatchedNode(process.versions.node);
