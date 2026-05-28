# Contribuir

!!! note "Fuente"
    Esta página refleja el contenido de [CONTRIBUTING.md](https://github.com/rricajos/smm/blob/master/CONTRIBUTING.md) en el repositorio.

## Requisitos previos

- Node.js 20+
- Thunderbird 128+ instalado
- Clave API de un proveedor de IA (para probar funcionalidades de IA)

## Configuración del entorno

```bash
# 1. Fork y clonar el repositorio
git clone https://github.com/<tu-usuario>/smm.git
cd smm

# 2. Instalar dependencias
npm install

# 3. Modo desarrollo (abre Thunderbird con hot-reload)
npm run dev

# 4. Ejecutar tests
npm test
```

!!! tip
    Puede que necesites ajustar las rutas de Thunderbird y del perfil en `package.json` si tu instalación difiere de la predeterminada.

## Estilo de código

El proyecto aplica un estilo consistente de forma automática:

- **ESLint** con plugins de TypeScript y Svelte
- **Prettier** para formateo (con plugin de Svelte)

```bash
npm run lint          # Verificar linting
npm run format:check  # Verificar formateo
npm run format        # Auto-corregir formateo
```

El CI rechaza PRs que no pasen las verificaciones de lint o formato.

## Requisitos de testing

Todos los PRs deben mantener los umbrales de cobertura definidos en `vitest.config.ts`:

| Métrica | Umbral |
|---------|--------|
| Statements | 93% |
| Branches | 87% |
| Functions | 95% |
| Lines | 94% |

```bash
npm test              # Ejecutar tests
npm run test:watch    # Modo watch
npm run test:coverage # Reporte de cobertura
```

**Directrices:**

- Añadir tests para features nuevas y correcciones de bugs
- Colocar archivos de test junto al módulo: `modulo.test.ts`
- Mockear `browser.*` y `messenger.*` con `vi.stubGlobal()`

## Convención de commits

El proyecto usa [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<ámbito>): <descripción>
```

| Tipo | Propósito |
|------|-----------|
| `feat` | Feature nueva |
| `fix` | Corrección de bug |
| `docs` | Solo documentación |
| `test` | Añadir o actualizar tests |
| `refactor` | Cambio sin modificar comportamiento |
| `chore` | Dependencias, CI, configuración de build |

## Proceso de Pull Request

1. Crear rama desde `master`
2. Realizar cambios con tests apropiados
3. Verificar que todo pasa localmente:
   ```bash
   npm run lint && npm run format:check && npx tsc --noEmit && npm test
   ```
4. Push y abrir PR contra `master`
5. Rellenar la plantilla de PR
6. Esperar a que CI pase y revisión del mantenedor
