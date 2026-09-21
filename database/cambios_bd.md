- **20-Sept-2026**: Se ejecutó `02_seguridad.sql` para aplicar CHECK constraints, revocar permisos de INSERT directos y configurar el bucket de evidencias como privado con límite de 5MB. Se desactivó el registro público en Supabase.

- **20-Sept-2026**: Se resolvió SEC-03. Creación de tabla `perfiles`, función `rol_actual()` y políticas RLS estrictas en `lecturas_maquina` para autorizar SELECT a ambos roles e INSERT únicamente a operadores.

- **20-Sept-2026**: Se resolvió SEC-03. Eliminación y recreación de tabla `perfiles`, función `rol_actual()` y políticas RLS estrictas en `lecturas_maquina` para autorizar SELECT a ambos roles e INSERT únicamente a operadores.

