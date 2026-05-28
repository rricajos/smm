# Contributing

!!! note "Source"
    This page mirrors [CONTRIBUTING.md](https://github.com/rricajos/smm/blob/master/CONTRIBUTING.md) in the repository.

## Prerequisites

- Node.js 20+
- Thunderbird 128+ installed
- An AI provider API key (for testing AI features)

## Development Setup

```bash
# 1. Fork and clone the repository
git clone https://github.com/<your-username>/smm.git
cd smm

# 2. Install dependencies
npm install

# 3. Development mode (opens Thunderbird with hot-reload)
npm run dev

# 4. Run tests
npm test
```

!!! tip
    You may need to adjust the Thunderbird binary path and profile path in `package.json` if your installation differs from the default.

## Code Style

The project enforces consistent code style automatically:

- **ESLint** with TypeScript and Svelte plugins
- **Prettier** for formatting (with Svelte plugin)

```bash
npm run lint          # Check linting
npm run format:check  # Check formatting
npm run format        # Auto-fix formatting
```

CI will reject PRs that fail lint or format checks.

## Testing Requirements

All PRs must maintain the coverage thresholds defined in `vitest.config.ts`:

| Metric | Threshold |
|--------|-----------|
| Statements | 93% |
| Branches | 87% |
| Functions | 95% |
| Lines | 94% |

```bash
npm test              # Run tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

**Guidelines:**

- Add tests for new features and bug fixes
- Place test files alongside the module: `module.test.ts`
- Mock `browser.*` and `messenger.*` using `vi.stubGlobal()`

## Commit Convention

The project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

| Type | Purpose |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `refactor` | Code change with no behavior change |
| `chore` | Dependencies, CI, build config |

## Pull Request Process

1. Create a feature branch from `master`
2. Make your changes with appropriate tests
3. Ensure all checks pass locally:
   ```bash
   npm run lint && npm run format:check && npx tsc --noEmit && npm test
   ```
4. Push and open a PR against `master`
5. Fill out the PR template
6. Wait for CI to pass and a maintainer review
