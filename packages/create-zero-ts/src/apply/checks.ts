import type { PackageJsonLike } from "./types.js";
import { runScriptCommand } from "../package-manager.js";
import { runCommand } from "../process.js";
import type { PackageManager } from "../types.js";

const CHECK_SCRIPT_ORDER = ["typecheck", "lint", "test"] as const;

export const runPostApplyChecks = (
  packageManager: PackageManager,
  targetDir: string,
  packageJson: PackageJsonLike,
): readonly string[] => {
  const scripts = packageJson.scripts ?? {};
  const executed: string[] = [];

  for (const script of CHECK_SCRIPT_ORDER) {
    if (typeof scripts[script] !== "string") {
      continue;
    }

    try {
      runCommand(packageManager, runScriptCommand(packageManager, script), targetDir, "inherit");
    } catch (error: unknown) {
      throw new Error(`Check '${script}' failed`, { cause: error });
    }
    executed.push(script);
  }

  return executed;
};
