#!/usr/bin/env node

import { confirm, cancel, intro, isCancel, outro, select, text } from "@clack/prompts";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import spawn from "cross-spawn";
import color from "picocolors";
import { parseCliArgs } from "./args.js";
import {
  detectPackageManager,
  installCommand,
  packageManagerLabel,
  runScriptCommand,
} from "./package-manager.js";
import {
  assertValidPackageName,
  copyAndRenderTemplate,
  ensureTargetDirectory,
  resolveTemplateDir,
  sanitizePackageName,
} from "./template.js";
import { PACKAGE_MANAGERS, type PackageManager } from "./types.js";

const exitOnCancel = <T>(value: T | symbol): T => {
  if (isCancel(value)) {
    cancel("Cancelled.");
    process.exit(0);
  }

  return value;
};

const directoryHasContent = async (directoryPath: string): Promise<boolean> => {
  const exists = await stat(directoryPath).then(() => true).catch(() => false);
  if (!exists) {
    return false;
  }

  const entries = await readdir(directoryPath);
  return entries.length > 0;
};

const runCommand = (
  command: string,
  args: readonly string[],
  cwd: string,
  stdio: "inherit" | "ignore",
): void => {
  const result = spawn.sync(command, [...args], {
    cwd,
    stdio,
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
};

const choosePackageManager = async (
  initialValue: PackageManager,
  yes: boolean,
): Promise<PackageManager> => {
  if (yes) {
    return initialValue;
  }

  const selected = await select({
    message: "Pick a package manager",
    initialValue,
    options: PACKAGE_MANAGERS.map((packageManager) => ({
      value: packageManager,
      label: packageManagerLabel(packageManager),
    })),
  });

  return exitOnCancel(selected);
};

const resolveInstallDecision = async (
  installFlag: boolean | undefined,
  yes: boolean,
  packageManager: PackageManager,
): Promise<boolean> => {
  if (installFlag !== undefined) {
    return installFlag;
  }

  if (yes) {
    return false;
  }

  const install = await confirm({
    message: `Install dependencies now with ${packageManagerLabel(packageManager)}?`,
    initialValue: true,
  });

  return exitOnCancel(install);
};

const resolveProjectName = async (inputName: string | undefined, yes: boolean): Promise<string> => {
  if (typeof inputName === "string" && inputName.length > 0) {
    return inputName;
  }

  if (yes) {
    throw new Error("Project name is required when --yes is used.");
  }

  const entered = await text({
    message: "Project directory name",
    placeholder: "my-zero-ts-project",
    validate: (value: string): string | undefined =>
      value.trim().length === 0 ? "Project name cannot be empty." : undefined,
  });

  return exitOnCancel(entered);
};

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
};

const run = async (): Promise<void> => {
  intro("create-zero-ts");

  const options = parseCliArgs(process.argv.slice(2));
  const detectedPackageManager = detectPackageManager(process.cwd());
  const rawProjectName = await resolveProjectName(options.projectName, options.yes);
  const targetDir = path.resolve(process.cwd(), options.targetDir ?? rawProjectName);
  const packageName = sanitizePackageName(path.basename(targetDir));

  assertValidPackageName(packageName);

  const shouldOverwrite = await (async (): Promise<boolean> => {
    const hasContent = await directoryHasContent(targetDir);
    if (!hasContent) {
      return false;
    }

    if (options.yes) {
      throw new Error(`Target directory is not empty: ${targetDir}`);
    }

    const overwrite = await confirm({
      message: `Directory ${color.cyan(path.basename(targetDir))} is not empty. Overwrite it?`,
      initialValue: false,
    });

    return exitOnCancel(overwrite);
  })();

  await ensureTargetDirectory(targetDir, shouldOverwrite);
  await copyAndRenderTemplate(resolveTemplateDir(), targetDir, packageName);

  const packageManager = await choosePackageManager(
    options.packageManager ?? detectedPackageManager,
    options.yes || options.packageManager !== undefined,
  );

  if (!options.skipGit) {
    runCommand("git", ["init"], targetDir, "ignore");
  }

  const shouldInstall = await resolveInstallDecision(options.install, options.yes, packageManager);
  if (shouldInstall) {
    runCommand(packageManager, installCommand(packageManager), targetDir, "inherit");
  }

  const checkCommand = `${packageManager} ${runScriptCommand(packageManager, "check").join(" ")}`;
  const qualityCommand = `${packageManager} ${runScriptCommand(packageManager, "quality").join(" ")}`;

  outro(
    [
      `Project created in ${color.green(targetDir)}`,
      "",
      "Next steps:",
      `  cd ${path.relative(process.cwd(), targetDir) || "."}`,
      shouldInstall ? "" : `  ${packageManager} install`,
      `  ${checkCommand}`,
      `  ${qualityCommand}`,
    ]
      .filter((line) => line !== "")
      .join("\n"),
  );
};

await run().catch((error: unknown): never => {
  cancel(color.red(`Failed: ${formatError(error)}`));
  process.exit(1);
});
