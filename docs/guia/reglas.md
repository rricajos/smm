# Reglas de clasificación

Las reglas son el mecanismo principal de Smart Mail Manager para procesar correos automáticamente. Cada regla combina **condiciones** (qué correos coinciden) con **acciones** (qué hacer con ellos).

## Estructura de una regla

Cada regla tiene:

- **Nombre** — identificador descriptivo
- **Condiciones** — una o más condiciones que se evalúan contra cada correo
- **Lógica de condiciones** — `all` (AND) o `any` (OR)
- **Acciones** — una o más acciones a ejecutar cuando se cumplan las condiciones
- **Stop processing** — si se activa, detiene la evaluación de más reglas tras una coincidencia

## Condiciones

### Campos disponibles

| Campo | Descripción |
|-------|-------------|
| `from` | Dirección del remitente |
| `to` | Dirección del destinatario |
| `subject` | Asunto del correo |
| `body` | Cuerpo del mensaje |
| `hasAttachments` | Si el correo tiene adjuntos (booleano) |

### Operadores

| Operador | Descripción |
|----------|-------------|
| `contains` | El campo contiene el valor |
| `equals` | El campo es exactamente igual al valor |
| `startsWith` | El campo empieza por el valor |
| `endsWith` | El campo termina con el valor |
| `matches` | El campo coincide con una expresión regular |
| `is` | Comparación exacta (usado con booleanos) |

!!! warning "Expresiones regulares"
    El operador `matches` usa expresiones regulares de JavaScript. Patrones inválidos se ignoran silenciosamente durante la clasificación, pero el editor de reglas los valida al guardar.

### Opciones adicionales

- **Case sensitive** — si se activa, la comparación distingue mayúsculas/minúsculas
- **boolValue** — para el campo `hasAttachments`, define si se busca `true` o `false`

## Acciones

| Acción | Descripción | Requiere |
|--------|-------------|----------|
| `moveToFolder` | Mover correo a una carpeta | `folderId` |
| `addTag` | Añadir etiqueta | `tagKey` |
| `setPriority` | Cambiar prioridad | `priority` (highest/high/normal/low/lowest) |
| `markRead` | Marcar como leído | — |
| `autoRespond` | Respuesta automática | `templateId` |

Las acciones se ejecutan secuencialmente. Si una regla tiene `stopProcessing: true`, las reglas siguientes no se evalúan para ese correo.

## Lógica de evaluación

```
Correo nuevo → para cada regla habilitada (en orden):
  → Evaluar condiciones con lógica all/any
  → Si coincide:
    → Ejecutar acciones secuencialmente
    → Registrar en log de actividad
    → Si stopProcessing → detener
```

## Detección de conflictos

El sistema detecta automáticamente tres tipos de conflictos entre reglas habilitadas:

| Tipo | Severidad | Descripción |
|------|-----------|-------------|
| `contradictory_move` | :material-alert: warning | Dos reglas mueven a carpetas diferentes |
| `contradictory_priority` | :material-alert: warning | Dos reglas asignan prioridades diferentes |
| `redundant` | :material-information: info | Condiciones similares con acciones idénticas |

Los conflictos se detectan cuando las condiciones de dos reglas se solapan (mismo campo y operador con valores contenidos).

## Galería de presets

Smart Mail Manager incluye presets predefinidos para crear reglas comunes:

| Categoría | Ejemplos |
|-----------|----------|
| Newsletters | Filtrar correos con "unsubscribe" |
| Redes sociales | Facebook, Twitter, LinkedIn, Instagram |
| Finanzas | Bancos, PayPal, transferencias |
| Compras | Amazon, pedidos, envíos |
| Trabajo | Jira, GitHub, Slack, Teams |
| Notificaciones | Alertas de seguridad, verificaciones |

## Importación y exportación

Las reglas se pueden exportar e importar en formato JSON junto con plantillas y configuración. El sistema detecta conflictos por ID y nombre durante la importación, ofreciendo tres opciones:

- **Reemplazar** — sobrescribir la regla existente
- **Omitir** — mantener la existente
- **Duplicar** — crear una copia con nuevo ID

!!! tip "Detección de referencias rotas"
    Si una regla hace referencia a una carpeta, etiqueta o plantilla que ya no existe, el editor lo muestra como advertencia.
