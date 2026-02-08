import type { PackageManager } from "../types.js";

export interface PackageJsonLike {
  name?: string;
  version?: string;
  type?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  [key: string]: unknown;
}

export interface ApplyExecutionOptions {
  readonly targetDir: string;
  readonly packageManager: PackageManager;
  readonly install?: boolean;
  readonly runChecks?: boolean;
  readonly yes: boolean;
  readonly wizard: boolean;
  readonly dryRun: boolean;
  readonly backup: boolean;
  readonly force: boolean;
}

export type ApplyProgressStage =
  | "creating_files"
  | "resolving_conflicts"
  | "updating_package_json"
  | "installing_dependencies"
  | "running_checks"
  | "completed";

export interface ApplyProgressEvent {
  readonly stage: ApplyProgressStage;
  readonly message: string;
}

export interface ManagedFile {
  readonly relativePath: string;
  readonly sourceTemplatePath: string;
  readonly content: string;
  readonly exists: boolean;
}

export interface PackageJsonChangeSummary {
  readonly addedScripts: readonly string[];
  readonly updatedScripts: readonly string[];
  readonly addedDependencies: readonly string[];
  readonly addedDevDependencies: readonly string[];
  readonly updatedPrepareScript: boolean;
  readonly changed: boolean;
}

export interface PackageJsonPlan {
  readonly path: string;
  readonly exists: boolean;
  readonly current: PackageJsonLike | undefined;
  readonly next: PackageJsonLike;
  readonly summary: PackageJsonChangeSummary;
}

export interface ApplyPlan {
  readonly projectName: string;
  readonly filesToCreate: readonly ManagedFile[];
  readonly conflictingFiles: readonly ManagedFile[];
  readonly packageJsonPlan: PackageJsonPlan;
  readonly requiresInstall: boolean;
}

export interface ApplySummary {
  readonly createdFiles: readonly string[];
  readonly overwrittenFiles: readonly string[];
  readonly skippedFiles: readonly string[];
  readonly packageJsonUpdated: boolean;
  readonly installRan: boolean;
  readonly checksRan: readonly string[];
}
