-- database/09_reestructuracion_maquinas.sql

-- 1. Eliminar la restricción con los códigos antiguos
ALTER TABLE public.lecturas_maquina DROP CONSTRAINT IF EXISTS chk_codigo_maquina;

-- 2. Crear la nueva restricción con la nueva lista de máquinas
-- (Reemplaza 'MAQ-01', 'MAQ-02', etc., por los códigos reales que vayas a usar)
ALTER TABLE public.lecturas_maquina
  ADD CONSTRAINT chk_codigo_maquina
  CHECK (codigo_maquina IN ('MAQ-01', 'MAQ-02', 'MAQ-03'));