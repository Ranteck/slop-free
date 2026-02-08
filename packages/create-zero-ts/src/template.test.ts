import { describe, expect, it } from "vitest";
import {
  TEMPLATE_TOKEN_PROJECT_NAME,
  TEMPLATE_TOKEN_ZERO_TS_VERSION,
  assertValidPackageName,
  renderTemplateContent,
  sanitizePackageName,
} from "./template.js";

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

describe("renderTemplateContent", (): void => {
  it("replaces project and version tokens", (): void => {
    const source = `${TEMPLATE_TOKEN_PROJECT_NAME}:${TEMPLATE_TOKEN_ZERO_TS_VERSION}`;
    const result = renderTemplateContent(source, "demo-app", "1.2.3");

    expect(result).toBe("demo-app:1.2.3");
  });
});
