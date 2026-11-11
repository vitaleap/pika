# Contributing

[简体中文](./CONTRIBUTING.md) | English

Thanks for your interest in Pika. This document covers local development, commit conventions, and the check workflow.

## Requirements

- [Bun](https://bun.com) 1.4+

## Local development

```bash
# Install dependencies
bun install

# Start server and web together
bun run dev
```

- Web: http://localhost:9527
- Server: http://localhost:9528
- OpenAPI docs: http://localhost:9528/api/openapi

Local development uses PGlite by default and stores data in `.tmp/`, so no separate database is needed. For custom configuration, copy `apps/server/.env.example` to `apps/server/.env.local` and edit it.

## Checks before committing

```bash
bun run lint    # Prettier formatting
bun run check   # Type checking
bun run test    # Tests
```

All of these must pass. CI runs the same checks on every pull request.

## Commit convention

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) and are validated by commitlint in the `commit-msg` hook:

```ini
feat: new feature
fix: bug fix
docs: documentation changes
refactor: refactoring (no behavior change)
test: test-related changes
chore: build, dependencies, and other chores
```

The `pre-commit` hook runs lint-staged on staged files. Please do not bypass it with `--no-verify`.

## Pull requests

1. Branch off `main`; names like `feat/xxx` or `fix/xxx` are recommended
2. Keep the change focused — one PR should solve one problem
3. Explain the background, the changes, and how you verified them in the PR description
4. Add or update tests when behavior changes

## Code conventions

- Use TypeScript throughout and avoid `any`
- Read the guidelines of the directory you touch: `apps/server/AGENTS.md`, `apps/web/AGENTS.md`, `packages/AGENTS.md`
- Reusable capabilities belong in `packages/*`; business code should only add thin wrappers
- Comments and documentation may be written in Chinese or English
- Commit messages must be in English

## Security

Please do not report security vulnerabilities through public issues. See [SECURITY.en.md](./SECURITY.en.md).
