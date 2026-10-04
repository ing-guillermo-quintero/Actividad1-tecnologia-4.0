-- database/13_particionado_escalabilidad_100_maquinas.sql
-- ==========================================================================
-- ESTRATEGIA DE CRECIMIENTO: TABLA PARTICIONADA Y ESCALABILIDAD 100+ MÁQUINAS
-- ==========================================================================

-- 1. Resguardar datos existentes de la tabla previa (si existieran)
CREATE TABLE IF NOT EXISTS public.lecturas_maquina_respaldo AS 
SELECT * FROM public.lecturas_maquina;

-- 2. Eliminar la tabla no particionada actual
DROP TABLE IF EXISTS public.lecturas_maquina CASCADE;

-- 3. Crear la nueva tabla maestra con particionado por rango de fecha
CREATE TABLE public.lecturas_maquina (
  id uuid DEFAULT gen_random_uuid(),
  codigo_maquina text NOT NULL,
  temperatura numeric(5, 2) NOT NULL,
  nivel_vibracion numeric(5, 2) NOT NULL,
  estado text NOT NULL,
  piezas_producidas integer NOT NULL DEFAULT 0,
  tiempo_operacion_min numeric(8, 2) NOT NULL DEFAULT 0.00,
  tiempo_parada_min numeric(8, 2) NOT NULL DEFAULT 0.00,
  consumo_energia_kwh numeric(8, 2) NOT NULL DEFAULT 0.00,
  alarma text NOT NULL DEFAULT 'Ninguna',
  evidencia_path text,
  fecha_registro timestamptz NOT NULL DEFAULT now(),
  
  -- Clave primaria compuesta obligatoria para particionado
  CONSTRAINT pk_lecturas_maquina_part PRIMARY KEY (id, fecha_registro),
  
  -- Restricción expandida para admitir MAQ-01 hasta MAQ-999
  CONSTRAINT chk_codigo_maquina CHECK (codigo_maquina ~ '^MAQ-([0-9]{2,3})$'),
  CONSTRAINT chk_estado CHECK (estado in ('Operativo', 'Alerta', 'Falla', 'Mantenimiento')),
  CONSTRAINT chk_temperatura CHECK (temperatura BETWEEN -50 AND 250),
  CONSTRAINT chk_vibracion CHECK (nivel_vibracion BETWEEN 0 AND 100),
  CONSTRAINT chk_piezas CHECK (piezas_producidas >= 0),
  CONSTRAINT chk_tiempos CHECK (tiempo_operacion_min >= 0 AND tiempo_parada_min >= 0),
  CONSTRAINT chk_energia CHECK (consumo_energia_kwh >= 0),
  CONSTRAINT chk_evidencia_path CHECK (
    evidencia_path IS NULL OR 
    evidencia_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  )
) PARTITION BY RANGE (fecha_registro);

-- 4. Creación de particiones mensuales (Mes en curso y próximos meses)
CREATE TABLE public.lecturas_maquina_2026_10 PARTITION OF public.lecturas_maquina
  FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');

CREATE TABLE public.lecturas_maquina_2026_11 PARTITION OF public.lecturas_maquina
  FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');

CREATE TABLE public.lecturas_maquina_2026_12 PARTITION OF public.lecturas_maquina
  FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

-- 5. Partición por defecto para prevenir rechazos ante desfasajes de reloj
CREATE TABLE public.lecturas_maquina_default PARTITION OF public.lecturas_maquina DEFAULT;

-- 6. Reinstauración de Seguridad RLS en la tabla particionada
ALTER TABLE public.lecturas_maquina ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura general" ON public.lecturas_maquina
  FOR SELECT TO authenticated
  USING ((SELECT public.rol_actual()) IN ('operador', 'supervisor'));

CREATE POLICY "Insercion operadores" ON public.lecturas_maquina
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.rol_actual()) = 'operador'
    AND (evidencia_path IS NULL OR split_part(evidencia_path, '/', 1) = (SELECT auth.uid())::text)
  );

REVOKE ALL ON public.lecturas_maquina FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.lecturas_maquina FROM authenticated;
GRANT INSERT (
  codigo_maquina, temperatura, nivel_vibracion, estado,
  piezas_producidas, tiempo_operacion_min, tiempo_parada_min,
  consumo_energia_kwh, alarma, evidencia_path, fecha_registro
) ON public.lecturas_maquina TO authenticated;

-- Índice BRIN para consultas por fecha (ultrarrápido y compacto)
CREATE INDEX idx_lecturas_fecha_brin 
  ON public.lecturas_maquina USING BRIN (fecha_registro);

-- B-Tree local por partición para filtrar rápidamente por equipo específico
CREATE INDEX idx_lecturas_codigo_maquina 
  ON public.lecturas_maquina (codigo_maquina);

-- 1. Tabla de consolidación horaria por equipo
CREATE TABLE IF NOT EXISTS public.resumen_horario_maquinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_maquina text NOT NULL,
  hora_inicio timestamptz NOT NULL,
  piezas_producidas_total integer NOT NULL,
  tiempo_operacion_total numeric(8, 2) NOT NULL,
  tiempo_parada_total numeric(8, 2) NOT NULL,
  consumo_kwh_total numeric(8, 2) NOT NULL,
  temperatura_promedio numeric(5, 2) NOT NULL,
  max_vibracion numeric(5, 2) NOT NULL,
  cantidad_fallas integer NOT NULL,
  CONSTRAINT unq_maquina_hora UNIQUE (codigo_maquina, hora_inicio)
);

ALTER TABLE public.resumen_horario_maquinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura resumenes authenticated" ON public.resumen_horario_maquinas
  FOR SELECT TO authenticated USING (true);

-- 2. Función de consolidación que agrupa la última hora
CREATE OR REPLACE FUNCTION public.calcular_rollup_horario()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.resumen_horario_maquinas (
    codigo_maquina, hora_inicio, piezas_producidas_total,
    tiempo_operacion_total, tiempo_parada_total, consumo_kwh_total,
    temperatura_promedio, max_vibracion, cantidad_fallas
  )
  SELECT 
    codigo_maquina,
    date_trunc('hour', fecha_registro) AS hora,
    SUM(piezas_producidas),
    SUM(tiempo_operacion_min),
    SUM(tiempo_parada_min),
    SUM(consumo_energia_kwh),
    ROUND(AVG(temperatura), 2),
    MAX(nivel_vibracion),
    COUNT(*) FILTER (WHERE estado = 'Falla')
  FROM public.lecturas_maquina
  WHERE fecha_registro >= (now() - interval '2 hours')
  GROUP BY codigo_maquina, date_trunc('hour', fecha_registro)
  ON CONFLICT (codigo_maquina, hora_inicio) 
  DO UPDATE SET
    piezas_producidas_total = EXCLUDED.piezas_producidas_total,
    tiempo_operacion_total = EXCLUDED.tiempo_operacion_total,
    tiempo_parada_total = EXCLUDED.tiempo_parada_total,
    consumo_kwh_total = EXCLUDED.consumo_kwh_total,
    temperatura_promedio = EXCLUDED.temperatura_promedio,
    max_vibracion = EXCLUDED.max_vibracion,
    cantidad_fallas = EXCLUDED.cantidad_fallas;
END;
$$;