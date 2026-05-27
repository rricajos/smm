# Panel de control

El panel de control es la interfaz principal de Smart Mail Manager, accesible desde el botón de la barra de espacios de Thunderbird.

## Dashboard

La pestaña Dashboard muestra un resumen visual de la actividad:

### Estadísticas

- **Reglas totales / activas** — número de reglas configuradas y habilitadas
- **Clasificados hoy** — correos procesados en el día actual
- **Respuestas hoy** — auto-respuestas enviadas hoy

### Filtros de rango temporal

| Rango | Descripción |
|-------|-------------|
| 7 días | Última semana |
| 30 días | Último mes |
| Todo | Sin límite temporal |

### Ranking de reglas

Muestra las reglas más activas ordenadas por número de coincidencias en el período seleccionado.

### Top remitentes

Lista los remitentes con más correos clasificados.

### Gestión de carpetas

Desde el Dashboard se pueden:

- **Crear carpetas** — en cualquier cuenta
- **Renombrar carpetas** — cambiar el nombre manteniendo el contenido
- **Eliminar carpetas** — con confirmación
- **Mover contenido** — de una carpeta a otra

### Procesar correos existentes

Botón para ejecutar las reglas actuales contra los correos existentes (hasta 50 por defecto).

## Log de actividad

La pestaña Log muestra el historial de todas las acciones ejecutadas:

### Columnas

| Columna | Descripción |
|---------|-------------|
| Fecha | Timestamp de la acción |
| Tipo | `classification`, `autoResponse` o `error` |
| Regla | Nombre de la regla que coincidió |
| Asunto | Asunto del correo |
| De | Remitente |
| Acciones | Lista de acciones ejecutadas |
| Detalles | Información adicional |

### Filtros

| Filtro | Valores |
|--------|---------|
| Tipo | Todos, Clasificaciones, Respuestas, Errores |
| Búsqueda | Por asunto, remitente o nombre de regla |

### Paginación

El log muestra entradas paginadas para mantener el rendimiento.

### Exportación CSV

Exporta todas las entradas visibles a un archivo CSV compatible con Excel (incluye BOM UTF-8).

### Retención

Las entradas se eliminan automáticamente según la configuración `logRetentionDays` (por defecto 30 días). El límite máximo es de 500 entradas con rotación automática.

### Limpiar log

Botón para eliminar todas las entradas con confirmación previa.

## Búsqueda global

Atajo: ++ctrl+k++

Busca simultáneamente en:

- **Reglas** — por nombre y valores de condición
- **Plantillas** — por nombre y asunto
- **Log** — por asunto, remitente y nombre de regla

Los resultados enlazan directamente a la pestaña correspondiente.

## Badges

El icono de la extensión muestra un contador de clasificaciones no leídas. El badge se resetea al abrir el panel.
