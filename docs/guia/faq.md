# FAQ / Solución de problemas

## Instalación

??? question "Thunderbird dice que la extensión no es compatible"
    Smart Mail Manager requiere Thunderbird 128 o posterior. Verifica tu versión en Ayuda > Acerca de Thunderbird. Si necesitas actualizar, descarga la última versión desde [thunderbird.net](https://www.thunderbird.net/).

??? question "`npm run dev` no abre Thunderbird"
    Las rutas de Thunderbird y del perfil en `package.json` deben coincidir con tu instalación. Edita los argumentos `--firefox` y `--firefox-profile` en el script `dev`. En Windows, la ruta típica es `C:\Program Files\Mozilla Thunderbird\thunderbird.exe`.

??? question "El build falla con errores de TypeScript"
    Asegúrate de tener Node.js 20+ y ejecuta `npm install` para actualizar dependencias. Si el error persiste, prueba borrando `node_modules` y reinstalando:
    ```bash
    rm -rf node_modules
    npm install
    npm run build
    ```

## Asistente de IA

??? question "Error 'API key invalid' o '401 Unauthorized'"
    Verifica que tu clave API esté correctamente introducida en Opciones sin espacios extra. Cada proveedor tiene un formato distinto:

    - **OpenRouter:** empieza por `sk-or-...`
    - **OpenAI:** empieza por `sk-...`
    - **Anthropic:** empieza por `sk-ant-...`
    - **Google Gemini:** empieza por `AIza...`

??? question "El AI no responde o da timeout"
    - Verifica tu conexión a internet
    - Comprueba el estado del proveedor (ej. [status.openai.com](https://status.openai.com))
    - Si usas un modelo de razonamiento (DeepSeek R1, o4-mini), estos pueden tardar más
    - Prueba con un modelo más rápido (GPT-4o Mini, Claude 3.5 Haiku, Gemini Flash)

??? question "¿Puedo usar un modelo local (Ollama, LM Studio)?"
    Sí. Selecciona **Custom** como proveedor y escribe la URL de tu servidor local, por ejemplo:

    - Ollama: `http://localhost:11434/v1/chat/completions`
    - LM Studio: `http://localhost:1234/v1/chat/completions`

    La extensión pedirá permiso para conectarse a URLs locales la primera vez.

??? question "Las propuestas del AI no aparecen como botones de aceptar/rechazar"
    El AI debe generar bloques JSON específicos (`RULE_PROPOSAL`, `TEMPLATE_PROPOSAL`, etc.) para que aparezcan como propuestas interactivas. Si solo ves texto, puede que el modelo elegido no siga bien las instrucciones del prompt. Prueba con GPT-4o, Claude Sonnet 4, o Gemini 2.5 Pro.

## Reglas y clasificación

??? question "Las reglas no se aplican a correos nuevos"
    1. Verifica que la clasificación está activada en Opciones
    2. Comprueba que tus reglas están habilitadas (interruptor visible en cada regla)
    3. Revisa el log de actividad en el panel para ver si hay errores
    4. Las reglas solo se aplican a correos nuevos que llegan después de activarlas

??? question "¿Cómo pruebo una regla contra correos existentes?"
    Usa el botón **"Procesar correos existentes"** en el Dashboard. Esto evaluará todas las reglas habilitadas contra los correos actuales de tu bandeja de entrada.

??? question "Las expresiones regulares no funcionan"
    - Asegúrate de seleccionar el operador **"coincide con regex"** en la condición
    - No uses delimitadores (`/patron/`), escribe solo el patrón: `newsletter|promo`
    - Las regex con cuantificadores anidados (`(a+)+`) se rechazan por seguridad (ReDoS)

??? question "El panel de conflictos muestra conflictos que no lo son"
    El detector de conflictos es conservador: marca reglas con condiciones solapadas incluso si en la práctica no causan problemas. Puedes ignorar los conflictos o usar "Fusionar reglas redundantes" para simplificar.

## Importación / Exportación

??? question "La importación muestra conflictos en todas las reglas"
    Los conflictos se detectan por ID y por nombre. Si exportaste y reimportaste la misma configuración, todos los items se mostrarán como conflictos porque ya existen. Selecciona "Omitir" para mantener los existentes o "Reemplazar" para sobrescribir.

??? question "¿El formato de exportación es compatible entre versiones?"
    Sí. El formato JSON incluye validación de esquema. Los campos añadidos en versiones nuevas se rellenan con valores por defecto automáticamente.

## Plantillas

??? question "Las variables {{}} no se sustituyen en la respuesta"
    Verifica que usas la sintaxis correcta con dobles llaves: `{{sender_name}}`, no `{sender_name}`. Consulta la lista completa de variables en [Plantillas](plantillas.md#variables-disponibles).

??? question "¿Puedo enviar respuestas HTML?"
    Sí. Desmarca la opción "Texto plano" en el editor de plantillas. El cuerpo se interpretará como HTML.

## Privacidad y seguridad

??? question "¿La extensión envía mis correos a servidores externos?"
    Solo si usas funcionalidades de IA de forma explícita (chat con el asistente, análisis de correos, sugerencia de reglas). En ese caso, el contenido se limita a 500 caracteres por correo y se envía únicamente al proveedor de IA que hayas configurado. La clasificación por reglas y las plantillas funcionan completamente en local, sin ninguna conexión externa.

??? question "¿Dónde se guardan las claves API?"
    En `browser.storage.local`, el almacenamiento local del navegador accesible únicamente por la extensión. Nunca se transmiten a servidores de terceros ni aparecen en ningún log. Si desinstalás la extensión, los datos se eliminan automáticamente junto con el perfil de la extensión.

??? question "¿Qué datos registra el log de actividad?"
    El log registra eventos locales: clasificaciones aplicadas, respuestas enviadas, errores de reglas y operaciones de carpetas. Toda esta información se almacena en `browser.storage.local` y nunca sale del dispositivo. Podés exportarla a CSV o borrarla desde el panel.

## Rendimiento

??? question "La clasificación se ralentiza con una bandeja de entrada grande"
    Las reglas se evalúan en orden para cada correo entrante. Para mejorar el rendimiento:

    - Desactiva las reglas que ya no uses
    - Ordena las reglas más específicas primero (evitan que se evalúen las siguientes)
    - Evita condiciones con regex complejas en reglas de alta frecuencia

??? question "El Quick Panel tarda mucho en analizar correos"
    El Quick Panel analiza correos en lotes de 25 con una pausa entre cada uno para no saturar la API. Si el proveedor impone límites de tasa (rate limits), los lotes se procesan más despacio. Podés cancelar el análisis en cualquier momento y aceptar las propuestas parciales que ya aparecieron.

## Dashboard

??? question "¿Qué muestran las estadísticas semanales?"
    El dashboard muestra: clasificaciones por día de la semana en curso, ranking de reglas más activas, y los remitentes que generan más actividad. Los datos se calculan a partir del log de actividad local, por lo que reflejan solo la actividad registrada desde que instalaste la extensión.

??? question "El log de actividad está vacío"
    El log registra eventos desde la primera activación de la clasificación. Si acabás de instalar la extensión o de habilitar la clasificación, el log estará vacío hasta que llegue el primer correo y se aplique alguna regla. Verificá que la clasificación esté activada en Opciones.
