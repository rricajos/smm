# Asistente de IA

El asistente de IA es una interfaz conversacional que analiza tu buzón y propone mejoras inteligentes para la organización del correo.

## Chat conversacional

El chat incluye contexto completo del buzón en cada mensaje:

- Reglas actuales (nombres, condiciones, acciones)
- Plantillas de respuesta existentes
- Estructura de carpetas y etiquetas
- Correos recientes (hasta 30 snippets)
- Información de cuentas

Este contexto permite al AI hacer propuestas que se integran directamente con tu configuración existente.

### Conversaciones

- **Múltiples sesiones**: hasta 50 conversaciones almacenadas
- **Historial persistente**: las conversaciones se guardan en `browser.storage.local`
- **Auto-título**: la primera pregunta del usuario se usa como título
- **Renombrar/eliminar**: gestiona tus conversaciones desde el panel lateral

## Tipos de propuestas

El AI puede generar cinco tipos de propuestas, cada una con botones de **aceptar/rechazar**:

### 1. Propuestas de reglas

El AI analiza patrones en tus correos y sugiere reglas de clasificación con:

- Nombre descriptivo
- Condiciones configuradas
- Acciones recomendadas
- Nivel de confianza (0-1)
- Explicación del razonamiento

### 2. Propuestas de plantillas

Sugiere plantillas de respuesta adaptadas a tus patrones de comunicación.

### 3. Propuestas de carpetas

Propone nueva estructura de carpetas basada en el análisis de tu buzón.

### 4. Propuestas de movimiento

Sugiere mover correos de una carpeta a otra, con opción de eliminar la carpeta origen.

### 5. Propuestas de consolidación

Detecta reglas duplicadas o solapadas y propone fusionarlas en una sola regla optimizada. Incluye:

- Regla fusionada resultante
- IDs y nombres de las reglas originales
- Descripción del cambio

!!! info "Referencias cruzadas"
    Cuando el AI propone reglas nuevas y su consolidación en la misma respuesta, las referencias `NEW_RULE:NombreRegla` se resuelven automáticamente a los UUIDs generados.

## Panel rápido (Quick Panel)

Además del chat, el panel rápido ofrece acciones directas:

| Acción | Descripción |
|--------|-------------|
| **Analizar correos recientes** | Detecta patrones en los últimos correos y sugiere reglas |
| **Describir regla** | Escribe en lenguaje natural qué quieres filtrar y el AI genera la regla |
| **Análisis batch** | Analiza hasta 64 correos por lote para generar reglas masivas |

## Proveedores soportados

| Proveedor | Endpoint | Formato |
|-----------|----------|---------|
| **OpenRouter** | `openrouter.ai/api/v1/chat/completions` | OpenAI-compatible |
| **OpenAI** | `api.openai.com/v1/chat/completions` | OpenAI |
| **Anthropic** | `api.anthropic.com/v1/messages` | Anthropic |
| **Google Gemini** | `generativelanguage.googleapis.com/v1beta/openai/chat/completions` | OpenAI-compatible |
| **Custom** | Configurable | OpenAI-compatible |

### Modelos disponibles por proveedor

=== "OpenRouter"

    | Modelo | Proveedor |
    |--------|-----------|
    | GPT-4o Mini | OpenAI |
    | GPT-4o | OpenAI |
    | GPT-4.1 Nano | OpenAI |
    | GPT-4.1 Mini | OpenAI |
    | GPT-4.1 | OpenAI |
    | o4-mini | OpenAI |
    | Claude 3.5 Sonnet | Anthropic |
    | Claude 3.5 Haiku | Anthropic |
    | Claude Sonnet 4 | Anthropic |
    | Claude Opus 4 | Anthropic |
    | Gemini 2.0 Flash | Google |
    | Gemini 2.5 Flash Preview | Google |
    | Gemini 2.5 Pro Preview | Google |
    | Llama 4 Maverick | Meta |
    | Llama 4 Scout | Meta |
    | DeepSeek V3 | DeepSeek |
    | DeepSeek R1 | DeepSeek |
    | Mistral Small 3.1 | Mistral |
    | Qwen3 235B | Qwen |
    | Qwen3 30B | Qwen |

=== "OpenAI directo"

    | Modelo |
    |--------|
    | GPT-4o Mini |
    | GPT-4o |
    | GPT-4.1 Nano |
    | GPT-4.1 Mini |
    | GPT-4.1 |
    | o4-mini |

=== "Anthropic directo"

    | Modelo |
    |--------|
    | Claude 3.5 Haiku |
    | Claude 3.5 Sonnet |
    | Claude Sonnet 4 |
    | Claude Opus 4 |

=== "Google Gemini directo"

    | Modelo |
    |--------|
    | Gemini 2.0 Flash |
    | Gemini 2.5 Flash Preview |
    | Gemini 2.5 Pro Preview |

## Validación de respuestas

Las respuestas del AI se validan con schemas **Zod** para garantizar que campos malformados no crasheen la extensión. Si un campo tiene un tipo incorrecto (por ejemplo, `confidence: "high"` en vez de `0.8`), se aplica un valor por defecto automáticamente.
