# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`zero-ts` is an ultra-strict TypeScript project generator (CLI tool) focused on anti-slop defaults for AI-assisted coding. It generates new projects with strict TypeScript configurations and provides an "apply" command to retrofit existing projects with the same quality standards.

Published as `create-zero-ts` on npm, invoked via `npm create zero-ts@latest`.

## Repository Structure

This is an npm workspace monorepo with two key packages:

- **`packages/scaffold-ultra/template/`**: Source of truth for all scaffold files (tsconfig, eslint, vitest, etc.)
- **`packages/create-zero-ts/`**: Published CLI package that contains the generator logic

**Critical sync mechanism**: `scripts/sync-template.mjs` copies `scaffold-ultra/template/` → `create-zero-ts/template/` for npm publishing. This runs automatically before build/pack via prebuild/prepack hooks.

## Common Commands

### Development workflow
```bash
npm install                     # Install all workspace dependencies
npm run sync:template           # Manually sync template (auto-runs before build)
npm run check                   # Run typecheck, lint, test in create-zero-ts
npm run build                   # Build the CLI package
```

### Testing locally without publishing
```bash
npm run build -w create-zero-ts
node packages/create-zero-ts/dist/cli.js demo-app --yes --no-install
node packages/create-zero-ts/dist/cli.js apply --dry-run --yes
```

### Generated project commands
Projects created by zero-ts have these npm scripts:
- `check`: Fast gate (typecheck + lint + format:check + dead-code)
- `quality`: Full gate (check + test:coverage + deps:graph + deps:cycles + audit)
- `test`: Run tests with vitest
- `build`: Compile TypeScript
- `dead-code`: Find unused exports with knip
- `deps:graph`: Validate dependencies with dependency-cruiser
- `deps:cycles`: Detect circular dependencies with madge

## Architecture

### CLI Entry Points

**`src/cli.ts`**: Main entry point. Parses args (`src/args.ts`) and routes to:
- **`src/create-command.ts`**: Creates new project from scratch (copies template, initializes git, optionally installs)
- **`src/apply-command.ts`**: Applies template to existing project (detects conflicts, patches package.json, creates backups)

### Template System

**`src/template.ts`**: Core template operations
- Copies files from bundled template directory
- Renders package.json with project name via `__PROJECT_NAME__` placeholder
- Validates npm package names

### Apply Command Architecture

The apply command (for existing projects) uses a detect → plan → execute pipeline:

1. **`src/apply/detect.ts`**: Detects existing project state (package.json, managed files)
2. **`src/apply/plan.ts`**: Builds an `ApplyPlan` (files to create, conflicts, package.json changes)
3. **`src/apply/patchers.ts`**: Generates package.json merge plan (adds dependencies/scripts without removing existing ones)
4. **`src/apply/execute.ts`**: Executes the plan (with dry-run, backup, force options)

### Strict TypeScript Philosophy

Generated projects enforce extreme type safety:

**tsconfig.json flags**: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `skipLibCheck: false`

**ESLint anti-escape rules** (see `packages/scaffold-ultra/template/eslint.config.mjs`):
- `no-explicit-any`, `no-unsafe-*` as errors
- `ban-ts-comment` with 10-char minimum descriptions
- No chained assertions (`value as unknown as T`)
- `process.env` access restricted to `src/env.ts`
- Complexity limits: max 10 cyclomatic, max 3 depth, max 4 params

**Runtime validation pattern**: All environment variables must be validated through `src/env.ts` using Zod with `.safeParse()` on unknown input.

## Key Implementation Details

- **Package manager detection**: `src/package-manager.ts` detects npm/pnpm/yarn/bun from lockfiles
- **Interactive prompts**: Uses `@clack/prompts` with `exitOnCancel` wrapper
- **CLI flags**: Support for `--yes`, `--dry-run`, `--force`, `--backup`, `--no-install`
- **Template sync**: MUST run `sync:template` before building to ensure CLI bundles latest scaffold
- **Node requirement**: Requires Node.js >= 22

## Testing

- Uses Vitest for all tests
- Test files: `*.test.ts` in `packages/create-zero-ts/src/`
- Key test suites: `args.test.ts`, `template.test.ts`, `apply/patchers.test.ts`, `apply/plan.test.ts`

## Important Constraints

- **Never modify** `packages/scaffold-ultra/template/` without running `npm run sync:template`
- **Package.json patching** must preserve user's existing fields (see `patchers.ts`)
- **ESLint config** enforces kebab-case filenames, but allows `.test.ts` and config files
- **All TypeScript code** must have explicit return types and pass strict type checking
