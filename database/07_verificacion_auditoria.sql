-- 1. Verificar RLS activo
SELECT relname, relrowsecurity AS rls_activo
FROM pg_class WHERE oid = 'public.lecturas_maquina'::regclass;

-- 2. Verificar que solo existen las políticas correctas en BD
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('lecturas_maquina', 'perfiles');

-- 3. Verificar que se eliminaron las políticas genéricas de Storage
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' ORDER BY policyname;

-- 4. Verificar que el bucket quedó privado
SELECT id, public, file_size_limit, allowed_mime_types 
FROM storage.buckets WHERE id = 'evidencias';