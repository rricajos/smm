# Contributing to Smart Mail Manager

Thank you for your interest in contributing!

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

# 3. Start development mode (opens Thunderbird with hot-reload)
npm run dev

# 4. Run tests
npm test
```

> **Note:** You may need to adjust the Thunderbird binary path and profile path in `package.json` if your installation differs from the default.

## Code Style

This project enforces consistent code style automatically:

- **ESLint** with TypeScript and Svelte plugins
- **Prettier** for formatting (with Svelte plugin)

```bash
npm run lint          # Check for linting issues
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
npm test              # Run all tests
npm run test:watch    # Watch mode for development
npm run test:coverage # Full coverage report
```

Guidelines:

- Add tests for new features and bug fixes
- Place test files alongside the module they test: `module.test.ts`
- Mock `browser.*` and `messenger.*` globals using `vi.stubGlobal()`
- Mock the logger to suppress output: `vi.mock('../utils/logger', ...)`

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

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
| `style` | Formatting, whitespace |
| `perf` | Performance improvement |
| `chore` | Dependencies, CI, build config |

Examples:

```
feat(rules): add regex validation on save
fix(ai): handle empty response from Anthropic
docs(readme): add installation badges
test(stores): add edge cases for chat store
chore(deps): bump vitest to 4.1.7
```

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

## Project Architecture

See the [architecture documentation](https://rricajos.github.io/smm/en/desarrollo/arquitectura/) for an overview of entry points, data flows, and module structure.

## Questions?

Open a [GitHub issue](https://github.com/rricajos/smm/issues) or reach out to the maintainer.
