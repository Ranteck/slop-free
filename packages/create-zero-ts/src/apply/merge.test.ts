import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { mergeContent } from "./merge.js";

type YamlRecord = Record<string, unknown>;

const parseYamlRecord = (source: string): YamlRecord => {
  const parsed = parse(source) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected YAML object");
  }

  return parsed as YamlRecord;
};

describe("mergeContent", (): void => {
  it("merges lefthook commands and adds comment conflicts for key collisions", (): void => {
    const existing = [
      "pre-commit:",
      "  parallel: true",
      "  commands:",
      "    lint:",
      "      run: yarn lint",
      "",
    ].join("\n");

    const incoming = [
      "pre-commit:",
      "  parallel: true",
      "  commands:",
      "    lint:",
      "      run: npm run lint",
      "    typecheck:",
      "      run: npm run typecheck",
      "",
    ].join("\n");

    const merged = mergeContent("lefthook.yml", existing, incoming);
    expect(merged).toBeDefined();
    if (merged === undefined) {
      throw new Error("Expected merged content");
    }

    const parsed = parseYamlRecord(merged);
    const preCommit = parsed["pre-commit"] as { commands?: Record<string, unknown> };
    const commands = preCommit.commands ?? {};

    expect(commands.typecheck).toEqual({ run: "npm run typecheck" });
    expect(commands.lint).toEqual({ run: "yarn lint" });
    expect(merged).toContain("# conflict: pre-commit.commands.lint");
    expect(merged).toContain("# <<<<<<< current");
    expect(merged).toContain("# >>>>>>> template");
  });

  it("adds missing hooks from incoming lefthook config", (): void => {
    const existing = [
      "pre-commit:",
      "  commands:",
      "    lint:",
      "      run: npm run lint",
      "",
    ].join("\n");

    const incoming = [
      "pre-commit:",
      "  commands:",
      "    lint:",
      "      run: npm run lint",
      "commit-msg:",
      "  commands:",
      "    conventional-commit:",
      "      run: npx --no-install commitlint --edit {1}",
      "",
    ].join("\n");

    const merged = mergeContent("lefthook.yml", existing, incoming);
    expect(merged).toBeDefined();
    if (merged === undefined) {
      throw new Error("Expected merged content");
    }

    const parsed = parseYamlRecord(merged);
    expect(parsed["commit-msg"]).toEqual({
      commands: {
        "conventional-commit": {
          run: "npx --no-install commitlint --edit {1}",
        },
      },
    });
    expect(merged).not.toContain("# zero-ts merge conflicts");
  });

  it("adds missing non-command hook settings from incoming template", (): void => {
    const existing = [
      "pre-commit:",
      "  commands:",
      "    lint:",
      "      run: npm run lint",
      "",
    ].join("\n");

    const incoming = [
      "pre-commit:",
      "  parallel: true",
      "  files: git diff --name-only --cached",
      "  commands:",
      "    lint:",
      "      run: npm run lint",
      "",
    ].join("\n");

    const merged = mergeContent("lefthook.yml", existing, incoming);
    expect(merged).toBeDefined();
    if (merged === undefined) {
      throw new Error("Expected merged content");
    }

    const parsed = parseYamlRecord(merged);
    expect(parsed["pre-commit"]).toEqual({
      parallel: true,
      files: "git diff --name-only --cached",
      commands: {
        lint: {
          run: "npm run lint",
        },
      },
    });
    expect(merged).not.toContain("# zero-ts merge conflicts");
  });

  it("returns undefined for invalid lefthook YAML", (): void => {
    const merged = mergeContent("lefthook.yml", "pre-commit: [", "pre-commit:\n  commands: {}\n");
    expect(merged).toBeUndefined();
  });

  it("does not attempt YAML merge for non-lefthook yaml files", (): void => {
    const merged = mergeContent("workflow.yml", "a: 1\n", "a: 2\n");
    expect(merged).toBeUndefined();
  });

  it("returns the original content when lefthook merge has no changes", (): void => {
    const source = [
      "pre-commit:",
      "  commands:",
      "    lint:",
      "      run: npm run lint",
      "",
    ].join("\n");

    const merged = mergeContent("lefthook.yml", source, source);
    expect(merged).toBe(source);
  });
});
