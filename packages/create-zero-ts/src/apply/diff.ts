import color from "picocolors";

interface DiffLine {
  readonly type: "add" | "remove" | "context";
  readonly content: string;
}

interface DiffHunk {
  readonly startOld: number;
  readonly startNew: number;
  readonly lines: readonly DiffLine[];
}

interface DiffSummary {
  readonly added: number;
  readonly removed: number;
  readonly unchanged: number;
}

interface DiffResult {
  readonly hunks: readonly DiffHunk[];
  readonly summary: DiffSummary;
}

const getCell = (dp: readonly (readonly number[])[], i: number, j: number): number =>
  dp[i]?.[j] ?? 0;

const computeLcs = (oldLines: readonly string[], newLines: readonly string[]): number[][] => {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from(
    { length: m + 1 },
    (): number[] => new Array<number>(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const row = dp[i];
      if (row === undefined) continue;
      row[j] = oldLines[i - 1] === newLines[j - 1]
        ? getCell(dp, i - 1, j - 1) + 1
        : Math.max(getCell(dp, i - 1, j), getCell(dp, i, j - 1));
    }
  }

  return dp;
};

const buildRawDiff = (oldLines: readonly string[], newLines: readonly string[]): DiffLine[] => {
  const dp = computeLcs(oldLines, newLines);
  const result: DiffLine[] = [];
  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    const oldContent = oldLines[i - 1] ?? "";
    const newContent = newLines[j - 1] ?? "";

    if (i > 0 && j > 0 && oldContent === newContent) {
      result.unshift({ type: "context", content: newContent });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || getCell(dp, i, j - 1) >= getCell(dp, i - 1, j))) {
      result.unshift({ type: "add", content: newContent });
      j--;
    } else {
      result.unshift({ type: "remove", content: oldContent });
      i--;
    }
  }

  return result;
};

const CONTEXT_LINES = 3;

const groupIntoHunks = (rawDiff: readonly DiffLine[]): DiffHunk[] => {
  const hunks: DiffHunk[] = [];
  const changeIndices: number[] = [];

  for (let i = 0; i < rawDiff.length; i++) {
    const line = rawDiff[i];
    if (line !== undefined && line.type !== "context") {
      changeIndices.push(i);
    }
  }

  if (changeIndices.length === 0) {
    return [];
  }

  const firstIdx = changeIndices[0] ?? 0;
  let hunkStart = Math.max(0, firstIdx - CONTEXT_LINES);
  let hunkEnd = Math.min(rawDiff.length - 1, firstIdx + CONTEXT_LINES);

  for (let ci = 1; ci < changeIndices.length; ci++) {
    const idx = changeIndices[ci] ?? 0;
    const nextStart = Math.max(0, idx - CONTEXT_LINES);
    const nextEnd = Math.min(rawDiff.length - 1, idx + CONTEXT_LINES);

    if (nextStart <= hunkEnd + 1) {
      hunkEnd = nextEnd;
    } else {
      hunks.push(buildHunk(rawDiff, hunkStart, hunkEnd));
      hunkStart = nextStart;
      hunkEnd = nextEnd;
    }
  }

  hunks.push(buildHunk(rawDiff, hunkStart, hunkEnd));

  return hunks;
};

const buildHunk = (rawDiff: readonly DiffLine[], start: number, end: number): DiffHunk => {
  let oldLine = 1;
  let newLine = 1;

  for (let i = 0; i < start; i++) {
    const line = rawDiff[i];
    if (line === undefined) continue;
    if (line.type === "context") { oldLine++; newLine++; }
    else if (line.type === "remove") { oldLine++; }
    else { newLine++; }
  }

  const lines: DiffLine[] = rawDiff.slice(start, end + 1);

  return { startOld: oldLine, startNew: newLine, lines };
};

export const computeDiff = (oldText: string, newText: string): DiffResult => {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const rawDiff = buildRawDiff(oldLines, newLines);

  const summary: DiffSummary = {
    added: rawDiff.filter((l) => l.type === "add").length,
    removed: rawDiff.filter((l) => l.type === "remove").length,
    unchanged: rawDiff.filter((l) => l.type === "context").length,
  };

  const hunks = groupIntoHunks(rawDiff);

  return { hunks, summary };
};

const formatDiffLine = (line: DiffLine): string => {
  switch (line.type) {
    case "add":
      return color.green(`+ ${line.content}`);
    case "remove":
      return color.red(`- ${line.content}`);
    case "context":
      return color.dim(`  ${line.content}`);
  }
};

const formatHunkHeader = (hunk: DiffHunk): string => {
  const oldCount = hunk.lines.filter((l) => l.type !== "add").length;
  const newCount = hunk.lines.filter((l) => l.type !== "remove").length;

  return color.cyan(
    `@@ -${String(hunk.startOld)},${String(oldCount)} +${String(hunk.startNew)},${String(newCount)} @@`,
  );
};

export const formatDiff = (
  filePath: string,
  oldText: string,
  newText: string,
): string => {
  const diff = computeDiff(oldText, newText);
  const lines: string[] = [];

  const removed = color.red(`-${String(diff.summary.removed)} removed`);
  const added = color.green(`+${String(diff.summary.added)} added`);
  const unchanged = color.dim(`${String(diff.summary.unchanged)} unchanged`);

  lines.push(
    "",
    color.bold(`  ╭─ ${filePath}`),
    `  │ ${removed}  ${added}  ${unchanged}`,
    `  ╰${"─".repeat(40)}`,
  );

  if (diff.hunks.length === 0) {
    lines.push(color.dim("  (files are identical)"));
  }

  for (const hunk of diff.hunks) {
    lines.push(`  ${formatHunkHeader(hunk)}`);
    for (const line of hunk.lines) {
      lines.push(`  ${formatDiffLine(line)}`);
    }
  }

  lines.push("");

  return lines.join("\n");
};
