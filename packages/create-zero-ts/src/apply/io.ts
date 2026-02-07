import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const exists = async (filePath: string): Promise<boolean> =>
  stat(filePath).then(() => true).catch(() => false);

export const fileExists = exists;

export const ensureParentDirectory = async (filePath: string): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true });
};

export const readTextIfExists = async (filePath: string): Promise<string | undefined> => {
  const present = await exists(filePath);
  if (!present) {
    return undefined;
  }

  return readFile(filePath, "utf8");
};

export const writeTextFile = async (filePath: string, content: string): Promise<void> => {
  await ensureParentDirectory(filePath);
  await writeFile(filePath, content, "utf8");
};

export const backupFile = async (sourcePath: string): Promise<string> => {
  const dateToken = new Date().toISOString().replaceAll(":", "-");
  const backupPath = `${sourcePath}.zero-ts-backup.${dateToken}`;
  await copyFile(sourcePath, backupPath);
  return backupPath;
};
