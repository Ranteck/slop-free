export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;

export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export type CliCommand = "create" | "apply";

interface BaseCliOptions {
  readonly command: CliCommand;
  readonly packageManager?: PackageManager;
  readonly install?: boolean;
  readonly yes: boolean;
}

export interface CreateCliOptions extends BaseCliOptions {
  readonly command: "create";
  readonly projectName?: string;
  readonly targetDir?: string;
  readonly skipGit: boolean;
}

export interface ApplyCliOptions extends BaseCliOptions {
  readonly command: "apply";
  readonly cwd?: string;
  readonly dryRun: boolean;
  readonly runChecks?: boolean;
  readonly backup: boolean;
  readonly force: boolean;
}

export type CliOptions = CreateCliOptions | ApplyCliOptions;
