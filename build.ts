import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, watch as fsWatch } from 'fs';

const __dirname = import.meta.dirname;
const watchMode = process.argv.includes('--watch');

const entries = [
  { name: 'popup', entry: 'src/popup/main.ts' },
  { name: 'space', entry: 'src/space/main.ts' },
  { name: 'options', entry: 'src/options/main.ts' },
  { name: 'background', entry: 'src/background/index.ts' },
];

function bumpManifestVersion(): string {
  const manifestPath = resolve(__dirname, 'public/manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const parts = manifest.version.split('.').map(Number);

  // Bump patch version
  parts[2] = (parts[2] || 0) + 1;
  manifest.version = parts.join('.');

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return manifest.version;
}

function getManifestVersion(): string {
  const manifestPath = resolve(__dirname, 'public/manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  return manifest.version;
}

async function buildAll(bump: boolean) {
  const distDir = resolve(__dirname, 'dist');

  // Clean dist
  if (existsSync(distDir)) rmSync(distDir, { recursive: true });
  mkdirSync(distDir, { recursive: true });

  // Bump version only on first build
  const version = bump ? bumpManifestVersion() : getManifestVersion();
  console.log(`\n[SMM] Version: ${version}`);

  // Copy public files (manifest, icons, background.html) to dist root
  cpSync(resolve(__dirname, 'public'), distDir, { recursive: true });

  for (const entry of entries) {
    const isUI = entry.name !== 'background';

    console.log(`Building ${entry.name}...`);

    await build({
      configFile: false,
      plugins: isUI ? [svelte({ configFile: resolve(__dirname, 'svelte.config.js') })] : [],
      root: __dirname,
      publicDir: false,
      logLevel: 'warn',
      build: {
        outDir: distDir,
        emptyOutDir: false,
        lib: {
          entry: resolve(__dirname, entry.entry),
          formats: ['iife'],
          name: `SMM_${entry.name}`,
          fileName: () => `${entry.name}.js`,
        },
        cssCodeSplit: false,
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
            assetFileNames: `${entry.name}.[ext]`,
          },
        },
      },
    });

    if (isUI) {
      writeFileSync(
        resolve(distDir, `${entry.name}.html`),
        `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Smart Mail Manager</title>
  <link rel="stylesheet" href="${entry.name}.css">
</head>
<body>
  <div id="app"></div>
  <script src="${entry.name}.js"></script>
</body>
</html>`,
      );
    }
  }

  console.log('[SMM] Build complete!\n');
}

async function main() {
  // Bump version only on the initial build
  await buildAll(true);

  if (watchMode) {
    console.log('[SMM] Watching for changes in src/ and public/...');
    let buildTimeout: ReturnType<typeof setTimeout> | null = null;
    let building = false;

    const rebuild = () => {
      if (buildTimeout) clearTimeout(buildTimeout);
      buildTimeout = setTimeout(async () => {
        if (building) return;
        building = true;
        console.log('\n[SMM] Change detected, rebuilding...');
        try {
          // Don't bump version on rebuilds
          await buildAll(false);
        } catch (err) {
          console.error('[SMM] Build error:', err);
        }
        building = false;
      }, 300);
    };

    // Watch src/ directory only (not public/ to avoid manifest.json loops)
    fsWatch(resolve(__dirname, 'src'), { recursive: true }, (_event, filename) => {
      if (filename && !filename.includes('node_modules')) {
        rebuild();
      }
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
