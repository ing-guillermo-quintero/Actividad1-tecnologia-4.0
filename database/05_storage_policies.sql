-- database/05_storage_policies.sql

-- 1. Purga estricta de políticas de Storage huérfanas o demasiado permisivas
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'storage' AND tablename = 'objects'
             AND policyname NOT IN ('evidencias_insert_operador', 'evidencias_select_roles')
             AND (   coalesce(qual, '')       ILIKE '%evidencias%'
                  OR coalesce(with_check, '') ILIKE '%evidencias%'
                  OR (coalesce(qual, '')       NOT ILIKE '%bucket_id%'
                      AND coalesce(with_check, '') NOT ILIKE '%bucket_id%'))
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

-- 2. Eliminar las políticas si ya existían para poder actualizarlas (Solución al error)
DROP POLICY IF EXISTS "evidencias_insert_operador" ON storage.objects;
DROP POLICY IF EXISTS "evidencias_select_roles" ON storage.objects;

-- 3. Solo el operador sube, y únicamente dentro de su carpeta <uid>/
CREATE POLICY "evidencias_insert_operador" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evidencias'
              AND (SELECT public.rol_actual()) = 'operador'
              AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- 4. Operadores y supervisores leen (necesario para generar URLs firmadas)
CREATE POLICY "evidencias_select_roles" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'evidencias'
         AND (SELECT public.rol_actual()) IN ('operador', 'supervisor'));