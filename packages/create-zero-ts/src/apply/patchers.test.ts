import { describe, expect, it } from "vitest";
import { buildPackageJsonPlan } from "./patchers.js";
import type { PackageJsonLike } from "./types.js";

describe("buildPackageJsonPlan", (): void => {
  it("adds missing anti-slop scripts and dependencies", (): void => {
    const current: PackageJsonLike = {
      name: "demo",
      scripts: {
        test: "jest --config custom.js",
      },
      dependencies: {},
      devDependencies: {},
    };

    const template: PackageJsonLike = {
      scripts: {
        test: "vitest run",
        "zero:check": "npm run typecheck && npm run lint",
        check: "npm run lint",
        prepare: "lefthook install",
      },
      dependencies: {
        zod: "^3.0.0",
      },
      devDependencies: {
        eslint: "^9.0.0",
      },
      engines: {
        node: ">=22",
      },
    };

    const plan = buildPackageJsonPlan("package.json", current, template, "fallback");

    expect(plan.summary.changed).toBe(true);
    expect(plan.summary.addedScripts).toContain("check");
    expect(plan.summary.addedScripts).toContain("zero:check");
    expect(plan.summary.updatedScripts).toHaveLength(0);
    expect(plan.summary.addedDependencies).toContain("zod");
    expect(plan.summary.addedDevDependencies).toContain("eslint");
    expect(plan.next.scripts?.test).toBe("jest --config custom.js");
    expect(plan.next.scripts?.prepare).toBe("lefthook install");
  });

  it("merges existing prepare script with lefthook install", (): void => {
    const current: PackageJsonLike = {
      scripts: {
        prepare: "husky install",
      },
    };
    const template: PackageJsonLike = {
      scripts: {
        prepare: "lefthook install",
      },
    };

    const plan = buildPackageJsonPlan("package.json", current, template, "demo");

    expect(plan.next.scripts?.prepare).toBe("husky install && lefthook install");
    expect(plan.summary.updatedPrepareScript).toBe(true);
  });

  it("updates managed lint scripts when switching between warm and strict", (): void => {
    const current: PackageJsonLike = {
      scripts: {
        lint: "eslint . --max-warnings 0",
        "lint:fix": "eslint . --fix --max-warnings 0",
      },
    };
    const template: PackageJsonLike = {
      scripts: {
        lint: "eslint . --max-warnings 999",
        "lint:fix": "eslint . --fix --max-warnings 999",
      },
    };

    const plan = buildPackageJsonPlan("package.json", current, template, "demo");

    expect(plan.next.scripts?.lint).toBe("eslint . --max-warnings 999");
    expect(plan.next.scripts?.["lint:fix"]).toBe("eslint . --fix --max-warnings 999");
    expect(plan.summary.updatedScripts).toEqual(["lint", "lint:fix"]);
  });

  it("does not overwrite custom lint scripts", (): void => {
    const current: PackageJsonLike = {
      scripts: {
        lint: "eslint src --max-warnings 0",
      },
    };
    const template: PackageJsonLike = {
      scripts: {
        lint: "eslint . --max-warnings 999",
      },
    };

    const plan = buildPackageJsonPlan("package.json", current, template, "demo");

    expect(plan.next.scripts?.lint).toBe("eslint src --max-warnings 0");
    expect(plan.summary.updatedScripts).toEqual([]);
  });
});
