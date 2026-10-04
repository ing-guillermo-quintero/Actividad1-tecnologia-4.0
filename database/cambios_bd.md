- **20-Sept-2026**: Se ejecutó `02_seguridad.sql` para aplicar CHECK constraints, revocar permisos de INSERT directos y configurar el bucket de evidencias como privado con límite de 5MB. Se desactivó el registro público en Supabase.

- **20-Sept-2026**: Se resolvió SEC-03. Creación de tabla `perfiles`, función `rol_actual()` y políticas RLS estrictas en `lecturas_maquina` para autorizar SELECT a ambos roles e INSERT únicamente a operadores.

- **20-Sept-2026**: Se resolvió SEC-03. Eliminación y recreación de tabla `perfiles`, función `rol_actual()` y políticas RLS estrictas en `lecturas_maquina` para autorizar SELECT a ambos roles e INSERT únicamente a operadores.

- **21-Sept-2026**: Se ejecutaron `04_evidencia_path.sql`, `05_storage_policies.sql` y `03b_rls_endurecimiento.sql` para migrar evidencias a firmas seguras, purgar políticas RLS antiguas, añadir políticas restrictivas al bucket de Storage y proteger la función `rol_actual()`.

- **04-Oct-2026**: Se ejecutó `08_purgar_telemetria.sql` para realizar la purga total de datos históricos en la tabla `lecturas_maquina` mediante `TRUNCATE`. Vaciado manual de archivos y metadatos del bucket privado `evidencias` desde la interfaz de Supabase Storage. Se ejecutó `09_reestructuracion_maquinas.sql` para actualizar la restricción `chk_codigo_maquina`, limitando los valores permitidos estrictamente a `('MAQ-01', 'MAQ-02', 'MAQ-03')`.

- **04-Oct-2026**: Se ejecutó `10_reestructuracion_planta_35_maquinas.sql` para ampliar el esquema de `lecturas_maquina`: adición de campos `piezas_producidas`, `tiempo_operacion_min`, `tiempo_parada_min`, `consumo_energia_kwh` y `alarma`. Actualización de `chk_codigo_maquina` al rango `MAQ-01` a `MAQ-35` vía regex y concesión de permisos de `INSERT` a columnas nuevas.

- **04-Oct-2026**: Se ejecutó `13_particionado_escalabilidad_100_maquinas.sql`. Reestructuración total a tabla particionada mensualmente (`PARTITION BY RANGE`), implementación de índices BRIN para series temporales masivas, tabla de agregación `resumen_horario_maquinas`, micro-batching en el simulador de 100 máquinas y throttling de renderizado WebSocket en frontend.

- **04-Oct-2026**: Se ejecutó `14_graficos_y_resumen_dinamico.sql`. Actualización de la función `obtener_resumen_supervisor()` para calcular el total dinámico de máquinas registradas en BD. Creación de la función analítica RPC `obtener_metricas_grafico()` para agregar series temporales con selección de granularidad (días/meses), equipo y variables de balance. Integración de Chart.js en el frontend con soporte para reactividad y filtros dinámicos.

- **04-Oct-2026**: Se ejecutó `15_grafico_horas_escala_dinamica.sql`. Actualización de la función RPC `obtener_metricas_grafico()` para admitir agregación horaria por fecha seleccionada (`p_fecha`), calculando el rango exacto entre la primera y última lectura (`MIN` y `MAX`) con granularidad dinámica (5, 15 y 60 min), eliminando espacios vacíos en el eje temporal.