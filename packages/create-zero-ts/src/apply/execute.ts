import path from "node:path";
import { runPostApplyChecks } from "./checks.js";
import { backupFile, readTextIfExists, writeTextFile } from "./io.js";
import { promptFileConflictResolution } from "./prompts.js";
import type { ApplyPlan, ApplySummary } from "./types.js";
import { installCommand } from "../package-manager.js";
import { runCommand } from "../process.js";
import type { PackageManager } from "../types.js";

export interface ExecuteApplyPlanOptions {
  readonly targetDir: string;
  readonly packageManager: PackageManager;
  readonly yes: boolean;
  readonly force: boolean;
  readonly dryRun: boolean;
  readonly backup: boolean;
  readonly shouldInstall: boolean;
  readonly shouldRunChecks: boolean;
}

const writeManagedFile = async (
  targetDir: string,
  relativePath: string,
  content: string,
  dryRun: boolean,
): Promise<void> => {
  if (dryRun) {
    return;
  }

  await writeTextFile(path.join(targetDir, relativePath), content);
};

const applyPackageJson = async (
  plan: ApplyPlan,
  options: ExecuteApplyPlanOptions,
): Promise<boolean> => {
  if (!plan.packageJsonPlan.summary.changed) {
    return false;
  }

  const packageJsonPath = path.join(options.targetDir, "package.json");
  const nextSource = `${JSON.stringify(plan.packageJsonPlan.next, null, 2)}\n`;
  const currentSource = await readTextIfExists(packageJsonPath);

  if (currentSource === nextSource) {
    return false;
  }

  const decision = currentSource === undefined
    ? "overwrite"
    : await promptFileConflictResolution(
      "package.json",
      currentSource,
      nextSource,
      options.yes,
      options.force,
    );

  if (decision === "skip") {
    return false;
  }

  if (options.backup && currentSource !== undefined && !options.dryRun) {
    await backupFile(packageJsonPath);
  }

  if (!options.dryRun) {
    await writeTextFile(packageJsonPath, nextSource);
  }

  return true;
};

export const executeApplyPlan = async (
  plan: ApplyPlan,
  options: ExecuteApplyPlanOptions,
): Promise<ApplySummary> => {
  const createdFiles: string[] = [];
  const overwrittenFiles: string[] = [];
  const skippedFiles: string[] = [];

  for (const managedFile of plan.filesToCreate) {
    await writeManagedFile(
      options.targetDir,
      managedFile.relativePath,
      managedFile.content,
      options.dryRun,
    );
    createdFiles.push(managedFile.relativePath);
  }

  for (const managedFile of plan.conflictingFiles) {
    const targetPath = path.join(options.targetDir, managedFile.relativePath);
    const existing = await readTextIfExists(targetPath);
    if (existing === undefined) {
      await writeManagedFile(
        options.targetDir,
        managedFile.relativePath,
        managedFile.content,
        options.dryRun,
      );
      createdFiles.push(managedFile.relativePath);
      continue;
    }

    if (existing === managedFile.content) {
      skippedFiles.push(managedFile.relativePath);
      continue;
    }

    const decision = await promptFileConflictResolution(
      managedFile.relativePath,
      existing,
      managedFile.content,
      options.yes,
      options.force,
    );

    if (decision === "skip") {
      skippedFiles.push(managedFile.relativePath);
      continue;
    }

    if (options.backup && !options.dryRun) {
      await backupFile(targetPath);
    }

    await writeManagedFile(
      options.targetDir,
      managedFile.relativePath,
      managedFile.content,
      options.dryRun,
    );
    overwrittenFiles.push(managedFile.relativePath);
  }

  const packageJsonUpdated = await applyPackageJson(plan, options);

  let installRan = false;
  if (options.shouldInstall) {
    if (!options.dryRun) {
      runCommand(
        options.packageManager,
        installCommand(options.packageManager),
        options.targetDir,
        "inherit",
      );
    }
    installRan = true;
  }

  let checksRan: readonly string[] = [];
  if (options.shouldRunChecks) {
    if (options.dryRun) {
      checksRan = ["typecheck", "lint", "test"];
    } else {
      const packageJsonForChecks =
        packageJsonUpdated
          ? plan.packageJsonPlan.next
          : (plan.packageJsonPlan.current ?? plan.packageJsonPlan.next);
      checksRan = runPostApplyChecks(options.packageManager, options.targetDir, packageJsonForChecks);
    }
  }

  return {
    createdFiles,
    overwrittenFiles,
    skippedFiles,
    packageJsonUpdated,
    installRan,
    checksRan,
  };
};
