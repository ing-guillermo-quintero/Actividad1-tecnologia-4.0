-- 1. Eliminar la tabla y sus dependencias si ya existían para evitar conflictos
DROP TABLE IF EXISTS public.perfiles CASCADE;

-- 2. Crear la tabla de perfiles segura
CREATE TABLE public.perfiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  rol TEXT CHECK (rol IN ('operador', 'supervisor')) NOT NULL
);

-- Habilitar RLS en la tabla perfiles
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- Política: Un usuario solo puede leer su propio perfil
CREATE POLICY "Lectura de perfil propio" ON public.perfiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- 3. Crear una función segura para leer el rol (Security Definer)
CREATE OR REPLACE FUNCTION public.rol_actual()
RETURNS TEXT AS $$
  SELECT rol FROM public.perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. Blindar la tabla lecturas_maquina con RLS
ALTER TABLE public.lecturas_maquina ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas anteriores si existieran
DROP POLICY IF EXISTS "Lectura general" ON public.lecturas_maquina;
DROP POLICY IF EXISTS "Insercion operadores" ON public.lecturas_maquina;

-- Política SELECT: Operadores y Supervisores pueden ver las lecturas
CREATE POLICY "Lectura general" ON public.lecturas_maquina
  FOR SELECT TO authenticated
  USING (public.rol_actual() IN ('operador', 'supervisor'));

-- Política INSERT: Solo los Operadores pueden insertar telemetría
CREATE POLICY "Insercion operadores" ON public.lecturas_maquina
  FOR INSERT TO authenticated
  WITH CHECK (public.rol_actual() = 'operador');