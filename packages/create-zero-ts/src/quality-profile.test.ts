import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultQualityProfile,
  readQualityProfileFromManifest,
  resolveQualityProfile,
} from "./quality-profile.js";

describe("defaultQualityProfile", (): void => {
  it("uses strict for create and warm for apply", (): void => {
    expect(defaultQualityProfile("create")).toBe("strict");
    expect(defaultQualityProfile("apply")).toBe("warm");
  });
});

describe("resolveQualityProfile", (): void => {
  it("applies precedence: explicit > wizard > manifest > default", (): void => {
    expect(
      resolveQualityProfile({
        command: "apply",
        explicitProfile: "strict",
        wizardProfile: "warm",
        manifestProfile: "warm",
      }),
    ).toBe("strict");

    expect(
      resolveQualityProfile({
        command: "apply",
        explicitProfile: undefined,
        wizardProfile: "strict",
        manifestProfile: "warm",
      }),
    ).toBe("strict");

    expect(
      resolveQualityProfile({
        command: "apply",
        explicitProfile: undefined,
        wizardProfile: undefined,
        manifestProfile: "strict",
      }),
    ).toBe("strict");

    expect(
      resolveQualityProfile({
        command: "apply",
        explicitProfile: undefined,
        wizardProfile: undefined,
        manifestProfile: undefined,
      }),
    ).toBe("warm");
  });
});

describe("readQualityProfileFromManifest", (): void => {
  it("reads profile from .zero-ts.json when valid", async (): Promise<void> => {
    const tempDirectory = await mkdtemp(path.join(tmpdir(), "zero-ts-profile-"));

    try {
      await writeFile(
        path.join(tempDirectory, ".zero-ts.json"),
        JSON.stringify({ tool: "create-zero-ts", version: "0.1.0", profile: "warm" }, null, 2),
      );

      await expect(readQualityProfileFromManifest(tempDirectory)).resolves.toBe("warm");
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("returns undefined for missing or invalid manifests", async (): Promise<void> => {
    const tempDirectory = await mkdtemp(path.join(tmpdir(), "zero-ts-profile-invalid-"));

    try {
      await expect(readQualityProfileFromManifest(tempDirectory)).resolves.toBeUndefined();

      await writeFile(path.join(tempDirectory, ".zero-ts.json"), "{ invalid json");
      await expect(readQualityProfileFromManifest(tempDirectory)).resolves.toBeUndefined();
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });
});
