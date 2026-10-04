-- database/14_graficos_y_resumen_dinamico.sql
-- ==========================================================================
-- AGREGACIONES TEMPORALES Y CONTEO DINÁMICO DE EQUIPOS PARA GRÁFICOS
-- ==========================================================================

-- 1. Actualización de la función de resumen para devolver máquinas totales dinámicas
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
  v_maquinas_totales integer;
BEGIN
  IF (SELECT public.rol_actual()) NOT IN ('operador', 'supervisor') THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  SELECT costo_kwh, costo_minuto_parada INTO v_costo_kwh, v_costo_parada 
  FROM public.parametros_planta WHERE id = 1;

  -- Conteo dinámico de máquinas registradas históricamente
  SELECT COUNT(DISTINCT codigo_maquina) INTO v_maquinas_totales
  FROM public.lecturas_maquina;

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
    'maquinas_activas', COUNT(DISTINCT codigo_maquina),
    'maquinas_totales', COALESCE(v_maquinas_totales, 0)
  ) INTO v_resultado
  FROM telemetria_reciente;

  RETURN v_resultado;
END;
$$;

-- 2. Función RPC para agregar las series temporales por Día o Mes
CREATE OR REPLACE FUNCTION public.obtener_metricas_grafico(
  p_codigo_maquina text DEFAULT 'todas',
  p_escala text DEFAULT 'dias'
)
RETURNS TABLE (
  periodo text,
  piezas_producidas bigint,
  consumo_energia_kwh numeric,
  costo_energia numeric,
  tiempo_parada_min numeric,
  costo_parada numeric,
  tiempo_operacion_min numeric,
  temperatura_prom numeric,
  vibracion_prom numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_costo_kwh numeric;
  v_costo_parada numeric;
  v_desde timestamptz;
  v_trunc text;
  v_format text;
BEGIN
  IF (SELECT public.rol_actual()) NOT IN ('operador', 'supervisor') THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  SELECT costo_kwh, costo_minuto_parada INTO v_costo_kwh, v_costo_parada 
  FROM public.parametros_planta WHERE id = 1;

  -- Configuración de rango y agregación según escala seleccionada
  IF p_escala = 'meses' THEN
    v_trunc := 'month';
    v_format := 'YYYY-MM';
    v_desde := now() - interval '12 months';
  ELSE
    v_trunc := 'day';
    v_format := 'YYYY-MM-DD';
    v_desde := now() - interval '30 days';
  END IF;

  RETURN QUERY
  SELECT 
    to_char(date_trunc(v_trunc, lm.fecha_registro), v_format) AS periodo,
    COALESCE(SUM(lm.piezas_producidas), 0)::bigint AS piezas_producidas,
    COALESCE(ROUND(SUM(lm.consumo_energia_kwh), 2), 0.00) AS consumo_energia_kwh,
    COALESCE(ROUND(SUM(lm.consumo_energia_kwh * v_costo_kwh), 2), 0.00) AS costo_energia,
    COALESCE(ROUND(SUM(lm.tiempo_parada_min), 2), 0.00) AS tiempo_parada_min,
    COALESCE(ROUND(SUM(lm.tiempo_parada_min * v_costo_parada), 2), 0.00) AS costo_parada,
    COALESCE(ROUND(SUM(lm.tiempo_operacion_min), 2), 0.00) AS tiempo_operacion_min,
    COALESCE(ROUND(AVG(lm.temperatura), 2), 0.00) AS temperatura_prom,
    COALESCE(ROUND(AVG(lm.nivel_vibracion), 2), 0.00) AS vibracion_prom
  FROM public.lecturas_maquina lm
  WHERE lm.fecha_registro >= v_desde
    AND (p_codigo_maquina = 'todas' OR lm.codigo_maquina = p_codigo_maquina)
  GROUP BY date_trunc(v_trunc, lm.fecha_registro)
  ORDER BY date_trunc(v_trunc, lm.fecha_registro) ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_resumen_supervisor(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_metricas_grafico(text, text) TO authenticated;