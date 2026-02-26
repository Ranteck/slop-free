/**
 * Smart merge strategies for conflict resolution.
 *
 * - JSON files: deep merge (existing values preserved, new template keys added).
 * - Line-based files (.gitignore, .npmrc): union of unique lines.
 * - lefthook.yml: merge hook commands, preserve existing command definitions,
 *   and append commented conflict markers for manual review.
 * - Fallback: returns undefined (caller should fall back to overwrite/skip).
 */

import { parse, stringify } from "yaml";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
interface YamlObject extends Record<string, YamlValue> {
  readonly __yamlObjectBrand?: never;
}
type YamlValue =
  | string
  | number
  | boolean
  | null
  | YamlValue[]
  | YamlObject;

interface LefthookCommandConflict {
  readonly hookName: string;
  readonly commandName: string;
  readonly existingValue: YamlValue;
  readonly incomingValue: YamlValue;
}

const isPlainObject = (value: unknown): value is Record<string, JsonValue> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isYamlObject = (value: unknown): value is YamlObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cloneYamlValue = (value: YamlValue): YamlValue => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneYamlValue(item));
  }

  if (isYamlObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, cloneYamlValue(nestedValue)]),
    );
  }

  return value;
};

const yamlValuesEqual = (left: YamlValue, right: YamlValue): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

/**
 * Deep-merge two JSON objects.
 * - Existing scalar values are preserved (user wins).
 * - New keys from `incoming` are added.
 * - Nested objects are merged recursively.
 * - Arrays are merged as a union (deduplicated, preserving order of existing first).
 */
const deepMerge = (existing: JsonValue, incoming: JsonValue): JsonValue => {
  if (isPlainObject(existing) && isPlainObject(incoming)) {
    const result: Record<string, JsonValue> = { ...existing };
    for (const key of Object.keys(incoming)) {
      const incomingValue = incoming[key];
      if (incomingValue === undefined) continue;
      const existingValue = result[key];
      result[key] = existingValue === undefined
        ? incomingValue
        : deepMerge(existingValue, incomingValue);
    }
    return result;
  }

  if (Array.isArray(existing) && Array.isArray(incoming)) {
    const seen = new Set(existing.map((item) => JSON.stringify(item)));
    const merged = [...existing];
    for (const item of incoming) {
      const serialized = JSON.stringify(item);
      if (!seen.has(serialized)) {
        seen.add(serialized);
        merged.push(item);
      }
    }
    return merged;
  }

  // Scalar conflict: existing wins (user's value preserved).
  return existing;
};

const mergeJson = (existingText: string, incomingText: string): string | undefined => {
  try {
    const existing = JSON.parse(existingText) as JsonValue;
    const incoming = JSON.parse(incomingText) as JsonValue;
    const merged = deepMerge(existing, incoming);
    return `${JSON.stringify(merged, null, 2)}\n`;
  } catch {
    return undefined;
  }
};

const mergeLines = (existingText: string, incomingText: string): string => {
  const existingLines = existingText.split("\n");
  const incomingLines = incomingText.split("\n");

  const seen = new Set(existingLines.map((line) => line.trim()));
  const additions: string[] = [];

  for (const line of incomingLines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && !seen.has(trimmed)) {
      seen.add(trimmed);
      additions.push(line);
    }
  }

  if (additions.length === 0) {
    return existingText;
  }

  const base = existingText.endsWith("\n") ? existingText : `${existingText}\n`;
  return `${base}${additions.join("\n")}\n`;
};

const LINE_MERGE_EXTENSIONS = new Set([".gitignore", ".npmrc", ".npmignore", ".dockerignore"]);

const isJsonFile = (relativePath: string): boolean =>
  relativePath.endsWith(".json") || relativePath.endsWith(".jsonc");

const fileNameOf = (relativePath: string): string => {
  const slashIdx = relativePath.lastIndexOf("/");
  const backslashIdx = relativePath.lastIndexOf("\\");
  const separatorIdx = Math.max(slashIdx, backslashIdx);
  return separatorIdx >= 0 ? relativePath.slice(separatorIdx + 1) : relativePath;
};

const isLineMergeFile = (relativePath: string): boolean => {
  const fileName = fileNameOf(relativePath);
  return LINE_MERGE_EXTENSIONS.has(fileName);
};

const isLefthookFile = (relativePath: string): boolean =>
  fileNameOf(relativePath).toLowerCase() === "lefthook.yml";

const toCommentedYamlLines = (value: YamlValue): readonly string[] => {
  const rendered = stringify(value).trimEnd().split("\n");
  return rendered.map((line) => `# ${line}`);
};

const renderLefthookConflicts = (conflicts: readonly LefthookCommandConflict[]): string => {
  const lines: string[] = [
    "# zero-ts merge conflicts (manual review required)",
  ];

  for (const conflict of conflicts) {
    lines.push(`# conflict: ${conflict.hookName}.commands.${conflict.commandName}`);
    lines.push("# <<<<<<< current");
    lines.push(...toCommentedYamlLines(conflict.existingValue));
    lines.push("# =======");
    lines.push(...toCommentedYamlLines(conflict.incomingValue));
    lines.push("# >>>>>>> template");
  }

  return lines.join("\n");
};

const mergeLefthook = (existingText: string, incomingText: string): string | undefined => {
  try {
    const existingUnknown = parse(existingText) as unknown;
    const incomingUnknown = parse(incomingText) as unknown;

    if (!isYamlObject(existingUnknown) || !isYamlObject(incomingUnknown)) {
      return undefined;
    }

    const mergedRoot = cloneYamlValue(existingUnknown) as YamlObject;
    const conflicts: LefthookCommandConflict[] = [];
    let changed = false;

    for (const [hookName, incomingHookValue] of Object.entries(incomingUnknown)) {
      if (!isYamlObject(incomingHookValue)) {
        continue;
      }

      const existingHookValue = mergedRoot[hookName];
      if (existingHookValue === undefined) {
        mergedRoot[hookName] = cloneYamlValue(incomingHookValue);
        changed = true;
        continue;
      }

      if (!isYamlObject(existingHookValue)) {
        continue;
      }

      for (const [hookKey, incomingHookSetting] of Object.entries(incomingHookValue)) {
        if (hookKey === "commands") {
          continue;
        }

        if (existingHookValue[hookKey] !== undefined) {
          continue;
        }

        existingHookValue[hookKey] = cloneYamlValue(incomingHookSetting);
        changed = true;
      }

      const incomingCommandsValue = incomingHookValue.commands;
      if (!isYamlObject(incomingCommandsValue)) {
        continue;
      }

      if (existingHookValue.commands === undefined) {
        existingHookValue.commands = cloneYamlValue(incomingCommandsValue);
        changed = true;
        continue;
      }

      if (!isYamlObject(existingHookValue.commands)) {
        continue;
      }

      const existingCommands = existingHookValue.commands;
      for (const [commandName, incomingCommandValue] of Object.entries(incomingCommandsValue)) {
        const existingCommandValue = existingCommands[commandName];
        if (existingCommandValue === undefined) {
          existingCommands[commandName] = cloneYamlValue(incomingCommandValue);
          changed = true;
          continue;
        }

        if (!yamlValuesEqual(existingCommandValue, incomingCommandValue)) {
          conflicts.push({
            hookName,
            commandName,
            existingValue: cloneYamlValue(existingCommandValue),
            incomingValue: cloneYamlValue(incomingCommandValue),
          });
        }
      }
    }

    if (!changed && conflicts.length === 0) {
      return existingText;
    }

    const mergedYaml = stringify(mergedRoot);
    const normalizedYaml = mergedYaml.endsWith("\n") ? mergedYaml : `${mergedYaml}\n`;
    if (conflicts.length === 0) {
      return normalizedYaml;
    }

    return `${normalizedYaml}\n${renderLefthookConflicts(conflicts)}\n`;
  } catch {
    return undefined;
  }
};

/**
 * Attempt to smart-merge `existing` and `incoming` content.
 * Returns merged content string, or `undefined` if merge is not supported
 * for the given file type (caller should fall back to overwrite/skip prompt).
 */
export const mergeContent = (
  relativePath: string,
  existingContent: string,
  incomingContent: string,
): string | undefined => {
  if (isLefthookFile(relativePath)) {
    return mergeLefthook(existingContent, incomingContent);
  }

  if (isJsonFile(relativePath)) {
    return mergeJson(existingContent, incomingContent);
  }

  if (isLineMergeFile(relativePath)) {
    return mergeLines(existingContent, incomingContent);
  }

  return undefined;
};
