-- database/15_grafico_horas_escala_dinamica.sql
-- ==========================================================================
-- AGREGACIÓN HORARIA CON ESCALA DINÁMICA POR RANGO REAL DE INGRESO
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.obtener_metricas_grafico(
  p_codigo_maquina text DEFAULT 'todas',
  p_escala text DEFAULT 'horas',
  p_fecha text DEFAULT NULL
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
  v_hasta timestamptz;
  v_min_fecha timestamptz;
  v_max_fecha timestamptz;
  v_diff_min numeric;
  v_interval_min integer;
BEGIN
  IF (SELECT public.rol_actual()) NOT IN ('operador', 'supervisor') THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  SELECT costo_kwh, costo_minuto_parada INTO v_costo_kwh, v_costo_parada 
  FROM public.parametros_planta WHERE id = 1;

  -- 1. CASO HORAS: Día específico con escala adaptada entre primer y último dato
  IF p_escala = 'horas' THEN
    -- Si no se pasa fecha, toma la fecha actual
    v_desde := COALESCE(p_fecha::date, CURRENT_DATE)::timestamptz;
    v_hasta := v_desde + interval '1 day';

    -- Identificar exactamente la primera y última marca temporal con datos en ese día
    SELECT MIN(fecha_registro), MAX(fecha_registro)
    INTO v_min_fecha, v_max_fecha
    FROM public.lecturas_maquina lm
    WHERE lm.fecha_registro >= v_desde 
      AND lm.fecha_registro < v_hasta
      AND (p_codigo_maquina = 'todas' OR lm.codigo_maquina = p_codigo_maquina);

    -- Si no hay registros ese día, salir inmediatamente
    IF v_min_fecha IS NULL THEN
      RETURN;
    END IF;

    -- Calcular la diferencia en minutos entre el primer y último registro
    v_diff_min := EXTRACT(EPOCH FROM (v_max_fecha - v_min_fecha)) / 60;

    -- Agrupación adaptativa según el volumen y dispersión de datos
    IF v_diff_min <= 60 THEN
      v_interval_min := 5;   -- Agrupación cada 5 min si hay 1 hora o menos de datos
    ELSIF v_diff_min <= 360 THEN
      v_interval_min := 15;  -- Agrupación cada 15 min si hay hasta 6 horas
    ELSE
      v_interval_min := 60;  -- Agrupación por hora completa si abarca todo el turno
    END IF;

    RETURN QUERY
    SELECT 
      to_char(
        v_desde + (floor(EXTRACT(EPOCH FROM (lm.fecha_registro - v_desde)) / (v_interval_min * 60)) * (v_interval_min * 60) || ' seconds')::interval,
        'HH24:MI'
      ) AS periodo,
      COALESCE(SUM(lm.piezas_producidas), 0)::bigint AS piezas_producidas,
      COALESCE(ROUND(SUM(lm.consumo_energia_kwh), 2), 0.00) AS consumo_energia_kwh,
      COALESCE(ROUND(SUM(lm.consumo_energia_kwh * v_costo_kwh), 2), 0.00) AS costo_energia,
      COALESCE(ROUND(SUM(lm.tiempo_parada_min), 2), 0.00) AS tiempo_parada_min,
      COALESCE(ROUND(SUM(lm.tiempo_parada_min * v_costo_parada), 2), 0.00) AS costo_parada,
      COALESCE(ROUND(SUM(lm.tiempo_operacion_min), 2), 0.00) AS tiempo_operacion_min,
      COALESCE(ROUND(AVG(lm.temperatura), 2), 0.00) AS temperatura_prom,
      COALESCE(ROUND(AVG(lm.nivel_vibracion), 2), 0.00) AS vibracion_prom
    FROM public.lecturas_maquina lm
    WHERE lm.fecha_registro >= v_min_fecha
      AND lm.fecha_registro <= v_max_fecha
      AND (p_codigo_maquina = 'todas' OR lm.codigo_maquina = p_codigo_maquina)
    GROUP BY 1
    ORDER BY 1 ASC;

  -- 2. CASO MENSUAL: Últimos 12 meses
  ELSIF p_escala = 'meses' THEN
    v_desde := now() - interval '12 months';

    RETURN QUERY
    SELECT 
      to_char(date_trunc('month', lm.fecha_registro), 'YYYY-MM') AS periodo,
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
    GROUP BY date_trunc('month', lm.fecha_registro)
    ORDER BY date_trunc('month', lm.fecha_registro) ASC;

  -- 3. CASO DIARIO: Últimos 30 días
  ELSE
    v_desde := now() - interval '30 days';

    RETURN QUERY
    SELECT 
      to_char(date_trunc('day', lm.fecha_registro), 'YYYY-MM-DD') AS periodo,
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
    GROUP BY date_trunc('day', lm.fecha_registro)
    ORDER BY date_trunc('day', lm.fecha_registro) ASC;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_metricas_grafico(text, text, text) TO authenticated;