import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import validatePackageName from "validate-npm-package-name";

const TEMPLATE_TOKEN_PROJECT_NAME = "__PROJECT_NAME__";

export const sanitizePackageName = (input: string): string =>
  input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "-");

export const assertValidPackageName = (packageName: string): void => {
  const validation = validatePackageName(packageName);
  if (validation.validForNewPackages !== true) {
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

const replaceTemplateTokens = async (filePath: string, projectName: string): Promise<void> => {
  const source = await readFile(filePath, "utf8");
  const output = source.replaceAll(TEMPLATE_TOKEN_PROJECT_NAME, projectName);
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
): Promise<void> => {
  await cp(templateDir, targetDir, { recursive: true });

  const files = await walkFiles(targetDir);
  await Promise.all(files.map(async (filePath): Promise<void> => replaceTemplateTokens(filePath, projectName)));

  const gitIgnorePath = path.join(targetDir, "gitignore");
  const dotGitIgnorePath = path.join(targetDir, ".gitignore");
  const hasGitIgnore = await stat(gitIgnorePath).then(() => true).catch(() => false);
  if (hasGitIgnore) {
    await rename(gitIgnorePath, dotGitIgnorePath);
  }
};
