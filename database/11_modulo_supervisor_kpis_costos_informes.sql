-- database/11_modulo_supervisor_kpis_costos_informes.sql
-- ==========================================================================
-- MÓDULO SUPERVISOR: KPIS, COSTOS, ALERTAS COMPLEJAS E INFORMES
-- ==========================================================================

-- 1. Tabla de Parámetros Económicos y Metas de Producción
CREATE TABLE IF NOT EXISTS public.parametros_planta (
  id integer PRIMARY KEY DEFAULT 1,
  costo_kwh numeric(10, 4) NOT NULL DEFAULT 0.18,          -- Costo por kWh (USD o moneda local)
  costo_minuto_parada numeric(10, 2) NOT NULL DEFAULT 5.50, -- Costo lucro cesante/minuto
  costo_materia_prima_pieza numeric(10, 3) NOT NULL DEFAULT 0.85,
  meta_piezas_hora integer NOT NULL DEFAULT 60,
  actualizado_por uuid REFERENCES auth.users(id),
  actualizado_el timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT solo_una_fila CHECK (id = 1)
);

INSERT INTO public.parametros_planta (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.parametros_planta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura parametros authenticated" ON public.parametros_planta
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Supervisor edita parametros" ON public.parametros_planta
  FOR UPDATE TO authenticated
  USING ((SELECT public.rol_actual()) = 'supervisor')
  WITH CHECK ((SELECT public.rol_actual()) = 'supervisor');

-- 2. Tabla de Informes Técnicos y Auditorías Documentales
CREATE TABLE IF NOT EXISTS public.informes_tecnicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('Turno', 'Mantenimiento', 'Auditoría', 'Falla Crítica')),
  resumen text,
  documento_path text NOT NULL CHECK (documento_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|xlsx|docx)$'),
  generado_por uuid NOT NULL REFERENCES auth.users(id),
  fecha_registro timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.informes_tecnicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura informes por roles" ON public.informes_tecnicos
  FOR SELECT TO authenticated
  USING ((SELECT public.rol_actual()) IN ('operador', 'supervisor'));

CREATE POLICY "Supervisor inserta informes" ON public.informes_tecnicos
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.rol_actual()) = 'supervisor'
    AND split_part(documento_path, '/', 1) = (SELECT auth.uid())::text
  );

-- 3. Bucket Privado para Documentación Técnica e Informes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'informes', 
  'informes', 
  false, 
  10485760, -- 10 MB
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE 
SET public = false, file_size_limit = 10485760;

CREATE POLICY "informes_insert_supervisor" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'informes'
    AND (SELECT public.rol_actual()) = 'supervisor'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "informes_select_roles" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'informes'
    AND (SELECT public.rol_actual()) IN ('operador', 'supervisor')
  );

-- 4. Función RPC: Agregado de Producción, Costos y OEE Global
CREATE OR REPLACE FUNCTION public.obtener_resumen_supervisor(horas_atras integer DEFAULT 24)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_resultado json;
  v_costo_kwh numeric;
  v_costo_parada numeric;
BEGIN
  -- Verificar autorización
  IF (SELECT public.rol_actual()) NOT IN ('operador', 'supervisor') THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  SELECT costo_kwh, costo_minuto_parada INTO v_costo_kwh, v_costo_parada 
  FROM public.parametros_planta WHERE id = 1;

  WITH telemetria_reciente AS (
    SELECT * FROM public.lecturas_maquina
    WHERE fecha_registro >= (now() - (horas_atras || ' hours')::interval)
  )
  SELECT json_build_object(
    'piezas_totales', COALESCE(SUM(piezas_producidas), 0),
    'consumo_kwh_total', COALESCE(ROUND(SUM(consumo_energia_kwh), 2), 0.00),
    'costo_energia_total', COALESCE(ROUND(SUM(consumo_energia_kwh * v_costo_kwh), 2), 0.00),
    'minutos_parada_total', COALESCE(ROUND(SUM(tiempo_parada_min), 1), 0.0),
    'costo_paradas_total', COALESCE(ROUND(SUM(tiempo_parada_min * v_costo_parada), 2), 0.00),
    'maquinas_activas', COUNT(DISTINCT codigo_maquina)
  ) INTO v_resultado
  FROM telemetria_reciente;

  RETURN v_resultado;
END;
$$;