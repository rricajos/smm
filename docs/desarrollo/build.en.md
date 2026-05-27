# Build system

## Overview

Smart Mail Manager uses a custom build script (`build.ts`) instead of Vite's standard configuration. This is necessary because Thunderbird MailExtensions require self-contained IIFE bundles, not ES modules.

## build.ts

The script compiles 4 independent entry points:

```typescript
const entries = [
  { name: 'popup',     entry: 'src/popup/main.ts' },
  { name: 'space',     entry: 'src/space/main.ts' },
  { name: 'options',   entry: 'src/options/main.ts' },
  { name: 'background', entry: 'src/background/index.ts' },
];
```

### Build process

1. **Cleans `dist/`** — removes the previous output directory
2. **Bumps version** — increments the patch version in `manifest.json` (first build only)
3. **Copies `public/`** — static files (manifest, icons, background.html) to `dist/`
4. **Compiles each entry point** — using Vite's programmatic API:
    - Format: IIFE (Immediately Invoked Function Expression)
    - Svelte plugin for UI entry points
    - Inline CSS per entry point (no code split)
    - `inlineDynamicImports: true` for a single bundle
5. **Generates HTML** — for each UI entry point (popup, space, options)

### Automatic versioning

Each build increments the patch version in `manifest.json`:

```
1.5.96 → 1.5.97 → 1.5.98 ...
```

In watch mode, only the first build increments the version.

## npm scripts

| Command | Description |
|---------|-------------|
| `npm run build` | `node --import=tsx build.ts` — production build |
| `npm run watch` | `node --import=tsx build.ts --watch` — auto rebuild |
| `npm run dev` | Build + watch + `web-ext run` with Thunderbird |
| `npm run package` | Build + `web-ext build` → `smart-mail-manager.xpi` |

## Watch mode

Watch mode observes changes in `src/` and recompiles automatically:

- Uses `fs.watch()` with recursive detection
- 300ms debounce to prevent multiple builds
- Does not increment version on rebuilds
- Ignores files in `node_modules/`

## Build dependencies

| Package | Usage |
|---------|-------|
| `vite` | Programmatic build API |
| `@sveltejs/vite-plugin-svelte` | Svelte component compilation |
| `tsx` | Run build.ts directly (TypeScript → Node) |
| `web-ext` | Dev server and XPI packaging |
| `concurrently` | Run watch + web-ext in parallel |

## Svelte configuration

`svelte.config.js` configures the Svelte preprocessor. Vite integration is done via the `@sveltejs/vite-plugin-svelte` plugin.

## TypeScript configuration

`tsconfig.json` defines:

- Path aliases: `$lib/*` → `src/lib/*`, `$types/*` → `src/types/*`
- `strict: true`
- Target: ESNext
- Module: ESNext
