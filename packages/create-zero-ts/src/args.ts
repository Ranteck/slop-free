import { PACKAGE_MANAGERS, type CliOptions, type PackageManager } from "./types.js";

const parsePackageManager = (value: string): PackageManager => {
  if (PACKAGE_MANAGERS.includes(value as PackageManager)) {
    return value as PackageManager;
  }

  throw new Error(`Unsupported package manager: ${value}`);
};

export const parseCliArgs = (argv: readonly string[]): CliOptions => {
  let projectName: string | undefined;
  let targetDir: string | undefined;
  let packageManager: PackageManager | undefined;
  let install: boolean | undefined;
  let yes = false;
  let skipGit = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      continue;
    }

    if (!token.startsWith("-")) {
      if (projectName === undefined) {
        projectName = token;
      }
      continue;
    }

    if (token === "--yes" || token === "-y") {
      yes = true;
      continue;
    }

    if (token === "--install") {
      install = true;
      continue;
    }

    if (token === "--no-install") {
      install = false;
      continue;
    }

    if (token === "--skip-git") {
      skipGit = true;
      continue;
    }

    if (token.startsWith("--pm=")) {
      packageManager = parsePackageManager(token.split("=")[1] ?? "");
      continue;
    }

    if (token === "--pm") {
      packageManager = parsePackageManager(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (token.startsWith("--dir=")) {
      targetDir = token.split("=")[1];
      continue;
    }

    if (token === "--dir") {
      targetDir = argv[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return {
    projectName,
    targetDir,
    packageManager,
    install,
    yes,
    skipGit,
  };
};
