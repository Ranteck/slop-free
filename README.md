# zero-ts

`zero-ts` is an ultra-strict TypeScript project generator focused on anti-slop defaults for AI-assisted coding.

## Use

```bash
npm create zero-ts@latest my-app
```

For existing projects:

```bash
npx create-zero-ts apply
```

`apply` now runs as a guided installer: it shows plan details, asks how to handle conflicting files (`review`, `skip`, `overwrite`), and can create backups before overwriting.

Explicit wizard mode (same interactive behavior, explicit intent):

```bash
npx create-zero-ts apply --wizard
```

Safe non-interactive mode:

```bash
npx create-zero-ts apply --yes
```

Force overwrite mode:

```bash
npx create-zero-ts apply --yes --force --backup
```

If you installed the package globally, you can also run:

```bash
zero-ts apply
```

Also works with:

```bash
pnpm create zero-ts my-app
yarn create zero-ts my-app
bun create zero-ts my-app
```

## What it generates

- Strict TypeScript (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`)
- ESLint flat config with anti-escape rules (`no any`, controlled `ts-expect-error`, no chained assertions)
- Runtime validation with `zod` (`src/env.ts` + unknown-input parse pattern)
- Non-destructive quality aliases (`zero:check`, `zero:quality`) for existing projects
- Optional GitHub Actions quality workflow (`.github/workflows/quality.yml`)
- `.zero-ts.json` manifest with applied `create-zero-ts` version
- Quality gates:
  - Fast gate: format, lint, typecheck
  - Full gate: tests + coverage, dead code, dependency rules, circular checks, audit

Node-first defaults: `src/env.ts` uses `process.env`. For browser-only apps, adapt env access to your bundler.

## Repository layout

- `packages/scaffold-ultra/template`: source-of-truth scaffold files
- `packages/create-zero-ts`: published CLI package (`create-zero-ts`)
- `scripts/sync-template.mjs`: syncs scaffold into CLI package for npm publishing

## Local development

```bash
npm install
npm run sync:template
npm run check
npm run build
```

To test locally without publishing:

```bash
npm run build -w create-zero-ts
node packages/create-zero-ts/dist/cli.js demo-app --yes --no-install
node packages/create-zero-ts/dist/cli.js apply --dry-run --yes
```
