import { cancel, isCancel } from "@clack/prompts";
import process from "node:process";
import color from "picocolors";

export const exitOnCancel = <T>(value: T | symbol): T => {
  if (isCancel(value)) {
    cancel("Cancelled.");
    process.exit(0);
  }

  return value;
};

export const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
};

export const section = (title: string): void => {
  process.stdout.write(`\n${color.bold(color.cyan(title))}\n`);
};

export const info = (message: string): void => {
  process.stdout.write(`${color.cyan("[info]")} ${message}\n`);
};

export const warn = (message: string): void => {
  process.stdout.write(`${color.yellow("[warn]")} ${message}\n`);
};

export const success = (message: string): void => {
  process.stdout.write(`${color.green("[ok]")} ${message}\n`);
};

export const kv = (label: string, value: string): void => {
  process.stdout.write(`  ${color.dim(`${label}:`)} ${value}\n`);
};
