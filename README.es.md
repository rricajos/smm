# Smart Mail Manager

[![CI](https://github.com/rricajos/smm/actions/workflows/ci.yml/badge.svg)](https://github.com/rricajos/smm/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-97%25-brightgreen)](https://github.com/rricajos/smm)
[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-blue.svg)](https://mozilla.org/MPL/2.0/)
[![Thunderbird 128+](https://img.shields.io/badge/Thunderbird-128%2B-blue?logo=thunderbird)](https://www.thunderbird.net/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Svelte](https://img.shields.io/badge/Svelte-5-orange?logo=svelte)](https://svelte.dev/)

> [Read in English](README.md)

Extensión para Thunderbird que clasifica correos automáticamente y genera respuestas mediante reglas configurables, plantillas y un asistente de IA.

## Características principales

- **Clasificación por reglas** — condiciones combinables (AND/OR) con acciones: mover a carpeta, etiquetar, cambiar prioridad, marcar leído, auto-responder
- **Plantillas de respuesta** — variables dinámicas `{{}}`, modos de envío (borrador / enviar ahora / enviar después), vista previa en tiempo real
- **Asistente de IA** — chat conversacional con contexto completo del buzón; propone reglas, plantillas, carpetas y consolidación de reglas
- **5 proveedores de IA** — OpenRouter, OpenAI, Anthropic, Google Gemini, y cualquier endpoint compatible con OpenAI (Ollama, LM Studio, vLLM)
- **Panel de control** — dashboard con estadísticas, log de actividad con filtros y exportación CSV, búsqueda global (Ctrl+K), importación/exportación de configuración
- **Bilingüe** — interfaz completa en español e inglés con más de 540 claves de traducción

## Inicio rápido

1. **Clonar e instalar**
   ```bash
   git clone https://github.com/rricajos/smm.git
   cd smm && npm install
   ```
2. **Modo desarrollo** (abre Thunderbird con hot-reload)
   ```bash
   npm run dev
   ```
3. **Instalación en producción**
   ```bash
   npm run package
   ```
   Luego en Thunderbird: Herramientas > Complementos > icono de engranaje > Instalar desde archivo > seleccionar `smart-mail-manager.xpi`.
4. **Configurar** — abrir las opciones de la extensión, seleccionar el proveedor de IA e introducir tu API key.

## Stack técnico

| Tecnología | Versión | Uso |
|------------|---------|-----|
| Svelte | 5.x | UI con runes (`$state`, `$derived`, `$effect`) |
| TypeScript | 6.x | Tipado estricto en todo el proyecto |
| Vite | 8.x | Build programático con 4 entry points IIFE |
| Vitest | 4.x | 917 tests, 97% cobertura de statements |
| Zod | 4.x | Validación runtime de respuestas AI |

## Estructura del proyecto

```
src/
  background/    # Service worker: clasificador, autoresponder, operaciones de carpetas
  lib/
    components/  # Componentes Svelte 5 compartidos
    i18n/        # Internacionalización (540+ claves, es/en)
    services/    # Integración con proveedores de IA + schemas Zod
    stores/      # Stores reactivos sincronizados con browser.storage
    utils/       # Motor de plantillas, detección de conflictos, búsqueda, CSV
  space/         # Panel principal (dashboard, reglas, plantillas, chat IA, log)
  popup/         # Popup de la extensión
  options/       # Página de opciones
  types/         # Definiciones de tipos TypeScript
```

> La documentación completa de arquitectura con flujos de datos y descripción de entry points está disponible en la [documentación de arquitectura](https://rricajos.github.io/smm/desarrollo/arquitectura/).

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run build` | Build de producción en `dist/` |
| `npm run dev` | Build + watch + servidor de desarrollo Thunderbird |
| `npm test` | Ejecutar 917 tests unitarios |
| `npm run test:coverage` | Reporte de cobertura (umbrales: 93/87/95/94) |
| `npm run lint` | Verificación ESLint |
| `npm run format:check` | Verificación Prettier |
| `npm run package` | Build + empaquetado como `.xpi` |

## Documentación

La documentación completa está disponible en **[rricajos.github.io/smm](https://rricajos.github.io/smm/)** — incluyendo guías de instalación, configuración de reglas y plantillas, uso del asistente IA, arquitectura para desarrolladores y referencia de API.

## Contribuir

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para la configuración del entorno de desarrollo, estilo de código, requisitos de testing y proceso de PR.

## Licencia

[Mozilla Public License 2.0](https://mozilla.org/MPL/2.0/) — ver [LICENSE](LICENSE) para más detalles.

Copyright (c) 2026 Ricard Penin Honrubia

## Privacidad

Smart Mail Manager procesa el contenido de los correos localmente y envía datos a servicios externos de IA **únicamente** cuando el usuario utiliza las funcionalidades de IA de forma explícita. No se almacenan datos en servidores externos. Las claves API son gestionadas localmente por el usuario. Consulta el [aviso de privacidad completo](https://rricajos.github.io/smm/privacidad/).
