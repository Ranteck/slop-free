import { confirm, select, text } from "@clack/prompts";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  detectPackageManager,
  installCommand,
  packageManagerLabel,
  runScriptCommand,
} from "./package-manager.js";
import { runCommand } from "./process.js";
import { defaultQualityProfile } from "./quality-profile.js";
import {
  assertValidPackageName,
  copyAndRenderTemplate,
  ensureTargetDirectory,
  resolveTemplateDir,
  sanitizePackageName,
} from "./template.js";
import type { CreateCliOptions, PackageManager, QualityProfile } from "./types.js";
import { PACKAGE_MANAGERS, QUALITY_PROFILES } from "./types.js";
import { exitOnCancel } from "./ui.js";

const directoryHasContent = async (directoryPath: string): Promise<boolean> => {
  const exists = await stat(directoryPath).then(() => true).catch(() => false);
  if (!exists) {
    return false;
  }

  const entries = await readdir(directoryPath);
  return entries.length > 0;
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

const qualityProfileLabel = (profile: QualityProfile): string =>
  profile === "warm" ? "Warm" : "Strict";

const chooseQualityProfile = async (
  initialValue: QualityProfile,
  skipPrompts: boolean,
): Promise<QualityProfile> => {
  if (skipPrompts) {
    return initialValue;
  }

  const selected = await select({
    message: "Choose quality profile",
    initialValue,
    options: QUALITY_PROFILES.map((profile) => ({
      value: profile,
      label: profile === "warm" ? "Warm (faster adoption)" : "Strict (full enforcement)",
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

export const runCreateCommand = async (options: CreateCliOptions): Promise<readonly string[]> => {
  const detectedPackageManager = detectPackageManager(process.cwd());
  const qualityProfile = await chooseQualityProfile(
    options.profile ?? defaultQualityProfile("create"),
    options.yes || options.profile !== undefined,
  );
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
      message: `Directory ${path.basename(targetDir)} is not empty. Overwrite it?`,
      initialValue: false,
    });

    return exitOnCancel(overwrite);
  })();

  await ensureTargetDirectory(targetDir, shouldOverwrite);
  await copyAndRenderTemplate(resolveTemplateDir(), targetDir, packageName, qualityProfile);

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

  return [
    `Project created in ${targetDir}`,
    `Quality profile: ${qualityProfileLabel(qualityProfile)}`,
    "",
    "Next steps:",
    `  cd ${path.relative(process.cwd(), targetDir) || "."}`,
    shouldInstall ? "" : `  ${packageManager} install`,
    `  ${checkCommand}`,
    `  ${qualityCommand}`,
  ].filter((line) => line !== "");
};
