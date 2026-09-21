-- database/03b_rls_endurecimiento.sql
-- 1. Redefinir la tabla y función de forma segura e idempotente (sin borrar datos actuales)
CREATE TABLE IF NOT EXISTS public.perfiles (
  id  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol text NOT NULL CHECK (rol IN ('operador', 'supervisor'))
);
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura de perfil propio" ON public.perfiles;
CREATE POLICY "Lectura de perfil propio" ON public.perfiles
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);

-- Función blindada con search_path vacío
CREATE OR REPLACE FUNCTION public.rol_actual() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT rol FROM public.perfiles WHERE id = (SELECT auth.uid())
$$;
REVOKE ALL ON FUNCTION public.rol_actual() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rol_actual() TO authenticated;

-- 2. Depurar TODAS las políticas previas de lecturas_maquina y recrear solo las seguras
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'lecturas_maquina'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.lecturas_maquina', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Lectura general" ON public.lecturas_maquina
  FOR SELECT TO authenticated
  USING ((SELECT public.rol_actual()) IN ('operador', 'supervisor'));

CREATE POLICY "Insercion operadores" ON public.lecturas_maquina
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.rol_actual()) = 'operador');

-- 3. Privilegios mínimos (Defensa en profundidad)
REVOKE ALL ON public.lecturas_maquina FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.lecturas_maquina FROM authenticated;
REVOKE ALL ON public.perfiles FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.perfiles FROM authenticated;