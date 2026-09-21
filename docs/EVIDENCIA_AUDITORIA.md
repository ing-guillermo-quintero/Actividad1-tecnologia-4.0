# Evidencia de Auditoría - Seguridad v4

A continuación se adjuntan las evidencias de la configuración real del backend en Supabase, requeridas para la verificación de los hallazgos SEC-02 y SEC-04.

### 1. Estado de RLS en tabla de telemetría (SEC-02)
```text
| relname          | rls_activo |
| ---------------- | ---------- |
| lecturas_maquina | true       |
```
### 2. Políticas activas en Base de Datos (SEC-02)

| policyname               | cmd    | roles           | qual                                                                                       | with_check                                                                                                                                                                     |
| ------------------------ | ------ | --------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Insercion operadores     | INSERT | {authenticated} | null                                                                                       | ((( SELECT rol_actual() AS rol_actual) = 'operador'::text) AND ((evidencia_path IS NULL) OR (split_part(evidencia_path, '/'::text, 1) = (( SELECT auth.uid() AS uid))::text))) |
| Lectura general          | SELECT | {authenticated} | (( SELECT rol_actual() AS rol_actual) = ANY (ARRAY['operador'::text, 'supervisor'::text])) | null                                                                                                                                                                           |
| Lectura de perfil propio | SELECT | {authenticated} | (( SELECT auth.uid() AS uid) = id)                                                         | null                                                                                                                                                                           |

### 3. Políticas activas en Storage (SEC-04)


| policyname                 | cmd    | roles           | qual                                                                                                                              | with_check                                                                                                                                                                 |
| -------------------------- | ------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidencias_insert_operador | INSERT | {authenticated} | null                                                                                                                              | ((bucket_id = 'evidencias'::text) AND (( SELECT rol_actual() AS rol_actual) = 'operador'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)) |
| evidencias_select_roles    | SELECT | {authenticated} | ((bucket_id = 'evidencias'::text) AND (( SELECT rol_actual() AS rol_actual) = ANY (ARRAY['operador'::text, 'supervisor'::text]))) | null                                                                                                                                                                       |


### 4. Configuración de seguridad del Bucket (SEC-04)

| id         | public | file_size_limit | allowed_mime_types                      |
| ---------- | ------ | --------------- | --------------------------------------- |
| evidencias | false  | 5242880         | ["image/jpeg","image/png","image/webp"] |