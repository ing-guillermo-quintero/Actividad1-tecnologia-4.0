-- database/05_storage_policies.sql
-- 1. Eliminar TODAS las políticas existentes sobre este bucket antes de recrear
DO $$
DECLARE p record;
BEGIN
    FOR p IN SELECT policyname FROM pg_policies
            WHERE schemaname = 'storage' AND tablename = 'objects'
            AND (qual ILIKE '%evidencias%' OR with_check ILIKE '%evidencias%')
    LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
    END LOOP;
END $$;

-- 2. Solo el operador sube, y únicamente dentro de su carpeta <uid>/
CREATE POLICY evidencias_insert_operador ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'evidencias'
            AND (SELECT public.rol_actual()) = 'operador'
            AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- 3. Operadores y supervisores leen (necesario para generar URLs firmadas)
CREATE POLICY evidencias_select_roles ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'evidencias'
        AND (SELECT public.rol_actual()) IN ('operador', 'supervisor'));