import { describe, expect, it } from "vitest";
import { assertValidPackageName, sanitizePackageName } from "./template.js";

describe("sanitizePackageName", (): void => {
  it("normalizes casing and invalid characters", (): void => {
    expect(sanitizePackageName("My Project/Name")).toBe("my-project-name");
  });
});

describe("assertValidPackageName", (): void => {
  it("accepts valid package names", (): void => {
    expect((): void => {
      assertValidPackageName("my-valid-package");
    }).not.toThrow();
  });

  it("rejects invalid package names", (): void => {
    expect((): void => {
      assertValidPackageName("UpperCase");
    }).toThrowError("Invalid package name");
  });
});
