-- database/12_motor_alertas_complejas.sql
-- ==========================================================================
-- DETECTOR DE ANOMALÍAS: FALLOS RECURRENTES Y DÉFICIT DE PRODUCCIÓN
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.detectar_alertas_complejas()
RETURNS TABLE (
  maquina text,
  tipo_alerta text,
  severidad text,
  descripcion text,
  marca_tiempo timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH ultimas_lecturas AS (
    -- Extrae las últimas 3 lecturas de cada máquina mediante orden descendente
    SELECT 
      codigo_maquina,
      estado,
      piezas_producidas,
      tiempo_operacion_min,
      tiempo_parada_min,
      fecha_registro,
      ROW_NUMBER() OVER (PARTITION BY codigo_maquina ORDER BY fecha_registro DESC) as orden
    FROM public.lecturas_maquina
    WHERE fecha_registro >= (now() - interval '6 hours')
  ),
  fallos_consecutivos AS (
    -- Regla 1: 3 lecturas seguidas con estado Falla o Alerta
    SELECT 
      codigo_maquina,
      'FALLO_CONSECUTIVO' AS tipo,
      'CRITICO' AS sev,
      'La máquina acumuló 3 estados consecutivos en Falla o Alerta continua.' AS det,
      MAX(fecha_registro) as ts
    FROM ultimas_lecturas
    WHERE orden <= 3 AND estado IN ('Falla', 'Alerta')
    GROUP BY codigo_maquina
    HAVING COUNT(*) = 3
  ),
  baja_produccion AS (
    -- Regla 2: Máquina operativa con menos de 10 piezas registradas y parada alta (> 20 min)
    SELECT 
      codigo_maquina,
      'BAJA_PRODUCTIVIDAD' AS tipo,
      'ADVERTENCIA' AS sev,
      'Producción anormalmente baja (' || piezas_producidas || ' pzs) con ' || tiempo_parada_min || ' min de paro.' AS det,
      fecha_registro AS ts
    FROM ultimas_lecturas
    WHERE orden = 1 AND piezas_producidas < 10 AND tiempo_parada_min > 20
  )
  SELECT codigo_maquina, tipo, sev, det, ts FROM fallos_consecutivos
  UNION ALL
  SELECT codigo_maquina, tipo, sev, det, ts FROM baja_produccion;
$$;

GRANT EXECUTE ON FUNCTION public.detectar_alertas_complejas() TO authenticated;