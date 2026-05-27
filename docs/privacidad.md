# Privacidad y descargo de responsabilidad

## Aviso de privacidad

Smart Mail Manager procesa contenido de correos electrónicos (remitente, asunto, fragmentos del cuerpo) y lo envía a servicios externos de inteligencia artificial cuando el usuario utiliza las funcionalidades de IA. Esta comunicación se realiza exclusivamente bajo demanda del usuario y nunca de forma automática en segundo plano sin su consentimiento.

- Los datos se transmiten únicamente al proveedor de IA configurado por el usuario.
- No se almacenan datos en servidores propios; toda la persistencia es local (`browser.storage.local`).
- Las claves API son proporcionadas y gestionadas por el usuario.
- El usuario es responsable de revisar las políticas de privacidad del proveedor de IA que elija.

### Proveedores y sus políticas

| Proveedor | Política de privacidad |
|-----------|----------------------|
| OpenRouter | [openrouter.ai/privacy](https://openrouter.ai/privacy) |
| OpenAI | [openai.com/privacy](https://openai.com/privacy) |
| Anthropic | [anthropic.com/privacy](https://www.anthropic.com/privacy) |
| Google | [ai.google.dev/terms](https://ai.google.dev/terms) |

### Permisos de la extensión

| Permiso | Uso |
|---------|-----|
| `messagesRead` | Leer contenido de correos para clasificar |
| `messagesMove` | Mover correos a carpetas según reglas |
| `messagesUpdate` | Cambiar prioridad y marcar como leído |
| `messagesTags` | Añadir etiquetas a correos |
| `accountsRead` | Listar cuentas y carpetas del usuario |
| `accountsFolders` | Crear carpetas nuevas (propuestas del AI) |
| `compose` / `compose.send` / `compose.save` | Crear borradores y enviar respuestas automáticas |
| `storage` | Persistir configuración, reglas, plantillas y logs |
| `notifications` | Notificar clasificaciones y respuestas |

## Descargo de responsabilidad

Este software se proporciona "tal cual", sin garantías de ningún tipo, expresas o implícitas. En ningún caso el autor será responsable de daños derivados del uso de este software, incluyendo pero no limitado a:

- Pérdida o clasificación incorrecta de correos electrónicos.
- Envío de respuestas automáticas no deseadas.
- Costes derivados del uso de APIs de terceros.
- Pérdida de datos o interrupciones del servicio.

El usuario asume la totalidad del riesgo en cuanto a la calidad y rendimiento del software.
