import process from "node:process";
import { select } from "@clack/prompts";
import { exitOnCancel } from "../ui.js";
import { formatDiff } from "./diff.js";

export type ConflictResolution = "overwrite" | "skip";

export const promptFileConflictResolution = async (
  relativePath: string,
  existingContent: string,
  incomingContent: string,
): Promise<ConflictResolution> => {
  for (;;) {
    const decision = await select({
      message: `File ${relativePath} already exists. What should apply do?`,
      initialValue: "skip",
      options: [
        {
          label: "Skip (safe)",
          value: "skip",
        },
        {
          label: "Overwrite",
          value: "overwrite",
        },
        {
          label: "View diff preview",
          value: "preview",
        },
      ],
    });

    const value = exitOnCancel(decision);
    if (value === "overwrite" || value === "skip") {
      return value;
    }

    process.stdout.write(formatDiff(relativePath, existingContent, incomingContent));
    process.stdout.write("\n");
  }
};
