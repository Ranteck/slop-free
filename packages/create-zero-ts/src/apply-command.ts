import { confirm, select } from "@clack/prompts";
import { stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { detectApplyInput } from "./apply/detect.js";
import { executeApplyPlan } from "./apply/execute.js";
import { buildApplyPlan } from "./apply/plan.js";
import type { ApplyCliOptions } from "./types.js";
import { detectPackageManager, packageManagerLabel } from "./package-manager.js";
import { readQualityProfileFromManifest, resolveQualityProfile } from "./quality-profile.js";
import { resolveTemplateDir } from "./template.js";
import { PACKAGE_MANAGERS, type PackageManager, type QualityProfile } from "./types.js";
import { exitOnCancel, info, kv, section, success, warn } from "./ui.js";
import type { ApplyProgressEvent } from "./apply/types.js";

type ConflictPolicy = "review" | "skip" | "overwrite";

const INSTALLER_TOTAL_STEPS = 5;

const installerStepTitle = (step: number, title: string): string =>
  `[${String(step)}/${String(INSTALLER_TOTAL_STEPS)}] ${title}`;

const targetExists = async (targetPath: string): Promise<boolean> =>
  stat(targetPath).then(() => true).catch(() => false);

const choosePackageManager = async (
  initialValue: PackageManager,
  skipPrompts: boolean,
): Promise<PackageManager> => {
  if (skipPrompts) {
    return initialValue;
  }

  const selected = await select({
    message: "Pick a package manager for install/check commands",
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
    options: [
      {
        value: "warm",
        label: "Warm (preserve strict type/security, relax style)",
      },
      {
        value: "strict",
        label: "Strict (full enforcement)",
      },
    ],
  });

  return exitOnCancel(selected);
};

const resolveInstallDecision = async (
  installFlag: boolean | undefined,
  skipPrompts: boolean,
  recommended: boolean,
  packageManager: PackageManager,
): Promise<boolean> => {
  if (installFlag !== undefined) {
    return installFlag;
  }

  if (skipPrompts) {
    return recommended;
  }

  const selected = await confirm({
    message: `Install dependencies with ${packageManagerLabel(packageManager)}?`,
    initialValue: recommended,
  });

  return exitOnCancel(selected);
};

const resolveCheckDecision = async (
  checkFlag: boolean | undefined,
  skipPrompts: boolean,
): Promise<boolean> => {
  if (checkFlag !== undefined) {
    return checkFlag;
  }

  if (skipPrompts) {
    return true;
  }

  const selected = await confirm({
    message: "Run typecheck, lint, and test after apply?",
    initialValue: true,
  });

  return exitOnCancel(selected);
};

const resolveConflictPolicy = async (
  skipPrompts: boolean,
  force: boolean,
  hasConflicts: boolean,
): Promise<ConflictPolicy> => {
  if (!hasConflicts) {
    return "review";
  }

  if (force) {
    return "overwrite";
  }

  if (skipPrompts) {
    return "skip";
  }

  const selected = await select({
    message: "How should apply handle existing files that differ from template?",
    initialValue: "review",
    options: [
      {
        value: "review",
        label: "Review each file (recommended)",
      },
      {
        value: "skip",
        label: "Skip all conflicting files (safe)",
      },
      {
        value: "overwrite",
        label: "Overwrite all conflicting files",
      },
    ],
  });

  return exitOnCancel(selected) as ConflictPolicy;
};

const resolveBackupDecision = async (
  backupFlag: boolean,
  skipPrompts: boolean,
  conflictPolicy: ConflictPolicy,
  hasConflicts: boolean,
): Promise<boolean> => {
  if (backupFlag) {
    return true;
  }

  if (!hasConflicts || conflictPolicy === "skip") {
    return false;
  }

  if (skipPrompts) {
    return true;
  }

  const selected = await confirm({
    message: "Create backup files before overwriting? (*.zero-ts-backup.*)",
    initialValue: true,
  });

  return exitOnCancel(selected);
};

const resolveProceedDecision = async (
  skipPrompts: boolean,
  dryRun: boolean,
): Promise<boolean> => {
  if (skipPrompts || dryRun) {
    return true;
  }

  const selected = await confirm({
    message: "Proceed with apply now?",
    initialValue: true,
  });

  return exitOnCancel(selected);
};

const summarizePlan = (plan: ReturnType<typeof buildApplyPlan>): readonly string[] => {
  const summary = [
    `Project name: ${plan.projectName}`,
    `Files to create: ${String(plan.filesToCreate.length)}`,
    `Files with conflicts: ${String(plan.conflictingFiles.length)}`,
    `Package.json changed: ${plan.packageJsonPlan.summary.changed ? "yes" : "no"}`,
    `Dependencies to add: ${String(plan.packageJsonPlan.summary.addedDependencies.length)}`,
    `Dev dependencies to add: ${String(plan.packageJsonPlan.summary.addedDevDependencies.length)}`,
  ];

  return summary;
};

const summarizeConflicts = (plan: ReturnType<typeof buildApplyPlan>): readonly string[] => {
  if (plan.conflictingFiles.length === 0) {
    return ["none"];
  }

  const preview = plan.conflictingFiles.slice(0, 8).map((managedFile) => managedFile.relativePath);
  if (plan.conflictingFiles.length > preview.length) {
    preview.push(`...and ${String(plan.conflictingFiles.length - preview.length)} more`);
  }

  return preview;
};

const summarizeResult = (result: Awaited<ReturnType<typeof executeApplyPlan>>): readonly string[] => [
  `Created files: ${String(result.createdFiles.length)}`,
  `Overwritten files: ${String(result.overwrittenFiles.length)}`,
  `Skipped files: ${String(result.skippedFiles.length)}`,
  `package.json updated: ${result.packageJsonUpdated ? "yes" : "no"}`,
  `Install ran: ${result.installRan ? "yes" : "no"}`,
  `Checks ran: ${result.checksRan.length > 0 ? result.checksRan.join(", ") : "none"}`,
];

const stageLabel = (stage: ApplyProgressEvent["stage"]): string => {
  switch (stage) {
    case "creating_files":
      return "Create files";
    case "resolving_conflicts":
      return "Resolve conflicts";
    case "updating_package_json":
      return "Update package.json";
    case "installing_dependencies":
      return "Install dependencies";
    case "running_checks":
      return "Run checks";
    case "completed":
      return "Completed";
    default: {
      const neverStage: never = stage;
      return neverStage;
    }
  }
};

export const runApplyCommand = async (options: ApplyCliOptions): Promise<readonly string[]> => {
  const targetDir = path.resolve(process.cwd(), options.cwd ?? ".");
  if (!(await targetExists(targetDir))) {
    throw new Error(`Target directory does not exist: ${targetDir}`);
  }

  const interactiveWizard = options.wizard || !options.yes;
  const skipPrompts = !interactiveWizard;

  section(installerStepTitle(1, "Scan project"));
  info(`Target directory: ${targetDir}`);
  info(`Mode: ${interactiveWizard ? "interactive wizard" : "non-interactive"}`);

  const manifestProfile = await readQualityProfileFromManifest(targetDir);
  const defaultProfile = resolveQualityProfile({
    command: "apply",
    explicitProfile: options.profile,
    wizardProfile: undefined,
    manifestProfile,
  });
  const qualityProfile = await chooseQualityProfile(
    defaultProfile,
    skipPrompts || options.profile !== undefined,
  );
  kv("Quality profile", qualityProfileLabel(qualityProfile));

  const packageManager = await choosePackageManager(
    options.packageManager ?? detectPackageManager(targetDir),
    skipPrompts || options.packageManager !== undefined,
  );
  kv("Package manager", packageManagerLabel(packageManager));

  const detection = await detectApplyInput(targetDir, resolveTemplateDir(), qualityProfile);
  const plan = buildApplyPlan(targetDir, detection);
  const hasConflicts = plan.conflictingFiles.length > 0 || plan.packageJsonPlan.summary.changed;

  section(installerStepTitle(2, "Set conflict policy"));
  if (hasConflicts) {
    warn("Existing files differ from the template. Choose a safe merge policy.");
  } else {
    info("No conflicts detected in managed files or package.json.");
  }

  const conflictPolicy = await resolveConflictPolicy(
    skipPrompts,
    options.force,
    hasConflicts,
  );
  const backup = await resolveBackupDecision(
    options.backup,
    skipPrompts,
    conflictPolicy,
    hasConflicts,
  );
  kv("Conflict policy", conflictPolicy);
  kv("Backups", backup ? "enabled" : "disabled");

  section(installerStepTitle(3, "Choose install and checks"));

  const shouldInstall = await resolveInstallDecision(
    options.install,
    skipPrompts,
    plan.requiresInstall,
    packageManager,
  );
  const shouldRunChecks = await resolveCheckDecision(options.runChecks, skipPrompts);
  kv("Install dependencies", shouldInstall ? "yes" : "no");
  kv("Run post-apply checks", shouldRunChecks ? "yes" : "no");

  section(installerStepTitle(4, "Review plan"));
  kv("Project", plan.projectName);
  kv("Files to create", String(plan.filesToCreate.length));
  kv("Files with conflicts", String(plan.conflictingFiles.length));
  kv("package.json changes", plan.packageJsonPlan.summary.changed ? "yes" : "no");
  kv("Dependency additions", String(plan.packageJsonPlan.summary.addedDependencies.length));
  kv("Dev dependency additions", String(plan.packageJsonPlan.summary.addedDevDependencies.length));
  const conflictPreview = summarizeConflicts(plan);
  if (conflictPreview[0] !== "none") {
    info(`Conflict preview: ${conflictPreview.join(", ")}`);
  }

  const shouldProceed = await resolveProceedDecision(skipPrompts, options.dryRun);

  const summary: string[] = [
    `${options.dryRun ? "Dry-run" : "Apply"} completed for ${targetDir}`,
    "",
    "Plan summary:",
    ...summarizePlan(plan).map((line) => `  - ${line}`),
    "Installer choices:",
    `  - Wizard mode: ${interactiveWizard ? "interactive" : "non-interactive"}`,
    `  - Quality profile: ${qualityProfileLabel(qualityProfile)}`,
    `  - Conflict policy: ${conflictPolicy}`,
    `  - Backups enabled: ${backup ? "yes" : "no"}`,
    `  - Install dependencies: ${shouldInstall ? "yes" : "no"}`,
    `  - Run post-apply checks: ${shouldRunChecks ? "yes" : "no"}`,
  ];

  if (!shouldProceed) {
    return [
      ...summary,
      "",
      "Apply cancelled before writing changes.",
    ];
  }

  section(installerStepTitle(5, "Execute apply"));

  const result = await executeApplyPlan(plan, {
    targetDir,
    packageManager,
    conflictPolicy,
    dryRun: options.dryRun,
    backup,
    shouldInstall,
    shouldRunChecks,
    onProgress: (event): void => {
      const message = `${stageLabel(event.stage)}: ${event.message}`;
      if (event.stage === "completed") {
        success(message);
      } else {
        info(message);
      }
    },
  });

  return [
    ...summary,
    "",
    options.dryRun ? "Dry-run result:" : "Apply result:",
    ...summarizeResult(result).map((line) => `  - ${line}`),
  ];
};
