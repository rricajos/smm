# Sistema de build

## Visión general

Smart Mail Manager usa un script de build custom (`build.ts`) en lugar de la configuración estándar de Vite. Esto es necesario porque Thunderbird MailExtensions requieren bundles IIFE autocontenidos, no módulos ES.

## build.ts

El script compila 4 entry points independientes:

```typescript
const entries = [
  { name: 'popup',     entry: 'src/popup/main.ts' },
  { name: 'space',     entry: 'src/space/main.ts' },
  { name: 'options',   entry: 'src/options/main.ts' },
  { name: 'background', entry: 'src/background/index.ts' },
];
```

### Proceso de build

1. **Limpia `dist/`** — elimina el directorio de salida anterior
2. **Bumps versión** — incrementa el patch version en `manifest.json` (solo en el primer build)
3. **Copia `public/`** — archivos estáticos (manifest, icons, background.html) a `dist/`
4. **Compila cada entry point** — usando la API programática de Vite:
    - Formato: IIFE (Immediately Invoked Function Expression)
    - Plugin Svelte para entry points con UI
    - CSS inline por entry point (no code split)
    - `inlineDynamicImports: true` para bundle único
5. **Genera HTML** — para cada UI entry point (popup, space, options)

### Versionado automático

Cada build incrementa el patch version en `manifest.json`:

```
1.5.96 → 1.5.97 → 1.5.98 ...
```

En modo watch, solo el primer build incrementa la versión.

## Scripts npm

| Comando | Descripción |
|---------|-------------|
| `npm run build` | `node --import=tsx build.ts` — build de producción |
| `npm run watch` | `node --import=tsx build.ts --watch` — rebuild automático |
| `npm run dev` | Build + watch + `web-ext run` con Thunderbird |
| `npm run package` | Build + `web-ext build` → `smart-mail-manager.xpi` |

## Modo watch

El modo watch observa cambios en `src/` y recompila automáticamente:

- Usa `fs.watch()` con detección recursiva
- Debounce de 300ms para evitar builds múltiples
- No incrementa la versión en rebuilds
- Ignora archivos en `node_modules/`

## Dependencias de build

| Paquete | Uso |
|---------|-----|
| `vite` | API programática de build |
| `@sveltejs/vite-plugin-svelte` | Compilación de componentes Svelte |
| `tsx` | Ejecutar build.ts directamente (TypeScript → Node) |
| `web-ext` | Dev server y empaquetado XPI |
| `concurrently` | Ejecutar watch + web-ext en paralelo |

## Configuración de Svelte

`svelte.config.js` configura el preprocesador de Svelte. La integración con Vite se hace via el plugin `@sveltejs/vite-plugin-svelte`.

## Configuración de TypeScript

`tsconfig.json` define:

- Path aliases: `$lib/*` → `src/lib/*`, `$types/*` → `src/types/*`
- `strict: true`
- Target: ESNext
- Module: ESNext
