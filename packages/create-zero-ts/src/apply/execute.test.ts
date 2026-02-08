import { describe, expect, it } from "vitest";
import { executeApplyPlan } from "./execute.js";
import type { ApplyPlan, ApplyProgressEvent } from "./types.js";

const basePlan = (): ApplyPlan => ({
  projectName: "demo",
  filesToCreate: [
    {
      relativePath: "tsconfig.json",
      sourceTemplatePath: "tsconfig.json",
      content: "{}\n",
      exists: false,
    },
  ],
  conflictingFiles: [],
  packageJsonPlan: {
    path: "package.json",
    exists: false,
    current: undefined,
    next: {
      name: "demo",
    },
    summary: {
      addedScripts: [],
      updatedScripts: [],
      addedDependencies: [],
      addedDevDependencies: [],
      updatedPrepareScript: false,
      changed: false,
    },
  },
  requiresInstall: false,
});

describe("executeApplyPlan", (): void => {
  it("emits progress stages in order", async (): Promise<void> => {
    const events: ApplyProgressEvent[] = [];
    const result = await executeApplyPlan(basePlan(), {
      targetDir: "C:/tmp/demo",
      packageManager: "npm",
      conflictPolicy: "skip",
      dryRun: true,
      backup: false,
      shouldInstall: false,
      shouldRunChecks: false,
      onProgress: (event): void => {
        events.push(event);
      },
    });

    expect(result.createdFiles).toEqual(["tsconfig.json"]);
    expect(events.map((event) => event.stage)).toEqual([
      "creating_files",
      "resolving_conflicts",
      "updating_package_json",
      "installing_dependencies",
      "running_checks",
      "completed",
    ]);
  });
});
