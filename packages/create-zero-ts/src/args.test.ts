import { describe, expect, it } from "vitest";
import { parseCliArgs } from "./args.js";

describe("parseCliArgs", (): void => {
  it("parses common flags and positional project name", (): void => {
    const parsed = parseCliArgs(["demo-app", "--pm", "pnpm", "--install", "--yes"]);

    expect(parsed.projectName).toBe("demo-app");
    expect(parsed.packageManager).toBe("pnpm");
    expect(parsed.install).toBe(true);
    expect(parsed.yes).toBe(true);
  });

  it("parses assignment-style flags", (): void => {
    const parsed = parseCliArgs(["--pm=npm", "--dir=./tmp/demo", "--no-install"]);

    expect(parsed.packageManager).toBe("npm");
    expect(parsed.targetDir).toBe("./tmp/demo");
    expect(parsed.install).toBe(false);
  });

  it("throws on unknown flags", (): void => {
    expect((): void => {
      parseCliArgs(["--unknown"]);
    }).toThrowError("Unknown argument");
  });
});
