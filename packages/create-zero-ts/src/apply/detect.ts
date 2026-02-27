import { readFile } from "node:fs/promises";
import path from "node:path";
import { MANAGED_TEMPLATE_FILES } from "./constants.js";
import { fileExists, readTextIfExists } from "./io.js";
import type { ManagedFile, PackageJsonLike } from "./types.js";
import type { QualityProfile } from "../types.js";
import { renderTemplateContent, sanitizePackageName } from "../template.js";

export interface ApplyDetection {
  readonly targetPackageJson: PackageJsonLike | undefined;
  readonly templatePackageJson: PackageJsonLike;
  readonly managedFiles: readonly ManagedFile[];
  readonly projectName: string;
}

const readJson = async <T>(filePath: string): Promise<T> => {
  const source = await readFile(filePath, "utf8");
  return JSON.parse(source) as T;
};

export const readJsonIfExists = async <T>(filePath: string): Promise<T | undefined> => {
  const present = await fileExists(filePath);
  if (!present) {
    return undefined;
  }

  return readJson<T>(filePath);
};

export const detectApplyInput = async (
  targetDir: string,
  templateDir: string,
  qualityProfile: QualityProfile,
): Promise<ApplyDetection> => {
  const packageJsonPath = path.join(targetDir, "package.json");
  const targetPackageJson = await readJsonIfExists<PackageJsonLike>(packageJsonPath);

  const fallbackProjectName = sanitizePackageName(path.basename(targetDir));
  const projectName =
    typeof targetPackageJson?.name === "string" && targetPackageJson.name.length > 0
      ? targetPackageJson.name
      : fallbackProjectName;

  const templatePackageJsonPath = path.join(templateDir, "package.json");
  const templatePackageJsonRaw = await readJson<PackageJsonLike>(templatePackageJsonPath);
  const templatePackageJson: PackageJsonLike = JSON.parse(
    renderTemplateContent(
      JSON.stringify(templatePackageJsonRaw),
      projectName,
      undefined,
      qualityProfile,
    ),
  ) as PackageJsonLike;

  const managedFiles = await Promise.all(
    MANAGED_TEMPLATE_FILES.map(async (managedTemplateFile): Promise<ManagedFile> => {
      const sourceTemplatePath = path.join(templateDir, managedTemplateFile.sourceRelativePath);
      const sourceContent = await readFile(sourceTemplatePath, "utf8");
      const renderedContent = renderTemplateContent(
        sourceContent,
        projectName,
        undefined,
        qualityProfile,
      );
      const targetPath = path.join(targetDir, managedTemplateFile.targetRelativePath);
      const existingContent = await readTextIfExists(targetPath);

      return {
        relativePath: managedTemplateFile.targetRelativePath,
        sourceTemplatePath: managedTemplateFile.sourceRelativePath,
        content: renderedContent,
        exists: existingContent !== undefined,
      };
    }),
  );

  return {
    targetPackageJson,
    templatePackageJson,
    managedFiles,
    projectName,
  };
};
