-- database/10_reestructuracion_planta_35_maquinas.sql
-- ==========================================================================
-- REESTRUCTURACIÓN DE BASE DE DATOS: PLANTA DE 35 MÁQUINAS (INDUSTRIA 4.0)
-- ==========================================================================

-- 1. Agregar nuevas columnas de producción, tiempos, energía y alarmas
ALTER TABLE public.lecturas_maquina
  ADD COLUMN IF NOT EXISTS piezas_producidas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tiempo_operacion_min numeric(8, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS tiempo_parada_min numeric(8, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS consumo_energia_kwh numeric(8, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS alarma text NOT NULL DEFAULT 'Ninguna';

-- 2. Restricción para admitir exactamente desde MAQ-01 hasta MAQ-35
ALTER TABLE public.lecturas_maquina DROP CONSTRAINT IF EXISTS chk_codigo_maquina;
ALTER TABLE public.lecturas_maquina
  ADD CONSTRAINT chk_codigo_maquina
  CHECK (codigo_maquina ~ '^MAQ-(0[1-9]|[12][0-9]|3[0-5])$');

-- 3. Restricciones de integridad física y operativa en variables numéricas
ALTER TABLE public.lecturas_maquina DROP CONSTRAINT IF EXISTS chk_piezas;
ALTER TABLE public.lecturas_maquina
  ADD CONSTRAINT chk_piezas CHECK (piezas_producidas >= 0);

ALTER TABLE public.lecturas_maquina DROP CONSTRAINT IF EXISTS chk_tiempos;
ALTER TABLE public.lecturas_maquina
  ADD CONSTRAINT chk_tiempos CHECK (tiempo_operacion_min >= 0 AND tiempo_parada_min >= 0);

ALTER TABLE public.lecturas_maquina DROP CONSTRAINT IF EXISTS chk_energia;
ALTER TABLE public.lecturas_maquina
  ADD CONSTRAINT chk_energia CHECK (consumo_energia_kwh >= 0);

-- 4. Índices para acelerar ordenamientos y filtros numéricos
CREATE INDEX IF NOT EXISTS idx_lecturas_piezas ON public.lecturas_maquina (piezas_producidas DESC);
CREATE INDEX IF NOT EXISTS idx_lecturas_consumo ON public.lecturas_maquina (consumo_energia_kwh DESC);

-- 5. Actualizar permisos granulares de inserción (Defensa en profundidad / SEC-09)
REVOKE INSERT ON public.lecturas_maquina FROM authenticated;
GRANT INSERT (
  codigo_maquina,
  temperatura,
  nivel_vibracion,
  estado,
  piezas_producidas,
  tiempo_operacion_min,
  tiempo_parada_min,
  consumo_energia_kwh,
  alarma,
  evidencia_path
) ON public.lecturas_maquina TO authenticated;  