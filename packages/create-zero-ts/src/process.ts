import process from "node:process";
import spawn from "cross-spawn";

export const runCommand = (
  command: string,
  args: readonly string[],
  cwd: string,
  stdio: "inherit" | "ignore",
): void => {
  const result = spawn.sync(command, [...args], {
    cwd,
    stdio,
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
};
