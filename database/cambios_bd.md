- **20-Sept-2026**: Se ejecutó `02_seguridad.sql` para aplicar CHECK constraints, revocar permisos de INSERT directos y configurar el bucket de evidencias como privado con límite de 5MB. Se desactivó el registro público en Supabase.

- **20-Sept-2026**: Se resolvió SEC-03. Creación de tabla `perfiles`, función `rol_actual()` y políticas RLS estrictas en `lecturas_maquina` para autorizar SELECT a ambos roles e INSERT únicamente a operadores.

- **20-Sept-2026**: Se resolvió SEC-03. Eliminación y recreación de tabla `perfiles`, función `rol_actual()` y políticas RLS estrictas en `lecturas_maquina` para autorizar SELECT a ambos roles e INSERT únicamente a operadores.

- **21-Sept-2026**: Se ejecutaron `04_evidencia_path.sql`, `05_storage_policies.sql` y `03b_rls_endurecimiento.sql` para migrar evidencias a firmas seguras, purgar políticas RLS antiguas, añadir políticas restrictivas al bucket de Storage y proteger la función `rol_actual()`.
