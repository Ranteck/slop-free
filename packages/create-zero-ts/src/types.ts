export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;

export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export interface CliOptions {
  readonly projectName?: string;
  readonly targetDir?: string;
  readonly packageManager?: PackageManager;
  readonly install?: boolean;
  readonly yes: boolean;
  readonly skipGit: boolean;
}
