# Plantillas de respuesta

Las plantillas permiten definir respuestas automáticas que se envían cuando una regla con acción `autoRespond` coincide con un correo.

## Estructura de una plantilla

| Campo | Descripción |
|-------|-------------|
| `name` | Nombre identificativo |
| `subject` | Asunto de la respuesta (soporta variables) |
| `body` | Cuerpo de la respuesta (soporta variables) |
| `isPlainText` | `true` = texto plano, `false` = HTML |
| `sendMode` | Modo de envío |
| `replyType` | Tipo de respuesta |

### Modos de envío

| Modo | Descripción |
|------|-------------|
| `draft` | Crea un borrador para revisión manual |
| `sendNow` | Envía inmediatamente |
| `sendLater` | Programa el envío en la bandeja de salida |

### Tipos de respuesta

| Tipo | Descripción |
|------|-------------|
| `replyToSender` | Responde solo al remitente |
| `replyToAll` | Responde a todos los destinatarios |

## Variables dinámicas

Las plantillas soportan variables con la sintaxis `{{nombre_variable}}` que se sustituyen con datos del correo original:

| Variable | Ejemplo | Descripción |
|----------|---------|-------------|
| `{{sender_name}}` | Juan García | Nombre del remitente |
| `{{sender_email}}` | juan@example.com | Email del remitente |
| `{{to}}` | ricard@conexiatec.com | Destinatario |
| `{{subject}}` | Re: Presupuesto | Asunto original |
| `{{date}}` | 18/05/2026 | Fecha actual |
| `{{time}}` | 14:30 | Hora actual |
| `{{day_of_week}}` | Lunes | Día de la semana |
| `{{original_body}}` | *(texto completo)* | Cuerpo completo del correo original |
| `{{original_body_snippet}}` | *(primeras líneas)* | Primeras líneas del cuerpo |
| `{{my_name}}` | Ricard Penin | Nombre del usuario (de la cuenta) |
| `{{my_email}}` | ricard@conexiatec.com | Email del usuario (de la cuenta) |

!!! note "Variables legacy"
    También se soportan las variables `{{senderName}}`, `{{senderEmail}}`, `{{originalSubject}}` por retrocompatibilidad.

### Ejemplo de plantilla

**Asunto:**
```
Re: {{subject}}
```

**Cuerpo:**
```
Hola {{sender_name}},

Gracias por tu correo. He recibido tu mensaje sobre "{{subject}}"
y te responderé lo antes posible.

Un saludo,
{{my_name}}
```

## Vista previa

El editor de plantillas incluye una vista previa en tiempo real que muestra cómo se verá la respuesta con valores de ejemplo.

## Rate limiting

Las respuestas automáticas están limitadas por la configuración `maxAutoResponsesPerHour` en los ajustes. Por defecto se permiten 10 respuestas automáticas por hora para evitar bucles.

## Flujo de auto-respuesta

```
Acción autoRespond activada
  → Verificar rate limit (maxAutoResponsesPerHour)
  → Cargar plantilla por templateId
  → Sustituir {{variables}} con datos del mensaje
  → Según sendMode:
    - draft → crear borrador
    - sendNow → enviar inmediatamente
    - sendLater → programar envío
```
