import process from "node:process";
import { spawnSync } from "node:child_process";

const spawnOptions = {
  shell: process.platform === "win32",
  stdio: "inherit",
};

const gitProbe = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
  ...spawnOptions,
  stdio: "ignore",
});

if (gitProbe.error || gitProbe.status !== 0) {
  process.exit(0);
}

const result = spawnSync("lefthook", ["install"], spawnOptions);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
