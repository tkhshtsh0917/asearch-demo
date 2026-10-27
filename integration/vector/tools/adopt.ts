/** Replaces prepared build directories with rollback if any installation fails. */
import { rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
export async function adoptDirectories(
  stage: string,
  entries: { source: string; target: string }[],
) {
  const changed: {
    target: string;
    backup: string;
    previous: boolean;
    installed: boolean;
  }[] = [];
  try {
    for (const [i, entry] of entries.entries()) {
      const state = {
        target: entry.target,
        backup: resolve(stage, `backup-${i}`),
        previous: false,
        installed: false,
      };
      try {
        await rename(entry.target, state.backup);
        state.previous = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      changed.push(state);
      await rename(entry.source, entry.target);
      state.installed = true;
    }
  } catch (error) {
    for (const state of changed.reverse()) {
      if (state.installed)
        await rm(state.target, { recursive: true, force: true });
      if (state.previous) await rename(state.backup, state.target);
    }
    throw error;
  }
}
