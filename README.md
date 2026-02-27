# zero-ts

`zero-ts` creates or upgrades TypeScript projects with strong defaults.

## 30-Second Start

| I want to... | Run |
| --- | --- |
| Create a new project | `npx create-zero-ts create my-app` |
| Upgrade an existing project | `npx create-zero-ts up` |
| Check local environment | `npx create-zero-ts doctor` |

Requirements: Node `>=22` and any of `npm`, `pnpm`, `yarn`, `bun`.

## Pick a Profile

| Profile | Best for | Behavior |
| --- | --- | --- |
| `strict` | New projects | Full enforcement from start |
| `warm` | Existing codebases | Keeps type/security strict, relaxes style severity |

Defaults:
- `create` -> `strict`
- `up`/`apply` -> `warm`

Override anytime:

```bash
npx create-zero-ts up --profile warm
npx create-zero-ts create my-app --profile strict
```

## 3 Steps After `create` or `up`

```bash
npm install
npm run check
npm run quality
```

What they mean:
- `check`: fast gate (typecheck + lint + core checks)
- `quality`: full gate (`check` + coverage + dependency checks + audit)

## Command Map

| Command | Alias | What it does |
| --- | --- | --- |
| `create-zero-ts create <name>` | `zero-ts create <name>` | Scaffold a new project |
| `create-zero-ts up` | `create-zero-ts apply` | Apply template updates to current project |
| `create-zero-ts doctor` | `zero-ts doctor` | Validate node/pm/write access/git state |

`up`/`apply` are interactive by default. Use `-C <dir>` to target another folder.

## Flags at a Glance

- Common: `-y`, `-p <pm>`, `-C <dir>`
- `create`: `-d <dir>`, `-i`, `-n`, `-g`, `--profile <warm|strict>`
- `up`/`apply`: `-w`, `-d`, `-b`, `-f`, `-c`, `-k`, `-i`, `-n`, `--profile <warm|strict>`

## Merge Rules in `up`/`apply`

| File type | Strategy |
| --- | --- |
| `*.json`, `*.jsonc` | Deep merge (keep yours, add missing template keys) |
| `.gitignore`, `.npmrc`, `.npmignore`, `.dockerignore` | Line union |
| `lefthook.yml` | Merge hook keys/commands; keep your collisions with conflict comments |

## Maintainers (This Repo)

```bash
npm install
npm run sync:template
npm run check
npm run build
npm run release:check
```
