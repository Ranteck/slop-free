import { readFile } from "node:fs/promises";
import path from "node:path";
import { QUALITY_PROFILES, type QualityProfile } from "./types.js";

interface ZeroTsManifest {
  readonly profile?: unknown;
}

const ZERO_TS_MANIFEST_FILE = ".zero-ts.json";

export const isQualityProfile = (value: unknown): value is QualityProfile =>
  typeof value === "string" && QUALITY_PROFILES.includes(value as QualityProfile);

export const defaultQualityProfile = (command: "create" | "apply"): QualityProfile =>
  command === "create" ? "strict" : "warm";

const parseManifestProfile = (raw: string): QualityProfile | undefined => {
  const parsed = JSON.parse(raw) as ZeroTsManifest;
  return isQualityProfile(parsed.profile) ? parsed.profile : undefined;
};

export const readQualityProfileFromManifest = async (
  targetDir: string,
): Promise<QualityProfile | undefined> => {
  const manifestPath = path.join(targetDir, ZERO_TS_MANIFEST_FILE);

  try {
    const source = await readFile(manifestPath, "utf8");
    return parseManifestProfile(source);
  } catch {
    return undefined;
  }
};

interface ResolveQualityProfileOptions {
  readonly command: "create" | "apply";
  readonly explicitProfile: QualityProfile | undefined;
  readonly wizardProfile: QualityProfile | undefined;
  readonly manifestProfile: QualityProfile | undefined;
}

export const resolveQualityProfile = (
  options: ResolveQualityProfileOptions,
): QualityProfile => {
  if (options.explicitProfile !== undefined) {
    return options.explicitProfile;
  }

  if (options.wizardProfile !== undefined) {
    return options.wizardProfile;
  }

  if (options.manifestProfile !== undefined) {
    return options.manifestProfile;
  }

  return defaultQualityProfile(options.command);
};
