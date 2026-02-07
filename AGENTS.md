# Repository Guidelines

## Project Structure & Module Organization
This repository is a workspace for a TypeScript project generator.
- `packages/scaffold-ultra/template/`: source-of-truth template files copied into new projects.
- `packages/create-zero-ts/`: CLI package published as `create-zero-ts` (`npm create zero-ts`).
- `scripts/sync-template.mjs`: syncs the scaffold into `packages/create-zero-ts/template` before build/publish.
- `Docs/`: planning and prompt notes.

Keep generated-project rules inside `packages/scaffold-ultra/template`, not directly in the CLI logic.

## Build, Test, and Development Commands
- `npm install`: install workspace dependencies.
- `npm run sync:template`: copy scaffold files into the CLI package.
- `npm run build`: build `create-zero-ts` with `tsup`.
- `npm run typecheck`: run strict TypeScript checks for the CLI package.
- `npm run lint`: run ESLint on CLI source.
- `npm run test`: run CLI unit tests (Vitest).
- `npm run check`: run typecheck + lint + tests.

Local smoke test:
- `node packages/create-zero-ts/dist/cli.js demo --yes --no-install`
- `node packages/create-zero-ts/dist/cli.js apply --dry-run --yes`

## Coding Style & Naming Conventions
- TypeScript ESM everywhere (`"type": "module"`).
- Strict typing required; avoid `any`.
- Keep CLI code in `packages/create-zero-ts/src` with small focused modules (`args.ts`, `template.ts`, etc.).
- Use clear, imperative script names (`sync:template`, `deps:cycles`).

## Testing Guidelines
- Framework: Vitest (`packages/create-zero-ts/vitest.config.ts`).
- Test files: `*.test.ts` alongside source in `packages/create-zero-ts/src/`.
- Add tests for argument parsing, path handling, and template rendering helpers when behavior changes.

## Commit & Pull Request Guidelines
No mature commit convention exists yet; use Conventional Commits (`feat:`, `fix:`, `chore:`) with imperative summaries.

PRs should include:
- What changed (`scaffold`, `CLI`, or both).
- Why it changed (user-facing impact).
- Validation evidence (`npm run check`, plus one local scaffold run).
