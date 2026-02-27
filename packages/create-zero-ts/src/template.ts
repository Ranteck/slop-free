import { readFileSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import validatePackageName from "validate-npm-package-name";
import type { QualityProfile } from "./types.js";

export const TEMPLATE_TOKEN_PROJECT_NAME = "__PROJECT_NAME__";
export const TEMPLATE_TOKEN_ZERO_TS_VERSION = "__ZERO_TS_VERSION__";
export const TEMPLATE_TOKEN_ZERO_TS_PROFILE = "__ZERO_TS_PROFILE__";
export const TEMPLATE_TOKEN_ZERO_TS_FORM_RULE_LEVEL = "__ZERO_TS_FORM_RULE_LEVEL__";
export const TEMPLATE_TOKEN_ZERO_TS_LINT_MAX_WARNINGS = "__ZERO_TS_LINT_MAX_WARNINGS__";

const resolveZeroTsVersion = (): string => {
  try {
    const packageJsonPath = path.resolve(import.meta.dirname, "../package.json");
    const packageJsonRaw = readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonRaw) as { version?: unknown };

    if (typeof packageJson.version === "string" && packageJson.version.length > 0) {
      return packageJson.version;
    }
  } catch {
    // Fallback for non-standard runtimes.
  }

  return "0.0.0";
};

export const ZERO_TS_VERSION = resolveZeroTsVersion();

export const sanitizePackageName = (input: string): string =>
  input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "-");

export const assertValidPackageName = (packageName: string): void => {
  const validation = validatePackageName(packageName);
  if (!validation.validForNewPackages) {
    const errors = [
      ...(validation.errors ?? []),
      ...(validation.warnings ?? []),
    ];
    throw new Error(`Invalid package name "${packageName}": ${errors.join(", ")}`);
  }
};

export const resolveTemplateDir = (): string => {
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFilePath);
  return path.resolve(currentDir, "../template");
};

const isDirectoryEmpty = async (directoryPath: string): Promise<boolean> => {
  try {
    const entries = await readdir(directoryPath);
    return entries.length === 0;
  } catch {
    return true;
  }
};

export const ensureTargetDirectory = async (
  targetDirectoryPath: string,
  overwrite: boolean,
): Promise<void> => {
  const targetExists = await stat(targetDirectoryPath).then(() => true).catch(() => false);
  if (targetExists && !overwrite) {
    const empty = await isDirectoryEmpty(targetDirectoryPath);
    if (!empty) {
      throw new Error(`Target directory is not empty: ${targetDirectoryPath}`);
    }
  }

  if (targetExists && overwrite) {
    await rm(targetDirectoryPath, { recursive: true, force: true });
  }

  await mkdir(targetDirectoryPath, { recursive: true });
};

export const renderTemplateContent = (
  source: string,
  projectName: string,
  zeroTsVersion: string = ZERO_TS_VERSION,
  qualityProfile: QualityProfile = "strict",
): string =>
  source
    .replaceAll(TEMPLATE_TOKEN_PROJECT_NAME, projectName)
    .replaceAll(TEMPLATE_TOKEN_ZERO_TS_VERSION, zeroTsVersion)
    .replaceAll(TEMPLATE_TOKEN_ZERO_TS_PROFILE, qualityProfile)
    .replaceAll(
      TEMPLATE_TOKEN_ZERO_TS_FORM_RULE_LEVEL,
      qualityProfile === "warm" ? "warn" : "error",
    )
    .replaceAll(
      TEMPLATE_TOKEN_ZERO_TS_LINT_MAX_WARNINGS,
      qualityProfile === "warm" ? "999" : "0",
    );

const replaceTemplateTokens = async (
  filePath: string,
  projectName: string,
  qualityProfile: QualityProfile,
): Promise<void> => {
  const source = await readFile(filePath, "utf8");
  const output = renderTemplateContent(source, projectName, ZERO_TS_VERSION, qualityProfile);
  if (source !== output) {
    await writeFile(filePath, output, "utf8");
  }
};

const walkFiles = async (directoryPath: string): Promise<readonly string[]> => {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry): Promise<readonly string[]> => {
      const absolutePath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        return walkFiles(absolutePath);
      }

      return [absolutePath];
    }),
  );

  return files.flat();
};

export const copyAndRenderTemplate = async (
  templateDir: string,
  targetDir: string,
  projectName: string,
  qualityProfile: QualityProfile,
): Promise<void> => {
  await cp(templateDir, targetDir, { recursive: true });

  const files = await walkFiles(targetDir);
  await Promise.all(
    files.map(
      async (filePath): Promise<void> => replaceTemplateTokens(filePath, projectName, qualityProfile),
    ),
  );

  const gitIgnorePath = path.join(targetDir, "gitignore");
  const dotGitIgnorePath = path.join(targetDir, ".gitignore");
  const hasGitIgnore = await stat(gitIgnorePath).then(() => true).catch(() => false);
  if (hasGitIgnore) {
    await rename(gitIgnorePath, dotGitIgnorePath);
  }
};
